import Phaser from 'phaser';

const FOLLOW_GAP = 18; // 앞사람과 이 정도 떨어지면 따라 걷는다
const SPEED = 70;

export type PetKind = 'raccoon' | 'frog';

// 동물 그림 키 (public/assets/actors/)
export const PET_TEXTURE: Record<PetKind, string> = { raccoon: 'pet', frog: 'frog' };

// 동료 동물. 앞사람(플레이어나 다른 동물)의 뒤를 졸졸 따라다니고,
// 심부름(흙더미·물가로 달려가기)을 시키면 그곳으로 간다.
// 장애물과 부딪히지 않는다(작은 동물이라 덤불 사이로 빠져나간다는 설정).
export class Pet {
  readonly sprite: Phaser.GameObjects.Sprite;
  private errand?: { x: number; y: number; onArrive: () => void };

  constructor(
    scene: Phaser.Scene,
    readonly kind: PetKind,
    x: number,
    y: number,
  ) {
    this.sprite = scene.add.sprite(x, y, PET_TEXTURE[kind], 0);
  }

  // 심부름 중에는 따라오지 않는다.
  runTo(x: number, y: number, onArrive: () => void) {
    this.errand = { x, y, onArrive };
  }

  update(delta: number, leader: { x: number; y: number }) {
    const s = this.sprite;
    const goal = this.errand ?? leader;
    const dx = goal.x - s.x;
    const dy = goal.y - s.y;
    const dist = Math.hypot(dx, dy);
    const stopAt = this.errand ? 2 : FOLLOW_GAP;

    // 소수점 오차로 영영 "도착"하지 못하는 일이 없게 조금 여유를 둔다.
    if (dist <= stopAt + 0.5) {
      s.anims.stop();
      s.setFrame(0);
      if (this.errand) {
        const done = this.errand.onArrive;
        this.errand = undefined;
        done();
      }
      return;
    }
    // 멀리 떨어질수록 조금 빨리 따라온다.
    const speed = this.errand ? SPEED * 1.3 : Math.min(SPEED * 1.6, SPEED * (dist / 30));
    const step = Math.min(dist - stopAt, (speed * delta) / 1000);
    s.x += (dx / dist) * step;
    s.y += (dy / dist) * step;
    if (Math.abs(dx) > 1) s.setFlipX(dx < 0);
    s.anims.play(`${PET_TEXTURE[this.kind]}-walk`, true);
  }
}
