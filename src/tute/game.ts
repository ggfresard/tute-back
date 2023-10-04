import { Socket } from 'socket.io';

export enum CardTypes {
  ORO = 'ORO',
  COPA = 'COPA',
  ESPADA = 'ESPADA',
  BASTO = 'BASTO',
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
  TEN = 'TEN',
}

export function startGame() {
  const deck = [] as Card[];
  Object.values(CardTypes).forEach((type) => {
    Object.values(CardNumbers).forEach((number) => {
      deck.push({
        type,
        number,
      });
    });
  });
  console.log(deck);
}
// const cardRows: { [key in CardTypes]: number } = {
//   [CardTypes.ORO]: 1,
//   [CardTypes.COPA]: 2,
//   [CardTypes.ESPADA]: 3,
//   [CardTypes.BASTO]: 4,
// };

const getNumber: { [key in CardNumbers]: number } = {
  [CardNumbers.ONE]: 1,
  [CardNumbers.TWO]: 2,
  [CardNumbers.THREE]: 3,
  [CardNumbers.FOUR]: 4,
  [CardNumbers.FIVE]: 5,
  [CardNumbers.SIX]: 6,
  [CardNumbers.SEVEN]: 7,
  [CardNumbers.EIGHT]: 10,
  [CardNumbers.NINE]: 11,
  [CardNumbers.TEN]: 12,
};

export interface Card {
  type: CardTypes;
  number: CardNumbers;
}

interface Player {
  name: string;
  hand: Card[];
  stack: Card[];
  sings: CardTypes[];
  socket: Socket;
}

class Game {
  players: Player[] = [];
  table: [Card, Card, Card] = [null, null, null];
  turn: number = -1;
  waiting: boolean = false;
  sing: CardTypes | null = null;

  constructor(player: string, socket: Socket) {
    this.players.push({
      name: player,
      hand: [],
      stack: [],
      sings: [],
      socket,
    });
  }

  addPlayer(player: string, socket: Socket) {
    if (this.players.length < 3) {
      this.players.push({
        name: player,
        hand: [],
        stack: [],
        sings: [],
        socket,
      });
    }
    if (this.players.length === 3) {
      this.startGame();
    }
  }

  startGame() {
    const deck = [] as Card[];
    Object.values(CardTypes).forEach((type) => {
      Object.values(CardNumbers).forEach((number) => {
        deck.push({
          type,
          number,
        });
      });
    });
    for (let i = 0; i < 13; i++) {
      this.players.forEach((player) => {
        const index = Math.floor(Math.random() * deck.length);
        const card = deck[index];
        player.hand.push(card);
        deck.splice(deck.indexOf(card), 1);
      });
    }
    if (getNumber[deck[0].number] > 7) {
      for (const player of this.players) {
        if (
          player.hand.some(
            (c) => c.type === deck[0].type && c.number === CardNumbers.SEVEN,
          )
        ) {
          //swap
          player.hand = player.hand.map((c) => {
            if (c.type === deck[0].type && c.number === CardNumbers.SEVEN) {
              return deck[0];
            }
            return c;
          });
          deck[0] = {
            type: deck[0].type,
            number: CardNumbers.SEVEN,
          };
        }
      }
    }

    if (getNumber[deck[0].number] > 2) {
      for (const player of this.players) {
        if (
          player.hand.some(
            (c) => c.type === deck[0].type && c.number === CardNumbers.TWO,
          )
        ) {
          //swap
          player.hand = player.hand.map((c) => {
            if (c.type === deck[0].type && c.number === CardNumbers.TWO) {
              return deck[0];
            }
            return c;
          });
          deck[0] = {
            type: deck[0].type,
            number: CardNumbers.TWO,
          };
        }
      }
    }
    this.sing = deck[0].type;
  }

  sameCard(card1: Card, card2: Card) {
    return card1.type === card2.type && card1.number === card2.number;
  }

  playCard(name: string, card: Card) {
    const playerIndex = this.players.findIndex((p) => p.name === name);
    if (this.turn === -1) {
      this.turn = playerIndex;
    }
    const player = this.players[playerIndex];
    if (
      this.turn === playerIndex &&
      this.table[playerIndex] === null &&
      player.hand.some((c) => this.sameCard(c, card))
    ) {
      player.hand = player.hand.filter((c) => !this.sameCard(c, card));
      this.table[playerIndex] = card;
      if (this.table.every((c) => c !== null)) {
        this.resolveRound();
      } else {
        this.turn = (this.turn + 1) % 3;
      }
    }
  }

  resolveRound() {
    console.log('resolving round');
  }

  getGameState(name: string): GameState {
    const playerIndex = this.players.findIndex((p) => p.name === name);
    const player = this.players[playerIndex];
    return {
      table: this.table,
      hand: player.hand,
      stack: player.stack,
      sings: player.sings,
      turn: this.turn,
      waiting: this.waiting,
      sing: this.sing,
      players: this.players.map((p) => ({ name: p.name, sings: p.sings })),
    };
  }
}

interface GameState {
  table: [Card, Card, Card];
  hand: Card[];
  stack: Card[];
  sings: CardTypes[];
  turn: number;
  waiting: boolean;
  sing: CardTypes | null;
  players: { name: string; sings: CardTypes[] }[];
}

export default Game;
