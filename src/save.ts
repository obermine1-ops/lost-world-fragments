import { MAPS, type GameState } from './state';

// 진행 상태를 이 기기의 브라우저 저장소에 보관한다. (서버 없음)
// 저장 형식이 바뀌면 VERSION을 올리고 migrate에서 옛 기록을 새 형식으로 고친다.
const KEY = 'lost-world-fragments/save';
const VERSION = 1;

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
function migrate(file: Partial<SaveFile>): GameState | undefined {
  if (file.version !== VERSION || !file.state) return undefined;
  const s = file.state;
  if (!MAPS.includes(s.map as (typeof MAPS)[number])) return undefined;
  return {
    map: s.map,
    x: typeof s.x === 'number' ? s.x : undefined,
    y: typeof s.y === 'number' ? s.y : undefined,
    fragments: Array.isArray(s.fragments) ? s.fragments.filter((f) => typeof f === 'string') : [],
    restored: s.restored === true,
  };
}
