import { AuthenticatedRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqMy extends AuthenticatedRequest {
}

export interface ResMy extends BaseResponse {
    room: RoomInfo | null
}
