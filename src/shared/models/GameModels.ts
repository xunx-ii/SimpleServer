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

export interface RoomPlayer {
    userId: string
    username: string
    displayName: string
    isOnline: boolean
}

export interface RoomInfo {
    roomId: string
    name: string
    ownerUserId: string
    maxPlayers: number
    playerCount: number
    players: RoomPlayer[]
    createdAt: Date
    updatedAt: Date
}
