// 자동 플레이 봇을 화면 없는 Edge(headless)에서 돌린다. 미리보기 창이 가려져도 테스트가 멈추지 않게.
// 개발 서버(npm run dev, 5173)가 켜져 있어야 한다. 실행: node tools/autoplay-headless.mjs [배속=3]
// 결과(완주 여부·걸린 시간·지역별 시간·마지막 기록)를 출력하고, 실패하면 종료 코드 1.
import { chromium } from 'playwright-core';

const speed = Number(process.argv[2] ?? 3);
const url = process.env.GAME_URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(url);
await page.waitForFunction(() => window.autoplay && window.game?.scene?.isActive('Title'), null, { timeout: 30000 });

const started = Date.now();
const timer = setInterval(async () => {
  const map = await page.evaluate(() => window.progress?.state?.map).catch(() => '?');
  console.log(`  … ${Math.round((Date.now() - started) / 1000)}초, 지금 ${map}`);
}, 30000);
const result = await page.evaluate((s) => window.autoplay.run({ speed: s }), speed);
clearInterval(timer);
await browser.close();

console.log(result.ok ? '✅ 최종 엔딩 + 무지개 동굴까지 완주' : '❌ 실패');
console.log(`실제 ${result.realSeconds}초, 봇 환산 ${result.estimatedBotSeconds}초, 화면 멈춤 ${result.stalledSeconds}초`);
console.log(result.perRegion.join(' · '));
console.log(result.log.slice(-4).join('\n'));
if (errors.length) console.log('페이지 오류:\n' + errors.join('\n'));
process.exit(result.ok && errors.length === 0 ? 0 : 1);
