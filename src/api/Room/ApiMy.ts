import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqMy, ResMy } from '../../shared/protocols/Room/PtlMy';

export default async function (call: ApiCall<ReqMy, ResMy>) {
    await withErrorHandling(call, async () => {
        const room = await getApiAppContext(call).rooms.getMyRoom(call.req.token, call.conn.id);
        await call.succ({ room });
    });
}
