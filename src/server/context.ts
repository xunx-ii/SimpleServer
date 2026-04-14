import { WsServer } from 'tsrpc';
import { ServiceType } from '../shared/protocols/serviceProto';
import { ConnectionRegistry } from './connectionRegistry';
import { createDatabase, Database } from './database';
import { AccountService } from './services/accountService';
import { RoomService } from './services/roomService';

export interface AppContext {
    database: Database
    connections: ConnectionRegistry
    accounts: AccountService
    rooms: RoomService
}

let currentAppContext: AppContext | undefined;

export async function createAppContext(
    server: WsServer<ServiceType>,
    options: {
        dataDir?: string
        inMemoryDb?: boolean
    } = {}
): Promise<AppContext> {
    const database = await createDatabase({
        dataDir: options.dataDir,
        inMemoryOnly: options.inMemoryDb
    });
    const connections = new ConnectionRegistry(server);
    const accounts = new AccountService(database, connections);
    const rooms = new RoomService(server, accounts, connections);

    return {
        database,
        connections,
        accounts,
        rooms
    };
}

export function setAppContext(appContext: AppContext | undefined) {
    currentAppContext = appContext;
}

export function getAppContext() {
    if (!currentAppContext) {
        throw new Error('Application context is not initialized');
    }

    return currentAppContext;
}
