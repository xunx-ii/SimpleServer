declare module 'nedb' {
    class Datastore<T extends Record<string, any> = Record<string, any>> {
        constructor(options?: {
            filename?: string
            autoload?: boolean
            inMemoryOnly?: boolean
            timestampData?: boolean
        })

        loadDatabase(callback?: (err: Error | null) => void): void

        ensureIndex(
            options: {
                fieldName: keyof T | string
                unique?: boolean
                sparse?: boolean
                expireAfterSeconds?: number
            },
            callback?: (err: Error | null) => void
        ): void

        findOne(
            query: Record<string, any>,
            callback: (err: Error | null, document: T | null) => void
        ): void

        find(
            query: Record<string, any>,
            callback: (err: Error | null, documents: T[]) => void
        ): void

        insert(document: T, callback: (err: Error | null, newDocument: T) => void): void

        update(
            query: Record<string, any>,
            updateQuery: Record<string, any>,
            options: {
                multi?: boolean
                upsert?: boolean
                returnUpdatedDocs?: boolean
            },
            callback: (
                err: Error | null,
                numAffected: number,
                affectedDocuments?: T | T[] | null,
                upsert?: boolean
            ) => void
        ): void

        remove(
            query: Record<string, any>,
            options: {
                multi?: boolean
            },
            callback: (err: Error | null, numRemoved: number) => void
        ): void
    }

    export = Datastore
}
