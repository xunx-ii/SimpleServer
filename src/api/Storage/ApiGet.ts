import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqGet, ResGet } from '../../shared/protocols/Storage/PtlGet';

export default async function (call: ApiCall<ReqGet, ResGet>) {
    await withErrorHandling(call, async () => {
        const value = await getApiAppContext(call).storage.get(call.req.token, call.req.key, call.conn.id);
        await call.succ({ value });
    });
}
