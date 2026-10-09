import Phaser from 'phaser';
import { FONT } from '../ui';

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
    this.load.tilemapTiledJSON('meadow-a', 'maps/meadow-a.json');
    this.load.spritesheet('hero', 'assets/actors/hero.png', { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    this.scene.start('Title');
  }
}
