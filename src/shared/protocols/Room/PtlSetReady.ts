import { AuthenticatedRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqSetReady extends AuthenticatedRequest {
    isReady: boolean
}

export interface ResSetReady extends BaseResponse {
    room: RoomInfo
}
