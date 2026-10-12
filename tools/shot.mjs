// 화면 없는 Edge에서 게임을 열고, 준비 코드를 실행한 뒤 화면을 캡처한다. (미리보기 창이 가려져도 화면 확인용)
// 실행: node tools/shot.mjs <저장할 png> "<페이지에서 실행할 코드>" [기다릴 ms=1000]
import { chromium } from 'playwright-core';

const [out, code = '', wait = '1000'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] }); // 테스트 소리가 스피커로 나오지 않게
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.GAME_URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 30000 });
if (code) await page.evaluate(`(async () => { ${code} })()`);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
if (errors.length) console.log('페이지 오류:\n' + errors.join('\n'));
console.log(out);
