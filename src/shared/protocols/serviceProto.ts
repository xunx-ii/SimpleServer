import { ServiceProto } from 'tsrpc-proto';
import { ReqLogin, ResLogin } from './Account/PtlLogin';
import { ReqProfile, ResProfile } from './Account/PtlProfile';
import { ReqRegister, ResRegister } from './Account/PtlRegister';
import { ReqCreate, ResCreate } from './Room/PtlCreate';
import { ReqGet, ResGet } from './Room/PtlGet';
import { ReqJoin, ResJoin } from './Room/PtlJoin';
import { ReqLeave, ResLeave } from './Room/PtlLeave';
import { ReqList, ResList } from './Room/PtlList';
import { ReqMy, ResMy } from './Room/PtlMy';

export interface ServiceType {
    api: {
        "Account/Login": {
            req: ReqLogin,
            res: ResLogin
        },
        "Account/Profile": {
            req: ReqProfile,
            res: ResProfile
        },
        "Account/Register": {
            req: ReqRegister,
            res: ResRegister
        },
        "Room/Create": {
            req: ReqCreate,
            res: ResCreate
        },
        "Room/Get": {
            req: ReqGet,
            res: ResGet
        },
        "Room/Join": {
            req: ReqJoin,
            res: ResJoin
        },
        "Room/Leave": {
            req: ReqLeave,
            res: ResLeave
        },
        "Room/List": {
            req: ReqList,
            res: ResList
        },
        "Room/My": {
            req: ReqMy,
            res: ResMy
        }
    },
    msg: {

    }
}

export const serviceProto: ServiceProto<ServiceType> = {
    "version": 1,
    "services": [
        {
            "id": 2,
            "name": "Account/Login",
            "type": "api"
        },
        {
            "id": 3,
            "name": "Account/Profile",
            "type": "api"
        },
        {
            "id": 4,
            "name": "Account/Register",
            "type": "api"
        },
        {
            "id": 5,
            "name": "Room/Create",
            "type": "api"
        },
        {
            "id": 6,
            "name": "Room/Get",
            "type": "api"
        },
        {
            "id": 7,
            "name": "Room/Join",
            "type": "api"
        },
        {
            "id": 8,
            "name": "Room/Leave",
            "type": "api"
        },
        {
            "id": 9,
            "name": "Room/List",
            "type": "api"
        },
        {
            "id": 10,
            "name": "Room/My",
            "type": "api"
        }
    ],
    "types": {
        "Account/PtlLogin/ReqLogin": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "username",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "password",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "Account/PtlLogin/ResLogin": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "session",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/AuthSession"
                    }
                }
            ]
        },
        "base/BaseResponse": {
            "type": "Interface"
        },
        "../models/GameModels/AuthSession": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "token",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "user",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/UserProfile"
                    }
                }
            ]
        },
        "../models/GameModels/UserProfile": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "userId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "username",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "displayName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "createdAt",
                    "type": {
                        "type": "Date"
                    }
                },
                {
                    "id": 4,
                    "name": "lastLoginAt",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Date"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": null
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "Account/PtlProfile/ReqProfile": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/AuthenticatedRequest"
                    }
                }
            ]
        },
        "base/AuthenticatedRequest": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseRequest"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "token",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "base/BaseRequest": {
            "type": "Interface"
        },
        "Account/PtlProfile/ResProfile": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "user",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/UserProfile"
                    }
                }
            ]
        },
        "Account/PtlRegister/ReqRegister": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "username",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "password",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "displayName",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "Account/PtlRegister/ResRegister": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "session",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/AuthSession"
                    }
                }
            ]
        },
        "Room/PtlCreate/ReqCreate": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/AuthenticatedRequest"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "Room/PtlCreate/ResCreate": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomInfo"
                    }
                }
            ]
        },
        "../models/GameModels/RoomInfo": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "ownerUserId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "playerCount",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "../models/GameModels/RoomPlayer"
                        }
                    }
                },
                {
                    "id": 6,
                    "name": "createdAt",
                    "type": {
                        "type": "Date"
                    }
                },
                {
                    "id": 7,
                    "name": "updatedAt",
                    "type": {
                        "type": "Date"
                    }
                }
            ]
        },
        "../models/GameModels/RoomPlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "userId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "username",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "displayName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "isOnline",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "Room/PtlGet/ReqGet": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseRequest"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "Room/PtlGet/ResGet": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomInfo"
                    }
                }
            ]
        },
        "Room/PtlJoin/ReqJoin": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/AuthenticatedRequest"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "Room/PtlJoin/ResJoin": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomInfo"
                    }
                }
            ]
        },
        "Room/PtlLeave/ReqLeave": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/AuthenticatedRequest"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "Room/PtlLeave/ResLeave": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "room",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Reference",
                                    "target": "../models/GameModels/RoomInfo"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": null
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "removedRoomId",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": null
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "Room/PtlList/ReqList": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseRequest"
                    }
                }
            ]
        },
        "Room/PtlList/ResList": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "rooms",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "../models/GameModels/RoomInfo"
                        }
                    }
                }
            ]
        },
        "Room/PtlMy/ReqMy": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/AuthenticatedRequest"
                    }
                }
            ]
        },
        "Room/PtlMy/ResMy": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "base/BaseResponse"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "room",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Reference",
                                    "target": "../models/GameModels/RoomInfo"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": null
                                }
                            }
                        ]
                    }
                }
            ]
        }
    }
};