# 잃어버린 세계의 조각

색과 기억이 사라진 흑백 세상을 탐험하며 기억의 조각을 모아 세상을 복원하는 모바일 웹 힐링 수집 게임.

- 기획: [docs/PRD.md](docs/PRD.md)
- 스프린트 계획: [docs/SPRINTS.md](docs/SPRINTS.md)
- 진행 상태: [docs/PROGRESS.md](docs/PROGRESS.md)

## 기술 스택
Phaser 3 · TypeScript · Vite · GitHub Pages

## 내 PC에서 실행하기

처음 한 번만 필요한 준비:
1. [Node.js](https://nodejs.org) LTS 버전 설치 (이미 설치됨)
2. 이 폴더에서 터미널을 열고 패키지 설치:
   ```
   npm install
   ```

실행:
```
npm run dev
```
터미널에 나온 주소(`http://localhost:5173`)를 브라우저로 열면 게임이 보인다.
코드를 고치고 저장하면 브라우저가 자동으로 새로 고쳐진다. 끌 때는 터미널에서 `Ctrl + C`.

> PowerShell에서 `npm` 실행이 막히면 `npm.cmd run dev`로 입력한다.

## 배포용 빌드
```
npm run build
```
`dist/` 폴더에 결과물이 만들어진다. 배포 방법은 S-1.2에서 `docs/HOW-TO-DEPLOY.md`로 정리한다.

## 폴더 구조
```
index.html          게임이 담기는 웹 페이지
src/main.ts         게임 설정 (세로 360×640, 화면 맞춤)
src/scenes/         게임 장면들
docs/               기획·계획 문서
```
