// 지역(지도 한 장)마다의 내용: 보석 색, 퍼즐 크기, 되찾는 기억 이야기.
// 지도 위 배치(어디에 보석·조각·제단이 있는지)는 tools/build-maps.mjs에 있다.

export interface Memory {
  face: string; // public/assets/faces/의 얼굴 그림
  name: string;
  lines: string[];
}

export interface Region {
  key: string;
  gem: 'yellow' | 'green' | 'purple' | 'red';
  gemName: string;
  gemColor: number;
  pairs: number;
  memory: Memory;
}

export const REGIONS: Region[] = [
  {
    key: 'meadow-a',
    gem: 'yellow',
    gemName: '노란빛',
    gemColor: 0xffd54a,
    pairs: 2,
    memory: {
      face: 'oldwoman',
      name: '할머니',
      lines: [
        '봄바람이 불던 날, 할머니가 들꽃으로 화관을 엮어 주셨다.',
        '"색은 마음에 담아 두는 거란다."',
        '"잊지 않으면, 절대 사라지지 않아."',
      ],
    },
  },
  {
    key: 'forest-b',
    gem: 'green',
    gemName: '초록빛',
    gemColor: 0x6be37a,
    pairs: 3,
    memory: {
      face: 'child',
      name: '옆집 친구',
      lines: [
        '어릴 적, 이 숲에서 길을 잃은 적이 있었다.',
        '훌쩍이던 나를 찾아낸 건 옆집 친구였다.',
        '"같이 가면 하나도 안 무서워."',
      ],
    },
  },
  {
    key: 'hill-c',
    gem: 'purple',
    gemName: '보랏빛',
    gemColor: 0xc58bff,
    pairs: 4,
    memory: {
      face: 'woman',
      name: '엄마',
      lines: [
        '꽃 언덕 위, 벚꽃 그늘 아래 돗자리를 폈다.',
        '엄마가 싸 온 도시락에서 봄 냄새가 났다.',
        '"내년에도, 그다음 해에도 같이 오자."',
      ],
    },
  },
];

export const ENDING_LINES = [
  '들판과 숲과 언덕에 봄이 돌아왔다.',
  '바람 속에서 그리운 목소리들이 들리는 것 같다.',
  '하지만 세상에는 아직, 잃어버린 기억이 남아 있다…',
];

export function regionOf(key: string) {
  return REGIONS.find((r) => r.key === key);
}
