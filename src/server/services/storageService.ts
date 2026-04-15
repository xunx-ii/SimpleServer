import { Database } from '../database';
import { StorageEntity } from '../models';
import { AccountService } from './accountService';

export class StorageService {
    private readonly storageByUserId = new Map<string, StorageEntity | null>();
    private readonly mutationTailByUserId = new Map<string, Promise<void>>();
    private readonly loadByUserId = new Map<string, Promise<StorageEntity | null>>();

    constructor(
        private readonly database: Database,
        private readonly accounts: AccountService
    ) {
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

        const current = await this.getOrLoadStorage(account.userId);
        return current?.data[normalizedKey] ?? null;
    }

    async listStorages() {
        const storages = await this.database.storages.findMany({});
        for (const storage of storages) {
            this.cacheStorage(storage);
        }
        return storages.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getStorageByUserId(userId: string) {
        return this.getOrLoadStorage(normalizeUserId(userId));
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

        return this.runExclusive(normalizedUserId, () => this.deleteKeysUnlocked(normalizedUserId, normalizedKeys));
    }

    private async saveByUserId(userId: string, save: Record<string, string>) {
        const normalizedData = normalizeSaveInput(save);
        const savedKeys = Object.keys(normalizedData);
        if (!savedKeys.length) {
            return [];
        }

        return this.runExclusive(userId, () => this.saveByUserIdUnlocked(userId, normalizedData, savedKeys));
    }

    private async requireExistingUser(userId: string) {
        const user = await this.accounts.getUser(userId);
        if (!user) {
            throw new Error('Account not found');
        }
    }

    private async getOrLoadStorage(userId: string) {
        if (this.storageByUserId.has(userId)) {
            return this.storageByUserId.get(userId) ?? null;
        }

        const pending = this.loadByUserId.get(userId);
        if (pending) {
            return pending;
        }

        const task = this.database.storages.findOne({ userId })
            .then(storage => {
                this.storageByUserId.set(userId, storage);
                this.loadByUserId.delete(userId);
                return storage;
            })
            .catch(error => {
                this.loadByUserId.delete(userId);
                throw error;
            });

        this.loadByUserId.set(userId, task);
        return task;
    }

    private cacheStorage(storage: StorageEntity) {
        this.storageByUserId.set(storage.userId, storage);
    }

    private clearCachedStorage(userId: string) {
        this.storageByUserId.delete(userId);
        this.loadByUserId.delete(userId);
    }

    private async runExclusive<T>(userId: string, task: () => Promise<T>) {
        const previous = this.mutationTailByUserId.get(userId) ?? Promise.resolve();
        const waitForTurn = previous.catch(() => undefined);
        let release: (() => void) | undefined;
        const current = new Promise<void>(resolve => {
            release = resolve;
        });
        const tail = waitForTurn.then(() => current);
        this.mutationTailByUserId.set(userId, tail);

        await waitForTurn;

        try {
            return await task();
        }
        finally {
            release?.();
            if (this.mutationTailByUserId.get(userId) === tail) {
                this.mutationTailByUserId.delete(userId);
            }
        }
    }

    private async saveByUserIdUnlocked(userId: string, normalizedData: Record<string, string>, savedKeys: string[]) {
        for (let attempt = 0; attempt < 2; ++attempt) {
            const current = await this.getOrLoadStorage(userId);
            if (!current) {
                const inserted = await this.tryInsertStorage(userId, normalizedData);
                if (inserted) {
                    return savedKeys;
                }

                continue;
            }

            const now = new Date();
            const result = await this.database.storages.update(
                { userId },
                {
                    $set: {
                        updatedAt: now,
                        ...toStorageSetFields(normalizedData)
                    },
                    $inc: {
                        version: 1
                    }
                }
            );

            if (result.numAffected < 1) {
                this.clearCachedStorage(userId);
                continue;
            }

            this.cacheStorage({
                ...current,
                data: {
                    ...(current.data ?? {}),
                    ...normalizedData
                },
                updatedAt: now,
                version: (current.version ?? 0) + 1
            });

            return savedKeys;
        }

        throw new Error('Storage save conflict, please retry');
    }

    private async tryInsertStorage(userId: string, normalizedData: Record<string, string>) {
        const now = new Date();
        const entity: StorageEntity = {
            userId,
            data: normalizedData,
            createdAt: now,
            updatedAt: now,
            version: 1
        };

        try {
            const inserted = await this.database.storages.insert(entity);
            this.cacheStorage(inserted);
            return true;
        }
        catch (error) {
            if (!isUniqueConstraintError(error)) {
                throw error;
            }

            this.clearCachedStorage(userId);
            return false;
        }
    }

    private async deleteKeysUnlocked(userId: string, normalizedKeys: string[]) {
        for (let attempt = 0; attempt < 2; ++attempt) {
            const current = await this.getOrLoadStorage(userId);
            if (!current) {
                return [];
            }

            const deletedKeys = normalizedKeys.filter(key => key in (current.data ?? {}));
            if (!deletedKeys.length) {
                return [];
            }

            const now = new Date();
            const result = await this.database.storages.update(
                { userId },
                {
                    $unset: toStorageUnsetFields(deletedKeys),
                    $set: {
                        updatedAt: now
                    },
                    $inc: {
                        version: 1
                    }
                }
            );

            if (result.numAffected < 1) {
                this.clearCachedStorage(userId);
                continue;
            }

            const nextData = {
                ...(current.data ?? {})
            };
            for (const key of deletedKeys) {
                delete nextData[key];
            }

            this.cacheStorage({
                ...current,
                data: nextData,
                updatedAt: now,
                version: (current.version ?? 0) + 1
            });

            return deletedKeys;
        }

        throw new Error('Storage delete conflict, please retry');
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

function toStorageSetFields(save: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(save).map(([key, value]) => [`data.${key}`, value] as const)
    );
}

function toStorageUnsetFields(keys: string[]) {
    return Object.fromEntries(
        keys.map(key => [`data.${key}`, true] as const)
    );
}
