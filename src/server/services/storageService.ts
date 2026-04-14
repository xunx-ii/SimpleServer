import { Database } from '../database';
import { StorageEntity } from '../models';
import { AccountService } from './accountService';

export class StorageService {
    constructor(
        private readonly database: Database,
        private readonly accounts: AccountService
    ) {
    }

    async save(token: string, save: Record<string, string>) {
        const account = await this.accounts.requireAccount(token);
        const normalizedData = normalizeSaveInput(save);
        const current = await this.database.storages.findOne({ userId: account.userId });
        const now = new Date();

        if (!current) {
            const entity: StorageEntity = {
                userId: account.userId,
                data: normalizedData,
                createdAt: now,
                updatedAt: now
            };
            await this.database.storages.insert(entity);
        }
        else {
            await this.database.storages.update(
                { userId: account.userId },
                {
                    $set: {
                        data: {
                            ...current.data,
                            ...normalizedData
                        },
                        updatedAt: now
                    }
                }
            );
        }

        return Object.keys(normalizedData);
    }

    async get(token: string, key: string) {
        const account = await this.accounts.requireAccount(token);
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
