import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqLogin, ResLogin } from '../../shared/protocols/Account/PtlLogin';

export default async function (call: ApiCall<ReqLogin, ResLogin>) {
    await withErrorHandling(call, async () => {
        const session = await getAppContext().accounts.login(call.req, call.conn.id);
        await call.succ({ session });
    });
}
