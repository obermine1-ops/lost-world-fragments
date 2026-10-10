import Phaser from 'phaser';
import { FONT, addButton, fadeIn, fadeTo } from '../ui';
import { game } from '../state';
import { saveGame } from '../save';
import { FLOORS, WALLPAPERS, ownedPlaceables, unlockedStyles, type Placeable } from '../furniture';
import { music, sfx } from '../sound';
import { WorldColor } from '../worldColor';

// 방: 바깥 벽을 포함해 11×9칸, 안쪽 바닥 9×7칸. 16px 그림을 2배로 그린다.
const ROOM_W = 11;
const ROOM_H = 9;
const SCALE = 2;
const CELL = 16 * SCALE;
// 벽 (TilesetWallSimple, 10열): 색 세트 왼쪽 위 번호(base)에서 왼위·위·오위 / 왼·오 / 왼아래·아래·오아래
const WALL = { tl: 0, t: 2, tr: 4, l: 20, r: 24, bl: 40, b: 42, br: 44 };
// 상자 한 줄 8칸 (물건이 30개쯤까지 4줄로 들어간다)
const TRAY_COLS = 8;
const TRAY_SLOT = 40;

// 나의 집: 아래 상자에서 물건을 고르고, 방 바닥 칸을 눌러 놓는다.
// 놓인 물건을 누르면 다시 집어 든다(옮기기). 집어 든 채로 상자를 누르면 치운다.
export class HouseScene extends Phaser.Scene {
  private roomX = 0;
  private roomY = 0;
  private held?: Placeable;
  private placedLayer!: Phaser.GameObjects.Container;
  private tray!: Phaser.GameObjects.Container;
  private hint!: Phaser.GameObjects.Text;
  private ghost?: Phaser.GameObjects.Container;
  private roomLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('House');
  }

  create() {
    const { width, height } = this.scale;
    this.held = undefined;
    fadeIn(this);
    music(this.game, 'quiet');
    this.cameras.main.setBackgroundColor('#1b1724');
    // 집도 봄 들판의 일부: 들판의 색을 되찾기 전에는 집 안도 흑백이다.
    new WorldColor(this, this.cameras.main, game.state.restored.includes('meadow-a'));

    this.add.text(width / 2, 22, '나의 집', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    this.hint = this.add
      .text(width / 2, 46, '', { fontFamily: FONT, fontSize: '12px', color: '#d8c9a3', align: 'center' })
      .setOrigin(0.5);

    this.roomX = Math.round((width - ROOM_W * CELL) / 2);
    this.roomY = 64;
    this.roomLayer = this.add.container(0, 0);
    this.drawRoom();
    this.placedLayer = this.add.container(0, 0);
    this.tray = this.add.container(0, 0);
    this.refresh();

    // 벽지·바닥 바꾸기 (계절을 되찾을수록 고를 수 있는 것이 늘어난다)
    const styleButton = (x: number, kind: 'wallpaper' | 'floor') =>
      addButton(this, x, height - 30, kind === 'wallpaper' ? '벽지' : '바닥', () => {
        const s = game.state;
        const list = kind === 'wallpaper' ? WALLPAPERS : FLOORS;
        const open = unlockedStyles(list as { name: string; from?: string }[], s);
        const index = (open.indexOf(list[s[kind]] as { name: string; from?: string }) + 1) % open.length;
        s[kind] = list.indexOf(open[index] as never);
        saveGame(s);
        sfx(this, 'flip', 0.4);
        this.drawRoom();
        this.hint.setText(`${open[index].name} (${open.length}/${list.length}가지 중) — 계절을 되찾으면 더 생겨요`);
      }, 70, 36);
    styleButton(46, 'wallpaper');
    styleButton(width - 46, 'floor');

    addButton(this, width / 2, height - 30, '밖으로', () => {
      game.state.map = 'meadow-a';
      game.state.x = game.state.y = undefined;
      saveGame(game.state);
      fadeTo(this, 'Game', { spawn: 'from-house' });
    }, 140, 40);
  }

  private drawRoom() {
    this.roomLayer.removeAll(true);
    const s = game.state;
    const wall = (WALLPAPERS[s.wallpaper] ?? WALLPAPERS[0]).base;
    const floor = (FLOORS[s.floor] ?? FLOORS[0]).frame;
    for (let y = 0; y < ROOM_H; y++)
      for (let x = 0; x < ROOM_W; x++) {
        const px = this.roomX + x * CELL + CELL / 2;
        const py = this.roomY + y * CELL + CELL / 2;
        const inner = x > 0 && y > 0 && x < ROOM_W - 1 && y < ROOM_H - 1;
        this.roomLayer.add(this.add.image(px, py, 'ifloor-sheet', floor).setScale(SCALE));
        if (inner) {
          // 바닥 칸: 누르면 들고 있는 물건을 놓는다.
          const cell = this.add.rectangle(px, py, CELL, CELL, 0xffffff, 0).setInteractive();
          cell.on('pointerup', () => this.onCell(x, y));
          this.roomLayer.add(cell);
          continue;
        }
        const top = y === 0;
        const bottom = y === ROOM_H - 1;
        const left = x === 0;
        const right = x === ROOM_W - 1;
        const frame = top
          ? left ? WALL.tl : right ? WALL.tr : WALL.t
          : bottom
            ? left ? WALL.bl : right ? WALL.br : WALL.b
            : left ? WALL.l : WALL.r;
        this.roomLayer.add(this.add.image(px, py, 'wall-sheet', wall + frame).setScale(SCALE));
      }
  }

  // 방과 상자를 지금 상태대로 다시 그린다.
  private refresh() {
    const s = game.state;
    const owned = ownedPlaceables(s);
    // 더 이상 가지고 있지 않은 것(기록이 바뀐 경우)은 방에서 뺀다.
    s.house = s.house.filter((h) => owned.some((o) => o.key === h.key));

    this.placedLayer.removeAll(true);
    // 아래쪽(y가 큰) 물건이 앞에 보이게
    for (const h of [...s.house].sort((a, b) => a.y - b.y)) {
      const p = owned.find((o) => o.key === h.key)!;
      const obj = this.drawPlaceable(p, this.cellX(h.x), this.cellY(h.y));
      obj.setSize(CELL, CELL).setInteractive({ useHandCursor: true });
      obj.on('pointerup', () => this.pickUp(h.key));
      this.placedLayer.add(obj);
    }

    this.tray.removeAll(true);
    const { width } = this.scale;
    const top = this.roomY + ROOM_H * CELL + 16;
    const free = owned.filter((o) => !s.house.some((h) => h.key === o.key));
    const label = this.add.text(16, top, `상자 (${free.length})`, { fontFamily: FONT, fontSize: '13px', color: '#8f86c9' });
    this.tray.add(label);
    const left = (width - TRAY_COLS * TRAY_SLOT) / 2 + TRAY_SLOT / 2;
    free.forEach((p, i) => {
      const x = left + (i % TRAY_COLS) * TRAY_SLOT;
      const y = top + 40 + Math.floor(i / TRAY_COLS) * TRAY_SLOT;
      const selected = this.held?.key === p.key;
      const bg = this.add.rectangle(x, y, TRAY_SLOT - 6, TRAY_SLOT - 6, 0x2a2738).setStrokeStyle(2, selected ? 0xffe9a8 : 0x45405a);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(p));
      this.tray.add(bg);
      const icon = this.drawPlaceable(p, x, y + 6, 1.25);
      this.tray.add(icon);
    });
    if (free.length === 0) {
      this.tray.add(
        this.add.text(width / 2, top + 40, '모든 물건을 방에 놓았어요', { fontFamily: FONT, fontSize: '12px', color: '#666666' }).setOrigin(0.5),
      );
    }
    // 들고 있던 물건을 방에서 집어 들었다면 상자 대신 "들고 있음" 표시
    this.updateHint();
  }

  private updateHint() {
    this.hint.setText(
      this.held
        ? `'${this.held.name}' — 방 바닥을 눌러 놓기 (상자 칸을 누르면 치우기)`
        : '상자에서 물건을 고르고 방 바닥을 눌러 놓아 보세요',
    );
    this.ghost?.destroy();
    this.ghost = undefined;
    if (this.held) {
      // 손에 든 물건을 제목 옆에 작게 보여 준다.
      this.ghost = this.drawPlaceable(this.held, this.scale.width - 36, 24, 1.2);
    }
  }

  // 물건 그림 (가구는 여러 줄 — 맨 아랫줄이 기준 칸, 윗줄은 위로 솟음)
  private drawPlaceable(p: Placeable, x: number, y: number, scale = SCALE) {
    const c = this.add.container(x, y);
    if (p.frames) {
      const n = p.frames.length;
      p.frames.forEach((frame, i) => {
        c.add(this.add.image(0, -(n - 1 - i) * 16 * scale, p.texture, frame).setScale(scale));
      });
    } else {
      const img = this.add.image(0, 0, p.texture).setScale(scale * 0.8);
      if (p.tint) img.setTint(p.tint);
      c.add(img);
    }
    return c;
  }

  private cellX(x: number) {
    return this.roomX + x * CELL + CELL / 2;
  }

  private cellY(y: number) {
    return this.roomY + y * CELL + CELL / 2;
  }

  private select(p: Placeable) {
    sfx(this, 'flip', 0.4);
    this.held = this.held?.key === p.key ? undefined : p;
    this.refresh();
  }

  private onCell(x: number, y: number) {
    if (!this.held) return;
    const s = game.state;
    if (s.house.some((h) => h.x === x && h.y === y)) return; // 이미 무언가 있는 칸
    s.house = s.house.filter((h) => h.key !== this.held!.key);
    s.house.push({ key: this.held.key, x, y });
    this.held = undefined;
    sfx(this, 'match', 0.5);
    saveGame(s);
    this.refresh();
  }

  // 방에 놓인 물건을 다시 집어 든다 (다른 칸을 누르면 옮겨지고, 상자를 누르면 치워진다)
  private pickUp(key: string) {
    if (this.held) return;
    const s = game.state;
    const p = ownedPlaceables(s).find((o) => o.key === key);
    if (!p) return;
    s.house = s.house.filter((h) => h.key !== key);
    this.held = p;
    sfx(this, 'flip', 0.4);
    saveGame(s);
    this.refresh();
  }
}
