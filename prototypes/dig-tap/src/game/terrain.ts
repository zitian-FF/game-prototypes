import { mulberry32 } from 'dig-kit';
import { tune } from '../tune';

export type BlockKind = 'dirt' | 'rock' | 'tnt' | 'crystal';

export interface Block {
  id: number;
  col: number;
  /** Row in the original wall. Fixes the strata, health and what is buried. */
  orig: number;
  kind: BlockKind;
  hp: number;
  maxHp: number;
  strata: number;
  /** Gem value buried under this block (before upgrades), 0 for none. */
  gem: number;
  broken: boolean;
  /** Current row on the board. Blocks fall, so this changes. */
  drow: number;
}

export type HitKind = 'tap' | 'splash' | 'blast' | 'link';

export interface Hit {
  block: Block;
  dmg: number;
  kind: HitKind;
  /** Where the damage came from, for effects. */
  from?: { col: number; drow: number };
}

export interface Wave {
  hits: Hit[];
  broke: Block[];
}

export interface TapResult {
  waves: Wave[];
  /** Broken blocks with the wave they broke in (1 = the tap itself). */
  broken: { block: Block; wave: number }[];
  /** Blocks whose row changed because something below them broke. */
  fell: Block[];
}

export const STRATA_COUNT = 7;

export interface TerrainSave {
  seed: number;
  blocksDug: number;
  /** Per column, the original rows that have been removed. */
  removed: number[][];
  /** Damaged blocks as [col, orig, hp]. */
  damaged: [number, number, number][];
}

/** Splash pattern by upgrade level: which cells around the tapped block take splash damage. */
export function splashOffsets(level: number): [number, number][] {
  const out: [number, number][] = [];
  const reach = level >= 3 ? 2 : 1;
  for (let dc = -reach; dc <= reach; dc++) {
    for (let dr = -reach; dr <= reach; dr++) {
      if (dc === 0 && dr === 0) continue;
      const man = Math.abs(dc) + Math.abs(dr);
      const ok = level <= 0 ? man === 1 : level === 1 ? true : level === 2 ? man <= 2 : true;
      if (ok) out.push([dc, dr]);
    }
  }
  return out;
}

/**
 * The wall being dug: columns of blocks that fall to fill gaps. Block (orig
 * row r, column c) is always generated the same way from the seed, so a save
 * only has to remember what was removed and what is damaged.
 */
export class Terrain {
  /** Remaining blocks per column, top to bottom. A block's row is removedCount + its index. */
  readonly cols: Block[][];
  readonly removed: number[][];
  blocksDug = 0;
  private nextId = 1;
  private kindMemo = new Map<number, BlockKind>();

  constructor(readonly seed: number) {
    this.cols = Array.from({ length: tune.terrain.cols }, () => []);
    this.removed = Array.from({ length: tune.terrain.cols }, () => []);
  }

  private rng(orig: number, col: number, salt: number): number {
    return mulberry32((this.seed + Math.imul(orig + 1, 9973) + Math.imul(col + 1, 7919) + Math.imul(salt, 104729)) >>> 0)();
  }

  private kindAt(orig: number, col: number): BlockKind {
    const key = orig * 64 + col;
    const memo = this.kindMemo.get(key);
    if (memo) return memo;
    const t = tune.terrain;
    let kind: BlockKind = 'dirt';
    const r = this.rng(orig, col, 1);
    if (orig >= t.rockStartRow && r < t.rockChance) kind = 'rock';
    else if (orig >= t.tntStartRow && r < t.rockChance + t.tntChance) kind = 'tnt';
    else if (r < t.rockChance + t.tntChance + t.crystalChance) kind = 'crystal';
    else if (orig > 0 && this.kindAt(orig - 1, col) === 'crystal' && this.rng(orig, col, 2) < t.crystalContinue) kind = 'crystal';
    // Rocks cannot be tapped, so never stack two: every rock always has a tappable neighbour in its column.
    if (kind === 'rock' && orig > 0 && this.kindAt(orig - 1, col) === 'rock') kind = 'dirt';
    this.kindMemo.set(key, kind);
    return kind;
  }

  strataOf(orig: number): number {
    return Math.floor(orig / tune.terrain.bandRows) % STRATA_COUNT;
  }

  private generate(orig: number, col: number): Block {
    const t = tune.terrain;
    const kind = this.kindAt(orig, col);
    const base = t.hpBase + orig * t.hpPerRow;
    const mult = kind === 'rock' ? t.rockHpMult : kind === 'tnt' ? t.tntHpMult : kind === 'crystal' ? t.crystalHpMult : 1;
    const hp = Math.max(2, Math.round(base * mult));
    const band = Math.floor(orig / t.bandRows);
    const gemChance = kind === 'crystal' ? t.crystalGemChance : kind === 'dirt' ? t.treasureChance : 0;
    return {
      id: this.nextId++,
      col,
      orig,
      kind,
      hp,
      maxHp: hp,
      strata: this.strataOf(orig),
      gem: this.rng(orig, col, 3) < gemChance ? t.gemBase + band * t.gemPerBand : 0,
      broken: false,
      drow: 0,
    };
  }

  private relayout(col: number): void {
    const base = this.removed[col].length;
    this.cols[col].forEach((b, k) => (b.drow = base + k));
  }

  /** Makes sure column `col` has blocks down to board row `drow`. */
  ensure(col: number, drow: number): void {
    const list = this.cols[col];
    while (this.removed[col].length + list.length <= drow) {
      const b = this.generate(this.removed[col].length + list.length, col);
      list.push(b);
      b.drow = this.removed[col].length + list.length - 1;
    }
  }

  /** The block at a board position, or null for tunnel (above the wall's surface). */
  blockAt(col: number, drow: number): Block | null {
    if (col < 0 || col >= this.cols.length || drow < 0) return null;
    const k = drow - this.removed[col].length;
    if (k < 0) return null;
    this.ensure(col, drow);
    const b = this.cols[col][k];
    return b && !b.broken ? b : null;
  }

  /** Row of the wall surface in a column (where the tunnel ends). */
  surface(col: number): number {
    return this.removed[col].length;
  }

  minSurface(): number {
    return Math.min(...this.removed.map((r) => r.length));
  }

  depthMeters(): number {
    return this.minSurface() * tune.terrain.metersPerRow;
  }

  /**
   * One tap on the block at (col, drow). Damages it, splashes its neighbours,
   * then lets TNT and crystal breaks chain in waves. Broken blocks are removed
   * at the end and everything above them falls. Returns null if the block is
   * missing or untappable.
   */
  tap(col: number, drow: number, damage: number, splashLevel: number): TapResult | null {
    const target = this.blockAt(col, drow);
    if (!target || target.kind === 'rock') return null;
    const splash = Math.max(1, Math.ceil(damage * tune.tap.splashFactor));
    let hits: Hit[] = [{ block: target, dmg: damage, kind: 'tap' }];
    for (const [dc, dr] of splashOffsets(splashLevel)) {
      const b = this.blockAt(col + dc, drow + dr);
      if (b) hits.push({ block: b, dmg: splash, kind: 'splash', from: { col, drow } });
    }
    const waves: Wave[] = [];
    const broken: TapResult['broken'] = [];
    for (let w = 1; hits.length && w <= tune.chain.maxWaves; w++) {
      const wave: Wave = { hits: [], broke: [] };
      for (const h of hits) {
        if (h.block.broken) continue;
        wave.hits.push(h);
        h.block.hp = Math.max(0, h.block.hp - h.dmg);
        if (h.block.hp === 0) {
          h.block.broken = true;
          wave.broke.push(h.block);
          broken.push({ block: h.block, wave: w });
        }
      }
      waves.push(wave);
      hits = [];
      for (const b of wave.broke) {
        if (b.kind === 'tnt') {
          const R = tune.blast.tntRadius;
          for (let dc = -R; dc <= R; dc++)
            for (let dr = -R; dr <= R; dr++) {
              if (!dc && !dr) continue;
              const n = this.blockAt(b.col + dc, b.drow + dr);
              if (n) hits.push({ block: n, dmg: tune.blast.tntDamage, kind: 'blast', from: { col: b.col, drow: b.drow } });
            }
        } else if (b.kind === 'crystal') {
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = this.blockAt(b.col + dc, b.drow + dr);
            if (n && n.kind === 'crystal') hits.push({ block: n, dmg: tune.blast.linkDamage, kind: 'link', from: { col: b.col, drow: b.drow } });
          }
        }
      }
    }

    // Remove what broke, then everything above it falls.
    const fell = new Set<Block>();
    const touched = new Set<number>();
    for (const { block } of broken) {
      const list = this.cols[block.col];
      const i = list.indexOf(block);
      if (i >= 0) list.splice(i, 1);
      this.removed[block.col].push(block.orig);
      touched.add(block.col);
      this.blocksDug++;
    }
    for (const c of touched) {
      const before = new Map(this.cols[c].map((b) => [b, b.drow]));
      this.relayout(c);
      for (const [b, d] of before) if (b.drow !== d) fell.add(b);
    }
    return { waves, broken, fell: [...fell] };
  }

  /** Any block that can be tapped, for the auto pickaxe: top-most tappable block of the shallowest column. */
  autoTarget(): { col: number; drow: number } | null {
    const order = [...this.cols.keys()].sort((a, b) => this.surface(a) - this.surface(b));
    for (const c of order) {
      for (let k = 0; k < 8; k++) {
        const b = this.blockAt(c, this.surface(c) + k);
        if (b && b.kind !== 'rock') return { col: c, drow: b.drow };
      }
    }
    return null;
  }

  serialize(): TerrainSave {
    const damaged: TerrainSave['damaged'] = [];
    this.cols.forEach((list, c) => list.forEach((b) => b.hp < b.maxHp && damaged.push([c, b.orig, b.hp])));
    return { seed: this.seed, blocksDug: this.blocksDug, removed: this.removed.map((r) => [...r]), damaged };
  }

  static restore(save: TerrainSave): Terrain {
    const t = new Terrain(save.seed);
    t.blocksDug = save.blocksDug;
    save.removed.forEach((rows, c) => {
      const gone = new Set(rows);
      const max = Math.max(-1, ...rows);
      for (let o = 0; o <= max; o++) {
        const b = t.generate(o, c);
        if (gone.has(o)) t.removed[c].push(o);
        else t.cols[c].push(b);
      }
      t.relayout(c);
    });
    for (const [c, orig, hp] of save.damaged) {
      const list = t.cols[c];
      let b = list.find((x) => x.orig === orig);
      if (!b) {
        t.ensure(c, orig + t.removed[c].length);
        b = t.cols[c].find((x) => x.orig === orig);
      }
      if (b) b.hp = hp;
    }
    return t;
  }
}
