import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqList, ResList } from '../../shared/protocols/Room/PtlList';

export default async function (call: ApiCall<ReqList, ResList>) {
    await withErrorHandling(call, async () => {
        const rooms = await getAppContext().rooms.listRooms();
        await call.succ({ rooms });
    });
}
