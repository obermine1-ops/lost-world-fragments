import Phaser from 'phaser';
import { MUSIC, isMuted, musicLoaded, type Music } from '../sound';

// 화면에 보이지 않고 계속 살아 있는 장면. 배경 음악 파일(합쳐서 약 4MB)을
// 게임을 시작한 뒤 뒤에서 천천히 불러온다. (첫 화면이 늦게 뜨지 않도록)
export class AudioScene extends Phaser.Scene {
  constructor() {
    super('Audio');
  }

  create() {
    this.sound.mute = isMuted();
    // 지금 필요한 음악(타이틀)부터 먼저
    for (const key of MUSIC) this.load.audio(`music-${key}`, `assets/audio/music-${key}.ogg`);
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (key.startsWith('music-')) musicLoaded(this.game, key.slice(6) as Music);
    });
    this.load.start();
  }
}
