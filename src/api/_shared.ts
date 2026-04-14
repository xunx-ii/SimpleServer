import { ApiCall } from 'tsrpc';
import { ServiceType } from '../shared/protocols/serviceProto';
import { getAppContext } from '../server/context';

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

export function getApiAppContext(call: ApiCall<any, any, ServiceType>) {
    return getAppContext(call.server);
}
