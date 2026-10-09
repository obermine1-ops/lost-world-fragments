import Phaser from 'phaser';

// S-1.1 확인용 첫 화면. S-1.3에서 타이틀/게임/끝 장면으로 교체한다.
export class HelloScene extends Phaser.Scene {
  constructor() {
    super('Hello');
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 20, 'Hello', {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 30, '잃어버린 세계의 조각', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#bbbbbb',
      })
      .setOrigin(0.5);
  }
}
