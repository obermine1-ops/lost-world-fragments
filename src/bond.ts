import type { GameState } from './state';
import type { PetKind } from './pet';
import type { Season } from './regions';

// 친구 마음: 동물을 쓰다듬을수록 쌓이고, 하트 다섯 칸까지 찬다.
// 같은 동물을 연달아 눌러도 COOLDOWN_MS에 한 번만 오르게 해서, 오래 함께 다니며 조금씩 가까워지게 한다.
export const PET_NAMES: Record<PetKind, string> = { raccoon: '너구리', frog: '개구리', parrot: '앵무새', hamster: '햄스터' };
export const MAX_HEARTS = 5;
const POINTS_PER_HEART = 6;
const COOLDOWN_MS = 5000;
const lastPet: Partial<Record<PetKind, number>> = {};

export function heartsOf(state: GameState, kind: PetKind) {
  return Math.min(MAX_HEARTS, Math.floor((state.bond[kind] ?? 0) / POINTS_PER_HEART));
}

// "♥♥♡♡♡"
export function heartBar(hearts: number) {
  return '♥'.repeat(hearts) + '♡'.repeat(MAX_HEARTS - hearts);
}

// 마음이 가득 차면 들려주는 친구 이야기 (기억 장면, 그 친구를 만난 계절빛으로)
export const PET_STORIES: Record<PetKind, { season: Season; lines: string[] }> = {
  raccoon: {
    season: 'spring',
    lines: [
      '너구리는 들판에서 혼자 흙을 파며 무언가를 찾고 있었다.',
      '알고 보니 잃어버린 건 먹이가 아니라, 같이 놀 친구였다.',
      '이제 너구리는 파낸 것을 늘 나에게 먼저 보여 준다.',
    ],
  },
  frog: {
    season: 'summer',
    lines: [
      '개구리는 마을 연못에서 매일 같은 노래를 불렀다.',
      '아무도 대답하지 않아도, 언젠가 누가 들어 주리라 믿으면서.',
      '오늘 처음으로, 내가 그 노래를 따라 흥얼거렸다.',
    ],
  },
  parrot: {
    season: 'autumn',
    lines: [
      "앵무새는 단풍 숲에서 한 낱말만 되풀이했다. '돌아와.'",
      '누구를 기다렸는지는 끝내 말해 주지 않았다.',
      "그래도 요즘은 나를 보면 '왔다!' 하고 운다.",
    ],
  },
  hamster: {
    season: 'winter',
    lines: [
      '햄스터는 눈 속 작은 굴에 씨앗을 모아 두고 있었다.',
      '겨울을 혼자 견디려고, 아주 조금씩.',
      '이제 그 씨앗을 나누어 먹을 친구가 생겼다.',
    ],
  },
};

// 마음이 한 칸 올랐을 때 보여 줄 말 (네 동물 이름은 모두 받침이 없어 "와/가")
export function bondMessage(kind: PetKind, hearts: number) {
  const name = PET_NAMES[kind];
  return hearts >= MAX_HEARTS ? `${name}가 마음을 활짝 열었다!\n${heartBar(hearts)}` : `${name}와 조금 더 가까워졌다\n${heartBar(hearts)}`;
}

// 쓰다듬기. 마음이 한 칸 오르면 새 하트 수를 돌려준다(아니면 undefined).
export function petPet(state: GameState, kind: PetKind, now: number) {
  if (heartsOf(state, kind) >= MAX_HEARTS) return undefined;
  if (now - (lastPet[kind] ?? -Infinity) < COOLDOWN_MS) return undefined;
  lastPet[kind] = now;
  const before = heartsOf(state, kind);
  state.bond[kind] = (state.bond[kind] ?? 0) + 1;
  const after = heartsOf(state, kind);
  return after > before ? after : undefined;
}
