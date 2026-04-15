import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { AuthSession, UserProfile } from '../../shared/models/GameModels';
import { ConnectionRegistry } from '../connectionRegistry';
import { Database } from '../database';
import { AccountEntity, SessionEntity } from '../models';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = 'scrypt_v1';
const PASSWORD_HASH_KEY_LENGTH = 64;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type ConnectionSessionCache = {
    token: string
    session: SessionEntity
};

export type AuthenticatedUserIdentity = {
    userId: string
    username: string
    displayName: string
};

export class AccountService {
    private readonly sessionTtlMs: number;
    private readonly accountByUserId = new Map<string, AccountEntity>();
    private readonly profileByUserId = new Map<string, UserProfile>();
    private readonly userIdByUsername = new Map<string, string>();
    private readonly sessionByToken = new Map<string, SessionEntity>();
    private readonly sessionByTokenHash = new Map<string, SessionEntity>();
    private readonly tokenByTokenHash = new Map<string, string>();
    private readonly sessionByConnId = new Map<string, ConnectionSessionCache>();

    constructor(
        private readonly database: Database,
        private readonly connections: ConnectionRegistry,
        options: {
            sessionTtlMs?: number
        } = {}
    ) {
        this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
        if (!Number.isInteger(this.sessionTtlMs) || this.sessionTtlMs <= 0) {
            throw new Error('Session TTL must be a positive integer');
        }
    }

    dispose() {
        this.accountByUserId.clear();
        this.profileByUserId.clear();
        this.userIdByUsername.clear();
        this.sessionByToken.clear();
        this.sessionByTokenHash.clear();
        this.tokenByTokenHash.clear();
        this.sessionByConnId.clear();
    }

    unregisterConnection(connId: string) {
        this.sessionByConnId.delete(connId);
    }

    async register(
        input: {
            username: string
            password: string
            displayName?: string
        },
        connId?: string
    ) {
        const username = normalizeUsername(input.username);
        validatePassword(input.password);
        const displayName = normalizeDisplayName(input.displayName, username);

        const exists = await this.getAccountEntityByUsername(username);
        if (exists) {
            throw new Error('Username already exists');
        }

        const now = new Date();
        const passwordSalt = randomBytes(16).toString('hex');
        const account: AccountEntity = {
            userId: randomUUID(),
            username,
            displayName,
            passwordSalt,
            passwordHash: await hashPassword(input.password, passwordSalt),
            createdAt: now,
            lastLoginAt: now
        };

        const created = await this.database.accounts.insert(account);
        return this.createSession(created, connId);
    }

    async login(
        input: {
            username: string
            password: string
        },
        connId?: string
    ) {
        const username = normalizeUsername(input.username);
        const account = await this.getAccountEntityByUsername(username);
        if (!account) {
            throw new Error('Account not found');
        }

        const verified = await verifyPassword(input.password, account);
        if (!verified.isValid) {
            throw new Error('Invalid password');
        }

        const now = new Date();
        const updatedPasswordHash = verified.upgradedHash ?? account.passwordHash;
        await this.database.accounts.update(
            { userId: account.userId },
            {
                $set: {
                    passwordHash: updatedPasswordHash,
                    lastLoginAt: now
                }
            }
        );

        const updatedAccount = {
            ...account,
            passwordHash: updatedPasswordHash,
            lastLoginAt: now
        };
        this.cacheAccount(updatedAccount);

        return this.createSession(updatedAccount, connId);
    }

    async getProfile(token: string, connId?: string) {
        const account = await this.requireAccount(token, connId);
        return this.toUserProfile(account);
    }

    async requireUserIdentity(token: string, connId?: string): Promise<AuthenticatedUserIdentity> {
        const { normalizedToken, session } = await this.requireAuthenticatedSession(token, connId);
        if (connId) {
            this.bindAuthenticatedConnection(connId, session.userId, normalizedToken, session);
        }

        const profile = this.profileByUserId.get(session.userId);
        if (profile) {
            return {
                userId: profile.userId,
                username: profile.username,
                displayName: profile.displayName
            };
        }

        const account = await this.getAccountEntityByUserId(session.userId);
        if (!account) {
            await this.deleteSession(session, normalizedToken);
            throw new Error('Account not found');
        }

        return {
            userId: account.userId,
            username: account.username,
            displayName: account.displayName
        };
    }

    async requireAccount(token: string, connId?: string) {
        const { normalizedToken, session } = await this.requireAuthenticatedSession(token, connId);
        if (connId) {
            this.bindAuthenticatedConnection(connId, session.userId, normalizedToken, session);
        }

        const account = await this.getAccountEntityByUserId(session.userId);
        if (!account) {
            await this.deleteSession(session, normalizedToken);
            throw new Error('Account not found');
        }

        return account;
    }

    private async requireAuthenticatedSession(token: string, connId?: string) {
        const normalizedToken = normalizeToken(token);
        const session = connId
            ? await this.requireSessionForConnection(normalizedToken, connId)
            : await this.requireSession(normalizedToken);

        return {
            normalizedToken,
            session
        };
    }

    async getProfiles(userIds: string[]) {
        const profiles = new Map<string, UserProfile>();
        const missingUserIds: string[] = [];

        for (const userId of Array.from(new Set(userIds))) {
            const cached = this.accountByUserId.get(userId);
            if (cached) {
                profiles.set(userId, this.toUserProfile(cached));
                continue;
            }

            missingUserIds.push(userId);
        }

        if (missingUserIds.length) {
            const accounts = await this.database.accounts.findMany({
                userId: {
                    $in: missingUserIds
                }
            });

            for (const account of accounts) {
                this.cacheAccount(account);
                profiles.set(account.userId, this.toUserProfile(account));
            }
        }

        return profiles;
    }

    async listUsers() {
        const accounts = await this.database.accounts.findMany({});
        for (const account of accounts) {
            this.cacheAccount(account);
        }
        return accounts
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(account => this.toUserProfile(account));
    }

    async getUser(userId: string) {
        const account = await this.getAccountEntityByUserId(normalizeUserId(userId));

        return account ? this.toUserProfile(account) : null;
    }

    async updateDisplayName(userId: string, displayName: string) {
        const normalizedUserId = normalizeUserId(userId);
        const account = await this.getAccountEntityByUserId(normalizedUserId);
        if (!account) {
            throw new Error('Account not found');
        }

        const normalizedDisplayName = normalizeDisplayName(displayName, account.username);
        await this.database.accounts.update(
            { userId: normalizedUserId },
            {
                $set: {
                    displayName: normalizedDisplayName
                }
            }
        );

        const updatedAccount = {
            ...account,
            displayName: normalizedDisplayName
        };
        this.cacheAccount(updatedAccount);

        return this.toUserProfile(updatedAccount);
    }

    async listActiveSessionCounts() {
        const now = Date.now();
        const sessions = await this.database.sessions.findMany({});
        const counts = new Map<string, number>();

        for (const session of sessions) {
            if (session.expiresAt.getTime() <= now) {
                continue;
            }

            counts.set(session.userId, (counts.get(session.userId) ?? 0) + 1);
        }

        return counts;
    }

    async countActiveSessions() {
        const sessionCounts = await this.listActiveSessionCounts();
        let total = 0;

        for (const count of sessionCounts.values()) {
            total += count;
        }

        return total;
    }

    private async createSession(account: AccountEntity, connId?: string): Promise<AuthSession> {
        const token = randomUUID();
        const now = new Date();
        const session: SessionEntity = {
            tokenHash: hashToken(token),
            userId: account.userId,
            createdAt: now,
            lastSeenAt: now,
            expiresAt: new Date(now.getTime() + this.sessionTtlMs)
        };
        await this.database.sessions.insert(session);
        this.cacheAccount(account);
        this.cacheSession(session, token);

        if (connId) {
            this.connections.bind(connId, account.userId);
            this.cacheConnectionSession(connId, token, session);
        }

        return {
            token,
            user: this.toUserProfile(account)
        };
    }

    private async requireSessionForConnection(token: string, connId: string) {
        const cached = this.sessionByConnId.get(connId);
        if (cached?.token === token) {
            const session = await this.ensureSessionValidity(cached.session, token);
            if (session !== cached.session) {
                this.cacheConnectionSession(connId, token, session);
            }
            return session;
        }

        const session = await this.requireSession(token);
        this.cacheConnectionSession(connId, token, session);
        return session;
    }

    private async requireSession(token: string) {
        const tokenCachedSession = this.sessionByToken.get(token);
        if (tokenCachedSession) {
            return this.ensureSessionValidity(tokenCachedSession, token);
        }

        const tokenHash = hashToken(token);
        const cachedSession = this.sessionByTokenHash.get(tokenHash);
        if (cachedSession) {
            this.cacheSession(cachedSession, token);
            return this.ensureSessionValidity(cachedSession, token);
        }

        const session = await this.database.sessions.findOne({ tokenHash });
        if (!session) {
            throw new Error('Auth token expired or invalid');
        }

        this.cacheSession(session, token);
        return this.ensureSessionValidity(session, token);
    }

    private async ensureSessionValidity(session: SessionEntity, token?: string) {
        const nowMs = Date.now();
        if (session.expiresAt.getTime() <= nowMs) {
            await this.deleteSession(session, token);
            throw new Error('Auth token expired or invalid');
        }

        if (nowMs - session.lastSeenAt.getTime() >= Math.min(this.sessionTtlMs, SESSION_TOUCH_INTERVAL_MS)) {
            const lastSeenAt = new Date(nowMs);
            const updatedSession: SessionEntity = {
                ...session,
                lastSeenAt,
                expiresAt: new Date(nowMs + this.sessionTtlMs)
            };
            await this.database.sessions.update(
                { tokenHash: session.tokenHash },
                {
                    $set: {
                        lastSeenAt: updatedSession.lastSeenAt,
                        expiresAt: updatedSession.expiresAt
                    }
                }
            );
            this.cacheSession(updatedSession, token);
            return updatedSession;
        }

        return session;
    }

    private async getAccountEntityByUsername(username: string) {
        const cachedUserId = this.userIdByUsername.get(username);
        if (cachedUserId) {
            const cachedAccount = this.accountByUserId.get(cachedUserId);
            if (cachedAccount) {
                return cachedAccount;
            }

            this.userIdByUsername.delete(username);
        }

        const account = await this.database.accounts.findOne({ username });
        if (account) {
            this.cacheAccount(account);
        }

        return account;
    }

    private async getAccountEntityByUserId(userId: string) {
        const cachedAccount = this.accountByUserId.get(userId);
        if (cachedAccount) {
            return cachedAccount;
        }

        const account = await this.database.accounts.findOne({ userId });
        if (account) {
            this.cacheAccount(account);
        }

        return account;
    }

    private cacheAccount(account: AccountEntity) {
        this.accountByUserId.set(account.userId, account);
        this.userIdByUsername.set(account.username, account.userId);
        this.profileByUserId.set(account.userId, {
            userId: account.userId,
            username: account.username,
            displayName: account.displayName,
            createdAt: account.createdAt,
            lastLoginAt: account.lastLoginAt
        });
    }

    private cacheSession(session: SessionEntity, token?: string) {
        this.sessionByTokenHash.set(session.tokenHash, session);
        if (token) {
            this.sessionByToken.set(token, session);
            this.tokenByTokenHash.set(session.tokenHash, token);
        }
    }

    private cacheConnectionSession(connId: string, token: string, session: SessionEntity) {
        this.sessionByConnId.set(connId, {
            token,
            session
        });
    }

    private bindAuthenticatedConnection(connId: string, userId: string, token: string, session: SessionEntity) {
        this.connections.bind(connId, userId);
        this.cacheConnectionSession(connId, token, session);
    }

    private async deleteSession(session: SessionEntity, token?: string) {
        await this.database.sessions.remove({ tokenHash: session.tokenHash });
        this.removeSessionCache(session.tokenHash, token);
    }

    private removeSessionCache(tokenHash: string, token?: string) {
        this.sessionByTokenHash.delete(tokenHash);

        const resolvedToken = token ?? this.tokenByTokenHash.get(tokenHash);
        if (resolvedToken) {
            this.sessionByToken.delete(resolvedToken);
        }
        this.tokenByTokenHash.delete(tokenHash);

        for (const [connId, cache] of this.sessionByConnId.entries()) {
            if (cache.session.tokenHash === tokenHash) {
                this.sessionByConnId.delete(connId);
            }
        }
    }

    private toUserProfile(account: AccountEntity): UserProfile {
        const cached = this.profileByUserId.get(account.userId);
        if (cached) {
            return cached;
        }

        this.cacheAccount(account);
        return this.profileByUserId.get(account.userId)!;
    }
}

function normalizeUsername(username: string) {
    const normalized = username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(normalized)) {
        throw new Error('Username must be 3-24 chars of letters, numbers, or underscore');
    }

    return normalized;
}

function normalizeDisplayName(displayName: string | undefined, fallback: string) {
    const normalized = displayName?.trim() || fallback;
    if (normalized.length < 1 || normalized.length > 24) {
        throw new Error('Display name must be 1-24 characters');
    }

    return normalized;
}

function validatePassword(password: string) {
    if (password.length < 6 || password.length > 64) {
        throw new Error('Password must be 6-64 characters');
    }
}

function normalizeUserId(userId: string) {
    const normalized = userId.trim();
    if (!normalized) {
        throw new Error('User id is required');
    }

    return normalized;
}

function normalizeToken(token: string) {
    const normalized = token?.trim();
    if (!normalized) {
        throw new Error('Missing auth token');
    }

    return normalized;
}

async function hashPassword(password: string, salt: string) {
    const hash = await scrypt(password, salt, PASSWORD_HASH_KEY_LENGTH) as Buffer;
    return `${PASSWORD_HASH_PREFIX}$${hash.toString('hex')}`;
}

async function verifyPassword(password: string, account: Pick<AccountEntity, 'passwordHash' | 'passwordSalt'>) {
    if (account.passwordHash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
        const expected = Buffer.from(account.passwordHash.slice(PASSWORD_HASH_PREFIX.length + 1), 'hex');
        const actual = await scrypt(password, account.passwordSalt, PASSWORD_HASH_KEY_LENGTH) as Buffer;

        return {
            isValid: expected.length === actual.length && timingSafeEqual(expected, actual)
        };
    }

    const legacyHash = hashLegacyPassword(password, account.passwordSalt);
    if (legacyHash !== account.passwordHash) {
        return {
            isValid: false
        };
    }

    return {
        isValid: true,
        upgradedHash: await hashPassword(password, account.passwordSalt)
    };
}

function hashLegacyPassword(password: string, salt: string) {
    return createHash('sha256')
        .update(`${salt}:${password}`)
        .digest('hex');
}

function hashToken(token: string) {
    return createHash('sha256')
        .update(token)
        .digest('hex');
}
