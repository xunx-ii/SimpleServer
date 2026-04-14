import { ApiCall } from 'tsrpc';
import { getApiAppContext, withErrorHandling } from '../_shared';
import { ReqSave, ResSave } from '../../shared/protocols/Storage/PtlSave';

export default async function (call: ApiCall<ReqSave, ResSave>) {
    await withErrorHandling(call, async () => {
        const savedKeys = await getApiAppContext(call).storage.save(call.req.token, call.req.save, call.conn.id);
        await call.succ({ savedKeys });
    });
}
