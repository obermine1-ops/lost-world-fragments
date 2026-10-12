import Phaser from 'phaser';
import { game } from '../../state';
import { CAVE_DONE, REGIONS, type Region } from '../../regions';
import { withJosa } from '../../items';
import type { PetKind } from '../../pet';
import type { Point } from '../../pathfinding';
import { center, hasPet, prop, type MapObject } from './common';

// 길 안내: 목표 문구를 누르면 지금 목표까지 발자국이 이어진다. 여기는 "어디로"와 "발자국 자리" 계산만 —
// 화면에 그리는 일은 GameScene.showGuide가 한다.

// 지금 목표가 있는 곳(지점), 또는 길 대신 들려줄 말. titleOf: 지도 이름 (예: "단풍 숲")
export function guideTarget(r: Region | undefined, objs: MapObject[], titleOf: (key: string) => string): Point | string | undefined {
  const s = game.state;
  if (!r) {
    // 무지개 동굴: 아직 안 가져온 빛 조각 심부름 → 받침돌 (막힌 길은 여는 곳으로 돌려 안내)
    if (s.opened.includes(CAVE_DONE)) return undefined;
    const perch = objs.find((o) => o.name === 'perch' && !s.dug.includes(prop(o, 'id')!));
    if (perch) return center(perch);
    const box = objs.find((o) => o.name === 'treasure');
    return box ? { x: box.x!, y: box.y! + 16 } : undefined;
  }
  if (s.restored.includes(r.key)) {
    const next = REGIONS[REGIONS.indexOf(r) + 1];
    if (s.restored.includes('peak-m') && !s.opened.includes(CAVE_DONE)) {
      const gate = objs.find((o) => o.name === 'exit' && prop(o, 'to') === 'cave-n');
      return gate ? center(gate) : '오른쪽 위 "지도"에서 "나의 집으로" 간 뒤\n왼쪽 아래로 가 보세요';
    }
    if (!next || s.restored.includes(next.key)) return '반딧불은 숨어 있어요.\n가까이 가면 반짝여요';
    const exit = objs.find((o) => o.name === 'exit' && prop(o, 'to') === next.key);
    // 다음 계절은 다른 지역에서 이어진다 → 지도로 바로 가면 된다
    return exit ? center(exit) : `오른쪽 위 "지도"에서\n${withJosa(titleOf(next.key), '으로', '로')} 바로 갈 수 있어요`;
  }
  if (!s.gems.includes(r.key)) {
    const gem = objs.find((o) => o.name === 'gem');
    if (gem) return center(gem);
    const hidden = objs.find((o) => (o.name === 'dig' || o.name === 'perch') && prop(o, 'reward') === 'gem' && !s.dug.includes(prop(o, 'id')!));
    if (hidden) {
      const kind = (hidden.name === 'dig' ? 'raccoon' : prop(hidden, 'pet') ?? 'parrot') as PetKind;
      if (!hasPet(kind)) return '도와줄 친구는 다른 곳에 있어요.\n오른쪽 위 "지도"로 바로 갈 수 있어요';
      return center(hidden);
    }
  }
  if (!s.fragments.includes(r.key)) {
    const fragment = objs.find((o) => o.name === 'fragment');
    if (fragment) return center(fragment);
  }
  const altar = objs.find((o) => o.name === 'altar');
  return altar ? { x: altar.x!, y: altar.y! + 16 } : undefined;
}

// 아직 열리지 않은 길을 여는 곳들 (막힌 목표 대신 안내할 후보): 돌무더기 흙더미·열쇠·잠긴 문·연잎 다리 물가
export function unblockers(objs: MapObject[]): Point[] {
  const s = game.state;
  const barriers = objs.filter((o) => o.name === 'barrier' && !s.opened.includes(prop(o, 'id')!));
  const keys = barriers.map((o) => prop(o, 'unlock')!).filter((u) => u.startsWith('key:')).map((u) => u.slice(4));
  const out: Point[] = [];
  for (const o of objs) {
    const reward = prop(o, 'reward');
    if ((o.name === 'dig' || o.name === 'perch') && !s.dug.includes(prop(o, 'id')!) && reward) {
      if (reward.startsWith('open:') || (keys.includes(reward) && !s.items.includes(reward))) out.push({ x: o.x!, y: o.y! });
    }
  }
  for (const o of barriers) {
    const unlock = prop(o, 'unlock')!;
    if (prop(o, 'look') === 'lilypad') out.push({ x: o.x! + o.width! / 2, y: o.y! - 10 });
    else if (unlock.startsWith('key:') && s.items.includes(unlock.slice(4))) out.push({ x: o.x! + o.width! / 2, y: o.y! + o.height! + 8 });
  }
  return out;
}

// 경로를 따라 일정한 간격으로 발자국 자리 (왼발·오른발 번갈아 살짝 비켜서). 아무리 길어도 70개쯤.
export function footprints(waypoints: Point[]): Point[] {
  const steps: Point[] = [];
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) total += Phaser.Math.Distance.BetweenPoints(waypoints[i - 1], waypoints[i]);
  const gap = Math.max(12, total / 70);
  let carry = gap / 2;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const len = Phaser.Math.Distance.BetweenPoints(a, b);
    const angle = Phaser.Math.Angle.BetweenPoints(a, b);
    for (let d = carry; d < len; d += gap) {
      const side = steps.length % 2 === 0 ? 2 : -2;
      steps.push({ x: a.x + Math.cos(angle) * d - Math.sin(angle) * side, y: a.y + Math.sin(angle) * d + Math.cos(angle) * side });
    }
    carry = (carry - len) % gap;
    if (carry < 0) carry += gap;
  }
  return steps;
}
