import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqSetReady, ResSetReady } from '../../shared/protocols/Room/PtlSetReady';

export default async function (call: ApiCall<ReqSetReady, ResSetReady>) {
    await withErrorHandling(call, async () => {
        const room = await getAppContext().rooms.setReady(call.req.token, call.req.isReady);
        await call.succ({ room });
    });
}
