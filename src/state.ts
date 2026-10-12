// 지역을 옮겨 다녀도 유지되는 진행 상태. (기기에 자동 저장 — src/save.ts)
export interface GameState {
  map: string;
  // 마지막으로 서 있던 위치 (이어하기용). 없으면 지도의 시작 지점.
  x?: number;
  y?: number;
  // 주운 기억의 조각 / 보석 (지역 이름으로 구분)
  fragments: string[];
  gems: string[];
  // 색이 돌아온 지역
  restored: string[];
  // 너구리 / 개구리 / 앵무새 / 햄스터가 동료가 되었는지
  pet: boolean;
  frog: boolean;
  parrot: boolean;
  hamster: boolean;
  // 이미 파 본 흙더미 / 찾은 희귀 아이템
  dug: string[];
  items: string[];
  // 열린 길(돌무더기·잠긴 문·연잎 다리)
  opened: string[];
  // 찾은 숨은 반딧불 (지역마다 3마리)
  fireflies: string[];
  // 나의 집에 놓은 물건 (방 바닥 칸 x, y)
  house: { key: string; x: number; y: number }[];
  // 나의 집 벽지·바닥 (furniture.ts의 WALLPAPERS·FLOORS 번호)
  wallpaper: number;
  floor: number;
  // 이미 본 한 번만 나오는 안내 (goal·map·collection)
  tips: string[];
  // 지역별 플레이 기록 (지인 테스트용): 머문 시간(ms) · 길 안내 누른 횟수 · 오래 막혀 목표가 흔들린 횟수
  stats: Record<string, RegionStats>;
  // 낚은 물고기 (fish.ts id → 잡은 수)
  fish: Record<string, number>;
  // 친구 마음 (동물 → 쓰다듬은 점수, bond.ts)
  bond: Record<string, number>;
}

export interface RegionStats {
  ms: number;
  guides: number;
  nudges: number;
}

// 지역 기록을 꺼낸다 (없으면 새로 만든다)
export function statsOf(state: GameState, key: string) {
  return (state.stats[key] ??= { ms: 0, guides: 0, nudges: 0 });
}

export const FIRST_MAP = 'meadow-a';
export const MAPS = ['meadow-a', 'forest-b', 'hill-c', 'ruins-d', 'beach-e', 'village-f', 'island-g', 'maple-h', 'harvest-i', 'tower-j', 'snow-k', 'lake-l', 'peak-m', 'cave-n'] as const;

export function newGame(): GameState {
  return { map: FIRST_MAP, fragments: [], gems: [], restored: [], pet: false, frog: false, parrot: false, hamster: false, dug: [], items: [], opened: [], fireflies: [], house: [], wallpaper: 0, floor: 0, tips: [], stats: {}, fish: {}, bond: {} };
}

export const game = { state: newGame() };

// 여러 지역의 머문 시간 합 (분, 반올림). 1분이 안 되면 0이 아니라 1분 미만으로 보이게 호출하는 쪽에서 처리.
export function playMs(state: GameState, keys: string[]) {
  return keys.reduce((sum, k) => sum + (state.stats[k]?.ms ?? 0), 0);
}

export function formatPlayTime(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return '1분 미만';
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
