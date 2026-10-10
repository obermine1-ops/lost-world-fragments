import Phaser from 'phaser';
import { FONT, addButton, addMuteButton, fadeIn, fadeTo } from '../ui';
import { music, sfx } from '../sound';
import { WorldColor } from '../worldColor';
import type { PuzzleData } from './PuzzleScene';
import type { MemoryData } from './MemoryScene';
import { ActorAnimator } from '../actor';
import { NavGrid, type Point } from '../pathfinding';
import { game } from '../state';
import { saveGame } from '../save';
import { REGIONS, regionOf, regionsOf, seasonOf, type Region } from '../regions';
import { itemOf, withJosa } from '../items';
import { Pet } from '../pet';
import type { CollectionData } from './CollectionScene';

// 타일 16px 그림을 2배로 확대해 보여준다. (폰 화면에 가로 약 11칸 × 세로 20칸)
const ZOOM = 2;
const PLAYER_SPEED = 60;
const ARRIVE_DISTANCE = 2;
const STUCK_CHECK_MS = 250;
const STUCK_MIN_PROGRESS = 3;
// 발밑 충돌 상자의 절반 크기 (가로 10 × 세로 6)
const FEET_HALF_W = 5;
const FEET_HALF_H = 3;
const SAVE_EVERY_MS = 3000;
const ALTAR_REACH = 20;
const TOUCH_REACH = 18; // 너구리·흙더미에 다가갔다고 보는 거리

// 그리는 순서 (숫자가 클수록 위)
const DEPTH = { ground: 0, decor: 1, marker: 5, actor: 10, above: 20 };

// 타일셋 안의 그림 번호
const DEAD_TREE = [4, 5, 28, 29]; // 시든 나무 2×2 (TilesetNature)
const ALTAR_EMPTY = 38; // 빈 홈이 있는 받침돌 (TilesetDungeon)
const ALTAR_FILLED = 27; // 구슬이 올라간 받침돌 — 보석 색으로 물들인다
const DIRT_MOUND = 448; // 흙더미 (TilesetNature)
const RUBBLE = [86, 87, 88, 89, 90]; // 돌무더기 (TilesetVillageAbandoned)
const LOCKED_DOOR = 0; // 열쇠 구멍이 있는 문 (TilesetDungeon)

// 지도 물체에 붙은 사용자 정의 값 (예: 길목의 도착 지도 이름)
function prop(obj: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
  return (obj.properties as { name: string; value: string }[] | undefined)?.find((p) => p.name === name)?.value;
}

// 캐릭터·물건끼리는 화면 아래쪽(y가 큰 쪽)에 있는 것이 앞에 보이게 한다.
function sortByY(obj: Phaser.GameObjects.Components.Depth & { y: number }) {
  obj.setDepth(DEPTH.actor + obj.y / 10000);
}

// 다가가면 한 번 반응하는 지점 (멀어졌다 다시 오면 또 반응)
interface Spot {
  x: number;
  y: number;
  reach: number;
  near: boolean;
  onReach: () => void;
}

interface Barrier {
  id: string;
  unlock: string;
  sprites: Phaser.GameObjects.Image[];
  zone: Phaser.GameObjects.Zone;
  tiles: Point[];
}

// 들판 탐험 장면.
// 화면은 카메라 세 대로 나눠 그린다:
//   들판 카메라(확대 + 흑백 효과) → 빛나는 물건 카메라(확대, 효과 없음 — 조각·보석·제단은 늘 컬러) → UI 카메라
export class GameScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  private glow!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private region?: Region;
  private player!: Phaser.GameObjects.Sprite;
  private playerAnim!: ActorAnimator;
  private nav!: NavGrid;
  private path: Point[] = [];
  private progressCheckAt = 0;
  private progressDistance = 0;
  private fpsText?: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private color!: WorldColor;
  private leaving = false;
  private busy = false; // 제단 연출·퍼즐 중
  private lastSaveAt = 0;
  private altar?: Phaser.GameObjects.Image;
  private barriers: Barrier[] = [];
  private spots: Spot[] = [];
  private pet?: Pet;

  constructor() {
    super('Game');
  }

  // spawn: 다른 지역에서 넘어왔을 때 나타날 지점 이름
  create(data: { spawn?: string } = {}) {
    const { width, height } = this.scale;
    const state = game.state;
    this.path = [];
    this.leaving = false;
    this.busy = false;
    this.altar = undefined;
    this.barriers = [];
    this.spots = [];
    this.pet = undefined;
    this.region = regionOf(state.map);
    this.world = this.add.layer();
    this.glow = this.add.layer();
    this.ui = this.add.layer();

    const map = this.make.tilemap({ key: state.map });
    const tilesets = [
      map.addTilesetImage('TilesetFloor', 'tiles-floor')!,
      map.addTilesetImage('TilesetWater', 'tiles-water')!,
      map.addTilesetImage('TilesetNature', 'tiles-nature')!,
      map.addTilesetImage('TilesetVillageAbandoned', 'tiles-ruins')!,
    ];
    const layer = (name: string, depth: number) => {
      const l = map.createLayer(name, tilesets)!.setDepth(depth);
      this.world.add(l);
      return l;
    };
    layer('ground', DEPTH.ground);
    layer('decor', DEPTH.decor);
    layer('above', DEPTH.above);
    const collide = map.createLayer('collide', tilesets)!.setVisible(false);
    collide.setCollisionByExclusion([-1]);
    const blocked: boolean[] = [];
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) blocked.push(collide.getTileAt(x, y) !== null);
    this.nav = new NavGrid(map.width, map.height, map.tileWidth, blocked);

    const objects = map.getObjectLayer('objects')?.objects ?? [];
    const spot = (name: string) => {
      const o = objects.find((obj) => obj.name === name);
      return o ? { x: o.x!, y: o.y! } : undefined;
    };

    // 어디에 나타날지: 다른 지역에서 넘어옴 → 그 길목 / 이어하기 → 마지막 위치 / 처음 → 시작 지점
    const start = (data.spawn && spot(data.spawn)) ||
      (state.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : undefined) ||
      spot('start') || { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
    this.player = this.add.sprite(start.x, start.y, 'hero', 0);
    this.world.add(this.player);
    this.playerAnim = new ActorAnimator(this.player, 'hero');
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // 발밑만 부딪히게 해서 나무 윗부분 뒤로는 지나갈 수 있게 한다.
    body.setSize(FEET_HALF_W * 2, FEET_HALF_H * 2).setOffset(8 - FEET_HALF_W, 16 - FEET_HALF_H * 2).setCollideWorldBounds(true);
    // 장애물에 비스듬히 닿으면 미끄러지듯 비켜 가고, 정면으로 막히면 update에서 멈춘다.
    this.physics.add.collider(this.player, collide);

    if (state.pet) this.addPet(start.x - 14, start.y + 4);
    this.placeObjects(objects);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    const cam = this.cameras.main;
    const follow = (c: Phaser.Cameras.Scene2D.Camera) => {
      c.setZoom(ZOOM).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      c.startFollow(this.player, true, 0.12, 0.12);
      c.centerOn(this.player.x, this.player.y);
    };
    follow(cam);
    cam.ignore([this.glow, this.ui]);
    this.color = new WorldColor(this, cam, state.restored.includes(state.map));

    const glowCam = this.cameras.add(0, 0, width, height);
    follow(glowCam);
    glowCam.ignore([this.world, this.ui]);

    const uiCam = this.cameras.add(0, 0, width, height);
    uiCam.ignore([this.world, this.glow]);

    this.createHud();
    if (!this.color.supported) this.showWebGlWarning(width);
    // 개발용 UI(FPS, 테스트 버튼)는 개발 서버에서만 보이고 배포본에는 없다.
    if (import.meta.env.DEV) this.createDevUi(width, height);

    // 처음 시작한 순간(아직 한 번도 저장된 위치가 없음)에만 조작 안내를 보여 준다.
    const firstTime = !data.spawn && state.x === undefined && state.map === 'meadow-a';
    this.playRegionMusic();

    // 지역에 들어오면 저장. 걷는 동안에도 가끔, 앱을 내리거나 끌 때도 위치를 저장한다.
    this.savePosition();
    this.lastSaveAt = this.time.now;
    const onHide = () => {
      if (document.visibilityState === 'hidden') this.savePosition();
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', onHide));

    fadeIn(this);
    const mapProps = map.properties as { name: string; value: string | boolean }[];
    const title = mapProps.find((p) => p.name === 'title')?.value as string | undefined;
    if (mapProps.find((p) => p.name === 'dark')?.value) this.addDarkness(width, height);
    if (title) this.time.delayedCall(300, () => this.showMessage(title));
    const tapHint = firstTime ? this.showTapHint(width, height) : undefined;

    // 버튼 위를 누른 경우는 이동으로 치지 않는다.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.busy) return;
      tapHint?.destroy();
      const p = cam.getWorldPoint(pointer.x, pointer.y);
      this.moveTo(p.x, p.y);
    });
  }

  update(_time: number, delta: number) {
    this.fpsText?.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerAnim.update(body.velocity.x, body.velocity.y);
    sortByY(this.player);
    if (this.pet) {
      this.pet.update(delta, body.center);
      sortByY(this.pet.sprite);
    }
    if (this.time.now - this.lastSaveAt > SAVE_EVERY_MS) {
      this.lastSaveAt = this.time.now;
      this.savePosition();
    }
    this.checkSpots(body.center);

    const waypoint = this.path[0];
    if (!waypoint) return;
    // 발밑(충돌 상자 가운데)이 경로 지점에 닿으면 다음 지점으로
    const distance = Phaser.Math.Distance.Between(body.center.x, body.center.y, waypoint.x, waypoint.y);
    if (distance < ARRIVE_DISTANCE) {
      this.path.shift();
      if (this.path.length === 0) this.stopMoving();
      else this.resetProgress();
      return;
    }

    const angle = Phaser.Math.Angle.Between(body.center.x, body.center.y, waypoint.x, waypoint.y);
    body.setVelocity(Math.cos(angle) * PLAYER_SPEED, Math.sin(angle) * PLAYER_SPEED);

    // 일정 시간 동안 지점에 거의 가까워지지 않았다면 막힌 것으로 보고 멈춘다. (길 찾기가 빗나간 경우 대비)
    if (this.time.now - this.progressCheckAt > STUCK_CHECK_MS) {
      if (this.progressDistance - distance < STUCK_MIN_PROGRESS) this.stopMoving();
      this.progressCheckAt = this.time.now;
      this.progressDistance = distance;
    }
  }

  // ── 지도 위 물건 배치 ──────────────────────────────────────

  private placeObjects(objects: Phaser.Types.Tilemaps.TiledObject[]) {
    const state = game.state;
    const region = this.region;

    for (const o of objects) {
      const id = prop(o, 'id');
      if (o.name === 'fragment' && id && !state.fragments.includes(id)) {
        const fragment = this.createFragment(o.x!, o.y!);
        this.onTouch(fragment, () => this.collectFragment(fragment, id));
      }
      if (o.name === 'gem' && id && region && !state.gems.includes(id)) {
        const gem = this.createGem(o.x!, o.y!, region);
        this.onTouch(gem, () => this.collectGem(gem, id, region));
      }
      if (o.name === 'altar' && region) {
        const restored = state.restored.includes(region.key);
        this.altar = this.add.image(o.x!, o.y!, 'dungeon-sheet', restored ? ALTAR_FILLED : ALTAR_EMPTY);
        if (restored) this.altar.setTint(region.gemColor);
        sortByY(this.altar);
        this.glow.add(this.altar);
        this.addSpot(o.x!, o.y! + 4, ALTAR_REACH, () => this.useAltar(region));
      }
      if (o.name === 'pet' && !state.pet) this.placeWaitingPet(o.x!, o.y!);
      if (o.name === 'dig' && id && !state.dug.includes(id)) this.placeMound(o.x!, o.y!, id, prop(o, 'reward')!);
      if (o.name === 'barrier') this.placeBarrier(o);
      // 지역 길목: 들어서면 화면이 어두워졌다가 다음 지역의 길목에서 나타난다.
      if (o.name === 'exit') {
        const zone = this.add.zone(o.x!, o.y!, o.width!, o.height!).setOrigin(0);
        this.world.add(zone);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, () => this.leaveTo(prop(o, 'to')!, prop(o, 'spawn')!));
      }
    }
  }

  // 플레이어가 처음 닿을 때 한 번만 실행
  private onTouch(obj: Phaser.GameObjects.GameObject, action: () => void) {
    const overlap = this.physics.add.overlap(this.player, obj, () => {
      overlap.destroy();
      action();
    });
  }

  // 반짝이며 둥실거리는 기억의 조각 (임시 도형: 빛무리 + 마름모)
  private createFragment(x: number, y: number) {
    const glow = this.add.circle(0, 0, 9, 0xfff3b0, 0.35);
    const gem = this.add.rectangle(0, 0, 7, 7, 0x9be7ff).setStrokeStyle(1, 0xffffff).setAngle(45);
    const fragment = this.add.container(x, y, [glow, gem]);
    fragment.setSize(14, 14);
    sortByY(fragment);
    this.glow.add(fragment);
    this.physics.add.existing(fragment, true);

    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: gem, y: -3, duration: 1100, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    return fragment;
  }

  private createGem(x: number, y: number, region: Region) {
    const glow = this.add.circle(0, 0, 8, region.gemColor, 0.3);
    const img = this.add.image(0, 0, `gem-${region.gem}`).setScale(0.8);
    if (region.gemTint) img.setTint(region.gemTint);
    const gem = this.add.container(x, y, [glow, img]);
    gem.setSize(14, 14);
    sortByY(gem);
    this.glow.add(gem);
    this.physics.add.existing(gem, true);
    this.tweens.add({ targets: glow, scale: 1.6, alpha: 0.05, duration: 1000, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: img, y: -2, duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    return gem;
  }

  // 길을 막는 것: 시든 나무(지역 복원 시) / 돌무더기(너구리가 파면) / 잠긴 문(열쇠가 있으면)
  private placeBarrier(o: Phaser.Types.Tilemaps.TiledObject) {
    const state = game.state;
    const id = prop(o, 'id')!;
    const unlock = prop(o, 'unlock')!;
    const look = prop(o, 'look')!;
    if (unlock.startsWith('restore:') ? state.restored.includes(unlock.slice(8)) : state.opened.includes(id)) return;

    const sprites: Phaser.GameObjects.Image[] = [];
    const tiles: Point[] = [];
    const tx0 = Math.floor(o.x! / 16);
    const ty0 = Math.floor(o.y! / 16);
    const tw = Math.round(o.width! / 16);
    const th = Math.round(o.height! / 16);
    const put = (tx: number, ty: number, sheet: string, frame: number, depth: number) => {
      const img = this.add.image(tx * 16 + 8, ty * 16 + 8, sheet, frame).setDepth(depth);
      this.world.add(img);
      sprites.push(img);
    };
    for (let ty = ty0; ty < ty0 + th; ty++)
      for (let tx = tx0; tx < tx0 + tw; tx++) {
        tiles.push({ x: tx, y: ty });
        this.nav.setBlocked(tx, ty, true);
        if (look === 'rubble') put(tx, ty, 'ruins-sheet', RUBBLE[(tx * 7 + ty * 3) % RUBBLE.length], DEPTH.decor + 0.5);
        if (look === 'door') put(tx, ty, 'dungeon-sheet', LOCKED_DOOR, DEPTH.decor + 0.5);
        // 시든 나무는 2×2 그림이라 두 칸마다 하나
        if (look === 'dead-tree' && (tx - tx0) % 2 === 0 && (ty - ty0) % 2 === 0)
          DEAD_TREE.forEach((frame, i) => put(tx + (i % 2), ty + Math.floor(i / 2), 'nature-sheet', frame, i < 2 ? DEPTH.above : DEPTH.decor + 0.5));
      }
    const zone = this.add.zone(o.x!, o.y!, o.width!, o.height!).setOrigin(0);
    this.world.add(zone);
    this.physics.add.existing(zone, true);
    this.physics.add.collider(this.player, zone);
    const barrier: Barrier = { id, unlock, sprites, zone, tiles };
    this.barriers.push(barrier);

    // 잠긴 문: 다가가면 열쇠가 있는지 확인한다.
    if (unlock.startsWith('key:')) {
      const key = unlock.slice(4);
      const spot = this.addSpot(o.x! + o.width! / 2, o.y! + o.height! / 2, ALTAR_REACH + 4, () => {
        if (!state.items.includes(key)) {
          this.showMessage('단단히 잠겨 있다…\n어딘가에 열쇠가 있을 것 같다');
          return;
        }
        this.spots = this.spots.filter((s) => s !== spot);
        this.openBarrier(id);
        this.showMessage(`${withJosa(itemOf(key)?.name ?? key, '으로', '로')} 문을 열었다`);
      });
    }
  }

  // 막힌 길을 연다 (기록해 두어 다시 막히지 않는다)
  private openBarrier(id: string) {
    if (!game.state.opened.includes(id)) game.state.opened.push(id);
    sfx(this, 'secret', 0.5);
    this.removeBarriers((b) => b.id === id);
    this.savePosition();
  }

  private removeBarriers(match: (b: Barrier) => boolean) {
    for (const b of this.barriers.filter(match)) {
      this.tweens.add({
        targets: b.sprites,
        alpha: 0,
        scaleY: 0.2,
        duration: 900,
        onComplete: () => b.sprites.forEach((t) => t.destroy()),
      });
      b.zone.destroy();
      for (const t of b.tiles) this.nav.setBlocked(t.x, t.y, false);
    }
    this.barriers = this.barriers.filter((b) => !match(b));
  }

  // ── 줍기 ─────────────────────────────────────────────────

  private pickupEffect(obj: Phaser.GameObjects.Container) {
    this.tweens.killTweensOf(obj.list);
    this.tweens.add({
      targets: obj,
      scale: 1.8,
      alpha: 0,
      y: obj.y - 10,
      duration: 500,
      onComplete: () => obj.destroy(),
    });
  }

  private collectFragment(fragment: Phaser.GameObjects.Container, id: string) {
    this.pickupEffect(fragment);
    sfx(this, 'pickup');
    game.state.fragments.push(id);
    this.savePosition();
    this.updateHud();
    this.showMessage('기억의 조각을 찾았다');
  }

  private collectGem(gem: Phaser.GameObjects.Container, id: string, region: Region) {
    this.pickupEffect(gem);
    sfx(this, 'gem');
    game.state.gems.push(id);
    this.savePosition();
    this.updateHud();
    this.showMessage(`${region.gemName} 보석을 찾았다`);
  }

  // ── 다가가면 반응하는 지점 (제단·너구리·흙더미) ───────────────

  private addSpot(x: number, y: number, reach: number, onReach: () => void) {
    const spot: Spot = { x, y, reach, near: false, onReach };
    this.spots.push(spot);
    return spot;
  }

  // 지점에 다가간 순간 한 번 반응한다. (멀어졌다 다시 오면 또 반응) 연출 중에는 반응하지 않는다.
  private checkSpots(feet: Point) {
    for (const spot of [...this.spots]) {
      const near = Phaser.Math.Distance.Between(feet.x, feet.y, spot.x, spot.y) < spot.reach;
      if (near && !spot.near && !this.busy) spot.onReach();
      spot.near = near;
    }
  }

  // ── 너구리 ───────────────────────────────────────────────

  // 아직 동료가 아닌 너구리: 흑백 세상에서 웅크리고 있다.
  private placeWaitingPet(x: number, y: number) {
    const sprite = this.add.sprite(x, y, 'pet', 0).setFlipX(true);
    sortByY(sprite);
    this.world.add(sprite);
    this.tweens.add({ targets: sprite, scaleY: 0.92, duration: 800, yoyo: true, repeat: -1 });
    const spot = this.addSpot(x, y, TOUCH_REACH, () => {
      this.spots = this.spots.filter((s) => s !== spot);
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      this.addPet(x, y);
      // 동료가 된 순간 너구리에게 먼저 색이 돌아온다.
      this.tweens.add({ targets: this.pet!.sprite, scale: 1.4, duration: 250, yoyo: true });
      game.state.pet = true;
      sfx(this, 'pet');
      this.savePosition();
      this.showMessage('외로워 보이던 너구리가\n졸졸 따라오기 시작했다');
      this.time.delayedCall(2700, () => this.showMessage('너구리와 함께라면\n흙더미를 파 볼 수 있을 것 같다'));
    });
  }

  // 동료 너구리는 흑백 세상에서도 컬러로 보인다.
  private addPet(x: number, y: number) {
    this.pet = new Pet(this, x, y);
    const sprite = this.pet.sprite;
    sortByY(sprite);
    this.glow.add(sprite);
    // 너구리를 탭하면 쓰다듬어 준다 (하트)
    sprite.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      sfx(this, 'pet', 0.5);
      this.tweens.add({ targets: sprite, scaleY: 0.8, duration: 90, yoyo: true, repeat: 1 });
      const heart = this.add.text(sprite.x, sprite.y - 10, '♥', { fontFamily: FONT, fontSize: '10px', color: '#ff7aa2' });
      heart.setOrigin(0.5).setDepth(DEPTH.above).setResolution(4);
      this.glow.add(heart);
      this.tweens.add({ targets: heart, y: heart.y - 12, alpha: 0, duration: 900, onComplete: () => heart.destroy() });
    });
  }

  // ── 흙더미 ───────────────────────────────────────────────

  private placeMound(x: number, y: number, id: string, reward: string) {
    const mound = this.add.image(x, y, 'nature-sheet', DIRT_MOUND);
    mound.setDepth(DEPTH.decor + 0.5);
    this.world.add(mound);
    // 가끔 들썩여서 눈에 띄게 한다.
    this.tweens.add({ targets: mound, y: y - 1, duration: 120, yoyo: true, repeat: 1, repeatDelay: 80, loop: -1, loopDelay: 2200 });
    const spot = this.addSpot(x, y, TOUCH_REACH + 4, () => {
      if (!this.pet) {
        this.showMessage('흙이 볼록 솟아 있다…\n땅을 잘 파는 친구가 있으면 좋을 텐데');
        return;
      }
      this.spots = this.spots.filter((s) => s !== spot);
      this.dig(mound, id, reward);
    });
  }

  // 너구리가 흙더미로 달려가 파내면, 묻혀 있던 것이 튀어나온다.
  private dig(mound: Phaser.GameObjects.Image, id: string, reward: string) {
    const pet = this.pet!;
    this.busy = true;
    this.stopMoving();
    pet.runTo(mound.x - 6, mound.y + 2, () => {
      pet.sprite.setFlipX(false);
      sfx(this, 'dig', 0.7);
      this.tweens.add({ targets: pet.sprite, x: pet.sprite.x + 1.5, duration: 60, yoyo: true, repeat: 7 });
      for (let i = 0; i < 6; i++) {
        const dust = this.add.circle(mound.x, mound.y + 2, 1.5, 0xc9a26b).setDepth(DEPTH.above);
        this.world.add(dust);
        this.tweens.add({
          targets: dust,
          x: mound.x + Phaser.Math.Between(-10, 10),
          y: mound.y - Phaser.Math.Between(4, 12),
          alpha: 0,
          duration: 500,
          delay: i * 120,
          onComplete: () => dust.destroy(),
        });
      }
      this.time.delayedCall(1000, () => {
        this.tweens.killTweensOf(mound);
        this.tweens.add({ targets: mound, alpha: 0, scale: 0.4, duration: 300, onComplete: () => mound.destroy() });
        game.state.dug.push(id);
        this.revealReward(mound.x, mound.y, reward);
        this.busy = false;
      });
    });
  }

  private revealReward(x: number, y: number, reward: string) {
    // 막힌 길을 파서 연다 (돌무더기)
    if (reward.startsWith('open:')) {
      this.openBarrier(reward.slice(5));
      this.showMessage('너구리가 무너진 돌 틈을 파서\n길을 냈다!');
      return;
    }
    const region = this.region;
    const isGem = reward === 'gem' && region;
    sfx(this, isGem ? 'gem' : 'pickup');
    const texture = isGem ? `gem-${region.gem}` : `item-${reward}`;
    const icon = this.add.image(x, y, texture).setDepth(DEPTH.above);
    if (isGem && region.gemTint) icon.setTint(region.gemTint);
    this.glow.add(icon);
    this.tweens.add({
      targets: icon,
      y: y - 18,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: icon, alpha: 0, delay: 700, duration: 400, onComplete: () => icon.destroy() }),
    });

    if (isGem) {
      game.state.gems.push(region.key);
      this.showMessage(`너구리가 ${region.gemName} 보석을 파냈다!`);
    } else {
      game.state.items.push(reward);
      this.showMessage(`너구리가 ${withJosa(itemOf(reward)?.name ?? reward, '을', '를')}\n찾아냈다! (도감에 기록)`);
    }
    this.savePosition();
    this.updateHud();
  }

  // ── 제단 ─────────────────────────────────────────────────

  private useAltar(region: Region) {
    const state = game.state;
    if (state.restored.includes(region.key)) {
      this.showMessage('제단에서 따뜻한 빛이 난다');
      return;
    }
    if (!state.gems.includes(region.key)) {
      this.showMessage(`빈 홈이 있다…\n이 근처 어딘가에 ${region.gemName} 보석이 있을 것 같다`);
      return;
    }
    if (!state.fragments.includes(region.key)) {
      this.showMessage('보석이 반응하지 않는다…\n이 지역의 흩어진 기억이 필요하다');
      return;
    }

    // 보석을 제단에 끼우고 → 퍼즐 → 기억 장면 → 색 복원
    this.busy = true;
    this.stopMoving();
    const altar = this.altar!;
    const gem = this.add.image(this.player.x, this.player.y - 10, `gem-${region.gem}`).setDepth(DEPTH.above);
    if (region.gemTint) gem.setTint(region.gemTint);
    this.glow.add(gem);
    this.tweens.add({
      targets: gem,
      x: altar.x,
      y: altar.y - 4,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        gem.destroy();
        altar.setFrame(ALTAR_FILLED).setTint(region.gemColor);
        this.tweens.add({ targets: altar, scale: 1.3, duration: 200, yoyo: true });
        this.time.delayedCall(700, () => this.openPuzzle(region));
      },
    });
  }

  // 들판을 멈추고 그 위에 퍼즐을 띄운다. 다 맞추면 기억 장면을 보고, 돌아와서 색을 되찾는다.
  private openPuzzle(region: Region, restore = true) {
    this.stopMoving();
    this.scene.pause();
    this.scene.launch('Puzzle', {
      pairs: region.pairs,
      onComplete: () => {
        this.scene.stop('Puzzle');
        if (!restore) {
          this.scene.resume();
          return;
        }
        this.showMemory({ face: region.memory.face, name: region.memory.name, lines: region.memory.lines }, () => {
          this.scene.resume();
          this.restoreRegion(region);
        });
      },
    } satisfies PuzzleData);
  }

  private showMemory(memory: Omit<MemoryData, 'onComplete'>, onDone: () => void) {
    this.scene.launch('Memory', {
      ...memory,
      onComplete: () => {
        this.scene.stop('Memory');
        onDone();
      },
    } satisfies MemoryData);
  }

  // 이 지역에 색이 번져 돌아오고, 막혀 있던 다음 길이 열린다. 세 지역을 모두 되찾으면 엔딩.
  private restoreRegion(region: Region) {
    game.state.restored.push(region.key);
    this.savePosition();
    this.updateHud();
    sfx(this, 'restore', 0.7);
    this.playRegionMusic();
    this.color.restore(() => {
      this.removeBarriers((b) => b.unlock === `restore:${region.key}`);
      const season = seasonOf(region.season);
      const done = regionsOf(region.season).every((r) => game.state.restored.includes(r.key));
      this.showMessage(done ? `${season.name}이 모두 돌아왔다` : '색이 돌아왔다!\n막혀 있던 길이 열린 것 같다');
      if (!done) {
        this.busy = false;
        return;
      }
      this.time.delayedCall(2500, () => {
        this.scene.pause();
        this.showMemory({ lines: season.ending }, () => {
          this.scene.resume(); // 멈춘 장면은 화면 전환(페이드)이 진행되지 않으므로 먼저 깨운다
          fadeTo(this, 'End', { season: region.season });
        });
      });
    });
  }

  // ── 이동 ─────────────────────────────────────────────────

  // 탭한 곳까지 장애물을 돌아가는 길을 찾아 걷는다. 갈 수 없는 곳이면 가장 가까운 곳까지 간다.
  private moveTo(x: number, y: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.path = this.nav.findPath(body.center, { x, y }, FEET_HALF_W, FEET_HALF_H);
    this.resetProgress();
    this.showTapMarker(x, y);
  }

  private resetProgress() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.progressCheckAt = this.time.now;
    const wp = this.path[0];
    this.progressDistance = wp ? Phaser.Math.Distance.Between(body.center.x, body.center.y, wp.x, wp.y) : 0;
  }

  private stopMoving() {
    this.path = [];
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // 다른 지역으로 넘어간다. 퍼즐·연출 중에는 넘어가지 않는다.
  private leaveTo(map: string, spawn: string) {
    if (this.leaving || this.busy || !this.scene.isActive()) return;
    this.leaving = true;
    this.stopMoving();
    game.state.map = map;
    game.state.x = game.state.y = undefined;
    fadeTo(this, 'Game', { spawn });
  }

  private savePosition() {
    if (this.leaving) return;
    game.state.x = Math.round(this.player.x);
    game.state.y = Math.round(this.player.y);
    saveGame(game.state);
  }

  // ── 화면 표시 ────────────────────────────────────────────

  private createHud() {
    this.hudText = this.add.text(8, 8, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 8, y: 5 },
    });
    this.ui.add(this.hudText);
    this.goalText = this.add.text(8, 38, '', {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#ffe9a8',
      backgroundColor: '#00000066',
      padding: { x: 8, y: 4 },
      wordWrap: { width: this.scale.width - 120 },
    });
    this.ui.add(this.goalText);
    this.updateHud();

    this.ui.add(addButton(this, this.scale.width - 40, 24, '도감', () => this.openCollection(), 64, 32));
    this.ui.add(addMuteButton(this, this.scale.width - 48, 62));
  }

  // 지금 무엇을 하면 되는지 한 줄로 알려 준다.
  private currentGoal() {
    const s = game.state;
    const r = this.region;
    if (!r) return '';
    if (s.restored.includes(r.key)) {
      const next = REGIONS[REGIONS.indexOf(r) + 1];
      if (!next) return '';
      if (s.restored.includes(next.key)) return '';
      if (next.season !== r.season) return '목표: 봄 들판 남쪽 길을 따라 바닷가로';
      return '목표: 열린 길을 따라 다음 장소로';
    }
    if (!s.gems.includes(r.key)) {
      if (r.key === 'hill-c' && !s.pet) return '목표: 땅을 파는 친구가 필요하다 (들판의 너구리)';
      return `목표: 이곳 어딘가의 ${r.gemName} 보석 찾기`;
    }
    if (!s.fragments.includes(r.key)) return '목표: 흩어진 기억의 조각 찾기';
    return '목표: 제단에 보석 끼우기';
  }

  private playRegionMusic() {
    const r = this.region;
    if (!r) return;
    if (game.state.restored.includes(r.key)) music(this.game, 'spring');
    else music(this.game, r.key === 'ruins-d' ? 'ruins' : 'gray');
  }

  // 처음 시작했을 때: 손가락 모양 안내가 깜빡이다가, 화면을 한 번 탭하면 사라진다.
  private showTapHint(width: number, height: number) {
    const hint = this.add
      .text(width / 2, height * 0.68, '👆 가고 싶은 곳을 탭해 보세요', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5);
    this.ui.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
    return hint;
  }

  private openCollection() {
    if (this.busy) return;
    this.stopMoving();
    this.scene.pause();
    this.scene.launch('Collection', {
      season: this.region?.season,
      onClose: () => {
        this.scene.stop('Collection');
        this.scene.resume();
      },
    } satisfies CollectionData);
  }

  private updateHud() {
    const s = game.state;
    const season = this.region?.season ?? 'spring';
    const keys = regionsOf(season).map((r) => r.key);
    const count = (list: string[]) => list.filter((k) => keys.includes(k)).length;
    const total = keys.length;
    const icon = season === 'spring' ? '✿' : '☀';
    this.hudText.setText(
      `◆ 조각 ${count(s.fragments)}/${total}   ● 보석 ${count(s.gems)}/${total}   ${icon} ${seasonOf(season).name} ${count(s.restored)}/${total}`,
    );
    const goal = this.currentGoal();
    this.goalText.setText(goal).setVisible(goal !== '');
  }

  // 화면 가운데에 잠깐 떠올랐다 사라지는 안내 문구
  private showMessage(text: string) {
    const { width, height } = this.scale;
    const message = this.add
      .text(width / 2, height * 0.4, text, {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 16, y: 10 },
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.ui.add(message);

    this.tweens.chain({
      targets: message,
      tweens: [
        { alpha: 1, y: '-=10', duration: 300 },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 400 },
      ],
      onComplete: () => message.destroy(),
    });
  }

  // 탭한 곳에 잠깐 퍼지는 동그라미를 보여준다.
  private showTapMarker(x: number, y: number) {
    const marker = this.add.circle(x, y, 3).setStrokeStyle(1, 0xffffff, 0.9).setDepth(DEPTH.marker);
    this.world.add(marker);
    this.tweens.add({
      targets: marker,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: () => marker.destroy(),
    });
  }

  // 화면에 고정되는 개발용 UI
  private createDevUi(width: number, height: number) {
    this.fpsText = this.add
      .text(8, height - 8, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0, 1);
    this.ui.add(this.fpsText);

    const color = this.color;
    this.ui.add(
      addButton(this, width - 70, 108, '색 (테스트)', () => {
        if (color.isAnimating) return;
        if (color.isGray) color.restore();
        else color.fade();
      }, 120, 36),
    );
    const region = this.region ?? REGIONS[0];
    this.ui.add(addButton(this, width - 70, 150, '퍼즐 (테스트)', () => this.openPuzzle(region, false), 120, 36));
    this.ui.add(addButton(this, width - 70, 192, '끝내기 (테스트)', () => fadeTo(this, 'End'), 120, 36));
  }

  // 어두운 곳(유적): 화면 가장자리가 어둡고 가운데(캐릭터 주변)만 밝다.
  private addDarkness(width: number, height: number) {
    if (!this.textures.exists('darkness')) {
      const canvas = this.textures.createCanvas('darkness', width, height)!;
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(width / 2, height / 2, 60, width / 2, height / 2, height * 0.55);
      g.addColorStop(0, 'rgba(8,6,16,0)');
      g.addColorStop(0.55, 'rgba(8,6,16,0.45)');
      g.addColorStop(1, 'rgba(8,6,16,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      canvas.refresh();
    }
    const dark = this.add.image(0, 0, 'darkness').setOrigin(0);
    this.ui.addAt(dark, 0); // HUD·문구보다 아래
  }

  private showWebGlWarning(width: number) {
    this.ui.add(
      this.add
        .text(width / 2, 60, '이 기기는 흑백 효과를 지원하지 않아요 (WebGL 없음)', {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#ffcc00',
        })
        .setOrigin(0.5),
    );
  }
}
