import { AuthenticatedRequest } from '../base';

export interface MsgClientSync extends AuthenticatedRequest {
    payload: string
    kind?: string
    targetUserId?: string
}
