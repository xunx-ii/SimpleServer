import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqJoin, ResJoin } from '../../shared/protocols/Room/PtlJoin';

export default async function (call: ApiCall<ReqJoin, ResJoin>) {
    await withErrorHandling(call, async () => {
        const room = await getAppContext().rooms.joinRoom(call.req.token, call.req.roomId);
        await call.succ({ room });
    });
}
