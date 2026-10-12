import Phaser from 'phaser';
import { FONT, fadeIn } from '../ui';
import { sfx } from '../sound';
import { game, statsOf } from '../state';
import type { Season } from '../regions';

export interface PuzzleData {
  // 짝의 개수. 카드 수는 그 두 배 (Sprint 1은 2쌍 = 4장, Sprint 3에서 늘어난다)
  pairs: number;
  season?: Season; // 계절마다 규칙이 하나씩 다르다 (RULES)
  onComplete: () => void;
}

// 계절별 퍼즐 규칙. 힐링 게임이라 실패·시간 제한은 없고, 눈으로 따라갈 수 있게 천천히.
//   봄: 기본 / 여름 "물결": 처음에 모든 그림을 잠깐 보여 줌 / 가을 "바람": 짝을 맞출 때마다 뒤집힌 카드 두 장이 자리를 바꿈
//   겨울 "눈보라": 짧게 보여 준 뒤 바람도 분다
const RULES: Record<Season, { name: string; hint: string; peek: boolean; wind: boolean }> = {
  spring: { name: '봄', hint: '같은 그림 두 장을 찾아요', peek: false, wind: false },
  summer: { name: '여름 · 물결', hint: '처음에 잠깐 모든 그림이 보여요. 잘 봐 두세요', peek: true, wind: false },
  autumn: { name: '가을 · 바람', hint: '짝을 맞출 때마다 바람이 카드 두 장을 바꿔요', peek: false, wind: true },
  winter: { name: '겨울 · 눈보라', hint: '잠깐 보여 준 뒤, 짝을 맞출 때마다 바람이 불어요', peek: true, wind: true },
};
const WIND_MS = 520;

const FLIP_MS = 120;
const MISMATCH_MS = 700;
const CARD_GAP = 16;

// 카드 앞면 그림: 계절마다 그 계절다운 것 6가지 (TilesetNature 번호). 모양·색이 서로 헷갈리지 않게 골랐다.
const SYMBOLS: Record<Season, number[]> = {
  spring: [264, 267, 270, 266, 268, 338], // 해바라기·빨간 꽃·데이지·클로버·잎·보라 수정
  summer: [361, 337, 296, 203, 226, 363], // 푸른 보석·푸른 수정·바다 돌·대나무·덤불·초록 보석
  autumn: [276, 336, 324, 318, 412, 360], // 낙엽·주황 수정·그루터기·주황 통·열매 덤불·주황 보석
  winter: [293, 297, 337, 362, 388, 341], // 눈덩이·눈 덮인 수정·푸른 수정·보라 보석·열매 덤불 둘
};

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
  private wind = false;
  private symbols = SYMBOLS.spring;

  constructor() {
    super('Puzzle');
  }

  // 퍼즐 푸는 시간도 그 지역의 플레이 시간 (지인 테스트용 기록)
  update(_time: number, delta: number) {
    statsOf(game.state, game.state.map).ms += Math.min(delta, 1000);
  }

  create(data: PuzzleData) {
    const { width, height } = this.scale;
    fadeIn(this);
    this.cards = [];
    this.opened = [];
    this.busy = false;
    this.onComplete = data.onComplete;
    const rule = RULES[data.season ?? 'spring'];
    this.symbols = SYMBOLS[data.season ?? 'spring'];
    this.wind = rule.wind;

    // 뒤의 들판을 어둡게 가리고, 그 위를 탭해도 들판이 반응하지 않게 막는다.
    this.add.rectangle(0, 0, width, height, 0x14121f, 0.92).setOrigin(0).setInteractive();

    this.add
      .text(width / 2, 70, '흩어진 기억을 맞춰보자', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 100, rule.hint, { fontFamily: FONT, fontSize: '14px', color: '#a9a3c9' })
      .setOrigin(0.5);
    if (rule.peek || rule.wind)
      this.add.text(width / 2, 40, rule.name, { fontFamily: FONT, fontSize: '12px', color: '#d8c9a3' }).setOrigin(0.5);

    const pairs = Math.min(data.pairs, this.symbols.length);
    this.layoutCards(pairs, width, height);
    if (rule.peek) this.peek(rule.wind ? 1200 + pairs * 150 : 1800 + pairs * 200);
  }

  // 모든 카드를 잠깐 앞면으로 보여 주고 다시 덮는다. 그동안은 누를 수 없다.
  private peek(ms: number) {
    this.busy = true;
    this.time.delayedCall(450, () => {
      for (const c of this.cards) this.flip(c, true);
      this.time.delayedCall(ms, () => {
        for (const c of this.cards) this.flip(c, false);
        this.time.delayedCall(FLIP_MS * 2, () => (this.busy = false));
      });
    });
  }

  // 바람: 아직 뒤집히지 않은 카드 두 장이 서로 자리를 바꾼다 (천천히 미끄러져서 눈으로 따라갈 수 있게).
  private blow() {
    const hidden = this.cards.filter((c) => !c.matched && !c.faceUp);
    if (hidden.length < 2) return;
    const [a, b] = Phaser.Utils.Array.Shuffle([...hidden]).slice(0, 2);
    this.busy = true;
    this.time.delayedCall(FLIP_MS * 2 + 250, () => {
      sfx(this, 'flip', 0.3);
      const ax = a.container.x;
      const ay = a.container.y;
      for (const [card, x, y] of [[a, b.container.x, b.container.y], [b, ax, ay]] as const) {
        this.tweens.add({ targets: card.container, x, y, duration: WIND_MS, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: card.container, angle: { from: 0, to: 8 }, duration: WIND_MS / 2, yoyo: true });
      }
      this.time.delayedCall(WIND_MS + 60, () => (this.busy = false));
    });
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
      // 마지막 줄이 덜 찼으면 가운데로 모은다.
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, count - row * cols);
      const shift = ((cols - inRow) * (cardWidth + CARD_GAP)) / 2;
      const x = left + shift + (i % cols) * (cardWidth + CARD_GAP);
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
      this.add.image(0, 0, 'nature-sheet', this.symbols[symbol]).setScale(Math.min(3.5, (w * 0.7) / 16)),
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
    sfx(this, 'flip', 0.5);
    this.opened.push(card);
    if (this.opened.length < 2) return;

    const [a, b] = this.opened;
    this.opened = [];

    if (a.symbol === b.symbol) {
      a.matched = b.matched = true;
      this.time.delayedCall(FLIP_MS * 2, () => sfx(this, 'match', 0.5));
      this.celebrate(a);
      this.celebrate(b);
      if (this.cards.every((c) => c.matched)) this.time.delayedCall(500, () => this.finish());
      else if (this.wind) this.blow();
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
    sfx(this, 'success', 0.6);
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
