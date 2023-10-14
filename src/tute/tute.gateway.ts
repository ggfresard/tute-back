import { Injectable, Logger } from '@nestjs/common'
import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets'

import { Server, Socket } from 'socket.io'
import Game, { Card, CardTypes } from './game'
import { PlayerService } from './player/player.service'
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class TuteGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server

  private games = new Map<string, Game>()

  private logger: Logger = new Logger('TuteGateway')

  constructor(private readonly players: PlayerService) {}

  afterInit() {
    this.logger.log('Socket.io initialized')
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
    this.players.unregisterSocket(client)
    this.updateGames()
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() username: string
  ): void {
    try {
      this.players.register(username, client)
      client.emit('joined', username)
      this.games.forEach((game) => {
        if (game.players.some((player) => player.name === username)) {
          game.players.find((player) => player.name === username).socket =
            client
          this.recoverGame(username, game)
          client.join(game.game)
        }
      })
    } catch (e) {
      client.emit('join-error', e.message)
    }
  }

  @SubscribeMessage('create-game')
  handleCreateGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() username: string
  ): void {
    const room = this.server.sockets.adapter.rooms.get(username)
    if (room?.size >= 1) {
      this.logger.log('Room already exists: ' + username)
      client.emit('room-exists', username)
    } else {
      client.join(username)
      const newGame = new Game(username, client)
      this.games.set(username, newGame)
      this.logger.log('Created room: ' + username)
      this.emitAvailableGames()
      this.emitLobby(username)
    }
  }

  @SubscribeMessage('join-game')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { name, game }: { name: string; game: string }
  ): void {
    const room = this.server.sockets.adapter.rooms.get(game)
    if (room?.size >= 5) {
      this.logger.log('Room full: ' + game)
      client.emit('room-full', game)
    } else if (room?.size >= 1) {
      client.join(game)
      this.games.get(game).addPlayer(name, client)
      this.logger.log('Joined room: ' + game)
      this.emitLobby(game)
      this.emitGameState(game)
      this.emitAvailableGames()
    } else {
      this.logger.log('Room does not exist: ' + game)
      client.emit('room-doesnt-exist', game)
    }
  }

  @SubscribeMessage('begin-match')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { username, game }: { username: string; game: string }
  ): void {
    const room = this.server.sockets.adapter.rooms.get(game)
    if (room?.size >= 3) {
      const currentGame = this.games.get(game)
      currentGame?.beginMatch(username)
    }
  }

  @SubscribeMessage('sing-resolve')
  handleSingResolve(
    @MessageBody() { name, sing }: { name: string; sing: CardTypes }
  ) {
    const currentGame = this.games.get(name)
    currentGame?.decision && currentGame.decision(sing)
  }

  @SubscribeMessage('get-games')
  handleGetGames(@ConnectedSocket() client: Socket): void {
    this.updateGames()
    const games = this.getAvailableGames()

    this.logger.log('Games: ' + games)
    client.emit('games', games)
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomName: string
  ): void {
    client.leave(roomName)
    client.emit('leftRoom', roomName)
  }

  @SubscribeMessage('play-card')
  handlePlayCard(
    @MessageBody()
    { card, game, player }: { card: Card; game: string; player: string }
  ) {
    const currentGame = this.games.get(game)
    this.logger.log(card)
    currentGame?.playCard(player, card)
    currentGame && this.emitGameState(game)
  }

  private updateGames() {
    for (const game of this.games.keys()) {
      if (!this.server.sockets.adapter.rooms.get(game)?.size) {
        this.logger.log('Deleting game: ' + game)
        this.games.delete(game)
      }
    }
  }

  emitLobby = (roomName: string) => {
    const room = this.server.sockets.adapter.rooms.get(roomName)
    if (room) {
      const game = this.games.get(roomName)
      this.server.to(roomName).emit('waiting-for-players', {
        name: roomName,
        players: game.players.map((player) => player.name)
      })
    }
  }

  emitGameState(roomName: string) {
    const room = this.server.sockets.adapter.rooms.get(roomName)
    if (room) {
      const game = this.games.get(roomName)
      if (room.size >= 3) {
        game.players.forEach((player) => {
          player.socket.emit('game-state', game.getGameState(player.name))
        })
      }
    }
  }

  emitAvailableGames() {
    const games = this.getAvailableGames()
    this.server.emit('games', games)
  }

  getAvailableGames() {
    const games: {
      name: string
      players: number
    }[] = []
    for (const [key, value] of this.server.sockets.adapter.rooms) {
      if (value.size < 5 && this.games.has(key)) {
        games.push({
          name: key,
          players: value.size
        })
      }
    }
    return games
  }

  recoverGame(username: string, game: Game) {
    game.players
      .find((player) => player.name === username)
      .socket.emit('recover-game', game.getGameState(username))
  }
}
