import Phaser from 'phaser';
import { FONT, addButton, fadeIn } from '../ui';
import { game } from '../state';
import { SEASONS, firefliesOf, regionsOf, type Season } from '../regions';
import { RARE_ITEMS } from '../items';
import type { MemoryData } from './MemoryScene';

export interface CollectionData {
  onClose: () => void;
  season?: Season;
}

const SLOT = 56;
const MISSING_TINT = 0x5a5470; // 못 찾은 것은 이 색 실루엣

// 수집 도감: 보석·희귀 아이템·되찾은 기억. 찾은 것은 컬러, 못 찾은 것은 실루엣.
// 칸을 탭하면 설명이 나오고, 기억 칸을 탭하면 그 기억 장면을 다시 본다.
export class CollectionScene extends Phaser.Scene {
  private info!: Phaser.GameObjects.Text;

  constructor() {
    super('Collection');
  }

  create(data: CollectionData) {
    const { width, height } = this.scale;
    const s = game.state;
    fadeIn(this);
    this.add.rectangle(0, 0, width, height, 0x14121f, 0.96).setOrigin(0).setInteractive();
    const season = data.season ?? 'spring';
    const regions = regionsOf(season);
    const items = RARE_ITEMS.filter((i) => i.season === season);
    this.add.text(width / 2, 34, '수집 도감', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

    // 계절 탭 (봄 / 여름)
    SEASONS.forEach((sea, i) => {
      const x = width / 2 + (i - (SEASONS.length - 1) / 2) * 90;
      const tab = addButton(this, x, 72, sea.name, () => {
        if (sea.key !== season) this.scene.restart({ ...data, season: sea.key });
      }, 80, 30);
      if (sea.key !== season) tab.setAlpha(0.5);
    });

    // 세로 배치: 보석(1줄) → 희귀 아이템 → 기억(1줄) → 설명 → 닫기
    let y = 100;
    this.section('보석', y);
    regions.forEach((r, i) => {
      const has = s.gems.includes(r.key);
      const img = this.slot(this.slotX(i, regions.length), y + 44, `gem-${r.gem}`, has, 2.2, () =>
        has ? `${r.gemName} 보석 — ${r.memory.name}의 기억을 깨운 열쇠` : '아직 찾지 못한 보석',
      );
      if (has && r.gemTint) img.setTint(r.gemTint);
    });

    y += 90;
    this.section('희귀 아이템', y);
    items.forEach((item, i) => {
      const has = s.items.includes(item.id);
      const row = Math.floor(i / 3);
      const inRow = Math.min(3, items.length - row * 3);
      this.slot(this.slotX(i % 3, inRow), y + 44 + row * (SLOT + 14), `item-${item.id}`, has, 2.2, () =>
        has ? `${item.name} — ${item.desc}` : '너구리와 함께 흙더미를 파 보자',
      );
    });

    y += 44 + Math.max(1, Math.ceil(items.length / 3)) * (SLOT + 14) + 6;
    this.section('되찾은 기억 (눌러서 다시 보기)', y);
    regions.forEach((r, i) => {
      const has = s.restored.includes(r.key);
      this.slot(this.slotX(i, regions.length), y + 44, `face-${r.memory.face}`, has, 1.3, () => {
        if (!has) return '아직 되찾지 못한 기억';
        this.replay(r.memory.face, r.memory.name, r.memory.lines);
        return '';
      });
    });

    const ffKeys = regions.map((r) => r.key);
    const ff = s.fireflies.filter((f) => ffKeys.some((k) => f.startsWith(`${k}-`))).length;
    this.add
      .text(width / 2, y + 86, `숨은 반딧불 ${ff} / ${firefliesOf(season)}`, { fontFamily: FONT, fontSize: '13px', color: '#ffb3e6' })
      .setOrigin(0.5);

    this.info = this.add
      .text(width / 2, y + 108, '칸을 눌러 보세요', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#d8c9a3',
        align: 'center',
        wordWrap: { width: width - 48, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    addButton(this, width / 2, height - 44, '닫기', () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => data.onClose());
    }, 140, 44);
  }

  private slotX(i: number, count: number) {
    const gap = 20;
    const rowWidth = count * SLOT + (count - 1) * gap;
    return (this.scale.width - rowWidth) / 2 + SLOT / 2 + i * (SLOT + gap);
  }

  private section(title: string, y: number) {
    this.add.text(24, y, title, { fontFamily: FONT, fontSize: '15px', color: '#8f86c9' });
  }

  private slot(x: number, y: number, texture: string, has: boolean, scale: number, describe: () => string) {
    const bg = this.add.rectangle(x, y, SLOT, SLOT, 0x2a2738).setStrokeStyle(2, has ? 0xd8c9a3 : 0x45405a);
    const img = this.add.image(x, y, texture).setScale(scale);
    if (!has) img.setTintFill(MISSING_TINT);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      const text = describe();
      if (text) this.info.setText(text);
    });
    return img;
  }

  // 되찾은 기억 장면을 도감 위에 다시 띄운다.
  private replay(face: string, name: string, lines: string[]) {
    this.scene.pause();
    this.scene.launch('Memory', {
      face,
      name,
      lines,
      onComplete: () => {
        this.scene.stop('Memory');
        this.scene.resume();
      },
    } satisfies MemoryData);
  }
}
