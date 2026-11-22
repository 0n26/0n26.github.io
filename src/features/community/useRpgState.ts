import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  achievements, artifacts, availableAchievements, cardPower, characters,
  confirmLevelCard, createCard, createRpgState, dailyQuests, demoOpponents,
  dismantleCard, effectiveStats, findOpponent, hashString, leagueFor, levelCost,
  levelUpCard, pveEnemyTeam, promoteCard, questKey, ratingDelta, rerollLevelCard,
  rerollSkill, revealCard, rollPackChoices, runePool, seasonInfo, simulateBattle,
  teamBuffs, tradeFee, tradeOffer, tradePartners, characterFromCard,
  rarityFromLegacyRank, revealCost, resetRating, seasonRewards, shardCost,
  withCollectionTokenBonus,
} from './rpg';
import type { PveStage, RpgCard, RpgState } from './rpg';
import type { UserProfile } from './types';

const storageKey = (handle: string) => `night-session:rpg:${handle}`;

export interface RpgActionResult {
  ok: boolean;
  message: string;
}

function fail(message: string): RpgActionResult {
  return { ok: false, message };
}

function done(message: string): RpgActionResult {
  return { ok: true, message };
}

function readState(handle: string, profile: UserProfile): RpgState {
  try {
    const raw = localStorage.getItem(storageKey(handle));
    if (raw) {
      const parsed = JSON.parse(raw) as RpgState;
      if (Array.isArray(parsed.cards) && parsed.team && typeof parsed.tokens === 'number') {
        return {
          ...parsed,
          materials: parsed.materials ?? 0,
          claimedQuests: parsed.claimedQuests ?? [],
          claimedAchievements: parsed.claimedAchievements ?? [],
          seasonClaimed: parsed.seasonClaimed ?? 0,
        };
      }
    }
  } catch {
    // Битый или недоступный storage — начинаем с демо-колоды.
  }

  const seed = hashString(handle) || 1;
  const starting = profile.cards.slice(0, 3).map((card, index) => createCard({
    id: `rpg-${card.id}`,
    character: characterFromCard(card),
    rarity: rarityFromLegacyRank(card.rank),
    seed: hashString(card.id) + index,
    level: index < 2 ? 3 : 1,
    revealed: index < 2,
  }));
  return createRpgState(seed, starting);
}

/** Локальная RPG-прогрессия профиля: Token, раскрытие, уровни, отряд и бои. */
export function useRpgState(handle: string, profile: UserProfile) {
  const [state, setState] = useState<RpgState>(() => readState(handle, profile));
  const stateRef = useRef(state);
  const loadedHandle = useRef(handle);

  const commit = useCallback((updater: (current: RpgState) => RpgState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (loadedHandle.current !== handle) {
      loadedHandle.current = handle;
      const next = readState(handle, profile);
      stateRef.current = next;
      setState(next);
      return;
    }
    stateRef.current = state;
    try {
      localStorage.setItem(storageKey(handle), JSON.stringify(state));
    } catch {
      // Приватный режим: прогресс живёт до перезагрузки страницы.
    }
  }, [handle, profile, state]);

  const patchCard = useCallback((cardId: string, update: (card: RpgCard) => RpgCard) => {
    commit((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === cardId ? update(card) : card)),
    }));
  }, [commit]);

  const addCard = useCallback((incoming: RpgCard): RpgActionResult => {
    commit((current) => {
      const existing = current.cards.find((card) => card.id === incoming.id);
      const cards = existing
        ? current.cards.map((card) => card.id === incoming.id ? { ...card, copies: card.copies + 1 } : card)
        : [...current.cards, incoming];
      const memberIds = current.team.memberIds.length < 5 && !current.team.memberIds.includes(incoming.id)
        ? [...current.team.memberIds, incoming.id]
        : current.team.memberIds;
      return {
        ...current,
        cards,
        team: { ...current.team, memberIds, leaderId: current.team.leaderId || cards[0]?.id || '' },
      };
    });
    return done(`Карточка «${incoming.name}» добавлена в RPG-коллекцию.`);
  }, [commit]);

  const reveal = useCallback((cardId: string): RpgActionResult => {
    const current = stateRef.current;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card || card.revealed) return fail('Характеристики уже раскрыты.');
    const cost = revealCost[card.rarity];
    if (current.tokens < cost) return fail(`Нужно ${cost} Token для раскрытия.`);
    commit((value) => ({
      ...value,
      tokens: value.tokens - cost,
      cards: value.cards.map((entry) => entry.id === cardId ? revealCard(entry) : entry),
    }));
    return done(`Характеристики «${card.name}» раскрыты · −${cost} Token`);
  }, [commit]);

  const levelUp = useCallback((cardId: string, useMaterial = false): RpgActionResult => {
    const current = stateRef.current;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card) return fail('Карточка не найдена.');
    if (card.level >= 20) return fail('Достигнут максимальный 20 уровень.');
    if (card.pending) return fail('Сначала выберите: оставить результат или перегенерировать.');
    if (useMaterial && current.materials < 1) return fail('Нет материалов улучшения.');
    const cost = levelCost(card.level);
    if (current.tokens < cost) return fail(`Нужно ${cost} Token для улучшения.`);
    commit((value) => ({
      ...value,
      tokens: value.tokens - cost,
      materials: value.materials - (useMaterial ? 1 : 0),
      cards: value.cards.map((entry) => entry.id === cardId ? levelUpCard(entry, useMaterial) : entry),
    }));
    return done(`Уровень повышен до ${card.level + 1} · −${cost} Token${useMaterial ? ' · −1 материал' : ''}`);
  }, [commit]);

  const rerollLevel = useCallback((cardId: string): RpgActionResult => {
    const current = stateRef.current;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card?.pending) return fail('Нет результата для перегенерации.');
    if (current.rerollItems < 1) return fail('Нет предметов перегенерации.');
    commit((value) => ({
      ...value,
      rerollItems: value.rerollItems - 1,
      cards: value.cards.map((entry) => entry.id === cardId ? rerollLevelCard(entry) : entry),
    }));
    return done('Характеристики перегенерированы · −1 предмет');
  }, [commit]);

  const confirmLevel = useCallback((cardId: string) => {
    patchCard(cardId, confirmLevelCard);
  }, [patchCard]);

  const promote = useCallback((cardId: string, useShards = false): RpgActionResult => {
    const current = stateRef.current;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card) return fail('Карточка не найдена.');
    const prepared = useShards ? { ...card, shards: current.shards } : card;
    const result = promoteCard(prepared, useShards);
    if (!result) return fail(`Нужна копия или ${shardCost[card.rank]} осколков.`);
    commit((value) => ({
      ...value,
      shards: useShards ? result.card.shards : value.shards,
      cards: value.cards.map((entry) => entry.id === cardId ? { ...result.card, shards: 0 } : entry),
    }));
    return done(`Ранг повышен до ${result.card.rank}.`);
  }, [commit]);

  const changeSkill = useCallback((cardId: string, skillId: string): RpgActionResult => {
    const current = stateRef.current;
    if (current.skillResetItems < 1) return fail('Нет предметов смены навыка.');
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card?.skills.some((skill) => skill.id === skillId)) return fail('Навык не найден.');
    commit((value) => ({
      ...value,
      skillResetItems: value.skillResetItems - 1,
      cards: value.cards.map((entry) => entry.id === cardId ? rerollSkill(entry, skillId) : entry),
    }));
    return done('Навык заменён · −1 предмет');
  }, [commit]);

  const equipArtifact = useCallback((cardId: string, artifactId: string | null) => {
    const artifact = artifacts.find((entry) => entry.id === artifactId);
    patchCard(cardId, (card) => ({ ...card, artifact: artifactId === null ? undefined : artifact }));
  }, [patchCard]);

  const addRune = useCallback((cardId: string, runeId: string): RpgActionResult => {
    const rune = runePool.find((entry) => entry.id === runeId);
    if (!rune) return fail('Руна не найдена.');
    patchCard(cardId, (card) => ({ ...card, runes: [...card.runes.slice(-1), rune] }));
    return done(`Руна «${rune.name}» установлена.`);
  }, [patchCard]);

  const rerollRune = useCallback((cardId: string): RpgActionResult => {
    const current = stateRef.current;
    if (current.shards < 1) return fail('Нужно минимум 1 осколок.');
    commit((value) => ({
      ...value,
      shards: value.shards - 1,
      cards: value.cards.map((card) => {
        if (card.id !== cardId || card.runes.length === 0) return card;
        const index = (hashString(cardId) + value.shards) % runePool.length;
        return { ...card, runes: [runePool[index]] };
      }),
    }));
    return done('Руна перегенерирована · −1 осколок');
  }, [commit]);

  const setTeam = useCallback((leaderId: string, memberIds: string[]) => {
    commit((current) => {
      const valid = memberIds.filter((id) => current.cards.some((card) => card.id === id)).slice(0, 5);
      const leader = valid.includes(leaderId) ? leaderId : valid[0] ?? '';
      return { ...current, team: { leaderId: leader, memberIds: valid } };
    });
  }, [commit]);

  const battlePvp = useCallback((opponentName?: string, opponentRating?: number) => {
    const current = stateRef.current;
    const teamCards = current.team.memberIds
      .map((id) => current.cards.find((card) => card.id === id))
      .filter((card): card is RpgCard => Boolean(card));
    const opponent = findOpponent(
      current.rating,
      demoOpponents as readonly { name: string; rating: number }[],
      hashString(`${handle}-${current.wins}-${current.losses}`),
    ) ?? { name: opponentName ?? 'Случайный соперник', rating: opponentRating ?? current.rating };
    const enemyTeam = characters.slice(0, Math.max(1, teamCards.length)).map((character, index) => createCard({
      id: `pvp-${opponent.name}-${index}`,
      character,
      rarity: index % 3 === 0 ? 'epic' : 'rare',
      seed: hashString(opponent.name) + index * 71,
      level: Math.min(20, 4 + Math.floor(current.rating / 120) + index),
      revealed: true,
    }));
    const seed = hashString(`${opponent.name}-${current.rating}-${current.wins}-${current.losses}`);
    const result = simulateBattle(teamCards, enemyTeam, seed);
    const win = result.winner === 'ally';
    const nextStreak = win ? current.streak + 1 : 0;
    const delta = ratingDelta(win, current.rating, opponent.rating, nextStreak);
    commit((value) => ({
      ...value,
      rating: Math.max(0, value.rating + delta),
      wins: value.wins + (win ? 1 : 0),
      losses: value.losses + (win ? 0 : 1),
      streak: nextStreak,
      tokens: value.tokens + withCollectionTokenBonus(win ? 45 + Math.round(value.rating / 100) : 12, value.cards),
      history: [{
        id: `pvp-${Date.now()}`, type: 'pvp',
        title: `${win ? 'Победа' : 'Поражение'} против ${opponent.name}`,
        detail: `${delta > 0 ? '+' : ''}${delta} рейтинга · ${win ? 'награда Token' : 'утешение Token'}`,
        at: new Date().toISOString(),
      }, ...value.history].slice(0, 30),
    }));
    return { result, opponent, delta };
  }, [commit, handle]);

  const battlePve = useCallback((stage: PveStage) => {
    const current = stateRef.current;
    const teamCards = current.team.memberIds
      .map((id) => current.cards.find((card) => card.id === id))
      .filter((card): card is RpgCard => Boolean(card));
    const enemies = pveEnemyTeam(stage, hashString(stage.id) + current.wins * 13);
    const result = simulateBattle(teamCards, enemies, hashString(`${stage.id}-${current.losses}`));
    const win = result.winner === 'ally';
    const index = (current.wins + current.losses) % characters.length;
    const rewardCard = win ? createCard({
      id: `pve-${stage.id}-${Date.now().toString(36)}`,
      character: characters[index],
      rarity: stage.reward.rarity,
      seed: hashString(stage.id) + Date.now(),
    }) : null;
    commit((value) => {
      return {
        ...value,
        tokens: value.tokens + withCollectionTokenBonus(win ? stage.reward.tokens : 8, value.cards),
        shards: value.shards + (win ? stage.reward.shards : 0),
        pveProgress: { ...value.pveProgress, [stage.id]: Math.max(value.pveProgress[stage.id] ?? 0, win ? stage.difficulty : 0) },
        cards: rewardCard ? [...value.cards, rewardCard] : value.cards,
        history: [{
          id: `pve-${Date.now()}`, type: 'pve',
          title: `${win ? 'Пройдено' : 'Не пройдено'}: ${stage.name}`,
          detail: rewardCard ? `Награда: карточка ${rewardCard.rarity} · +${stage.reward.tokens} Token` : `+${win ? stage.reward.tokens : 8} Token`,
          at: new Date().toISOString(),
        }, ...value.history].slice(0, 30),
      };
    });
    return { result, rewardCard };
  }, [commit]);

  const buyPackChoices = useCallback((seed: number) => rollPackChoices(seed), []);

  const dismantle = useCallback((cardId: string): RpgActionResult => {
    const current = stateRef.current;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card) return fail('Карточка не найдена.');
    if (current.cards.length <= 1) return fail('Нельзя разобрать последнюю карточку.');
    const gain = dismantleCard(card);
    commit((value) => ({
      ...value,
      tokens: value.tokens + gain.tokens,
      shards: value.shards + gain.shards,
      materials: value.materials + gain.materials,
      cards: value.cards.filter((entry) => entry.id !== cardId),
      team: {
        leaderId: value.team.leaderId === cardId ? '' : value.team.leaderId,
        memberIds: value.team.memberIds.filter((id) => id !== cardId),
      },
      history: [{
        id: `dismantle-${Date.now()}`, type: 'dismantle',
        title: `Разбор: ${card.name}`,
        detail: `+${gain.tokens} Token · +${gain.shards} осколков · +${gain.materials} материалов`,
        at: new Date().toISOString(),
      }, ...value.history].slice(0, 30),
    }));
    return done(`Разобрано: +${gain.tokens} Token, +${gain.shards} осколков, +${gain.materials} материалов.`);
  }, [commit]);

  const claimQuest = useCallback((questId: string): RpgActionResult => {
    const current = stateRef.current;
    const quest = dailyQuests.find((entry) => entry.id === questId);
    if (!quest) return fail('Задание не найдено.');
    const key = questKey(questId);
    if (current.claimedQuests.includes(key)) return fail('Награда уже получена.');
    if (questId !== 'login') {
      const today = key.slice(0, 10);
      const played = current.history.some((entry) => entry.type === questId && entry.at.startsWith(today));
      if (!played) return fail(quest.description);
    }
    commit((value) => ({
      ...value,
      tokens: value.tokens + withCollectionTokenBonus(quest.reward.tokens, value.cards),
      shards: value.shards + quest.reward.shards,
      rerollItems: value.rerollItems + (quest.reward.rerollItems ?? 0),
      skillResetItems: value.skillResetItems + (quest.reward.skillResetItems ?? 0),
      claimedQuests: [...value.claimedQuests, key],
      history: [{
        id: `quest-${Date.now()}`, type: 'quest', title: `Выполнено: ${quest.title}`,
        detail: `+${quest.reward.tokens} Token`, at: new Date().toISOString(),
      }, ...value.history].slice(0, 30),
    }));
    return done(`Награда получена: +${quest.reward.tokens} Token.`);
  }, [commit]);

  const claimSeason = useCallback((): RpgActionResult => {
    const current = stateRef.current;
    const season = seasonInfo();
    if (current.seasonClaimed >= season.index) return fail('Награда текущего сезона уже получена.');
    const reward = seasonRewards(leagueFor(current.rating).id);
    commit((value) => ({
      ...value,
      tokens: value.tokens + reward.tokens,
      shards: value.shards + reward.shards,
      rating: resetRating(value.rating),
      seasonClaimed: season.index,
      streak: 0,
      history: [{
        id: `season-${Date.now()}`, type: 'season', title: 'Награда сезона',
        detail: `+${reward.tokens} Token · +${reward.shards} осколков · рейтинг сброшен до ${resetRating(value.rating)}`,
        at: new Date().toISOString(),
      }, ...value.history].slice(0, 30),
    }));
    return done(`Сезон завершён: +${reward.tokens} Token, +${reward.shards} осколков. Рейтинг сброшен до ${resetRating(current.rating)}.`);
  }, [commit]);

  const partnerOffers = useMemo(() => Object.fromEntries(tradePartners.map((partner) => [
    partner.id,
    tradeOffer(partner, hashString(`${handle}-${partner.id}-${state.wins + state.losses}`)),
  ])), [handle, state.wins, state.losses]);

  const offerFor = useCallback((partnerId: string): RpgCard[] => partnerOffers[partnerId] ?? [], [partnerOffers]);

  const tradeCard = useCallback((cardId: string, partnerId: string, takeId: string): RpgActionResult => {
    const current = stateRef.current;
    const partner = tradePartners.find((entry) => entry.id === partnerId);
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!partner || !card) return fail('Предложение или карточка не найдены.');
    const offer = tradeOffer(partner, hashString(`${handle}-${partnerId}-${current.wins + current.losses}`));
    const incoming = offer.find((entry) => entry.id === takeId);
    if (!incoming) return fail('Выберите карточку из предложения.');
    if (current.cards.length <= 1) return fail('Нельзя отдать последнюю карточку.');
    const fee = tradeFee(card);
    if (current.tokens < fee) return fail(`Нужно ${fee} Token для обмена.`);
    if (current.cards.some((entry) => entry.id === incoming.id)) return fail('Эта карточка уже у вас есть.');
    commit((value) => {
      const cards = value.cards.filter((entry) => entry.id !== cardId).concat(incoming);
      return {
        ...value,
        tokens: value.tokens - fee,
        cards,
        team: {
          leaderId: value.team.leaderId === cardId ? cards[0]?.id ?? '' : value.team.leaderId,
          memberIds: value.team.memberIds.map((id) => id === cardId ? incoming.id : id),
        },
        history: [{
          id: `trade-${Date.now()}`, type: 'trade',
          title: `Обмен с ${partner.name}`,
          detail: `Отдана ${card.name} → получена ${incoming.name} · −${fee} Token`,
          at: new Date().toISOString(),
        }, ...value.history].slice(0, 30),
      };
    });
    return done(`Обмен состоялся: «${incoming.name}» · −${fee} Token`);
  }, [commit, handle]);

  const claimAchievement = useCallback((achievementId: string): RpgActionResult => {
    const current = stateRef.current;
    const achievement = achievements.find((entry) => entry.id === achievementId);
    if (!achievement) return fail('Достижение не найдено.');
    if (current.claimedAchievements.includes(achievementId)) return fail('Награда уже получена.');
    if (!availableAchievements(current).some((entry) => entry.id === achievementId)) return fail(achievement.description);
    const limitedCard = achievement.reward.limited ? createCard({
      id: `achievement-${achievementId}-${Date.now().toString(36)}`,
      character: characters[(current.cards.length + achievements.indexOf(achievement)) % characters.length],
      rarity: 'mythic',
      seed: hashString(achievementId) + Date.now(),
      revealed: true,
      limited: true,
    }) : null;
    commit((value) => ({
      ...value,
      tokens: value.tokens + achievement.reward.tokens,
      shards: value.shards + achievement.reward.shards,
      rerollItems: value.rerollItems + (achievement.reward.rerollItems ?? 0),
      skillResetItems: value.skillResetItems + (achievement.reward.skillResetItems ?? 0),
      cards: limitedCard ? [...value.cards, limitedCard] : value.cards,
      claimedAchievements: [...value.claimedAchievements, achievementId],
      history: [{
        id: `achievement-${Date.now()}`, type: 'achievement',
        title: `Достижение: ${achievement.title}`,
        detail: limitedCard ? `Лимитированная карточка ${limitedCard.name}` : `+${achievement.reward.tokens} Token`,
        at: new Date().toISOString(),
      }, ...value.history].slice(0, 30),
    }));
    return done(limitedCard ? `Получена лимитированная карточка «${limitedCard.name}»!` : `Награда получена: +${achievement.reward.tokens} Token.`);
  }, [commit]);

  const reset = useCallback(() => {
    const next = createRpgState(hashString(handle) || 1);
    stateRef.current = next;
    setState(next);
  }, [handle]);

  const teamCards = useMemo(() => state.team.memberIds
    .map((id) => state.cards.find((card) => card.id === id))
    .filter((card): card is RpgCard => Boolean(card)), [state.cards, state.team.memberIds]);

  const teamPower = useMemo(() => teamCards.reduce((sum, card) => sum + cardPower(card), 0), [teamCards]);
  const buffs = useMemo(() => teamBuffs(teamCards), [teamCards]);
  const season = useMemo(() => seasonInfo(), []);
  const unlockedAchievements = useMemo(() => availableAchievements(state), [state]);

  return {
    state, cards: state.cards, teamCards, teamPower, buffs, season,
    reveal, levelUp, rerollLevel, confirmLevel, promote, changeSkill,
    equipArtifact, addRune, rerollRune, setTeam, addCard, dismantle,
    claimQuest, claimSeason, claimAchievement, offerFor, tradeCard,
    battlePvp, battlePve, buyPackChoices, reset,
    unlockedAchievements,
    stats: (card: RpgCard) => effectiveStats(card),
  };
}
