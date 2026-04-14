import { Database } from '../database';
import { StorageEntity } from '../models';
import { AccountService } from './accountService';

export class StorageService {
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

        const current = await this.database.storages.findOne({ userId: account.userId });
        return current?.data[normalizedKey] ?? null;
    }

    async listStorages() {
        const storages = await this.database.storages.findMany({});
        return storages.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    async getStorageByUserId(userId: string) {
        return this.database.storages.findOne({
            userId: normalizeUserId(userId)
        });
    }

    async adminSave(userId: string, save: Record<string, string>) {
        return this.saveByUserId(normalizeUserId(userId), save);
    }

    async deleteKeys(userId: string, keys: string[]) {
        const normalizedUserId = normalizeUserId(userId);
        const normalizedKeys = normalizeKeys(keys);

        if (!normalizedKeys.length) {
            throw new Error('At least one storage key is required');
        }

        for (let attempt = 0; attempt < 5; ++attempt) {
            const current = await this.database.storages.findOne({ userId: normalizedUserId });
            if (!current) {
                return [];
            }

            const nextData = {
                ...(current.data ?? {})
            };
            let removedCount = 0;

            for (const key of normalizedKeys) {
                if (key in nextData) {
                    delete nextData[key];
                    removedCount += 1;
                }
            }

            if (!removedCount) {
                return [];
            }

            const now = new Date();
            const hasVersion = typeof current.version === 'number';
            const result = await this.database.storages.update(
                hasVersion
                    ? { userId: normalizedUserId, version: current.version }
                    : { userId: normalizedUserId, version: { $exists: false } },
                hasVersion
                    ? {
                        $set: {
                            data: nextData,
                            updatedAt: now
                        },
                        $inc: {
                            version: 1
                        }
                    }
                    : {
                        $set: {
                            data: nextData,
                            updatedAt: now,
                            version: 1
                        }
                    }
            );

            if (result.numAffected > 0) {
                return normalizedKeys.filter(key => !(key in nextData));
            }
        }

        throw new Error('Storage delete conflict, please retry');
    }

    private async saveByUserId(userId: string, save: Record<string, string>) {
        const normalizedData = normalizeSaveInput(save);
        const savedKeys = Object.keys(normalizedData);

        for (let attempt = 0; attempt < 5; ++attempt) {
            const current = await this.database.storages.findOne({ userId });
            const now = new Date();

            if (!current) {
                try {
                    const entity: StorageEntity = {
                        userId,
                        data: normalizedData,
                        createdAt: now,
                        updatedAt: now,
                        version: 1
                    };
                    await this.database.storages.insert(entity);
                    return savedKeys;
                }
                catch (error) {
                    if (isUniqueConstraintError(error)) {
                        continue;
                    }

                    throw error;
                }
            }

            const mergedData = {
                ...(current.data ?? {}),
                ...normalizedData
            };
            const hasVersion = typeof current.version === 'number';
            const result = await this.database.storages.update(
                hasVersion
                    ? { userId, version: current.version }
                    : { userId, version: { $exists: false } },
                hasVersion
                    ? {
                        $set: {
                            data: mergedData,
                            updatedAt: now
                        },
                        $inc: {
                            version: 1
                        }
                    }
                    : {
                        $set: {
                            data: mergedData,
                            updatedAt: now,
                            version: 1
                        }
                    }
            );

            if (result.numAffected > 0) {
                return savedKeys;
            }
        }

        throw new Error('Storage save conflict, please retry');
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
