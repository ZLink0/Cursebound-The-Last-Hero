import { BossWeaknessState, RockType, WeaknessAnchor } from './types';

export interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ParryOutcome = 'perfect_parry' | 'parry' | 'block_absorb' | 'hit';

export function getBossWeaknessRect(
  bossX: number,
  bossY: number,
  bossW: number,
  bossH: number,
  facing: -1 | 1,
  anchor: WeaknessAnchor,
): RectBox {
  switch (anchor) {
    case 'head': {
      const w = Math.max(16, Math.round(bossW * 0.45));
      const h = Math.max(14, Math.round(bossH * 0.28));
      return {
        x: bossX - w / 2,
        y: bossY - bossH + 2,
        w,
        h,
      };
    }
    case 'weapon': {
      const w = Math.max(16, Math.round(bossW * 0.44));
      const h = Math.max(18, Math.round(bossH * 0.36));
      return {
        x: bossX + facing * (bossW * 0.34) - w / 2,
        y: bossY - bossH * 0.66,
        w,
        h,
      };
    }
    case 'core': {
      const w = Math.max(18, Math.round(bossW * 0.48));
      const h = Math.max(18, Math.round(bossH * 0.42));
      return {
        x: bossX - w / 2,
        y: bossY - bossH * 0.64,
        w,
        h,
      };
    }
    case 'chest':
    default: {
      const w = Math.max(18, Math.round(bossW * 0.5));
      const h = Math.max(18, Math.round(bossH * 0.38));
      return {
        x: bossX - w / 2,
        y: bossY - bossH * 0.72,
        w,
        h,
      };
    }
  }
}

export function canDamageBossDirect(weaknessState: BossWeaknessState): boolean {
  return weaknessState === 'weakness_exposed';
}

export function evaluateRockParry(params: {
  isBlocking: boolean;
  parryTimer: number;
  perfectParryTimer: number;
  blockCharges: number;
}): ParryOutcome {
  const { isBlocking, parryTimer, perfectParryTimer, blockCharges } = params;
  if (isBlocking && perfectParryTimer > 0) {
    return 'perfect_parry';
  }
  if (isBlocking && parryTimer > 0) {
    return 'parry';
  }
  if (isBlocking && blockCharges > 0) {
    return 'block_absorb';
  }
  return 'hit';
}

export function computeReflectedRockVelocity(
  rockX: number,
  rockY: number,
  targetX: number,
  targetY: number,
  isPerfect: boolean,
): { vx: number; vy: number } {
  const dx = targetX - rockX;
  const dy = targetY - rockY;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = isPerfect ? 320 : 235;
  return {
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
  };
}

export function checkCircleRectHit(cx: number, cy: number, r: number, rect: RectBox): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

export function applyWeaknessRockImpact(params: {
  armorLayers: number;
  dualHitsRequired?: number;
  dualHitsProgress?: number;
  isPerfect: boolean;
  stunDurationSec: number;
}): {
  nextArmorLayers: number;
  nextDualProgress: number;
  nextWeaknessState: BossWeaknessState;
  armorBroken: boolean;
  layerBroken: boolean;
  stunDuration: number;
} {
  const dualRequired = params.dualHitsRequired ?? 1;
  const prevDual = params.dualHitsProgress ?? 0;

  if (dualRequired > 1 && !params.isPerfect) {
    const nextDual = prevDual + 1;
    if (nextDual < dualRequired) {
      return {
        nextArmorLayers: params.armorLayers,
        nextDualProgress: nextDual,
        nextWeaknessState: 'armor_active',
        armorBroken: false,
        layerBroken: false,
        stunDuration: 0,
      };
    }
  }

  const nextLayers = Math.max(0, params.armorLayers - (params.isPerfect && dualRequired <= 1 ? 1 : 1));
  if (nextLayers <= 0) {
    return {
      nextArmorLayers: 0,
      nextDualProgress: 0,
      nextWeaknessState: 'weakness_exposed',
      armorBroken: true,
      layerBroken: true,
      stunDuration: params.stunDurationSec + (params.isPerfect ? 1.0 : 0),
    };
  }

  return {
    nextArmorLayers: nextLayers,
    nextDualProgress: 0,
    nextWeaknessState: 'armor_active',
    armorBroken: false,
    layerBroken: true,
    stunDuration: 0,
  };
}

export function getChaosOverlordPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  const ratio = hp / Math.max(1, maxHp);
  if (ratio > 0.68) return 1;
  if (ratio > 0.34) return 2;
  return 3;
}

export function getVolcanoRockIntervalSec(): number {
  return 15;
}

export function getVolcanoRockDropCount(): number {
  return 3;
}

export function getRockStatusColor(rockType: RockType): string {
  switch (rockType) {
    case 'fire':
      return '#f97316';
    case 'ice':
      return '#38bdf8';
    case 'poison':
      return '#4ade80';
    case 'spike':
      return '#cbd5e1';
    case 'thunder':
      return '#facc15';
    case 'dark':
      return '#c084fc';
    case 'crystal':
      return '#22d3ee';
    case 'normal':
    default:
      return '#a8a29e';
  }
}
