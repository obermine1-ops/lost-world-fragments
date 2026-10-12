import { MAPS, newGame, type GameState } from './state';

// 진행 상태를 이 기기의 브라우저 저장소에 보관한다. (서버 없음)
// 저장 형식이 바뀌면 VERSION을 올리고 migrate에서 옛 기록을 새 형식으로 고친다.
const KEY = 'lost-world-fragments/save';
// v1: 색 복원이 세상 전체 하나(restored: boolean) / v2: 지역별 복원 목록 + 보석 / v3: 너구리·흙더미·희귀 아이템
// v4: 열린 길(유적의 돌무더기·잠긴 문) / v5: 개구리(여름) / v6: 나의 집 배치 / v7: 숨은 반딧불 / v8: 앵무새(가을) / v9: 집 벽지·바닥 / v10: 햄스터(겨울) / v11: 한 번만 나오는 안내 / v12: 플레이 기록
const VERSION = 12;

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

// 백업 코드: 기록을 글자로 바꿔 복사해 두었다가(다른 기기에서도) 다시 불러온다.
// 형식 "LWF1:" + base64(저장 파일 JSON). 불러올 때도 옛 버전 고치기(migrate)를 거친다.
const CODE_PREFIX = 'LWF1:';

export function exportCode(): string | undefined {
  const state = loadGame();
  if (!state) return undefined;
  const json = JSON.stringify({ version: VERSION, savedAt: Date.now(), state } satisfies SaveFile);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return CODE_PREFIX + btoa(binary);
}

export function importCode(code: string): GameState | undefined {
  try {
    const text = code.replace(/\s+/g, '');
    if (!text.startsWith(CODE_PREFIX)) return undefined;
    const binary = atob(text.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return migrate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}

// 옛 버전 기록을 지금 형식으로 바꾼다. 알아볼 수 없는 기록이면 버린다(게임이 깨지지 않게).
function migrate(file: { version?: number; state?: Record<string, unknown> }): GameState | undefined {
  const s = file.state;
  if (!s || typeof file.version !== 'number' || file.version > VERSION) return undefined;
  if (!MAPS.includes(s.map as (typeof MAPS)[number])) return undefined;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

  // v1 → v2: 조각 id가 'spring-1' 하나뿐이었고, 복원은 세상 전체였다. 진행 위치만 살리고 수집은 새로 시작한다.
  if (file.version === 1) return { ...newGame(), map: s.map as string };

  // v2 → … → v5: 새 항목(너구리·흙더미·아이템·열린 길·개구리)은 빈 값으로 시작한다.
  return {
    map: s.map as string,
    x: typeof s.x === 'number' ? s.x : undefined,
    y: typeof s.y === 'number' ? s.y : undefined,
    fragments: strings(s.fragments),
    gems: strings(s.gems),
    restored: strings(s.restored),
    pet: s.pet === true,
    frog: s.frog === true,
    parrot: s.parrot === true,
    hamster: s.hamster === true,
    dug: strings(s.dug),
    items: strings(s.items),
    opened: strings(s.opened),
    fireflies: strings(s.fireflies),
    tips: strings(s.tips),
    stats: readStats(s.stats),
    wallpaper: typeof s.wallpaper === 'number' ? s.wallpaper : 0,
    floor: typeof s.floor === 'number' ? s.floor : 0,
    house: Array.isArray(s.house)
      ? (s.house as unknown[]).filter(
          (h): h is { key: string; x: number; y: number } =>
            typeof h === 'object' && h !== null && typeof (h as { key?: unknown }).key === 'string' &&
            typeof (h as { x?: unknown }).x === 'number' && typeof (h as { y?: unknown }).y === 'number',
        )
      : [],
  };
}

function readStats(v: unknown): GameState['stats'] {
  if (typeof v !== 'object' || v === null) return {};
  const out: GameState['stats'] = {};
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    const r = raw as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
    if (typeof r === 'object' && r !== null) out[key] = { ms: num(r.ms), guides: num(r.guides), nudges: num(r.nudges) };
  }
  return out;
}
