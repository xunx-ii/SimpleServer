import { randomUUID } from 'crypto';
import { WsServer } from 'tsrpc';
import { RoomEvent, RoomInfo, RoomPlayer, RoomSyncMessage } from '../../shared/models/GameModels';
import { ServiceType } from '../../shared/protocols/serviceProto';
import { ConnectionRegistry } from '../connectionRegistry';
import { AccountService } from './accountService';

type CountdownTask = {
    endAt: Date
    interval: ReturnType<typeof setInterval>
    timeout: ReturnType<typeof setTimeout>
};

type RoomRuntime = {
    roomId: string
    name: string
    ownerUserId: string
    maxPlayers: number
    members: {
        userId: string
        isReady: boolean
        joinedAt: Date
    }[]
    state: 'open' | 'countdown' | 'playing'
    countdownEndAt: Date | null
    startedAt: Date | null
    createdAt: Date
    updatedAt: Date
    countdownTask?: CountdownTask
};

const COUNTDOWN_SECONDS = 3;

export class RoomService {
    private readonly rooms = new Map<string, RoomRuntime>();
    private readonly userIdToRoomId = new Map<string, string>();

    constructor(
        private readonly server: WsServer<ServiceType>,
        private readonly accounts: AccountService,
        private readonly connections: ConnectionRegistry
    ) {
    }

    dispose() {
        for (const room of this.rooms.values()) {
            this.clearCountdown(room);
        }

        this.rooms.clear();
        this.userIdToRoomId.clear();
    }

    async createRoom(token: string, input: { name: string, maxPlayers: number }, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        this.ensureUserNotInRoom(account.userId);

        const now = new Date();
        const room: RoomRuntime = {
            roomId: randomUUID(),
            name: normalizeRoomName(input.name),
            ownerUserId: account.userId,
            maxPlayers: normalizeMaxPlayers(input.maxPlayers),
            members: [
                {
                    userId: account.userId,
                    isReady: false,
                    joinedAt: now
                }
            ],
            state: 'open',
            countdownEndAt: null,
            startedAt: null,
            createdAt: now,
            updatedAt: now
        };

        this.rooms.set(room.roomId, room);
        this.userIdToRoomId.set(account.userId, room.roomId);

        await this.emitEventToUsers([account.userId], room, {
            type: 'room_created',
            actorUserId: account.userId
        });

        return this.toRoomInfo(room);
    }

    async joinRoom(token: string, roomId: string, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const currentRoomId = this.userIdToRoomId.get(account.userId);
        if (currentRoomId && currentRoomId !== roomId) {
            throw new Error('User already joined another room');
        }

        const room = this.requireRoom(roomId);
        if (room.state === 'playing') {
            throw new Error('Game already started');
        }

        if (currentRoomId === roomId) {
            return this.toRoomInfo(room);
        }

        if (room.members.length >= room.maxPlayers) {
            throw new Error('Room is full');
        }

        room.members.push({
            userId: account.userId,
            isReady: false,
            joinedAt: new Date()
        });
        room.updatedAt = new Date();
        this.userIdToRoomId.set(account.userId, room.roomId);

        await this.emitEventToRoom(room, {
            type: 'player_joined',
            actorUserId: account.userId
        });
        await this.emitEventToRoom(room, {
            type: 'player_count_changed',
            actorUserId: account.userId
        });
        await this.refreshCountdownState(room, 'A player joined the room');

        return this.toRoomInfo(room);
    }

    async leaveRoom(token: string, roomId?: string, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        return this.leaveRoomByUserId(account.userId, roomId);
    }

    async handleUserOffline(userId: string) {
        if (this.connections.isUserOnline(userId)) {
            return;
        }

        const roomId = this.userIdToRoomId.get(userId);
        if (!roomId) {
            return;
        }

        await this.leaveRoomByUserId(userId, roomId);
    }

    async getRoom(roomId: string) {
        const room = this.requireRoom(roomId);
        return this.toRoomInfo(room);
    }

    async listRooms() {
        const rooms = Array.from(this.rooms.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        return Promise.all(rooms.map(room => this.toRoomInfo(room)));
    }

    async getMyRoom(token: string, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const roomId = this.userIdToRoomId.get(account.userId);
        if (!roomId) {
            return null;
        }

        return this.toRoomInfo(this.requireRoom(roomId));
    }

    async setReady(token: string, isReady: boolean, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const room = this.requireRoomByUserId(account.userId);
        if (room.state === 'playing') {
            throw new Error('Game already started');
        }

        const member = room.members.find(v => v.userId === account.userId);
        if (!member) {
            throw new Error('Room member not found');
        }

        if (member.isReady === isReady) {
            return this.toRoomInfo(room);
        }

        member.isReady = isReady;
        room.updatedAt = new Date();

        await this.emitEventToRoom(room, {
            type: 'player_ready_changed',
            actorUserId: account.userId
        });
        await this.refreshCountdownState(room, 'Ready state changed');

        return this.toRoomInfo(room);
    }

    async sync(token: string, input: {
        payload: string
        kind?: string
        targetUserId?: string
    }, connId?: string) {
        const account = await this.accounts.requireAccount(token, connId);
        const room = this.requireRoomByUserId(account.userId);
        const targetUserId = input.targetUserId?.trim() || undefined;
        const deliveredUserIds = targetUserId
            ? [targetUserId]
            : room.members.map(member => member.userId);

        if (targetUserId && !room.members.some(member => member.userId === targetUserId)) {
            throw new Error('Target user is not in the room');
        }

        const message: RoomSyncMessage = {
            roomId: room.roomId,
            fromUserId: account.userId,
            fromUsername: account.username,
            fromDisplayName: account.displayName,
            toUserId: targetUserId ?? null,
            kind: input.kind,
            payload: input.payload,
            sentAt: new Date()
        };

        await this.sendSyncMessage(deliveredUserIds, message);

        return {
            roomId: room.roomId,
            deliveredUserIds
        };
    }

    private requireRoom(roomId: string) {
        const normalizedRoomId = roomId.trim();
        if (!normalizedRoomId) {
            throw new Error('Room id is required');
        }

        const room = this.rooms.get(normalizedRoomId);
        if (!room) {
            throw new Error('Room not found');
        }

        return room;
    }

    private requireRoomByUserId(userId: string) {
        const roomId = this.userIdToRoomId.get(userId);
        if (!roomId) {
            throw new Error('Current user is not in a room');
        }

        return this.requireRoom(roomId);
    }

    private ensureUserNotInRoom(userId: string) {
        if (this.userIdToRoomId.has(userId)) {
            throw new Error('User already joined a room');
        }
    }

    private async leaveRoomByUserId(userId: string, roomId?: string) {
        const room = roomId
            ? this.requireRoom(roomId)
            : this.requireRoomByUserId(userId);

        if (!room.members.some(member => member.userId === userId)) {
            throw new Error('Room not found for current user');
        }

        this.userIdToRoomId.delete(userId);
        room.members = room.members.filter(member => member.userId !== userId);
        room.updatedAt = new Date();

        if (room.members.length === 0) {
            this.clearCountdown(room);
            this.rooms.delete(room.roomId);
            return {
                room: null,
                removedRoomId: room.roomId
            };
        }

        if (room.ownerUserId === userId) {
            room.ownerUserId = room.members[0].userId;
        }

        await this.emitEventToRoom(room, {
            type: 'player_left',
            actorUserId: userId
        });
        await this.emitEventToRoom(room, {
            type: 'player_count_changed',
            actorUserId: userId
        });
        await this.refreshCountdownState(room, 'A player left the room');

        return {
            room: await this.toRoomInfo(room),
            removedRoomId: null
        };
    }

    private async refreshCountdownState(room: RoomRuntime, reason: string) {
        if (room.state === 'playing') {
            return;
        }

        const allReady = room.members.length > 0 && room.members.every(member => member.isReady);
        if (allReady) {
            if (room.state !== 'countdown') {
                await this.startCountdown(room);
            }
            return;
        }

        if (room.state === 'countdown') {
            await this.cancelCountdown(room, reason);
        }
    }

    private async startCountdown(room: RoomRuntime) {
        room.state = 'countdown';
        room.updatedAt = new Date();
        room.countdownEndAt = new Date(Date.now() + COUNTDOWN_SECONDS * 1000);

        await this.emitEventToRoom(room, {
            type: 'countdown_started',
            countdownSeconds: COUNTDOWN_SECONDS
        });

        const endAt = room.countdownEndAt;
        const interval = setInterval(() => {
            void this.emitCountdownTick(room.roomId, endAt);
        }, 1000);
        const timeout = setTimeout(() => {
            void this.startGame(room.roomId, endAt);
        }, COUNTDOWN_SECONDS * 1000);

        room.countdownTask = {
            endAt,
            interval,
            timeout
        };
    }

    private async cancelCountdown(room: RoomRuntime, reason: string) {
        this.clearCountdown(room);
        room.state = 'open';
        room.countdownEndAt = null;
        room.updatedAt = new Date();

        await this.emitEventToRoom(room, {
            type: 'countdown_canceled',
            message: reason
        });
    }

    private async emitCountdownTick(roomId: string, endAt: Date) {
        const room = this.rooms.get(roomId);
        if (!room || room.state !== 'countdown' || room.countdownTask?.endAt.getTime() !== endAt.getTime()) {
            return;
        }

        const remainingSeconds = Math.ceil((endAt.getTime() - Date.now()) / 1000);
        if (remainingSeconds > 0) {
            await this.emitEventToRoom(room, {
                type: 'countdown_tick',
                countdownSeconds: remainingSeconds
            });
        }
    }

    private async startGame(roomId: string, endAt: Date) {
        const room = this.rooms.get(roomId);
        if (!room || room.state !== 'countdown' || room.countdownTask?.endAt.getTime() !== endAt.getTime()) {
            return;
        }

        this.clearCountdown(room);
        room.state = 'playing';
        room.startedAt = new Date();
        room.countdownEndAt = null;
        room.updatedAt = new Date();

        await this.emitEventToRoom(room, {
            type: 'game_started'
        });
    }

    private clearCountdown(room: RoomRuntime) {
        if (!room.countdownTask) {
            return;
        }

        clearInterval(room.countdownTask.interval);
        clearTimeout(room.countdownTask.timeout);
        room.countdownTask = undefined;
    }

    private async emitEventToRoom(
        room: RoomRuntime,
        event: Omit<RoomEvent, 'roomId' | 'room' | 'sentAt'>
    ) {
        await this.emitEventToUsers(
            room.members.map(member => member.userId),
            room,
            event
        );
    }

    private async emitEventToUsers(
        userIds: string[],
        room: RoomRuntime,
        event: Omit<RoomEvent, 'roomId' | 'room' | 'sentAt'>
    ) {
        const conns = this.connections.getConnectionsByUserIds(userIds);
        if (!conns.length) {
            return;
        }

        const message: RoomEvent = {
            ...event,
            roomId: room.roomId,
            room: await this.toRoomInfo(room),
            sentAt: new Date()
        };

        await this.server.broadcastMsg('Room/Event', message, conns);
    }

    private async sendSyncMessage(userIds: string[], message: RoomSyncMessage) {
        const conns = this.connections.getConnectionsByUserIds(userIds);
        if (!conns.length) {
            return;
        }

        await this.server.broadcastMsg('Room/Sync', message, conns);
    }

    private async toRoomInfo(room: RoomRuntime): Promise<RoomInfo> {
        const profiles = await this.accounts.getProfiles(room.members.map(member => member.userId));
        const players: RoomPlayer[] = room.members.map(member => {
            const profile = profiles.get(member.userId);

            return {
                userId: member.userId,
                username: profile?.username ?? 'unknown',
                displayName: profile?.displayName ?? 'Unknown',
                isOnline: this.connections.isUserOnline(member.userId),
                isReady: member.isReady
            };
        });

        return {
            roomId: room.roomId,
            name: room.name,
            ownerUserId: room.ownerUserId,
            maxPlayers: room.maxPlayers,
            state: room.state,
            playerCount: players.length,
            players,
            countdownEndAt: room.countdownEndAt,
            startedAt: room.startedAt,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt
        };
    }
}

function normalizeRoomName(name: string) {
    const normalized = name.trim();
    if (normalized.length < 1 || normalized.length > 32) {
        throw new Error('Room name must be 1-32 characters');
    }

    return normalized;
}

function normalizeMaxPlayers(maxPlayers: number) {
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
        throw new Error('Max players must be an integer between 2 and 8');
    }

    return maxPlayers;
}
