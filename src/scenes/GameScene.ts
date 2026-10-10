import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { WorldColor } from '../worldColor';
import type { PuzzleData } from './PuzzleScene';
import { ActorAnimator } from '../actor';
import { NavGrid, type Point } from '../pathfinding';

// 타일 16px 그림을 2배로 확대해 보여준다. (폰 화면에 가로 약 11칸 × 세로 20칸)
const ZOOM = 2;
const PLAYER_SPEED = 60;
const ARRIVE_DISTANCE = 2;
const STUCK_CHECK_MS = 250;
const STUCK_MIN_PROGRESS = 3;
const TOTAL_FRAGMENTS = 1;
// 발밑 충돌 상자의 절반 크기 (가로 10 × 세로 6)
const FEET_HALF_W = 5;
const FEET_HALF_H = 3;

// 그리는 순서 (숫자가 클수록 위)
const DEPTH = { ground: 0, decor: 1, marker: 5, actor: 10, above: 20 };

// 캐릭터·물건끼리는 화면 아래쪽(y가 큰 쪽)에 있는 것이 앞에 보이게 한다.
function sortByY(obj: Phaser.GameObjects.Components.Depth & { y: number }) {
  obj.setDepth(DEPTH.actor + obj.y / 10000);
}

// 들판 탐험 장면.
// 화면은 카메라 두 대로 나눠 그린다: 들판 카메라(확대 + 흑백 효과)와 UI 카메라(원래 크기, 항상 컬러).
export class GameScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private player!: Phaser.GameObjects.Sprite;
  private playerAnim!: ActorAnimator;
  private nav!: NavGrid;
  private path: Point[] = [];
  private progressCheckAt = 0;
  private progressDistance = 0;
  private fpsText?: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private color!: WorldColor;
  private fragmentsFound = 0;

  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;
    this.path = [];
    this.fragmentsFound = 0;
    this.world = this.add.layer();
    this.ui = this.add.layer();

    const map = this.make.tilemap({ key: 'meadow-a' });
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

    const spot = (name: string) => {
      const o = map.findObject('objects', (obj) => obj.name === name);
      return { x: o?.x ?? map.widthInPixels / 2, y: o?.y ?? map.heightInPixels / 2 };
    };

    const start = spot('start');
    this.player = this.add.sprite(start.x, start.y, 'hero', 0);
    this.world.add(this.player);
    this.playerAnim = new ActorAnimator(this.player, 'hero');
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // 발밑만 부딪히게 해서 나무 윗부분 뒤로는 지나갈 수 있게 한다.
    body.setSize(FEET_HALF_W * 2, FEET_HALF_H * 2).setOffset(8 - FEET_HALF_W, 16 - FEET_HALF_H * 2).setCollideWorldBounds(true);
    // 장애물에 비스듬히 닿으면 미끄러지듯 비켜 가고, 정면으로 막히면 update에서 멈춘다.
    this.physics.add.collider(this.player, collide);

    const f = spot('fragment');
    const fragment = this.createFragment(f.x, f.y);
    const pickup = this.physics.add.overlap(this.player, fragment, () => {
      pickup.destroy();
      this.collectFragment(fragment);
    });

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    const cam = this.cameras.main;
    cam.setZoom(ZOOM).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.ignore(this.ui);
    this.color = new WorldColor(this, cam);

    const uiCam = this.cameras.add(0, 0, width, height);
    uiCam.ignore(this.world);

    this.createHud();
    if (!this.color.supported) this.showWebGlWarning(width);
    // 개발용 UI(FPS, 테스트 버튼)는 개발 서버에서만 보이고 배포본에는 없다.
    if (import.meta.env.DEV) this.createDevUi(width, height);

    fadeIn(this);

    // 버튼 위를 누른 경우는 이동으로 치지 않는다.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const p = cam.getWorldPoint(pointer.x, pointer.y);
      this.moveTo(p.x, p.y);
    });
  }

  update() {
    this.fpsText?.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    const velocity = (this.player.body as Phaser.Physics.Arcade.Body).velocity;
    this.playerAnim.update(velocity.x, velocity.y);
    sortByY(this.player);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
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

  // 반짝이며 둥실거리는 기억의 조각 (임시 도형: 빛무리 + 마름모)
  private createFragment(x: number, y: number) {
    const glow = this.add.circle(0, 0, 9, 0xfff3b0, 0.35);
    const gem = this.add.rectangle(0, 0, 7, 7, 0x9be7ff).setStrokeStyle(1, 0xffffff).setAngle(45);
    const fragment = this.add.container(x, y, [glow, gem]);
    fragment.setSize(14, 14);
    sortByY(fragment);
    this.world.add(fragment);
    this.physics.add.existing(fragment, true);

    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: gem, y: -3, duration: 1100, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    return fragment;
  }

  private collectFragment(fragment: Phaser.GameObjects.Container) {
    this.tweens.killTweensOf(fragment.list);
    this.tweens.add({
      targets: fragment,
      scale: 1.8,
      alpha: 0,
      y: fragment.y - 10,
      duration: 500,
      onComplete: () => fragment.destroy(),
    });

    this.fragmentsFound += 1;
    this.updateHud();
    this.showMessage('기억의 조각을 찾았다');
    this.time.delayedCall(1600, () => this.openPuzzle());
  }

  // 퍼즐로 기억을 되찾으면 들판에 색이 돌아오고, 잠시 머문 뒤 끝 화면으로 간다.
  private restoreWorld() {
    this.color.restore(() => {
      this.showMessage('들판에 색이 돌아왔다');
      this.time.delayedCall(3000, () => fadeTo(this, 'End'));
    });
  }

  private createHud() {
    this.hudText = this.add.text(8, 8, '', {
      fontFamily: FONT,
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 8, y: 4 },
    });
    this.ui.add(this.hudText);
    this.updateHud();
  }

  private updateHud() {
    this.hudText.setText(`◆ 기억의 조각 ${this.fragmentsFound}/${TOTAL_FRAGMENTS}`);
  }

  // 화면 가운데에 잠깐 떠올랐다 사라지는 안내 문구
  private showMessage(text: string) {
    const { width, height } = this.scale;
    const message = this.add
      .text(width / 2, height * 0.4, text, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.ui.add(message);

    this.tweens.chain({
      targets: message,
      tweens: [
        { alpha: 1, y: '-=10', duration: 300 },
        { alpha: 1, duration: 1400 },
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
      addButton(this, width - 70, 28, '색 (테스트)', () => {
        if (color.isAnimating) return;
        if (color.isGray) color.restore();
        else color.fade();
      }, 120, 40),
    );
    this.ui.add(addButton(this, width - 70, 76, '퍼즐 (테스트)', () => this.openPuzzle(false), 120, 40));
    this.ui.add(addButton(this, width - 70, 124, '끝내기 (테스트)', () => fadeTo(this, 'End'), 120, 40));
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

  // 들판을 멈추고 그 위에 퍼즐을 띄운다. 퍼즐이 끝나면 들판으로 돌아와 색을 되찾는다.
  // (개발용 테스트 버튼에서는 restore=false로 퍼즐만 확인한다)
  private openPuzzle(restore = true) {
    this.stopMoving();
    this.scene.pause();
    this.scene.launch('Puzzle', {
      pairs: 2,
      onComplete: () => {
        this.scene.stop('Puzzle');
        this.scene.resume();
        if (restore) this.restoreWorld();
      },
    } satisfies PuzzleData);
  }
}
