import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqProfile, ResProfile } from '../../shared/protocols/Account/PtlProfile';

export default async function (call: ApiCall<ReqProfile, ResProfile>) {
    await withErrorHandling(call, async () => {
        const user = await getApiAppContext(call).accounts.getProfile(call.req.token, call.conn.id);
        await call.succ({ user });
    });
}
