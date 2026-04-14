import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqGet, ResGet } from '../../shared/protocols/Room/PtlGet';

export default async function (call: ApiCall<ReqGet, ResGet>) {
    await withErrorHandling(call, async () => {
        const room = await getApiAppContext(call).rooms.getRoom(call.req.roomId);
        await call.succ({ room });
    });
}
