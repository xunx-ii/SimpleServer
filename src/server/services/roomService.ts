import { randomUUID } from 'crypto';
import { RoomInfo, RoomPlayer } from '../../shared/models/GameModels';
import { ConnectionRegistry } from '../connectionRegistry';
import { Database } from '../database';
import { RoomEntity } from '../models';
import { AccountService } from './accountService';

export class RoomService {
    constructor(
        private readonly database: Database,
        private readonly accounts: AccountService,
        private readonly connections: ConnectionRegistry
    ) {
    }

    async createRoom(token: string, input: { name: string, maxPlayers: number }) {
        const account = await this.accounts.requireAccount(token);
        await this.ensureUserNotInRoom(account.userId);

        const now = new Date();
        const room: RoomEntity = {
            roomId: randomUUID(),
            name: normalizeRoomName(input.name),
            ownerUserId: account.userId,
            maxPlayers: normalizeMaxPlayers(input.maxPlayers),
            playerIds: [account.userId],
            createdAt: now,
            updatedAt: now
        };

        const created = await this.database.rooms.insert(room);
        return this.toRoomInfo(created);
    }

    async joinRoom(token: string, roomId: string) {
        const account = await this.accounts.requireAccount(token);
        const currentRoom = await this.findRoomByPlayerId(account.userId);
        if (currentRoom && currentRoom.roomId !== roomId) {
            throw new Error('User already joined another room');
        }

        const room = await this.requireRoom(roomId);
        if (room.playerIds.includes(account.userId)) {
            return this.toRoomInfo(room);
        }

        if (room.playerIds.length >= room.maxPlayers) {
            throw new Error('Room is full');
        }

        const updatedRoom: RoomEntity = {
            ...room,
            playerIds: [...room.playerIds, account.userId],
            updatedAt: new Date()
        };

        await this.saveRoom(updatedRoom);
        return this.toRoomInfo(updatedRoom);
    }

    async leaveRoom(token: string, roomId?: string) {
        const account = await this.accounts.requireAccount(token);
        const room = roomId
            ? await this.requireRoom(roomId)
            : await this.findRoomByPlayerId(account.userId);

        if (!room || !room.playerIds.includes(account.userId)) {
            throw new Error('Room not found for current user');
        }

        const remainingPlayerIds = room.playerIds.filter(playerId => playerId !== account.userId);
        if (remainingPlayerIds.length === 0) {
            await this.database.rooms.remove({ roomId: room.roomId });
            return {
                room: null,
                removedRoomId: room.roomId
            };
        }

        const updatedRoom: RoomEntity = {
            ...room,
            ownerUserId: room.ownerUserId === account.userId ? remainingPlayerIds[0] : room.ownerUserId,
            playerIds: remainingPlayerIds,
            updatedAt: new Date()
        };

        await this.saveRoom(updatedRoom);
        return {
            room: await this.toRoomInfo(updatedRoom),
            removedRoomId: null
        };
    }

    async getRoom(roomId: string) {
        const room = await this.requireRoom(roomId);
        return this.toRoomInfo(room);
    }

    async listRooms() {
        const rooms = await this.database.rooms.findMany({});
        const sortedRooms = rooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return Promise.all(sortedRooms.map(room => this.toRoomInfo(room)));
    }

    async getMyRoom(token: string) {
        const account = await this.accounts.requireAccount(token);
        const room = await this.findRoomByPlayerId(account.userId);
        if (!room) {
            return null;
        }

        return this.toRoomInfo(room);
    }

    private async requireRoom(roomId: string) {
        const normalizedRoomId = roomId.trim();
        if (!normalizedRoomId) {
            throw new Error('Room id is required');
        }

        const room = await this.database.rooms.findOne({ roomId: normalizedRoomId });
        if (!room) {
            throw new Error('Room not found');
        }

        return room;
    }

    private async findRoomByPlayerId(userId: string) {
        const rooms = await this.database.rooms.findMany({ playerIds: userId });
        return rooms[0] ?? null;
    }

    private async ensureUserNotInRoom(userId: string) {
        const room = await this.findRoomByPlayerId(userId);
        if (room) {
            throw new Error('User already joined a room');
        }
    }

    private async saveRoom(room: RoomEntity) {
        await this.database.rooms.update(
            { roomId: room.roomId },
            {
                $set: {
                    name: room.name,
                    ownerUserId: room.ownerUserId,
                    maxPlayers: room.maxPlayers,
                    playerIds: room.playerIds,
                    updatedAt: room.updatedAt
                }
            }
        );
    }

    private async toRoomInfo(room: RoomEntity): Promise<RoomInfo> {
        const profiles = await this.accounts.getProfiles(room.playerIds);
        const players: RoomPlayer[] = room.playerIds.map(playerId => {
            const profile = profiles.get(playerId);

            return {
                userId: playerId,
                username: profile?.username ?? 'unknown',
                displayName: profile?.displayName ?? 'Unknown',
                isOnline: this.connections.isUserOnline(playerId)
            };
        });

        return {
            roomId: room.roomId,
            name: room.name,
            ownerUserId: room.ownerUserId,
            maxPlayers: room.maxPlayers,
            playerCount: players.length,
            players,
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
