import { AuthenticatedRequest, BaseResponse } from '../base';
import { UserProfile } from '../../models/GameModels';

export interface ReqProfile extends AuthenticatedRequest {
}

export interface ResProfile extends BaseResponse {
    user: UserProfile
}
