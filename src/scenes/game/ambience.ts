import Phaser from 'phaser';
import type { Season } from '../../regions';

// 계절의 공기: 색을 되찾은 지역에만 봄 꽃잎 · 여름 햇빛 반짝이 · 가을 낙엽 · 겨울 눈.
// 화면 안 아무 곳에서 생겨 살며시 나타났다 사라진다. 그림은 코드로 그린 작은 모양(그림 파일 없음).
// 그림 · 수명(ms) · 속도 · 회전 · 크기 · 진하기 · 색 · 생기는 간격(ms) — 눈은 하얀 눈밭에 묻히지 않게 옅은 하늘색
const AMBIENCE: Record<Season, {
  texture: string; lifespan: number; speedX: { min: number; max: number }; speedY: { min: number; max: number };
  spin: number; scale: [number, number]; alpha: number; tint: number[]; frequency: number;
}> = {
  spring: { texture: 'amb-petal', lifespan: 6000, speedX: { min: -14, max: -4 }, speedY: { min: 6, max: 14 }, spin: 360, scale: [1, 1.5], alpha: 0.95, tint: [0xffb3d1, 0xffd1e3, 0xff9ec2], frequency: 170 },
  summer: { texture: 'amb-mote', lifespan: 3200, speedX: { min: -3, max: 3 }, speedY: { min: -7, max: -2 }, spin: 0, scale: [0.8, 1.3], alpha: 0.9, tint: [0xfff3b0, 0xffffff, 0xbff4ff], frequency: 170 },
  autumn: { texture: 'amb-leaf', lifespan: 6000, speedX: { min: -20, max: -6 }, speedY: { min: 10, max: 20 }, spin: 540, scale: [1.1, 1.6], alpha: 1, tint: [0xe8743b, 0xc9411f, 0xf2b13c], frequency: 190 },
  winter: { texture: 'amb-snow', lifespan: 7000, speedX: { min: -6, max: 6 }, speedY: { min: 8, max: 18 }, spin: 0, scale: [0.7, 1.3], alpha: 0.95, tint: [0xa9c4e4, 0xc3d8ef, 0x93b4dc], frequency: 70 },
};

// 무지개 동굴의 빛
export const RAINBOW = [0xff8a8a, 0xffc27a, 0xfff07a, 0x9cf08a, 0x8ad8ff, 0xb59cff];

// 입자를 만든다 (어느 층에 넣을지·깊이·서서히 나타나기는 부르는 쪽에서). tint를 주면 색만 바꾼다.
export function createAmbience(scene: Phaser.Scene, season: Season, tint?: number[]) {
  makeTextures(scene);
  const cam = scene.cameras.main;
  const a = { ...AMBIENCE[season], ...(tint ? { tint } : {}) };
  return scene.add.particles(0, 0, a.texture, {
    x: { onEmit: () => cam.worldView.x - 20 + Math.random() * (cam.worldView.width + 40) },
    y: { onEmit: () => cam.worldView.y - 20 + Math.random() * (cam.worldView.height + 40) },
    lifespan: a.lifespan,
    speedX: a.speedX,
    speedY: a.speedY,
    rotate: a.spin ? { start: 0, end: a.spin } : 0,
    scale: { min: a.scale[0], max: a.scale[1] },
    alpha: { values: [0, a.alpha, a.alpha, 0], interpolation: 'linear' },
    tint: a.tint,
    frequency: a.frequency,
  });
}

function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('amb-petal')) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff).fillEllipse(3, 2, 6, 4).generateTexture('amb-petal', 6, 4).clear();
  g.fillStyle(0xffffff).fillTriangle(0, 2, 6, 0, 5, 5).generateTexture('amb-leaf', 6, 5).clear();
  g.fillStyle(0xffffff).fillCircle(2, 2, 2).generateTexture('amb-snow', 4, 4).clear();
  g.fillStyle(0xffffff, 0.5).fillCircle(3, 3, 3).fillStyle(0xffffff).fillCircle(3, 3, 1.3).generateTexture('amb-mote', 6, 6);
  g.destroy();
}
