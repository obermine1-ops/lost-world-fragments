import Phaser from 'phaser';
import { HelloScene } from './scenes/HelloScene';

// 세로 화면 기준 해상도 (9:16). 폰 화면 크기에 맞춰 비율을 유지한 채 확대·축소된다.
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1d1d1d',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [HelloScene],
});
