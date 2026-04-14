import { ApiCall } from 'tsrpc';
import { withErrorHandling } from '../_shared';
import { getAppContext } from '../../server/context';
import { ReqSave, ResSave } from '../../shared/protocols/Storage/PtlSave';

export default async function (call: ApiCall<ReqSave, ResSave>) {
    await withErrorHandling(call, async () => {
        const savedKeys = await getAppContext().storage.save(call.req.token, call.req.save);
        await call.succ({ savedKeys });
    });
}
