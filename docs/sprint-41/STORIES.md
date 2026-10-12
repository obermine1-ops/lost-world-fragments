# Sprint 41 — 탐험 화면 코드 정리 (v22)
- 상태: **완료** (2026-10-13, 자동 진행 모드) — 게임 동작은 바뀌지 않음

## 한 일
- `src/scenes/game/` 새 폴더:
  - `common.ts` — prop · hasPet · center (지도 물체 도우미)
  - `guide.ts` — 길 안내 목표 · 막힌 길 대신 갈 곳 · 발자국 자리 계산
  - `ambience.ts` — 계절의 공기 표와 입자 만들기, 무지개 빛
  - `texts.ts` — 동굴 빛 조각 · 새 소식 · 정해진 메시지, shardCount
- GameScene 1,597줄 → 1,457줄. 빛 조각 개수 세는 같은 코드 4곳을 shardCount 하나로.
- 기능 점검에 "길 안내 막힌 길(잊힌 유적 → 돌무더기 흙더미)" 추가 — 옮긴 코드의 핵심 동작.

## 확인
- `npm run test:features` 11/11 (발자국 32개로 정리 전과 같음), `npm run test:play` ✅ 350초.
