import Phaser from 'phaser';
import { FONT } from '../ui';
import { DIRECTIONS } from '../actor';
import { MAPS } from '../state';
import { REGIONS } from '../regions';
import { RARE_ITEMS } from '../items';
import { SFX } from '../sound';
import { FISH_TEXTURES } from '../fish';

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
    this.load.image('tiles-ruins', 'assets/tilesets/TilesetVillageAbandoned.png');
    this.load.image('tiles-house', 'assets/tilesets/TilesetHouse.png');
    this.load.image('tiles-field', 'assets/tilesets/TilesetField.png');
    const tile = { frameWidth: 16, frameHeight: 16 };
    this.load.spritesheet('nature-sheet', 'assets/tilesets/TilesetNature.png', tile);
    this.load.spritesheet('dungeon-sheet', 'assets/tilesets/TilesetDungeon.png', tile);
    this.load.spritesheet('ruins-sheet', 'assets/tilesets/TilesetVillageAbandoned.png', tile);
    // 나의 집 (실내 벽·바닥·가구)
    this.load.spritesheet('wall-sheet', 'assets/tilesets/TilesetWallSimple.png', tile);
    this.load.spritesheet('ifloor-sheet', 'assets/tilesets/TilesetInteriorFloor.png', tile);
    this.load.spritesheet('element-sheet', 'assets/tilesets/TilesetElement.png', tile);
    this.load.spritesheet('bed-sheet', 'assets/tilesets/tileset_bed.png', tile);
    for (const key of MAPS) this.load.tilemapTiledJSON(key, `maps/${key}.json`);

    this.load.spritesheet('hero', 'assets/actors/hero.png', tile);
    this.load.spritesheet('pet', 'assets/actors/pet.png', tile);
    this.load.spritesheet('frog', 'assets/actors/frog.png', tile);
    this.load.spritesheet('parrot', 'assets/actors/parrot.png', tile);
    this.load.spritesheet('hamster', 'assets/actors/hamster.png', tile);
    this.load.spritesheet('water-sheet', 'assets/tilesets/TilesetWater.png', tile);
    this.load.image('face-pet', 'assets/actors/pet-face.png');
    this.load.image('feather', 'assets/items/feather.png');
    for (const item of RARE_ITEMS) this.load.image(`item-${item.id}`, `assets/items/${item.id}.png`);
    for (const key of FISH_TEXTURES) this.load.image(key, `assets/fish/${key}.png`);
    for (const key of SFX) this.load.audio(`sfx-${key}`, `assets/audio/sfx-${key}.wav`);
    for (const gem of new Set(REGIONS.map((r) => r.gem))) this.load.image(`gem-${gem}`, `assets/items/gem-${gem}.png`);
    for (const face of new Set(REGIONS.map((r) => r.memory.face))) this.load.image(`face-${face}`, `assets/faces/${face}.png`);
  }

  create() {
    this.createActorAnims('hero');
    this.makeGraySheet('hero');
    // 동물 그림은 옆모습 2프레임 (오른쪽을 보고 있음 — 왼쪽으로 갈 때는 뒤집는다)
    for (const key of ['pet', 'frog', 'parrot', 'hamster'])
      this.anims.create({ key: `${key}-walk`, frames: this.anims.generateFrameNumbers(key, { frames: [0, 1] }), frameRate: 6, repeat: -1 });
    this.scene.launch('Audio'); // 배경 음악은 뒤에서 불러온다
    this.scene.start('Title');
  }

  // 그림의 흑백 버전을 한 번 만들어 둔다 ('<key>-gray'). 흑백 지역에서 주인공을 겹쳐 그릴 때 쓴다.
  // (그림 효과로 흑백을 만들면 폰 같은 실제 그래픽 장치에서 투명한 부분까지 네모로 칠해진다)
  private makeGraySheet(key: string) {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    this.textures.addSpriteSheet(`${key}-gray`, canvas as unknown as HTMLImageElement, { frameWidth: 16, frameHeight: 16 });
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
