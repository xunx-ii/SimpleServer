import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuthSession, UserProfile } from '../../shared/models/GameModels';
import { ConnectionRegistry } from '../connectionRegistry';
import { Database } from '../database';
import { AccountEntity } from '../models';

class SessionStore {
    private readonly tokenToUserId = new Map<string, string>();

    create(userId: string) {
        const token = randomUUID();
        this.tokenToUserId.set(token, userId);
        return token;
    }

    resolve(token: string) {
        return this.tokenToUserId.get(token) ?? null;
    }
}

export class AccountService {
    private readonly sessions = new SessionStore();

    constructor(
        private readonly database: Database,
        private readonly connections: ConnectionRegistry
    ) {
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
            passwordHash: hashPassword(input.password, passwordSalt),
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

        if (account.passwordHash !== hashPassword(input.password, account.passwordSalt)) {
            throw new Error('Invalid password');
        }

        const now = new Date();
        await this.database.accounts.update(
            { userId: account.userId },
            {
                $set: {
                    lastLoginAt: now
                }
            }
        );

        return this.createSession({
            ...account,
            lastLoginAt: now
        }, connId);
    }

    async getProfile(token: string) {
        const account = await this.requireAccount(token);
        return this.toUserProfile(account);
    }

    async requireAccount(token: string) {
        if (!token?.trim()) {
            throw new Error('Missing auth token');
        }

        const userId = this.sessions.resolve(token);
        if (!userId) {
            throw new Error('Auth token expired or invalid');
        }

        const account = await this.database.accounts.findOne({ userId });
        if (!account) {
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

    private createSession(account: AccountEntity, connId?: string): AuthSession {
        const token = this.sessions.create(account.userId);
        if (connId) {
            this.connections.bind(connId, account.userId);
        }

        return {
            token,
            user: this.toUserProfile(account)
        };
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

function hashPassword(password: string, salt: string) {
    return createHash('sha256')
        .update(`${salt}:${password}`)
        .digest('hex');
}
