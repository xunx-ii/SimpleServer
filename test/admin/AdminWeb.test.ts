import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../../src';
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

    let aliceToken = '';
    let aliceUserId = '';
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
        assert.strictEqual((await aliceClient.connect()).isSucc, true);
    });

    afterAll(async () => {
        await Promise.allSettled([
            aliceClient.disconnect()
        ]);
        await gameServer.stop();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('logs into the admin page and manages room, player, and storage state', async () => {
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

        const dismissRoom = await fetch(`${adminBaseUrl}/admin/api/rooms/${encodeURIComponent(roomId)}/delete`, {
            method: 'POST',
            headers: {
                Cookie: sessionCookie
            }
        });
        assert.strictEqual(dismissRoom.status, 200);

        const roomListAfterDelete = await aliceClient.callApi('Room/List', {});
        assert.ok(roomListAfterDelete.isSucc);
        if (!roomListAfterDelete.isSucc) {
            return;
        }

        assert.strictEqual(roomListAfterDelete.res.rooms.length, 0);
    });
});
