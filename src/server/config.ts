import * as fs from 'fs/promises';
import * as path from 'path';

export interface AdminServerConfig {
    enabled?: boolean
    host?: string
    port?: number
    username?: string
    password?: string
    sessionTtlMs?: number
}

export interface LocalAppConfig {
    server?: {
        port?: number
        dataDir?: string
        inMemoryDb?: boolean
        sessionTtlMs?: number
    }
    admin?: AdminServerConfig
}

const DEFAULT_CONFIG: Required<LocalAppConfig> = {
    server: {
        port: 23414,
        dataDir: '.data',
        inMemoryDb: false,
        sessionTtlMs: 30 * 24 * 60 * 60 * 1000
    },
    admin: {
        enabled: true,
        host: '127.0.0.1',
        port: 23514,
        username: 'admin',
        password: 'change-me',
        sessionTtlMs: 12 * 60 * 60 * 1000
    }
};

export async function loadLocalConfig() {
    const configPath = await resolveConfigPath();
    const file = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(file) as LocalAppConfig;

    return {
        server: {
            ...DEFAULT_CONFIG.server,
            ...parsed.server
        },
        admin: {
            ...DEFAULT_CONFIG.admin,
            ...parsed.admin
        }
    };
}

async function resolveConfigPath() {
    const primary = path.resolve(process.cwd(), 'config.json');
    if (await exists(primary)) {
        return primary;
    }

    const fallback = path.resolve(process.cwd(), 'config.example.json');
    if (await exists(fallback)) {
        return fallback;
    }

    throw new Error('Missing config.json and config.example.json');
}

async function exists(filePath: string) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
