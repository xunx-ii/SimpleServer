import { randomUUID } from 'crypto';
import * as net from 'net';
import { performance } from 'perf_hooks';
import { WsClient } from 'tsrpc';
import { createGameServer } from '../src';
import { serviceProto, type ServiceType } from '../src/shared/protocols/serviceProto';

type Scenario = 'profile' | 'storage-save' | 'room-sync' | 'mixed';

type CliOptions = {
    scenario: Scenario
    clients: number
    durationMs: number
    warmupMs: number
    startServer: boolean
    port: number
    portSpecified: boolean
    host: string
    inMemoryDb: boolean
    dataDir?: string
    roomSize: number
}

type LoadTestUser = {
    index: number
    client: WsClient<ServiceType>
    token: string
    userId: string
    roomId?: string
}

type WorkerStats = {
    successCount: number
    errorCount: number
    latenciesMs: number[]
    operationCounts: Record<string, number>
    sampleErrors: string[]
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.startServer && !options.portSpecified) {
        options.port = await getAvailablePort(options.host);
    }
    else if (!options.startServer && !options.portSpecified) {
        options.port = 23414;
    }

    const wsUrl = `ws://${options.host}:${options.port}`;
    const startedAt = new Date();

    console.log('Load test config');
    console.log(`  scenario     : ${options.scenario}`);
    console.log(`  clients      : ${options.clients}`);
    console.log(`  duration     : ${formatDuration(options.durationMs)}`);
    console.log(`  warmup       : ${formatDuration(options.warmupMs)}`);
    console.log(`  target       : ${wsUrl}`);
    console.log(`  startServer  : ${options.startServer ? 'yes' : 'no'}`);
    console.log(`  roomSize     : ${options.roomSize}`);
    console.log(`  inMemoryDb   : ${options.inMemoryDb ? 'yes' : 'no'}`);
    if (options.dataDir) {
        console.log(`  dataDir      : ${options.dataDir}`);
    }

    let server: Awaited<ReturnType<typeof createGameServer>> | undefined;
    const users: LoadTestUser[] = [];

    try {
        if (options.startServer) {
            server = await createGameServer({
                port: options.port,
                dataDir: options.dataDir,
                inMemoryDb: options.inMemoryDb,
                logging: {
                    logLevel: 'warn',
                    logReqBody: false,
                    logResBody: false,
                    logMsg: false,
                    logConnect: false
                },
                admin: {
                    enabled: false
                }
            });
            await server.start();
        }

        await setupUsers(users, wsUrl, options);
        if (options.scenario === 'room-sync' || options.scenario === 'mixed') {
            await setupRooms(users, options.roomSize);
        }

        console.log(`Setup finished in ${formatDuration(Date.now() - startedAt.getTime())}`);
        console.log('Running benchmark...');

        const stats = await runLoadTest(users, options);
        printStats(stats, options);

        if (!stats.successCount) {
            process.exitCode = 1;
        }
    }
    finally {
        await Promise.allSettled(users.map(user => user.client.disconnect()));
        if (server) {
            await server.stop();
        }
    }
}

async function setupUsers(users: LoadTestUser[], wsUrl: string, options: CliOptions) {
    const runId = Date.now().toString(36);

    for (let i = 0; i < options.clients; ++i) {
        const client = new WsClient(serviceProto, {
            server: wsUrl,
            json: true
        });

        const connected = await client.connect();
        if (!connected.isSucc) {
            throw new Error(`Client #${i} failed to connect: ${connected.errMsg}`);
        }

        const username = `lt_${runId}_${i}`;
        const registered = await client.callApi('Account/Register', {
            username,
            password: 'password123',
            displayName: `LT-${i}`
        });
        if (!registered.isSucc) {
            throw new Error(`Client #${i} failed to register: ${registered.err.message}`);
        }

        users.push({
            index: i,
            client,
            token: registered.res.session.token,
            userId: registered.res.session.user.userId
        });
    }
}

async function setupRooms(users: LoadTestUser[], roomSize: number) {
    for (let i = 0; i < users.length; i += roomSize) {
        const members = users.slice(i, i + roomSize);
        if (!members.length) {
            continue;
        }

        const owner = members[0];
        const created = await owner.client.callApi('Room/Create', {
            token: owner.token,
            name: `LT-Room-${i / roomSize}`,
            maxPlayers: Math.max(2, members.length)
        });
        if (!created.isSucc) {
            throw new Error(`Failed to create room for worker ${owner.index}: ${created.err.message}`);
        }

        const roomId = created.res.room.roomId;
        owner.roomId = roomId;

        for (const member of members.slice(1)) {
            const joined = await member.client.callApi('Room/Join', {
                token: member.token,
                roomId
            });
            if (!joined.isSucc) {
                throw new Error(`Failed to join room for worker ${member.index}: ${joined.err.message}`);
            }

            member.roomId = roomId;
        }
    }
}

async function runLoadTest(users: LoadTestUser[], options: CliOptions) {
    const warmupEndsAt = performance.now() + options.warmupMs;
    const benchmarkEndsAt = warmupEndsAt + options.durationMs;

    const workerStats = await Promise.all(users.map(user => runWorker(user, options, warmupEndsAt, benchmarkEndsAt)));
    return mergeStats(workerStats);
}

async function runWorker(
    user: LoadTestUser,
    options: CliOptions,
    warmupEndsAt: number,
    benchmarkEndsAt: number
): Promise<WorkerStats> {
    const stats: WorkerStats = {
        successCount: 0,
        errorCount: 0,
        latenciesMs: [],
        operationCounts: {},
        sampleErrors: []
    };

    let sequence = 0;
    while (performance.now() < benchmarkEndsAt) {
        const startedAt = performance.now();
        let operation = options.scenario;

        try {
            operation = await performOperation(user, options, sequence++);
            const endedAt = performance.now();
            if (startedAt >= warmupEndsAt) {
                stats.successCount += 1;
                stats.latenciesMs.push(endedAt - startedAt);
                stats.operationCounts[operation] = (stats.operationCounts[operation] ?? 0) + 1;
            }
        }
        catch (error) {
            if (startedAt >= warmupEndsAt) {
                stats.errorCount += 1;
                if (stats.sampleErrors.length < 5) {
                    stats.sampleErrors.push(error instanceof Error ? error.message : String(error));
                }
            }
        }
    }

    return stats;
}

async function performOperation(user: LoadTestUser, options: CliOptions, sequence: number): Promise<Scenario> {
    const operation = resolveScenario(options.scenario);

    if (operation === 'profile') {
        const result = await user.client.callApi('Account/Profile', {
            token: user.token
        });
        ensureApiSuccess(result, 'Account/Profile');
        return operation;
    }

    if (operation === 'storage-save') {
        const key = `hot_${sequence % 16}`;
        const result = await user.client.callApi('Storage/Save', {
            token: user.token,
            save: {
                [key]: `${user.index}:${sequence}`
            }
        });
        ensureApiSuccess(result, 'Storage/Save');
        return operation;
    }

    if (!user.roomId) {
        throw new Error(`Worker ${user.index} has no room for sync benchmark`);
    }

    const result = await user.client.callApi('Room/Sync', {
        token: user.token,
        kind: 'loadtest',
        payload: JSON.stringify({
            id: randomUUID(),
            seq: sequence,
            sender: user.index
        })
    });
    ensureApiSuccess(result, 'Room/Sync');
    return operation;
}

function resolveScenario(scenario: Scenario): Scenario {
    if (scenario !== 'mixed') {
        return scenario;
    }

    const roll = Math.random();
    if (roll < 0.5) {
        return 'profile';
    }
    if (roll < 0.8) {
        return 'storage-save';
    }
    return 'room-sync';
}

function ensureApiSuccess(
    result:
        | { isSucc: true }
        | { isSucc: false, err: { message: string } },
    apiName: string
) {
    if (!result.isSucc) {
        throw new Error(`${apiName} failed: ${result.err.message}`);
    }
}

function mergeStats(workerStats: WorkerStats[]): WorkerStats {
    const merged: WorkerStats = {
        successCount: 0,
        errorCount: 0,
        latenciesMs: [],
        operationCounts: {},
        sampleErrors: []
    };

    for (const stats of workerStats) {
        merged.successCount += stats.successCount;
        merged.errorCount += stats.errorCount;
        merged.latenciesMs.push(...stats.latenciesMs);

        for (const [operation, count] of Object.entries(stats.operationCounts)) {
            merged.operationCounts[operation] = (merged.operationCounts[operation] ?? 0) + count;
        }

        for (const error of stats.sampleErrors) {
            if (merged.sampleErrors.length >= 10) {
                break;
            }
            merged.sampleErrors.push(error);
        }
    }

    return merged;
}

function printStats(stats: WorkerStats, options: CliOptions) {
    const total = stats.successCount + stats.errorCount;
    const durationSeconds = options.durationMs / 1000;
    const sortedLatencies = [...stats.latenciesMs].sort((a, b) => a - b);
    const averageLatency = sortedLatencies.length
        ? sortedLatencies.reduce((sum, latency) => sum + latency, 0) / sortedLatencies.length
        : 0;

    console.log('');
    console.log('Results');
    console.log(`  totalOps      : ${total}`);
    console.log(`  successOps    : ${stats.successCount}`);
    console.log(`  errorOps      : ${stats.errorCount}`);
    console.log(`  throughput    : ${formatNumber(stats.successCount / durationSeconds)} ops/s`);
    console.log(`  avgLatency    : ${formatNumber(averageLatency)} ms`);
    console.log(`  p50           : ${formatNumber(percentile(sortedLatencies, 50))} ms`);
    console.log(`  p95           : ${formatNumber(percentile(sortedLatencies, 95))} ms`);
    console.log(`  p99           : ${formatNumber(percentile(sortedLatencies, 99))} ms`);

    console.log('  operations    :');
    for (const [operation, count] of Object.entries(stats.operationCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${operation.padEnd(12, ' ')} ${count}`);
    }

    if (stats.sampleErrors.length) {
        console.log('  sampleErrors  :');
        for (const error of stats.sampleErrors) {
            console.log(`    ${error}`);
        }
    }
}

function percentile(values: number[], p: number) {
    if (!values.length) {
        return 0;
    }

    const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * (p / 100)) - 1));
    return values[index];
}

function formatNumber(value: number) {
    return value.toFixed(2);
}

function formatDuration(durationMs: number) {
    return `${Math.round(durationMs / 1000)}s`;
}

function parseArgs(argv: string[]): CliOptions {
    const args = new Map<string, string | boolean>();

    for (let i = 0; i < argv.length; ++i) {
        const current = argv[i];
        if (!current.startsWith('--')) {
            continue;
        }

        const normalized = current.slice(2);
        if (normalized.startsWith('no-')) {
            args.set(normalized.slice(3), false);
            continue;
        }

        const equalsIndex = normalized.indexOf('=');
        if (equalsIndex >= 0) {
            args.set(normalized.slice(0, equalsIndex), normalized.slice(equalsIndex + 1));
            continue;
        }

        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            args.set(normalized, true);
            continue;
        }

        args.set(normalized, next);
        i += 1;
    }

    const scenario = getScenarioArg(args.get('scenario'));
    const clients = parseNumberArg(args.get('clients'), 32, 'clients');
    const durationMs = parseNumberArg(args.get('duration'), 15, 'duration') * 1000;
    const warmupMs = parseNumberArg(args.get('warmup'), 3, 'warmup') * 1000;
    const port = parseNumberArg(args.get('port'), 39001, 'port');
    const portSpecified = args.has('port');
    const roomSize = Math.max(1, parseNumberArg(args.get('room-size'), 4, 'room-size'));
    const host = String(args.get('host') ?? '127.0.0.1');
    const startServer = parseBooleanArg(args.get('start-server'), true);
    const inMemoryDb = parseBooleanArg(args.get('in-memory-db'), true);
    const dataDirArg = args.get('data-dir');
    const dataDir = typeof dataDirArg === 'string'
        ? dataDirArg
        : (!inMemoryDb && startServer ? '.data-loadtest' : undefined);

    if (clients < 1) {
        throw new Error('clients must be at least 1');
    }

    return {
        scenario,
        clients,
        durationMs,
        warmupMs,
        startServer,
        port,
        portSpecified,
        host,
        inMemoryDb,
        dataDir,
        roomSize
    };
}

function getScenarioArg(input: string | boolean | undefined): Scenario {
    if (!input) {
        return 'mixed';
    }

    if (input === 'profile' || input === 'storage-save' || input === 'room-sync' || input === 'mixed') {
        return input;
    }

    throw new Error(`Unsupported scenario: ${input}`);
}

function parseNumberArg(input: string | boolean | undefined, defaultValue: number, fieldName: string) {
    if (input === undefined || input === true || input === false) {
        return defaultValue;
    }

    const parsed = Number(input);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} must be a number`);
    }

    return parsed;
}

function parseBooleanArg(input: string | boolean | undefined, defaultValue: boolean) {
    if (input === undefined) {
        return defaultValue;
    }

    if (typeof input === 'boolean') {
        return input;
    }

    if (input === 'true') {
        return true;
    }

    if (input === 'false') {
        return false;
    }

    throw new Error(`Boolean argument must be true or false, got: ${input}`);
}

async function getAvailablePort(host: string) {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();

        server.once('error', reject);
        server.listen(0, host, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Failed to allocate local port'));
                return;
            }

            const { port } = address;
            server.close(err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(port);
            });
        });
    });
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
