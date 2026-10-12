import Phaser from 'phaser';

// 효과음(작아서 처음에 불러옴)과 배경 음악(필요한 곡만 그때그때 불러오고, 다 쓴 곡은 메모리에서 내림).
// 소리 설정(모두 켜짐 / 효과음만 / 꺼짐)은 기기에 기억한다.
export const SFX = ['pickup', 'gem', 'flip', 'match', 'success', 'restore', 'dig', 'secret', 'pet', 'click', 'memory', 'splash'] as const;
export const MUSIC = ['quiet', 'gray', 'spring', 'ruins', 'end', 'sea', 'summer', 'fall-gray', 'fall', 'winter-gray', 'winter', 'credits'] as const;
export type Sfx = (typeof SFX)[number];
export type Music = (typeof MUSIC)[number];
export type SoundMode = 'all' | 'sfx' | 'off';

const MUSIC_VOLUME = 0.45;
const MODE_KEY = 'lost-world-fragments/sound';
const OLD_MUTE_KEY = 'lost-world-fragments/mute'; // 예전 켜기/끄기 설정

// 곡마다 녹음 크기가 달라(평균 음량 -14 ~ -28dB) 같은 크기로 들리게 맞추는 배율.
// 목표 평균 -20dB, 가장 큰 소리가 넘치지 않는 범위에서. (2026-10-12 측정)
const MUSIC_LEVEL: Record<Music, number> = {
  quiet: 0.52, gray: 1.17, spring: 0.68, ruins: 1.33, end: 0.55, sea: 2.07,
  summer: 0.77, 'fall-gray': 1.08, fall: 1.64, 'winter-gray': 0.61, winter: 2.45, credits: 1.0,
};
// 효과음도 같은 방식으로 (뒤쪽 무음 때문에 측정값이 과장되므로 절반만 보정)
const SFX_LEVEL: Partial<Record<Sfx, number>> = { pickup: 0.67, dig: 2.2, pet: 1.4, click: 1.33, match: 1.18, success: 1.17 };

let current: { key: Music; sound: Phaser.Sound.BaseSound } | undefined;
let wanted: Music | undefined;
let mode: SoundMode = readMode();
let requestLoad: ((key: Music) => void) | undefined;
const loading = new Set<Music>();

export function sfx(scene: Phaser.Scene, key: Sfx, volume = 0.6) {
  if (scene.cache.audio.exists(`sfx-${key}`)) scene.sound.play(`sfx-${key}`, { volume: volume * (SFX_LEVEL[key] ?? 1) });
}

// 배경 음악을 바꾼다. 아직 없으면 불러온 뒤에 튼다. "효과음만"·"꺼짐"이면 음악은 받지도 않는다.
export function music(game: Phaser.Game, key: Music) {
  wanted = key;
  if (mode !== 'all') {
    stopCurrent(game);
    return;
  }
  if (current?.key === key) return;
  if (!game.cache.audio.exists(`music-${key}`)) {
    if (!loading.has(key) && requestLoad) {
      loading.add(key);
      requestLoad(key);
    }
    return;
  }
  stopCurrent(game);
  const sound = game.sound.add(`music-${key}`, { loop: true, volume: 0 });
  sound.play();
  tweenVolume(game, sound, MUSIC_VOLUME * MUSIC_LEVEL[key], 1200);
  current = { key, sound };
}

// AudioScene이 음악을 불러오는 방법을 알려 준다. (그 전에 원한 곡이 있으면 바로 불러온다)
export function setMusicLoader(game: Phaser.Game, load: (key: Music) => void) {
  requestLoad = load;
  if (wanted) music(game, wanted);
}

// 음악 파일 하나를 다 불러왔을 때. 그새 다른 곡으로 바뀌었다면 바로 내린다.
export function musicLoaded(game: Phaser.Game, key: Music) {
  loading.delete(key);
  if (wanted === key) music(game, key);
  else unload(game, key);
}

export function musicFailed(key: Music) {
  loading.delete(key);
}

export function soundMode() {
  return mode;
}

export function setSoundMode(game: Phaser.Game, next: SoundMode) {
  mode = next;
  game.sound.mute = next === 'off';
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    // 무시
  }
  if (wanted) music(game, wanted);
}

function readMode(): SoundMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'all' || v === 'sfx' || v === 'off') return v;
    return localStorage.getItem(OLD_MUTE_KEY) === '1' ? 'off' : 'all';
  } catch {
    return 'all';
  }
}

function stopCurrent(game: Phaser.Game) {
  if (!current) return;
  const { key, sound } = current;
  current = undefined;
  tweenVolume(game, sound, 0, 800, () => {
    sound.stop();
    sound.destroy();
    unload(game, key);
  });
}

// 풀어 놓은 음악은 곡당 7~25MB라, 지금 쓰지 않는 곡은 메모리에서 내린다. (다시 필요하면 기기에 보관된 파일에서 금방 불러옴)
function unload(game: Phaser.Game, key: Music) {
  if (current?.key === key || (wanted === key && mode === 'all')) return;
  game.cache.audio.remove(`music-${key}`);
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
