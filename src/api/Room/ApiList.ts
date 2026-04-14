import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqList, ResList } from '../../shared/protocols/Room/PtlList';

export default async function (call: ApiCall<ReqList, ResList>) {
    await withErrorHandling(call, async () => {
        const rooms = await getApiAppContext(call).rooms.listRooms();
        await call.succ({ rooms });
    });
}
