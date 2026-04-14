import { BaseRequest, BaseResponse } from '../base';
import { RoomInfo } from '../../models/GameModels';

export interface ReqList extends BaseRequest {
}

export interface ResList extends BaseResponse {
    rooms: RoomInfo[]
}
