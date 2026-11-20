import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWeaknessRockImpact,
  canDamageBossDirect,
  checkCircleRectHit,
  computeReflectedRockVelocity,
  evaluateRockParry,
  getBossWeaknessRect,
  getChaosOverlordPhase,
  getRockStatusColor,
  getVolcanoRockDropCount,
  getVolcanoRockIntervalSec,
} from './bossLogic';
import { BOSS_CATALOG, FINAL_BOSS } from './enemyCatalog';
import { RockType } from './types';

test('All 11 bosses have complete weakness configurations, rock types, and stun durations', () => {
  const allBosses = [...BOSS_CATALOG, FINAL_BOSS];
  assert.equal(allBosses.length, 11);
  for (const boss of allBosses) {
    assert.ok(boss.weakness, `${boss.name} missing weakness config`);
    assert.ok(boss.weakness.weaknessName.length > 0);
    assert.ok(boss.weakness.primaryRock.length > 0);
    assert.ok(boss.weakness.secondaryRocks.length >= 1);
    assert.ok(boss.weakness.armorLayers >= 1);
    assert.ok(boss.weakness.stunDurationSec >= 4);
  }
  const abyss = BOSS_CATALOG.find((b) => b.id === 'abyss_dragon_king')!;
  assert.equal(abyss.weakness.armorLayers, 3);
  assert.equal(FINAL_BOSS.name, 'Chaos Overlord');
});

test('Boss armor blocks direct damage until weakness is exposed', () => {
  assert.equal(canDamageBossDirect('armor_active'), false);
  assert.equal(canDamageBossDirect('recovering'), false);
  assert.equal(canDamageBossDirect('weakness_exposed'), true);
});

test('getBossWeaknessRect computes valid hitboxes for all anchors and weapon flips with facing', () => {
  const core = getBossWeaknessRect(200, 180, 48, 56, 1, 'core');
  const chest = getBossWeaknessRect(200, 180, 48, 56, 1, 'chest');
  const head = getBossWeaknessRect(200, 180, 48, 56, 1, 'head');
  const weaponRight = getBossWeaknessRect(200, 180, 48, 56, 1, 'weapon');
  const weaponLeft = getBossWeaknessRect(200, 180, 48, 56, -1, 'weapon');

  for (const box of [core, chest, head, weaponRight, weaponLeft]) {
    assert.ok(box.w >= 16 && box.h >= 14);
  }
  assert.ok(head.y < chest.y);
  assert.ok(weaponRight.x > 200 - weaponRight.w / 2);
  assert.ok(weaponLeft.x < 200 - weaponLeft.w / 2);
});

test('evaluateRockParry distinguishes perfect parry, parry, 3-bar block absorb, and unblocked hit', () => {
  assert.equal(
    evaluateRockParry({ isBlocking: true, parryTimer: 0.25, perfectParryTimer: 0.12, blockCharges: 3 }),
    'perfect_parry',
  );
  assert.equal(
    evaluateRockParry({ isBlocking: true, parryTimer: 0.2, perfectParryTimer: 0, blockCharges: 3 }),
    'parry',
  );
  assert.equal(
    evaluateRockParry({ isBlocking: true, parryTimer: 0, perfectParryTimer: 0, blockCharges: 2 }),
    'block_absorb',
  );
  assert.equal(
    evaluateRockParry({ isBlocking: true, parryTimer: 0, perfectParryTimer: 0, blockCharges: 0 }),
    'hit',
  );
  assert.equal(
    evaluateRockParry({ isBlocking: false, parryTimer: 0.2, perfectParryTimer: 0.1, blockCharges: 3 }),
    'hit',
  );
});

test('Reflected rock velocity aims accurately toward boss weakness hitbox and hits', () => {
  const weaknessBox = getBossWeaknessRect(400, 176, 48, 56, -1, 'core');
  const targetX = weaknessBox.x + weaknessBox.w / 2;
  const targetY = weaknessBox.y + weaknessBox.h / 2;

  const normalVel = computeReflectedRockVelocity(160, 160, targetX, targetY, false);
  const perfectVel = computeReflectedRockVelocity(160, 160, targetX, targetY, true);

  assert.ok(normalVel.vx > 0);
  assert.ok(Math.hypot(perfectVel.vx, perfectVel.vy) > Math.hypot(normalVel.vx, normalVel.vy));

  // Simulate flight along velocity vector -> must collide with weaknessBox
  const timeToTarget = Math.hypot(targetX - 160, targetY - 160) / Math.hypot(normalVel.vx, normalVel.vy);
  const hitX = 160 + normalVel.vx * timeToTarget;
  const hitY = 160 + normalVel.vy * timeToTarget;
  assert.equal(checkCircleRectHit(hitX, hitY, 10, weaknessBox), true);
  assert.equal(checkCircleRectHit(50, 50, 8, weaknessBox), false);
});

test('applyWeaknessRockImpact handles single-layer, 3-layer Abyss Dragon King, and Chaos Overlord Phase 2 dual-parry', () => {
  // Single layer normal parry
  const single = applyWeaknessRockImpact({ armorLayers: 1, isPerfect: false, stunDurationSec: 5 });
  assert.equal(single.armorBroken, true);
  assert.equal(single.nextWeaknessState, 'weakness_exposed');
  assert.equal(single.stunDuration, 5);

  // Single layer perfect parry grants +1s stun
  const singlePerf = applyWeaknessRockImpact({ armorLayers: 1, isPerfect: true, stunDurationSec: 5 });
  assert.equal(singlePerf.armorBroken, true);
  assert.equal(singlePerf.stunDuration, 6);

  // 3-layer shield requires 3 impacts
  const hit1 = applyWeaknessRockImpact({ armorLayers: 3, isPerfect: false, stunDurationSec: 5 });
  assert.equal(hit1.armorBroken, false);
  assert.equal(hit1.layerBroken, true);
  assert.equal(hit1.nextArmorLayers, 2);

  const hit2 = applyWeaknessRockImpact({ armorLayers: hit1.nextArmorLayers, isPerfect: false, stunDurationSec: 5 });
  assert.equal(hit2.armorBroken, false);
  assert.equal(hit2.nextArmorLayers, 1);

  const hit3 = applyWeaknessRockImpact({ armorLayers: hit2.nextArmorLayers, isPerfect: false, stunDurationSec: 5 });
  assert.equal(hit3.armorBroken, true);
  assert.equal(hit3.nextArmorLayers, 0);
  assert.equal(hit3.nextWeaknessState, 'weakness_exposed');

  // Chaos Overlord Phase 2 dual-parry: normal parry 1/2 does not break yet; 2/2 breaks; Perfect Parry breaks immediately
  const dual1 = applyWeaknessRockImpact({
    armorLayers: 1,
    dualHitsRequired: 2,
    dualHitsProgress: 0,
    isPerfect: false,
    stunDurationSec: 5,
  });
  assert.equal(dual1.armorBroken, false);
  assert.equal(dual1.nextDualProgress, 1);

  const dual2 = applyWeaknessRockImpact({
    armorLayers: 1,
    dualHitsRequired: 2,
    dualHitsProgress: dual1.nextDualProgress,
    isPerfect: false,
    stunDurationSec: 5,
  });
  assert.equal(dual2.armorBroken, true);
  assert.equal(dual2.nextWeaknessState, 'weakness_exposed');

  const dualPerf = applyWeaknessRockImpact({
    armorLayers: 1,
    dualHitsRequired: 2,
    dualHitsProgress: 0,
    isPerfect: true,
    stunDurationSec: 5,
  });
  assert.equal(dualPerf.armorBroken, true);
});

test('Chaos Overlord 3-phase thresholds, volcano rock interval/count, and 8 rock colors', () => {
  assert.equal(getChaosOverlordPhase(1000, 1000), 1);
  assert.equal(getChaosOverlordPhase(690, 1000), 1);
  assert.equal(getChaosOverlordPhase(650, 1000), 2);
  assert.equal(getChaosOverlordPhase(350, 1000), 2);
  assert.equal(getChaosOverlordPhase(340, 1000), 3);
  assert.equal(getChaosOverlordPhase(10, 1000), 3);

  assert.equal(getVolcanoRockIntervalSec(), 15);
  assert.equal(getVolcanoRockDropCount(), 3);

  const rockTypes: RockType[] = ['fire', 'ice', 'poison', 'spike', 'thunder', 'dark', 'crystal', 'normal'];
  for (const rt of rockTypes) {
    assert.ok(getRockStatusColor(rt).startsWith('#'));
  }
});
