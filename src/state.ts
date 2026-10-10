// 지역을 옮겨 다녀도 유지되는 진행 상태. (S-2.6에서 기기에 자동 저장)
export interface GameState {
  map: string;
  // 마지막으로 서 있던 위치 (이어하기용). 없으면 지도의 시작 지점.
  x?: number;
  y?: number;
  // 주운 기억의 조각 id
  fragments: string[];
  // 색이 돌아왔는지 (Sprint 3에서 지역별로 나뉜다)
  restored: boolean;
}

export const FIRST_MAP = 'meadow-a';
export const MAPS = ['meadow-a', 'forest-b', 'hill-c'] as const;

export function newGame(): GameState {
  return { map: FIRST_MAP, fragments: [], restored: false };
}

export const game = { state: newGame() };
