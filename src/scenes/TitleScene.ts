import Phaser from 'phaser';
import { FONT, addButton, addMuteButton, fadeIn, fadeTo } from '../ui';
import { music } from '../sound';
import { game, newGame } from '../state';
import { clearSave, loadGame } from '../save';
import { INTRO_LINES, SEASONS, regionsOf, type Season } from '../regions';
import type { MemoryData } from './MemoryScene';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);

    this.add
      .text(width / 2, height * 0.36, '잃어버린\n세계의 조각', {
        fontFamily: FONT,
        fontSize: '36px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.5, '색과 기억을 되찾는 여행', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#999999',
      })
      .setOrigin(0.5);

    music(this.game, 'quiet');
    addMuteButton(this, width - 52, height - 30);
    this.add
      .text(12, height - 30, '그림·음악: Ninja Adventure (Pixel-boy & AAA, CC0)', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#666666',
      })
      .setOrigin(0, 0.5);

    const saved = loadGame();
    if (!saved) {
      addButton(this, width / 2, height * 0.72, '시작', () => this.startNew());
      return;
    }

    // 기록이 있으면 이어하기를 크게, 새로 시작은 작게 (실수로 지우지 않도록 한 번 더 묻는다)
    addButton(this, width / 2, height * 0.66, '이어하기', () => {
      game.state = saved;
      fadeTo(this, 'Game');
    });
    // 앞 계절을 다 되찾고 아직 다음 계절에 들어가지 않았다면, 먼 길을 걸어 돌아가지 않아도 되게 바로 보내 준다.
    const seasons = SEASONS.map((s) => s.key);
    const done = (season: Season) => regionsOf(season).every((r) => saved.restored.includes(r.key));
    const next = seasons.find((season, i) => i > 0 && done(seasons[i - 1]) && !done(season));
    if (next && !regionsOf(next).some((r) => r.key === saved.map)) {
      const first = regionsOf(next)[0];
      const label = { spring: '', summer: '바닷가로 바로 가기', autumn: '단풍 숲으로 바로 가기' }[next];
      addButton(this, width / 2, height * 0.76, label, () => {
        game.state = { ...saved, map: first.key, x: undefined, y: undefined };
        fadeTo(this, 'Game');
      }, 180, 40);
    }
    addButton(this, width / 2, height * 0.86, '새로 시작', () => this.confirmNew(), 130, 40);
  }

  // 새 게임: 도입 글(세상이 흑백이 된 이야기)을 보여 준 뒤 들판으로
  private startNew() {
    clearSave();
    game.state = newGame();
    const manager = this.game.scene;
    fadeTo(this, 'Memory', {
      lines: INTRO_LINES,
      onComplete: () => {
        manager.stop('Memory');
        manager.start('Game');
      },
    } satisfies MemoryData);
  }

  private confirmNew() {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    const box = this.add.rectangle(width / 2, height / 2, 280, 170, 0x2a2738).setStrokeStyle(2, 0x8f86c9);
    const text = this.add
      .text(width / 2, height / 2 - 40, '처음부터 다시 할까요?\n지금까지의 기록은 지워져요.', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    const yes = addButton(this, width / 2 - 65, height / 2 + 40, '네', () => this.startNew(), 110, 44);
    const no = addButton(this, width / 2 + 65, height / 2 + 40, '아니요', () => {
      for (const o of [dim, box, text, yes, no]) o.destroy();
    }, 110, 44);
  }
}
