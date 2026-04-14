import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { AuthSession, UserProfile } from '../../shared/models/GameModels';
import { ConnectionRegistry } from '../connectionRegistry';
import { Database } from '../database';
import { AccountEntity } from '../models';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = 'scrypt_v1';
const PASSWORD_HASH_KEY_LENGTH = 64;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export class AccountService {
    private readonly sessionTtlMs: number;

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

        const exists = await this.database.accounts.findOne({ username });
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
        const account = await this.database.accounts.findOne({ username });
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

        return this.createSession({
            ...account,
            passwordHash: updatedPasswordHash,
            lastLoginAt: now
        }, connId);
    }

    async getProfile(token: string, connId?: string) {
        const account = await this.requireAccount(token, connId);
        return this.toUserProfile(account);
    }

    async requireAccount(token: string, connId?: string) {
        const session = await this.requireSession(token);
        if (connId) {
            this.connections.bind(connId, session.userId);
        }

        const account = await this.database.accounts.findOne({ userId: session.userId });
        if (!account) {
            await this.database.sessions.remove({ tokenHash: session.tokenHash });
            throw new Error('Account not found');
        }

        return account;
    }

    async getProfiles(userIds: string[]) {
        const profiles = new Map<string, UserProfile>();

        for (const userId of Array.from(new Set(userIds))) {
            const account = await this.database.accounts.findOne({ userId });
            if (account) {
                profiles.set(userId, this.toUserProfile(account));
            }
        }

        return profiles;
    }

    async listUsers() {
        const accounts = await this.database.accounts.findMany({});
        return accounts
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(account => this.toUserProfile(account));
    }

    async getUser(userId: string) {
        const account = await this.database.accounts.findOne({
            userId: normalizeUserId(userId)
        });

        return account ? this.toUserProfile(account) : null;
    }

    async updateDisplayName(userId: string, displayName: string) {
        const normalizedUserId = normalizeUserId(userId);
        const account = await this.database.accounts.findOne({ userId: normalizedUserId });
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

        return this.toUserProfile({
            ...account,
            displayName: normalizedDisplayName
        });
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
        await this.database.sessions.insert({
            tokenHash: hashToken(token),
            userId: account.userId,
            createdAt: now,
            lastSeenAt: now,
            expiresAt: new Date(now.getTime() + this.sessionTtlMs)
        });

        if (connId) {
            this.connections.bind(connId, account.userId);
        }

        return {
            token,
            user: this.toUserProfile(account)
        };
    }

    private async requireSession(token: string) {
        const normalizedToken = token?.trim();
        if (!normalizedToken) {
            throw new Error('Missing auth token');
        }

        const tokenHash = hashToken(normalizedToken);
        const session = await this.database.sessions.findOne({ tokenHash });
        if (!session) {
            throw new Error('Auth token expired or invalid');
        }

        const now = new Date();
        if (session.expiresAt.getTime() <= now.getTime()) {
            await this.database.sessions.remove({ tokenHash });
            throw new Error('Auth token expired or invalid');
        }

        if (now.getTime() - session.lastSeenAt.getTime() >= Math.min(this.sessionTtlMs, SESSION_TOUCH_INTERVAL_MS)) {
            await this.database.sessions.update(
                { tokenHash },
                {
                    $set: {
                        lastSeenAt: now,
                        expiresAt: new Date(now.getTime() + this.sessionTtlMs)
                    }
                }
            );
        }

        return session;
    }

    private toUserProfile(account: AccountEntity): UserProfile {
        return {
            userId: account.userId,
            username: account.username,
            displayName: account.displayName,
            createdAt: account.createdAt,
            lastLoginAt: account.lastLoginAt
        };
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
