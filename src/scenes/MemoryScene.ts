import Phaser from 'phaser';
import { FONT, fadeIn } from '../ui';
import { sfx } from '../sound';
import type { Season } from '../regions';
import { RAINBOW, createAmbience } from './game/ambience';

export interface MemoryData {
  face?: string; // 얼굴 그림 키 (없으면 글만)
  portrait?: string; // 얼굴 대신 액자에 넣을 그림 키 (동물 친구 — 첫 칸을 크게)
  name?: string;
  lines: string[];
  season?: Season; // 그 계절의 빛깔과 입자(꽃잎·햇빛·낙엽·눈)를 뒤에 깐다
  rainbow?: boolean; // 무지개 동굴 이야기
  onComplete: () => void;
}

// 계절마다 뒤에 은은하게 번지는 빛깔
const SEASON_GLOW: Record<Season, number> = { spring: 0xffb3d1, summer: 0x8fd8ff, autumn: 0xf2a65a, winter: 0xbfd6ff };

// 가운데가 밝고 가장자리로 갈수록 투명해지는 둥근 빛 (한 번 그려 두고 색만 물들여 쓴다)
function softGlow(scene: Phaser.Scene) {
  const key = 'memory-glow';
  if (!scene.textures.exists(key)) {
    const size = 480;
    const canvas = scene.textures.createCanvas(key, size, size)!;
    const ctx = canvas.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
  return key;
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
    // 계절빛: 가운데 큰 빛 번짐이 천천히 숨 쉬고, 그 계절의 입자가 흩날린다 (얼굴·글보다 뒤)
    if (data.season || data.rainbow) {
      const color = data.rainbow ? 0xd8b8ff : SEASON_GLOW[data.season!];
      const glow = this.add.image(width / 2, height * 0.36, softGlow(this)).setTint(color).setAlpha(0.32);
      this.tweens.add({ targets: glow, scale: 1.1, alpha: 0.45, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      createAmbience(this, data.rainbow ? 'summer' : data.season!, data.rainbow ? RAINBOW : undefined, 2).setAlpha(0.6);
    }

    let y = height * 0.2;
    if (data.face || data.portrait) {
      const frame = this.add.rectangle(width / 2, y + 60, 132, 132, 0xf5efe0).setStrokeStyle(3, 0xd8c9a3);
      if (data.face) this.add.image(width / 2, y + 60, `face-${data.face}`).setScale(3);
      else {
        // 동물 친구: 액자 안에서 걷기 그림이 천천히 움직인다
        const pet = this.add.sprite(width / 2, y + 62, data.portrait!, 0).setScale(6);
        if (this.anims.exists(`${data.portrait}-walk`)) pet.play({ key: `${data.portrait}-walk`, frameRate: 3 });
      }
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
