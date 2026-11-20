import {
  BossDef,
  KerocoBehavior,
  getBossForStage,
  getBossLevelForStage,
  getKerocoForBiome,
} from './enemyCatalog';
import { computeEnemyMaxHp, getEnemyLevelForStage } from './rpgLogic';
import { BIOMES, BiomeDef, BiomeId, EnemyKind, SwordId } from './types';

export const TILE_SIZE = 16;
export const STAGE_ROWS = 15; // 15 * 16 = 240px playfield height (plus 16px HUD = 256x256 square)
export const CANVAS_SIZE = 256;
export const HUD_BAR_HEIGHT = 16;
export const PORTALS_PER_STAGE = 5;
export const KILLS_TO_OPEN_EXIT = 5;

// Tile codes:
// 0 = empty
// 1 = solid ground top
// 2 = solid brick fill
// 3 = one-way platform
// 4 = vertical ladder (up/down)
// 5 = spikes hazard
// 6 = deco pillar
// 7 = horizontal monkey bar / overhead climb rail (left/right hangClimb)
// 8 = water obstacle pool
// 9 = quicksand pit (desert)
// 10 = destructible boss platform
export type TileType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface EnemySpawn {
  id: number;
  kind: EnemyKind;
  kerocoId?: string;
  bossDef?: BossDef;
  name: string;
  enemyLevel: number;
  spriteRow: number; // 0..39 for keroco, 0..10 for boss
  behavior: KerocoBehavior | 'boss';
  x: number;
  y: number;
  hp: number;
  atk: number;
  speed: number;
  expReward: number;
  goldReward: number;
}

export interface ChestSpawn {
  id: number;
  x: number;
  y: number;
  crystals: number;
  gold: number;
  swordReward?: SwordId;
}

export interface MovingPlatformSpawn {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  minPos: number;
  maxPos: number;
  speed: number;
  phase: number;
}

export type PortalUnlockRule = 'kills' | 'key' | 'lever' | 'boss';

export interface AreaPortal {
  id: number;
  x: number;
  y: number;
  kind: 'exit';
  rule: PortalUnlockRule;
  requiredKills: number;
}

export interface LeverSpawn {
  id: number;
  x: number;
  y: number;
}

export interface KeySpawn {
  id: number;
  x: number;
  y: number;
}

export interface DestructiblePlatformSpawn {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
}

export interface StageArea {
  areaIndex: number; // 0..4 (Portal 1..5)
  biomeIndex: number; // 0..5
  biomeId: BiomeId;
  isBossArea: boolean;
  portalRule: PortalUnlockRule;
  cols: number;
  rows: number;
  tiles: TileType[][]; // [row][col]
  spawnX: number;
  spawnY: number;
  portalX: number;
  portalY: number;
  portals: AreaPortal[];
  lever?: LeverSpawn;
  keySpawn?: KeySpawn;
  movingPlatforms: MovingPlatformSpawn[];
  destructiblePlatforms: DestructiblePlatformSpawn[];
  enemies: EnemySpawn[];
  chests: ChestSpawn[];
}

export interface StageData {
  stageNumber: number; // 1..100
  worldIndex: number; // 0..4
  biome: BiomeDef;
  isBossStage: boolean;
  areas: StageArea[]; // Always 5 areas with 5 exit portals
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getWorldIndexForStage(stageNumber: number): number {
  const clamped = Math.max(1, Math.min(100, stageNumber));
  return Math.floor((clamped - 1) / 20);
}

export function getBiomeForStage(stageNumber: number): BiomeDef {
  const clamped = Math.max(1, Math.min(100, stageNumber));
  return BIOMES[(clamped - 1) % BIOMES.length];
}

export function getAreaPortalRule(stageNumber: number, areaIndex: number, isBossArea: boolean): PortalUnlockRule {
  if (isBossArea) return 'boss';
  const rules: readonly ('kills' | 'key' | 'lever')[] = ['kills', 'key', 'lever'];
  return rules[(stageNumber + areaIndex) % rules.length];
}

function mapBehaviorToKind(behavior: KerocoBehavior): EnemyKind {
  switch (behavior) {
    case 'slime':
    case 'crawler':
      return 'slime';
    case 'bat':
    case 'ghost':
      return 'bat';
    case 'trooper':
    case 'mage':
      return 'trooper';
    case 'knight':
    case 'skeleton':
    case 'golem':
      return 'knight';
    case 'turret':
      return 'turret';
  }
}

function generateArea(
  stage: number,
  biome: BiomeDef,
  areaIndex: number,
  isBossArea: boolean,
): StageArea {
  const rng = mulberry32(stage * 9973 + areaIndex * 1307 + 7919);
  const cols = isBossArea ? 52 : 68 + Math.min(16, Math.floor(stage / 6)) + (areaIndex % 2) * 4;
  const tiles: TileType[][] = Array.from({ length: STAGE_ROWS }, () =>
    Array<TileType>(cols).fill(0),
  );

  const groundRow = 11; // y = 176..239

  const setSolidFloor = (c: number, row = groundRow) => {
    if (c < 0 || c >= cols) return;
    tiles[row][c] = 1;
    for (let r = row + 1; r < STAGE_ROWS; r++) {
      tiles[r][c] = 2;
    }
  };

  // Start safe zone: cols 0..9
  for (let c = 0; c <= 9; c++) {
    setSolidFloor(c, groundRow);
  }
  if (stage === 1 && areaIndex === 0) {
    tiles[groundRow - 1][6] = 6;
  }

  const movingPlatforms: MovingPlatformSpawn[] = [];
  const destructiblePlatforms: DestructiblePlatformSpawn[] = [];
  let nextPlatId = 1;
  let nextDestructId = 1;
  const enemySpots: { col: number; row: number; aerial?: boolean }[] = [];

  if (isBossArea) {
    // Grand Boss Arena (52 cols wide) with themed elevation, floating platforms, hazard trench & destructible ledges
    for (let c = 0; c < cols; c++) {
      setSolidFloor(c, groundRow);
    }
    // Central hazard pit / trench (cols 23..26) with spikes at bottom (row 12) + solid safety floor below
    for (let c = 23; c <= 26; c++) {
      tiles[11][c] = 0;
      tiles[12][c] = biome.id === 'desert' ? 9 : 5; // Desert pit uses quicksand, others spike/hazard trench
      tiles[13][c] = 1;
      tiles[14][c] = 2;
    }
    // Left lower elevated platform + ladder
    for (let c = 8; c <= 13; c++) tiles[8][c] = 3;
    tiles[9][8] = 4;
    tiles[10][8] = 4;
    // Upper-left high platform (for dodging ground sweeps & quakes)
    for (let c = 15; c <= 20; c++) tiles[5][c] = 3;
    // Central destructible floating bridge over trench
    destructiblePlatforms.push({
      id: nextDestructId++,
      x: 22 * TILE_SIZE,
      y: 8 * TILE_SIZE,
      w: 5 * TILE_SIZE,
      h: 8,
      hp: 2,
    });
    // Overhead monkey bar rail across center
    for (let c = 18; c <= 28; c++) tiles[3][c] = 7;
    // Right mid destructible platform
    destructiblePlatforms.push({
      id: nextDestructId++,
      x: 30 * TILE_SIZE,
      y: 7 * TILE_SIZE,
      w: 4 * TILE_SIZE,
      h: 8,
      hp: 2,
    });
    // Far-right elevated platform + ladder
    for (let c = 36; c <= 42; c++) tiles[8][c] = 3;
    tiles[9][42] = 4;
    tiles[10][42] = 4;
    // High far-right perch
    for (let c = 33; c <= 37; c++) tiles[5][c] = 3;
  } else {
    // Roguelike branching terrain across cols 10..(cols - 10)
    let c = 10;
    while (c < cols - 10) {
      const roll = rng();

      if (roll < 0.24 && c + 8 < cols - 10) {
        // Branch Segment A: Desert uses Quicksand (9); other biomes use Water pool (8) + overhead monkey bars & moving platform
        const poolLen = 5;
        const hazardTile: TileType = biome.id === 'desert' ? 9 : 8;
        // Solid basin floor at row 13..14, pool at rows 11..12
        for (let wc = c; wc < c + poolLen; wc++) {
          tiles[11][wc] = hazardTile;
          tiles[12][wc] = hazardTile;
          tiles[13][wc] = 1;
          tiles[14][wc] = 2;
        }
        // Overhead monkey bars (tile 7) at row 6 so player can hang-climb across!
        for (let mc = c - 1; mc <= c + poolLen; mc++) {
          tiles[6][mc] = 7;
        }
        // Stepping ledge or ladder up to monkey bar on left
        tiles[8][c - 1] = 3;
        tiles[9][c - 1] = 4;
        tiles[10][c - 1] = 4;
        // Horizontal moving platform across the pool
        movingPlatforms.push({
          id: nextPlatId++,
          x: c * TILE_SIZE,
          y: 9 * TILE_SIZE,
          w: 32,
          h: 8,
          axis: 'x',
          minPos: c * TILE_SIZE,
          maxPos: (c + poolLen - 2) * TILE_SIZE,
          speed: 32 + Math.min(20, stage * 0.2),
          phase: rng() * Math.PI * 2,
        });
        c += poolLen;
        setSolidFloor(c, groundRow);
        setSolidFloor(c + 1, groundRow);
        c += 2;
      } else if (roll < 0.48 && c + 9 < cols - 10) {
        // Branch Segment B: Vertical Lift + Upper/Lower Dual Roguelike Paths
        const segLen = 8;
        for (let sc = c; sc < c + segLen; sc++) {
          setSolidFloor(sc, groundRow);
        }
        // Upper branch platform at row 5
        for (let uc = c + 1; uc < c + segLen - 1; uc++) {
          tiles[5][uc] = 3;
        }
        // Vertical ladder on left side connecting row 5..10
        for (let lr = 5; lr <= 10; lr++) {
          tiles[lr][c + 1] = 4;
        }
        // Vertical moving platform on right side (up-down)
        movingPlatforms.push({
          id: nextPlatId++,
          x: (c + segLen - 2) * TILE_SIZE,
          y: 7 * TILE_SIZE,
          w: 32,
          h: 8,
          axis: 'y',
          minPos: 5 * TILE_SIZE,
          maxPos: 10 * TILE_SIZE,
          speed: 28 + Math.min(18, stage * 0.15),
          phase: rng() * Math.PI * 2,
        });
        enemySpots.push({ col: c + 3, row: 5 });
        enemySpots.push({ col: c + 4, row: groundRow });
        c += segLen;
      } else if (roll < 0.70 && c + 7 < cols - 10) {
        // Branch Segment C: Monkey Bar Corridor + Spikes/Water below
        const segLen = 6;
        for (let sc = c; sc < c + segLen; sc++) {
          setSolidFloor(sc, groundRow);
          if (sc >= c + 1 && sc <= c + segLen - 2 && rng() < 0.5) {
            tiles[groundRow - 1][sc] = 5; // hazard spikes below bar
          }
          tiles[6][sc] = 7; // horizontal monkey bar
        }
        tiles[8][c] = 3;
        tiles[9][c] = 4;
        tiles[10][c] = 4;
        enemySpots.push({ col: c + 3, row: 4, aerial: true });
        c += segLen;
      } else {
        // Branch Segment D: Standard elevated plateau + platform
        const segLen = 5;
        const elev = rng() < 0.45 ? 10 : groundRow;
        for (let sc = c; sc < c + segLen; sc++) {
          setSolidFloor(sc, elev);
        }
        if (rng() < 0.65) {
          for (let pc = c + 1; pc < c + segLen - 1; pc++) tiles[7][pc] = 3;
          enemySpots.push({ col: c + 2, row: 7 });
        }
        enemySpots.push({ col: c + 3, row: elev });
        c += segLen;
      }
    }

    // Far end safe zone
    for (let fc = cols - 10; fc < cols; fc++) {
      setSolidFloor(fc, groundRow);
    }
    // High branch platform at far end (for alternate Exit Portal placement!)
    for (let uc = cols - 12; uc <= cols - 4; uc++) {
      tiles[5][uc] = 3;
    }
    for (let lr = 5; lr <= 10; lr++) {
      tiles[lr][cols - 11] = 4;
    }
  }

  // Seal solid borders
  for (let r = 0; r < STAGE_ROWS; r++) {
    tiles[r][0] = 2;
    tiles[r][cols - 1] = 2;
  }

  // Guarantee clean spawn space
  const spawnCol = 3;
  for (let c = spawnCol - 1; c <= spawnCol + 2; c++) {
    setSolidFloor(c, groundRow);
    tiles[groundRow - 1][c] = 0;
    tiles[groundRow - 2][c] = 0;
  }

  // Build Portals: Exit Portal only + distinct per-area rule ('kills' | 'key' | 'lever' | 'boss')
  const portalRule = getAreaPortalRule(stage, areaIndex, isBossArea);
  const portals: AreaPortal[] = [];
  let exitCol = cols - 4;
  let exitRow = groundRow;
  let lever: LeverSpawn | undefined;
  let keySpawn: KeySpawn | undefined;

  if (isBossArea) {
    exitCol = cols - 5;
    exitRow = groundRow;
    portals.push({
      id: 0,
      x: exitCol * TILE_SIZE + 8,
      y: exitRow * TILE_SIZE,
      kind: 'exit',
      rule: 'boss',
      requiredKills: 0, // Boss defeat unlocks final exit
    });
  } else {
    // Vary exit branch location (either upper platform or far ground)
    const upperExit = rng() < 0.45;
    if (upperExit) {
      exitCol = cols - 6;
      exitRow = 5;
    } else {
      exitCol = cols - 4;
      exitRow = groundRow;
    }

    portals.push({
      id: 0,
      x: exitCol * TILE_SIZE + 8,
      y: exitRow * TILE_SIZE,
      kind: 'exit',
      rule: portalRule,
      requiredKills: portalRule === 'kills' ? KILLS_TO_OPEN_EXIT : 0,
    });

    if (portalRule === 'lever') {
      // Place high overhead Lever ("tuas") at row 2 (y = 40px) out of normal jump reach,
      // clear upper platforms/ladders right under it so it MUST be triggered via Grappling Hook [R]!
      const leverCol = Math.max(18, Math.min(cols - 16, Math.floor(cols * (0.45 + (areaIndex % 3) * 0.12))));
      for (let cClear = leverCol - 1; cClear <= leverCol + 1; cClear++) {
        for (let rClear = 1; rClear <= 6; rClear++) {
          if (tiles[rClear][cClear] === 3 || tiles[rClear][cClear] === 4 || tiles[rClear][cClear] === 7) {
            tiles[rClear][cClear] = 0;
          }
        }
        if (tiles[groundRow][cClear] === 8) {
          setSolidFloor(cClear, groundRow);
        }
      }
      // Small ceiling anchor block above lever at row 0..1
      tiles[0][leverCol] = 2;
      tiles[1][leverCol] = 2;
      lever = {
        id: areaIndex + 1,
        x: leverCol * TILE_SIZE + 8,
        y: 2 * TILE_SIZE + 8,
      };
    } else if (portalRule === 'key') {
      // Place collectible Portal Key on an accessible mid-area platform or ground floor
      const keyCol = Math.max(16, Math.min(cols - 15, Math.floor(cols * (0.36 + (areaIndex % 3) * 0.14))));
      let keyRow = groundRow;
      for (let r = 4; r < STAGE_ROWS - 1; r++) {
        if (tiles[r][keyCol] === 1 || tiles[r][keyCol] === 3) {
          keyRow = r;
          break;
        }
      }
      if (tiles[keyRow][keyCol] === 8 || tiles[keyRow][keyCol] === 9 || tiles[keyRow - 1][keyCol] === 5) {
        setSolidFloor(keyCol, groundRow);
        tiles[groundRow - 1][keyCol] = 0;
        keyRow = groundRow;
      }
      keySpawn = {
        id: areaIndex + 1,
        x: keyCol * TILE_SIZE + 8,
        y: keyRow * TILE_SIZE - 8,
      };
    }
  }

  // Populate enemies: >= 7 varied keroco from the 40-enemy catalog
  const enemies: EnemySpawn[] = [];
  let nextEnemyId = 1;
  const enemyLvl = getEnemyLevelForStage(stage, areaIndex);

  // Ensure enough ground/aerial spots exist
  for (let col = 12; col < cols - 8; col += 7) {
    if (enemySpots.length >= 9) break;
    let floorRow = groundRow;
    for (let r = 4; r < STAGE_ROWS - 1; r++) {
      if (tiles[r][col] === 1 || tiles[r][col] === 3) {
        floorRow = r;
        break;
      }
    }
    if (tiles[floorRow][col] !== 8 && tiles[floorRow - 1][col] !== 5) {
      enemySpots.push({ col, row: floorRow });
    }
  }

  const minEnemies = isBossArea ? 2 : 7;
  for (let i = 0; i < Math.max(minEnemies, Math.min(10, enemySpots.length)); i++) {
    const spot = enemySpots[i % enemySpots.length];
    const col = Math.max(11, Math.min(cols - 6, spot.col));
    const kDef = getKerocoForBiome(biome.id, rng, i % 3 === 2);
    const kind = mapBehaviorToKind(kDef.behavior);
    const hp = computeEnemyMaxHp(stage, areaIndex, kDef.hpMult, false);
    const atk = Math.round((4 + stage * 1.1) * kDef.atkMult);
    const yPos = spot.aerial ? spot.row * TILE_SIZE - 8 : spot.row * TILE_SIZE;

    enemies.push({
      id: nextEnemyId++,
      kind,
      kerocoId: kDef.id,
      name: kDef.name,
      enemyLevel: enemyLvl,
      spriteRow: kDef.spriteRow,
      behavior: kDef.behavior,
      x: col * TILE_SIZE + 8,
      y: yPos,
      hp,
      atk,
      speed: kDef.speed,
      expReward: Math.round(8 + stage * 2.5 + areaIndex * 1.5),
      goldReward: Math.round(7 + stage * 2.2),
    });
  }

  // Boss spawn in final Boss Area
  if (isBossArea) {
    const bossDef = getBossForStage(stage);
    enemies.push({
      id: nextEnemyId++,
      kind: 'boss',
      bossDef,
      name: bossDef.name,
      enemyLevel: getBossLevelForStage(stage),
      spriteRow: bossDef.spriteRow,
      behavior: 'boss',
      x: (cols - 12) * TILE_SIZE,
      y: groundRow * TILE_SIZE,
      hp: computeEnemyMaxHp(stage, areaIndex, bossDef.hpMult, true),
      atk: Math.round((8 + stage * 1.65) * bossDef.atkMult),
      speed: bossDef.speed,
      expReward: Math.round(60 + stage * 12),
      goldReward: Math.round(70 + stage * 14),
    });
  }

  // Chests along branches
  const chests: ChestSpawn[] = [];
  if (!isBossArea) {
    const chestCol = Math.min(cols - 12, Math.max(14, Math.floor(cols * 0.52)));
    let chestRow = groundRow;
    for (let r = 4; r < STAGE_ROWS - 1; r++) {
      if (tiles[r][chestCol] === 1 || tiles[r][chestCol] === 3) {
        chestRow = r;
        break;
      }
    }
    let swordReward: SwordId | undefined;
    if (stage === 12 && areaIndex === 2) swordReward = 'thunder_sword';
    if (stage === 32 && areaIndex === 3) swordReward = 'great_sword';
    chests.push({
      id: areaIndex * 10 + 1,
      x: chestCol * TILE_SIZE + 8,
      y: chestRow * TILE_SIZE,
      crystals: 2 + Math.floor(stage / 10),
      gold: 25 + stage * 5,
      swordReward,
    });
  }

  return {
    areaIndex,
    biomeIndex: biome.index,
    biomeId: biome.id,
    isBossArea,
    portalRule,
    cols,
    rows: STAGE_ROWS,
    tiles,
    spawnX: spawnCol * TILE_SIZE + 8,
    spawnY: groundRow * TILE_SIZE,
    portalX: exitCol * TILE_SIZE + 8,
    portalY: exitRow * TILE_SIZE,
    portals,
    lever,
    keySpawn,
    movingPlatforms,
    destructiblePlatforms,
    enemies,
    chests,
  };
}

export function generateStage(stageNumber: number): StageData {
  const stage = Math.max(1, Math.min(100, Math.round(stageNumber)));
  const worldIndex = getWorldIndexForStage(stage);
  const biome = getBiomeForStage(stage);
  const isBossStage = stage % 5 === 0;

  const areas: StageArea[] = [];
  for (let a = 0; a < PORTALS_PER_STAGE; a++) {
    const isBossArea = isBossStage && a === PORTALS_PER_STAGE - 1;
    areas.push(generateArea(stage, biome, a, isBossArea));
  }

  return {
    stageNumber: stage,
    worldIndex,
    biome,
    isBossStage,
    areas,
  };
}
