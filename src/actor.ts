import Phaser from 'phaser';

// 캐릭터 그림의 열 순서와 같다.
export const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// 움직이는 방향에 맞춰 걷기 애니메이션을 틀고, 멈추면 마지막 방향을 바라보고 선다.
export class ActorAnimator {
  private facing: Direction = 'down';

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly key: string,
  ) {}

  update(vx: number, vy: number) {
    const moving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
    if (!moving) {
      this.sprite.anims.stop();
      this.sprite.setFrame(DIRECTIONS.indexOf(this.facing));
      return;
    }
    if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
    else this.facing = vy > 0 ? 'down' : 'up';
    this.sprite.anims.play(`${this.key}-walk-${this.facing}`, true);
  }
}
