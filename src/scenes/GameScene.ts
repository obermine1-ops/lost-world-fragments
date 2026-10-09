import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { WorldColor } from '../worldColor';

const FLOWER_COLORS = [0xff5a6e, 0xffd23f, 0xff9ad5, 0xa77bff, 0x4fc3ff, 0xffffff];

// 들판 탐험 장면. S-1.5에서 맵과 탭 이동이 들어온다.
export class GameScene extends Phaser.Scene {
  private fpsText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);

    this.drawMeadow(width, height);
    const color = new WorldColor(this, this.cameras.main);

    // 개발용 FPS 표시 (S-1.8에서 개발 모드에서만 보이게 바꾼다)
    this.fpsText = this.add.text(8, 8, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    });

    if (!color.supported) {
      this.add
        .text(width / 2, 40, '이 기기는 흑백 효과를 지원하지 않아요 (WebGL 없음)', {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#ffcc00',
        })
        .setOrigin(0.5);
    }

    // 임시 테스트 버튼: 흑백 ↔ 컬러 전환 (S-1.8에서 퍼즐 클리어로 대체)
    addButton(this, width / 2, height * 0.74, '색 돌리기 (테스트)', () => {
      if (color.isAnimating) return;
      if (color.isGray) color.restore();
      else color.fade();
    });

    // 임시 끝 조건: S-1.8에서 "색 복원 완료"로 바뀐다.
    addButton(this, width / 2, height * 0.87, '끝내기 (임시)', () => fadeTo(this, 'End'));
  }

  update() {
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }

  // 색이 돌아왔을 때 차이가 잘 보이도록 알록달록한 임시 들판을 도형으로 그린다.
  private drawMeadow(width: number, height: number) {
    const rnd = new Phaser.Math.RandomDataGenerator(['meadow']);

    this.add.rectangle(0, 0, width, height * 0.3, 0x8fd3ff).setOrigin(0);
    this.add.circle(width * 0.8, height * 0.09, 28, 0xffe066);
    this.add.rectangle(0, height * 0.3, width, height * 0.7, 0x6cc551).setOrigin(0);
    this.add.ellipse(width * 0.3, height * 0.5, 160, 70, 0x3a8dde);

    for (let i = 0; i < 6; i++) {
      const x = rnd.between(20, width - 20);
      const y = rnd.between(height * 0.32, height * 0.62);
      this.add.rectangle(x, y + 18, 10, 26, 0x8b5a2b);
      this.add.circle(x, y, 22, 0x2f9e44);
    }

    for (let i = 0; i < 160; i++) {
      const x = rnd.between(4, width - 4);
      const y = rnd.between(height * 0.31, height - 4);
      this.add.circle(x, y, rnd.between(3, 6), rnd.pick(FLOWER_COLORS));
    }
  }
}
