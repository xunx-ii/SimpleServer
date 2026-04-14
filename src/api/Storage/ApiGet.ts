import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqGet, ResGet } from '../../shared/protocols/Storage/PtlGet';

export default async function (call: ApiCall<ReqGet, ResGet>) {
    await withErrorHandling(call, async () => {
        const value = await getAppContext().storage.get(call.req.token, call.req.key);
        await call.succ({ value });
    });
}
