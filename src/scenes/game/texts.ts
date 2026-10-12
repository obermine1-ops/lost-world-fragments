import type { GameState } from '../../state';

// 탐험 화면의 정해진 글과 작은 표들 (무지개 동굴 빛 조각 · 새 소식 · 메시지)

// 무지개 동굴(엔딩 뒤 비밀 장소)의 빛 조각 두 개 — 희귀 아이템이 아니라 동굴 진행용
export const SHARDS: Record<string, { name: string; gem: string; tint: number }> = {
  'rainbow-a': { name: '노을빛 조각', gem: 'gem-red', tint: 0xffb38a },
  'rainbow-b': { name: '하늘빛 조각', gem: 'gem-purple', tint: 0x9ae6ff },
};

export function shardCount(s: GameState) {
  return Object.keys(SHARDS).filter((k) => s.items.includes(k)).length;
}

export const MSG_TREASURE_EMPTY = (n: number) => `받침돌에 빈 홈이 두 개 있다… (${n}/2)\n동굴 어딘가의 빛 조각을 찾아오자`;
export const MSG_CAVE_GIFT = (gift: string) => `새 가구를 얻었다: ${gift}\n(봄 들판의 나의 집에 놓을 수 있다)`;
export const MSG_NO_FISH = '물이 잿빛으로 고여 있다…\n색을 되찾으면 물고기도 돌아올 것 같다';

// 새 소식 (예전 기록으로 돌아온 사람에게 한 번). 새 기능이 생기면 NEWS_TIP 이름을 바꾸고 줄을 고친다.
export const NEWS_TIP = 'news-2026-10b';
export const NEWS_LINES = [
  '✿ 낚시 — 색을 되찾은 물가의 잔물결에 다가가 보세요',
  '♥ 친구 마음 — 쓰다듬어 하트를 채우면 친구 이야기를 들려줘요',
  '◎ 세계 지도 — 오른쪽 위 "지도"로 가 본 곳에 바로 가요',
  '◇ 무지개 동굴 — 네 계절을 모두 되찾으면 봄 들판 어딘가에서…',
  '♪ 되찾은 곳에서는 바람·물소리도 돌아와요',
  '▤ 도감에 물고기·친구 탭이 생겼어요',
];
