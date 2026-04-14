import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqSetReady, ResSetReady } from '../../shared/protocols/Room/PtlSetReady';

export default async function (call: ApiCall<ReqSetReady, ResSetReady>) {
    await withErrorHandling(call, async () => {
        const room = await getApiAppContext(call).rooms.setReady(call.req.token, call.req.isReady, call.conn.id);
        await call.succ({ room });
    });
}
