export interface AccountEntity {
    _id?: string
    userId: string
    username: string
    displayName: string
    passwordSalt: string
    passwordHash: string
    createdAt: Date
    lastLoginAt: Date | null
}

export interface RoomEntity {
    _id?: string
    roomId: string
    name: string
    ownerUserId: string
    maxPlayers: number
    playerIds: string[]
    createdAt: Date
    updatedAt: Date
}
