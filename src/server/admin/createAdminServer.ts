import * as http from 'http';
import { randomUUID } from 'crypto';
import { AppContext } from '../context';
import { AdminServerConfig } from '../config';
import { renderAdminPage } from './adminPage';

const DEFAULT_ADMIN_HOST = '127.0.0.1';
const DEFAULT_ADMIN_PORT = 23514;
const DEFAULT_ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_SESSION_COOKIE = 'simple_server_admin_session';
const DEFAULT_ADMIN_PAGE_SIZE = 20;
const MAX_ADMIN_PAGE_SIZE = 200;

type AdminSession = {
    expiresAt: number
};

type DashboardListQuery = {
    search: string
    page: number
    pageSize: number
};

type DashboardPager = DashboardListQuery & {
    total: number
    filteredTotal: number
    totalPages: number
};

export interface AdminServerInstance {
    url: string
    start: () => Promise<void>
    stop: () => Promise<void>
}

export function createAdminServer(
    appContext: AppContext,
    options: AdminServerConfig = {},
    input: {
        wsPort: number
    }
): AdminServerInstance {
    const host = options.host ?? DEFAULT_ADMIN_HOST;
    const port = options.port ?? DEFAULT_ADMIN_PORT;
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_ADMIN_SESSION_TTL_MS;
    const username = options.username?.trim();
    const password = options.password?.trim();

    if (!username || !password) {
        throw new Error('Admin username and password are required');
    }

    const sessions = new Map<string, AdminSession>();
    const startedAt = new Date();

    const server = http.createServer((req, res) => {
        void handleRequest(req, res);
    });

    async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
            const pathname = normalizePath(url.pathname);

            if (pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

            if ((pathname === '/' || pathname === '/admin') && req.method === 'GET') {
                sendHtml(res, renderAdminPage());
                return;
            }

            if (!pathname.startsWith('/admin/api')) {
                sendJson(res, 404, { error: 'Not found' });
                return;
            }

            if (pathname === '/admin/api/login' && req.method === 'POST') {
                const body = await readJsonBody(req);
                if (body.username !== username || body.password !== password) {
                    sendJson(res, 401, { error: 'Invalid admin credentials' });
                    return;
                }

                const sessionId = randomUUID();
                sessions.set(sessionId, {
                    expiresAt: Date.now() + sessionTtlMs
                });

                sendJson(res, 200, { username }, [serializeCookie(sessionId, sessionTtlMs)]);
                return;
            }

            if (pathname === '/admin/api/logout' && req.method === 'POST') {
                const sessionId = getSessionId(req);
                if (sessionId) {
                    sessions.delete(sessionId);
                }

                sendJson(res, 200, { ok: true }, [clearCookie()]);
                return;
            }

            const authenticated = authenticate(req, sessions, sessionTtlMs);
            if (!authenticated) {
                sendJson(res, 401, { error: 'Unauthorized' });
                return;
            }

            if (pathname === '/admin/api/me' && req.method === 'GET') {
                sendJson(res, 200, { username });
                return;
            }

            if (pathname === '/admin/api/dashboard' && req.method === 'GET') {
                sendJson(res, 200, await buildDashboardPayload(appContext, {
                    wsPort: input.wsPort,
                    adminHost: host,
                    adminPort: port,
                    startedAt
                }, url.searchParams));
                return;
            }

            const roomDeleteMatch = pathname.match(/^\/admin\/api\/rooms\/([^/]+)\/delete$/);
            if (roomDeleteMatch && req.method === 'POST') {
                const roomId = decodeURIComponent(roomDeleteMatch[1]);
                sendJson(res, 200, await appContext.rooms.dismissRoom(roomId));
                return;
            }

            const roomKickMatch = pathname.match(/^\/admin\/api\/rooms\/([^/]+)\/kick$/);
            if (roomKickMatch && req.method === 'POST') {
                const roomId = decodeURIComponent(roomKickMatch[1]);
                const body = await readJsonBody(req);
                sendJson(res, 200, await appContext.rooms.kickUser(roomId, String(body.userId ?? '')));
                return;
            }

            const displayNameMatch = pathname.match(/^\/admin\/api\/accounts\/([^/]+)\/display-name$/);
            if (displayNameMatch && req.method === 'POST') {
                const userId = decodeURIComponent(displayNameMatch[1]);
                const body = await readJsonBody(req);
                sendJson(res, 200, {
                    user: await appContext.accounts.updateDisplayName(userId, String(body.displayName ?? ''))
                });
                return;
            }

            const storageSaveMatch = pathname.match(/^\/admin\/api\/storages\/([^/]+)\/save$/);
            if (storageSaveMatch && req.method === 'POST') {
                const userId = decodeURIComponent(storageSaveMatch[1]);
                const body = await readJsonBody(req);
                sendJson(res, 200, {
                    savedKeys: await appContext.storage.adminSave(userId, body.save ?? {}),
                    storage: await appContext.storage.getStorageByUserId(userId)
                });
                return;
            }

            const storageDeleteMatch = pathname.match(/^\/admin\/api\/storages\/([^/]+)\/delete-key$/);
            if (storageDeleteMatch && req.method === 'POST') {
                const userId = decodeURIComponent(storageDeleteMatch[1]);
                const body = await readJsonBody(req);
                sendJson(res, 200, {
                    deletedKeys: await appContext.storage.deleteKeys(userId, Array.isArray(body.keys) ? body.keys : []),
                    storage: await appContext.storage.getStorageByUserId(userId)
                });
                return;
            }

            sendJson(res, 404, { error: 'Not found' });
        }
        catch (error) {
            sendJson(res, resolveErrorStatus(error), {
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    return {
        url: `http://${host}:${port}/admin`,
        start: async () => {
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen(port, host, () => {
                    server.off('error', reject);
                    resolve();
                });
            });
        },
        stop: async () => {
            sessions.clear();
            await new Promise<void>((resolve, reject) => {
                server.close(err => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            });
        }
    };
}

async function buildDashboardPayload(
    appContext: AppContext,
    input: {
        wsPort: number
        adminHost: string
        adminPort: number
        startedAt: Date
    },
    searchParams: URLSearchParams
) {
    const [rooms, users, storages, sessionCounts] = await Promise.all([
        appContext.rooms.getAdminRooms(),
        appContext.accounts.listUsers(),
        appContext.storage.listStorages(),
        appContext.accounts.listActiveSessionCounts()
    ]);

    const roomMemberships = appContext.rooms.getRoomMemberships();
    const onlineUserIds = new Set(appContext.connections.getOnlineUserIds());
    const storageMap = new Map(storages.map(storage => [storage.userId, storage]));
    const userMap = new Map(users.map(user => [user.userId, user]));
    const roomQuery = parseDashboardListQuery(searchParams, 'room');
    const playerQuery = parseDashboardListQuery(searchParams, 'player');
    const storageQuery = parseDashboardListQuery(searchParams, 'storage');

    const players = users.map(user => {
        const storage = storageMap.get(user.userId);
        return {
            ...user,
            isOnline: onlineUserIds.has(user.userId),
            roomId: roomMemberships.get(user.userId) ?? null,
            sessionCount: sessionCounts.get(user.userId) ?? 0,
            storageKeyCount: storage ? Object.keys(storage.data).length : 0,
            storageUpdatedAt: storage?.updatedAt ?? null
        };
    });

    const storagesView = storages.map(storage => {
        const user = userMap.get(storage.userId);
        return {
            userId: storage.userId,
            username: user?.username ?? null,
            displayName: user?.displayName ?? null,
            createdAt: storage.createdAt,
            updatedAt: storage.updatedAt,
            version: storage.version ?? 0,
            keyCount: Object.keys(storage.data).length,
            data: storage.data
        };
    });

    const pagedRooms = paginateDashboardList(rooms, roomQuery, (room, search) => {
        return matchesSearch(search, [
            room.roomId,
            room.name,
            room.ownerUserId,
            room.state,
            room.state === 'open' ? '开放中' : room.state === 'countdown' ? '倒计时中' : room.state === 'playing' ? '游戏中' : room.state,
            room.playerCount,
            room.maxPlayers,
            ...room.players.flatMap(player => [
                player.userId,
                player.username,
                player.displayName,
                player.isOnline ? 'online' : 'offline',
                player.isOnline ? '在线' : '离线',
                player.isReady ? 'ready' : 'not ready',
                player.isReady ? '已准备' : '未准备'
            ])
        ]);
    });

    const pagedPlayers = paginateDashboardList(players, playerQuery, (player, search) => {
        return matchesSearch(search, [
            player.userId,
            player.username,
            player.displayName,
            player.roomId,
            player.isOnline ? 'online' : 'offline',
            player.isOnline ? '在线' : '离线',
            player.sessionCount,
            player.storageKeyCount
        ]);
    });

    const pagedStorages = paginateDashboardList(storagesView, storageQuery, (storage, search) => {
        return matchesSearch(search, [
            storage.userId,
            storage.username,
            storage.displayName,
            storage.version,
            storage.keyCount,
            ...Object.keys(storage.data),
            ...Object.values(storage.data)
        ]);
    });

    let sessionCount = 0;
    for (const value of sessionCounts.values()) {
        sessionCount += value;
    }

    return {
        server: {
            wsPort: input.wsPort,
            adminHost: input.adminHost,
            adminPort: input.adminPort,
            startedAt: input.startedAt,
            uptimeMs: Date.now() - input.startedAt.getTime(),
            openConnections: appContext.connections.getOpenedConnectionCount(),
            boundConnections: appContext.connections.getBoundConnectionCount()
        },
        summary: {
            accountCount: users.length,
            onlinePlayerCount: players.filter(player => player.isOnline).length,
            roomCount: rooms.length,
            storageCount: storages.length,
            sessionCount
        },
        rooms: pagedRooms.items,
        roomPager: pagedRooms.pager,
        players: pagedPlayers.items,
        playerPager: pagedPlayers.pager,
        storages: pagedStorages.items,
        storagePager: pagedStorages.pager
    };
}

function parseDashboardListQuery(searchParams: URLSearchParams, prefix: string): DashboardListQuery {
    return {
        search: (searchParams.get(`${prefix}Search`) ?? '').trim(),
        page: parsePositiveInteger(searchParams.get(`${prefix}Page`), 1),
        pageSize: Math.min(
            parsePositiveInteger(searchParams.get(`${prefix}PageSize`), DEFAULT_ADMIN_PAGE_SIZE),
            MAX_ADMIN_PAGE_SIZE
        )
    };
}

function parsePositiveInteger(input: string | null, defaultValue: number) {
    if (!input) {
        return defaultValue;
    }

    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return defaultValue;
    }

    return parsed;
}

function paginateDashboardList<T>(
    items: T[],
    query: DashboardListQuery,
    matcher: (item: T, normalizedSearch: string) => boolean
) {
    const normalizedSearch = query.search.toLowerCase();
    const filteredItems = normalizedSearch
        ? items.filter(item => matcher(item, normalizedSearch))
        : items;
    const filteredTotal = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(filteredTotal / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.pageSize;

    return {
        items: filteredItems.slice(start, start + query.pageSize),
        pager: {
            search: query.search,
            page,
            pageSize: query.pageSize,
            total: items.length,
            filteredTotal,
            totalPages
        } as DashboardPager
    };
}

function matchesSearch(search: string, values: Array<string | number | null | undefined>) {
    for (const value of values) {
        if (value === null || value === undefined) {
            continue;
        }

        if (String(value).toLowerCase().includes(search)) {
            return true;
        }
    }

    return false;
}

function authenticate(
    req: http.IncomingMessage,
    sessions: Map<string, AdminSession>,
    sessionTtlMs: number
) {
    const sessionId = getSessionId(req);
    if (!sessionId) {
        return null;
    }

    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }

    if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
    }

    session.expiresAt = Date.now() + sessionTtlMs;
    return sessionId;
}

function getSessionId(req: http.IncomingMessage) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[ADMIN_SESSION_COOKIE] ?? null;
}

function parseCookies(rawCookies: string | undefined) {
    const cookies: Record<string, string> = {};
    if (!rawCookies) {
        return cookies;
    }

    for (const part of rawCookies.split(';')) {
        const [key, ...valueParts] = part.trim().split('=');
        if (!key) {
            continue;
        }

        cookies[key] = decodeURIComponent(valueParts.join('='));
    }

    return cookies;
}

async function readJsonBody(req: http.IncomingMessage) {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > 1024 * 1024) {
            throw new Error('Request body is too large');
        }

        chunks.push(buffer);
    }

    if (!chunks.length) {
        return {} as Record<string, any>;
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, any>;
}

function sendHtml(res: http.ServerResponse, html: string) {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(html);
}

function sendJson(
    res: http.ServerResponse,
    statusCode: number,
    body: Record<string, any>,
    setCookies: string[] = []
) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(setCookies.length ? { 'Set-Cookie': setCookies } : {})
    });
    res.end(JSON.stringify(body));
}

function serializeCookie(sessionId: string, sessionTtlMs: number) {
    const maxAge = Math.floor(sessionTtlMs / 1000);
    return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function clearCookie() {
    return `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function normalizePath(pathname: string) {
    if (!pathname || pathname === '/') {
        return '/';
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function resolveErrorStatus(error: unknown) {
    if (error instanceof SyntaxError) {
        return 400;
    }

    if (!(error instanceof Error)) {
        return 500;
    }

    const message = error.message.toLowerCase();
    if (message.includes('not found')) {
        return 404;
    }

    if (message.includes('already')
        || message.includes('full')
        || message.includes('conflict')
        || message.includes('expired')
        || message.includes('invalid')) {
        return 409;
    }

    return 400;
}
