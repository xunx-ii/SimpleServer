import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqCreate, ResCreate } from '../../shared/protocols/Room/PtlCreate';

export default async function (call: ApiCall<ReqCreate, ResCreate>) {
    await withErrorHandling(call, async () => {
        const room = await getAppContext().rooms.createRoom(call.req.token, {
            name: call.req.name,
            maxPlayers: call.req.maxPlayers
        });
        await call.succ({ room });
    });
}
