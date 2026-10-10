// 자동 플레이 테스트 (개발 서버에서만): 사람 대신 새 게임부터 여름 엔딩까지 실제로 걸어서 플레이한다.
// 브라우저 콘솔에서 `await autoplay.run({ speed: 3 })` → 결과 기록(log)과 걸린 시간을 돌려준다.
// - 순간이동 없이 플레이어와 같은 길 찾기·충돌로 걷는다. 못 가는 곳이 있으면 그 자리에서 멈추고 실패를 알린다.
// - speed배로 빨리 돌리고, 걸린 시간 × speed로 "실제 속도였다면" 걸렸을 시간(봇 기준)을 추정한다.
import type Phaser from 'phaser';
import { game as progress } from '../state';

type Obj = Phaser.Types.Tilemaps.TiledObject;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScene = any;

// 계절의 마지막 지역을 복원해 요약 화면까지 간 경우 (그 지역의 남은 순서는 건너뛴다)
class SeasonEnded extends Error {}

const ROUTE = ['meadow-a', 'forest-b', 'hill-c', 'ruins-d', 'beach-e', 'village-f', 'island-g', 'maple-h', 'harvest-i', 'tower-j'];
// 계절의 첫 지역 → 앞 계절 요약 화면에서 누를 버튼
const SEASON_START: Record<string, string> = { 'beach-e': '여름으로', 'maple-h': '가을로' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const prop = (o: Obj, k: string) => (o.properties as { name: string; value: string }[] | undefined)?.find((p) => p.name === k)?.value;

export function installAutoplay(game: Phaser.Game) {
  let speed = 1;
  let t0 = 0;
  const log: string[] = [];
  const marks: { label: string; at: number }[] = [];
  const note = (m: string) => {
    const line = `[${((performance.now() - t0) / 1000).toFixed(1)}s] ${m}`;
    log.push(line);
    console.log('[autoplay]', line);
  };

  const scene = (key: string): AnyScene => game.scene.getScene(key);
  const active = (key: string) => game.scene.isActive(key);
  const g = () => scene('Game');

  async function waitFor(cond: () => boolean, timeout: number, label: string) {
    const start = performance.now();
    while (!cond()) {
      if (performance.now() - start > timeout) throw new Error(`시간 초과: ${label}`);
      await sleep(40);
    }
  }

  // 빨리 감기: 장면의 시계·트윈·물리를 speed배로
  const timer = setInterval(() => {
    if (speed === 1) return;
    for (const key of ['Game', 'Puzzle', 'Memory', 'End']) {
      const s = scene(key);
      if (!s?.sys?.isActive()) continue;
      s.time.timeScale = speed;
      s.tweens.timeScale = speed;
      if (s.physics?.world) s.physics.world.timeScale = 1 / speed;
    }
    game.anims.globalTimeScale = speed;
  }, 100);
  void timer;

  async function waitGame() {
    await waitFor(() => active('Game') && !!g()?.player && !g().leaving && g().mapObjects.length > 0, 20000, '지역 시작');
    await sleep(400);
  }

  // 기억 장면(또는 도입·엔딩 글)을 끝까지 보고 닫는다.
  async function finishMemory() {
    await waitFor(() => active('Memory'), 15000, '기억 장면 열림');
    while (active('Memory')) {
      scene('Memory').input.emit('pointerup');
      await sleep(250);
    }
  }

  async function solvePuzzle() {
    await waitFor(() => active('Puzzle'), 15000, '퍼즐 열림');
    const p = scene('Puzzle');
    const pairs: Record<number, AnyScene[]> = {};
    for (const c of p.cards) (pairs[c.symbol] ??= []).push(c);
    // 사람처럼 한 번 틀려 보고(다시 뒤집히는지 확인), 나머지는 맞춘다.
    const groups = Object.values(pairs);
    if (groups.length > 1) {
      p.onCardTap(groups[0][0]);
      p.onCardTap(groups[1][0]);
      await waitFor(() => !p.busy, 10000, '틀린 카드 다시 뒤집힘');
      await sleep(200);
    }
    for (const [a, b] of groups) {
      await waitFor(() => !p.busy, 10000, '퍼즐 대기');
      p.onCardTap(a);
      p.onCardTap(b);
      await sleep(120);
    }
    note(`퍼즐 ${p.cards.length}장 완료`);
  }

  // 목표 지점까지 걷는다. 도착하거나(장면이 바뀌거나) 막히면 끝.
  async function walkTo(x: number, y: number, label: string, reach = 14, mustArrive = true) {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!active('Game')) return;
      g().moveTo(x, y);
      await waitFor(() => !active('Game') || g().leaving || (g().path.length === 0 && !g().busy), 90000, `걷기: ${label}`);
      await sleep(120);
      // 지나가다 제단에 닿아 퍼즐이 열리면(보석·조각을 이미 가진 경우) 그 자리에서 풀고 이어서 걷는다.
      if (active('Puzzle')) {
        await restoreSequence();
        continue;
      }
      if (!active('Game') || g().leaving) return;
      const b = g().player.body.center;
      if (Math.hypot(b.x - x, b.y - y) <= reach) return;
      await sleep(200);
    }
    if (mustArrive) throw new Error(`도착 못 함: ${label}`);
  }

  // 퍼즐 → 기억 장면 → 색 복원. 계절의 마지막 지역이면 엔딩 글 → 요약 화면까지 가고 SeasonEnded를 던진다.
  async function restoreSequence() {
    const map = progress.state.map;
    await solvePuzzle();
    await finishMemory();
    await waitFor(() => progress.state.restored.includes(map), 10000, '색 복원');
    note(`색 복원: ${map}`);
    await waitFor(() => (active('Game') && !g().busy) || active('Memory') || active('End'), 20000, '복원 연출');
    if (active('Memory') || active('End') || g().busy) {
      if (!active('End')) await finishMemory();
      await waitFor(() => active('End'), 15000, '요약 화면');
      note('계절 엔딩 → 요약 화면');
      throw new SeasonEnded();
    }
  }

  async function playRegion(map: string) {
    await waitGame();
    const s = progress.state;
    const objs: Obj[] = g().mapObjects;
    const of = (name: string) => objs.filter((o) => o.name === name);
    note(`▶ ${map} 도착`);
    marks.push({ label: map, at: performance.now() });

    // 1) 동물 친구
    for (const o of of('pet')) {
      const kind = prop(o, 'kind') ?? 'raccoon';
      if (kind === 'frog' ? s.frog : kind === 'parrot' ? s.parrot : s.pet) continue;
      await walkTo(o.x!, o.y!, `동물(${kind})`);
      const joined = () => (kind === 'frog' ? s.frog : kind === 'parrot' ? s.parrot : s.pet);
      await waitFor(joined, 5000, `동물 합류(${kind})`);
      note(`동물 합류: ${kind}`);
    }
    // 2) 흙더미 (길을 여는 것부터)
    const digs = of('dig')
      .filter((o) => !s.dug.includes(prop(o, 'id')!))
      .sort((a, b) => Number(prop(b, 'reward')!.startsWith('open:')) - Number(prop(a, 'reward')!.startsWith('open:')));
    for (const o of digs) {
      await walkTo(o.x!, o.y!, `흙더미(${prop(o, 'reward')})`, 22);
      await waitFor(() => s.dug.includes(prop(o, 'id')!) && !g().busy, 20000, `파기(${prop(o, 'reward')})`);
      note(`흙더미: ${prop(o, 'reward')}`);
    }
    // 2-1) 앵무새 하늘 심부름 (절벽 위 물건)
    for (const o of of('perch')) {
      if (s.dug.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x!, o.y!, `깃털 표시(${prop(o, 'reward')})`, 22);
      await waitFor(() => s.dug.includes(prop(o, 'id')!) && !g().busy, 20000, `하늘 심부름(${prop(o, 'reward')})`);
      note(`하늘 심부름: ${prop(o, 'reward')}`);
    }
    // 3) 잠긴 문
    for (const o of of('barrier').filter((b) => prop(b, 'unlock')?.startsWith('key:'))) {
      if (s.opened.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x! + o.width! / 2, o.y! + o.height! / 2, '잠긴 문', 26, false);
      await waitFor(() => s.opened.includes(prop(o, 'id')!), 5000, '문 열림');
      note('문 열림');
    }
    // 4) 숨은 반딧불 (조각을 줍기 전에 — 지나가다 제단이 먼저 열리지 않게)
    for (const o of of('firefly')) {
      if (s.fireflies.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x!, o.y!, `반딧불 ${prop(o, 'id')}`);
      await waitFor(() => s.fireflies.includes(prop(o, 'id')!), 3000, '반딧불 줍기');
    }
    // 5) 보석·조각
    for (const o of of('gem')) {
      if (s.gems.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x!, o.y!, '보석');
      await waitFor(() => s.gems.includes(prop(o, 'id')!), 3000, '보석 줍기');
    }
    for (const o of of('fragment')) {
      if (s.fragments.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x!, o.y!, '조각');
      await waitFor(() => s.fragments.includes(prop(o, 'id')!), 3000, '조각 줍기');
    }

    note('보석·조각·반딧불 모음');
    // 5) 제단 → 퍼즐 → 기억 → 색 복원
    const altar = of('altar')[0];
    if (altar && !s.restored.includes(map)) {
      await walkTo(altar.x!, altar.y! + 16, '제단', 20, false);
      if (!s.restored.includes(map)) await restoreSequence();
    }
    // 6) 연잎 다리
    for (const o of of('barrier').filter((b) => prop(b, 'look') === 'lilypad')) {
      if (s.opened.includes(prop(o, 'id')!)) continue;
      await walkTo(o.x! + o.width! / 2, o.y! - 10, '연잎 다리 물가', 20);
      await waitFor(() => s.opened.includes(prop(o, 'id')!) && !g().busy, 15000, '연잎 다리');
      note('연잎 다리 생김');
    }
    // 7) 다음 지역으로
    const next = ROUTE[ROUTE.indexOf(map) + 1];
    const exit = of('exit').find((o) => prop(o, 'to') === next);
    if (!exit) throw new Error(`${map}: ${next}로 가는 길목 없음`);
    await walkTo(exit.x! + exit.width! / 2, exit.y! + exit.height! / 2, `길목 → ${next}`, 30, false);
    await waitFor(() => s.map === next, 10000, `${next}로 이동`);
  }

  async function run(options: { speed?: number } = {}) {
    speed = options.speed ?? 3;
    t0 = performance.now();
    log.length = 0;
    marks.length = 0;
    try {
      // 새 게임 → 도입 글
      localStorage.removeItem('lost-world-fragments/save');
      game.scene.getScenes(true).forEach((s) => s.sys.settings.key !== 'Audio' && game.scene.stop(s.sys.settings.key));
      game.scene.start('Title');
      await waitFor(() => active('Title'), 5000, '타이틀');
      await sleep(300);
      scene('Title').startNew();
      await finishMemory();
      note('도입 글 끝 → 새 게임 시작');

      for (const map of ROUTE) {
        const label = SEASON_START[map];
        if (label) {
          // 앞 계절 요약 화면의 "여름으로"/"가을로" 버튼
          await waitFor(() => active('End'), 20000, '계절 요약 화면');
          await sleep(900);
          const end = scene('End');
          const button = end.children.list.find((c: AnyScene) => c.list?.some((t: AnyScene) => t.text === label));
          if (!button) throw new Error(`'${label}' 버튼 없음`);
          button.emit('pointerup');
          note(`'${label}' 누름`);
        }
        try {
          await playRegion(map);
        } catch (e) {
          if (!(e instanceof SeasonEnded)) throw e;
        }
      }
      await waitFor(() => active('End'), 20000, '마지막 요약 화면');
      note('✅ 가을 엔딩까지 완주');
      return report(true);
    } catch (e) {
      note(`❌ ${(e as Error).message}`);
      return report(false);
    } finally {
      speed = 1;
    }
  }

  function report(ok: boolean) {
    const total = (performance.now() - t0) / 1000;
    const perRegion = marks.map((m, i) => {
      const end = marks[i + 1]?.at ?? performance.now();
      return `${m.label}: ${(((end - m.at) / 1000) * speed).toFixed(0)}초`;
    });
    return { ok, realSeconds: Math.round(total), estimatedBotSeconds: Math.round(total * speed), perRegion, log: [...log] };
  }

  Object.assign(window, { autoplay: { run } });
}
