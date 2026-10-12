import Phaser from 'phaser';
import { WorldColor } from '../worldColor';
import { createAmbience } from './game/ambience';

export interface TitleBackdropData {
  colored: boolean; // 봄 들판을 되찾았으면 컬러 + 꽃잎
}

// 타이틀 뒤 배경: 봄 들판(나의 집 근처)이 천천히 옆으로 흐른다. 아직 색을 되찾지 않았으면 흑백.
// 타이틀 장면 아래에 깔리고, 타이틀이 끝나면 같이 멈춘다 (TitleScene).
export class TitleBackdropScene extends Phaser.Scene {
  constructor() {
    super('TitleBackdrop');
  }

  create(data: TitleBackdropData) {
    const map = this.make.tilemap({ key: 'meadow-a' });
    const tilesets = [
      map.addTilesetImage('TilesetFloor', 'tiles-floor')!,
      map.addTilesetImage('TilesetWater', 'tiles-water')!,
      map.addTilesetImage('TilesetNature', 'tiles-nature')!,
      map.addTilesetImage('TilesetVillageAbandoned', 'tiles-ruins')!,
      map.addTilesetImage('TilesetHouse', 'tiles-house')!,
      map.addTilesetImage('TilesetField', 'tiles-field')!,
    ];
    for (const name of ['ground', 'decor', 'above']) map.createLayer(name, tilesets);

    const cam = this.cameras.main;
    cam.setZoom(2).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    // 집 근처에서 시작해 들판을 천천히 오간다
    cam.centerOn(320, 668); // 나의 집 (봄 들판 오른쪽 아래)
    this.tweens.add({ targets: cam, scrollX: cam.scrollX - 170, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    new WorldColor(this, cam, data.colored);
    if (data.colored) createAmbience(this, 'spring');
  }
}
