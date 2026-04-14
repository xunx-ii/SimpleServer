import { createGameServer } from './server/createGameServer';

export { createGameServer } from './server/createGameServer';

async function main() {
    const gameServer = await createGameServer();
    await gameServer.start();
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exitCode = 1;
    });
}
