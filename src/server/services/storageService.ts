import { Database } from '../database';
import { StorageEntity } from '../models';
import { AccountService } from './accountService';

const STORAGE_FLUSH_DELAY_MS = 25;
const DELETE_STORAGE_VALUE = Symbol('delete_storage_value');

type PendingStorageValue = string | typeof DELETE_STORAGE_VALUE;

type StorageState = {
    entity: StorageEntity | null
    pendingChanges: Map<string, PendingStorageValue>
    flushTimer?: NodeJS.Timeout
    flushPromise?: Promise<void>
};

export class StorageService {
    private readonly stateByUserId = new Map<string, StorageState>();
    private readonly loadByUserId = new Map<string, Promise<StorageState>>();

    constructor(
        private readonly database: Database,
        private readonly accounts: AccountService
    ) {
    }

    async dispose() {
        await this.flushAll();

        for (const state of this.stateByUserId.values()) {
            if (state.flushTimer) {
                clearTimeout(state.flushTimer);
            }
        }

        this.stateByUserId.clear();
        this.loadByUserId.clear();
    }

    async save(token: string, save: Record<string, string>, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        return this.saveByUserId(account.userId, save);
    }

    async get(token: string, key: string, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            throw new Error('Storage key is required');
        }

        const state = await this.getOrLoadState(account.userId);
        return state.entity?.data[normalizedKey] ?? null;
    }

    async listStorages() {
        const storages = await this.database.storages.findMany({});
        const merged = new Map<string, StorageEntity>();

        for (const storage of storages) {
            merged.set(storage.userId, storage);
            this.cacheLoadedStorage(storage);
        }

        for (const [userId, state] of this.stateByUserId) {
            if (state.entity) {
                merged.set(userId, state.entity);
            }
        }

        return Array.from(merged.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getStorageByUserId(userId: string) {
        return (await this.getOrLoadState(normalizeUserId(userId))).entity;
    }

    async adminSave(userId: string, save: Record<string, string>) {
        const normalizedUserId = normalizeUserId(userId);
        await this.requireExistingUser(normalizedUserId);
        return this.saveByUserId(normalizedUserId, save);
    }

    async deleteKeys(userId: string, keys: string[]) {
        const normalizedUserId = normalizeUserId(userId);
        await this.requireExistingUser(normalizedUserId);
        const normalizedKeys = normalizeKeys(keys);

        if (!normalizedKeys.length) {
            throw new Error('At least one storage key is required');
        }

        const state = await this.getOrLoadState(normalizedUserId);
        if (!state.entity) {
            return [];
        }

        const deletedKeys = normalizedKeys.filter(key => key in state.entity!.data);
        if (!deletedKeys.length) {
            return [];
        }

        const now = new Date();
        const nextData = {
            ...(state.entity.data ?? {})
        };

        for (const key of deletedKeys) {
            delete nextData[key];
            state.pendingChanges.set(key, DELETE_STORAGE_VALUE);
        }

        state.entity = {
            ...state.entity,
            data: nextData,
            updatedAt: now,
            version: (state.entity.version ?? 0) + 1
        };

        this.scheduleFlush(normalizedUserId, state);
        return deletedKeys;
    }

    async flushAll() {
        for (const state of this.stateByUserId.values()) {
            if (state.flushTimer) {
                clearTimeout(state.flushTimer);
                state.flushTimer = undefined;
            }
        }

        while (true) {
            const flushes: Promise<void>[] = [];

            for (const [userId, state] of this.stateByUserId) {
                if (state.flushPromise) {
                    flushes.push(state.flushPromise);
                    continue;
                }

                if (state.pendingChanges.size) {
                    flushes.push(this.flushUser(userId, state));
                }
            }

            if (!flushes.length) {
                return;
            }

            const results = await Promise.allSettled(flushes);
            const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
            if (failure) {
                throw failure.reason;
            }
        }
    }

    private async saveByUserId(userId: string, save: Record<string, string>) {
        const normalizedData = normalizeSaveInput(save);
        const savedKeys = Object.keys(normalizedData);
        if (!savedKeys.length) {
            return [];
        }

        const state = await this.getOrLoadState(userId);
        const now = new Date();

        if (!state.entity) {
            state.entity = {
                userId,
                data: {},
                createdAt: now,
                updatedAt: now,
                version: 0
            };
        }

        state.entity = {
            ...state.entity,
            data: {
                ...(state.entity.data ?? {}),
                ...normalizedData
            },
            updatedAt: now,
            version: (state.entity.version ?? 0) + 1
        };

        for (const [key, value] of Object.entries(normalizedData)) {
            state.pendingChanges.set(key, value);
        }

        this.scheduleFlush(userId, state);
        return savedKeys;
    }

    private async requireExistingUser(userId: string) {
        const user = await this.accounts.getUser(userId);
        if (!user) {
            throw new Error('Account not found');
        }
    }

    private async getOrLoadState(userId: string) {
        const cached = this.stateByUserId.get(userId);
        if (cached) {
            return cached;
        }

        const pending = this.loadByUserId.get(userId);
        if (pending) {
            return pending;
        }

        const task = this.database.storages.findOne({ userId })
            .then(storage => {
                const state = createStorageState(storage);
                this.stateByUserId.set(userId, state);
                this.loadByUserId.delete(userId);
                return state;
            })
            .catch(error => {
                this.loadByUserId.delete(userId);
                throw error;
            });

        this.loadByUserId.set(userId, task);
        return task;
    }

    private cacheLoadedStorage(storage: StorageEntity) {
        const state = this.stateByUserId.get(storage.userId);
        if (!state) {
            this.stateByUserId.set(storage.userId, createStorageState(storage));
            return;
        }

        if (!state.pendingChanges.size && !state.flushPromise) {
            state.entity = storage;
        }
    }

    private scheduleFlush(userId: string, state: StorageState, delayMs = STORAGE_FLUSH_DELAY_MS) {
        if (state.flushTimer || state.flushPromise || !state.pendingChanges.size) {
            return;
        }

        state.flushTimer = setTimeout(() => {
            state.flushTimer = undefined;
            void this.flushUser(userId, state).catch(error => {
                reportBackgroundFlushError(userId, error);
            });
        }, delayMs);
    }

    private async flushUser(userId: string, state: StorageState) {
        if (state.flushPromise) {
            return state.flushPromise;
        }

        if (!state.pendingChanges.size || !state.entity) {
            return;
        }

        const entitySnapshot = cloneStorage(state.entity);
        const pendingSnapshot = new Map(state.pendingChanges);
        state.pendingChanges.clear();

        const flushPromise = (async () => {
            try {
                if (!entitySnapshot._id) {
                    await this.flushInsert(userId, entitySnapshot, pendingSnapshot);
                }
                else {
                    await this.flushUpdate(entitySnapshot, pendingSnapshot);
                }
            }
            catch (error) {
                mergePendingChanges(state.pendingChanges, pendingSnapshot);
                throw error;
            }
            finally {
                state.flushPromise = undefined;
                if (state.pendingChanges.size) {
                    this.scheduleFlush(userId, state);
                }
            }
        })();

        state.flushPromise = flushPromise;
        return flushPromise;
    }

    private async flushInsert(
        userId: string,
        entitySnapshot: StorageEntity,
        pendingSnapshot: Map<string, PendingStorageValue>
    ) {
        try {
            const inserted = await this.database.storages.insert(entitySnapshot);
            const currentState = this.stateByUserId.get(userId);
            if (currentState?.entity && !currentState.entity._id) {
                currentState.entity = {
                    ...currentState.entity,
                    _id: inserted._id ?? currentState.entity._id
                };
            }
        }
        catch (error) {
            if (!isUniqueConstraintError(error)) {
                throw error;
            }

            await this.flushUpdate(entitySnapshot, pendingSnapshot);
        }
    }

    private async flushUpdate(
        entitySnapshot: StorageEntity,
        pendingSnapshot: Map<string, PendingStorageValue>
    ) {
        const setFields: Record<string, any> = {
            updatedAt: entitySnapshot.updatedAt,
            version: entitySnapshot.version ?? 0
        };
        const unsetFields: Record<string, true> = {};

        for (const [key, value] of pendingSnapshot) {
            if (value === DELETE_STORAGE_VALUE) {
                unsetFields[`data.${key}`] = true;
                continue;
            }

            setFields[`data.${key}`] = value;
        }

        const updateQuery: Record<string, any> = {
            $set: setFields
        };
        if (Object.keys(unsetFields).length) {
            updateQuery.$unset = unsetFields;
        }

        const result = await this.database.storages.update(
            { userId: entitySnapshot.userId },
            updateQuery
        );

        if (result.numAffected > 0) {
            return;
        }

        const inserted = await this.database.storages.insert(entitySnapshot);
        const currentState = this.stateByUserId.get(entitySnapshot.userId);
        if (currentState?.entity && !currentState.entity._id) {
            currentState.entity = {
                ...currentState.entity,
                _id: inserted._id ?? currentState.entity._id
            };
        }
    }
}

function createStorageState(entity: StorageEntity | null): StorageState {
    return {
        entity,
        pendingChanges: new Map()
    };
}

function cloneStorage(entity: StorageEntity): StorageEntity {
    return {
        ...entity,
        data: {
            ...(entity.data ?? {})
        }
    };
}

function mergePendingChanges(
    target: Map<string, PendingStorageValue>,
    source: Map<string, PendingStorageValue>
) {
    for (const [key, value] of source) {
        if (!target.has(key)) {
            target.set(key, value);
        }
    }
}

function normalizeSaveInput(save: Record<string, string>) {
    if (!save || Array.isArray(save) || typeof save !== 'object') {
        throw new Error('Save payload must be a JSON object');
    }

    const normalizedEntries = Object.entries(save).map(([key, value]) => {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            throw new Error('Storage key cannot be empty');
        }

        if (typeof value !== 'string') {
            throw new Error(`Storage value of "${normalizedKey}" must be a string`);
        }

        return [normalizedKey, value] as const;
    });

    return Object.fromEntries(normalizedEntries);
}

function isUniqueConstraintError(error: unknown) {
    return error instanceof Error && /unique constraint/i.test(error.message);
}

function normalizeUserId(userId: string) {
    const normalized = userId.trim();
    if (!normalized) {
        throw new Error('User id is required');
    }

    return normalized;
}

function normalizeKeys(keys: string[]) {
    return keys.map(key => key.trim()).filter(Boolean);
}

function reportBackgroundFlushError(userId: string, error: unknown) {
    console.error(`[StorageService] Failed to flush storage for user ${userId}`, error);
}
