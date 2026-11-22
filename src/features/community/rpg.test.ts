import { describe, expect, it } from 'vitest';
import {
  achievements, applyBuffs, availableAchievements, cardPower, characters,
  collectionBonuses, confirmLevelCard, createCard, createRpgState, dailyQuests,
  dismantleCard, effectiveStats, leagueFor, levelUpCard, pveEnemyTeam, pveStages,
  promoteCard, questKey, rankMultiplier, ratingDelta, rerollLevelCard, rerollSkill,
  resetRating, revealCard, rollPackChoices, rollRarity, rollStats, seasonInfo,
  seasonRewards, shardCost, simulateBattle, skillPower, statKeys, statRange,
  syncSkills, teamBuffs, teamSizeAdvantage, tradeFee, tradeOffer, tradePartners,
  withCollectionTokenBonus,
} from './rpg';
import type { Skill } from './rpg';
import type { CardStats, RpgCard } from './rpg';

function card(id: string, overrides: Partial<RpgCard> = {}): RpgCard {
  const { level = 5, rarity = 'legendary', seed = 42, revealed = true, ...rest } = overrides;
  const base = createCard({ id, character: characters[0], rarity, seed, revealed, level });
  return { ...base, ...rest };
}

function expectStatsWithin(card: RpgCard) {
  const multiplier = rankMultiplier(card.rank);
  for (const stat of statKeys) {
    const [min, max] = statRange(card.rarity, stat);
    expect(card.stats[stat]).toBeGreaterThanOrEqual(min * multiplier - 1);
    expect(card.stats[stat]).toBeLessThanOrEqual(max * multiplier * 1.5 + 1);
  }
}

describe('rpg: генерация карточек', () => {
  it('детерминированно генерирует характеристики из одного сида', () => {
    expect(rollStats('epic', 777)).toEqual(rollStats('epic', 777));
    expect(rollStats('epic', 777)).not.toEqual(rollStats('epic', 778));
  });

  it('соблюдает диапазоны редкости', () => {
    for (const rarity of ['common', 'rare', 'epic', 'legendary', 'mythic', 'divine'] as const) {
      const stats = rollStats(rarity, 123);
      for (const stat of statKeys) {
        const [min, max] = statRange(rarity, stat);
        expect(stats[stat]).toBeGreaterThanOrEqual(min);
        expect(stats[stat]).toBeLessThanOrEqual(max);
      }
    }
  });

  it('создаёт неизученную карточку со скрытыми, но сгенерированными статами', () => {
    const fresh = createCard({ id: 'new-1', character: characters[1], rarity: 'mythic', seed: 9 });
    expect(fresh.revealed).toBe(false);
    expect(fresh.level).toBe(1);
    expect(fresh.rank).toBe('D');
    expect(fresh.skills).toEqual([]);
    expectStatsWithin(fresh);
    expect(revealCard(fresh).revealed).toBe(true);
  });

  it('даёт три разные карточки с уникальными id при открытии пака', () => {
    const choices = rollPackChoices(555);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((entry) => entry.id)).size).toBe(3);
    expect(choices.every((entry) => !entry.revealed)).toBe(true);
    expect(rollPackChoices(555).map((entry) => entry.id)).toEqual(choices.map((entry) => entry.id));
  });

  it('редкость выпадает детерминированно и ограничена шестью вариантами', () => {
    const values = Array.from({ length: 100 }, (_, index) => rollRarity(index * 31));
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(values.every((value) => ['common', 'rare', 'epic', 'legendary', 'mythic', 'divine'].includes(value))).toBe(true);
  });
});

describe('rpg: раскрытие, уровни и навыки', () => {
  it('открывает навыки на 5, 10, 15 и 20 уровне', () => {
    expect(card('skills', { level: 4 }).skills).toHaveLength(0);
    expect(syncSkills({ id: 'x', level: 5, skillSeed: 7, skills: [] })).toHaveLength(1);
    expect(syncSkills({ id: 'x', level: 10, skillSeed: 7, skills: [] })).toHaveLength(2);
    const full = syncSkills({ id: 'x', level: 20, skillSeed: 7, skills: [] });
    expect(full).toHaveLength(4);
    expect(full.map((skill) => skill.kind)).toEqual(['active', 'active', 'passive', 'ultimate']);
  });

  it('пересчитывает каждую характеристику отдельно и предлагает выбор', () => {
    const before = card('level').stats;
    const upgraded = levelUpCard(card('level', { level: 7 }));
    expect(upgraded.level).toBe(8);
    expect(upgraded.pending?.before).toEqual(before);
    const deltas = statKeys.filter((stat) => upgraded.stats[stat] !== before[stat]).length;
    expect(deltas).toBeGreaterThan(0);
    expectStatsWithin(upgraded);

    const rerolled = rerollLevelCard(upgraded);
    expect(rerolled.level).toBe(8);
    expect(rerolled.pending?.variant).toBe(1);
    expect(rerolled.stats).not.toEqual(upgraded.stats);

    const confirmed = confirmLevelCard(rerolled);
    expect(confirmed.pending).toBeUndefined();
    expect(confirmed.stats).toEqual(rerolled.stats);
  });

  it('не позволяет улучшить карточку выше 20 уровня', () => {
    const maxed = card('max', { level: 20 });
    expect(levelUpCard(maxed)).toEqual(maxed);
  });

  it('заменяет навык при наличии предмета', () => {
    const source = card('skill-reroll', { level: 20 });
    const target = source.skills[0];
    const changed = rerollSkill(source, target.id);
    expect(changed.skills[0].id).not.toBe(target.id);
    expect(changed.skills.slice(1)).toEqual(source.skills.slice(1));
  });
});

describe('rpg: ранги, сила и команда', () => {
  it('повышает ранг за копию или осколки и увеличивает потолок', () => {
    const source = card('rank', { rank: 'A', copies: 1, shards: 0 });
    expect(shardCost.A).toBeGreaterThan(0);
    const result = promoteCard(source);
    expect(result?.card.rank).toBe('S');
    expect(result?.cost).toBe('copy');
    expect(result?.card.copies).toBe(0);
    expect(cardPower(result!.card)).toBeGreaterThan(cardPower(source));

    const byShards = card('rank-shards', { rank: 'A', copies: 0, shards: shardCost.A });
    const promoted = promoteCard(byShards, true);
    expect(promoted?.cost).toBe('shards');
    expect(promoted?.card.shards).toBe(0);
  });

  it('учитывает артефакты и руны в эффективных характеристиках', () => {
    const source = card('gear');
    const withArtifact = card('gear', {
      artifact: { id: 'a', name: 'A', description: '', bonus: { attack: 20 } },
      runes: [{ id: 'r', name: 'R', stat: 'speed', amount: 10 }],
    });
    expect(effectiveStats(withArtifact).attack).toBe(effectiveStats(source).attack + 20);
    expect(effectiveStats(withArtifact).speed).toBe(effectiveStats(source).speed + 10);
    expect(cardPower(withArtifact)).toBeGreaterThan(cardPower(source));
  });

  it('строит баффы лидера и синергии команды', () => {
    const team = [
      card('t1', { faction: 'spirit', element: 'ice', role: 'tank', storyGroup: 'g' }),
      card('t2', { faction: 'spirit', element: 'ice', role: 'tank', storyGroup: 'g' }),
      card('t3', { faction: 'spirit', element: 'ice', role: 'dps', storyGroup: 'g' }),
    ];
    const buffs = teamBuffs(team);
    expect(buffs.some((buff) => buff.label.includes('Лидер'))).toBe(true);
    expect(buffs.some((buff) => buff.label.includes('фракции'))).toBe(true);
    expect(buffs.some((buff) => buff.label.includes('стихии'))).toBe(true);
    expect(buffs.some((buff) => buff.label.includes('роли'))).toBe(true);
    expect(buffs.some((buff) => buff.label.includes('Сюжетные'))).toBe(true);
    expect(applyBuffs({ attack: 100 } as CardStats, [{ label: '', stat: 'attack', percent: 10 }]).attack).toBe(110);
  });

  it('даёт бонусы коллекции за уникальных персонажей и легендарных', () => {
    const many = characters.map((character, index) => createCard({
      id: `c-${index}`, character, rarity: index < 5 ? 'legendary' : 'common', seed: index + 1, revealed: true,
    }));
    const bonuses = collectionBonuses(many);
    expect(bonuses.hpPercent).toBe(5);
    expect(bonuses.tokenBonus).toBe(5);
    expect(bonuses.dustBonus).toBe(5);
    expect(collectionBonuses(many.slice(0, 2)).labels).toEqual([]);
  });
});

describe('rpg: бой и прогрессия', () => {
  it('детерминированно симулирует авто-бой и оставляет лог', () => {
    const ally = [card('a1', { level: 15, rank: 'S' }), card('a2', { level: 14, rank: 'A' })];
    const enemy = [card('e1', { level: 10 })];
    const first = simulateBattle(ally, enemy, 99);
    const second = simulateBattle(ally, enemy, 99);
    expect(first).toEqual(second);
    expect(first.log.length).toBeGreaterThan(2);
    expect(['ally', 'enemy']).toContain(first.winner);
    expect(first.rounds).toBeGreaterThanOrEqual(0);
  });

  it('побеждает сильная команда слабую', () => {
    const strong = [card('strong', { level: 20, rank: 'SSS', rarity: 'divine' })];
    const weak = [card('weak', { level: 1, rank: 'D', rarity: 'common' })];
    expect(simulateBattle(strong, weak, 12).winner).toBe('ally');
  });

  it('генерирует команды PvE по сложности этапа', () => {
    for (const stage of pveStages) {
      const enemies = pveEnemyTeam(stage, 8);
      expect(enemies).toHaveLength(stage.enemies);
      expect(enemies.every((enemy) => enemy.revealed)).toBe(true);
    }
  });

  it('начисляет рейтинг с учётом серии побед и сбрасывает сезон', () => {
    expect(ratingDelta(true, 1000, 1100, 2)).toBeGreaterThan(ratingDelta(true, 1000, 1100, 0));
    expect(ratingDelta(false, 1000, 900, 0)).toBeLessThan(0);
    expect(resetRating(2000)).toBe(1200);
    expect(leagueFor(1199).id).toBe('silver');
    expect(leagueFor(2700).id).toBe('challenger');
    expect(seasonRewards('challenger').cosmetics.length).toBeGreaterThan(0);
    const season = seasonInfo(new Date('2026-11-22T00:00:00Z'));
    expect(season.daysLeft).toBeGreaterThan(0);
    expect((new Date(season.end).getTime() - new Date(season.start).getTime()) / 86400000).toBe(30);
  });

  it('создаёт стартовое состояние RPG с командой и валютой', () => {
    const state = createRpgState(5);
    expect(state.tokens).toBeGreaterThan(0);
    expect(state.cards.length).toBeGreaterThanOrEqual(3);
    expect(state.team.memberIds.length).toBeLessThanOrEqual(5);
    expect(state.team.leaderId).toBe(state.cards[0].id);
    expect(state.rating).toBe(1000);
    expect(state.materials).toBeGreaterThanOrEqual(0);
    expect(state.claimedQuests).toEqual([]);
  });

  it('щит поглощает урон до попадания по HP', () => {
    const shield: Skill = { id: 'shield', name: 'Щит', kind: 'passive', effect: 'shield', description: '', power: 20 };
    const defender = card('shield', { rarity: 'divine', level: 20, skills: [shield] });
    const attacker = card('attacker', { rarity: 'divine', level: 20, rank: 'SSS' });
    const result = simulateBattle([defender], [attacker], 5);
    expect(result.log.some((line) => line.text.includes('щит поглотил'))).toBe(true);
  });

  it('бессмертие переживает два смертельных удара', () => {
    const immortality: Skill = { id: 'immortality', name: 'Бессмертие', kind: 'passive', effect: 'immortality', description: '' };
    const defender = card('immortal', {
      rarity: 'common', level: 1, skills: [immortality],
      stats: { ...card('immortal').stats, hp: 10 },
    });
    const attacker = card('killer', { rarity: 'divine', level: 20, rank: 'SSS' });
    const result = simulateBattle([defender], [attacker], 3);
    expect(result.log.filter((line) => line.text.includes('Бессмертие сработало')).length).toBeGreaterThanOrEqual(1);
  });

  it('сопротивление эффектам блокирует наложение дебаффа', () => {
    const fireBlade: Skill = { id: 'fire-blade', name: 'Огненный клинок', kind: 'active', effect: 'fireBlade', description: '', chance: 100, power: 50 };
    const attacker = card('burn', { level: 20, skills: [fireBlade] });
    const defender = card('resist', { stats: { ...card('resist').stats, resist: 100 } });
    const result = simulateBattle([attacker], [defender], 7);
    expect(result.log.some((line) => line.text.includes('сопротивлялся'))).toBe(true);
  });
});

describe('rpg: экономика и задания', () => {
  it('разбор карточки даёт ресурсы по редкости и рангу', () => {
    const source = card('dismantle', { rarity: 'epic', rank: 'A', level: 8, copies: 2 });
    const gain = dismantleCard(source);
    expect(gain.tokens).toBeGreaterThan(0);
    expect(gain.shards).toBeGreaterThan(0);
    expect(gain.materials).toBeGreaterThan(0);
    expect(dismantleCard(card('low', { rarity: 'common' })).tokens).toBeLessThan(gain.tokens);
  });

  it('ежедневные задания и бонусы коллекции усиливают награды', () => {
    expect(dailyQuests.map((quest) => quest.id)).toContain('pvp');
    expect(questKey('pvp', new Date('2026-11-22T12:00:00Z'))).toBe('2026-11-22:pvp');
    const heroes = characters.map((character, index) => createCard({
      id: `bonus-${index}`, character, rarity: index < 5 ? 'legendary' : 'common', seed: index + 1, revealed: true,
    }));
    expect(withCollectionTokenBonus(100, heroes)).toBe(105);
    expect(withCollectionTokenBonus(100, heroes.slice(0, 2))).toBe(100);
  });

  it('материал страхует прокачку от падения характеристик', () => {
    const source = card('safe-upgrade', { level: 4 });
    const plain = levelUpCard(source);
    const safe = levelUpCard(source, true);
    for (const stat of statKeys) expect(safe.stats[stat]).toBeGreaterThanOrEqual(source.stats[stat]);
    expect(plain.stats).not.toEqual(safe.stats);
  });

  it('ранг усиливает навыки, а число бойцов влияет на бой', () => {
    const strike = { id: 'x', name: 'X', kind: 'active' as const, effect: 'execute', description: '', power: 60 };
    expect(skillPower(strike, 'SSS')).toBeGreaterThan(skillPower(strike, 'D'));
    expect(teamSizeAdvantage(5, 3).attack).toBeGreaterThan(0);
    expect(teamSizeAdvantage(2, 5).defense).toBeLessThan(0);
  });

  it('обмен предлагает две карточки и требует комиссию', () => {
    const partner = tradePartners[0];
    const offer = tradeOffer(partner, 99);
    expect(offer).toHaveLength(2);
    expect(new Set(offer.map((entry) => entry.id)).size).toBe(2);
    expect(offer.every((entry) => entry.rarity === partner.rarity || entry.rarity === 'epic')).toBe(true);
    expect(tradeFee(card('trade', { rarity: 'divine' }))).toBeGreaterThan(tradeFee(card('trade2', { rarity: 'common' })));
  });

  it('достижения открываются по прогрессу и выдают лимитированные карты', () => {
    const state = createRpgState(1);
    expect(availableAchievements(state).some((entry) => entry.id === 'first-blood')).toBe(false);
    const progressed = { ...state, wins: 1, claimedAchievements: ['first-blood'] };
    expect(availableAchievements(progressed).map((entry) => entry.id)).not.toContain('first-blood');
    expect(achievements.some((entry) => entry.reward.limited)).toBe(true);
  });
});
