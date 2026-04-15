import { ConnectionStatus, WsConnection, WsServer } from 'tsrpc';
import { ServiceType } from '../shared/protocols/serviceProto';

export class ConnectionRegistry {
    private readonly connIdToConn = new Map<string, WsConnection<ServiceType>>();
    private readonly connIdToUserId = new Map<string, string>();
    private readonly userIdToConnIds = new Map<string, Set<string>>();

    constructor(private readonly server: WsServer<ServiceType>) {
    }

    registerConnection(conn: WsConnection<ServiceType>) {
        this.connIdToConn.set(conn.id, conn);
    }

    bind(connId: string, userId: string) {
        if (this.connIdToUserId.get(connId) === userId) {
            return;
        }

        this.unbind(connId);
        this.connIdToUserId.set(connId, userId);

        let connIds = this.userIdToConnIds.get(userId);
        if (!connIds) {
            connIds = new Set<string>();
            this.userIdToConnIds.set(userId, connIds);
        }

        connIds.add(connId);
    }

    unregisterConnection(connId: string) {
        this.connIdToConn.delete(connId);
        return this.unbind(connId);
    }

    unbind(connId: string) {
        const userId = this.connIdToUserId.get(connId);
        if (!userId) {
            return undefined;
        }

        this.connIdToUserId.delete(connId);
        const connIds = this.userIdToConnIds.get(userId);
        if (!connIds) {
            return userId;
        }

        connIds.delete(connId);
        if (connIds.size === 0) {
            this.userIdToConnIds.delete(userId);
        }

        return userId;
    }

    getUserId(connId: string) {
        return this.connIdToUserId.get(connId);
    }

    isUserOnline(userId: string) {
        return !!this.userIdToConnIds.get(userId)?.size;
    }

    getConnectionsByUserIds(userIds: Iterable<string>) {
        const userIdSet = new Set(userIds);
        if (!userIdSet.size) {
            return [];
        }

        const connections: WsConnection<ServiceType>[] = [];
        const seenConnIds = new Set<string>();

        for (const userId of userIdSet) {
            const connIds = this.userIdToConnIds.get(userId);
            if (!connIds?.size) {
                continue;
            }

            for (const connId of connIds) {
                if (seenConnIds.has(connId)) {
                    continue;
                }

                const conn = this.connIdToConn.get(connId);
                if (!conn || conn.status !== ConnectionStatus.Opened) {
                    continue;
                }

                seenConnIds.add(connId);
                connections.push(conn);
            }
        }

        return connections;
    }

    getOnlineUserIds() {
        return Array.from(this.userIdToConnIds.keys());
    }

    getBoundConnectionCount() {
        return this.connIdToUserId.size;
    }

    getOpenedConnectionCount() {
        return this.connIdToConn.size;
    }

    clear() {
        this.connIdToConn.clear();
        this.connIdToUserId.clear();
        this.userIdToConnIds.clear();
    }
}
