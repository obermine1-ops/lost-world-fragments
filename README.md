# 잃어버린 세계의 조각

색과 기억이 사라진 흑백 세상을, 동물 친구들과 함께 계절을 따라 걸으며 되찾아 가는 모바일 웹 힐링 게임.

**▶ 플레이: https://obermine1-ops.github.io/lost-world-fragments/**
(폰 브라우저로 열고, 공유 버튼 → "홈 화면에 추가"로 설치하면 앱처럼 열리고 기록도 안전하다)

## 게임 소개
- **네 계절, 13개 지역** — 봄 들판에서 시작해 여름 바다, 가을 숲, 겨울 언덕까지. 지역마다 보석과 기억의 조각을 찾아 제단 퍼즐을 풀면 그곳에 색과 소리가 돌아온다.
- **동물 친구 넷** — 너구리(땅 파기) · 개구리(연잎 다리) · 앵무새(높은 곳) · 햄스터(좁은 굴). 쓰다듬어 마음을 채우면 친구의 이야기를 들려준다.
- **엔딩 뒤** — 무지개 동굴, 낚시(물고기 8종), 숨은 반딧불 39마리, 희귀 아이템 15개, 나의 집 꾸미기.
- **조작** — 가고 싶은 곳을 탭. 막히면 화면 위 목표 문구를 누르면 발자국으로 길을 알려 준다.
- 플레이 시간: 엔딩까지 약 1시간 반, 다 모으면 2시간 남짓.

## 만든 과정
- 기획: [docs/PRD.md](docs/PRD.md)(v1) → PRD-v2~v19
- 스프린트·결정 기록: [docs/SPRINTS.md](docs/SPRINTS.md), [docs/PROGRESS.md](docs/PROGRESS.md), docs/sprint-*/
- 테스트 기록: [docs/TEST-REPORT.md](docs/TEST-REPORT.md)
- 그림·음악·효과음: [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) (Pixel-boy & AAA, CC0)

## 내 PC에서 실행하기
처음 한 번: [Node.js](https://nodejs.org) LTS 설치 후 이 폴더에서 `npm install`.

```
npm run dev
```
`http://localhost:5173`을 브라우저로 연다. 끌 때는 터미널에서 `Ctrl + C`.
(PowerShell에서 `npm`이 막히면 `npm.cmd run dev`)

## 확인·배포
| 명령 | 하는 일 |
|---|---|
| `npm run check-maps` | 모든 지도에서 필요한 물건·길목에 실제로 걸어서 닿는지 검사 |
| `npm run test:features` | 낚시·지도·집·백업 코드 등 기능 13가지 점검 (약 20초, 개발 서버 필요) |
| `npm run test:play` | 자동 플레이 봇이 새 게임 → 최종 엔딩 → 무지개 동굴까지 완주 (약 6분, 개발 서버 필요) |
| `npm run build` | 배포용 빌드 (`dist/`) |
| `npm run maps` | 지도 다시 만들기 (`tools/build-maps.mjs`) |

`main`에 올리면 GitHub Actions가 지도 검사 → 빌드 → GitHub Pages 배포를 자동으로 한다. 자세한 건 [docs/HOW-TO-DEPLOY.md](docs/HOW-TO-DEPLOY.md).
테스트 브라우저는 화면 없는 Edge(음소거)라 창이 가려져도 돌아간다.

## 폴더 구조
```
src/main.ts              게임 설정 (세로 360×640, 화면 맞춤)
src/scenes/              장면: 타이틀·탐험·퍼즐·기억·도감·지도·집·낚시·엔딩·크레딧
src/scenes/game/         탐험 화면 도우미 (길 안내·계절의 공기·정해진 글)
src/regions.ts           지역·계절·기억 이야기
src/state.ts, save.ts    진행 상태와 저장(기기 안, 백업 코드)
src/sound.ts             음악·환경 소리·효과음 (필요할 때만 불러옴)
public/maps/             지도 (tools/build-maps.mjs가 만듦)
public/assets/           그림·소리
tools/                   지도 생성·검사, 음악 변환, 자동 테스트
docs/                    기획·스프린트·테스트 기록
```
