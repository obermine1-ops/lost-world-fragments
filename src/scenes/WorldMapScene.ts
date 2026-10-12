import Phaser from 'phaser';
import { FONT, addButton, fadeIn } from '../ui';
import { sfx } from '../sound';
import { game } from '../state';
import { FIREFLIES_PER_REGION, REGIONS, SEASONS, regionsOf } from '../regions';

export interface WorldMapData {
  current: string; // 지금 있는 지역
  onTravel: (map: string) => void;
  onHome: () => void;
  onClose: () => void;
}

const ICON = { spring: '✿', summer: '☀', autumn: '✾', winter: '❄' } as const;
const CELL_W = 156;
const CELL_H = 40;
const ROW = 46;

// 지도의 이름 (tools/build-maps.mjs가 지도 파일에 넣어 둔 title)
export function mapTitle(scene: Phaser.Scene, key: string) {
  const props = scene.cache.tilemap.get(key)?.data?.properties as { name: string; value: unknown }[] | undefined;
  return (props?.find((p) => p.name === 'title')?.value as string | undefined) ?? key;
}

// 빠른 이동으로 갈 수 있는 곳: 색을 되찾은 지역, 그리고 지금 되찾아야 할 지역(앞 지역을 되찾은 곳)
export function canTravel(key: string) {
  const s = game.state;
  const i = REGIONS.findIndex((r) => r.key === key);
  return i === 0 || s.restored.includes(key) || s.restored.includes(REGIONS[i - 1].key);
}

export function firefliesFound(key: string) {
  return game.state.fireflies.filter((f) => f.startsWith(`${key}-`)).length;
}

// 세계 지도: 계절별 지역을 눌러 바로 이동한다. 아직 못 간 곳은 ???.
export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super('WorldMap');
  }

  create(data: WorldMapData) {
    const { width, height } = this.scale;
    const s = game.state;
    fadeIn(this);
    this.add.rectangle(0, 0, width, height, 0x14121f, 0.96).setOrigin(0).setInteractive();
    this.add.text(width / 2, 26, '세계 지도', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

    let y = 52;
    for (const season of SEASONS) {
      const regions = regionsOf(season.key);
      this.add.text(20, y, `${ICON[season.key]} ${season.name}`, { fontFamily: FONT, fontSize: '14px', color: '#8f86c9' });
      y += 22 + CELL_H / 2;
      regions.forEach((r, i) => {
        const x = width / 2 + (i % 2 === 0 ? -1 : 1) * (CELL_W / 2 + 4);
        this.cell(x, y + Math.floor(i / 2) * ROW, r.key, data);
      });
      y += Math.ceil(regions.length / 2) * ROW - CELL_H / 2 + 6;
    }

    const close = () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => data.onClose());
    };
    // 봄 들판을 되찾아 집에 색이 돌아온 뒤에는 집으로 바로 갈 수 있다.
    if (s.restored.includes('meadow-a')) {
      addButton(this, width / 2 - 78, height - 34, '나의 집으로', () => data.onHome(), 144, 40);
      addButton(this, width / 2 + 78, height - 34, '닫기', close, 144, 40);
    } else {
      addButton(this, width / 2, height - 34, '닫기', close, 144, 40);
    }
  }

  private cell(x: number, y: number, key: string, data: WorldMapData) {
    const s = game.state;
    const open = canTravel(key);
    const here = key === data.current;
    const restored = s.restored.includes(key);
    const bg = this.add
      .rectangle(x, y, CELL_W, CELL_H, 0x2a2738)
      .setStrokeStyle(2, here ? 0xffe9a8 : open ? 0xd8c9a3 : 0x45405a);
    this.add
      .text(x, y - 8, open ? mapTitle(this, key) : '???', { fontFamily: FONT, fontSize: '14px', color: open ? '#ffffff' : '#6b6584' })
      .setOrigin(0.5);
    if (!open) return;
    const ff = firefliesFound(key);
    const status = here ? '지금 여기' : restored ? '색을 되찾음' : '되찾는 중';
    this.add
      .text(x, y + 9, `${status} · 반딧불 ${ff}/${FIREFLIES_PER_REGION}`, {
        fontFamily: FONT,
        fontSize: '10px',
        color: ff === FIREFLIES_PER_REGION ? '#ffb3e6' : '#a49dc0',
      })
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => bg.setFillStyle(0x433d5c));
    bg.on('pointerout', () => bg.setFillStyle(0x2a2738));
    bg.on('pointerup', () => {
      bg.setFillStyle(0x2a2738);
      sfx(this, 'click', 0.35);
      if (here) data.onClose();
      else data.onTravel(key);
    });
  }
}
