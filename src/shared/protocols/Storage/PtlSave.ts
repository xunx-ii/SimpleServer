import { AuthenticatedRequest, BaseResponse } from '../base';
import { UserStorageData } from '../../models/GameModels';

export interface ReqSave extends AuthenticatedRequest {
    save: UserStorageData
}

export interface ResSave extends BaseResponse {
    savedKeys: string[]
}
