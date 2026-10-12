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
// size: 확대하지 않는 화면(기억 장면 등)에서는 2 — 탐험 화면은 카메라가 2배라 같은 크기로 보인다. 화면이 넓으면 조금 더 자주 생기게(너무 빽빽하면 글을 가린다).
export function createAmbience(scene: Phaser.Scene, season: Season, tint?: number[], size = 1) {
  makeTextures(scene);
  const cam = scene.cameras.main;
  const a = { ...AMBIENCE[season], ...(tint ? { tint } : {}) };
  return scene.add.particles(0, 0, a.texture, {
    x: { onEmit: () => cam.worldView.x - 20 + Math.random() * (cam.worldView.width + 40) },
    y: { onEmit: () => cam.worldView.y - 20 + Math.random() * (cam.worldView.height + 40) },
    lifespan: a.lifespan,
    speedX: { min: a.speedX.min * size, max: a.speedX.max * size },
    speedY: { min: a.speedY.min * size, max: a.speedY.max * size },
    rotate: a.spin ? { start: 0, end: a.spin } : 0,
    scale: { min: a.scale[0] * size, max: a.scale[1] * size },
    alpha: { values: [0, a.alpha, a.alpha, 0], interpolation: 'linear' },
    tint: a.tint,
    frequency: a.frequency / size,
  });
}

// 한 번 팡 터지는 계절 입자 (색을 되찾는 순간 제단에서). 다 사라지면 스스로 지워진다.
// size: 확대하지 않는 화면(퍼즐 등)에서는 2
export function burstAmbience(scene: Phaser.Scene, season: Season, x: number, y: number, count = 40, size = 1) {
  makeTextures(scene);
  const a = AMBIENCE[season];
  const emitter = scene.add.particles(x, y, a.texture, {
    emitting: false,
    lifespan: { min: 1200, max: 2000 },
    speed: { min: 30 * size, max: 110 * size },
    angle: { min: 0, max: 360 },
    rotate: a.spin ? { start: 0, end: a.spin } : 0,
    scale: { min: a.scale[0] * size, max: a.scale[1] * 1.2 * size },
    alpha: { start: 1, end: 0 },
    tint: a.tint,
  });
  emitter.explode(count);
  scene.time.delayedCall(2200, () => emitter.destroy());
  return emitter;
}

// 반짝임: 한 색의 작은 빛 알갱이가 사방으로 퍼졌다 사라진다 (보석·조각·반딧불을 주울 때)
export function sparkle(scene: Phaser.Scene, x: number, y: number, color: number, count = 14) {
  makeTextures(scene);
  const emitter = scene.add.particles(x, y, 'amb-mote', {
    emitting: false,
    lifespan: { min: 500, max: 900 },
    speed: { min: 20, max: 70 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0.2 },
    alpha: { start: 1, end: 0 },
    tint: [color, 0xffffff],
  });
  emitter.explode(count);
  scene.time.delayedCall(1100, () => emitter.destroy());
  return emitter;
}

// 계절빛 바탕 (기억 장면·계절 요약·크레딧): 화면 가운데 위쪽에 부드러운 빛이 천천히 숨 쉬고, 계절 입자가 흩날린다.
// 확대하지 않는 화면용. 부른 뒤에 만든 글·그림이 그 위에 그려진다. rainbow면 무지개 빛.
const SEASON_GLOW: Record<Season, number> = { spring: 0xffb3d1, summer: 0x8fd8ff, autumn: 0xf2a65a, winter: 0xbfd6ff };
export function seasonBackdrop(scene: Phaser.Scene, season?: Season, rainbow = false, y = scene.scale.height * 0.36) {
  const color = rainbow ? 0xd8b8ff : SEASON_GLOW[season ?? 'spring'];
  const glow = scene.add.image(scene.scale.width / 2, y, softGlow(scene)).setTint(color).setAlpha(0.32);
  scene.tweens.add({ targets: glow, scale: 1.1, alpha: 0.45, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  createAmbience(scene, rainbow ? 'summer' : season ?? 'spring', rainbow ? RAINBOW : undefined, 2).setAlpha(0.6);
}

// 가운데가 밝고 가장자리로 갈수록 투명해지는 둥근 빛 (한 번 그려 두고 색만 물들여 쓴다)
function softGlow(scene: Phaser.Scene) {
  const key = 'memory-glow';
  if (!scene.textures.exists(key)) {
    const size = 480;
    const canvas = scene.textures.createCanvas(key, size, size)!;
    const ctx = canvas.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
  return key;
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
