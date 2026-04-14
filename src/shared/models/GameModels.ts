export interface UserProfile {
    userId: string
    username: string
    displayName: string
    createdAt: Date
    lastLoginAt: Date | null
}

export interface AuthSession {
    token: string
    user: UserProfile
}

export interface UserStorageData {
    [key: string]: string
}

export interface RoomPlayer {
    userId: string
    username: string
    displayName: string
    isOnline: boolean
    isReady: boolean
}

export interface RoomInfo {
    roomId: string
    name: string
    ownerUserId: string
    maxPlayers: number
    state: 'open' | 'countdown' | 'playing'
    playerCount: number
    players: RoomPlayer[]
    countdownEndAt: Date | null
    startedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface RoomSyncMessage {
    roomId: string
    fromUserId: string
    fromUsername: string
    fromDisplayName: string
    toUserId: string | null
    kind?: string
    payload: string
    sentAt: Date
}

export interface RoomEvent {
    type:
        | 'room_created'
        | 'player_joined'
        | 'player_left'
        | 'player_kicked'
        | 'player_count_changed'
        | 'player_ready_changed'
        | 'countdown_started'
        | 'countdown_tick'
        | 'countdown_canceled'
        | 'room_dismissed'
        | 'game_started'
    roomId: string
    room: RoomInfo
    actorUserId?: string
    targetUserId?: string
    countdownSeconds?: number
    message?: string
    sentAt: Date
}
