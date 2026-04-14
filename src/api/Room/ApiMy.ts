import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqMy, ResMy } from '../../shared/protocols/Room/PtlMy';

export default async function (call: ApiCall<ReqMy, ResMy>) {
    await withErrorHandling(call, async () => {
        const room = await getAppContext().rooms.getMyRoom(call.req.token);
        await call.succ({ room });
    });
}
