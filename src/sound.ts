import Phaser from 'phaser';

// 효과음(작아서 처음에 불러옴)과 배경 음악(커서 게임 시작 후 뒤에서 천천히 불러옴).
// 음소거 여부는 기기에 기억한다.
export const SFX = ['pickup', 'gem', 'flip', 'match', 'success', 'restore', 'dig', 'secret', 'pet', 'click', 'memory', 'splash'] as const;
export const MUSIC = ['quiet', 'gray', 'spring', 'ruins', 'end', 'sea', 'summer'] as const;
export type Sfx = (typeof SFX)[number];
export type Music = (typeof MUSIC)[number];

const MUSIC_VOLUME = 0.45;
const MUTE_KEY = 'lost-world-fragments/mute';

let current: { key: Music; sound: Phaser.Sound.BaseSound } | undefined;
let wanted: Music | undefined;

export function sfx(scene: Phaser.Scene, key: Sfx, volume = 0.6) {
  if (scene.cache.audio.exists(`sfx-${key}`)) scene.sound.play(`sfx-${key}`, { volume });
}

// 배경 음악을 바꾼다. 아직 불러오는 중이면 다 불러온 뒤에 튼다.
export function music(game: Phaser.Game, key: Music) {
  wanted = key;
  if (current?.key === key) return;
  if (!game.cache.audio.exists(`music-${key}`)) return;
  const previous = current?.sound;
  if (previous) fadeOutAndStop(game, previous);
  const sound = game.sound.add(`music-${key}`, { loop: true, volume: 0 });
  sound.play();
  tweenVolume(game, sound, MUSIC_VOLUME, 1200);
  current = { key, sound };
}

// AudioScene이 음악 파일 하나를 다 불러올 때마다 부른다.
export function musicLoaded(game: Phaser.Game, key: Music) {
  if (wanted === key) music(game, key);
}

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(game: Phaser.Game, muted: boolean) {
  game.sound.mute = muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // 무시
  }
}

// 사운드 객체에는 tween을 걸 장면이 없으므로 게임 시계로 볼륨을 조금씩 바꾼다.
function tweenVolume(game: Phaser.Game, sound: Phaser.Sound.BaseSound, to: number, ms: number, done?: () => void) {
  const s = sound as Phaser.Sound.WebAudioSound;
  const from = s.volume;
  const start = game.loop.now;
  const step = () => {
    const t = Math.min(1, (game.loop.now - start) / ms);
    s.setVolume(from + (to - from) * t);
    if (t < 1) game.events.once(Phaser.Core.Events.STEP, step);
    else done?.();
  };
  game.events.once(Phaser.Core.Events.STEP, step);
}

function fadeOutAndStop(game: Phaser.Game, sound: Phaser.Sound.BaseSound) {
  tweenVolume(game, sound, 0, 800, () => {
    sound.stop();
    sound.destroy();
  });
}
