import Phaser from 'phaser';
import { FONT, fadeIn, fadeTo } from '../ui';
import { game } from '../state';
import { REGIONS } from '../regions';
import { RARE_ITEMS } from '../items';
import { music } from '../sound';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    const { width, height } = this.scale;
    const s = game.state;
    fadeIn(this);
    music(this.game, 'end');

    this.add
      .text(width / 2, height * 0.3, '봄을 되찾았다', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.38, '첫 번째 계절 · 끝', { fontFamily: FONT, fontSize: '15px', color: '#d8c9a3' })
      .setOrigin(0.5);

    // 이번 여행에서 모은 것
    const lines = [
      `되찾은 기억  ${s.restored.length} / ${REGIONS.length}`,
      `모은 보석  ${s.gems.length} / ${REGIONS.length}`,
      `희귀 아이템  ${s.items.length} / ${RARE_ITEMS.length}`,
    ];
    this.add
      .text(width / 2, height * 0.5, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#cccccc',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);
    if (s.items.length < RARE_ITEMS.length) {
      this.add
        .text(width / 2, height * 0.66, '이어하기로 돌아가 남은 아이템을 찾을 수 있어요', {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#8f86c9',
        })
        .setOrigin(0.5);
    }

    const hint = this.add
      .text(width / 2, height * 0.8, '화면을 탭하면 처음으로', { fontFamily: FONT, fontSize: '16px', color: '#999999' })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });

    // 페이드인이 끝난 뒤부터 탭을 받아서, 이전 화면의 탭이 바로 넘어가지 않게 한다.
    this.time.delayedCall(500, () => {
      this.input.once('pointerup', () => fadeTo(this, 'Title'));
    });
  }
}
