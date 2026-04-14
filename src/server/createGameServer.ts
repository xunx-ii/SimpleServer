import * as path from 'path';
import { WsServer } from 'tsrpc';
import { serviceProto, ServiceType } from '../shared/protocols/serviceProto';
import { clearAppContext, createAppContext, setAppContext } from './context';

export interface GameServerInstance {
    server: WsServer<ServiceType>
    start: () => Promise<void>
    stop: () => Promise<void>
}

export async function createGameServer(options: {
    port?: number
    dataDir?: string
    inMemoryDb?: boolean
    sessionTtlMs?: number
} = {}): Promise<GameServerInstance> {
    const server = new WsServer(serviceProto, {
        port: options.port ?? Number(process.env.PORT ?? 23414),
        json: true
    });

    const appContext = await createAppContext(server, {
        dataDir: options.dataDir ?? process.env.DATA_DIR,
        inMemoryDb: options.inMemoryDb,
        sessionTtlMs: options.sessionTtlMs
    });
    setAppContext(server, appContext);

    server.flows.postDisconnectFlow.push(async flowData => {
        const userId = appContext.connections.unbind(flowData.conn.id);
        if (userId && !appContext.connections.isUserOnline(userId)) {
            await appContext.rooms.handleUserOffline(userId);
        }

        return flowData;
    });

    await server.autoImplementApi(path.resolve(__dirname, '../api'));

    let started = false;

    return {
        server,
        start: async () => {
            if (started) {
                return;
            }

            await server.start();
            started = true;
        },
        stop: async () => {
            if (started) {
                await server.stop();
                started = false;
            }

            appContext.rooms.dispose();
            appContext.connections.clear();
            clearAppContext(server);
        }
    };
}
