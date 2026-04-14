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
        const normalizedData = normalizeSaveInput(save);
        const savedKeys = Object.keys(normalizedData);

        for (let attempt = 0; attempt < 5; ++attempt) {
            const current = await this.database.storages.findOne({ userId: account.userId });
            const now = new Date();

            if (!current) {
                try {
                    const entity: StorageEntity = {
                        userId: account.userId,
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
                    ? { userId: account.userId, version: current.version }
                    : { userId: account.userId, version: { $exists: false } },
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

    async get(token: string, key: string, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            throw new Error('Storage key is required');
        }

        const current = await this.database.storages.findOne({ userId: account.userId });
        return current?.data[normalizedKey] ?? null;
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
