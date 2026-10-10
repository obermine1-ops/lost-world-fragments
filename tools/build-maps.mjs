// 지도 생성기: 코드로 지형을 배치해 Tiled 형식(JSON) 지도 파일을 만든다.
// 실행: npm run maps  →  public/maps/*.json
// 만들어진 파일은 무료 지도 편집기 Tiled로도 열어서 고칠 수 있다.
import { writeFileSync, mkdirSync } from 'node:fs';

const TILE = 16;

// 타일셋 (public/assets/tilesets). 번호는 각 그림 안에서 왼쪽 위부터 0, 1, 2…
const TILESETS = [
  { key: 'floor', name: 'TilesetFloor', file: 'TilesetFloor.png', w: 352, h: 417, columns: 22, count: 572 },
  { key: 'water', name: 'TilesetWater', file: 'TilesetWater.png', w: 448, h: 272, columns: 28, count: 476 },
  { key: 'nature', name: 'TilesetNature', file: 'TilesetNature.png', w: 384, h: 336, columns: 24, count: 504 },
  { key: 'ruins', name: 'TilesetVillageAbandoned', file: 'TilesetVillageAbandoned.png', w: 320, h: 192, columns: 20, count: 240 },
];
const FIRST_GID = {};
{
  let gid = 1;
  for (const t of TILESETS) {
    FIRST_GID[t.key] = gid;
    gid += t.count;
  }
}
const gid = (set, id) => FIRST_GID[set] + id;

// 3×3로 둘러싼 섬 모양 타일 (가장자리 자동 선택용): [왼위, 위, 오위, 왼, 가운데, 오, 왼아래, 아래, 오아래]
const ISLANDS = {
  dirt: ['floor', [154, 155, 156, 176, 177, 178, 198, 199, 200]],
  pond: ['water', [168, 169, 170, 196, 197, 198, 224, 225, 226]],
  mud: ['floor', [319, 320, 321, 341, 342, 343, 363, 364, 365]], // 유적 바닥의 짙은 흙
};
// 바탕 땅 (지도마다 고른다): 풀밭 / 유적의 흙바닥
const BASES = {
  grass: [264, 264, 264, 264, 264, 264, 265, 266, 267, 268, 244, 245],
  earth: [429, 429, 429, 429, 429, 430, 431, 432, 433],
};
// 여러 칸짜리 유적 구조물 (TilesetVillageAbandoned) — 행 단위 그림 번호
const RUINS = {
  house: [[0, 1, 2, 3], [20, 21, 22, 23], [40, 41, 42, 43]], // 무너진 돌집 (가운데 어두운 입구)
  pillar: [[60, 61], [80, 81], [100, 101]], // 부서진 굵은 기둥
  thinPillar: [[62], [82], [102]],
  statue: [[109, 110], [129, 130]], // 이끼 낀 개구리 석상
};
const RUBBLE = [86, 87, 88, 89, 90]; // 돌무더기 (TilesetVillageAbandoned)
const TREES = {
  green: [16, 17, 40, 41],
  cherry: [14, 15, 38, 39],
  round: [0, 1, 24, 25],
  pine: [2, 3, 26, 27],
};
// 3×3 큰 나무 (윗줄 → 아랫줄)
const BIG_TREES = {
  cherry: [432, 433, 434, 456, 457, 458, 480, 481, 482],
  green: [435, 436, 437, 459, 460, 461, 483, 484, 485],
};
const CRYSTALS = [336, 337, 338, 339];
const BUSHES = [240, 241, 242, 246];
const FLOWERS = [264, 265, 266, 267, 270];
const ROCKS = [231, 234];

// 같은 지도는 항상 같은 모양으로 나오도록 고정된 난수
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class MapBuilder {
  constructor(name, title, width, height, seed, { base = 'grass', dark = false } = {}) {
    this.name = name;
    this.title = title;
    this.base = base;
    this.dark = dark;
    this.width = width;
    this.height = height;
    this.rnd = seeded(seed);
    const blank = () => new Array(width * height).fill(0);
    this.ground = blank();
    this.decor = blank();
    this.above = blank();
    this.collide = blank();
    this.terrain = new Array(width * height).fill('grass'); // grass(바탕 땅) | dirt | pond | mud
    this.taken = new Array(width * height).fill(false); // 장식을 더 놓을 수 없는 칸
    this.objects = [];
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  i(x, y) {
    return y * this.width + x;
  }
  pick(list) {
    return list[Math.floor(this.rnd() * list.length)];
  }

  area(kind, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        this.terrain[this.i(xx, yy)] = kind;
        this.taken[this.i(xx, yy)] = true;
      }
  }

  // 나무는 2×2. (x, y)는 밑동 왼쪽 칸. 밑동 줄은 막히고, 윗줄은 캐릭터보다 위에 그려진다.
  tree(kind, x, y) {
    if (!this.inside(x, y - 1) || !this.inside(x + 1, y)) return;
    const [tl, tr, bl, br] = TREES[kind];
    this.above[this.i(x, y - 1)] = gid('nature', tl);
    this.above[this.i(x + 1, y - 1)] = gid('nature', tr);
    this.decor[this.i(x, y)] = gid('nature', bl);
    this.decor[this.i(x + 1, y)] = gid('nature', br);
    for (const [xx, yy] of [[x, y], [x + 1, y], [x, y - 1], [x + 1, y - 1]]) this.taken[this.i(xx, yy)] = true;
    this.block(x, y);
    this.block(x + 1, y);
  }

  // 3×3 큰 나무. (x, y)는 밑동 가운데 칸.
  bigTree(kind, x, y) {
    const ids = BIG_TREES[kind];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const xx = x - 1 + c;
        const yy = y - 2 + r;
        if (!this.inside(xx, yy)) continue;
        const target = r < 2 ? this.above : this.decor;
        target[this.i(xx, yy)] = gid('nature', ids[r * 3 + c]);
        this.taken[this.i(xx, yy)] = true;
      }
    this.block(x, y);
    this.block(x - 1, y);
    this.block(x + 1, y);
  }

  // 지도 가장자리를 나무로 두른다. gaps: { top: [x0, x1], bottom: [x0, x1] } — 길목으로 비워 둘 칸 범위
  border(kind, gaps = {}) {
    const open = (range, x) => range && x + 1 >= range[0] && x <= range[1];
    for (let x = 0; x < this.width; x += 2) {
      if (!open(gaps.top, x)) this.tree(kind, x, 1);
      if (!open(gaps.bottom, x)) this.tree(kind, x, this.height - 1);
    }
    for (let y = 3; y < this.height - 1; y += 2) {
      this.tree(kind, 0, y);
      this.tree(kind, this.width - 2, y);
    }
  }

  // 이 지역의 보석·기억의 조각·제단 (id는 지역 이름)
  // gem이 없으면 보석은 흙더미 속에 묻어 둔다(dig로 따로 지정).
  treasures({ gem, fragment, altar }) {
    if (gem) this.point('gem', gem[0], gem[1], { id: this.name });
    this.point('fragment', fragment[0], fragment[1], { id: this.name });
    this.point('altar', altar[0], altar[1], { id: this.name });
    this.block(altar[0], altar[1]);
  }

  // 너구리가 파낼 수 있는 흙더미. reward: 'gem'(이 지역 보석) 또는 희귀 아이템 id
  dig(x, y, reward) {
    this.point('dig', x, y, { id: `${this.name}-${x}-${y}`, reward });
  }

  // 시든 나무가 길을 막는 칸 범위. region 지역이 복원되면 사라진다.
  // 길을 막는 것. unlock: 'restore:<지역>'(지역 복원 시) / 'dig'(너구리가 open:<id> 흙더미를 파면) / 'key:<아이템>'(열쇠)
  // look: 'dead-tree'(시든 나무) / 'rubble'(돌무더기) / 'door'(잠긴 문)
  barrier(x, y, w, h, { id, unlock, look }) {
    this.objects.push({ name: 'barrier', x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE, props: { id, unlock, look } });
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.taken[this.i(xx, yy)] = true;
  }

  // 여러 칸짜리 구조물을 (x, y)를 왼쪽 위로 찍는다. 윗줄 aboveRows개는 캐릭터보다 위, 나머지 줄은 막힌다.
  stamp(set, rows, x, y, aboveRows) {
    rows.forEach((row, r) =>
      row.forEach((id, c) => {
        const xx = x + c;
        const yy = y + r;
        if (!this.inside(xx, yy)) return;
        const top = r < aboveRows;
        (top ? this.above : this.decor)[this.i(xx, yy)] = gid(set, id);
        this.taken[this.i(xx, yy)] = true;
        if (!top) this.block(xx, yy);
      }),
    );
  }

  // 돌무더기 벽 (1칸짜리 돌을 이어 놓는다)
  rubbleWall(x0, x1, y) {
    for (let x = x0; x <= x1; x++) {
      this.decor[this.i(x, y)] = gid('ruins', this.pick(RUBBLE));
      this.taken[this.i(x, y)] = true;
      this.block(x, y);
    }
  }

  // 다른 지역으로 넘어가는 칸 범위. 들어서면 to 지도의 spawn 지점에 나타난다.
  exit(x, y, w, h, to, spawn) {
    this.objects.push({ name: 'exit', x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE, props: { to, spawn } });
  }

  // force: 길·공터 위에도 놓는다 (장식용)
  single(list, x, y, solid, force = false) {
    if (!this.inside(x, y) || (this.taken[this.i(x, y)] && !force)) return false;
    this.decor[this.i(x, y)] = gid('nature', this.pick(list));
    this.taken[this.i(x, y)] = true;
    if (solid) this.block(x, y);
    return true;
  }

  block(x, y) {
    this.collide[this.i(x, y)] = gid('floor', 177);
  }

  point(name, x, y, props) {
    this.objects.push({ name, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, props });
    this.taken[this.i(x, y)] = true;
  }

  // 빈 풀밭 칸 여기저기에 꽃·덤불·바위를 흩뿌린다.
  scatter(list, count, solid, avoid = () => false) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 50; tries++) {
      const x = Math.floor(this.rnd() * this.width);
      const y = Math.floor(this.rnd() * this.height);
      if (this.terrain[this.i(x, y)] !== 'grass' || avoid(x, y)) continue;
      if (this.single(list, x, y, solid)) placed++;
    }
  }

  // 지형(풀·흙·물)을 보고 가장자리 타일을 골라 바닥을 칠한다.
  paintGround() {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const kind = this.terrain[this.i(x, y)];
        if (kind === 'grass') {
          this.ground[this.i(x, y)] = gid('floor', this.pick(BASES[this.base]));
          continue;
        }
        const same = (dx, dy) => !this.inside(x + dx, y + dy) || this.terrain[this.i(x + dx, y + dy)] === kind;
        const col = same(-1, 0) ? (same(1, 0) ? 1 : 2) : 0;
        const row = same(0, -1) ? (same(0, 1) ? 1 : 2) : 0;
        const [set, ids] = ISLANDS[kind];
        this.ground[this.i(x, y)] = gid(set, ids[row * 3 + col]);
        if (kind === 'pond') this.block(x, y);
      }
  }

  toTiled() {
    const layer = (id, name, data, extra = {}) => ({
      id, name, type: 'tilelayer', x: 0, y: 0, width: this.width, height: this.height,
      opacity: 1, visible: true, data, ...extra,
    });
    return {
      type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
      infinite: false, compressionlevel: -1,
      width: this.width, height: this.height, tilewidth: TILE, tileheight: TILE,
      nextlayerid: 6, nextobjectid: this.objects.length + 1,
      properties: [
        { name: 'title', type: 'string', value: this.title },
        { name: 'dark', type: 'bool', value: this.dark },
      ],
      tilesets: TILESETS.map((t) => ({
        firstgid: FIRST_GID[t.key], name: t.name, image: `../assets/tilesets/${t.file}`,
        imagewidth: t.w, imageheight: t.h, columns: t.columns, tilecount: t.count,
        tilewidth: TILE, tileheight: TILE, margin: 0, spacing: 0,
      })),
      layers: [
        layer(1, 'ground', this.ground),
        layer(2, 'decor', this.decor),
        layer(3, 'above', this.above),
        layer(4, 'collide', this.collide, { visible: false }),
        {
          id: 5, name: 'objects', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown',
          objects: this.objects.map((o, n) => ({
            id: n + 1, name: o.name, type: '', x: o.x, y: o.y, rotation: 0, visible: true,
            ...(o.w ? { width: o.w, height: o.h } : { point: true, width: 0, height: 0 }),
            ...(o.props && {
              properties: Object.entries(o.props).map(([name, value]) => ({ name, type: 'string', value })),
            }),
          })),
        },
      ],
    };
  }
}

// ── 봄 들판 A ─────────────────────────────────────────────
// 시작 지역. 아래쪽에서 흙길을 따라 북쪽 길목(→ 숲길 B)으로 올라간다. 왼쪽 중간에 연못.
function meadowA() {
  const W = 30;
  const H = 50;
  const m = new MapBuilder('meadow-a', '봄 들판', W, H, 20261010);

  m.area('dirt', 13, 0, 3, 48); // 남북으로 가로지르는 길 (위쪽 끝은 숲길로 이어짐)
  m.area('pond', 3, 19, 7, 5); // 연못
  m.area('dirt', 20, 7, 6, 4); // 오른쪽 위 공터

  m.border('green', { top: [12, 17] });
  const trees = [
    ['cherry', 10, 6], ['cherry', 17, 14], ['cherry', 9, 28], ['cherry', 18, 33], ['cherry', 10, 41],
    ['cherry', 22, 24], ['cherry', 5, 12], ['cherry', 24, 40], ['green', 4, 34], ['green', 6, 37],
    ['green', 21, 18], ['green', 25, 20], ['green', 3, 8], ['green', 7, 15], ['green', 22, 44],
    ['green', 4, 44], ['cherry', 19, 4], ['green', 25, 13],
  ];
  for (const [kind, x, y] of trees) m.tree(kind, x, y);

  m.point('start', 14, 46);
  m.point('from-forest-b', 14, 4);
  m.exit(12, 0, 6, 1, 'forest-b', 'from-meadow-a');
  m.barrier(12, 2, 6, 2, { id: 'meadow-gate', unlock: 'restore:meadow-a', look: 'dead-tree' });
  m.treasures({ gem: [3, 29], fragment: [23, 8], altar: [17, 26] });
  m.point('pet', 7, 32);
  m.dig(25, 30, 'pan-flute');

  const nearPath = (x, y) => x >= 12 && x <= 16;
  m.scatter(BUSHES, 14, true, nearPath);
  m.scatter(ROCKS, 6, true, nearPath);
  m.scatter(FLOWERS, 90, false);

  m.paintGround();
  return m;
}

// ── 숲길 B ────────────────────────────────────────────────
// 들판과 언덕을 잇는 좁고 빽빽한 숲. 옆으로 빠지면 작은 샘이 있다.
function forestB() {
  const W = 24;
  const H = 40;
  const m = new MapBuilder('forest-b', '숲길', W, H, 20261011);

  m.area('dirt', 10, 0, 4, H); // 남북으로 이어지는 숲길
  m.area('pond', 3, 15, 4, 3); // 숲속 샘
  m.area('dirt', 17, 24, 4, 3); // 동쪽 작은 빈터

  m.border('pine', { top: [10, 13], bottom: [10, 13] });
  const trees = [
    ['pine', 2, 5], ['round', 5, 6], ['pine', 7, 9], ['pine', 3, 11], ['round', 7, 13],
    ['pine', 2, 22], ['pine', 5, 24], ['round', 7, 27], ['pine', 3, 30], ['pine', 6, 33], ['round', 2, 36],
    ['pine', 15, 4], ['round', 18, 6], ['pine', 16, 10], ['pine', 19, 13], ['round', 15, 16],
    ['pine', 18, 19], ['pine', 15, 22], ['round', 16, 30], ['pine', 19, 32], ['pine', 15, 35], ['cherry', 19, 28],
  ];
  for (const [kind, x, y] of trees) m.tree(kind, x, y);

  m.point('from-meadow-a', 11, H - 3);
  m.point('from-hill-c', 11, 4);
  m.exit(10, H - 1, 4, 1, 'meadow-a', 'from-forest-b');
  m.exit(10, 0, 4, 1, 'hill-c', 'from-forest-b');
  m.barrier(10, 2, 4, 2, { id: 'forest-gate', unlock: 'restore:forest-b', look: 'dead-tree' });
  m.treasures({ gem: [19, 25], fragment: [4, 19], altar: [14, 20] });
  m.dig(5, 28, 'letter');
  m.dig(20, 9, 'hourglass');

  const nearPath = (x, y) => x >= 9 && x <= 14;
  m.scatter(BUSHES, 22, true, nearPath);
  m.scatter(ROCKS, 5, true, nearPath);
  m.scatter(FLOWERS, 30, false);

  m.paintGround();
  return m;
}

// ── 꽃 언덕 C ─────────────────────────────────────────────
// 숲길 끝의 꽃밭 언덕. 큰 벚꽃나무에 둘러싸인 공터 한가운데에 기억의 조각이 있다.
function hillC() {
  const W = 30;
  const H = 36;
  const m = new MapBuilder('hill-c', '꽃 언덕', W, H, 20261012);

  m.area('dirt', 13, 20, 3, H - 20); // 숲길에서 올라오는 길
  m.area('dirt', 10, 12, 10, 8); // 언덕 위 공터
  m.area('dirt', 13, 0, 3, 12); // 공터에서 북쪽 유적으로 가는 오래된 길

  m.border('round', { bottom: [12, 17], top: [12, 17] });
  m.bigTree('cherry', 6, 9);
  m.bigTree('cherry', 24, 9);
  m.bigTree('cherry', 6, 27);
  m.bigTree('cherry', 24, 28);
  m.bigTree('green', 21, 5);
  const trees = [
    ['cherry', 3, 17], ['cherry', 24, 18], ['green', 9, 31], ['green', 19, 32], ['cherry', 21, 23], ['cherry', 7, 22],
  ];
  for (const [kind, x, y] of trees) m.tree(kind, x, y);

  m.treasures({ fragment: [15, 16], altar: [15, 13] });
  m.dig(4, 24, 'gem'); // 언덕의 보석은 땅속에 — 너구리가 있어야 찾을 수 있다
  m.dig(25, 22, 'picture-book');
  m.dig(22, 33, 'flower-seed');
  for (const [x, y] of [[13, 13], [17, 13], [12, 17], [18, 17]]) m.single(CRYSTALS, x, y, false, true);
  m.point('from-forest-b', 14, H - 3);
  m.point('from-ruins-d', 14, 4);
  m.exit(12, H - 1, 6, 1, 'forest-b', 'from-hill-c');
  m.exit(12, 0, 6, 1, 'ruins-d', 'from-hill-c');
  m.barrier(12, 2, 6, 2, { id: 'hill-gate', unlock: 'restore:hill-c', look: 'dead-tree' });

  const nearPath = (x, y) => x >= 12 && x <= 16;
  m.scatter(BUSHES, 8, true, nearPath);
  m.scatter(FLOWERS, 150, false);

  m.paintGround();
  return m;
}

// ── 잊힌 유적 D (던전) ────────────────────────────────────
// 언덕 북쪽 숲속의 어두운 유적. 무너진 돌무더기를 너구리가 파서 길을 내고,
// 옆방에서 은빛 열쇠를 찾아 잠긴 문 안의 보석을 꺼낸 뒤, 무너진 돌집 앞 제단에서 마지막 기억을 되찾는다.
function ruinsD() {
  const W = 24;
  const H = 36;
  const m = new MapBuilder('ruins-d', '잊힌 유적', W, H, 20261013, { base: 'earth', dark: true });

  m.area('mud', 10, 25, 4, H - 25); // 입구 통로
  m.area('mud', 6, 6, 12, 5); // 돌집 앞 광장

  m.border('pine', { bottom: [10, 13] });

  // 위쪽: 무너진 돌집과 기둥, 석상
  m.stamp('ruins', RUINS.house, 10, 2, 2);
  m.stamp('ruins', RUINS.thinPillar, 7, 3, 2);
  m.stamp('ruins', RUINS.thinPillar, 16, 3, 2);
  m.stamp('ruins', RUINS.statue, 19, 7, 1);
  m.stamp('ruins', RUINS.statue, 3, 7, 1);

  // 가운데: 기둥 사이 방들. 오른쪽 구석방은 잠긴 문 안에 보석이 있다.
  m.stamp('ruins', RUINS.pillar, 6, 13, 2);
  m.stamp('ruins', RUINS.pillar, 12, 17, 2);
  m.stamp('ruins', RUINS.pillar, 6, 19, 2);
  m.rubbleWall(17, 21, 12); // 구석방 위 벽
  m.rubbleWall(17, 21, 17); // 구석방 아래 벽
  for (const y of [13, 15, 16]) m.rubbleWall(17, 17, y); // 구석방 왼쪽 벽 (14번 줄은 문)
  m.barrier(17, 14, 1, 1, { id: 'ruins-door', unlock: 'key:silver-key', look: 'door' });

  // 아래쪽: 입구 위를 막은 돌무더기 벽. 가운데는 너구리가 파면 열린다.
  m.rubbleWall(2, 9, 23);
  m.rubbleWall(14, 21, 23);
  m.rubbleWall(2, 9, 24);
  m.rubbleWall(14, 21, 24);
  m.barrier(10, 23, 4, 2, { id: 'ruins-rubble', unlock: 'dig', look: 'rubble' });
  m.dig(11, 26, 'open:ruins-rubble');

  m.treasures({ gem: [20, 14], fragment: [4, 10], altar: [12, 8] });
  m.dig(3, 15, 'silver-key');

  m.point('from-hill-c', 11, H - 4);
  m.exit(10, H - 1, 4, 1, 'hill-c', 'from-ruins-d');

  // 덤불·바위는 통로와 방(11~22번 줄)을 피해서 놓는다. (문·흙더미로 가는 길이 막히지 않게)
  const keepClear = (x, y) => (x >= 9 && x <= 14) || (y >= 11 && y <= 22);
  m.scatter(BUSHES, 10, true, keepClear);
  m.scatter(ROCKS, 6, true, keepClear);

  m.paintGround();
  return m;
}

mkdirSync('public/maps', { recursive: true });
for (const map of [meadowA(), forestB(), hillC(), ruinsD()]) {
  writeFileSync(`public/maps/${map.name}.json`, JSON.stringify(map.toTiled()));
  console.log(`public/maps/${map.name}.json (${map.width}×${map.height})`);
}