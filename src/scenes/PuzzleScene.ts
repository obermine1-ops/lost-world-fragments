import Phaser from 'phaser';
import { FONT, fadeIn } from '../ui';

export interface PuzzleData {
  // 짝의 개수. 카드 수는 그 두 배 (Sprint 1은 2쌍 = 4장, Sprint 3에서 늘어난다)
  pairs: number;
  onComplete: () => void;
}

const FLIP_MS = 120;
const MISMATCH_MS = 700;
const CARD_GAP = 16;

type SymbolMaker = (scene: Phaser.Scene) => Phaser.GameObjects.Shape;

// 카드 앞면 그림 (임시 도형. 나중에 기억 장면 조각 그림으로 바뀐다)
const SYMBOLS: SymbolMaker[] = [
  (s) => s.add.circle(0, 0, 22, 0xff7aa2),
  (s) => s.add.triangle(0, 0, 0, 40, 24, 0, 48, 40, 0xffc93c),
  (s) => s.add.rectangle(0, 0, 32, 32, 0x4fc3ff).setAngle(45),
  (s) => s.add.star(0, 0, 5, 10, 24, 0xa77bff),
  (s) => s.add.ellipse(0, 0, 50, 26, 0x58d68d),
  (s) => s.add.star(0, 0, 8, 12, 22, 0xff8c42),
];

interface Card {
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container;
  symbol: number;
  faceUp: boolean;
  matched: boolean;
}

// 기억 복원 퍼즐: 카드를 두 장씩 뒤집어 같은 그림을 찾는다. 실패 제한·시간 제한 없음.
export class PuzzleScene extends Phaser.Scene {
  private cards: Card[] = [];
  private opened: Card[] = [];
  private busy = false;
  private onComplete!: () => void;

  constructor() {
    super('Puzzle');
  }

  create(data: PuzzleData) {
    const { width, height } = this.scale;
    fadeIn(this);
    this.cards = [];
    this.opened = [];
    this.busy = false;
    this.onComplete = data.onComplete;

    // 뒤의 들판을 어둡게 가리고, 그 위를 탭해도 들판이 반응하지 않게 막는다.
    this.add.rectangle(0, 0, width, height, 0x14121f, 0.92).setOrigin(0).setInteractive();

    this.add
      .text(width / 2, 70, '흩어진 기억을 맞춰보자', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 100, '같은 그림 두 장을 찾아요', { fontFamily: FONT, fontSize: '14px', color: '#a9a3c9' })
      .setOrigin(0.5);

    this.layoutCards(Math.min(data.pairs, SYMBOLS.length), width, height);
  }

  private layoutCards(pairs: number, width: number, height: number) {
    const symbols = Phaser.Utils.Array.Shuffle([...Array(pairs).keys(), ...Array(pairs).keys()]);
    const count = symbols.length;
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
    const rows = Math.ceil(count / cols);

    const areaTop = 140;
    const areaHeight = height - areaTop - 60;
    const cardWidth = Math.min(120, (width - 40 - CARD_GAP * (cols - 1)) / cols);
    const cardHeight = Math.min(cardWidth * 1.35, (areaHeight - CARD_GAP * (rows - 1)) / rows);
    const gridWidth = cols * cardWidth + (cols - 1) * CARD_GAP;
    const gridHeight = rows * cardHeight + (rows - 1) * CARD_GAP;
    const left = (width - gridWidth) / 2 + cardWidth / 2;
    const top = areaTop + (areaHeight - gridHeight) / 2 + cardHeight / 2;

    symbols.forEach((symbol, i) => {
      const x = left + (i % cols) * (cardWidth + CARD_GAP);
      const y = top + Math.floor(i / cols) * (cardHeight + CARD_GAP);
      this.cards.push(this.createCard(x, y, cardWidth, cardHeight, symbol));
    });
  }

  private createCard(x: number, y: number, w: number, h: number, symbol: number): Card {
    const back = this.add.container(0, 0, [
      this.add.rectangle(0, 0, w, h, 0x3b3561).setStrokeStyle(3, 0x8f86c9),
      this.add.rectangle(0, 0, 16, 16, 0x8f86c9).setAngle(45),
    ]);
    const front = this.add.container(0, 0, [
      this.add.rectangle(0, 0, w, h, 0xf5efe0).setStrokeStyle(3, 0xd8c9a3),
      SYMBOLS[symbol](this),
    ]);
    front.setVisible(false);

    const container = this.add.container(x, y, [back, front]);
    container.setSize(w, h).setInteractive({ useHandCursor: true });

    const card: Card = { container, back, front, symbol, faceUp: false, matched: false };
    container.on('pointerup', () => this.onCardTap(card));
    return card;
  }

  private onCardTap(card: Card) {
    if (this.busy || card.faceUp || card.matched) return;

    this.flip(card, true);
    this.opened.push(card);
    if (this.opened.length < 2) return;

    const [a, b] = this.opened;
    this.opened = [];

    if (a.symbol === b.symbol) {
      a.matched = b.matched = true;
      this.celebrate(a);
      this.celebrate(b);
      if (this.cards.every((c) => c.matched)) this.time.delayedCall(500, () => this.finish());
    } else {
      this.busy = true;
      this.time.delayedCall(MISMATCH_MS, () => {
        this.flip(a, false);
        this.flip(b, false);
        this.time.delayedCall(FLIP_MS * 2, () => (this.busy = false));
      });
    }
  }

  // 카드를 옆으로 납작하게 접었다가 반대 면으로 펼친다.
  private flip(card: Card, faceUp: boolean) {
    card.faceUp = faceUp;
    this.tweens.chain({
      targets: card.container,
      tweens: [
        {
          scaleX: 0,
          duration: FLIP_MS,
          onComplete: () => {
            card.front.setVisible(faceUp);
            card.back.setVisible(!faceUp);
          },
        },
        { scaleX: 1, duration: FLIP_MS },
      ],
    });
  }

  private celebrate(card: Card) {
    this.tweens.add({
      targets: card.container,
      scaleY: 1.08,
      duration: 150,
      delay: FLIP_MS * 2,
      yoyo: true,
    });
  }

  private finish() {
    const { width, height } = this.scale;
    const message = this.add
      .text(width / 2, height / 2, '기억이 돌아왔다', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 20, y: 14 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: message, alpha: 1, duration: 400 });
    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.onComplete());
    });
  }
}
