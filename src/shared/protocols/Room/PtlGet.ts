import { BaseRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqGet extends BaseRequest {
    roomId: string
}

export interface ResGet extends BaseResponse {
    room: RoomInfo
}
