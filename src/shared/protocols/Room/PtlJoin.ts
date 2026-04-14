import { AuthenticatedRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqJoin extends AuthenticatedRequest {
    roomId: string
}

export interface ResJoin extends BaseResponse {
    room: RoomInfo
}
