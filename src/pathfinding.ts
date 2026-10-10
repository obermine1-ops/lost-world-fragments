// 지도 칸(16px) 단위 길 찾기. 막힌 칸을 피해 가장 짧은 길을 찾고, 직선으로 갈 수 있는 구간은 펴서
// 캐릭터가 칸마다 꺾이지 않고 자연스럽게 걷게 한다.

export interface Point {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

export class NavGrid {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
    private readonly blocked: boolean[],
  ) {}

  // 시든 나무처럼 나중에 사라지는 장애물용
  setBlocked(tx: number, ty: number, blocked: boolean) {
    if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) this.blocked[ty * this.width + tx] = blocked;
  }

  walkable(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height && !this.blocked[ty * this.width + tx];
  }

  tileOf(p: Point): Point {
    return { x: Math.floor(p.x / this.tileSize), y: Math.floor(p.y / this.tileSize) };
  }

  center(t: Point): Point {
    return { x: (t.x + 0.5) * this.tileSize, y: (t.y + 0.5) * this.tileSize };
  }

  // 대각선은 양옆 두 칸이 모두 열려 있을 때만 (모서리를 깎아 지나가지 않게)
  private canStep(x: number, y: number, dx: number, dy: number) {
    if (!this.walkable(x + dx, y + dy)) return false;
    if (dx !== 0 && dy !== 0) return this.walkable(x + dx, y) && this.walkable(x, y + dy);
    return true;
  }

  // 출발 칸에서 갈 수 있는 칸 중 목표에 가장 가까운 칸 (목표가 물 한가운데처럼 갈 수 없는 곳일 때)
  nearestReachable(start: Point, goal: Point): Point {
    const seen = new Uint8Array(this.width * this.height);
    const queue: Point[] = [start];
    seen[start.y * this.width + start.x] = 1;
    let best = start;
    let bestDist = Infinity;
    while (queue.length) {
      const cur = queue.shift()!;
      const d = (cur.x - goal.x) ** 2 + (cur.y - goal.y) ** 2;
      if (d < bestDist) {
        best = cur;
        bestDist = d;
        if (d === 0) break;
      }
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!this.canStep(cur.x, cur.y, dx, dy) || seen[ny * this.width + nx]) continue;
        seen[ny * this.width + nx] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return best;
  }

  // A* 탐색. 길이 없으면 빈 배열.
  findTiles(start: Point, goal: Point): Point[] {
    const W = this.width;
    const key = (x: number, y: number) => y * W + x;
    const g = new Float32Array(W * this.height).fill(Infinity);
    const parent = new Int32Array(W * this.height).fill(-1);
    const closed = new Uint8Array(W * this.height);
    const h = (x: number, y: number) => {
      const dx = Math.abs(x - goal.x);
      const dy = Math.abs(y - goal.y);
      return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
    };
    const open: { k: number; f: number }[] = [{ k: key(start.x, start.y), f: h(start.x, start.y) }];
    g[key(start.x, start.y)] = 0;
    const goalKey = key(goal.x, goal.y);

    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const { k } = open.splice(bi, 1)[0];
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === goalKey) break;
      const x = k % W;
      const y = (k - x) / W;
      for (const [dx, dy] of NEIGHBORS) {
        if (!this.canStep(x, y, dx, dy)) continue;
        const nk = key(x + dx, y + dy);
        if (closed[nk]) continue;
        const cost = g[k] + (dx !== 0 && dy !== 0 ? SQRT2 : 1);
        if (cost < g[nk]) {
          g[nk] = cost;
          parent[nk] = k;
          open.push({ k: nk, f: cost + h(x + dx, y + dy) });
        }
      }
    }

    if (!closed[goalKey]) return [];
    const path: Point[] = [];
    for (let k = goalKey; k !== -1; k = parent[k]) path.push({ x: k % W, y: Math.floor(k / W) });
    return path.reverse();
  }

  // 발밑 상자(halfW × halfH)가 from→to 직선으로 막힘 없이 지나갈 수 있는지
  clearLine(from: Point, to: Point, halfW: number, halfH: number) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(len / 2));
    for (let i = 0; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      for (const [cx, cy] of [[-halfW, -halfH], [halfW, -halfH], [-halfW, halfH], [halfW, halfH]]) {
        const t = this.tileOf({ x: x + cx, y: y + cy });
        if (!this.walkable(t.x, t.y)) return false;
      }
    }
    return true;
  }

  // from(픽셀)에서 goal(픽셀)까지 따라 걸을 지점 목록. 갈 수 없는 곳이면 가장 가까운 곳까지.
  findPath(from: Point, goal: Point, halfW: number, halfH: number): Point[] {
    const startTile = this.tileOf(from);
    const goalTile = this.tileOf(goal);
    let end = goal;
    if (this.walkable(goalTile.x, goalTile.y) && this.clearLine(from, end, halfW, halfH)) return [end];

    let tiles = this.walkable(goalTile.x, goalTile.y) ? this.findTiles(startTile, goalTile) : [];
    if (tiles.length === 0) {
      const reachable = this.nearestReachable(startTile, goalTile);
      end = this.center(reachable);
      if (this.clearLine(from, end, halfW, halfH)) return [end];
      tiles = this.findTiles(startTile, reachable);
    }
    if (tiles.length === 0) return [];
    const points = tiles.slice(1, -1).map((t) => this.center(t));
    points.push(end);

    // 직선으로 갈 수 있는 중간 지점은 건너뛴다.
    const smoothed: Point[] = [];
    let anchor = from;
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !this.clearLine(anchor, points[j], halfW, halfH)) j--;
      smoothed.push(points[j]);
      anchor = points[j];
      i = j + 1;
    }
    return smoothed;
  }
}
