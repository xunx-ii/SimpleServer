import { BaseResponse } from '../base';
import { AuthSession } from '../../models/GameModels';

export interface ReqRegister {
    username: string
    password: string
    displayName?: string
}

export interface ResRegister extends BaseResponse {
    session: AuthSession
}
