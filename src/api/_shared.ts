import { ApiCall } from 'tsrpc';

export async function withErrorHandling<Req, Res>(
    call: ApiCall<Req, Res>,
    executor: () => Promise<void>
) {
    try {
        await executor();
    }
    catch (error) {
        await call.error(error instanceof Error ? error.message : 'Internal server error');
    }
}
