import Phaser from 'phaser';
import { FONT, addButton, addMuteButton, fadeIn, fadeTo } from '../ui';
import { music } from '../sound';
import { game, newGame } from '../state';
import { clearSave, exportCode, importCode, loadGame, saveGame } from '../save';
import { CAVE_DONE, INTRO_LINES, SEASONS, regionsOf, type Season } from '../regions';
import type { MemoryData } from './MemoryScene';
import { isComplete } from '../furniture';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    fadeIn(this);

    this.add
      .text(width / 2, height * 0.36, '잃어버린\n세계의 조각', {
        fontFamily: FONT,
        fontSize: '36px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.5, '색과 기억을 되찾는 여행', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#999999',
      })
      .setOrigin(0.5);

    music(this.game, 'quiet');
    addMuteButton(this, width - 52, height - 30);
    this.add
      .text(12, height - 30, '그림·음악: Ninja Adventure (Pixel-boy & AAA, CC0)', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#666666',
      })
      .setOrigin(0, 0.5);

    const saved = loadGame();
    // 네 계절을 모두 되찾은 기록이 있으면 타이틀에 표시
    if (saved && SEASONS.every((sea) => regionsOf(sea.key).every((r) => saved.restored.includes(r.key)))) {
      this.add
        .text(width / 2, height * 0.56, '✿  ☀  ✾  ❄  모든 계절을 되찾았다', { fontFamily: FONT, fontSize: '13px', color: '#ffe9a8' })
        .setOrigin(0.5);
      const badges = [isComplete(saved) && '★ 완전 수집', saved.opened.includes(CAVE_DONE) && '◇ 무지개 동굴'].filter(Boolean).join('   ');
      if (badges) this.add.text(width / 2, height * 0.59, badges, { fontFamily: FONT, fontSize: '12px', color: '#ffb3e6' }).setOrigin(0.5);
    }
    // 아이폰 사파리는 한동안 안 들어온 사이트의 기록을 지울 수 있다 → 홈 화면에 추가하면 안전
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
    if (ios && !standalone) {
      this.add
        .text(width / 2, height * 0.08, '아이폰은 공유 버튼 → "홈 화면에 추가"로\n열어야 기록이 오래 안전해요', {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#d8c9a3',
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5);
    }

    if (!saved) {
      addButton(this, width / 2, height * 0.72, '시작', () => this.startNew());
      addButton(this, width / 2, height * 0.86, '코드로 불러오기', () => this.importBackup(), 140, 32);
      return;
    }
    addButton(this, width / 2, height * 0.913, '기록 옮기기', () => this.openBackup(), 120, 28);

    // 기록이 있으면 이어하기를 크게, 새로 시작은 작게 (실수로 지우지 않도록 한 번 더 묻는다)
    addButton(this, width / 2, height * 0.66, '이어하기', () => {
      game.state = saved;
      fadeTo(this, 'Game');
    });
    // 앞 계절을 다 되찾고 아직 다음 계절에 들어가지 않았다면, 먼 길을 걸어 돌아가지 않아도 되게 바로 보내 준다.
    const seasons = SEASONS.map((s) => s.key);
    const done = (season: Season) => regionsOf(season).every((r) => saved.restored.includes(r.key));
    const next = seasons.find((season, i) => i > 0 && done(seasons[i - 1]) && !done(season));
    if (next && !regionsOf(next).some((r) => r.key === saved.map)) {
      const first = regionsOf(next)[0];
      const label = { spring: '', summer: '바닷가로 바로 가기', autumn: '단풍 숲으로 바로 가기', winter: '눈 덮인 숲으로 바로 가기' }[next];
      addButton(this, width / 2, height * 0.76, label, () => {
        game.state = { ...saved, map: first.key, x: undefined, y: undefined };
        fadeTo(this, 'Game');
      }, 180, 40);
    }
    addButton(this, width / 2, height * 0.86, '새로 시작', () => this.confirmNew(), 130, 40);
  }

  // 기록 옮기기: 백업 코드 복사 / 코드로 불러오기
  private openBackup() {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    const box = this.add.rectangle(width / 2, height / 2, 290, 250, 0x2a2738).setStrokeStyle(2, 0x8f86c9);
    const text = this.add
      .text(width / 2, height / 2 - 85, '기록을 코드로 복사해 두면\n폰을 바꾸거나 기록이 지워져도\n다시 불러올 수 있어요', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 5,
      })
      .setOrigin(0.5);
    const copy = addButton(this, width / 2, height / 2 - 10, '백업 코드 복사', () => this.copyBackup(), 200, 40);
    const load = addButton(this, width / 2, height / 2 + 40, '코드로 불러오기', () => this.importBackup(), 200, 40);
    const close = addButton(this, width / 2, height / 2 + 92, '닫기', () => {
      for (const o of [dim, box, text, copy, load, close]) o.destroy();
    }, 110, 36);
  }

  private async copyBackup() {
    const code = exportCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.toast('복사했어요. 메모 앱 등에 붙여 넣어 두세요');
    } catch {
      // 복사가 막힌 브라우저: 코드를 직접 길게 눌러 복사하게 보여 준다
      window.prompt('아래 코드를 길게 눌러 복사해 두세요', code);
    }
  }

  private importBackup() {
    const code = window.prompt('백업 코드를 붙여 넣어 주세요');
    if (!code) return;
    const state = importCode(code);
    if (!state) {
      this.toast('코드를 읽을 수 없어요. 처음부터 끝까지 다 붙여 넣었는지 확인해 주세요');
      return;
    }
    if (loadGame() && !window.confirm('지금 기록 대신 코드의 기록으로 바꿀까요?')) return;
    saveGame(state);
    this.scene.restart();
  }

  private toast(message: string) {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height * 0.2, message, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 8 },
        align: 'center',
        wordWrap: { width: width - 60, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  // 새 게임: 도입 글(세상이 흑백이 된 이야기)을 보여 준 뒤 들판으로
  private startNew() {
    clearSave();
    game.state = newGame();
    const manager = this.game.scene;
    fadeTo(this, 'Memory', {
      lines: INTRO_LINES,
      onComplete: () => {
        manager.stop('Memory');
        manager.start('Game');
      },
    } satisfies MemoryData);
  }

  private confirmNew() {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    const box = this.add.rectangle(width / 2, height / 2, 280, 170, 0x2a2738).setStrokeStyle(2, 0x8f86c9);
    const text = this.add
      .text(width / 2, height / 2 - 40, '처음부터 다시 할까요?\n지금까지의 기록은 지워져요.', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    const yes = addButton(this, width / 2 - 65, height / 2 + 40, '네', () => this.startNew(), 110, 44);
    const no = addButton(this, width / 2 + 65, height / 2 + 40, '아니요', () => {
      for (const o of [dim, box, text, yes, no]) o.destroy();
    }, 110, 44);
  }
}
