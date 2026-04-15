import * as assert from 'assert';
import { describe, it } from 'vitest';
import { ConnectionStatus, WsServer } from 'tsrpc';
import { serviceProto } from '../../src/shared/protocols/serviceProto';
import { ConnectionRegistry } from '../../src/server/connectionRegistry';
import { createDatabase } from '../../src/server/database';
import { AccountService } from '../../src/server/services/accountService';
import { RoomService } from '../../src/server/services/roomService';

describe('RoomSyncPerformance', () => {
    it('dispatches room sync through the fast path without waiting for generic broadcast', async () => {
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
        const accounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const rooms = new RoomService(server, accounts, connections);

        try {
            const aliceSends: (string | Uint8Array)[] = [];
            const bobSends: (string | Uint8Array)[] = [];
            let roomSyncBroadcastCalls = 0;

            (server as any).broadcastMsg = async (msgName: string) => {
                if (msgName === 'Room/Sync') {
                    roomSyncBroadcastCalls += 1;
                    throw new Error('Room/Sync should not use generic broadcastMsg in fast path');
                }

                return {
                    isSucc: true
                };
            };

            connections.registerConnection(createFakeConnection('room-sync-fast-1', aliceSends));
            connections.registerConnection(createFakeConnection('room-sync-fast-2', bobSends));

            const aliceSession = await accounts.register({
                username: 'room_sync_fast_alice',
                password: 'password123',
                displayName: 'Alice'
            }, 'room-sync-fast-1');
            const bobSession = await accounts.register({
                username: 'room_sync_fast_bob',
                password: 'password123',
                displayName: 'Bob'
            }, 'room-sync-fast-2');

            const createdRoom = await rooms.createRoom(aliceSession.token, {
                name: 'Fast Sync Room',
                maxPlayers: 4
            }, 'room-sync-fast-1');
            await rooms.joinRoom(bobSession.token, createdRoom.roomId, 'room-sync-fast-2');

            const result = await rooms.sync(aliceSession.token, {
                kind: 'state',
                payload: '{"hp":100}'
            }, 'room-sync-fast-1');

            assert.deepStrictEqual(new Set(result.deliveredUserIds), new Set([
                aliceSession.user.userId,
                bobSession.user.userId
            ]));
            assert.strictEqual(aliceSends.length, 1);
            assert.strictEqual(bobSends.length, 1);
            assert.strictEqual(roomSyncBroadcastCalls, 0);
        }
        finally {
            rooms.dispose();
            accounts.dispose();
            connections.clear();
        }
    });

    it('drops room sync sends to connections that are already badly backlogged', async () => {
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
        const accounts = new AccountService(database, connections, {
            sessionTtlMs: 5000
        });
        const rooms = new RoomService(server, accounts, connections);

        try {
            const fastConnSends: (string | Uint8Array)[] = [];
            const slowConnSends: (string | Uint8Array)[] = [];

            (server as any).broadcastMsg = async () => {
                return {
                    isSucc: true
                };
            };

            connections.registerConnection(createFakeConnection('room-sync-drop-1', fastConnSends));
            connections.registerConnection(createFakeConnection('room-sync-drop-2', slowConnSends, 300000));

            const aliceSession = await accounts.register({
                username: 'room_sync_drop_alice',
                password: 'password123',
                displayName: 'Alice'
            }, 'room-sync-drop-1');
            const bobSession = await accounts.register({
                username: 'room_sync_drop_bob',
                password: 'password123',
                displayName: 'Bob'
            }, 'room-sync-drop-2');

            const createdRoom = await rooms.createRoom(aliceSession.token, {
                name: 'Backpressure Room',
                maxPlayers: 4
            }, 'room-sync-drop-1');
            await rooms.joinRoom(bobSession.token, createdRoom.roomId, 'room-sync-drop-2');

            const result = await rooms.sync(aliceSession.token, {
                kind: 'state',
                payload: '{"hp":90}'
            }, 'room-sync-drop-1');

            assert.deepStrictEqual(new Set(result.deliveredUserIds), new Set([
                aliceSession.user.userId,
                bobSession.user.userId
            ]));
            assert.strictEqual(fastConnSends.length, 1);
            assert.strictEqual(slowConnSends.length, 0);
        }
        finally {
            rooms.dispose();
            accounts.dispose();
            connections.clear();
        }
    });
});

function createFakeConnection(
    id: string,
    sends: (string | Uint8Array)[],
    bufferedAmount = 0
) {
    return {
        id,
        status: ConnectionStatus.Opened,
        dataType: 'text',
        ws: {
            bufferedAmount,
            send(data: string | Uint8Array, callback?: (error?: Error) => void) {
                sends.push(data);
                callback?.();
            }
        }
    } as any;
}
