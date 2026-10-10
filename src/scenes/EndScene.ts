import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { game } from '../state';
import { regionsOf, seasonOf, type Season } from '../regions';
import { RARE_ITEMS } from '../items';
import { music } from '../sound';
import { saveGame } from '../save';

const NEXT: Partial<Record<Season, { season: Season; map: string; label: string }>> = {
  spring: { season: 'summer', map: 'beach-e', label: '여름으로' },
  summer: { season: 'autumn', map: 'maple-h', label: '가을로' },
};
const ORDINAL: Record<Season, string> = { spring: '첫', summer: '두', autumn: '세' };

// 계절 하나를 되찾은 뒤의 요약 화면. 다음 계절이 있으면 이어서 갈 수 있다.
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: { season?: Season } = {}) {
    const { width, height } = this.scale;
    const s = game.state;
    const season = data.season ?? 'spring';
    const name = seasonOf(season).name;
    fadeIn(this);
    music(this.game, 'end');

    this.add
      .text(width / 2, height * 0.26, `${name}을 되찾았다`, { fontFamily: FONT, fontSize: '32px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.34, `${ORDINAL[season]} 번째 계절 · 끝`, { fontFamily: FONT, fontSize: '15px', color: '#d8c9a3' })
      .setOrigin(0.5);

    // 이번 계절에 모은 것
    const keys = regionsOf(season).map((r) => r.key);
    const items = RARE_ITEMS.filter((i) => i.season === season);
    const count = (list: string[]) => list.filter((k) => keys.includes(k)).length;
    const lines = [
      `되찾은 기억  ${count(s.restored)} / ${keys.length}`,
      `모은 보석  ${count(s.gems)} / ${keys.length}`,
      `희귀 아이템  ${items.filter((i) => s.items.includes(i.id)).length} / ${items.length}`,
    ];
    this.add
      .text(width / 2, height * 0.43, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#cccccc',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);

    const next = NEXT[season];
    const nextDone = next && regionsOf(next.season).every((r) => s.restored.includes(r.key));
    if (next && !nextDone) {
      this.add
        .text(width / 2, height * 0.62, `${seasonOf(next.season).name}이 기다리는 곳으로 가는 길이 열렸다`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#8f86c9',
        })
        .setOrigin(0.5);
      this.time.delayedCall(500, () => {
        addButton(this, width / 2, height * 0.72, next.label, () => {
          s.map = next.map;
          s.x = s.y = undefined;
          saveGame(s);
          fadeTo(this, 'Game');
        });
        addButton(this, width / 2, height * 0.83, '처음 화면으로', () => fadeTo(this, 'Title'), 150, 40);
      });
      return;
    }

    const hint = this.add
      .text(width / 2, height * 0.78, '화면을 탭하면 처음으로', { fontFamily: FONT, fontSize: '16px', color: '#999999' })
      .setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    // 페이드인이 끝난 뒤부터 탭을 받아서, 이전 화면의 탭이 바로 넘어가지 않게 한다.
    this.time.delayedCall(500, () => {
      this.input.once('pointerup', () => fadeTo(this, 'Title'));
    });
  }
}
