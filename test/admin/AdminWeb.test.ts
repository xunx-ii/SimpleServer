import * as assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../../src';
import { RoomEvent } from '../../src/shared/models/GameModels';
import { serviceProto } from '../../src/shared/protocols/serviceProto';

describe.sequential('AdminWeb', () => {
    const wsPort = 35797;
    const adminPort = 35798;
    const dataDir = path.resolve(process.cwd(), '.data-admin-web');
    const wsUrl = `ws://127.0.0.1:${wsPort}`;
    const adminBaseUrl = `http://127.0.0.1:${adminPort}`;

    let gameServer: Awaited<ReturnType<typeof createGameServer>>;
    const aliceClient = new WsClient(serviceProto, {
        server: wsUrl,
        json: true
    });
    const bobClient = new WsClient(serviceProto, {
        server: wsUrl,
        json: true
    });
    const aliceEvents: RoomEvent[] = [];
    const bobEvents: RoomEvent[] = [];

    let aliceToken = '';
    let aliceUserId = '';
    let bobToken = '';
    let bobUserId = '';
    let roomId = '';

    beforeAll(async () => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        gameServer = await createGameServer({
            port: wsPort,
            dataDir,
            admin: {
                port: adminPort,
                username: 'admin',
                password: 'secret-pass'
            }
        });
        await gameServer.start();
        aliceClient.listenMsg('Room/Event', msg => {
            aliceEvents.push(msg);
        });
        bobClient.listenMsg('Room/Event', msg => {
            bobEvents.push(msg);
        });
        assert.strictEqual((await aliceClient.connect()).isSucc, true);
        assert.strictEqual((await bobClient.connect()).isSucc, true);
    });

    afterAll(async () => {
        await Promise.allSettled([
            aliceClient.disconnect(),
            bobClient.disconnect()
        ]);
        await gameServer.stop();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('rolls back ws startup if admin server cannot bind', async () => {
        const rollbackDataDir = path.resolve(process.cwd(), '.data-admin-rollback');
        const rollbackWsPort = 35801;
        const occupiedAdminPort = 35802;
        const blocker = http.createServer();

        fs.rmSync(rollbackDataDir, { recursive: true, force: true });
        await new Promise<void>((resolve, reject) => {
            blocker.once('error', reject);
            blocker.listen(occupiedAdminPort, '127.0.0.1', () => {
                blocker.off('error', reject);
                resolve();
            });
        });

        const failedServer = await createGameServer({
            port: rollbackWsPort,
            dataDir: rollbackDataDir,
            admin: {
                port: occupiedAdminPort,
                username: 'admin',
                password: 'secret-pass'
            }
        });

        await assert.rejects(async () => {
            await failedServer.start();
        });
        await failedServer.stop();

        const retryServer = await createGameServer({
            port: rollbackWsPort,
            dataDir: rollbackDataDir
        });

        try {
            await retryServer.start();
        }
        finally {
            await retryServer.stop();
            await new Promise<void>((resolve, reject) => {
                blocker.close(err => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            });
            fs.rmSync(rollbackDataDir, { recursive: true, force: true });
        }
    });

    it('logs into the admin page and manages room, player, and storage state', async () => {
        aliceEvents.length = 0;
        bobEvents.length = 0;

        const register = await aliceClient.callApi('Account/Register', {
            username: 'admin_alice',
            password: 'password123',
            displayName: 'Admin Alice'
        });
        assert.ok(register.isSucc);
        if (!register.isSucc) {
            return;
        }

        aliceToken = register.res.session.token;
        aliceUserId = register.res.session.user.userId;

        const registerBob = await bobClient.callApi('Account/Register', {
            username: 'admin_bob',
            password: 'password123',
            displayName: 'Admin Bob'
        });
        assert.ok(registerBob.isSucc);
        if (!registerBob.isSucc) {
            return;
        }

        bobToken = registerBob.res.session.token;
        bobUserId = registerBob.res.session.user.userId;

        const saveStorage = await aliceClient.callApi('Storage/Save', {
            token: aliceToken,
            save: {
                hp: '100'
            }
        });
        assert.ok(saveStorage.isSucc);

        const createRoom = await aliceClient.callApi('Room/Create', {
            token: aliceToken,
            name: 'Admin Room',
            maxPlayers: 4
        });
        assert.ok(createRoom.isSucc);
        if (!createRoom.isSucc) {
            return;
        }

        roomId = createRoom.res.room.roomId;

        const joinRoom = await bobClient.callApi('Room/Join', {
            token: bobToken,
            roomId
        });
        assert.ok(joinRoom.isSucc);
        if (!joinRoom.isSucc) {
            return;
        }

        const loginResponse = await fetch(`${adminBaseUrl}/admin/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'secret-pass'
            })
        });
        assert.strictEqual(loginResponse.status, 200);

        const cookie = loginResponse.headers.get('set-cookie');
        assert.ok(cookie);
        if (!cookie) {
            return;
        }

        const sessionCookie = cookie.split(';', 1)[0];

        const dashboardResponse = await fetch(`${adminBaseUrl}/admin/api/dashboard`, {
            headers: {
                Cookie: sessionCookie
            }
        });
        assert.strictEqual(dashboardResponse.status, 200);

        const dashboard = await dashboardResponse.json() as {
            rooms: { roomId: string }[]
            players: { userId: string, displayName: string, storageKeyCount: number }[]
            storages: { userId: string, data: Record<string, string> }[]
        };

        assert.ok(dashboard.rooms.some(room => room.roomId === roomId));
        assert.ok(dashboard.players.some(player => player.userId === aliceUserId && player.storageKeyCount === 1));
        assert.ok(dashboard.storages.some(storage => storage.userId === aliceUserId && storage.data.hp === '100'));

        const updateDisplayName = await fetch(`${adminBaseUrl}/admin/api/accounts/${encodeURIComponent(aliceUserId)}/display-name`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: sessionCookie
            },
            body: JSON.stringify({
                displayName: 'Admin Alice Renamed'
            })
        });
        assert.strictEqual(updateDisplayName.status, 200);

        const profileAfterRename = await aliceClient.callApi('Account/Profile', {
            token: aliceToken
        });
        assert.ok(profileAfterRename.isSucc);
        if (!profileAfterRename.isSucc) {
            return;
        }

        assert.strictEqual(profileAfterRename.res.user.displayName, 'Admin Alice Renamed');

        const adminSaveStorage = await fetch(`${adminBaseUrl}/admin/api/storages/${encodeURIComponent(aliceUserId)}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: sessionCookie
            },
            body: JSON.stringify({
                save: {
                    mp: '40'
                }
            })
        });
        assert.strictEqual(adminSaveStorage.status, 200);

        const getStoredMp = await aliceClient.callApi('Storage/Get', {
            token: aliceToken,
            key: 'mp'
        });
        assert.ok(getStoredMp.isSucc);
        if (!getStoredMp.isSucc) {
            return;
        }

        assert.strictEqual(getStoredMp.res.value, '40');

        const invalidStorageSave = await fetch(`${adminBaseUrl}/admin/api/storages/${encodeURIComponent('missing-user')}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: sessionCookie
            },
            body: JSON.stringify({
                save: {
                    stray: '1'
                }
            })
        });
        assert.strictEqual(invalidStorageSave.status, 404);

        const kickBob = await fetch(`${adminBaseUrl}/admin/api/rooms/${encodeURIComponent(roomId)}/kick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: sessionCookie
            },
            body: JSON.stringify({
                userId: bobUserId
            })
        });
        assert.strictEqual(kickBob.status, 200);

        const bobKicked = await waitFor(() => {
            return bobEvents.find(event => event.type === 'player_kicked' && event.targetUserId === bobUserId);
        });
        const aliceSawKick = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_kicked' && event.targetUserId === bobUserId);
        });
        assert.strictEqual(bobKicked.room.playerCount, 1);
        assert.strictEqual(aliceSawKick.room.playerCount, 1);

        const bobRoomAfterKick = await bobClient.callApi('Room/My', {
            token: bobToken
        });
        assert.ok(bobRoomAfterKick.isSucc);
        if (!bobRoomAfterKick.isSucc) {
            return;
        }

        assert.strictEqual(bobRoomAfterKick.res.room, null);

        const dismissRoom = await fetch(`${adminBaseUrl}/admin/api/rooms/${encodeURIComponent(roomId)}/delete`, {
            method: 'POST',
            headers: {
                Cookie: sessionCookie
            }
        });
        assert.strictEqual(dismissRoom.status, 200);

        const roomDismissed = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'room_dismissed' && event.roomId === roomId);
        });
        assert.strictEqual(roomDismissed.room.roomId, roomId);

        const roomListAfterDelete = await aliceClient.callApi('Room/List', {});
        assert.ok(roomListAfterDelete.isSucc);
        if (!roomListAfterDelete.isSucc) {
            return;
        }

        assert.strictEqual(roomListAfterDelete.res.rooms.length, 0);
    });
});

async function waitFor<T>(getter: () => T | undefined, timeoutMs = 2000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const result = getter();
        if (result !== undefined) {
            return result;
        }

        await sleep(20);
    }

    throw new Error('Timed out while waiting for async message');
}

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
