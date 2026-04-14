import { AuthenticatedRequest, BaseResponse } from '../base';

export interface ReqGet extends AuthenticatedRequest {
    key: string
}

export interface ResGet extends BaseResponse {
    value: string | null
}
