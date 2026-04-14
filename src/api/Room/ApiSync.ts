import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqSync, ResSync } from '../../shared/protocols/Room/PtlSync';

export default async function (call: ApiCall<ReqSync, ResSync>) {
    await withErrorHandling(call, async () => {
        const result = await getAppContext().rooms.sync(call.req.token, {
            payload: call.req.payload,
            kind: call.req.kind,
            targetUserId: call.req.targetUserId
        });
        await call.succ(result);
    });
}
