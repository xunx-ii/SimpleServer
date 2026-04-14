import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqCreate, ResCreate } from '../../shared/protocols/Room/PtlCreate';

export default async function (call: ApiCall<ReqCreate, ResCreate>) {
    await withErrorHandling(call, async () => {
        const room = await getApiAppContext(call).rooms.createRoom(call.req.token, {
            name: call.req.name,
            maxPlayers: call.req.maxPlayers
        }, call.conn.id);
        await call.succ({ room });
    });
}
