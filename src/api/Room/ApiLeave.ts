import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqLeave, ResLeave } from '../../shared/protocols/Room/PtlLeave';

export default async function (call: ApiCall<ReqLeave, ResLeave>) {
    await withErrorHandling(call, async () => {
        const result = await getAppContext().rooms.leaveRoom(call.req.token, call.req.roomId);
        await call.succ(result);
    });
}
