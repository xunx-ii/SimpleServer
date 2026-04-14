import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqRegister, ResRegister } from '../../shared/protocols/Account/PtlRegister';

export default async function (call: ApiCall<ReqRegister, ResRegister>) {
    await withErrorHandling(call, async () => {
        const session = await getApiAppContext(call).accounts.register(call.req, call.conn.id);
        await call.succ({ session });
    });
}
