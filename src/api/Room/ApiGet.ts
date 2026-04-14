import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqGet, ResGet } from '../../shared/protocols/Room/PtlGet';

export default async function (call: ApiCall<ReqGet, ResGet>) {
    await withErrorHandling(call, async () => {
        const room = await getAppContext().rooms.getRoom(call.req.roomId);
        await call.succ({ room });
    });
}
