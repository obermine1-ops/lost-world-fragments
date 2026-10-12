import Phaser from 'phaser';
import { FONT, fadeIn, fadeTo } from '../ui';
import { REGIONS } from '../regions';
import { ambient, music } from '../sound';
import { seasonBackdrop } from './game/ambience';

const SPEED = 28; // 1초에 올라가는 픽셀

// 네 계절을 모두 되찾은 뒤의 크레딧. 천천히 올라가고, 화면을 누르고 있으면 빨리 감긴다.
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);
    ambient(this.game); // 환경 소리는 탐험 화면에서만
    music(this.game, 'credits');
    this.cameras.main.setBackgroundColor('#0e0c16');
    seasonBackdrop(this, undefined, true, height / 2);

    const memories = REGIONS.map((r) => r.memory.name).filter((n, i, all) => all.indexOf(n) === i);
    const blocks: [string, string[]][] = [
      ['', ['잃어버린 세계의 조각']],
      ['함께 걸은 친구들', ['너구리 · 개구리 · 앵무새 · 햄스터']],
      ['되찾은 기억', memories],
      ['기획', ['나']],
      ['만든 이', ['나와 Claude']],
      ['그림 · 음악 · 효과음', ['Ninja Adventure Asset Pack', 'Pixel-boy & AAA (CC0)']],
      ['엔진', ['Phaser']],
      ['', ['그리고 끝까지 함께해 준 당신']],
      ['', ['고마워요.', '', '✿  ☀  ✾  ❄']],
    ];

    const roll = this.add.container(0, height + 40);
    let y = 0;
    for (const [title, lines] of blocks) {
      if (title) {
        roll.add(this.add.text(width / 2, y, title, { fontFamily: FONT, fontSize: '13px', color: '#8f86c9' }).setOrigin(0.5, 0));
        y += 24;
      }
      for (const line of lines) {
        roll.add(
          this.add
            .text(width / 2, y, line, { fontFamily: FONT, fontSize: title ? '16px' : '20px', color: '#ffffff', align: 'center' })
            .setOrigin(0.5, 0),
        );
        y += title ? 24 : 30;
      }
      y += 56;
    }
    const end = -(y - height / 2);

    let fast = false;
    this.input.on('pointerdown', () => (fast = true));
    this.input.on('pointerup', () => (fast = false));
    let done = false;
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, delta: number) => {
      if (done) return;
      roll.y -= ((fast ? 6 : 1) * SPEED * delta) / 1000;
      if (roll.y <= end) {
        done = true;
        roll.y = end;
        this.time.delayedCall(3000, () => fadeTo(this, 'Title'));
      }
    });
  }
}
