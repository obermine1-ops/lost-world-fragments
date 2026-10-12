import type { GameState } from './state';
import type { PetKind } from './pet';

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
