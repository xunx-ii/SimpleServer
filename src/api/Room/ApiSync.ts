import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqSync, ResSync } from '../../shared/protocols/Room/PtlSync';

export default async function (call: ApiCall<ReqSync, ResSync>) {
    await withErrorHandling(call, async () => {
        const result = await getApiAppContext(call).rooms.sync(call.req.token, {
            payload: call.req.payload,
            kind: call.req.kind,
            targetUserId: call.req.targetUserId
        }, call.conn.id);
        await call.succ(result);
    });
}
