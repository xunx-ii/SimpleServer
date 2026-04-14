import Datastore from 'nedb';

export class NeDbCollection<T extends Record<string, any>> {
    private readonly datastore: Datastore<T>;

    constructor(options: {
        filename?: string
        inMemoryOnly?: boolean
    }) {
        this.datastore = new Datastore<T>({
            filename: options.filename,
            autoload: false,
            inMemoryOnly: options.inMemoryOnly
        });
    }

    async init() {
        await new Promise<void>((resolve, reject) => {
            this.datastore.loadDatabase(err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    async ensureIndex(fieldName: keyof T | string, unique = false) {
        await new Promise<void>((resolve, reject) => {
            this.datastore.ensureIndex({ fieldName, unique }, err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    async findOne(query: Record<string, any>) {
        return new Promise<T | null>((resolve, reject) => {
            this.datastore.findOne(query, (err, document) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(document);
            });
        });
    }

    async findMany(query: Record<string, any>) {
        return new Promise<T[]>((resolve, reject) => {
            this.datastore.find(query, (err, documents) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(documents);
            });
        });
    }

    async insert(document: T) {
        return new Promise<T>((resolve, reject) => {
            this.datastore.insert(document, (err, newDocument) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(newDocument);
            });
        });
    }

    async update(
        query: Record<string, any>,
        updateQuery: Record<string, any>,
        options: {
            multi?: boolean
            upsert?: boolean
            returnUpdatedDocs?: boolean
        } = {}
    ) {
        return new Promise<{
            numAffected: number
            affectedDocuments?: T | T[] | null
            upsert?: boolean
        }>((resolve, reject) => {
            this.datastore.update(query, updateQuery, options, (err, numAffected, affectedDocuments, upsert) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    numAffected,
                    affectedDocuments,
                    upsert
                });
            });
        });
    }

    async remove(query: Record<string, any>, options: { multi?: boolean } = {}) {
        return new Promise<number>((resolve, reject) => {
            this.datastore.remove(query, options, (err, numRemoved) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(numRemoved);
            });
        });
    }
}
