import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';

// 들판 탐험 장면. S-1.5에서 맵과 탭 이동이 들어온다.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);

    this.add
      .text(width / 2, height / 2, '게임 화면\n(들판이 들어올 자리)', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#cccccc',
        align: 'center',
      })
      .setOrigin(0.5);

    // 임시 끝 조건: S-1.8에서 "색 복원 완료"로 바뀐다.
    addButton(this, width / 2, height * 0.85, '끝내기 (임시)', () => fadeTo(this, 'End'));
  }
}
