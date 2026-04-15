import * as assert from 'assert';
import { afterAll, describe, it } from 'vitest';
import { WsServer } from 'tsrpc';
import { serviceProto } from '../../src/shared/protocols/serviceProto';
import { AppContext, createAppContext } from '../../src/server/context';
import { StorageEntity } from '../../src/server/models';

describe('StorageService', () => {
    const disposableContexts: AppContext[] = [];

    afterAll(async () => {
        for (const appContext of disposableContexts) {
            appContext.rooms.dispose();
            appContext.connections.clear();
        }
    });

    it('serializes concurrent saves without losing keys', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const appContext = await createAppContext(server, {
            inMemoryDb: true,
            sessionTtlMs: 2000
        });
        disposableContexts.push(appContext);
        const session = await appContext.accounts.register({
            username: 'storage_parallel_user',
            password: 'password123',
            displayName: 'Storage Parallel User'
        });

        const [firstSave, secondSave] = await Promise.all([
            appContext.storage.save(session.token, {
                alpha: '1'
            }),
            appContext.storage.save(session.token, {
                beta: '2'
            })
        ]);

        assert.deepStrictEqual(new Set(firstSave), new Set(['alpha']));
        assert.deepStrictEqual(new Set(secondSave), new Set(['beta']));

        const persisted = await appContext.database.storages.findOne({
            userId: session.user.userId
        }) as StorageEntity | null;

        assert.ok(persisted);
        if (!persisted) {
            return;
        }

        assert.strictEqual(persisted.data.alpha, '1');
        assert.strictEqual(persisted.data.beta, '2');
    });

    it('reuses cached storage records for hot save and get paths', async () => {
        const server = new WsServer(serviceProto, {
            port: 0,
            json: true
        });
        const appContext = await createAppContext(server, {
            inMemoryDb: true,
            sessionTtlMs: 2000
        });
        disposableContexts.push(appContext);
        const session = await appContext.accounts.register({
            username: 'storage_cache_user',
            password: 'password123',
            displayName: 'Storage Cache User'
        });

        let storageFindOneCount = 0;
        const originalFindOne = appContext.database.storages.findOne.bind(appContext.database.storages);
        appContext.database.storages.findOne = async query => {
            storageFindOneCount += 1;
            return originalFindOne(query);
        };

        const firstSave = await appContext.storage.save(session.token, {
            alpha: '1'
        });
        const secondSave = await appContext.storage.save(session.token, {
            beta: '2'
        });
        const alphaValue = await appContext.storage.get(session.token, 'alpha');

        assert.deepStrictEqual(firstSave, ['alpha']);
        assert.deepStrictEqual(secondSave, ['beta']);
        assert.strictEqual(alphaValue, '1');
        assert.strictEqual(storageFindOneCount, 1);
    });
});
