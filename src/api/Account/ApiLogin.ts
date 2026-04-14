import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqLogin, ResLogin } from '../../shared/protocols/Account/PtlLogin';

export default async function (call: ApiCall<ReqLogin, ResLogin>) {
    await withErrorHandling(call, async () => {
        const session = await getApiAppContext(call).accounts.login(call.req, call.conn.id);
        await call.succ({ session });
    });
}
