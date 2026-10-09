import Phaser from 'phaser';
import { FONT, fadeIn, fadeTo } from '../ui';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);

    this.add
      .text(width / 2, height * 0.42, '끝', {
        fontFamily: FONT,
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.52, '봄의 들판에 색과 기억이 돌아왔다', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height * 0.7, '화면을 탭하면 처음으로', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#999999',
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });

    // 페이드인이 끝난 뒤부터 탭을 받아서, 이전 화면의 탭이 바로 넘어가지 않게 한다.
    this.time.delayedCall(500, () => {
      this.input.once('pointerup', () => fadeTo(this, 'Title'));
    });
  }
}
