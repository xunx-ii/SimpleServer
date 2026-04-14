import * as fs from 'fs/promises';
import * as path from 'path';
import { NeDbCollection } from './nedb';
import { AccountEntity, SessionEntity, StorageEntity } from './models';

export interface Database {
    accounts: NeDbCollection<AccountEntity>
    storages: NeDbCollection<StorageEntity>
    sessions: NeDbCollection<SessionEntity>
}

export async function createDatabase(options: {
    dataDir?: string
    inMemoryOnly?: boolean
}): Promise<Database> {
    const inMemoryOnly = options.inMemoryOnly ?? false;
    const dataDir = options.dataDir ?? path.resolve(process.cwd(), '.data');

    if (!inMemoryOnly) {
        await fs.mkdir(dataDir, { recursive: true });
    }

    const accounts = new NeDbCollection<AccountEntity>({
        filename: inMemoryOnly ? undefined : path.join(dataDir, 'accounts.db'),
        inMemoryOnly
    });
    const storages = new NeDbCollection<StorageEntity>({
        filename: inMemoryOnly ? undefined : path.join(dataDir, 'storages.db'),
        inMemoryOnly
    });
    const sessions = new NeDbCollection<SessionEntity>({
        filename: inMemoryOnly ? undefined : path.join(dataDir, 'sessions.db'),
        inMemoryOnly
    });

    await Promise.all([
        accounts.init(),
        storages.init(),
        sessions.init()
    ]);

    await Promise.all([
        accounts.ensureIndex('userId', true),
        accounts.ensureIndex('username', true),
        storages.ensureIndex('userId', true),
        sessions.ensureIndex('tokenHash', true),
        sessions.ensureIndex('userId'),
        sessions.ensureIndex('expiresAt', { expireAfterSeconds: 0 })
    ]);

    return {
        accounts,
        storages,
        sessions
    };
}
