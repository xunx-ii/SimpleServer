import { AuthenticatedRequest, BaseResponse } from '../base';

export interface ReqSync extends AuthenticatedRequest {
    payload: string
    kind?: string
    targetUserId?: string
}

export interface ResSync extends BaseResponse {
    roomId: string
    deliveredUserIds: string[]
}
