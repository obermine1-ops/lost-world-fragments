import Phaser from 'phaser';

const RESTORE_MS = 2500;

// 카메라 전체에 흑백 효과를 걸고, 색을 서서히 되돌리거나 다시 빼는 연출을 담당한다.
// WebGL에서만 동작한다. (지역별 복원은 Sprint 3에서 이 방식을 확장한다.)
export class WorldColor {
  private readonly matrix?: Phaser.FX.ColorMatrix;
  private readonly scene: Phaser.Scene;
  private tween?: Phaser.Tweens.Tween;
  // 0 = 완전한 컬러, 1 = 완전한 흑백
  private grayness = 1;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.matrix = camera.postFX?.addColorMatrix();
    this.apply();
  }

  get supported() {
    return this.matrix !== undefined;
  }

  get isGray() {
    return this.grayness > 0.5;
  }

  get isAnimating() {
    return this.tween?.isPlaying() ?? false;
  }

  restore(onComplete?: () => void) {
    this.animateTo(0, onComplete);
  }

  fade(onComplete?: () => void) {
    this.animateTo(1, onComplete);
  }

  private animateTo(target: number, onComplete?: () => void) {
    this.tween?.stop();
    this.tween = this.scene.tweens.addCounter({
      from: this.grayness,
      to: target,
      duration: RESTORE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        this.grayness = tween.getValue() ?? target;
        this.apply();
      },
      onComplete: () => onComplete?.(),
    });
  }

  private apply() {
    this.matrix?.grayscale(this.grayness);
  }
}
