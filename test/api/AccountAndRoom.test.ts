import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../../src';
import { serviceProto } from '../../src/shared/protocols/serviceProto';

describe.sequential('AccountAndRoom', () => {
    const testPort = 35791;
    const dataDir = path.resolve(process.cwd(), '.data-test');
    const serverUrl = `ws://127.0.0.1:${testPort}`;
    let gameServer: Awaited<ReturnType<typeof createGameServer>>;

    const aliceClient = new WsClient(serviceProto, {
        server: serverUrl,
        json: true
    });

    const bobClient = new WsClient(serviceProto, {
        server: serverUrl,
        json: true
    });

    let aliceToken = '';
    let bobToken = '';
    let roomId = '';

    beforeAll(async () => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        gameServer = await createGameServer({
            port: testPort,
            dataDir
        });
        await gameServer.start();

        const aliceConnected = await aliceClient.connect();
        assert.strictEqual(aliceConnected.isSucc, true);

        const bobConnected = await bobClient.connect();
        assert.strictEqual(bobConnected.isSucc, true);
    });

    afterAll(async () => {
        await aliceClient.disconnect();
        await bobClient.disconnect();
        await gameServer.stop();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('registers accounts and returns sessions', async () => {
        const aliceRegister = await aliceClient.callApi('Account/Register', {
            username: 'alice',
            password: 'password123',
            displayName: 'Alice'
        });
        assert.ok(aliceRegister.isSucc);
        if (!aliceRegister.isSucc) {
            return;
        }

        aliceToken = aliceRegister.res.session.token;
        assert.strictEqual(aliceRegister.res.session.user.username, 'alice');

        const bobRegister = await bobClient.callApi('Account/Register', {
            username: 'bob',
            password: 'password123',
            displayName: 'Bob'
        });
        assert.ok(bobRegister.isSucc);
        if (!bobRegister.isSucc) {
            return;
        }

        bobToken = bobRegister.res.session.token;
        assert.strictEqual(bobRegister.res.session.user.displayName, 'Bob');
    });

    it('rejects duplicate usernames', async () => {
        const duplicateRegister = await aliceClient.callApi('Account/Register', {
            username: 'alice',
            password: 'password123'
        });
        assert.strictEqual(duplicateRegister.isSucc, false);
    });

    it('supports login and profile lookup', async () => {
        const login = await aliceClient.callApi('Account/Login', {
            username: 'alice',
            password: 'password123'
        });
        assert.ok(login.isSucc);
        if (!login.isSucc) {
            return;
        }

        aliceToken = login.res.session.token;

        const profile = await aliceClient.callApi('Account/Profile', {
            token: aliceToken
        });
        assert.ok(profile.isSucc);
        if (!profile.isSucc) {
            return;
        }

        assert.strictEqual(profile.res.user.displayName, 'Alice');
    });

    it('creates a room and lets another user join', async () => {
        const createRoom = await aliceClient.callApi('Room/Create', {
            token: aliceToken,
            name: 'First Room',
            maxPlayers: 4
        });
        assert.ok(createRoom.isSucc);
        if (!createRoom.isSucc) {
            return;
        }

        roomId = createRoom.res.room.roomId;
        assert.strictEqual(createRoom.res.room.playerCount, 1);

        const joinRoom = await bobClient.callApi('Room/Join', {
            token: bobToken,
            roomId
        });
        assert.ok(joinRoom.isSucc);
        if (!joinRoom.isSucc) {
            return;
        }

        assert.strictEqual(joinRoom.res.room.playerCount, 2);
    });

    it('lists and queries room state', async () => {
        const listRooms = await aliceClient.callApi('Room/List', {});
        assert.ok(listRooms.isSucc);
        if (!listRooms.isSucc) {
            return;
        }

        assert.strictEqual(listRooms.res.rooms.length, 1);
        assert.strictEqual(listRooms.res.rooms[0].roomId, roomId);

        const getRoom = await aliceClient.callApi('Room/Get', { roomId });
        assert.ok(getRoom.isSucc);
        if (!getRoom.isSucc) {
            return;
        }

        assert.strictEqual(getRoom.res.room.players.length, 2);

        const myRoom = await bobClient.callApi('Room/My', {
            token: bobToken
        });
        assert.ok(myRoom.isSucc);
        if (!myRoom.isSucc) {
            return;
        }

        assert.strictEqual(myRoom.res.room?.roomId, roomId);
    });

    it('supports leave and room cleanup', async () => {
        const bobLeave = await bobClient.callApi('Room/Leave', {
            token: bobToken
        });
        assert.ok(bobLeave.isSucc);
        if (!bobLeave.isSucc) {
            return;
        }

        assert.strictEqual(bobLeave.res.room?.playerCount, 1);

        const aliceLeave = await aliceClient.callApi('Room/Leave', {
            token: aliceToken,
            roomId
        });
        assert.ok(aliceLeave.isSucc);
        if (!aliceLeave.isSucc) {
            return;
        }

        assert.strictEqual(aliceLeave.res.room, null);
        assert.strictEqual(aliceLeave.res.removedRoomId, roomId);
    });
});
