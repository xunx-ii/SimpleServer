import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqLeave, ResLeave } from '../../shared/protocols/Room/PtlLeave';

export default async function (call: ApiCall<ReqLeave, ResLeave>) {
    await withErrorHandling(call, async () => {
        const result = await getApiAppContext(call).rooms.leaveRoom(call.req.token, call.req.roomId, call.conn.id);
        await call.succ(result);
    });
}
