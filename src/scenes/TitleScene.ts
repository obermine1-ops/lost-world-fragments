import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { game, newGame } from '../state';
import { clearSave, loadGame } from '../save';

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

    const saved = loadGame();
    if (!saved) {
      addButton(this, width / 2, height * 0.72, '시작', () => this.startNew());
      return;
    }

    // 기록이 있으면 이어하기를 크게, 새로 시작은 작게 (실수로 지우지 않도록 한 번 더 묻는다)
    addButton(this, width / 2, height * 0.7, '이어하기', () => {
      game.state = saved;
      fadeTo(this, 'Game');
    });
    addButton(this, width / 2, height * 0.82, '새로 시작', () => this.confirmNew(), 130, 40);
  }

  private startNew() {
    clearSave();
    game.state = newGame();
    fadeTo(this, 'Game');
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
