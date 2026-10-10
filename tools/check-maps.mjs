// 지도 검사: 모든 보석·조각·제단·흙더미·너구리·길목에 실제로 걸어서 닿을 수 있는지 확인한다.
// (진행 불가 버그 예방) 실행: npm run check-maps
// - 열리는 길(돌무더기·잠긴 문)은 "열기 전"에도 그 길을 여는 데 필요한 것(흙더미·열쇠)에 닿을 수 있어야 한다.
import { readFileSync, readdirSync } from 'node:fs';

const MAPS = readdirSync('public/maps').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const T = 16;
let failures = 0;

for (const name of MAPS) {
  const map = JSON.parse(readFileSync(`public/maps/${name}.json`, 'utf8'));
  const W = map.width;
  const H = map.height;
  const collide = map.layers.find((l) => l.name === 'collide').data;
  const objects = map.layers.find((l) => l.name === 'objects').objects;
  const prop = (o, k) => o.properties?.find((p) => p.name === k)?.value;
  const barriers = objects.filter((o) => o.name === 'barrier');
  const tileOf = (o) => [Math.floor(o.x / T), Math.floor(o.y / T)];

  // closed: 아직 닫혀 있는 장벽 id 목록
  const reachable = (closed) => {
    const blocked = collide.map((g) => g !== 0);
    for (const b of barriers) {
      if (!closed.includes(prop(b, 'id'))) {
        // 연잎 다리가 놓이면 그 아래 바다를 건널 수 있다.
        if (prop(b, 'look') === 'lilypad')
          for (let y = b.y / T; y < (b.y + b.height) / T; y++) for (let x = b.x / T; x < (b.x + b.width) / T; x++) blocked[y * W + x] = false;
        continue;
      }
      for (let y = b.y / T; y < (b.y + b.height) / T; y++) for (let x = b.x / T; x < (b.x + b.width) / T; x++) blocked[y * W + x] = true;
    }
    const starts = objects.filter((o) => o.name === 'start' || o.name.startsWith('from-')).map(tileOf);
    const seen = new Uint8Array(W * H);
    const queue = starts.filter(([x, y]) => !blocked[y * W + x]);
    for (const [x, y] of queue) seen[y * W + x] = 1;
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx] || seen[ny * W + nx]) continue;
        seen[ny * W + nx] = 1;
        queue.push([nx, ny]);
      }
    }
    // 물건 칸 자체가 막혀 있으면(제단처럼) 바로 옆 칸에 닿으면 된다.
    return (o) => {
      const [x, y] = tileOf(o);
      return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * W + (x + dx)]);
    };
  };

  const check = (label, ok) => {
    if (!ok) failures++;
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}`);
  };

  console.log(`${name}`);
  // 1) 지역을 복원하면 열리는 장벽만 닫힌 상태(= 이 지역을 막 시작했을 때)에서
  //    보석·조각·제단·너구리, 그리고 흙더미·문 열쇠 순서로 닿을 수 있는지 차례로 확인한다.
  const restoreGates = barriers.filter((b) => prop(b, 'unlock').startsWith('restore:')).map((b) => prop(b, 'id'));
  let closed = barriers.map((b) => prop(b, 'id'));
  // 열 수 있는 것을 하나씩 열어 본다 (흙더미로 여는 돌무더기 → 열쇠로 여는 문)
  for (let round = 0; round < 5; round++) {
    const can = reachable(closed);
    const items = [
      ...objects.filter((o) => o.name === 'dig' && can(o)).map((o) => prop(o, 'reward')),
      ...objects.filter((o) => o.name === 'pet' && can(o)).map((o) => `pet:${prop(o, 'kind')}`),
    ];
    closed = closed.filter((id) => {
      const b = barriers.find((x) => prop(x, 'id') === id);
      const unlock = prop(b, 'unlock');
      if (unlock === 'dig') return !items.includes(`open:${id}`);
      if (unlock.startsWith('key:')) return !items.includes(unlock.slice(4));
      if (unlock.startsWith('pet:')) return !items.includes(unlock);
      return true;
    });
  }
  const canBeforeRestore = reachable(closed);
  for (const o of objects.filter((x) => ['gem', 'fragment', 'altar', 'pet', 'dig', 'house'].includes(x.name))) {
    check(`${o.name} ${prop(o, 'reward') ?? prop(o, 'id') ?? ''} (${tileOf(o)})`, canBeforeRestore(o));
  }
  const stillClosed = closed.filter((id) => !restoreGates.includes(id));
  check(`복원 전 열 수 없는 장벽 없음 ${stillClosed.join(',')}`, stillClosed.length === 0);
  // 2) 지역 복원 후에는 모든 길목에 닿을 수 있어야 한다.
  const canAfter = reachable([]);
  for (const o of objects.filter((x) => x.name === 'exit')) check(`길목 → ${prop(o, 'to')}`, canAfter(o));
}

console.log(failures ? `\n문제 ${failures}개` : '\n모든 지도 통과');
process.exit(failures ? 1 : 0);
