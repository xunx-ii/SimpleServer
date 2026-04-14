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
