import Phaser from 'phaser';
import { FONT } from '../ui';
import { DIRECTIONS } from '../actor';
import { MAPS } from '../state';
import { REGIONS } from '../regions';
import { RARE_ITEMS } from '../items';

// 게임에 필요한 그림·지도를 처음에 한 번 불러온다.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, '불러오는 중… 0%', { fontFamily: FONT, fontSize: '16px', color: '#999999' })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => label.setText(`불러오는 중… ${Math.round(p * 100)}%`));

    // 지도 타일 (지도용 이미지와, 낱개로 꺼내 쓰는 스프라이트용 두 가지)
    this.load.image('tiles-floor', 'assets/tilesets/TilesetFloor.png');
    this.load.image('tiles-water', 'assets/tilesets/TilesetWater.png');
    this.load.image('tiles-nature', 'assets/tilesets/TilesetNature.png');
    const tile = { frameWidth: 16, frameHeight: 16 };
    this.load.spritesheet('nature-sheet', 'assets/tilesets/TilesetNature.png', tile);
    this.load.spritesheet('dungeon-sheet', 'assets/tilesets/TilesetDungeon.png', tile);
    for (const key of MAPS) this.load.tilemapTiledJSON(key, `maps/${key}.json`);

    this.load.spritesheet('hero', 'assets/actors/hero.png', tile);
    this.load.spritesheet('pet', 'assets/actors/pet.png', tile);
    this.load.image('face-pet', 'assets/actors/pet-face.png');
    for (const item of RARE_ITEMS) this.load.image(`item-${item.id}`, `assets/items/${item.id}.png`);
    for (const r of REGIONS) {
      this.load.image(`gem-${r.gem}`, `assets/items/gem-${r.gem}.png`);
      this.load.image(`face-${r.memory.face}`, `assets/faces/${r.memory.face}.png`);
    }
  }

  create() {
    this.createActorAnims('hero');
    // 동물 그림은 옆모습 2프레임 (오른쪽을 보고 있음 — 왼쪽으로 갈 때는 뒤집는다)
    this.anims.create({ key: 'pet-walk', frames: this.anims.generateFrameNumbers('pet', { frames: [0, 1] }), frameRate: 6, repeat: -1 });
    this.scene.start('Title');
  }

  // 캐릭터 그림(4열 × 7행)은 열이 방향(아래·위·왼·오), 1~4행이 걷기 프레임이다.
  private createActorAnims(key: string) {
    DIRECTIONS.forEach((dir, col) => {
      this.anims.create({
        key: `${key}-walk-${dir}`,
        frames: this.anims.generateFrameNumbers(key, { frames: [0, 1, 2, 3].map((row) => row * 4 + col) }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }
}
