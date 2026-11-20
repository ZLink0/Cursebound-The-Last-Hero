import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_CATALOG, FINAL_BOSS, KEROCO_CATALOG } from './enemyCatalog';
import {
  MAX_BLOCK_CHARGES,
  MAX_LEVEL,
  addExpAndLevelUp,
  addHpPotion,
  buyShopItem,
  calculateAttackDamage,
  claimQuestReward,
  clearSaveSlot,
  computeBlockedDamage,
  computeChargedGunDamage,
  computeChargedGunRange,
  computeEnemyMaxHp,
  computeHeroStats,
  computePlungeSlamBox,
  consumeAmmo,
  craftArmor,
  craftGrapple,
  craftGun,
  craftSword,
  createDefaultSave,
  createDefaultSettings,
  getActiveSaveSlot,
  getAllSaveSlots,
  getEnemyLevelForStage,
  getExpForNextLevel,
  getSlashReachPx,
  getWorldLevelRange,
  loadSaveState,
  persistSaveState,
  refillAmmo,
  resolveCombatHit,
  resolveDashOrDodge,
  rollChargedSlashStun,
  rollEnemyDropKind,
  setActiveSaveSlot,
  shouldEnemyDropItem,
  shouldTriggerPlungeSlam,
  upgradeAmmoCapacity,
  upgradeArmor,
  upgradeGrapple,
  upgradeGun,
  upgradeSword,
} from './rpgLogic';
import { ARMORS, GRAPPLE_HOOKS, GUNS, MAX_EFFECT_POTIONS, MAX_HP_POTIONS, SAVE_STORAGE_KEY, SWORDS } from './types';

test('EXP and Level 1-150 progression scales smoothly (not too fast) and caps at MAX_LEVEL (150)', () => {
  assert.equal(MAX_LEVEL, 150);
  const save = createDefaultSave();
  assert.equal(save.seenPrologue, false);
  const neededLvl1 = getExpForNextLevel(1);
  assert.ok(neededLvl1 >= 180, `Level 1 EXP threshold (${neededLvl1}) should prevent rapid early over-leveling`);
  assert.ok(getExpForNextLevel(10) > getExpForNextLevel(5));
  const res1 = addExpAndLevelUp(save, neededLvl1 + 10);
  assert.equal(res1.levelsGained, 1);
  assert.equal(res1.next.level, 2);
  assert.equal(res1.next.exp, 10);

  // Massive EXP grant caps cleanly at Level 150
  const maxRes = addExpAndLevelUp(save, 99_999_999);
  assert.equal(maxRes.next.level, 150);
  assert.equal(maxRes.next.exp, 0);
});

test('Ammo is finite, decrements on shot, blocks at 0, and upgrades up to 100', () => {
  const shot1 = consumeAmmo(30, 1);
  assert.equal(shot1.ok, true);
  assert.equal(shot1.nextAmmo, 29);

  const empty = consumeAmmo(0, 1);
  assert.equal(empty.ok, false);
  assert.equal(empty.nextAmmo, 0);

  assert.equal(refillAmmo(25, 30, 12), 30);

  let save = { ...createDefaultSave(), gold: 5000 };
  for (const expectedCap of [45, 60, 80, 100]) {
    const upg = upgradeAmmoCapacity(save);
    assert.equal(upg.ok, true);
    assert.equal(upg.next.maxAmmo, expectedCap);
    save = upg.next;
  }
  const beyond = upgradeAmmoCapacity(save);
  assert.equal(beyond.ok, false);
  assert.equal(beyond.next.maxAmmo, 100);
});

test('Damage, critical hit, and boss-slayer bonuses compute accurately', () => {
  const normal = calculateAttackDamage({
    rawAtk: 20,
    targetDef: 4,
    critRate: 0.2,
    rngValue: 0.9,
  });
  assert.equal(normal.isCrit, false);

  const crit = calculateAttackDamage({
    rawAtk: 20,
    targetDef: 4,
    critRate: 0.2,
    rngValue: 0.05,
  });
  assert.equal(crit.isCrit, true);
  assert.ok(crit.damage > normal.damage);

  const dragonHit = calculateAttackDamage({
    rawAtk: 40,
    targetDef: 0,
    critRate: 0,
    rngValue: 0.5,
    isBossTarget: true,
    swordId: 'dragon_slayer',
  });
  assert.equal(dragonHit.damage, 60);
});

test('10 Guns catalog, 3-block weak gun range (48px), 3-pellet shotguns, infinite top guns, and 40+10+1 enemies', () => {
  assert.equal(GUNS.length, 10);
  assert.equal(ARMORS.length, 5);
  assert.equal(KEROCO_CATALOG.length, 40);
  assert.equal(BOSS_CATALOG.length, 10);
  assert.equal(FINAL_BOSS.isFinalBoss, true);

  // Weak starter gun & iron shotgun are strictly 3 blocks (48px)
  const buster = GUNS.find((g) => g.id === 'buster_mk1')!;
  assert.equal(buster.rangePx, 48);

  const shotguns = GUNS.filter((g) => g.isShotgun);
  assert.ok(shotguns.length >= 2);
  for (const sg of shotguns) {
    assert.equal(sg.pellets, 3);
    assert.ok(sg.rangePx !== null && sg.rangePx <= 64, `${sg.name} should have very short range`);
  }

  const infGuns = GUNS.filter((g) => g.rangePx === null);
  assert.ok(infGuns.length >= 2, 'Top quality guns should have infinite range');

  const gunCrystalCosts = GUNS.filter((g) => g.craftCost).map((g) => g.craftCost!.crystals);
  assert.equal(Math.min(...gunCrystalCosts), 20);
  assert.equal(Math.max(...gunCrystalCosts), 200);

  const swordCrystalCosts = SWORDS.filter((s) => s.craftCost).map((s) => s.craftCost!.crystals);
  assert.equal(Math.min(...swordCrystalCosts), 20);
  assert.equal(Math.max(...swordCrystalCosts), 200);
});

test('HP Potion capacity strictly caps at 10x in pickups and shop', () => {
  assert.equal(MAX_HP_POTIONS, 10);
  const res1 = addHpPotion(8, 5);
  assert.equal(res1.nextPotions, 10);
  assert.equal(res1.overflow, 3);

  let save = { ...createDefaultSave(), gold: 1000, hpPotions: 9 };
  const buyOk = buyShopItem(save, 'hp_potion');
  assert.equal(buyOk.ok, true);
  assert.equal(buyOk.next.hpPotions, 10);
  save = buyOk.next;

  const buyMaxed = buyShopItem(save, 'hp_potion');
  assert.equal(buyMaxed.ok, false);
  assert.equal(buyMaxed.next.hpPotions, 10);
});

test('Overall enemy drop gate is 10% and drop kind table balances crystals/iron/potions/ammo', () => {
  assert.equal(shouldEnemyDropItem(0.05), true);
  assert.equal(shouldEnemyDropItem(0.099), true);
  assert.equal(shouldEnemyDropItem(0.10), false);
  assert.equal(shouldEnemyDropItem(0.75), false);

  const counts: Record<string, number> = {
    rare_crystal: 0,
    weapon_material: 0,
    hp_potion: 0,
    ammo: 0,
    mana_potion: 0,
    gold: 0,
  };
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const r = (i + 0.5) / N;
    const k = rollEnemyDropKind(r, 0.2);
    if (k === 'ammo_small' || k === 'ammo_medium' || k === 'ammo_large') counts.ammo++;
    else counts[k]++;
  }
  assert.equal(counts.rare_crystal, 100);
  assert.equal(counts.weapon_material, 100);
  assert.equal(counts.hp_potion, 100);
  assert.equal(counts.ammo, 100);
});

test('Shop sells accessories/consumables while Blacksmith forges/upgrades Swords, Guns, and Armors', () => {
  let save = {
    ...createDefaultSave(),
    gold: 5000,
    weaponMaterials: 50,
    rareCrystals: 250,
    clearedStages: [1, 5],
  };

  // Buy accessory in Shop
  const buyAcc = buyShopItem(save, { accessoryId: 'ammo_belt' });
  assert.equal(buyAcc.ok, true);
  assert.equal(buyAcc.next.equippedAccessory, 'ammo_belt');
  save = buyAcc.next;

  // Blacksmith forge Crystal Sword (20CR) & Flame Sword (35CR)
  const forge1 = craftSword(save, 'crystal_sword');
  assert.equal(forge1.ok, true);
  save = forge1.next;

  const forge2 = craftSword(save, 'flame_sword');
  assert.equal(forge2.ok, true);
  assert.equal(forge2.next.equippedSword, 'flame_sword');
  save = forge2.next;

  // Blacksmith upgrade Flame Sword -> +1
  const upg = upgradeSword(save, 'flame_sword');
  assert.equal(upg.ok, true);
  assert.equal(upg.next.swordUpgrades.flame_sword, 1);
  save = upg.next;

  // Blacksmith forge Iron Shotgun (35CR) & upgrade it
  const forgeGun = craftGun(save, 'iron_shotgun');
  assert.equal(forgeGun.ok, true);
  assert.equal(forgeGun.next.equippedGun, 'iron_shotgun');
  save = forgeGun.next;

  const upgGun = upgradeGun(save, 'iron_shotgun');
  assert.equal(upgGun.ok, true);
  assert.equal(upgGun.next.gunUpgrades.iron_shotgun, 1);
  save = upgGun.next;

  // Blacksmith forge & upgrade Iron Mail Armor
  const forgeArmor = craftArmor(save, 'iron_mail');
  assert.equal(forgeArmor.ok, true);
  assert.equal(forgeArmor.next.equippedArmor, 'iron_mail');
  save = forgeArmor.next;

  const upgArmor = upgradeArmor(save, 'iron_mail');
  assert.equal(upgArmor.ok, true);
  assert.equal(upgArmor.next.armorUpgrades.iron_mail, 1);
  save = upgArmor.next;

  const stats = computeHeroStats(save);
  assert.ok(stats.atk > 30);
  assert.ok(stats.def >= 11);
  assert.equal(stats.gunDef.id, 'iron_shotgun');
  assert.equal(stats.gunDef.pellets, 3);
  assert.equal(stats.gunDef.rangePx, 48);

  // Claim Boss 1 quest -> awards Holy Sword
  const claim = claimQuestReward(save, 'q_main_boss1');
  assert.equal(claim.ok, true);
  assert.ok(claim.next.ownedSwords.includes('holy_sword'));
});

test('Blocking (L) grants 3 zero-damage guard charges and takes normal damage when depleted; Grappling Hooks craft & upgrade', () => {
  assert.equal(MAX_BLOCK_CHARGES, 3);
  const unblocked = computeBlockedDamage(30, 10, false, 3);
  const blocked3 = computeBlockedDamage(30, 10, true, 3);
  const blocked1 = computeBlockedDamage(30, 10, true, 1);
  const blockedEmpty = computeBlockedDamage(30, 10, true, 0);
  assert.equal(blocked3, 0, 'Blocking with full guard bars deals 0 HP damage');
  assert.equal(blocked1, 0, 'Blocking with 1 guard bar remaining deals 0 HP damage');
  assert.equal(blockedEmpty, unblocked, 'Blocking with 0 guard bars left takes full mitigated damage');

  assert.equal(GRAPPLE_HOOKS.length, 2);
  let save = {
    ...createDefaultSave(),
    gold: 2000,
    weaponMaterials: 20,
    rareCrystals: 100,
  };
  assert.equal(save.equippedGrapple, 'iron_grapple');
  assert.ok(save.ownedGrapples.includes('iron_grapple'));

  const forgeHook = craftGrapple(save, 'plasma_grapple');
  assert.equal(forgeHook.ok, true);
  assert.equal(forgeHook.next.equippedGrapple, 'plasma_grapple');
  save = forgeHook.next;

  const upgHook = upgradeGrapple(save, 'plasma_grapple');
  assert.equal(upgHook.ok, true);
  assert.equal(upgHook.next.grappleUpgrades.plasma_grapple, 1);

  const defSettings = createDefaultSettings();
  assert.equal(defSettings.buttonLayout.preset, 'standard');
  assert.equal(defSettings.buttonLayout.swapHands, false);
});

test('Universal Miss/Crit/Stun combat resolution + Charged A (30% stun) & Charged X (+DMG & +4 blocks range)', () => {
  // Miss outcome
  const missRes = resolveCombatHit({
    rawAtk: 40,
    targetDef: 2,
    critRate: 0.5,
    missChance: 0.1,
    stunChance: 0.5,
    rngHit: 0.05,
    rngCrit: 0.01,
    rngStun: 0.01,
  });
  assert.equal(missRes.missed, true);
  assert.equal(missRes.damage, 0);
  assert.equal(missRes.isCrit, false);
  assert.equal(missRes.stunned, false);

  // Critical + Stun outcome
  const critStunRes = resolveCombatHit({
    rawAtk: 40,
    targetDef: 0,
    critRate: 0.25,
    missChance: 0.1,
    stunChance: 0.3,
    rngHit: 0.5,
    rngCrit: 0.1,
    rngStun: 0.2,
  });
  assert.equal(critStunRes.missed, false);
  assert.equal(critStunRes.isCrit, true);
  assert.equal(critStunRes.stunned, true);
  assert.equal(critStunRes.damage, 70);

  // Charged Slash (A) exact 30% stun chance
  assert.equal(rollChargedSlashStun(0.0), true);
  assert.equal(rollChargedSlashStun(0.299), true);
  assert.equal(rollChargedSlashStun(0.3), false);
  assert.equal(rollChargedSlashStun(0.85), false);

  // Charged Gun (X): adds +64px (+4 blocks >= 3+ blocks) and increases damage
  assert.equal(computeChargedGunRange(48), 112);
  assert.equal(computeChargedGunRange(64), 128);
  assert.equal(computeChargedGunRange(null), null);
  assert.ok(computeChargedGunDamage(20) > 30);
});

test('Y alone or Y+Back triggers Dodge; Y+Forward triggers Forward Dash', () => {
  assert.equal(resolveDashOrDodge(0, 1), 'dodge');
  assert.equal(resolveDashOrDodge(0, -1), 'dodge');
  assert.equal(resolveDashOrDodge(-1, 1), 'dodge');
  assert.equal(resolveDashOrDodge(1, -1), 'dodge');
  assert.equal(resolveDashOrDodge(1, 1), 'dash');
  assert.equal(resolveDashOrDodge(-1, -1), 'dash');
});

test('3 Save Slots persist independently, track active slot, clear cleanly, and migrate legacy Slot 1', () => {
  const store = new Map<string, string>();
  const prevStorage = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };

  try {
    // Legacy save auto-migrates into Slot 1
    const legacy = { ...createDefaultSave(), level: 7, gold: 450 };
    store.set(SAVE_STORAGE_KEY, JSON.stringify(legacy));
    const slot1Loaded = loadSaveState(1);
    assert.equal(slot1Loaded?.level, 7);
    assert.equal(slot1Loaded?.gold, 450);

    // Slot 2 & 3 remain independent
    const s2 = { ...createDefaultSave(), level: 12, highestUnlockedStage: 8, gold: 999 };
    const s3 = { ...createDefaultSave(), level: 25, highestUnlockedStage: 20, gold: 2500 };
    persistSaveState(s2, 2);
    assert.equal(getActiveSaveSlot(), 2);
    persistSaveState(s3, 3);
    assert.equal(getActiveSaveSlot(), 3);

    setActiveSaveSlot(1);
    assert.equal(getActiveSaveSlot(), 1);

    const allSlots = getAllSaveSlots();
    assert.equal(allSlots.length, 3);
    assert.equal(allSlots[0].save?.level, 7);
    assert.equal(allSlots[1].save?.level, 12);
    assert.equal(allSlots[2].save?.level, 25);

    clearSaveSlot(2);
    const afterClear = getAllSaveSlots();
    assert.equal(afterClear[0].save?.level, 7);
    assert.equal(afterClear[1].save, null);
    assert.equal(afterClear[2].save?.level, 25);
  } finally {
    if (prevStorage) {
      (globalThis as unknown as { localStorage: Storage }).localStorage = prevStorage;
    } else {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  }
});

test('Effect Potions (STR+, Speed+, Defense+) can be bought up to 10 each and cap strictly at 10', () => {
  assert.equal(MAX_EFFECT_POTIONS, 10);
  let save = {
    ...createDefaultSave(),
    gold: 5000,
    strPotions: 9,
    spdPotions: 9,
    defPotions: 9,
  };

  const bStr = buyShopItem(save, 'str_potion');
  assert.equal(bStr.ok, true);
  assert.equal(bStr.next.strPotions, 10);
  assert.equal(buyShopItem(bStr.next, 'str_potion').ok, false);
  save = bStr.next;

  const bSpd = buyShopItem(save, 'spd_potion');
  assert.equal(bSpd.ok, true);
  assert.equal(bSpd.next.spdPotions, 10);
  assert.equal(buyShopItem(bSpd.next, 'spd_potion').ok, false);
  save = bSpd.next;

  const bDef = buyShopItem(save, 'def_potion');
  assert.equal(bDef.ok, true);
  assert.equal(bDef.next.defPotions, 10);
  assert.equal(buyShopItem(bDef.next, 'def_potion').ok, false);
});

test('Skill Slash reaches 3 blocks (48px) and Stage 1 enemies have RPG-scaled HP (no 1-hit kills)', () => {
  assert.ok(getSlashReachPx(0, false, true) >= 48, 'Charged Skill Slash must reach at least 3 blocks (48px)');
  assert.equal(getSlashReachPx(0, false, false), 22);
  assert.equal(getSlashReachPx(6, true, false), 34);

  const stage1Hp = computeEnemyMaxHp(1, 0, 1.0, false);
  const starterStats = computeHeroStats(createDefaultSave());
  assert.ok(stage1Hp >= 45, `Stage 1 keroco HP (${stage1Hp}) should require multiple hits`);
  assert.ok(stage1Hp > starterStats.atk * 1.5, 'Starter sword should not 1-hit Stage 1 enemies');
  assert.ok(computeEnemyMaxHp(25, 2, 1.2, false) > stage1Hp);
  assert.ok(computeEnemyMaxHp(5, 0, 1.2, true) > computeEnemyMaxHp(5, 0, 1.2, false));
});

test('World levels scale W1:1-30, W2:30-60, W3:60-90, W4:90-120, W5:120-150 and Jump+Down+A triggers Plunge Slam', () => {
  assert.deepEqual(getWorldLevelRange(0), { min: 1, max: 30 });
  assert.deepEqual(getWorldLevelRange(1), { min: 30, max: 60 });
  assert.deepEqual(getWorldLevelRange(2), { min: 60, max: 90 });
  assert.deepEqual(getWorldLevelRange(3), { min: 90, max: 120 });
  assert.deepEqual(getWorldLevelRange(4), { min: 120, max: 150 });

  assert.equal(getEnemyLevelForStage(1, 0), 1);
  assert.equal(getEnemyLevelForStage(20, 4), 30);
  assert.equal(getEnemyLevelForStage(21, 0), 30);
  assert.equal(getEnemyLevelForStage(40, 4), 60);
  assert.equal(getEnemyLevelForStage(41, 0), 60);
  assert.equal(getEnemyLevelForStage(60, 4), 90);
  assert.equal(getEnemyLevelForStage(80, 4), 120);
  assert.equal(getEnemyLevelForStage(100, 4), 150);

  assert.equal(shouldTriggerPlungeSlam(false, false, false, true, true), true);
  assert.equal(shouldTriggerPlungeSlam(true, false, false, true, true), false);
  assert.equal(shouldTriggerPlungeSlam(false, true, false, true, true), false);
  assert.equal(shouldTriggerPlungeSlam(false, false, true, true, true), false);
  assert.equal(shouldTriggerPlungeSlam(false, false, false, true, false), false);

  const box = computePlungeSlamBox(120, 160, 8);
  assert.ok(box.radiusPx >= 56);
  assert.equal(box.left, 120 - box.radiusPx);
  assert.equal(box.right, 120 + box.radiusPx);
  assert.ok(box.top < 160 && box.bottom > 160);
});



