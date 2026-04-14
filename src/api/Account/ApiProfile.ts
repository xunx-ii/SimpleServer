import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqProfile, ResProfile } from '../../shared/protocols/Account/PtlProfile';

export default async function (call: ApiCall<ReqProfile, ResProfile>) {
    await withErrorHandling(call, async () => {
        const user = await getAppContext().accounts.getProfile(call.req.token);
        await call.succ({ user });
    });
}
