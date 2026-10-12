import Phaser from 'phaser';
import { ambientFailed, ambientLoaded, musicFailed, musicLoaded, setAmbientLoader, setMusicLoader, soundMode, type Ambient, type Music } from '../sound';

// 화면에 보이지 않고 계속 살아 있는 장면. 배경 음악은 필요한 곡만 그때그때 불러온다.
// (예전에는 12곡 14MB를 처음에 다 받아 메모리에 215MB를 올려 두었다 — 폰에서 탭이 꺼질 수 있는 크기)
export class AudioScene extends Phaser.Scene {
  constructor() {
    super('Audio');
  }

  create() {
    this.sound.mute = soundMode() === 'off';
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (key.startsWith('music-')) musicLoaded(this.game, key.slice(6) as Music);
      if (key.startsWith('amb-')) ambientLoaded(this.game, key.slice(4) as Ambient);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key.startsWith('music-')) musicFailed(file.key.slice(6) as Music);
      if (file.key.startsWith('amb-')) ambientFailed(file.key.slice(4) as Ambient);
    });
    setMusicLoader(this.game, (key) => {
      // ogg를 못 트는 기기(아이폰 사파리 등)는 mp3 사본을 쓴다. (tools/convert-music.mjs)
      this.load.audio(`music-${key}`, [`assets/audio/music-${key}.ogg`, `assets/audio/music-${key}.mp3`]);
      if (!this.load.isLoading()) this.load.start();
    });
    setAmbientLoader(this.game, (key) => {
      this.load.audio(`amb-${key}`, `assets/audio/amb-${key}.mp3`);
      if (!this.load.isLoading()) this.load.start();
    });
  }
}
