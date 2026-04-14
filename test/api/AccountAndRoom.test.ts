import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../../src';
import { RoomEvent, RoomSyncMessage } from '../../src/shared/models/GameModels';
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
    const carolClient = new WsClient(serviceProto, {
        server: serverUrl,
        json: true
    });

    const aliceEvents: RoomEvent[] = [];
    const bobEvents: RoomEvent[] = [];
    const carolEvents: RoomEvent[] = [];
    const aliceSyncs: RoomSyncMessage[] = [];
    const bobSyncs: RoomSyncMessage[] = [];
    const carolSyncs: RoomSyncMessage[] = [];

    let aliceToken = '';
    let bobToken = '';
    let carolToken = '';
    let aliceUserId = '';
    let bobUserId = '';
    let carolUserId = '';
    let roomId = '';

    beforeAll(async () => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        gameServer = await createGameServer({
            port: testPort,
            dataDir
        });
        await gameServer.start();

        aliceClient.listenMsg('Room/Event', msg => {
            aliceEvents.push(msg);
        });
        bobClient.listenMsg('Room/Event', msg => {
            bobEvents.push(msg);
        });
        carolClient.listenMsg('Room/Event', msg => {
            carolEvents.push(msg);
        });

        aliceClient.listenMsg('Room/Sync', msg => {
            aliceSyncs.push(msg);
        });
        bobClient.listenMsg('Room/Sync', msg => {
            bobSyncs.push(msg);
        });
        carolClient.listenMsg('Room/Sync', msg => {
            carolSyncs.push(msg);
        });

        assert.strictEqual((await aliceClient.connect()).isSucc, true);
        assert.strictEqual((await bobClient.connect()).isSucc, true);
        assert.strictEqual((await carolClient.connect()).isSucc, true);
    });

    beforeEach(() => {
        aliceEvents.length = 0;
        bobEvents.length = 0;
        carolEvents.length = 0;
        aliceSyncs.length = 0;
        bobSyncs.length = 0;
        carolSyncs.length = 0;
    });

    afterAll(async () => {
        await Promise.allSettled([
            aliceClient.disconnect(),
            bobClient.disconnect(),
            carolClient.disconnect()
        ]);
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
        aliceUserId = aliceRegister.res.session.user.userId;

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
        bobUserId = bobRegister.res.session.user.userId;

        const carolRegister = await carolClient.callApi('Account/Register', {
            username: 'carol',
            password: 'password123',
            displayName: 'Carol'
        });
        assert.ok(carolRegister.isSucc);
        if (!carolRegister.isSucc) {
            return;
        }

        carolToken = carolRegister.res.session.token;
        carolUserId = carolRegister.res.session.user.userId;
        assert.notStrictEqual(carolToken, '');
        assert.notStrictEqual(carolUserId, '');
    });

    it('stores user data in isolated per-account storage', async () => {
        const saveAlice = await aliceClient.callApi('Storage/Save', {
            token: aliceToken,
            save: {
                key1: 'value1',
                key2: 'value2'
            }
        });
        assert.ok(saveAlice.isSucc);
        if (!saveAlice.isSucc) {
            return;
        }

        assert.deepStrictEqual(new Set(saveAlice.res.savedKeys), new Set(['key1', 'key2']));

        const getAliceKey1 = await aliceClient.callApi('Storage/Get', {
            token: aliceToken,
            key: 'key1'
        });
        assert.ok(getAliceKey1.isSucc);
        if (!getAliceKey1.isSucc) {
            return;
        }

        assert.strictEqual(getAliceKey1.res.value, 'value1');

        const getBobKey1 = await bobClient.callApi('Storage/Get', {
            token: bobToken,
            key: 'key1'
        });
        assert.ok(getBobKey1.isSucc);
        if (!getBobKey1.isSucc) {
            return;
        }

        assert.strictEqual(getBobKey1.res.value, null);

        const saveAliceAgain = await aliceClient.callApi('Storage/Save', {
            token: aliceToken,
            save: {
                key1: 'value1-updated',
                key3: 'value3'
            }
        });
        assert.ok(saveAliceAgain.isSucc);
        if (!saveAliceAgain.isSucc) {
            return;
        }

        const getAliceUpdated = await aliceClient.callApi('Storage/Get', {
            token: aliceToken,
            key: 'key1'
        });
        assert.ok(getAliceUpdated.isSucc);
        if (!getAliceUpdated.isSucc) {
            return;
        }

        assert.strictEqual(getAliceUpdated.res.value, 'value1-updated');

        const getAliceKey2 = await aliceClient.callApi('Storage/Get', {
            token: aliceToken,
            key: 'key2'
        });
        assert.ok(getAliceKey2.isSucc);
        if (!getAliceKey2.isSucc) {
            return;
        }

        assert.strictEqual(getAliceKey2.res.value, 'value2');
    });

    it('creates temporary rooms and emits join related events', async () => {
        const listBeforeCreate = await carolClient.callApi('Room/List', {});
        assert.ok(listBeforeCreate.isSucc);
        if (!listBeforeCreate.isSucc) {
            return;
        }

        assert.strictEqual(listBeforeCreate.res.rooms.length, 0);

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
        assert.strictEqual(createRoom.res.room.state, 'open');
        assert.strictEqual(createRoom.res.room.players[0].isReady, false);

        const roomCreated = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'room_created' && event.roomId === roomId);
        });
        assert.strictEqual(roomCreated.actorUserId, aliceUserId);

        const joinRoom = await bobClient.callApi('Room/Join', {
            token: bobToken,
            roomId
        });
        assert.ok(joinRoom.isSucc);
        if (!joinRoom.isSucc) {
            return;
        }

        assert.strictEqual(joinRoom.res.room.playerCount, 2);
        assert.strictEqual(joinRoom.res.room.players.find(player => player.userId === bobUserId)?.isReady, false);

        const aliceJoinEvent = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_joined' && event.actorUserId === bobUserId);
        });
        const bobJoinEvent = await waitFor(() => {
            return bobEvents.find(event => event.type === 'player_joined' && event.actorUserId === bobUserId);
        });
        const aliceCountEvent = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_count_changed' && event.actorUserId === bobUserId);
        });

        assert.strictEqual(aliceJoinEvent.room.playerCount, 2);
        assert.strictEqual(bobJoinEvent.room.playerCount, 2);
        assert.strictEqual(aliceCountEvent.room.playerCount, 2);
        assert.strictEqual(carolEvents.length, 0);
    });

    it('tracks ready state, emits countdown notifications and starts the game', async () => {
        const aliceReady = await aliceClient.callApi('Room/SetReady', {
            token: aliceToken,
            isReady: true
        });
        assert.ok(aliceReady.isSucc);
        if (!aliceReady.isSucc) {
            return;
        }

        assert.strictEqual(aliceReady.res.room.players.find(player => player.userId === aliceUserId)?.isReady, true);

        const aliceReadyEvent = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_ready_changed' && event.actorUserId === aliceUserId);
        });
        assert.strictEqual(aliceReadyEvent.room.players.find(player => player.userId === aliceUserId)?.isReady, true);

        const bobReady = await bobClient.callApi('Room/SetReady', {
            token: bobToken,
            isReady: true
        });
        assert.ok(bobReady.isSucc);
        if (!bobReady.isSucc) {
            return;
        }

        const countdownStarted = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'countdown_started');
        });
        assert.strictEqual(countdownStarted.countdownSeconds, 3);

        const bobCancelReady = await bobClient.callApi('Room/SetReady', {
            token: bobToken,
            isReady: false
        });
        assert.ok(bobCancelReady.isSucc);
        if (!bobCancelReady.isSucc) {
            return;
        }

        const countdownCanceled = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'countdown_canceled');
        });
        assert.strictEqual(countdownCanceled.room.state, 'open');

        aliceEvents.length = 0;
        bobEvents.length = 0;

        const bobReadyAgain = await bobClient.callApi('Room/SetReady', {
            token: bobToken,
            isReady: true
        });
        assert.ok(bobReadyAgain.isSucc);
        if (!bobReadyAgain.isSucc) {
            return;
        }

        const secondCountdownStarted = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'countdown_started');
        });
        assert.strictEqual(secondCountdownStarted.room.state, 'countdown');

        const countdownTick = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'countdown_tick');
        }, 4000);
        assert.ok((countdownTick.countdownSeconds ?? 0) <= 2);

        const gameStarted = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'game_started');
        }, 5000);
        assert.strictEqual(gameStarted.room.state, 'playing');

        const myRoom = await aliceClient.callApi('Room/My', {
            token: aliceToken
        });
        assert.ok(myRoom.isSucc);
        if (!myRoom.isSucc) {
            return;
        }

        assert.strictEqual(myRoom.res.room?.state, 'playing');
        assert.notStrictEqual(myRoom.res.room?.startedAt, null);
    });

    it('syncs messages to the whole room or a single player', async () => {
        const broadcast = await aliceClient.callApi('Room/Sync', {
            token: aliceToken,
            kind: 'state',
            payload: '{"hp":100}'
        });
        assert.ok(broadcast.isSucc);
        if (!broadcast.isSucc) {
            return;
        }

        assert.deepStrictEqual(new Set(broadcast.res.deliveredUserIds), new Set([aliceUserId, bobUserId]));

        const aliceBroadcast = await waitFor(() => {
            return aliceSyncs.find(message => message.kind === 'state');
        });
        const bobBroadcast = await waitFor(() => {
            return bobSyncs.find(message => message.kind === 'state');
        });

        assert.strictEqual(aliceBroadcast.toUserId, null);
        assert.strictEqual(bobBroadcast.toUserId, null);
        assert.strictEqual(carolSyncs.length, 0);

        aliceSyncs.length = 0;
        bobSyncs.length = 0;

        const direct = await aliceClient.callApi('Room/Sync', {
            token: aliceToken,
            kind: 'private',
            payload: '{"target":"bob"}',
            targetUserId: bobUserId
        });
        assert.ok(direct.isSucc);
        if (!direct.isSucc) {
            return;
        }

        assert.deepStrictEqual(direct.res.deliveredUserIds, [bobUserId]);

        const bobDirect = await waitFor(() => {
            return bobSyncs.find(message => message.kind === 'private');
        });
        assert.strictEqual(bobDirect.toUserId, bobUserId);
        assert.strictEqual(aliceSyncs.length, 0);
        assert.strictEqual(carolSyncs.length, 0);
    });

    it('removes disconnected players and deletes empty temporary rooms', async () => {
        await bobClient.disconnect();

        const playerLeft = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_left' && event.actorUserId === bobUserId);
        }, 4000);
        const playerCountChanged = await waitFor(() => {
            return aliceEvents.find(event => event.type === 'player_count_changed' && event.actorUserId === bobUserId);
        }, 4000);

        assert.strictEqual(playerLeft.room.playerCount, 1);
        assert.strictEqual(playerCountChanged.room.playerCount, 1);

        await aliceClient.disconnect();
        await sleep(100);

        const listRooms = await carolClient.callApi('Room/List', {});
        assert.ok(listRooms.isSucc);
        if (!listRooms.isSucc) {
            return;
        }

        assert.strictEqual(listRooms.res.rooms.length, 0);
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
