import { REGIONS, firefliesOf, regionsOf, SEASONS } from './regions';
import { RARE_ITEMS } from './items';
import type { GameState } from './state';

// 나의 집에 놓을 수 있는 가구. 돈·상점 없이, 탐험하며 얻는다.
//   start: 처음부터 / 지역 이름: 그 지역을 복원하면 / season:<계절>: 그 계절을 모두 되찾으면
// frames는 위 줄 → 아래 줄 순서. 맨 아랫줄이 바닥 한 칸을 차지하고, 윗줄은 그 위로 솟아 보인다.
export interface Furniture {
  id: string;
  name: string;
  sheet: 'element-sheet' | 'bed-sheet';
  frames: number[];
  from: string;
}

export const FURNITURE: Furniture[] = [
  { id: 'bed', name: '파란 침대', sheet: 'bed-sheet', frames: [54, 68], from: 'start' },
  { id: 'table', name: '작은 탁자', sheet: 'element-sheet', frames: [14], from: 'start' },
  { id: 'plant', name: '새싹 화분', sheet: 'element-sheet', frames: [128], from: 'meadow-a' },
  { id: 'chair', name: '나무 의자', sheet: 'element-sheet', frames: [144], from: 'forest-b' },
  { id: 'flower-basket', name: '꽃바구니', sheet: 'element-sheet', frames: [24], from: 'hill-c' },
  { id: 'bookshelf', name: '오래된 책장', sheet: 'element-sheet', frames: [115, 131], from: 'ruins-d' },
  { id: 'picture', name: '봄 그림 액자', sheet: 'element-sheet', frames: [168], from: 'season:spring' },
  { id: 'fishbowl', name: '어항', sheet: 'element-sheet', frames: [160], from: 'beach-e' },
  { id: 'stool', name: '작은 평상', sheet: 'element-sheet', frames: [117], from: 'village-f' },
  { id: 'lamp', name: '버섯 등', sheet: 'element-sheet', frames: [16], from: 'island-g' },
  { id: 'ball', name: '비치볼', sheet: 'element-sheet', frames: [167], from: 'season:summer' },
  { id: 'firefly-jar', name: '봄 반딧불 유리병', sheet: 'element-sheet', frames: [169], from: 'fireflies:spring' },
  { id: 'shell-lamp', name: '여름 반딧불 등', sheet: 'element-sheet', frames: [165], from: 'fireflies:summer' },
];

// 방에 놓을 수 있는 것 = 가구 + 도감의 보석·희귀 아이템 (전시품)
export interface Placeable {
  key: string; // 'f:bed' | 'gem:meadow-a' | 'item:pan-flute'
  name: string;
  texture: string;
  frames?: number[];
  tint?: number;
}

export function ownedPlaceables(s: GameState): Placeable[] {
  const seasonDone = (key: string) => regionsOf(key as 'spring').every((r) => s.restored.includes(r.key));
  const firefliesDone = (season: string) =>
    s.fireflies.filter((id) => regionsOf(season as 'spring').some((r) => id.startsWith(`${r.key}-`))).length >= firefliesOf(season as 'spring');
  const owned = FURNITURE.filter((f) => {
    if (f.from === 'start') return true;
    if (f.from.startsWith('season:')) return seasonDone(f.from.slice(7));
    if (f.from.startsWith('fireflies:')) return firefliesDone(f.from.slice(10));
    return s.restored.includes(f.from);
  });
  return [
    ...owned.map((f) => ({ key: `f:${f.id}`, name: f.name, texture: f.sheet, frames: f.frames })),
    ...REGIONS.filter((r) => s.gems.includes(r.key)).map((r) => ({
      key: `gem:${r.key}`,
      name: `${r.gemName} 보석`,
      texture: `gem-${r.gem}`,
      tint: r.gemTint,
    })),
    ...RARE_ITEMS.filter((i) => s.items.includes(i.id)).map((i) => ({ key: `item:${i.id}`, name: i.name, texture: `item-${i.id}` })),
  ];
}

// 지역을 복원했을 때 새로 생기는 가구 (안내 문구용)
export function furnitureFrom(source: string) {
  return FURNITURE.filter((f) => f.from === source);
}

export const ALL_SEASONS = SEASONS.map((s) => s.key);
