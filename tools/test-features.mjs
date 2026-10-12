// 기능 점검: 자동 플레이 봇이 지나가지 않는 기능들을 화면 없는 Edge(음소거)에서 빠르게 확인한다.
// 개발 서버(5173)가 켜져 있어야 한다. 실행: npm run test:features  — 하나라도 실패하면 종료 코드 1.
import { chromium } from 'playwright-core';

const ALL = ['meadow-a', 'forest-b', 'hill-c', 'ruins-d', 'beach-e', 'village-f', 'island-g', 'maple-h', 'harvest-i', 'tower-j', 'snow-k', 'lake-l', 'peak-m'];
const fullState = (extra = {}) => ({
  map: 'meadow-a', fragments: ALL, gems: ALL, restored: ALL, pet: true, frog: true, parrot: true, hamster: true,
  dug: [], items: [], opened: [], fireflies: [], house: [], wallpaper: 0, floor: 0,
  tips: ['goal', 'map', 'collection', 'fishing', 'news-2026-10'], stats: {}, fish: {}, bond: {}, ...extra,
});

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.GAME_URL ?? 'http://localhost:5173/');
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 30000 });

let failed = 0;
async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name} — ${e.message.split('\n')[0]}`);
  }
}
const run = (fn, arg) => page.evaluate(fn, arg);
const startGame = (state, spawn) =>
  run(async ([st, sp]) => {
    // 먼저 완전히 멈춘 뒤 다시 시작하고, 새 장면의 플레이어가 생길 때까지 기다린다 (이전 장면을 읽지 않게)
    window.game.scene.getScenes(true).forEach((s) => s.scene.key !== 'Audio' && s.scene.stop());
    await new Promise((r) => setTimeout(r, 150));
    window.progress.state = st;
    window.game.scene.start('Game', sp ? { spawn: sp } : undefined);
    for (let i = 0; i < 50 && !(window.game.scene.isActive('Game') && window.game.scene.getScene('Game').player?.body); i++)
      await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 400));
  }, [state, spawn]);

console.log('기능 점검');

await check('세계 지도로 빠른 이동 (13개 지역 도착 칸이 막히지 않음)', async () => {
  const bad = [];
  for (const map of ALL) {
    await startGame(fullState({ map }), 'travel');
    const ok = await run(() => {
      const gs = window.game.scene.getScene('Game');
      const b = gs.player.body.center;
      return !gs.collideLayer.getTileAtWorldXY(b.x, b.y);
    });
    if (!ok) bad.push(map);
  }
  if (bad.length) throw new Error(`막힘: ${bad.join(', ')}`);
});

await check('길 안내 (목표 문구 누르면 발자국)', async () => {
  await startGame(fullState({ restored: [], gems: [], fragments: [] }));
  const n = await run(async () => {
    const gs = window.game.scene.getScene('Game');
    gs.showGuide();
    await new Promise((r) => setTimeout(r, 600));
    return gs.glow.list.filter((o) => o.type === 'Ellipse').length;
  });
  if (n < 3) throw new Error(`발자국 ${n}개`);
  return `발자국 ${n}개`;
});

await check('길 안내 막힌 길 (잊힌 유적: 돌무더기 흙더미로 돌아감)', async () => {
  await startGame(fullState({ map: 'ruins-d', restored: ['meadow-a', 'forest-b', 'hill-c'], gems: [], fragments: [] }), 'travel');
  return run(() => {
    const gs = window.game.scene.getScene('Game');
    const t = gs.guideTarget();
    const b = gs.player.body.center;
    const from = { x: b.x, y: b.y };
    const reach = (p) => {
      const w = [from, ...gs.nav.findPath(from, p, 5, 3)];
      const e = w[w.length - 1];
      return Math.hypot(e.x - p.x, e.y - p.y) <= 28;
    };
    if (reach(t)) throw new Error('보석까지 바로 갈 수 있음 (막혀 있어야 함)');
    const detour = gs.unblockers().find(reach);
    if (!detour) throw new Error('돌아갈 곳 없음');
    const mound = gs.mapObjects.find((o) => o.name === 'dig' && o.properties.some((p) => p.value === 'open:ruins-rubble'));
    if (detour.x !== mound.x || detour.y !== mound.y) throw new Error(`엉뚱한 곳 ${JSON.stringify(detour)}`);
    return '돌무더기 흙더미로 안내';
  });
});

await check('안내 메시지 차례대로 (겹치지 않음)', async () => {
  await startGame(fullState(), 'from-house');
  return run(async () => {
    const gs = window.game.scene.getScene('Game');
    await new Promise((r) => setTimeout(r, 3200)); // 지역 이름 메시지가 지나가길 기다림
    const shown = () => gs.ui.list.filter((o) => o.type === 'Text' && (o.text === '첫째' || o.text === '둘째')).map((o) => o.text);
    gs.showMessage('첫째');
    gs.showMessage('둘째');
    await new Promise((r) => setTimeout(r, 200));
    const a = shown();
    if (a.join() !== '첫째') throw new Error(`처음: ${a.join()}`);
    await new Promise((r) => setTimeout(r, 2600));
    const b = shown();
    if (b.join() !== '둘째') throw new Error(`나중: ${b.join()}`);
    return '첫째 → 둘째';
  });
});

await check('낚시 (물가 → 낚시 화면 → 입질 때 탭 → 기록)', async () => {
  await startGame(fullState({ x: 232, y: 344 }));
  return run(async () => {
    const gs = window.game.scene.getScene('Game');
    const o = gs.mapObjects.find((x) => x.name === 'fishing');
    gs.moveTo(o.x + 16, o.y);
    for (let i = 0; i < 60 && !window.game.scene.isActive('Fishing'); i++) await new Promise((r) => setTimeout(r, 150));
    if (!window.game.scene.isActive('Fishing')) throw new Error('낚시 화면이 안 열림');
    await new Promise((r) => setTimeout(r, 400));
    const f = window.game.scene.getScene('Fishing');
    for (let i = 0; i < 80 && f.state !== 'bite'; i++) await new Promise((r) => setTimeout(r, 100));
    f.onTap();
    const caught = Object.values(window.progress.state.fish).reduce((a, b) => a + b, 0);
    if (caught !== 1) throw new Error(`잡은 수 ${caught}`);
    return Object.keys(window.progress.state.fish).join(',');
  });
});

await check('친구 마음 (쓰다듬기, 연타 방지)', async () => {
  await startGame(fullState({ bond: { raccoon: 5 } }), 'from-house');
  return run(() => {
    const gs = window.game.scene.getScene('Game');
    const raccoon = gs.pets.find((p) => p.kind === 'raccoon');
    raccoon.sprite.emit('pointerup');
    raccoon.sprite.emit('pointerup');
    const v = window.progress.state.bond.raccoon;
    if (v !== 6) throw new Error(`점수 ${v} (6이어야 함)`);
    return '5 → 6, 두 번째는 무시';
  });
});

await check('나의 집 (친구들이 돌아다님, 상자 쪽 넘기기)', async () => {
  const items = ['pan-flute', 'letter', 'hourglass', 'picture-book', 'flower-seed', 'silver-key', 'old-coin', 'gourd', 'wooden-fish', 'tea-leaf', 'honey', 'maple-letter', 'stamp', 'snow-card', 'star-cup'];
  return run(async (st) => {
    window.game.scene.getScenes(true).forEach((s) => s.scene.key !== 'Audio' && s.scene.stop());
    window.progress.state = st;
    window.game.scene.start('House');
    await new Promise((r) => setTimeout(r, 900));
    const h = window.game.scene.getScene('House');
    const pets = h.housePets.length;
    const page = h.tray.list.filter((o) => o.type === 'Text').map((o) => o.text).join(' ');
    if (pets !== 4) throw new Error(`친구 ${pets}마리`);
    if (!page.includes('1/2')) throw new Error(`쪽 표시 없음: ${page}`);
    return `친구 ${pets}마리, ${page}`;
  }, fullState({ items }));
});

await check('백업 코드 (내보내기 → 불러오기 같음, 망가진 코드 거부)', async () =>
  run(async (st) => {
    const m = await import('/src/save.ts');
    m.saveGame(st);
    const code = m.exportCode();
    const back = m.importCode(code);
    if (JSON.stringify(back) !== JSON.stringify(m.loadGame())) throw new Error('왕복 결과가 다름');
    if (m.importCode('LWF1:abc') !== undefined) throw new Error('망가진 코드를 받아들임');
    return `코드 ${code.length}자`;
  }, fullState({ fish: { crucian: 2 }, bond: { frog: 9 } })),
);

await check('도감 탭 (봄·여름·가을·겨울·물고기·기록)', async () =>
  run(async (st) => {
    window.progress.state = st;
    for (const season of ['spring', 'summer', 'autumn', 'winter', 'fish', 'stats']) {
      window.game.scene.getScenes(true).forEach((s) => s.scene.key !== 'Audio' && s.scene.stop());
      await new Promise((r) => setTimeout(r, 150));
      window.game.scene.start('Collection', { season, onClose() {} });
      await new Promise((r) => setTimeout(r, 300));
      if (!window.game.scene.isActive('Collection')) throw new Error(`${season} 탭이 안 열림`);
    }
    return '6개 탭';
  }, fullState()),
);

await check('계절 퍼즐 (봄·여름·가을·겨울 그림 6가지씩)', async () =>
  run(async () => {
    const sc = window.game.scene.getScene('Puzzle');
    const out = [];
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      window.game.scene.getScenes(true).forEach((s) => s.scene.key !== 'Audio' && s.scene.stop());
      await new Promise((r) => setTimeout(r, 150));
      window.game.scene.start('Puzzle', { pairs: 6, season, onComplete() {} });
      await new Promise((r) => setTimeout(r, 300));
      const n = new Set(sc.cards.map((c) => c.front.list[1].frame.name)).size;
      if (n !== 6) throw new Error(`${season} 그림 ${n}가지`);
      out.push(season);
    }
    return out.join('·');
  }),
);

await check('새 소식 (돌아온 사람에게 한 번만)', async () => {
  const st = fullState();
  st.tips = st.tips.filter((t) => t !== 'news-2026-10');
  await startGame(st, 'from-house');
  const first = await run(async () => {
    await new Promise((r) => setTimeout(r, 1300));
    const gs = window.game.scene.getScene('Game');
    return gs.busy && gs.ui.list.some((o) => o.type === 'Text' && o.text === '새로 생긴 것');
  });
  if (!first) throw new Error('처음 들어왔는데 안 뜸');
  const now = await run(() => window.progress.state); // 새 소식을 본 뒤의 기록으로 다시 들어가기
  await startGame(now, 'from-house');
  const again = await run(async () => {
    await new Promise((r) => setTimeout(r, 1300));
    return window.game.scene.getScene('Game').ui.list.some((o) => o.type === 'Text' && o.text === '새로 생긴 것');
  });
  if (again) throw new Error('두 번째에도 뜸');
  return '처음만 뜸';
});

await check('환경 소리 (되찾은 곳만, 효과음만이면 꺼짐)', async () => {
  const playing = () =>
    run(async () => {
      await new Promise((r) => setTimeout(r, 2500));
      return window.game.sound.sounds.filter((s) => s.isPlaying && s.key.startsWith('amb-')).map((s) => s.key).join(',');
    });
  await startGame(fullState({ map: 'beach-e' }), 'travel');
  const restored = await playing();
  if (restored !== 'amb-wave') throw new Error(`되찾은 해변: "${restored}"`);
  await startGame(fullState({ map: 'beach-e', restored: [] }), 'travel');
  const gray = await playing();
  if (gray) throw new Error(`흑백 해변에서 "${gray}"`);
  await startGame(fullState({ map: 'snow-k' }), 'travel');
  // 화면 오른쪽 위 소리 버튼을 눌러 "효과음만"으로 (소리 켜짐 → 효과음만 → 소리 꺼짐 → 소리 켜짐)
  const pressSound = () =>
    run(() => {
      const gs = window.game.scene.getScene('Game');
      const btn = gs.ui.list.find((o) => o.type === 'Container' && /^소리|^효과음/.test(o.list?.[1]?.text ?? ''));
      btn.emit('pointerup');
      return btn.list[1].text;
    });
  const label = await pressSound();
  if (label !== '효과음만') throw new Error(`버튼이 "${label}"`);
  const sfxOnly = await playing();
  await pressSound();
  await pressSound(); // 다시 "소리 켜짐"으로
  if (sfxOnly) throw new Error(`효과음만인데 "${sfxOnly}"`);
  return '해변 파도, 흑백 조용, 효과음만 조용';
});

if (errors.length) {
  failed++;
  console.log('  ✗ 페이지 오류:\n    ' + errors.join('\n    '));
}
await browser.close();
console.log(failed ? `\n문제 ${failed}개` : '\n모든 기능 점검 통과');
process.exit(failed ? 1 : 0);
