import type { Season } from './regions';

// 낚시로 잡는 물고기 (계절마다 둘). 그림: public/assets/fish/<texture>.png (Ninja Adventure, 16×16)
// 색을 되찾은 지역의 낚시터(지도의 fishing)에서, 그 지역 계절의 물고기가 잡힌다.
export interface Fish {
  id: string;
  name: string;
  season: Season;
  texture: string;
  tint?: number;
  desc: string;
}

export const FISH: Fish[] = [
  { id: 'crucian', name: '봄 붕어', season: 'spring', texture: 'fish-yellow', desc: '연못에 봄이 오면 가장 먼저 헤엄쳐 나온다.' },
  { id: 'shrimp', name: '민물 새우', season: 'spring', texture: 'fish-shrimp', desc: '톡톡 튀는 작은 새우. 할머니네 연못에 많았다.' },
  { id: 'seabream', name: '빨간 도미', season: 'summer', texture: 'fish-red', desc: '여름 바다의 자랑. 비늘이 노을처럼 빛난다.' },
  { id: 'octopus', name: '꼬마 문어', season: 'summer', texture: 'fish-octopus', desc: '바위 웅덩이에 숨어 있던 장난꾸러기.' },
  { id: 'sweetfish', name: '은빛 은어', season: 'autumn', texture: 'fish-white', desc: '맑은 가을 물에서만 산다는 은빛 물고기.' },
  { id: 'mackerel', name: '푸른 고등어', season: 'autumn', texture: 'fish-blue', desc: '가을바람처럼 날쌘 등 푸른 물고기.' },
  { id: 'smelt', name: '얼음 빙어', season: 'winter', texture: 'fish-white', tint: 0xbfe6ff, desc: '얼음 구멍 아래에서 반짝이는 투명한 물고기.' },
  { id: 'snowshrimp', name: '눈꽃 새우', season: 'winter', texture: 'fish-shrimp', tint: 0xdff2ff, desc: '눈처럼 하얀 겨울 새우.' },
];

export const FISH_TEXTURES = [...new Set(FISH.map((f) => f.texture))];

export function fishOf(id: string) {
  return FISH.find((f) => f.id === id);
}
