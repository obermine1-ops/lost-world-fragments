import Phaser from 'phaser';
import { FONT, addButton, fadeIn } from '../ui';
import { sfx } from '../sound';
import { game, statsOf } from '../state';
import { saveGame } from '../save';
import { FISH, type Fish } from '../fish';
import type { Season } from '../regions';

export interface FishingData {
  season: Season;
  onClose: () => void;
}

const BITE_MS = 1000; // 찌가 들어간 뒤 탭할 수 있는 시간 (넉넉하게 — 힐링 게임)

// 낚시: 찌가 쏙 들어가면 화면을 탭. 너무 빨리 누르거나 놓쳐도 벌은 없고 다시 기다리면 된다.
export class FishingScene extends Phaser.Scene {
  private state: 'waiting' | 'bite' | 'caught' = 'waiting';
  private bobber!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;
  private opts!: FishingData;
  private timer?: Phaser.Time.TimerEvent;
  private result?: Phaser.GameObjects.Container;

  constructor() {
    super('Fishing');
  }

  update(_time: number, delta: number) {
    statsOf(game.state, game.state.map).ms += Math.min(delta, 1000);
  }

  create(data: FishingData) {
    const { width, height } = this.scale;
    this.opts = data;
    fadeIn(this);
    this.add.rectangle(0, 0, width, height, 0x14121f, 0.92).setOrigin(0).setInteractive().on('pointerdown', () => this.onTap());
    this.add.text(width / 2, 60, '낚시', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    this.info = this.add
      .text(width / 2, 96, '', { fontFamily: FONT, fontSize: '14px', color: '#a9a3c9', align: 'center' })
      .setOrigin(0.5);

    // 물: 잔물결이 천천히 흐른다
    const water = this.add.rectangle(width / 2, height / 2, 290, 240, 0x3d7fb8).setStrokeStyle(3, 0x8fc6e8);
    for (let i = 0; i < 7; i++) {
      const wave = this.add.rectangle(width / 2 - 120 + (i % 3) * 90, height / 2 - 90 + i * 28, 36, 2, 0xb8e0f5, 0.6);
      this.tweens.add({ targets: wave, x: wave.x + 24, duration: 1800 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    void water;
    // 찌: 빨강·하양 동그라미
    this.bobber = this.add.container(width / 2, height / 2, [
      this.add.circle(0, 0, 9, 0xffffff).setStrokeStyle(2, 0x222222),
      this.add.rectangle(0, -3, 18, 6, 0xe0483c),
      this.add.rectangle(0, -14, 2, 10, 0x222222),
    ]);
    this.tweens.add({ targets: this.bobber, y: height / 2 + 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    addButton(this, width / 2, height - 60, '그만하기', () => this.close(), 140, 44);
    this.wait();
  }

  private wait() {
    this.state = 'waiting';
    this.result?.destroy();
    this.result = undefined;
    this.bobber.setVisible(true).setScale(1);
    this.info.setText('찌가 쏙 들어가면 화면을 탭!');
    this.timer?.remove();
    this.timer = this.time.delayedCall(Phaser.Math.Between(1500, 4000), () => this.bite());
  }

  private bite() {
    this.state = 'bite';
    sfx(this, 'splash', 0.5);
    this.info.setText('지금이야!');
    this.tweens.add({ targets: this.bobber, scaleY: 0.4, duration: 90, yoyo: true, repeat: 2 });
    const ring = this.add.circle(this.bobber.x, this.bobber.y, 10).setStrokeStyle(2, 0xffffff);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    this.timer = this.time.delayedCall(BITE_MS, () => {
      if (this.state !== 'bite') return;
      this.info.setText('놓쳤다… 다시 기다려 보자');
      this.time.delayedCall(900, () => this.state === 'bite' && this.wait());
    });
  }

  private onTap() {
    if (this.state === 'waiting') {
      this.info.setText('조금 빨랐다. 찌를 잘 보자');
      this.timer?.remove();
      this.timer = this.time.delayedCall(Phaser.Math.Between(1500, 4000), () => this.bite());
      return;
    }
    if (this.state === 'bite') this.catch();
  }

  // 아직 못 잡은 물고기가 조금 더 잘 잡힌다.
  private pick(): Fish {
    const pool = FISH.filter((f) => f.season === this.opts.season);
    const fresh = pool.filter((f) => !game.state.fish[f.id]);
    if (fresh.length && Math.random() < 0.65) return Phaser.Utils.Array.GetRandom(fresh);
    return Phaser.Utils.Array.GetRandom(pool);
  }

  private catch() {
    this.state = 'caught';
    this.timer?.remove();
    const fish = this.pick();
    const s = game.state;
    const first = !s.fish[fish.id];
    s.fish[fish.id] = (s.fish[fish.id] ?? 0) + 1;
    saveGame(s);
    sfx(this, first ? 'success' : 'pickup', 0.5);
    this.bobber.setVisible(false);

    const { width, height } = this.scale;
    const img = this.add.image(0, 0, fish.texture).setScale(5);
    if (fish.tint) img.setTint(fish.tint);
    const caughtKinds = Object.keys(s.fish).filter((k) => s.fish[k] > 0).length;
    const name = this.add
      .text(0, 56, `${fish.name}${first ? ' — 처음 낚았다!' : ` (${s.fish[fish.id]}마리째)`}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);
    const desc = this.add
      .text(0, 82, `${fish.desc}\n물고기 도감 ${caughtKinds} / ${FISH.length}`, { fontFamily: FONT, fontSize: '12px', color: '#d8c9a3', align: 'center', lineSpacing: 4 })
      .setOrigin(0.5, 0);
    this.result = this.add.container(width / 2, height / 2 - 30, [img, name, desc]);
    img.y = 30;
    this.tweens.add({ targets: img, y: -10, duration: 380, ease: 'Back.easeOut' });
    this.info.setText(caughtKinds === FISH.length && first ? '모든 물고기를 낚았다! 새 가구: 낚시 상자' : '');
    const again = addButton(this, width / 2, height - 116, '한 번 더', () => {
      again.destroy();
      this.wait();
    }, 140, 40);
  }

  private close() {
    this.timer?.remove();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.opts.onClose());
  }
}
