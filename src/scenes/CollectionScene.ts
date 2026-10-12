import Phaser from 'phaser';
import { FONT, addButton, fadeIn } from '../ui';
import { formatPlayTime, game, playMs } from '../state';
import { REGIONS, SEASONS, firefliesOf, regionsOf, type Season } from '../regions';
import { mapTitle } from './WorldMapScene';
import { RARE_ITEMS } from '../items';
import type { MemoryData } from './MemoryScene';
import { isComplete } from '../furniture';

export interface CollectionData {
  onClose: () => void;
  season?: Season | 'stats'; // 'stats' = 플레이 기록 탭
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
    const page = data.season ?? 'spring';
    this.add.text(width / 2, 34, page === 'stats' ? '플레이 기록' : '수집 도감', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    if (isComplete(s))
      this.add.text(width - 20, 34, '★ 완전 수집', { fontFamily: FONT, fontSize: '12px', color: '#ffb3e6' }).setOrigin(1, 0.5);

    // 탭: 봄 / 여름 / 가을 / 겨울 / 기록
    const tabs: { key: Season | 'stats'; name: string }[] = [...SEASONS.map((sea) => ({ key: sea.key, name: sea.name })), { key: 'stats', name: '기록' }];
    tabs.forEach((t, i) => {
      const x = width / 2 + (i - (tabs.length - 1) / 2) * 68;
      const tab = addButton(this, x, 72, t.name, () => {
        if (t.key !== page) this.scene.restart({ ...data, season: t.key });
      }, 62, 30);
      if (t.key !== page) tab.setAlpha(0.5);
    });
    const close = () =>
      addButton(this, width / 2, height - 44, '닫기', () => {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => data.onClose());
      }, 140, 44);
    if (page === 'stats') {
      this.showStats();
      close();
      return;
    }
    const season = page;
    const regions = regionsOf(season);
    const items = RARE_ITEMS.filter((i) => i.season === season);

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
        has ? `${item.name} — ${item.desc}` : '흙더미나 반짝이는 곳을 동료와 살펴보자',
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

    close();
  }

  // 플레이 기록: 지역마다 머문 시간·길 안내 누른 횟수·막힌 횟수. 지인 테스트 때 이 화면을 캡처해 받는다.
  private showStats() {
    const { width } = this.scale;
    const s = game.state;
    const col = { name: 24, time: 196, guide: 266, nudge: 326 };
    const head = { fontFamily: FONT, fontSize: '11px', color: '#8f86c9' };
    let y = 104;
    this.add.text(col.name, y, '지역', head);
    this.add.text(col.time, y, '시간', head).setOrigin(0.5, 0);
    this.add.text(col.guide, y, '길 안내', head).setOrigin(0.5, 0);
    this.add.text(col.nudge, y, '막힘', head).setOrigin(0.5, 0);
    y += 20;
    const row = { fontFamily: FONT, fontSize: '12px', color: '#ffffff' };
    for (const r of REGIONS) {
      const st = s.stats[r.key];
      const visited = !!st;
      const done = s.restored.includes(r.key);
      const style = { ...row, color: visited ? (done ? '#ffffff' : '#ffe9a8') : '#5a5470' };
      this.add.text(col.name, y, `${done ? '✓' : '·'} ${visited ? mapTitle(this, r.key) : '???'}`, style);
      if (visited) {
        this.add.text(col.time, y, formatPlayTime(st.ms), style).setOrigin(0.5, 0);
        this.add.text(col.guide, y, String(st.guides), style).setOrigin(0.5, 0);
        this.add.text(col.nudge, y, String(st.nudges), style).setOrigin(0.5, 0);
      }
      y += 22;
    }
    const house = s.stats['house'];
    const total = playMs(s, Object.keys(s.stats));
    y += 10;
    this.add.text(col.name, y, `합계 ${formatPlayTime(total)}${house ? ` (그중 나의 집 ${formatPlayTime(house.ms)})` : ''}`, { ...row, color: '#d8c9a3' });
    this.add
      .text(width / 2, y + 34, '지인 테스트 중이라면 이 화면을 캡처해서 보내 주세요.\n어디서 오래 머물고 막혔는지 알 수 있어요.', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#a49dc0',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
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
