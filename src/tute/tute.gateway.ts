import { Injectable, Logger } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import Game, { Card } from './game';
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TuteGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private games = new Map<string, Game>();

  private logger: Logger = new Logger('TuteGateway');

  afterInit() {
    this.logger.log('Socket.io initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('create-game')
  handleCreateGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() username: string,
  ): void {
    const room = this.server.sockets.adapter.rooms.get(username);
    if (room?.size >= 1) {
      this.logger.log('Room already exists: ' + username);
      client.emit('room-exists', username);
    } else {
      client.join(username);
      const newGame = new Game(username, client);
      this.games.set(username, newGame);
      this.logger.log('Created room: ' + username);
      this.emitGameState(username);
    }
  }

  @SubscribeMessage('join-game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { name, game }: { name: string; game: string },
  ): void {
    const room = this.server.sockets.adapter.rooms.get(game);
    if (room?.size >= 3) {
      this.logger.log('Room full: ' + game);
      client.emit('room-full', game);
    } else if (room?.size >= 1) {
      client.join(game);
      this.games.get(game).addPlayer(name, client);
      this.logger.log('Joined room: ' + game);
      this.emitGameState(game);
    } else {
      this.logger.log('Room does not exist: ' + game);
      client.emit('room-doesnt-exist', game);
    }
  }

  @SubscribeMessage('get-games')
  handleGetGames(@ConnectedSocket() client: Socket): void {
    const games = [];
    this.updateGames();
    for (const [key, value] of this.server.sockets.adapter.rooms) {
      if (value.size < 3 && this.games.has(key)) {
        games.push({
          name: key,
          players: value.size,
        });
      }
    }
    this.logger.log('Games: ' + games);
    client.emit('games', games);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomName: string,
  ): void {
    client.leave(roomName);
    client.emit('leftRoom', roomName);
  }

  @SubscribeMessage('play-card')
  handlePlayCard(
    @MessageBody()
    { card, game, player }: { card: Card; game: string; player: string },
  ) {
    const currentGame = this.games.get(game);
    currentGame?.playCard(player, card);
    currentGame && this.emitGameState(game);
  }

  private updateGames() {
    for (const game of Object.keys(this.games)) {
      if (!this.server.sockets.adapter.rooms.get(game)) {
        this.games.delete(game);
      }
    }
  }

  emitGameState(roomName: string) {
    const room = this.server.sockets.adapter.rooms.get(roomName);
    if (room) {
      const game = this.games.get(roomName);
      this.server.to(roomName).emit('waiting-for-players', {
        name: roomName,
        players: game.players.map((player) => player.name),
      });
      if (room.size === 3) {
        game.players.forEach((player) => {
          player.socket.emit('game-state', game.getGameState(player.name));
        });
      }
    }
  }
}
