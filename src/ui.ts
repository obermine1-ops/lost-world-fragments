import Phaser from 'phaser';
import { setSoundMode, sfx, soundMode, type SoundMode } from './sound';

export const FONT = 'sans-serif';
const FADE_MS = 400;

// 장면이 시작될 때 검은 화면에서 서서히 밝아진다.
export function fadeIn(scene: Phaser.Scene) {
  // 장면을 다시 시작해도 입력 설정은 남아 있으므로, fadeTo에서 끈 입력을 다시 켠다.
  scene.input.enabled = true;
  for (const cam of scene.cameras.cameras) cam.fadeIn(FADE_MS, 0, 0, 0);
}

// 화면을 어둡게 한 뒤 다음 장면으로 넘어간다. 전환 중 중복 탭은 무시한다.
// (장면이 밝아지는 중에 누른 것은 받아 준다 — 전에는 막혀서 빨리 누르면 반응이 없었다)
export function fadeTo(scene: Phaser.Scene, key: string, data?: object) {
  const cam = scene.cameras.main;
  if (!scene.input.enabled) return;
  scene.input.enabled = false;
  for (const c of scene.cameras.cameras) c.fadeOut(FADE_MS, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

// 손가락으로 누르기 쉬운 크기의 둥근 버튼.
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
  width = 180,
  height = 56,
) {
  const bg = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0.35)
    .setStrokeStyle(2, 0xffffff, 0.6);
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(height * 0.4)}px`, color: '#ffffff' })
    .setOrigin(0.5);

  const button = scene.add.container(x, y, [bg, text]);
  button.setSize(width, height).setInteractive({ useHandCursor: true });
  button.on('pointerdown', () => bg.setFillStyle(0xffffff, 0.25));
  button.on('pointerout', () => bg.setFillStyle(0x000000, 0.35));
  button.on('pointerup', () => {
    bg.setFillStyle(0x000000, 0.35);
    sfx(scene, 'click', 0.35);
    onTap();
  });
  return button;
}

// 소리 버튼: 누를 때마다 소리 켜짐 → 효과음만(음악 끔, 음악 파일도 안 받음) → 소리 꺼짐. 설정은 기기에 기억.
const SOUND_LABEL: Record<SoundMode, string> = { all: '소리 켜짐', sfx: '효과음만', off: '소리 꺼짐' };
const SOUND_NEXT: Record<SoundMode, SoundMode> = { all: 'sfx', sfx: 'off', off: 'all' };
export function addMuteButton(scene: Phaser.Scene, x: number, y: number) {
  const button = addButton(scene, x, y, SOUND_LABEL[soundMode()], () => {
    setSoundMode(scene.game, SOUND_NEXT[soundMode()]);
    (button.list[1] as Phaser.GameObjects.Text).setText(SOUND_LABEL[soundMode()]);
  }, 84, 32);
  return button;
}
