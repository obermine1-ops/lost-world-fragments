// 너구리가 땅을 파서 찾아내는 희귀 아이템. 도감에 모인다. (그림: public/assets/items/<id>.png)
export interface RareItem {
  id: string;
  name: string;
  desc: string;
  season: 'spring' | 'summer';
}

export const RARE_ITEMS: RareItem[] = [
  { id: 'pan-flute', name: '작은 대나무 피리', desc: '할머니가 저녁마다 불어 주던 피리. 바람 소리가 난다.', season: 'spring' },
  { id: 'letter', name: '빛바랜 편지', desc: '"내일도 숲 입구에서 만나!" 삐뚤빼뚤한 글씨.', season: 'spring' },
  { id: 'hourglass', name: '멈춘 모래시계', desc: '모래가 흐르지 않는다. 시간이 멈춘 것처럼.', season: 'spring' },
  { id: 'picture-book', name: '그림책', desc: '엄마가 읽어 주던 봄 이야기. 마지막 장이 비어 있다.', season: 'spring' },
  { id: 'flower-seed', name: '꽃씨 주머니', desc: '언덕에 뿌리면 내년에도 꽃이 필 것 같다.', season: 'spring' },
  { id: 'silver-key', name: '은빛 열쇠', desc: '유적 깊은 곳의 문을 여는 열쇠. 손에 쥐면 따뜻하다.', season: 'spring' },
  { id: 'old-coin', name: '파도에 닳은 동전', desc: '어느 먼 나라에서 떠밀려 왔을까. 바다 냄새가 난다.', season: 'summer' },
];

// 받침에 맞는 조사 고르기: withJosa('피리', '을', '를') → '피리를'
export function withJosa(word: string, withBatchim: string, without: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasBatchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasBatchim ? withBatchim : without);
}

export function itemOf(id: string) {
  return RARE_ITEMS.find((i) => i.id === id);
}
