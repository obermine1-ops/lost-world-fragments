import { MAPS, type GameState } from './state';

// 진행 상태를 이 기기의 브라우저 저장소에 보관한다. (서버 없음)
// 저장 형식이 바뀌면 VERSION을 올리고 migrate에서 옛 기록을 새 형식으로 고친다.
const KEY = 'lost-world-fragments/save';
// v1: 색 복원이 세상 전체 하나(restored: boolean) / v2: 지역별 복원 목록 + 보석
const VERSION = 2;

interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

export function saveGame(state: GameState) {
  const file: SaveFile = { version: VERSION, savedAt: Date.now(), state };
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {
    // 사생활 보호 모드 등으로 저장할 수 없으면 조용히 넘어간다. (게임은 계속 할 수 있다)
  }
}

export function loadGame(): GameState | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    return migrate(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function hasSave() {
  return loadGame() !== undefined;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

// 옛 버전 기록을 지금 형식으로 바꾼다. 알아볼 수 없는 기록이면 버린다(게임이 깨지지 않게).
function migrate(file: { version?: number; state?: Record<string, unknown> }): GameState | undefined {
  const s = file.state;
  if (!s || typeof file.version !== 'number' || file.version > VERSION) return undefined;
  if (!MAPS.includes(s.map as (typeof MAPS)[number])) return undefined;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

  // v1 → v2: 조각 id가 'spring-1' 하나뿐이었고, 복원은 세상 전체였다. 진행 위치만 살리고 수집은 새로 시작한다.
  if (file.version === 1) return { map: s.map as string, fragments: [], gems: [], restored: [] };

  return {
    map: s.map as string,
    x: typeof s.x === 'number' ? s.x : undefined,
    y: typeof s.y === 'number' ? s.y : undefined,
    fragments: strings(s.fragments),
    gems: strings(s.gems),
    restored: strings(s.restored),
  };
}
