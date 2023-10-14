import { Injectable } from '@nestjs/common'
import { Socket } from 'socket.io'

interface Player {
  name: string
  socket: Socket
}

@Injectable()
export class PlayerService {
  players: Map<string, Player> = new Map()

  register(name: string, socket: Socket) {
    if (this.players.has(name)) {
      throw new Error('Player already exists')
    }
    this.players.set(name, { name, socket })
  }

  unregisterSocket(socket: Socket) {
    this.players.forEach((player) => {
      if (player.socket.id === socket.id) {
        this.players.delete(player.name)
      }
    })
  }
}
