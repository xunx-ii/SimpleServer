import { ServiceProto } from 'tsrpc-proto';
import { ReqLogin, ResLogin } from './Account/PtlLogin';
import { ReqProfile, ResProfile } from './Account/PtlProfile';
import { ReqRegister, ResRegister } from './Account/PtlRegister';
import { MsgEvent } from './Room/MsgEvent';
import { MsgSync } from './Room/MsgSync';
import { ReqCreate, ResCreate } from './Room/PtlCreate';
import { ReqGet, ResGet } from './Room/PtlGet';
import { ReqJoin, ResJoin } from './Room/PtlJoin';
import { ReqLeave, ResLeave } from './Room/PtlLeave';
import { ReqList, ResList } from './Room/PtlList';
import { ReqMy, ResMy } from './Room/PtlMy';
import { ReqSetReady, ResSetReady } from './Room/PtlSetReady';
import { ReqSync, ResSync } from './Room/PtlSync';
import { ReqGet as ReqGet_1, ResGet as ResGet_1 } from './Storage/PtlGet';
import { ReqSave, ResSave } from './Storage/PtlSave';

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
        },
        "Room/SetReady": {
            req: ReqSetReady,
            res: ResSetReady
        },
        "Room/Sync": {
            req: ReqSync,
            res: ResSync
        },
        "Storage/Get": {
            req: ReqGet_1,
            res: ResGet_1
        },
        "Storage/Save": {
            req: ReqSave,
            res: ResSave
        }
    },
    msg: {
        "Room/Event": MsgEvent,
        "Room/Sync": MsgSync
    }
}

export const serviceProto: ServiceProto<ServiceType> = {
    "version": 3,
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
            "id": 11,
            "name": "Room/Event",
            "type": "msg"
        },
        {
            "id": 12,
            "name": "Room/Sync",
            "type": "msg"
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
        },
        {
            "id": 13,
            "name": "Room/SetReady",
            "type": "api"
        },
        {
            "id": 14,
            "name": "Room/Sync",
            "type": "api"
        },
        {
            "id": 15,
            "name": "Storage/Get",
            "type": "api"
        },
        {
            "id": 16,
            "name": "Storage/Save",
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
        "Room/MsgEvent/MsgEvent": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomEvent"
                    }
                }
            ]
        },
        "../models/GameModels/RoomEvent": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "type",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "room_created"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "player_joined"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "player_left"
                                }
                            },
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": "player_count_changed"
                                }
                            },
                            {
                                "id": 4,
                                "type": {
                                    "type": "Literal",
                                    "literal": "player_ready_changed"
                                }
                            },
                            {
                                "id": 5,
                                "type": {
                                    "type": "Literal",
                                    "literal": "countdown_started"
                                }
                            },
                            {
                                "id": 6,
                                "type": {
                                    "type": "Literal",
                                    "literal": "countdown_tick"
                                }
                            },
                            {
                                "id": 7,
                                "type": {
                                    "type": "Literal",
                                    "literal": "countdown_canceled"
                                }
                            },
                            {
                                "id": 8,
                                "type": {
                                    "type": "Literal",
                                    "literal": "game_started"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomInfo"
                    }
                },
                {
                    "id": 3,
                    "name": "actorUserId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "targetUserId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "countdownSeconds",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "message",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "sentAt",
                    "type": {
                        "type": "Date"
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
                    "id": 8,
                    "name": "state",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "open"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "countdown"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "playing"
                                }
                            }
                        ]
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
                    "id": 9,
                    "name": "countdownEndAt",
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
                },
                {
                    "id": 10,
                    "name": "startedAt",
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
                },
                {
                    "id": 4,
                    "name": "isReady",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "Room/MsgSync/MsgSync": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/RoomSyncMessage"
                    }
                }
            ]
        },
        "../models/GameModels/RoomSyncMessage": {
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
                    "name": "fromUserId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "fromUsername",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "fromDisplayName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "toUserId",
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
                },
                {
                    "id": 5,
                    "name": "kind",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "payload",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 7,
                    "name": "sentAt",
                    "type": {
                        "type": "Date"
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
        },
        "Room/PtlSetReady/ReqSetReady": {
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
                    "name": "isReady",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "Room/PtlSetReady/ResSetReady": {
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
        "Room/PtlSync/ReqSync": {
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
                    "name": "payload",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "kind",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "targetUserId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "Room/PtlSync/ResSync": {
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
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "deliveredUserIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    }
                }
            ]
        },
        "Storage/PtlGet/ReqGet": {
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
                    "name": "key",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "Storage/PtlGet/ResGet": {
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
                    "name": "value",
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
        "Storage/PtlSave/ReqSave": {
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
                    "name": "save",
                    "type": {
                        "type": "Reference",
                        "target": "../models/GameModels/UserStorageData"
                    }
                }
            ]
        },
        "../models/GameModels/UserStorageData": {
            "type": "Interface",
            "indexSignature": {
                "keyType": "String",
                "type": {
                    "type": "String"
                }
            }
        },
        "Storage/PtlSave/ResSave": {
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
                    "name": "savedKeys",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    }
                }
            ]
        }
    }
};