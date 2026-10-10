// 지역(지도 한 장)마다의 내용: 보석 색, 퍼즐 크기, 되찾는 기억 이야기.
// 지도 위 배치(어디에 보석·조각·제단이 있는지)는 tools/build-maps.mjs에 있다.

export interface Memory {
  face: string; // public/assets/faces/의 얼굴 그림
  name: string;
  lines: string[];
}

export type Season = 'spring' | 'summer' | 'autumn';

export interface Region {
  key: string;
  season: Season;
  gem: 'yellow' | 'green' | 'purple' | 'red'; // 보석 그림
  gemTint?: number; // 여름 보석은 같은 그림을 다른 색으로 물들여 쓴다
  gemName: string;
  gemColor: number;
  pairs: number;
  memory: Memory;
}

export const REGIONS: Region[] = [
  {
    key: 'meadow-a',
    season: 'spring',
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
    season: 'spring',
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
    season: 'spring',
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
  {
    key: 'ruins-d',
    season: 'spring',
    gem: 'red',
    gemName: '붉은빛',
    gemColor: 0xff7a6b,
    pairs: 5,
    memory: {
      face: 'hero',
      name: '어린 날의 나',
      lines: [
        '그해 봄, 소중한 사람들이 하나둘 먼 곳으로 떠났다.',
        '너무 슬퍼서, 나는 모든 색을 마음 깊이 묻어 버렸다.',
        '"잊으면 아프지 않을 거야."',
        '…아니야. 기억하고 있었기에 봄은 이렇게 따뜻했던 거야.',
      ],
    },
  },
  {
    key: 'beach-e',
    season: 'summer',
    gem: 'purple',
    gemTint: 0x8fd8ff,
    gemName: '하늘빛',
    gemColor: 0x8fd8ff,
    pairs: 3,
    memory: {
      face: 'oldman',
      name: '어부 할아버지',
      lines: [
        '여름이면 할아버지는 새벽 바다로 배를 띄웠다.',
        '"바다는 무서운 게 아니란다. 같이 노래하면 돼."',
        '그물 가득 반짝이던 은빛 물고기들.',
      ],
    },
  },
  {
    key: 'village-f',
    season: 'summer',
    gem: 'red',
    gemTint: 0xffb3c7,
    gemName: '산호빛',
    gemColor: 0xff9fb8,
    pairs: 4,
    memory: {
      face: 'villager2',
      name: '마을 아이들',
      lines: [
        '해가 지면 마을 아이들이 평상에 모였다.',
        '수박 한 통을 나눠 먹으며 별을 셌다.',
        '"내일도, 모레도 여름이었으면 좋겠다."',
      ],
    },
  },
  {
    key: 'island-g',
    season: 'summer',
    gem: 'green',
    gemTint: 0x7fffe0,
    gemName: '바다빛',
    gemColor: 0x5fe8d0,
    pairs: 6,
    memory: {
      face: 'hero',
      name: '처음 바다를 본 날의 나',
      lines: [
        '처음 바다를 본 날, 나는 바다의 끝이 어디냐고 물었다.',
        '"끝은 없단다. 그래서 언제든 다시 올 수 있지."',
        '잊고 있던 그 말이 파도처럼 다시 밀려왔다.',
      ],
    },
  },
  {
    key: 'maple-h',
    season: 'autumn',
    gem: 'yellow',
    gemTint: 0xffa64d,
    gemName: '단풍빛',
    gemColor: 0xff9a3c,
    pairs: 3,
    memory: {
      face: 'oldman2',
      name: '할아버지',
      lines: [
        '마당 가득 떨어진 낙엽을 할아버지와 함께 쓸었다.',
        '모아 둔 낙엽 속에서 고구마가 노릇하게 익어 갔다.',
        '"떨어지는 잎도 다 내년 봄을 위한 거란다."',
      ],
    },
  },
  {
    key: 'harvest-i',
    season: 'autumn',
    gem: 'green',
    gemTint: 0xd8e86b,
    gemName: '황금빛',
    gemColor: 0xe8d84a,
    pairs: 5,
    memory: {
      face: 'villager3',
      name: '이웃 아저씨',
      lines: [
        '추수하는 날이면 온 마을이 들판에 모였다.',
        '나는 이웃 아저씨의 볏단 옆에서 메뚜기를 쫓아다녔다.',
        '"올해도 고맙다, 땅아." 아저씨가 웃으며 말했다.',
      ],
    },
  },
  {
    key: 'tower-j',
    season: 'autumn',
    gem: 'red',
    gemTint: 0xff8a5c,
    gemName: '노을빛',
    gemColor: 0xff7a4a,
    pairs: 6,
    memory: {
      face: 'hero',
      name: '연을 날리던 날의 나',
      lines: [
        '바람의 언덕에서 처음으로 연을 높이 띄웠다.',
        '실이 끊어져 연은 노을 속으로 멀리 날아갔다.',
        '울지 않았다. 그 연이 어딘가에 닿았을 것 같아서.',
      ],
    },
  },
];

// entry: 이 계절로 가는 길 안내 (앞 계절을 다 되찾은 뒤의 목표 문구)
export const SEASONS: { key: Season; name: string; entry: string; ending: string[] }[] = [
  {
    key: 'spring',
    name: '봄',
    entry: '',
    ending: [
      '들판과 숲과 언덕, 그리고 잊힌 유적에 봄이 돌아왔다.',
      '흩어졌던 기억들이 하나의 따뜻한 빛이 되었다.',
      '세상에는 아직 여름과 가을과 겨울이 잠들어 있다.',
      '너구리와 함께라면, 다시 찾으러 갈 수 있을 것 같다.',
    ],
  },
  {
    key: 'summer',
    name: '여름',
    entry: '목표: 봄 들판 남쪽 길을 따라 바닷가로',
    ending: [
      '해변과 마을과 섬에 여름이 돌아왔다.',
      '파도 소리에 그리운 웃음소리가 섞여 들린다.',
      '아직 가을과 겨울이 잠들어 있지만,',
      '이제 나는 기억하는 법을 안다.',
    ],
  },
  {
    key: 'autumn',
    name: '가을',
    entry: '목표: 바닷가 마을 터 북쪽 길을 따라 단풍 숲으로',
    ending: [
      '숲과 들판과 언덕에 가을이 돌아왔다.',
      '바람이 낙엽을 굴리며 오래된 노래를 부른다.',
      '이제 남은 건 하얗게 잠든 겨울뿐.',
      '친구들과 함께라면, 마지막 계절도 되찾을 수 있다.',
    ],
  },
];

// 지역마다 숨은 반딧불 수 (지도: tools/build-maps.mjs의 fireflies)
export const FIREFLIES_PER_REGION = 3;

export function firefliesOf(season: Season) {
  return regionsOf(season).length * FIREFLIES_PER_REGION;
}

export function regionsOf(season: Season) {
  return REGIONS.filter((r) => r.season === season);
}

export function seasonOf(season: Season) {
  return SEASONS.find((s) => s.key === season)!;
}

// 새 게임을 시작할 때 나오는 글
export const INTRO_LINES = [
  '어느 날, 세상에서 색이 사라졌다.',
  '꽃도, 하늘도, 사람들의 얼굴도 회색이 되었다.',
  '그리고 나는… 무언가 소중한 것을 잊어버렸다.',
  '흩어진 기억의 조각을 찾으면, 다시 떠올릴 수 있을까?',
];


export function regionOf(key: string) {
  return REGIONS.find((r) => r.key === key);
}
