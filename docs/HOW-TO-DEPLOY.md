# 배포 방법 (GitHub Pages)

게임 주소: https://obermine1-ops.github.io/lost-world-fragments/
저장소: https://github.com/obermine1-ops/lost-world-fragments

## 평소에 배포하기 (코드를 고친 뒤)

`main` 브랜치에 코드를 올리면 **자동으로 배포된다.** 따로 할 일은 없다.

1. 변경 내용을 저장(커밋)하고 GitHub에 올린다(푸시). 보통 Claude에게 "배포해줘"라고 하면 된다.
   ```
   git add -A
   git commit -m "변경 내용 설명"
   git push
   ```
2. 저장소의 **Actions** 탭에서 "Deploy to GitHub Pages" 작업이 초록색 체크가 될 때까지 기다린다(보통 1~2분).
3. 폰에서 게임 주소를 연다. 예전 화면이 보이면 새로고침한다.

## 배포가 실패했을 때
- **Actions** 탭에서 빨간 X가 뜬 작업을 눌러 어느 단계에서 실패했는지 본다.
  - `npm run build` 단계 실패: 코드 오류. 내 PC에서 `npm run build`로 같은 오류가 나는지 확인한다.
  - `deploy` 단계 실패: 아래 "처음 한 번 설정"의 Pages 설정을 다시 확인한다.
- 실패한 작업은 오른쪽 위 **Re-run jobs**로 다시 실행할 수 있다.

## 처음 한 번 설정 (이미 완료)
1. GitHub 계정 만들기
2. 저장소 만들기: 이름 `lost-world-fragments`, **Public**, README·.gitignore·라이선스는 추가하지 않음
3. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정
4. 내 PC 프로젝트를 저장소에 연결하고 첫 푸시
   ```
   git remote add origin https://github.com/obermine1-ops/lost-world-fragments.git
   git push -u origin main
   ```
   처음 푸시할 때 브라우저 로그인 창이 뜨면 GitHub에 로그인한다.

## 참고
- 자동 배포 설정 파일: `.github/workflows/deploy.yml`
- 빌드 결과물은 `dist/` 폴더에 만들어지며, 저장소에는 올리지 않는다(자동 배포가 매번 새로 만든다).
