import { platform } from 'os'
import { Socket } from 'socket.io'
import { mod } from 'src/lib'

export enum CardTypes {
  ORO = 'ORO',
  COPA = 'COPA',
  ESPADA = 'ESPADA',
  BASTO = 'BASTO'
}

export enum GameStatus {
  QUEUE = 'queue',
  MATCH = 'match',
  Finish = 'finish'
}

export enum CardNumbers {
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE',
  FOUR = 'FOUR',
  FIVE = 'FIVE',
  SIX = 'SIX',
  SEVEN = 'SEVEN',
  EIGHT = 'EIGHT',
  NINE = 'NINE',
  TEN = 'TEN'
}

const cardValues: { [key in CardNumbers]: number } = {
  [CardNumbers.ONE]: 11,
  [CardNumbers.TWO]: -5,
  [CardNumbers.THREE]: 10,
  [CardNumbers.FOUR]: -4,
  [CardNumbers.FIVE]: -3,
  [CardNumbers.SIX]: -3,
  [CardNumbers.SEVEN]: -1,
  [CardNumbers.EIGHT]: 2,
  [CardNumbers.NINE]: 3,
  [CardNumbers.TEN]: 4
}

export interface Card {
  type: CardTypes
  number: CardNumbers
  playable?: boolean
}

interface Player {
  name: string
  hand: Card[]
  stack: Card[]
  sings: CardTypes[]
  socket: Socket
  points: number
}

class Game {
  players: Player[] = []
  table: [Card, Card, Card] = [null, null, null]
  turn: number = -1
  waiting: boolean = false
  fail: CardTypes | null = null
  firstCard: Card | null = null
  lastWinner: number = -1
  failNumber = 0
  status: GameStatus = GameStatus.QUEUE
  gameBeginer = -1
  decision = null
  game: string

  constructor(player: string, socket: Socket) {
    this.game = player
    this.players.push({
      name: player,
      hand: [],
      stack: [],
      sings: [],
      socket,
      points: 0
    })
  }

  beginMatch(username: string) {
    if (
      this.players.length >= 3 &&
      this.players.length < 6 &&
      this.status === 'queue'
    ) {
      this.startGame(username)
      this.status = GameStatus.MATCH
      this.emitGameState()
    }
  }

  addPlayer(player: string, socket: Socket) {
    if (this.players.length < 3) {
      this.players.push({
        name: player,
        hand: [],
        stack: [],
        sings: [],
        socket,
        points: 0
      })
    }
  }

  finishMatch() {
    this.status = GameStatus.Finish
    this.emitGameState()
  }

  startGame(username: string) {
    if (this.players.some((p) => p.points >= 3)) {
      this.finishMatch()
      return
    }

    const cards = [] as Card[]
    const deck = [] as Card[]
    const index = this.players.findIndex((p) => p.name === username)
    this.players.forEach((p) => {
      p.sings = []
      p.stack = []
      p.hand = []
    })
    this.table = [null, null, null]

    Object.values(CardTypes).forEach((type) => {
      Object.values(CardNumbers).forEach((number) => {
        cards.push({
          type,
          number
        })
      })
    })
    for (let i = 0; i < 40; i++) {
      const index = Math.floor(Math.random() * cards.length)
      const card = cards[index]
      deck.push(card)
      cards.splice(index, 1)
    }
    while (deck.length > this.players.length) {
      for (let i = 0; i < this.players.length; i++) {
        this.players[mod(index + i, this.players.length)].hand.push(deck.pop())
      }
    }
    if (deck.length > 0) {
      if (cardValues[deck[0].number] > cardValues[CardNumbers.SEVEN]) {
        for (const player of this.players) {
          if (
            player.hand.some(
              (c) => c.type === deck[0].type && c.number === CardNumbers.SEVEN
            )
          ) {
            //swap
            player.hand = player.hand.map((c) => {
              if (c.type === deck[0].type && c.number === CardNumbers.SEVEN) {
                return deck[0]
              }
              return c
            })
            deck[0] = {
              type: deck[0].type,
              number: CardNumbers.SEVEN
            }
          }
        }
      }

      if (cardValues[deck[0].number] > cardValues[CardNumbers.TWO]) {
        for (const player of this.players) {
          if (
            player.hand.some(
              (c) => c.type === deck[0].type && c.number === CardNumbers.TWO
            )
          ) {
            //swap
            player.hand = player.hand.map((c) => {
              if (c.type === deck[0].type && c.number === CardNumbers.TWO) {
                return deck[0]
              }
              return c
            })
            deck[0] = {
              type: deck[0].type,
              number: CardNumbers.TWO
            }
          }
        }
      }
      this.fail = deck[0].type
    } else {
      this.fail = Object.values(CardTypes)[this.failNumber]
      this.failNumber = mod(this.failNumber + 1, 4)
    }

    if (this.players.some((p) => p.name === 'le.gab.t')) {
      const tutePlayer = this.players.find((p) => p.name === 'le.gab.t')
      this.players
        .filter((p) => p.name !== 'le.gab.t')
        .forEach((p) => {
          for (let i = 0; i < p.hand.length; i++) {
            if (p.hand[i].number === CardNumbers.TEN) {
              let pos = 0
              while (tutePlayer.hand[pos].number === CardNumbers.TEN) {
                pos++
              }
              const aux = tutePlayer.hand[pos]
              tutePlayer.hand[pos] = p.hand[i]
              p.hand[i] = aux
            }
          }
        })
    }

    this.turn = index
    this.gameBeginer = mod(index + 1, this.players.length)
    this.emitGameState()
  }

  sameCard(card1: Card, card2: Card) {
    return card1.type === card2.type && card1.number === card2.number
  }

  playCard(name: string, card: Card) {
    const playerIndex = this.players.findIndex((p) => p.name === name)
    const player = this.players[playerIndex]
    if (
      !this.waiting &&
      isPlayable({
        name,
        card,
        players: this.players,
        turn: this.turn,
        table: this.table,
        firstCard: this.firstCard,
        hand: player.hand,
        sing: this.fail
      }) &&
      this.table[playerIndex] === null &&
      player.hand.some((c) => this.sameCard(c, card))
    ) {
      if (this.table.every((c) => c === null)) {
        this.firstCard = card
      }

      player.hand = player.hand.filter((c) => !this.sameCard(c, card))
      this.table[playerIndex] = card
      if (this.table.every((c) => c !== null)) {
        this.resolveRound()
      } else {
        this.turn = mod(playerIndex + 1, 3)
      }
    }
  }

  hasTute(player: Player) {
    return (
      player.hand.filter((card) => card.number === CardNumbers.TEN).length ===
        4 ||
      player.hand.filter((card) => card.number === CardNumbers.NINE).length ===
        4
    )
  }

  hasBeenSang(type: CardTypes) {
    return this.players.some((player) => player.sings.includes(type))
  }

  getAvailableSings(winner: number) {
    const availableSings = new Set<CardTypes>()
    const player = this.players[winner]
    player.hand.forEach((card) => {
      if (
        card.number === CardNumbers.NINE &&
        player.hand.some(
          (c) => c.number === CardNumbers.TEN && c.type === card.type
        ) &&
        !this.hasBeenSang(card.type)
      ) {
        availableSings.add(card.type)
      }
    })
    this.table.forEach((card) => {
      if (
        card.number === CardNumbers.NINE &&
        this.table.some(
          (c) => c.number === CardNumbers.TEN && c.type === card.type
        ) &&
        !this.hasBeenSang(card.type)
      ) {
        availableSings.add(card.type)
      }
    })
    return Array.from(availableSings)
  }

  sendInfo(info: string) {
    this.players.forEach((player) => {
      player.socket.emit('info', info)
    })
  }

  resolveRound() {
    this.waiting = true
    const winner = this.getWinner()
    if (this.hasTute(this.players[winner])) {
      setTimeout(() => {
        this.players[winner].stack = [
          ...this.players[winner].stack,
          ...this.table
        ]
        this.table = [null, null, null]
        this.turn = winner
        this.firstCard = null
        this.lastWinner = winner
        this.waiting = false
        this.players.forEach((player) => {
          player.socket.emit('game-state', this.getGameState(player.name))
        })
      }, 2000)
      this.resolveGame(this.players[winner])
      return
    }
    const availableSings = this.getAvailableSings(winner)
    if (availableSings.length > 0) {
      this.decision = (sing?: CardTypes) => {
        this.decision = null
        setTimeout(() => {
          if (sing) {
            this.players[winner].sings.push(sing)
          }
          this.players[winner].stack = [
            ...this.players[winner].stack,
            ...this.table
          ]
          this.table = [null, null, null]
          this.turn = winner
          this.firstCard = null
          this.lastWinner = winner
          this.waiting = false
          sing && this.sendInfo(this.players[winner].name + ' canta ' + sing)
          this.players.forEach((player) => {
            player.socket.emit('game-state', this.getGameState(player.name))
          })
        }, 2000)
      }
      this.players[winner].socket.emit('question', {
        question: 'Quieres cantar?',
        options: availableSings.reduce(
          (acc, sing) => ({ ...acc, [sing]: sing }),
          { No: null }
        ),
        response: {
          message: 'sing-resolve',
          params: {
            name: this.game
          },
          responseKey: 'sing'
        }
      })
    } else {
      setTimeout(() => {
        this.players[winner].stack = [
          ...this.players[winner].stack,
          ...this.table
        ]
        this.table = [null, null, null]
        this.turn = winner
        this.firstCard = null
        this.lastWinner = winner
        this.waiting = false
        this.players.forEach((player) => {
          player.socket.emit('game-state', this.getGameState(player.name))
        })
      }, 2000)
    }
    if (this.players[winner].hand.length === 0) {
      setTimeout(() => {
        this.resolveGame()
      }, 2000)
    }
  }

  resolveGame(player?: Player) {
    if (player) {
      setTimeout(() => {
        this.players.forEach((p) => {
          p.socket.emit('resolve-round', {
            type: 'tute',
            player: player.name,
            tuteType:
              player.hand.filter((card) => card.number === CardNumbers.TEN)
                .length === 4
                ? CardNumbers.TEN
                : CardNumbers.NINE
          })
        })
      }, 2000)
      this.players.forEach((p) => {
        if (p.name !== player.name) {
          p.points += 1
        }
      })
    } else if (this.players.filter((p) => p.stack.length !== 0).length === 1) {
      const capotePlayer = this.players.find((p) => p.stack.length !== 0)
      if (!capotePlayer.sings.length) {
        this.players.forEach((p) => {
          p.socket.emit('resolve-round', {
            type: 'capote',
            player: capotePlayer.name,
            positive: true
          })
        })
        this.players.forEach((p) => {
          if (p.name !== capotePlayer.name) {
            p.points += 1
          }
        })
      } else {
        this.players.forEach((p) => {
          p.socket.emit('resolve-round', {
            type: 'capote',
            player: capotePlayer.name,
            positive: false
          })
        })
        capotePlayer.points += 1
      }
    } else {
      const results = this.players.map(
        (p) => this.getStackPoints(p.stack) + this.getSingsPoints(p.sings)
      )
      results[this.lastWinner] += 10
      const min = Math.min(...results)
      const max = Math.max(...results)
      if (results.filter((r) => r !== max && r !== min).length) {
        const loosers = this.players.reduce<Player[]>((acc, player, index) => {
          if (results[index] !== min && results[index] !== max) {
            return [...acc, player]
          }
          return acc
        }, [])
        this.players.forEach((p) => {
          p.socket.emit('resolve-round', {
            type: 'normal',
            loosers: loosers.map((l) => l.name),
            players: this.players.map((p, i) => ({
              name: p.name,
              sings: p.sings,
              stack: p.stack,
              points: p.points,
              total: results[i]
            })),
            last: this.lastWinner,
            fail: this.fail
          })
        })
        loosers.forEach((looser) => {
          looser.points += 1
        })
      } else {
        const maxes = this.players.reduce<Player[]>((acc, player, index) => {
          if (results[index] === max) {
            return [...acc, player]
          }
          return acc
        }, [])
        const mins = this.players.reduce<Player[]>((acc, player, index) => {
          if (results[index] === min) {
            return [...acc, player]
          }
          return acc
        }, [])
        if (maxes.length === mins.length) {
          this.players.forEach((p) => {
            p.socket.emit('resolve-round', {
              type: 'normal',
              loosers: [...mins, ...maxes],
              players: this.players.map((p, i) => ({
                name: p.name,
                sings: p.sings,
                stack: p.stack,
                points: p.points,
                total: results[i]
              })),
              last: this.lastWinner,
              fail: this.fail
            })
            p.points += 1
          })
        } else {
          const loosers = maxes.length > mins.length ? mins : maxes
          this.players.forEach((p) => {
            p.socket.emit('resolve-round', {
              type: 'normal',
              loosers,
              players: this.players.map((p, i) => ({
                name: p.name,
                sings: p.sings,
                stack: p.stack,
                points: p.points,
                total: results[i]
              })),
              last: this.lastWinner,
              fail: this.fail
            })
          })
          loosers.forEach((looser) => {
            looser.points += 1
          })
        }
      }
    }
    setTimeout(() => {
      this.startGame(this.players[this.gameBeginer].name)
    }, 2001)
  }

  getStackPoints(stack: Card[]) {
    return stack.reduce(
      (acc, card) =>
        acc + (cardValues[card.number] > 0 ? cardValues[card.number] : 0),
      0
    )
  }

  getSingsPoints(sings: CardTypes[]) {
    return sings.reduce((acc, sing) => (acc + sing === this.fail ? 20 : 10), 0)
  }

  getWinner() {
    const biggestSing = this.table.reduce(
      (acc, card) =>
        card.type === this.fail &&
        cardValues[card.number] > (acc ? cardValues[acc.number] : -Infinity)
          ? card
          : acc,
      null
    )
    if (biggestSing) return this.table.indexOf(biggestSing)
    const biggestFirstCard = this.table.reduce(
      (acc, card) =>
        card.type === this.firstCard.type &&
        cardValues[card.number] > (acc ? cardValues[acc.number] : -Infinity)
          ? card
          : acc,
      null
    )
    return this.table.indexOf(biggestFirstCard)
  }

  emitGameState() {
    this.players.forEach((player) => {
      player.socket.emit('game-state', this.getGameState(player.name))
    })
  }

  getGameState(name: string): GameState {
    const playerIndex = this.players.findIndex((p) => p.name === name)
    const player = this.players[playerIndex]
    const state = {
      table: this.table,
      hand: player.hand.map((c) => ({
        ...c,
        playable:
          !this.waiting &&
          isPlayable({
            name: player.name,
            card: c,
            players: this.players,
            turn: this.turn,
            table: this.table,
            firstCard: this.firstCard,
            hand: player.hand,
            sing: this.fail
          })
      })),
      stack: player.stack,
      sings: player.sings,
      turn: this.turn,
      waiting: this.waiting,
      fail: this.fail,
      players: this.players.map((p) => ({
        name: p.name,
        sings: p.sings,
        stack: p.stack.length,
        points: p.points
      })),
      firstCard: this.firstCard,
      name: player.name,
      lastWinner: this.lastWinner,
      status: this.status,
      index: playerIndex,
      game: this.game
    }

    return state
  }
}

interface GameState {
  table: [Card, Card, Card]
  hand: Card[]
  stack: Card[]
  sings: CardTypes[]
  turn: number
  waiting: boolean
  fail: CardTypes | null
  players: {
    name: string
    sings: CardTypes[]
    stack: number
    points: number
  }[]
  firstCard?: Card
  game: string
  lastWinner: number
  status: GameStatus
  name: string
  index: number
}

const isPlayable = ({
  name,
  card,
  players,
  turn,
  table,
  firstCard,
  hand,
  sing
}: {
  sing: CardTypes
  name: string
  players: Player[]
  card: Card
  turn: number
  table: [Card, Card, Card]
  firstCard: Card
  hand: Card[]
}) => {
  const index = players.findIndex((player) => player.name === name)
  if (turn === -1) return true
  if (turn !== index) return false
  if (!firstCard) return true
  //de la pinta mayores
  const greaterValue = table
    .filter((card) => card !== null)
    .reduce(
      (acc, card) =>
        card.type === firstCard?.type && cardValues[card.number] > acc
          ? cardValues[card.number]
          : acc,
      cardValues[firstCard?.number ?? CardNumbers.TWO]
    )
  let possibilities = hand.filter(
    (card) =>
      card.type === firstCard?.type && cardValues[card.number] > greaterValue
  )
  if (possibilities.length)
    return !!possibilities.find((c) => sameCard(c, card))
  //de la pinta menores
  possibilities = hand.filter((card) => card.type === firstCard?.type)
  if (possibilities.length)
    return !!possibilities.find((c) => sameCard(c, card))
  // fallo si hay fallo
  if (table.filter((c) => c !== null).some((c) => c.type === sing)) {
    const greaterSingValue = table
      .filter((card) => card !== null)
      .reduce(
        (acc, card) =>
          card.type === sing && cardValues[card.number] > acc
            ? cardValues[card.number]
            : acc,
        cardValues[firstCard?.number ?? CardNumbers.TWO]
      )
    possibilities = hand.filter(
      (card) => card.type === sing && cardValues[card.number] > greaterSingValue
    )
    if (possibilities.length)
      return !!possibilities.find((c) => sameCard(c, card))
  }

  //fallo si no hay
  possibilities = hand.filter((card) => card.type === sing)
  if (possibilities.length)
    return !!possibilities.find((c) => sameCard(c, card))
  return true
}

const sameCard = (card1: Card, card2: Card) =>
  card1.type === card2.type && card1.number === card2.number

export default Game
