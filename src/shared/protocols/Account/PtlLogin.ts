import { BaseResponse } from '../base';
import { AuthSession } from '../../models/GameModels';

export interface ReqLogin {
    username: string
    password: string
}

export interface ResLogin extends BaseResponse {
    session: AuthSession
}
