import * as fs from 'fs/promises';
import * as path from 'path';
import { NeDbCollection } from './nedb';
import { AccountEntity, RoomEntity } from './models';

export interface Database {
    accounts: NeDbCollection<AccountEntity>
    rooms: NeDbCollection<RoomEntity>
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
    const rooms = new NeDbCollection<RoomEntity>({
        filename: inMemoryOnly ? undefined : path.join(dataDir, 'rooms.db'),
        inMemoryOnly
    });

    await Promise.all([
        accounts.init(),
        rooms.init()
    ]);

    await Promise.all([
        accounts.ensureIndex('userId', true),
        accounts.ensureIndex('username', true),
        rooms.ensureIndex('roomId', true)
    ]);

    return {
        accounts,
        rooms
    };
}
