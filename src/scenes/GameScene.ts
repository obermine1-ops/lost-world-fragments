import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { WorldColor } from '../worldColor';

// 들판 크기: 화면(360×640)의 가로·세로 2배
const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 1280;
const PLAYER_SPEED = 110;
const PLAYER_RADIUS = 10;
const ARRIVE_DISTANCE = 4;
const STUCK_CHECK_MS = 250;
const STUCK_MIN_PROGRESS = 6;

// 기억의 조각: 시작 지점에서 길을 따라 올라가다 오른쪽으로 꺾어야 찾을 수 있는 자리
const FRAGMENT_X = 560;
const FRAGMENT_Y = 240;
const TOTAL_FRAGMENTS = 1;

const GRASS = 0x6cc551;
const FLOWER_COLORS = [0xff5a6e, 0xffd23f, 0xff9ad5, 0xa77bff, 0x4fc3ff, 0xffffff];

// 들판 탐험 장면. 그림 없이 도형으로 만든 임시 들판 (실제 맵은 Sprint 2).
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private target?: Phaser.Math.Vector2;
  private progressCheckAt = 0;
  private progressDistance = 0;
  private fpsText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private fragmentsFound = 0;

  constructor() {
    super('Game');
  }

  create() {
    const { width } = this.scale;
    fadeIn(this);
    this.target = undefined;
    this.fragmentsFound = 0;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawMeadow();
    const obstacles = this.createObstacles();
    const fragment = this.createFragment(FRAGMENT_X, FRAGMENT_Y);

    this.player = this.add.circle(WORLD_WIDTH / 2, WORLD_HEIGHT - 120, PLAYER_RADIUS, 0xff8c42);
    this.player.setStrokeStyle(2, 0x5a2d0c);
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER_RADIUS).setCollideWorldBounds(true);
    // 장애물에 비스듬히 닿으면 미끄러지듯 비켜 가고, 정면으로 막히면 update에서 멈춘다.
    this.physics.add.collider(this.player, obstacles);
    const pickup = this.physics.add.overlap(this.player, fragment, () => {
      pickup.destroy();
      this.collectFragment(fragment);
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this.player, true, 0.12, 0.12);

    const color = new WorldColor(this, cam);
    this.createHud();
    this.createDevUi(width, color);

    // 버튼 위를 누른 경우는 이동으로 치지 않는다.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      this.moveTo(pointer.worldX, pointer.worldY);
    });
  }

  update() {
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);

    if (!this.target) return;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
    if (distance < ARRIVE_DISTANCE) {
      this.stopMoving();
      return;
    }

    // 미끄러지는 동안에도 목적지 쪽으로 방향을 다시 잡는다.
    this.physics.moveTo(this.player, this.target.x, this.target.y, PLAYER_SPEED);

    // 일정 시간 동안 목적지에 거의 가까워지지 않았다면 막힌 것으로 보고 멈춘다.
    if (this.time.now - this.progressCheckAt > STUCK_CHECK_MS) {
      if (this.progressDistance - distance < STUCK_MIN_PROGRESS) this.stopMoving();
      this.progressCheckAt = this.time.now;
      this.progressDistance = distance;
    }
  }

  private moveTo(x: number, y: number) {
    this.target = new Phaser.Math.Vector2(x, y);
    this.progressCheckAt = this.time.now;
    this.progressDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    this.physics.moveTo(this.player, x, y, PLAYER_SPEED);
    this.showTapMarker(x, y);
  }

  private stopMoving() {
    this.target = undefined;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // 반짝이며 둥실거리는 기억의 조각 (임시 도형: 빛무리 + 마름모)
  private createFragment(x: number, y: number) {
    const glow = this.add.circle(0, 0, 20, 0xfff3b0, 0.35);
    const gem = this.add.rectangle(0, 0, 14, 14, 0x9be7ff).setStrokeStyle(2, 0xffffff).setAngle(45);
    const fragment = this.add.container(x, y, [glow, gem]);
    fragment.setSize(28, 28);
    this.physics.add.existing(fragment, true);

    this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: gem, y: -5, duration: 1100, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    return fragment;
  }

  private collectFragment(fragment: Phaser.GameObjects.Container) {
    this.tweens.killTweensOf(fragment.list);
    this.tweens.add({
      targets: fragment,
      scale: 1.8,
      alpha: 0,
      y: fragment.y - 20,
      duration: 500,
      onComplete: () => fragment.destroy(),
    });

    this.fragmentsFound += 1;
    this.updateHud();
    this.showMessage('기억의 조각을 찾았다');
  }

  private createHud() {
    this.hudText = this.add
      .text(8, 8, '', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);
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
      .setScrollFactor(0)
      .setDepth(110)
      .setAlpha(0);

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
    const marker = this.add.circle(x, y, 6).setStrokeStyle(2, 0xffffff, 0.9);
    this.tweens.add({
      targets: marker,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      onComplete: () => marker.destroy(),
    });
  }

  // 지나갈 수 없는 것들: 연못, 나무, 바위
  private createObstacles() {
    const group = this.physics.add.staticGroup();
    const rnd = new Phaser.Math.RandomDataGenerator(['obstacles']);

    const pond = this.add.ellipse(220, 520, 220, 120, 0x3a8dde);
    group.add(pond);

    // 연못·길·시작 지점과 겹치지 않는 자리를 고른다.
    const keepOut = [
      new Phaser.Geom.Rectangle(80, 430, 280, 180),
      new Phaser.Geom.Rectangle(WORLD_WIDTH / 2 - 50, 0, 100, WORLD_HEIGHT),
      new Phaser.Geom.Rectangle(FRAGMENT_X - 50, FRAGMENT_Y - 50, 100, 100),
    ];
    const freeSpot = () => {
      for (;;) {
        const x = rnd.between(40, WORLD_WIDTH - 40);
        const y = rnd.between(80, WORLD_HEIGHT - 260);
        if (!keepOut.some((r) => r.contains(x, y))) return { x, y };
      }
    };

    for (let i = 0; i < 14; i++) {
      const { x, y } = freeSpot();
      const tree = this.add.circle(x, y, 22, 0x2f9e44).setStrokeStyle(3, 0x1b5e20);
      group.add(tree);
      (tree.body as Phaser.Physics.Arcade.StaticBody).setCircle(18, 4, 4);
    }

    for (let i = 0; i < 8; i++) {
      const { x, y } = freeSpot();
      group.add(this.add.rectangle(x, y, rnd.between(30, 50), rnd.between(24, 36), 0x9e9e9e));
    }

    return group;
  }

  // 색이 돌아왔을 때 차이가 잘 보이도록 알록달록한 바닥을 한 장의 그림으로 미리 그려둔다.
  // (꽃 수백 개를 따로 그리면 폰이 느려지므로 텍스처 하나로 합친다)
  private drawMeadow() {
    if (!this.textures.exists('meadow')) {
      const rnd = new Phaser.Math.RandomDataGenerator(['meadow']);
      const g = this.make.graphics({}, false);
      g.fillStyle(GRASS).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      g.fillStyle(0xd9b77e).fillRect(WORLD_WIDTH / 2 - 24, 0, 48, WORLD_HEIGHT);
      for (let i = 0; i < 600; i++) {
        g.fillStyle(rnd.pick(FLOWER_COLORS));
        g.fillCircle(rnd.between(4, WORLD_WIDTH - 4), rnd.between(4, WORLD_HEIGHT - 4), rnd.between(2, 4));
      }
      g.generateTexture('meadow', WORLD_WIDTH, WORLD_HEIGHT);
      g.destroy();
    }
    this.add.image(0, 0, 'meadow').setOrigin(0);
  }

  // 화면에 고정되는 개발용 UI. S-1.8에서 개발 모드에서만 보이게 바꾼다.
  private createDevUi(width: number, color: WorldColor) {
    this.fpsText = this.add
      .text(8, this.scale.height - 8, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(100);

    if (!color.supported) {
      this.add
        .text(width / 2, 40, '이 기기는 흑백 효과를 지원하지 않아요 (WebGL 없음)', {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#ffcc00',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
    }

    addButton(this, width - 70, 28, '색 (테스트)', () => {
      if (color.isAnimating) return;
      if (color.isGray) color.restore();
      else color.fade();
    }, 120, 40)
      .setScrollFactor(0)
      .setDepth(100);

    // 임시 끝 조건: S-1.8에서 "색 복원 완료"로 바뀐다.
    addButton(this, width - 70, 76, '끝내기 (임시)', () => fadeTo(this, 'End'), 120, 40)
      .setScrollFactor(0)
      .setDepth(100);
  }
}
