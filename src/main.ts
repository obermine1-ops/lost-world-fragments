import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MemoryScene } from './scenes/MemoryScene';
import { CollectionScene } from './scenes/CollectionScene';
import { AudioScene } from './scenes/AudioScene';
import { HouseScene } from './scenes/HouseScene';
import { game as progress } from './state';

// 세로 화면 기준 해상도 (9:16). 폰 화면 크기에 맞춰 비율을 유지한 채 확대·축소되고,
// 비율이 다른 폰에서는 남는 위아래(또는 좌우)가 배경색 여백으로 채워진다.
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

const game = new Phaser.Game({
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
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [PreloadScene, TitleScene, GameScene, PuzzleScene, MemoryScene, CollectionScene, EndScene, HouseScene, AudioScene],
});

// 개발 중에만 브라우저 콘솔에서 게임 상태를 들여다볼 수 있게 한다. (배포본에는 없음)
if (import.meta.env.DEV) {
  Object.assign(window, { game, progress });
} else if ('serviceWorker' in navigator) {
  // 배포본에서만: 홈 화면 설치·오프라인 실행용 (public/sw.js)
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
