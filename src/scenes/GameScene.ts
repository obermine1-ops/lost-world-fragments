import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { WorldColor } from '../worldColor';
import type { PuzzleData } from './PuzzleScene';
import type { MemoryData } from './MemoryScene';
import { ActorAnimator } from '../actor';
import { NavGrid, type Point } from '../pathfinding';
import { game } from '../state';
import { saveGame } from '../save';
import { ENDING_LINES, REGIONS, regionOf, type Region } from '../regions';

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

// 그리는 순서 (숫자가 클수록 위)
const DEPTH = { ground: 0, decor: 1, marker: 5, actor: 10, above: 20 };

// 타일셋 안의 그림 번호
const DEAD_TREE = [4, 5, 28, 29]; // 시든 나무 2×2 (TilesetNature)
const ALTAR_EMPTY = 38; // 빈 홈이 있는 받침돌 (TilesetDungeon)
const ALTAR_FILLED = 27; // 구슬이 올라간 받침돌 — 보석 색으로 물들인다

// 지도 물체에 붙은 사용자 정의 값 (예: 길목의 도착 지도 이름)
function prop(obj: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
  return (obj.properties as { name: string; value: string }[] | undefined)?.find((p) => p.name === name)?.value;
}

// 캐릭터·물건끼리는 화면 아래쪽(y가 큰 쪽)에 있는 것이 앞에 보이게 한다.
function sortByY(obj: Phaser.GameObjects.Components.Depth & { y: number }) {
  obj.setDepth(DEPTH.actor + obj.y / 10000);
}

interface Barrier {
  region: string;
  trees: Phaser.GameObjects.Image[];
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
  private color!: WorldColor;
  private leaving = false;
  private busy = false; // 제단 연출·퍼즐 중
  private lastSaveAt = 0;
  private altar?: Phaser.GameObjects.Image;
  private nearAltar = false;
  private barriers: Barrier[] = [];

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
    this.nearAltar = false;
    this.barriers = [];
    this.region = regionOf(state.map);
    this.world = this.add.layer();
    this.glow = this.add.layer();
    this.ui = this.add.layer();

    const map = this.make.tilemap({ key: state.map });
    const tilesets = [
      map.addTilesetImage('TilesetFloor', 'tiles-floor')!,
      map.addTilesetImage('TilesetWater', 'tiles-water')!,
      map.addTilesetImage('TilesetNature', 'tiles-nature')!,
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

    // 지역에 들어오면 저장. 걷는 동안에도 가끔, 앱을 내리거나 끌 때도 위치를 저장한다.
    this.savePosition();
    this.lastSaveAt = this.time.now;
    const onHide = () => {
      if (document.visibilityState === 'hidden') this.savePosition();
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', onHide));

    fadeIn(this);
    const title = (map.properties as { name: string; value: string }[]).find((p) => p.name === 'title')?.value;
    if (title) this.time.delayedCall(300, () => this.showMessage(title));

    // 버튼 위를 누른 경우는 이동으로 치지 않는다.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.busy) return;
      const p = cam.getWorldPoint(pointer.x, pointer.y);
      this.moveTo(p.x, p.y);
    });
  }

  update() {
    this.fpsText?.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerAnim.update(body.velocity.x, body.velocity.y);
    sortByY(this.player);
    if (this.time.now - this.lastSaveAt > SAVE_EVERY_MS) {
      this.lastSaveAt = this.time.now;
      this.savePosition();
    }
    this.checkAltar();

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
      }
      if (o.name === 'barrier') {
        const blockedBy = prop(o, 'region')!;
        if (!state.restored.includes(blockedBy)) this.createBarrier(o, blockedBy);
      }
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
    const gem = this.add.container(x, y, [glow, img]);
    gem.setSize(14, 14);
    sortByY(gem);
    this.glow.add(gem);
    this.physics.add.existing(gem, true);
    this.tweens.add({ targets: glow, scale: 1.6, alpha: 0.05, duration: 1000, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: img, y: -2, duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    return gem;
  }

  // 시든 나무 줄: 지나갈 수 없고, 막고 있는 지역이 복원되면 사라진다.
  private createBarrier(o: Phaser.Types.Tilemaps.TiledObject, region: string) {
    const trees: Phaser.GameObjects.Image[] = [];
    const tiles: Point[] = [];
    const tx0 = Math.floor(o.x! / 16);
    const ty0 = Math.floor(o.y! / 16);
    const tw = Math.round(o.width! / 16);
    const th = Math.round(o.height! / 16);
    for (let tx = tx0; tx < tx0 + tw; tx += 2)
      for (let ty = ty0; ty < ty0 + th; ty += 2)
        DEAD_TREE.forEach((frame, i) => {
          const img = this.add.image((tx + (i % 2)) * 16 + 8, (ty + Math.floor(i / 2)) * 16 + 8, 'nature-sheet', frame);
          img.setDepth(i < 2 ? DEPTH.above : DEPTH.decor + 0.5);
          this.world.add(img);
          trees.push(img);
        });
    for (let tx = tx0; tx < tx0 + tw; tx++)
      for (let ty = ty0; ty < ty0 + th; ty++) {
        tiles.push({ x: tx, y: ty });
        this.nav.setBlocked(tx, ty, true);
      }
    const zone = this.add.zone(o.x!, o.y!, o.width!, o.height!).setOrigin(0);
    this.world.add(zone);
    this.physics.add.existing(zone, true);
    this.physics.add.collider(this.player, zone);
    this.barriers.push({ region, trees, zone, tiles });
  }

  private removeBarriers(region: string) {
    for (const b of this.barriers.filter((x) => x.region === region)) {
      this.tweens.add({
        targets: b.trees,
        alpha: 0,
        scaleY: 0.2,
        duration: 900,
        onComplete: () => b.trees.forEach((t) => t.destroy()),
      });
      b.zone.destroy();
      for (const t of b.tiles) this.nav.setBlocked(t.x, t.y, false);
    }
    this.barriers = this.barriers.filter((x) => x.region !== region);
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
    game.state.fragments.push(id);
    this.savePosition();
    this.updateHud();
    this.showMessage('기억의 조각을 찾았다');
  }

  private collectGem(gem: Phaser.GameObjects.Container, id: string, region: Region) {
    this.pickupEffect(gem);
    game.state.gems.push(id);
    this.savePosition();
    this.updateHud();
    this.showMessage(`${region.gemName} 보석을 찾았다`);
  }

  // ── 제단 ─────────────────────────────────────────────────

  // 제단 가까이 다가간 순간 한 번 반응한다. (멀어졌다 다시 오면 또 반응)
  private checkAltar() {
    if (!this.altar || !this.region || this.busy) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const near = Phaser.Math.Distance.Between(body.center.x, body.center.y, this.altar.x, this.altar.y + 4) < ALTAR_REACH;
    if (near && !this.nearAltar) this.useAltar(this.region);
    this.nearAltar = near;
  }

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
    this.color.restore(() => {
      this.removeBarriers(region.key);
      const done = REGIONS.every((r) => game.state.restored.includes(r.key));
      this.showMessage(done ? '봄이 모두 돌아왔다' : '색이 돌아왔다!\n막혀 있던 길이 열린 것 같다');
      if (!done) {
        this.busy = false;
        return;
      }
      this.time.delayedCall(2500, () => {
        this.scene.pause();
        this.showMemory({ lines: ENDING_LINES }, () => {
          this.scene.resume(); // 멈춘 장면은 화면 전환(페이드)이 진행되지 않으므로 먼저 깨운다
          fadeTo(this, 'End');
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
    this.updateHud();
  }

  private updateHud() {
    const s = game.state;
    const total = REGIONS.length;
    this.hudText.setText(`◆ 조각 ${s.fragments.length}/${total}   ● 보석 ${s.gems.length}/${total}   ✿ 봄 ${s.restored.length}/${total}`);
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
      addButton(this, width - 70, 70, '색 (테스트)', () => {
        if (color.isAnimating) return;
        if (color.isGray) color.restore();
        else color.fade();
      }, 120, 36),
    );
    const region = this.region ?? REGIONS[0];
    this.ui.add(addButton(this, width - 70, 112, '퍼즐 (테스트)', () => this.openPuzzle(region, false), 120, 36));
    this.ui.add(addButton(this, width - 70, 154, '끝내기 (테스트)', () => fadeTo(this, 'End'), 120, 36));
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
