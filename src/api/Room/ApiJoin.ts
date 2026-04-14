import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqJoin, ResJoin } from '../../shared/protocols/Room/PtlJoin';

export default async function (call: ApiCall<ReqJoin, ResJoin>) {
    await withErrorHandling(call, async () => {
        const room = await getApiAppContext(call).rooms.joinRoom(call.req.token, call.req.roomId, call.conn.id);
        await call.succ({ room });
    });
}
