import { ConnectionStatus, WsServer } from 'tsrpc';
import { ServiceType } from '../shared/protocols/serviceProto';

export class ConnectionRegistry {
    private readonly connIdToUserId = new Map<string, string>();
    private readonly userIdToConnIds = new Map<string, Set<string>>();

    constructor(private readonly server: WsServer<ServiceType>) {
    }

    bind(connId: string, userId: string) {
        this.unbind(connId);
        this.connIdToUserId.set(connId, userId);

        let connIds = this.userIdToConnIds.get(userId);
        if (!connIds) {
            connIds = new Set<string>();
            this.userIdToConnIds.set(userId, connIds);
        }

        connIds.add(connId);
    }

    unbind(connId: string) {
        const userId = this.connIdToUserId.get(connId);
        if (!userId) {
            return;
        }

        this.connIdToUserId.delete(connId);
        const connIds = this.userIdToConnIds.get(userId);
        if (!connIds) {
            return;
        }

        connIds.delete(connId);
        if (connIds.size === 0) {
            this.userIdToConnIds.delete(userId);
        }
    }

    isUserOnline(userId: string) {
        const connIds = this.userIdToConnIds.get(userId);
        if (!connIds?.size) {
            return false;
        }

        return this.server.connections.some(conn => {
            return connIds.has(conn.id) && conn.status === ConnectionStatus.Opened;
        });
    }

    clear() {
        this.connIdToUserId.clear();
        this.userIdToConnIds.clear();
    }
}
