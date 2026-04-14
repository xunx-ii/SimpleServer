import { AuthenticatedRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqCreate extends AuthenticatedRequest {
    name: string
    maxPlayers: number
}

export interface ResCreate extends BaseResponse {
    room: RoomInfo
}
