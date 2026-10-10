import Phaser from 'phaser';
import { FONT, fadeIn } from '../ui';
import { sfx } from '../sound';

export interface MemoryData {
  face?: string; // 얼굴 그림 키 (없으면 글만)
  name?: string;
  lines: string[];
  onComplete: () => void;
}

const LINE_MS = 500;

// 되찾은 기억 장면: 얼굴 그림과 짧은 글이 한 줄씩 나타나고, 다 나오면 탭해서 닫는다.
// (임시 그림 — 진짜 장면 그림은 Sprint 6에서 교체)
export class MemoryScene extends Phaser.Scene {
  constructor() {
    super('Memory');
  }

  create(data: MemoryData) {
    const { width, height } = this.scale;
    fadeIn(this);
    sfx(this, 'memory', 0.5);
    this.add.rectangle(0, 0, width, height, 0x0e0c16, 0.94).setOrigin(0).setInteractive();

    let y = height * 0.2;
    if (data.face) {
      const frame = this.add.rectangle(width / 2, y + 60, 132, 132, 0xf5efe0).setStrokeStyle(3, 0xd8c9a3);
      this.add.image(width / 2, y + 60, `face-${data.face}`).setScale(3);
      frame.setAlpha(0.9);
      y += 140;
    }
    if (data.name) {
      this.add
        .text(width / 2, y, data.name, { fontFamily: FONT, fontSize: '16px', color: '#d8c9a3' })
        .setOrigin(0.5);
      y += 40;
    } else {
      y = height * 0.32;
    }

    // 긴 문장은 두 줄로 넘어가므로, 앞 문장의 실제 높이만큼 내려서 다음 문장을 놓는다.
    const texts = data.lines.map((line) => {
      const t = this.add
        .text(width / 2, y, line, {
          fontFamily: FONT,
          fontSize: '17px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: width - 56, useAdvancedWrap: true },
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0)
        .setAlpha(0);
      y += t.height + 16;
      return t;
    });
    texts.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, duration: 600, delay: 400 + i * (LINE_MS + 600) }));

    const hint = this.add
      .text(width / 2, height - 60, '화면을 탭하면 계속', { fontFamily: FONT, fontSize: '14px', color: '#8f86c9' })
      .setOrigin(0.5)
      .setAlpha(0);
    const readyAt = 400 + data.lines.length * (LINE_MS + 600);
    this.time.delayedCall(readyAt, () => {
      this.tweens.add({ targets: hint, alpha: 1, duration: 400, yoyo: true, repeat: -1, hold: 600 });
      this.input.once('pointerup', () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => data.onComplete());
      });
    });
  }
}
