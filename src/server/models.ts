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
}
