import { createGameServer } from './server/createGameServer';
import { loadLocalConfig } from './server/config';

export { createGameServer } from './server/createGameServer';

async function main() {
    const config = await loadLocalConfig();
    const gameServer = await createGameServer({
        port: config.server.port,
        dataDir: config.server.dataDir,
        inMemoryDb: config.server.inMemoryDb,
        sessionTtlMs: config.server.sessionTtlMs,
        logging: config.server.logging,
        admin: config.admin
    });
    await gameServer.start();
    if (gameServer.adminUrl) {
        console.log(`Admin dashboard: ${gameServer.adminUrl}`);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exitCode = 1;
    });
}
