import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';

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

    addButton(this, width / 2, height * 0.72, '시작', () => fadeTo(this, 'Game'));
  }
}
