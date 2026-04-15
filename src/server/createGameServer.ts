import * as path from 'path';
import { WsServer, type LogLevel, type WsConnection } from 'tsrpc';
import { serviceProto, ServiceType } from '../shared/protocols/serviceProto';
import { createAdminServer } from './admin/createAdminServer';
import { AdminServerConfig } from './config';
import { clearAppContext, createAppContext, setAppContext } from './context';

export interface GameServerLoggingOptions {
    logLevel?: LogLevel
    logReqBody?: boolean
    logResBody?: boolean
    logMsg?: boolean
    logConnect?: boolean
}

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
    logging?: GameServerLoggingOptions
} = {}): Promise<GameServerInstance> {
    const wsPort = options.port ?? Number(process.env.PORT ?? 23414);
    const server = new WsServer(serviceProto, {
        port: wsPort,
        json: true,
        logLevel: options.logging?.logLevel ?? 'info',
        logReqBody: options.logging?.logReqBody ?? false,
        logResBody: options.logging?.logResBody ?? false,
        logMsg: options.logging?.logMsg ?? false,
        logConnect: options.logging?.logConnect ?? false
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

    server.flows.postConnectFlow.push(flowData => {
        appContext.connections.registerConnection(flowData as WsConnection<ServiceType>);
        return flowData;
    });

    server.flows.postDisconnectFlow.push(async flowData => {
        const userId = appContext.connections.unregisterConnection(flowData.conn.id);
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
            try {
                if (adminServer) {
                    await adminServer.start();
                }
            }
            catch (error) {
                await server.stop();
                throw error;
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
            appContext.accounts.dispose();
            appContext.connections.clear();
            clearAppContext(server);
        }
    };
}
