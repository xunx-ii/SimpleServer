import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqRegister, ResRegister } from '../../shared/protocols/Account/PtlRegister';

export default async function (call: ApiCall<ReqRegister, ResRegister>) {
    await withErrorHandling(call, async () => {
        const session = await getAppContext().accounts.register(call.req, call.conn.id);
        await call.succ({ session });
    });
}
