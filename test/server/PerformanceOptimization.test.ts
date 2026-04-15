import * as assert from 'assert';
import { afterAll, describe, it } from 'vitest';
import { ConnectionStatus, WsServer } from 'tsrpc';
import { serviceProto } from '../../src/shared/protocols/serviceProto';
import { createDatabase } from '../../src/server/database';
import { ConnectionRegistry } from '../../src/server/connectionRegistry';
import { AccountService } from '../../src/server/services/accountService';
import { RoomService } from '../../src/server/services/roomService';

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

    it('batches account profile lookups when listing rooms for the dashboard', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true,
            logLevel: 'warn',
            logMsg: false
        });
        const database = await createDatabase({
            inMemoryOnly: true
        });
        const connections = new ConnectionRegistry(server);
        const warmAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const dashboardAccounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const rooms = new RoomService(server, dashboardAccounts, connections);
        (server as any).broadcastMsg = async () => {
            return {
                isSucc: true
            };
        };

        disposableServers.push(server);
        disposableAccounts.push(warmAccounts, dashboardAccounts);
        disposableConnections.push(connections);

        const connIds = ['perf-room-1', 'perf-room-2', 'perf-room-3', 'perf-room-4'];
        for (const connId of connIds) {
            connections.registerConnection({
                id: connId,
                status: ConnectionStatus.Opened
            } as any);
        }

        const alice = await warmAccounts.register({
            username: 'dashboard_room_alice',
            password: 'password123',
            displayName: 'Alice'
        });
        const bob = await warmAccounts.register({
            username: 'dashboard_room_bob',
            password: 'password123',
            displayName: 'Bob'
        });
        const charlie = await warmAccounts.register({
            username: 'dashboard_room_charlie',
            password: 'password123',
            displayName: 'Charlie'
        });
        const diana = await warmAccounts.register({
            username: 'dashboard_room_diana',
            password: 'password123',
            displayName: 'Diana'
        });

        const roomA = await rooms.createRoom(alice.token, {
            name: 'Perf Room A',
            maxPlayers: 4
        }, connIds[0]);
        await rooms.joinRoom(bob.token, roomA.roomId, connIds[1]);

        const roomB = await rooms.createRoom(charlie.token, {
            name: 'Perf Room B',
            maxPlayers: 4
        }, connIds[2]);
        await rooms.joinRoom(diana.token, roomB.roomId, connIds[3]);

        (dashboardAccounts as any).accountByUserId.clear();
        (dashboardAccounts as any).profileByUserId.clear();
        (dashboardAccounts as any).userIdByUsername.clear();

        let accountFindManyCount = 0;
        const originalAccountFindMany = database.accounts.findMany.bind(database.accounts);
        database.accounts.findMany = async query => {
            accountFindManyCount += 1;
            return originalAccountFindMany(query);
        };

        const listedRooms = await rooms.listRooms();

        assert.strictEqual(listedRooms.length, 2);
        assert.strictEqual(accountFindManyCount, 1);
    });

    it('queries only non-expired sessions when aggregating active session counts', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const database = await createDatabase({
            inMemoryOnly: true
        });
        const connections = new ConnectionRegistry(server);
        const accounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });

        disposableServers.push(server);
        disposableAccounts.push(accounts);
        disposableConnections.push(connections);

        const session = await accounts.register({
            username: 'active_session_perf_user',
            password: 'password123',
            displayName: 'Active Session Perf User'
        });

        await database.sessions.insert({
            tokenHash: 'expired-session-token-hash',
            userId: session.user.userId,
            createdAt: new Date(0),
            lastSeenAt: new Date(0),
            expiresAt: new Date(Date.now() - 60_000)
        });

        let capturedQuery: Record<string, any> | undefined;
        const originalSessionFindMany = database.sessions.findMany.bind(database.sessions);
        database.sessions.findMany = async query => {
            capturedQuery = query;
            return originalSessionFindMany(query);
        };

        const counts = await accounts.listActiveSessionCounts();

        assert.strictEqual(counts.get(session.user.userId), 1);
        assert.ok(capturedQuery);
        assert.ok(capturedQuery?.expiresAt);
        assert.ok(capturedQuery?.expiresAt.$gt instanceof Date);
    });
});
