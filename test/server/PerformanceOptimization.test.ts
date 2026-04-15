import * as assert from 'assert';
import { afterAll, describe, it } from 'vitest';
import { ConnectionStatus, WsServer } from 'tsrpc';
import { serviceProto } from '../../src/shared/protocols/serviceProto';
import { createDatabase } from '../../src/server/database';
import { ConnectionRegistry } from '../../src/server/connectionRegistry';
import { AccountService } from '../../src/server/services/accountService';

describe('PerformanceOptimization', () => {
    const disposableServers: WsServer[] = [];
    const disposableAccounts: AccountService[] = [];
    const disposableConnections: ConnectionRegistry[] = [];

    afterAll(() => {
        for (const accounts of disposableAccounts) {
            accounts.dispose();
        }

        for (const connections of disposableConnections) {
            connections.clear();
        }

        disposableServers.length = 0;
        disposableAccounts.length = 0;
        disposableConnections.length = 0;
    });

    it('reuses cached session and account records after the first authenticated lookup', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const database = await createDatabase({
            inMemoryOnly: true
        });
        const connections = new ConnectionRegistry(server);
        const warmAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const cachedAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });

        disposableServers.push(server);
        disposableAccounts.push(warmAccounts, cachedAccounts);
        disposableConnections.push(connections);

        const session = await warmAccounts.register({
            username: 'cache_perf_user',
            password: 'password123',
            displayName: 'Cache Perf User'
        });

        let sessionFindOneCount = 0;
        let accountFindOneCount = 0;
        const originalSessionFindOne = database.sessions.findOne.bind(database.sessions);
        const originalAccountFindOne = database.accounts.findOne.bind(database.accounts);

        database.sessions.findOne = async query => {
            sessionFindOneCount += 1;
            return originalSessionFindOne(query);
        };
        database.accounts.findOne = async query => {
            accountFindOneCount += 1;
            return originalAccountFindOne(query);
        };

        const firstProfile = await cachedAccounts.getProfile(session.token);
        const secondProfile = await cachedAccounts.getProfile(session.token);

        assert.strictEqual(firstProfile.userId, secondProfile.userId);
        assert.strictEqual(sessionFindOneCount, 1);
        assert.strictEqual(accountFindOneCount, 1);
    });

    it('reuses connection-scoped auth state on hot profile requests', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const database = await createDatabase({
            inMemoryOnly: true
        });
        const connections = new ConnectionRegistry(server);
        const warmAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const cachedAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });

        disposableServers.push(server);
        disposableAccounts.push(warmAccounts, cachedAccounts);
        disposableConnections.push(connections);

        const session = await warmAccounts.register({
            username: 'conn_cache_perf_user',
            password: 'password123',
            displayName: 'Conn Cache Perf User'
        });

        const firstProfile = await cachedAccounts.getProfile(session.token, 'perf-conn-1');
        assert.strictEqual(firstProfile.username, 'conn_cache_perf_user');

        let sessionFindOneCount = 0;
        const originalSessionFindOne = database.sessions.findOne.bind(database.sessions);
        database.sessions.findOne = async query => {
            sessionFindOneCount += 1;
            return originalSessionFindOne(query);
        };

        (cachedAccounts as any).sessionByToken.clear();
        (cachedAccounts as any).sessionByTokenHash.clear();
        (cachedAccounts as any).tokenByTokenHash.clear();

        const secondProfile = await cachedAccounts.getProfile(session.token, 'perf-conn-1');

        assert.strictEqual(secondProfile.userId, firstProfile.userId);
        assert.strictEqual(sessionFindOneCount, 0);
    });

    it('resolves online users and target connections without scanning server connection arrays', () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const connections = new ConnectionRegistry(server);

        disposableServers.push(server);
        disposableConnections.push(connections);

        const fakeConn = {
            id: 'perf-conn-1',
            status: ConnectionStatus.Opened
        } as any;

        connections.registerConnection(fakeConn);
        connections.bind(fakeConn.id, 'perf-user-1');

        const originalSome = server.connections.some;
        const originalFilter = server.connections.filter;

        (server.connections as any).some = () => {
            throw new Error('Unexpected full connection scan via some');
        };
        (server.connections as any).filter = () => {
            throw new Error('Unexpected full connection scan via filter');
        };

        try {
            assert.strictEqual(connections.isUserOnline('perf-user-1'), true);
            assert.deepStrictEqual(connections.getOnlineUserIds(), ['perf-user-1']);
            assert.deepStrictEqual(connections.getConnectionsByUserIds(['perf-user-1']), [fakeConn]);
            assert.strictEqual(connections.getOpenedConnectionCount(), 1);
        }
        finally {
            (server.connections as any).some = originalSome;
            (server.connections as any).filter = originalFilter;
        }
    });
});
