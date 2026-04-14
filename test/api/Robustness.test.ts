import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../../src';
import { serviceProto } from '../../src/shared/protocols/serviceProto';

describe.sequential('ServerIsolation', () => {
    const portA = 35792;
    const portB = 35793;
    const dataDirA = path.resolve(process.cwd(), '.data-isolation-a');
    const dataDirB = path.resolve(process.cwd(), '.data-isolation-b');
    const serverUrlA = `ws://127.0.0.1:${portA}`;
    const serverUrlB = `ws://127.0.0.1:${portB}`;

    let serverA: Awaited<ReturnType<typeof createGameServer>>;
    let serverB: Awaited<ReturnType<typeof createGameServer>>;
    let tokenA = '';

    const clientA = new WsClient(serviceProto, {
        server: serverUrlA,
        json: true
    });
    const clientB = new WsClient(serviceProto, {
        server: serverUrlB,
        json: true
    });

    beforeAll(async () => {
        fs.rmSync(dataDirA, { recursive: true, force: true });
        fs.rmSync(dataDirB, { recursive: true, force: true });

        serverA = await createGameServer({
            port: portA,
            dataDir: dataDirA
        });
        serverB = await createGameServer({
            port: portB,
            dataDir: dataDirB
        });

        await serverA.start();
        await serverB.start();

        assert.strictEqual((await clientA.connect()).isSucc, true);
        assert.strictEqual((await clientB.connect()).isSucc, true);
    });

    afterAll(async () => {
        await Promise.allSettled([
            clientA.disconnect(),
            clientB.disconnect()
        ]);

        await Promise.allSettled([
            serverA?.stop(),
            serverB?.stop()
        ]);

        fs.rmSync(dataDirA, { recursive: true, force: true });
        fs.rmSync(dataDirB, { recursive: true, force: true });
    });

    it('keeps contexts isolated across multiple server instances', async () => {
        const registerA = await clientA.callApi('Account/Register', {
            username: 'isolation_alice',
            password: 'password123',
            displayName: 'Isolation Alice'
        });
        assert.ok(registerA.isSucc);
        if (!registerA.isSucc) {
            return;
        }

        tokenA = registerA.res.session.token;

        const registerB = await clientB.callApi('Account/Register', {
            username: 'isolation_bob',
            password: 'password123',
            displayName: 'Isolation Bob'
        });
        assert.ok(registerB.isSucc);
        if (!registerB.isSucc) {
            return;
        }

        const createRoomA = await clientA.callApi('Room/Create', {
            token: tokenA,
            name: 'Isolated Room',
            maxPlayers: 2
        });
        assert.ok(createRoomA.isSucc);
        if (!createRoomA.isSucc) {
            return;
        }

        const listRoomsB = await clientB.callApi('Room/List', {});
        assert.ok(listRoomsB.isSucc);
        if (!listRoomsB.isSucc) {
            return;
        }

        assert.strictEqual(listRoomsB.res.rooms.length, 0);

        await serverB.stop();

        const profileA = await clientA.callApi('Account/Profile', {
            token: tokenA
        });
        assert.ok(profileA.isSucc);
        if (!profileA.isSucc) {
            return;
        }

        assert.strictEqual(profileA.res.user.username, 'isolation_alice');
    });
});

describe.sequential('SessionPersistence', () => {
    const port = 35794;
    const sessionTtlMs = 800;
    const dataDir = path.resolve(process.cwd(), '.data-session-persistence');
    const serverUrl = `ws://127.0.0.1:${port}`;

    let server: Awaited<ReturnType<typeof createGameServer>> | undefined;

    async function startServer() {
        server = await createGameServer({
            port,
            dataDir,
            sessionTtlMs
        });
        await server.start();
    }

    async function stopServer() {
        if (!server) {
            return;
        }

        await server.stop();
        server = undefined;
    }

    beforeAll(async () => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('persists sessions across restart and expires them after ttl', async () => {
        const clientBeforeRestart = new WsClient(serviceProto, {
            server: serverUrl,
            json: true
        });
        assert.strictEqual((await clientBeforeRestart.connect()).isSucc, true);

        const register = await clientBeforeRestart.callApi('Account/Register', {
            username: 'restart_alice',
            password: 'password123',
            displayName: 'Restart Alice'
        });
        assert.ok(register.isSucc);
        if (!register.isSucc) {
            return;
        }

        const token = register.res.session.token;
        await clientBeforeRestart.disconnect();

        await stopServer();
        await startServer();

        const clientAfterRestart = new WsClient(serviceProto, {
            server: serverUrl,
            json: true
        });
        assert.strictEqual((await clientAfterRestart.connect()).isSucc, true);

        const profileAfterRestart = await clientAfterRestart.callApi('Account/Profile', {
            token
        });
        assert.ok(profileAfterRestart.isSucc);
        if (!profileAfterRestart.isSucc) {
            return;
        }

        assert.strictEqual(profileAfterRestart.res.user.username, 'restart_alice');
        await clientAfterRestart.disconnect();

        await stopServer();
        await sleep(sessionTtlMs + 250);
        await startServer();

        const clientAfterExpiry = new WsClient(serviceProto, {
            server: serverUrl,
            json: true
        });
        assert.strictEqual((await clientAfterExpiry.connect()).isSucc, true);

        const expiredProfile = await clientAfterExpiry.callApi('Account/Profile', {
            token
        });
        assert.ok(!expiredProfile.isSucc);
        if (expiredProfile.isSucc) {
            return;
        }

        assert.match(expiredProfile.err.message, /expired or invalid/i);
        await clientAfterExpiry.disconnect();
    });
});

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
