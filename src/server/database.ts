import * as fs from 'fs/promises';
import * as path from 'path';
import { NeDbCollection } from './nedb';
import { AccountEntity } from './models';

export interface Database {
    accounts: NeDbCollection<AccountEntity>
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

    await accounts.init();

    await Promise.all([
        accounts.ensureIndex('userId', true),
        accounts.ensureIndex('username', true)
    ]);

    return {
        accounts
    };
}
