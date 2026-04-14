import { WsServer } from 'tsrpc';
import { ServiceType } from '../shared/protocols/serviceProto';
import { ConnectionRegistry } from './connectionRegistry';
import { createDatabase, Database } from './database';
import { AccountService } from './services/accountService';
import { RoomService } from './services/roomService';
import { StorageService } from './services/storageService';

export interface AppContext {
    database: Database
    connections: ConnectionRegistry
    accounts: AccountService
    storage: StorageService
    rooms: RoomService
}

const appContexts = new WeakMap<object, AppContext>();

export async function createAppContext(
    server: WsServer<ServiceType>,
    options: {
        dataDir?: string
        inMemoryDb?: boolean
        sessionTtlMs?: number
    } = {}
): Promise<AppContext> {
    const database = await createDatabase({
        dataDir: options.dataDir,
        inMemoryOnly: options.inMemoryDb
    });
    const connections = new ConnectionRegistry(server);
    const accounts = new AccountService(database, connections, {
        sessionTtlMs: options.sessionTtlMs
    });
    const storage = new StorageService(database, accounts);
    const rooms = new RoomService(server, accounts, connections);

    return {
        database,
        connections,
        accounts,
        storage,
        rooms
    };
}

export function setAppContext(server: object, appContext: AppContext) {
    appContexts.set(server, appContext);
}

export function clearAppContext(server: object) {
    appContexts.delete(server);
}

export function getAppContext(server: object) {
    const appContext = appContexts.get(server);
    if (!appContext) {
        throw new Error('Application context is not initialized');
    }

    return appContext;
}
