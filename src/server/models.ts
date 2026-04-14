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

export interface StorageEntity {
    _id?: string
    userId: string
    data: Record<string, string>
    createdAt: Date
    updatedAt: Date
    version?: number
}

export interface SessionEntity {
    _id?: string
    tokenHash: string
    userId: string
    createdAt: Date
    lastSeenAt: Date
    expiresAt: Date
}
