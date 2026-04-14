import { AuthenticatedRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqLeave extends AuthenticatedRequest {
    roomId?: string
}

export interface ResLeave extends BaseResponse {
    room: RoomInfo | null
    removedRoomId: string | null
}
