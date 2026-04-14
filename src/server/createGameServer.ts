import * as path from 'path';
import { WsServer } from 'tsrpc';
import { serviceProto, ServiceType } from '../shared/protocols/serviceProto';
import { createAdminServer } from './admin/createAdminServer';
import { AdminServerConfig } from './config';
import { clearAppContext, createAppContext, setAppContext } from './context';

export interface GameServerInstance {
    server: WsServer<ServiceType>
    adminUrl?: string
    start: () => Promise<void>
    stop: () => Promise<void>
}

export async function createGameServer(options: {
    port?: number
    dataDir?: string
    inMemoryDb?: boolean
    sessionTtlMs?: number
    admin?: AdminServerConfig
} = {}): Promise<GameServerInstance> {
    const wsPort = options.port ?? Number(process.env.PORT ?? 23414);
    const server = new WsServer(serviceProto, {
        port: wsPort,
        json: true
    });

    const appContext = await createAppContext(server, {
        dataDir: options.dataDir ?? process.env.DATA_DIR,
        inMemoryDb: options.inMemoryDb,
        sessionTtlMs: options.sessionTtlMs
    });
    setAppContext(server, appContext);

    const adminServer = !options.admin || options.admin.enabled === false
        ? undefined
        : createAdminServer(appContext, options.admin, {
            wsPort
        });

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
        adminUrl: adminServer?.url,
        start: async () => {
            if (started) {
                return;
            }

            await server.start();
            if (adminServer) {
                await adminServer.start();
            }
            started = true;
        },
        stop: async () => {
            if (started) {
                if (adminServer) {
                    await adminServer.stop();
                }
                await server.stop();
                started = false;
            }

            appContext.rooms.dispose();
            appContext.connections.clear();
            clearAppContext(server);
        }
    };
}
