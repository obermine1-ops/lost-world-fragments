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
  // 너구리가 동료가 되었는지
  pet: boolean;
  // 이미 파 본 흙더미 / 찾은 희귀 아이템
  dug: string[];
  items: string[];
  // 열린 길(돌무더기·잠긴 문)
  opened: string[];
}

export const FIRST_MAP = 'meadow-a';
export const MAPS = ['meadow-a', 'forest-b', 'hill-c', 'ruins-d', 'beach-e'] as const;

export function newGame(): GameState {
  return { map: FIRST_MAP, fragments: [], gems: [], restored: [], pet: false, dug: [], items: [], opened: [] };
}

export const game = { state: newGame() };
