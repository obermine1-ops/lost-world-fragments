import Phaser from 'phaser';
import { FONT } from '../ui';
import { DIRECTIONS } from '../actor';
import { MAPS } from '../state';

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

    this.load.image('tiles-floor', 'assets/tilesets/TilesetFloor.png');
    this.load.image('tiles-water', 'assets/tilesets/TilesetWater.png');
    this.load.image('tiles-nature', 'assets/tilesets/TilesetNature.png');
    for (const key of MAPS) this.load.tilemapTiledJSON(key, `maps/${key}.json`);
    this.load.spritesheet('hero', 'assets/actors/hero.png', { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    this.createActorAnims('hero');
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
