/**
 * Чистая игровая логика карточной RPG.
 *
 * Модуль не знает о React, localStorage и текущей модели каталога: он получает
 * персонажей и сиды, а возвращает Cards/баттл-результаты. Всё случайное здесь
 * детерминировано, поэтому механики можно тестировать и воспроизводить.
 */

export const rpgRarities = ['common', 'rare', 'epic', 'legendary', 'mythic', 'divine'] as const;
export type Rarity = typeof rpgRarities[number];

export const rarityNames: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  divine: 'Divine',
};

export const rpgRanks = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export type RpgRank = typeof rpgRanks[number];

export const statKeys = ['attack', 'hp', 'defense', 'speed', 'crit', 'pierce', 'dodge', 'resist'] as const;
export type StatKey = typeof statKeys[number];

export const statNames: Record<StatKey, string> = {
  attack: 'Атака',
  hp: 'HP',
  defense: 'Защита',
  speed: 'Скорость',
  crit: 'Крит',
  pierce: 'Пробитие',
  dodge: 'Уклонение',
  resist: 'Сопр. эффектам',
};

export type CardStats = Record<StatKey, number>;
export type Role = 'tank' | 'dps' | 'support' | 'speed';
export type Faction = 'school' | 'night' | 'spirit' | 'tech';
export type Element = 'fire' | 'ice' | 'lightning' | 'wind' | 'light' | 'dark';

export interface Character {
  id: string;
  name: string;
  image?: string;
  faction: Faction;
  element: Element;
  role: Role;
  storyGroup?: string;
}

export interface Skill {
  id: string;
  name: string;
  kind: 'active' | 'passive' | 'ultimate';
  effect: string;
  description: string;
  chance?: number;
  power?: number;
  cooldown?: number;
}

export interface Artifact {
  id: string;
  name: string;
  bonus: Partial<CardStats>;
  description: string;
}

export interface Rune {
  id: string;
  name: string;
  stat: StatKey;
  amount: number;
  percent?: boolean;
}

export interface RpgCard {
  id: string;
  characterId: string;
  name: string;
  image?: string;
  rarity: Rarity;
  rank: RpgRank;
  level: number;
  revealed: boolean;
  stats: CardStats;
  /** Промежуточный результат улучшения: игрок выбирает оставить его или рероллить. */
  pending?: { before: CardStats; level: number; variant: number };
  skills: Skill[];
  copies: number;
  shards: number;
  seed: number;
  skillSeed: number;
  artifact?: Artifact;
  runes: Rune[];
  /** Лимитированная карточка за достижение или событие. */
  limited?: boolean;
  faction: Faction;
  element: Element;
  role: Role;
  storyGroup?: string;
}

export interface TeamBuff {
  label: string;
  stat: StatKey;
  percent: number;
}

export interface BattleLogLine {
  round: number;
  text: string;
}

export interface BattleResult {
  winner: 'ally' | 'enemy';
  rounds: number;
  log: BattleLogLine[];
  allyHp: number;
  enemyHp: number;
}

export interface RpgState {
  tokens: number;
  shards: number;
  materials: number;
  rerollItems: number;
  skillResetItems: number;
  claimedQuests: string[];
  claimedAchievements: string[];
  seasonClaimed: number;
  cards: RpgCard[];
  team: { leaderId: string; memberIds: string[] };
  rating: number;
  wins: number;
  losses: number;
  streak: number;
  seasonIndex: number;
  pveProgress: Record<string, number>;
  history: { id: string; type: string; title: string; detail: string; at: string }[];
}

const ranges: Record<Rarity, Record<StatKey, readonly [number, number]>> = {
  common: {
    attack: [60, 110], hp: [700, 1100], defense: [20, 45], speed: [40, 70],
    crit: [5, 12], pierce: [0, 5], dodge: [0, 5], resist: [0, 8],
  },
  rare: {
    attack: [90, 150], hp: [1000, 1500], defense: [35, 65], speed: [55, 85],
    crit: [8, 16], pierce: [2, 8], dodge: [2, 8], resist: [3, 12],
  },
  epic: {
    attack: [130, 210], hp: [1400, 2100], defense: [55, 95], speed: [70, 105],
    crit: [12, 22], pierce: [6, 12], dodge: [5, 12], resist: [8, 17],
  },
  legendary: {
    attack: [180, 300], hp: [2000, 3000], defense: [80, 135], speed: [90, 130],
    crit: [16, 27], pierce: [10, 17], dodge: [9, 16], resist: [13, 22],
  },
  mythic: {
    attack: [250, 400], hp: [2800, 4000], defense: [120, 190], speed: [115, 160],
    crit: [21, 32], pierce: [15, 23], dodge: [13, 21], resist: [19, 28],
  },
  divine: {
    attack: [340, 550], hp: [3800, 5500], defense: [170, 260], speed: [145, 200],
    crit: [26, 38], pierce: [21, 30], dodge: [18, 27], resist: [26, 35],
  },
};

const rankMultipliers: Record<RpgRank, number> = {
  D: 1, C: 1.09, B: 1.2, A: 1.34, S: 1.52, SS: 1.74, SSS: 2,
};

export const revealCost: Record<Rarity, number> = {
  common: 20, rare: 35, epic: 60, legendary: 100, mythic: 160, divine: 250,
};

export const shardCost: Record<RpgRank, number> = {
  D: 5, C: 8, B: 12, A: 18, S: 25, SS: 35, SSS: 0,
};

export const skillUnlockLevels = [5, 10, 15, 20] as const;

export const skillPools: Record<'active' | 'passive' | 'ultimate', readonly Skill[]> = {
  active: [
    { id: 'double-strike', name: 'Двойной удар', kind: 'active', effect: 'doubleStrike', description: 'С шансом 30% повторяет атаку.', chance: 30 },
    { id: 'triple-strike', name: 'Тройной удар', kind: 'active', effect: 'tripleStrike', description: 'Атакует три раза подряд.', chance: 20 },
    { id: 'execute', name: 'Казнь', kind: 'active', effect: 'execute', description: 'Если HP цели ниже 25%, урон увеличен на 60%.', power: 60 },
    { id: 'fire-blade', name: 'Огненный клинок', kind: 'active', effect: 'fireBlade', description: 'Горение 3 хода.', chance: 35, power: 18 },
    { id: 'ice-strike', name: 'Ледяной удар', kind: 'active', effect: 'iceStrike', description: 'Скорость цели −30%.', chance: 30, power: 30 },
    { id: 'chain-lightning', name: 'Электроразряд', kind: 'active', effect: 'chainLightning', description: 'Поражает до трёх противников.', chance: 25, power: 55 },
    { id: 'poison', name: 'Ядовитое оружие', kind: 'active', effect: 'poison', description: 'Процентный урон каждый ход.', chance: 40, power: 8 },
    { id: 'armor-break', name: 'Разлом брони', kind: 'active', effect: 'armorBreak', description: 'Защита цели снижается.', chance: 35, power: 25 },
  ],
  passive: [
    { id: 'vampirism', name: 'Вампиризм', kind: 'passive', effect: 'vampirism', description: 'Восстанавливает часть урона.', power: 15 },
    { id: 'immortality', name: 'Бессмертие', kind: 'passive', effect: 'immortality', description: 'Переживает два смертельных удара один раз за бой.' },
    { id: 'berserk', name: 'Берсерк', kind: 'passive', effect: 'berserk', description: 'При HP ниже 30% атака +40%.', power: 40 },
    { id: 'counter', name: 'Контратака', kind: 'passive', effect: 'counter', description: 'Шанс немедленно ответить на урон.', chance: 25 },
    { id: 'iron-skin', name: 'Железная кожа', kind: 'passive', effect: 'ironSkin', description: 'Физический урон −20%.', power: 20 },
    { id: 'magic-barrier', name: 'Магический барьер', kind: 'passive', effect: 'magicBarrier', description: 'Магический урон −25%.', power: 25 },
    { id: 'second-wind', name: 'Второе дыхание', kind: 'passive', effect: 'secondWind', description: 'Один раз восстанавливает 30% HP.', power: 30 },
    { id: 'evasion', name: 'Неуловимость', kind: 'passive', effect: 'evasion', description: 'Шанс уклонения увеличен.', power: 8 },
    { id: 'battle-spirit', name: 'Боевой дух', kind: 'passive', effect: 'battleSpirit', description: 'После смерти союзника атака +20%.', power: 20 },
    { id: 'hunter', name: 'Охотник', kind: 'passive', effect: 'hunter', description: 'Каждое убийство увеличивает урон на 10%.', power: 10 },
    { id: 'shield', name: 'Энергетический щит', kind: 'passive', effect: 'shield', description: 'В начале боя поглощает 20% максимального HP.', power: 20 },
  ],
  ultimate: [
    { id: 'dragon', name: 'Призыв дракона', kind: 'ultimate', effect: 'dragon', description: 'Огромный урон по всем врагам.', power: 180, cooldown: 5 },
    { id: 'meteor', name: 'Метеоритный дождь', kind: 'ultimate', effect: 'meteor', description: 'Массовый урон по врагам.', power: 150, cooldown: 5 },
    { id: 'black-hole', name: 'Чёрная дыра', kind: 'ultimate', effect: 'blackHole', description: 'Урон и снижение защиты.', power: 130, cooldown: 6 },
    { id: 'mass-heal', name: 'Массовое исцеление', kind: 'ultimate', effect: 'massHeal', description: 'Лечит всю команду.', power: 35, cooldown: 5 },
    { id: 'cleanse', name: 'Полное очищение', kind: 'ultimate', effect: 'cleanse', description: 'Снимает эффекты команды.', cooldown: 4 },
    { id: 'revive', name: 'Воскрешение', kind: 'ultimate', effect: 'revive', description: 'Возвращает союзника в бой.', power: 40, cooldown: 6 },
    { id: 'invulnerability', name: 'Неуязвимость', kind: 'ultimate', effect: 'invulnerability', description: 'Команда не получает урон 1 ход.', cooldown: 6 },
    { id: 'global-slow', name: 'Глобальное замедление', kind: 'ultimate', effect: 'globalSlow', description: 'Скорость врагов −30%.', power: 30, cooldown: 5 },
  ],
};

export const artifacts: readonly Artifact[] = [
  { id: 'art-blade', name: 'Клинок рассвета', bonus: { attack: 24, crit: 3 }, description: '+24 атаки, +3% крита' },
  { id: 'art-heart', name: 'Сердце стража', bonus: { hp: 320, defense: 12 }, description: '+320 HP, +12 защиты' },
  { id: 'art-boots', name: 'Сапоги ветра', bonus: { speed: 14, dodge: 3 }, description: '+14 скорости, +3% уклонения' },
  { id: 'art-eye', name: 'Глаз бездны', bonus: { pierce: 5, resist: 5 }, description: '+5% пробития, +5% сопротивления' },
];

export const runePool: readonly Rune[] = [
  { id: 'rune-attack', name: 'Руна атаки', stat: 'attack', amount: 18 },
  { id: 'rune-hp', name: 'Руна жизни', stat: 'hp', amount: 240 },
  { id: 'rune-speed', name: 'Руна скорости', stat: 'speed', amount: 10 },
  { id: 'rune-crit', name: 'Руна критического удара', stat: 'crit', amount: 2 },
  { id: 'rune-defense', name: 'Руна защиты', stat: 'defense', amount: 10 },
];

export const characters: readonly Character[] = [
  { id: 'astra', name: 'Астра', faction: 'night', element: 'dark', role: 'dps', storyGroup: 'небесный дозор' },
  { id: 'rin', name: 'Рин', faction: 'school', element: 'light', role: 'support', storyGroup: 'небесный дозор' },
  { id: 'kuro', name: 'Куро', faction: 'night', element: 'fire', role: 'tank', storyGroup: 'ночной патруль' },
  { id: 'mika', name: 'Мика', faction: 'tech', element: 'lightning', role: 'speed', storyGroup: 'лаборатория' },
  { id: 'yuki', name: 'Юки', faction: 'spirit', element: 'ice', role: 'support', storyGroup: 'духи леса' },
  { id: 'rei', name: 'Рэй', faction: 'school', element: 'wind', role: 'speed', storyGroup: 'школьный клуб' },
  { id: 'noa', name: 'Ноа', faction: 'tech', element: 'light', role: 'tank', storyGroup: 'лаборатория' },
  { id: 'setsu', name: 'Сэцу', faction: 'spirit', element: 'ice', role: 'dps', storyGroup: 'духи леса' },
  { id: 'akira', name: 'Акира', faction: 'night', element: 'dark', role: 'speed', storyGroup: 'ночной патруль' },
  { id: 'luna', name: 'Луна', faction: 'spirit', element: 'light', role: 'support', storyGroup: 'духи леса' },
  { id: 'volk', name: 'Волк', faction: 'school', element: 'fire', role: 'tank', storyGroup: 'школьный клуб' },
  { id: 'echo', name: 'Эхо', faction: 'tech', element: 'lightning', role: 'dps', storyGroup: 'лаборатория' },
];

export const demoOpponents = [
  { name: 'Теневой Кот', rating: 940 },
  { name: 'Лунатик', rating: 1040 },
  { name: 'Полночный Эхо', rating: 1110 },
  { name: 'Астральный Вихрь', rating: 1230 },
  { name: 'Стальной Клин', rating: 1320 },
  { name: 'Тихий Шторм', rating: 1450 },
] as const;

export const leagues = [
  { id: 'bronze', name: 'Bronze', min: 0 },
  { id: 'silver', name: 'Silver', min: 1000 },
  { id: 'gold', name: 'Gold', min: 1200 },
  { id: 'platinum', name: 'Platinum', min: 1500 },
  { id: 'diamond', name: 'Diamond', min: 1800 },
  { id: 'master', name: 'Master', min: 2100 },
  { id: 'grandmaster', name: 'Grandmaster', min: 2400 },
  { id: 'challenger', name: 'Challenger', min: 2700 },
] as const;

export type LeagueId = typeof leagues[number]['id'];

export interface PveStage {
  id: string;
  name: string;
  mode: 'story' | 'tower' | 'boss' | 'daily' | 'raid' | 'event';
  description: string;
  difficulty: number;
  reward: { tokens: number; shards: number; rarity: Rarity };
  enemies: number;
}

export const pveStages: readonly PveStage[] = [
  { id: 'story-1', name: 'Глава 1 · Первый сигнал', mode: 'story', description: 'Сюжетное испытание для новой команды.', difficulty: 1, reward: { tokens: 60, shards: 2, rarity: 'rare' }, enemies: 3 },
  { id: 'tower-1', name: 'Башня · Этаж 12', mode: 'tower', description: 'Поднимитесь выше, усилив отряд.', difficulty: 2, reward: { tokens: 90, shards: 3, rarity: 'epic' }, enemies: 4 },
  { id: 'boss-1', name: 'Мировой босс · Тень', mode: 'boss', description: 'Еженедельный босс с высоким HP.', difficulty: 3, reward: { tokens: 140, shards: 5, rarity: 'legendary' }, enemies: 1 },
  { id: 'daily-1', name: 'Ежедневная тренировка', mode: 'daily', description: 'Быстрый бой за ежедневные Token.', difficulty: 1, reward: { tokens: 35, shards: 1, rarity: 'common' }, enemies: 3 },
  { id: 'raid-1', name: 'Рейд · Осада', mode: 'raid', description: 'Пять волн элитных противников.', difficulty: 4, reward: { tokens: 220, shards: 8, rarity: 'mythic' }, enemies: 5 },
  { id: 'event-1', name: 'Событие · Аврора', mode: 'event', description: 'Временное событие с лимитированной карточкой.', difficulty: 3, reward: { tokens: 160, shards: 6, rarity: 'legendary' }, enemies: 4 },
];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const legacyRanks = ['X', 'S', 'A', 'P', 'G', 'B', 'C', 'D', 'E', 'H', 'N', 'V', 'Q', 'L', 'K', 'W'];

/** Мост от текущих рангов каталога к новым редкостям RPG. */
export function rarityFromLegacyRank(rank: string): Rarity {
  const index = legacyRanks.indexOf(rank);
  if (index < 0) return 'common';
  if (index <= 0) return 'divine';
  if (index <= 2) return 'mythic';
  if (index <= 4) return 'legendary';
  if (index <= 7) return 'epic';
  if (index <= 11) return 'rare';
  return 'common';
}

export function characterFromCard(input: { id: string; title: string; image?: string }): Character {
  const seed = hashString(input.id);
  return {
    id: input.id,
    name: input.title,
    image: input.image,
    faction: (['school', 'night', 'spirit', 'tech'] as const)[seed % 4],
    element: (['fire', 'ice', 'lightning', 'wind', 'light', 'dark'] as const)[(seed >>> 3) % 6],
    role: (['tank', 'dps', 'support', 'speed'] as const)[(seed >>> 6) % 4],
    storyGroup: `серия ${(seed >>> 9) % 5 + 1}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function statRange(rarity: Rarity, stat: StatKey): readonly [number, number] {
  return ranges[rarity][stat];
}

export function rankMultiplier(rank: RpgRank): number {
  return rankMultipliers[rank];
}

export function rarityIndex(rarity: Rarity): number {
  return rpgRarities.indexOf(rarity);
}

export function rankIndex(rank: RpgRank): number {
  return rpgRanks.indexOf(rank);
}

export function rollStats(rarity: Rarity, seed: number): CardStats {
  const random = mulberry32(seed);
  const result = {} as CardStats;
  for (const stat of statKeys) {
    const [min, max] = ranges[rarity][stat];
    result[stat] = Math.round(min + random() * (max - min));
  }
  return result;
}

function rollSkill(kind: 'active' | 'passive' | 'ultimate', seed: number, used: string[]): Skill {
  const pool = skillPools[kind];
  let index = Math.abs(seed) % pool.length;
  while (used.includes(pool[index].id)) index = (index + 1) % pool.length;
  return pool[index];
}

export function syncSkills(card: Pick<RpgCard, 'id' | 'level' | 'skillSeed' | 'skills'>): Skill[] {
  const kinds: ('active' | 'passive' | 'ultimate')[] = ['active', 'active', 'passive', 'ultimate'];
  const skills: Skill[] = [];
  skillUnlockLevels.forEach((level, index) => {
    if (card.level < level) return;
    const previous = card.skills[index];
    const skill = previous && previous.kind === kinds[index]
      ? previous
      : rollSkill(kinds[index], card.skillSeed + index * 7919, skills.map((item) => item.id));
    skills.push(skill);
  });
  return skills;
}

export function createCard(input: {
  id: string;
  character: Character;
  rarity: Rarity;
  seed: number;
  level?: number;
  revealed?: boolean;
  copies?: number;
  rank?: RpgRank;
  limited?: boolean;
}): RpgCard {
  const card: RpgCard = {
    id: input.id,
    characterId: input.character.id,
    name: input.character.name,
    image: input.character.image,
    rarity: input.rarity,
    rank: input.rank ?? 'D',
    level: input.level ?? 1,
    revealed: input.revealed ?? false,
    stats: rollStats(input.rarity, input.seed),
    skills: [],
    copies: input.copies ?? 1,
    shards: 0,
    seed: input.seed,
    skillSeed: input.seed ^ 0x9e3779b9,
    runes: [],
    limited: input.limited,
    faction: input.character.faction,
    element: input.character.element,
    role: input.character.role,
    storyGroup: input.character.storyGroup,
  };
  return { ...card, skills: syncSkills(card) };
}

export function revealCard(card: RpgCard): RpgCard {
  return { ...card, revealed: true };
}

/** Возможные значения каждой характеристики после улучшения. */
export function previewLevelUp(card: RpgCard, variant = card.pending?.variant ?? 0): CardStats {
  if (card.level >= 20 && !card.pending) return card.stats;
  const source = card.pending?.before ?? card.stats;
  const level = card.pending?.level ?? card.level;
  const random = mulberry32(card.seed + level * 1009 + variant * 9176);
  const next = {} as CardStats;
  for (const stat of statKeys) {
    const [min, max] = ranges[card.rarity][stat];
    const floor = min * rankMultiplier(card.rank);
    const cap = max * rankMultiplier(card.rank) * (1 + level * 0.025);
    const growth = (cap - floor) * 0.055 + cap * 0.008;
    let delta = (random() * 2 - 1) * growth + cap * 0.01;
    if (random() < 0.16) delta = 0;
    next[stat] = round(clamp(source[stat] + delta, floor, cap));
  }
  return next;
}

export function levelUpCard(card: RpgCard, guaranteed = false): RpgCard {
  if (card.level >= 20) return card;
  const before = card.stats;
  const level = card.level;
  const next = previewLevelUp({ ...card, pending: { before, level, variant: 0 } });
  // Материал страхует прокачку: ни одна характеристика не упадёт.
  if (guaranteed) {
    for (const stat of statKeys) next[stat] = round(Math.max(next[stat], before[stat]));
  }
  const upgraded: RpgCard = {
    ...card,
    level: level + 1,
    stats: next,
    pending: { before, level, variant: 0 },
  };
  return { ...upgraded, skills: syncSkills(upgraded) };
}

/** Повторная генерация уже полученного результата улучшения. */
export function rerollLevelCard(card: RpgCard): RpgCard {
  if (!card.pending) return card;
  const variant = card.pending.variant + 1;
  const updated = { ...card, stats: previewLevelUp(card, variant), pending: { ...card.pending, variant } };
  return { ...updated, skills: syncSkills(updated) };
}

export function confirmLevelCard(card: RpgCard): RpgCard {
  if (!card.pending) return card;
  const rest = { ...card };
  delete rest.pending;
  return rest;
}

export function promoteCard(card: RpgCard, useShards = false): { card: RpgCard; cost: 'copy' | 'shards'; amount: number } | null {
  const nextRank = rpgRanks[rankIndex(card.rank) + 1];
  if (!nextRank) return null;
  const cost = shardCost[card.rank];
  const canUseCopy = !useShards && card.copies > 0;
  const canUseShards = card.shards >= cost;
  if (!canUseCopy && !canUseShards) return null;

  const multiplier = rankMultiplier(nextRank) / rankMultiplier(card.rank);
  const stats = {} as CardStats;
  for (const stat of statKeys) {
    const [, max] = ranges[card.rarity][stat];
    stats[stat] = round(Math.min(card.stats[stat] * multiplier, max * rankMultiplier(nextRank) * 1.4));
  }
  return {
    cost: canUseCopy ? 'copy' : 'shards',
    amount: canUseCopy ? 1 : cost,
    card: {
      ...card,
      rank: nextRank,
      stats,
      copies: canUseCopy ? card.copies - 1 : card.copies,
      shards: canUseShards && !canUseCopy ? card.shards - cost : card.shards,
    },
  };
}

export function rerollSkill(card: RpgCard, skillId: string): RpgCard {
  const index = card.skills.findIndex((skill) => skill.id === skillId);
  if (index < 0) return card;
  const kind = skillPools[card.skills[index].kind] ? card.skills[index].kind : 'active';
  const skills = [...card.skills];
  skills[index] = rollSkill(kind, card.skillSeed + index * 7907 + 31, skills.filter((_, i) => i !== index).map((skill) => skill.id));
  return { ...card, skillSeed: card.skillSeed + 104729, skills };
}

export function effectiveStats(card: RpgCard): CardStats {
  const stats = { ...card.stats };
  if (card.artifact) {
    for (const [key, value] of Object.entries(card.artifact.bonus) as [StatKey, number][]) {
      stats[key] += value;
    }
  }
  for (const rune of card.runes) {
    stats[rune.stat] += rune.percent ? stats[rune.stat] * rune.amount / 100 : rune.amount;
  }
  for (const key of statKeys) stats[key] = round(stats[key]);
  return stats;
}

export function cardPower(card: RpgCard): number {
  const stats = effectiveStats(card);
  const base = stats.attack * 2 + stats.hp * 0.35 + stats.defense * 1.5 + stats.speed * 1.2
    + stats.crit * 12 + stats.pierce * 8 + stats.dodge * 8 + stats.resist * 7;
  return Math.round(base + card.skills.length * 45 + rankIndex(card.rank) * 80);
}

function roleBuff(leader: RpgCard): TeamBuff[] {
  switch (leader.role) {
    case 'tank': return [
      { label: `Лидер ${leader.name}: +15% HP`, stat: 'hp', percent: 15 },
      { label: `Лидер ${leader.name}: +15% защиты`, stat: 'defense', percent: 15 },
    ];
    case 'dps': return [{ label: `Лидер ${leader.name}: +12% атаки`, stat: 'attack', percent: 12 }];
    case 'support': return [
      { label: `Лидер ${leader.name}: +10% HP`, stat: 'hp', percent: 10 },
      { label: `Лидер ${leader.name}: +10% сопротивления`, stat: 'resist', percent: 10 },
    ];
    case 'speed': return [{ label: `Лидер ${leader.name}: +8% скорости`, stat: 'speed', percent: 8 }];
  }
}

export function teamBuffs(cards: RpgCard[]): TeamBuff[] {
  if (cards.length === 0) return [];
  const buffs: TeamBuff[] = [...roleBuff(cards[0])];
  const count = (get: (card: RpgCard) => string | undefined) => {
    const map = new Map<string, number>();
    for (const card of cards) {
      const key = get(card);
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Math.max(0, ...map.values());
  };
  if (count((card) => card.faction) >= 3) buffs.push({ label: 'Синергия фракции: +10% HP', stat: 'hp', percent: 10 });
  if (count((card) => card.element) >= 3) buffs.push({ label: 'Синергия стихии: +8% атаки', stat: 'attack', percent: 8 });
  if (count((card) => card.role) >= 2) buffs.push({ label: 'Синергия роли: +5% крита', stat: 'crit', percent: 5 });
  const storyGroups = new Set(cards.map((card) => card.storyGroup).filter(Boolean));
  if (storyGroups.size === 1 && cards.length >= 2) buffs.push({ label: 'Сюжетные союзники: +6% скорости', stat: 'speed', percent: 6 });
  return buffs;
}

export function applyBuffs(stats: CardStats, buffs: TeamBuff[]): CardStats {
  const result = { ...stats };
  for (const buff of buffs) result[buff.stat] *= 1 + buff.percent / 100;
  for (const key of statKeys) result[key] = round(result[key]);
  return result;
}

export function collectionBonuses(cards: RpgCard[]) {
  const unique = new Set(cards.map((card) => card.characterId)).size;
  const strong = cards.filter((card) => rarityIndex(card.rarity) >= rarityIndex('legendary')).length;
  const labels: string[] = [];
  let hpPercent = 0;
  let tokenBonus = 0;
  let dustBonus = 0;
  if (unique >= 10) { hpPercent = 5; labels.push('10 персонажей: +5% HP команды'); }
  if (strong >= 3) { tokenBonus = 5; labels.push('3 легендарных+: +5% Token'); }
  if (strong >= 5) { dustBonus = 5; labels.push('5 легендарных+: +5% пыли'); }
  return { hpPercent, tokenBonus, dustBonus, labels };
}

interface Combatant {
  card: RpgCard;
  side: 'ally' | 'enemy';
  stats: CardStats;
  hp: number;
  maxHp: number;
  shield: number;
  dots: { damage: number; turns: number }[];
  flags: Set<string>;
  immortalityHits: number;
  buffAttack: number;
  kills: number;
  speedPenalty: number;
  defensePenalty: number;
  invulnerable: boolean;
  invulnerableTurns: number;
}

function makeCombatant(card: RpgCard, side: 'ally' | 'enemy', buffs: TeamBuff[], bonusHp: number): Combatant {
  const stats = applyBuffs(effectiveStats(card), buffs);
  stats.hp *= 1 + bonusHp / 100;
  const maxHp = Math.round(stats.hp);
  const shieldSkill = hasSkill(card, 'shield');
  return {
    card, side, stats, hp: maxHp, maxHp,
    shield: shieldSkill ? Math.round(maxHp * skillPower(shieldSkill, card.rank) / 100) : 0,
    dots: [], flags: new Set(), immortalityHits: 0, buffAttack: 0, kills: 0,
    speedPenalty: 0, defensePenalty: 0, invulnerable: false, invulnerableTurns: 0,
  };
}

function living(units: Combatant[]): Combatant[] {
  return units.filter((unit) => unit.hp > 0);
}

function hasSkill(card: RpgCard, effect: string): Skill | undefined {
  return card.skills.find((skill) => skill.effect === effect);
}

/** Сопротивление эффектам: шанс полностью проигнорировать дебафф. */
function effectLanded(target: Combatant, random: () => number): boolean {
  return random() * 100 >= Math.min(50, target.stats.resist);
}

export function simulateBattle(allyCards: RpgCard[], enemyCards: RpgCard[], seed = 1): BattleResult {
  const allyBuffs = teamBuffs(allyCards);
  const enemyBuffs = teamBuffs(enemyCards);
  const bonusHp = collectionBonuses(allyCards).hpPercent;
  const allies = allyCards.slice(0, 5).map((card) => makeCombatant(card, 'ally', allyBuffs, bonusHp));
  const enemies = enemyCards.slice(0, 5).map((card) => makeCombatant(card, 'enemy', enemyBuffs, 0));
  const allyAdvantage = teamSizeAdvantage(allies.length, enemies.length);
  const enemyAdvantage = teamSizeAdvantage(enemies.length, allies.length);
  for (const unit of allies) unit.stats.attack *= 1 + allyAdvantage.attack;
  for (const unit of enemies) unit.stats.attack *= 1 + enemyAdvantage.attack;
  const log: BattleLogLine[] = [];
  const random = mulberry32(seed);
  let round = 0;

  log.push({ round: 0, text: `Бой начинается: ${allies.length} против ${enemies.length}.` });
  if (allies.length === 0 || enemies.length === 0) {
    return { winner: allies.length ? 'ally' : 'enemy', rounds: 0, log, allyHp: allies.reduce((sum, unit) => sum + unit.hp, 0), enemyHp: enemies.reduce((sum, unit) => sum + unit.hp, 0) };
  }

  const dealDamage = (target: Combatant, amount: number, text: string, attacker?: Combatant) => {
    if (target.invulnerable || target.hp <= 0) return 0;
    let damage = amount * (1 - (target.side === 'ally' ? allyAdvantage : enemyAdvantage).defense);
    if (hasSkill(target.card, 'ironSkin')) damage *= 0.8;
    if (hasSkill(target.card, 'magicBarrier')) damage *= 0.75;
    damage = Math.max(1, Math.round(damage));
    const absorbed = Math.min(target.shield, damage);
    target.shield -= absorbed;
    damage -= absorbed;
    target.hp = Math.max(0, target.hp - damage);
    if (absorbed > 0) log.push({ round, text: `${target.card.name}: щит поглотил ${absorbed}.` });
    if (damage > 0) log.push({ round, text: `${text}: −${damage} HP (${target.card.name})` });
    if (target.hp <= 0 && hasSkill(target.card, 'immortality') && target.immortalityHits < 2) {
      target.immortalityHits += 1;
      target.hp = 1;
      log.push({ round, text: `${target.card.name}: Бессмертие сработало (${target.immortalityHits}/2).` });
    }
    if (target.hp <= 0) {
      if (attacker) attacker.kills += 1;
      const teammates = target.side === 'ally' ? allies : enemies;
      for (const ally of teammates) {
        const spirit = hasSkill(ally.card, 'battleSpirit');
        if (spirit && ally.hp > 0) ally.buffAttack += spirit.power ?? 20;
      }
    }
    return damage;
  };

  const heal = (unit: Combatant, amount: number) => {
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    if (unit.hp > before) log.push({ round, text: `${unit.card.name}: +${unit.hp - before} HP` });
  };

  while (round < 15 && living(allies).length > 0 && living(enemies).length > 0) {
    round += 1;
    const order = [...allies, ...enemies]
      .filter((unit) => unit.hp > 0)
      .sort((a, b) => (b.stats.speed - b.speedPenalty) - (a.stats.speed - a.speedPenalty) + (random() - 0.5) * 8);

    for (const unit of order) {
      const targets = living(unit.side === 'ally' ? enemies : allies);
      if (unit.hp <= 0 || targets.length === 0) continue;

      for (const dot of [...unit.dots]) {
        dealDamage(unit, dot.damage, `${unit.card.name}: эффект`);
        dot.turns -= 1;
        if (dot.turns <= 0) unit.dots.splice(unit.dots.indexOf(dot), 1);
      }
      if (unit.hp <= 0) continue;

      const secondWind = hasSkill(unit.card, 'secondWind');
      if (secondWind && unit.hp < unit.maxHp * 0.3 && !unit.flags.has('secondWind')) {
        unit.flags.add('secondWind');
        heal(unit, Math.round(unit.maxHp * skillPower(secondWind, unit.card.rank) / 100));
      }

      const ultimate = unit.card.skills.find((skill) => skill.kind === 'ultimate');
      if (ultimate && round % (ultimate.cooldown ?? 5) === 0) {
        const power = skillPower(ultimate, unit.card.rank);
        if (ultimate.effect === 'massHeal' || ultimate.effect === 'cleanse') {
          for (const ally of living(unit.side === 'ally' ? allies : enemies)) {
            heal(ally, Math.round(ally.maxHp * power / 100));
            ally.dots = [];
          }
        } else if (ultimate.effect === 'revive') {
          const fallen = (unit.side === 'ally' ? allies : enemies).find((ally) => ally.hp <= 0);
          if (fallen) { fallen.hp = Math.round(fallen.maxHp * power / 100); log.push({ round, text: `${ultimate.name}: ${fallen.card.name} возвращается.` }); }
        } else if (ultimate.effect === 'invulnerability') {
          for (const ally of living(unit.side === 'ally' ? allies : enemies)) {
            ally.invulnerable = true;
            ally.invulnerableTurns = 1;
          }
          log.push({ round, text: `${ultimate.name}: команда неуязвима.` });
        } else if (ultimate.effect === 'globalSlow') {
          let applied = 0;
          for (const enemy of living(unit.side === 'ally' ? enemies : allies)) {
            if (!effectLanded(enemy, random)) continue;
            enemy.speedPenalty += enemy.stats.speed * (power / 100);
            applied += 1;
          }
          log.push({ round, text: applied > 0 ? `${ultimate.name}: враги замедлены (${applied}).` : `${ultimate.name}: враги сопротивлялись.` });
        } else {
          for (const target of living(unit.side === 'ally' ? enemies : allies)) {
            dealDamage(target, unit.stats.attack * power / 100, `${unit.card.name}: ${ultimate.name}`, unit);
          }
        }
        if (ultimate.effect === 'blackHole') {
          for (const target of living(unit.side === 'ally' ? enemies : allies)) {
            if (!effectLanded(target, random)) continue;
            target.defensePenalty += target.stats.defense * 0.3;
          }
        }
      }

      const target = living(unit.side === 'ally' ? enemies : allies)[Math.floor(random() * targets.length)];
      if (!target) continue;
      const evasion = hasSkill(unit.card, 'evasion');
      if (random() * 100 < target.stats.dodge + (evasion?.power ?? 0)) {
        log.push({ round, text: `${target.card.name} уклонился от атаки ${unit.card.name}.` });
        continue;
      }

      const hits = hasSkill(unit.card, 'tripleStrike') && random() * 100 < (hasSkill(unit.card, 'tripleStrike')!.chance ?? 20) ? 3
        : hasSkill(unit.card, 'doubleStrike') && random() * 100 < (hasSkill(unit.card, 'doubleStrike')!.chance ?? 30) ? 2 : 1;
      const berserk = hasSkill(unit.card, 'berserk') && unit.hp < unit.maxHp * 0.3 ? (hasSkill(unit.card, 'berserk')!.power ?? 40) / 100 : 0;
      const hunterSkill = hasSkill(unit.card, 'hunter');
      const hunter = hunterSkill ? unit.kills * (hunterSkill.power ?? 10) / 100 : 0;
      const attack = unit.stats.attack * (1 + unit.buffAttack / 100 + berserk + hunter);
      const execute = hasSkill(unit.card, 'execute') && target.hp < target.maxHp * 0.25
        ? 1 + (hasSkill(unit.card, 'execute')!.power ?? 60) / 100 : 1;

      for (let hit = 0; hit < hits && target.hp > 0; hit += 1) {
        const crit = random() * 100 < unit.stats.crit;
        const defense = Math.max(0, target.stats.defense - target.defensePenalty);
        let damage = attack * (100 / (100 + defense)) * (1 + unit.stats.pierce / 100)
          * (0.9 + random() * 0.2) * execute * (crit ? 1.6 : 1);
        const armorBreak = hasSkill(unit.card, 'armorBreak');
        if (armorBreak && random() * 100 < (armorBreak.chance ?? 35) && effectLanded(target, random)) {
          target.defensePenalty += target.stats.defense * skillPower(armorBreak, unit.card.rank) / 100;
          log.push({ round, text: `${unit.card.name}: разлом брони ${target.card.name}.` });
        }
        const dealt = dealDamage(target, damage, `${unit.card.name}${crit ? ' (крит)' : ''}`, unit);
        const vampirism = hasSkill(unit.card, 'vampirism');
        if (vampirism) heal(unit, dealt * skillPower(vampirism, unit.card.rank) / 100);
        const counter = hasSkill(target.card, 'counter');
        if (counter && target.hp > 0 && random() * 100 < (counter.chance ?? 25)) {
          dealDamage(unit, attack * 0.5, `${target.card.name}: контратака`, target);
        }
      }

      for (const skill of unit.card.skills.filter((item) => item.kind === 'active')) {
        if (random() * 100 >= (skill.chance ?? 100)) continue;
        if (!effectLanded(target, random)) {
          log.push({ round, text: `${target.card.name} сопротивлялся ${skill.name}.` });
          continue;
        }
        if (skill.effect === 'fireBlade' || skill.effect === 'poison') {
          target.dots.push({ damage: attack * skillPower(skill, unit.card.rank) / 100, turns: skill.effect === 'fireBlade' ? 3 : 2 });
          log.push({ round, text: `${unit.card.name}: ${skill.name} наложен на ${target.card.name}.` });
        }
        if (skill.effect === 'iceStrike') {
          target.speedPenalty += target.stats.speed * skillPower(skill, unit.card.rank) / 100;
          log.push({ round, text: `${unit.card.name}: ${target.card.name} замедлен.` });
        }
        if (skill.effect === 'chainLightning') {
          for (const other of living(unit.side === 'ally' ? enemies : allies).slice(0, 3)) {
            dealDamage(other, attack * skillPower(skill, unit.card.rank) / 100, `${unit.card.name}: ${skill.name}`, unit);
          }
        }
      }
    }

    for (const unit of [...allies, ...enemies]) {
      if (unit.invulnerableTurns > 0) {
        unit.invulnerableTurns -= 1;
        if (unit.invulnerableTurns === 0) unit.invulnerable = false;
      }
    }
  }

  const allyHp = allies.reduce((sum, unit) => sum + unit.hp, 0);
  const enemyHp = enemies.reduce((sum, unit) => sum + unit.hp, 0);
  const winner = living(allies).length === 0 ? 'enemy' : living(enemies).length === 0 ? 'ally'
    : allyHp / allies.reduce((sum, unit) => sum + unit.maxHp, 0) >= enemyHp / enemies.reduce((sum, unit) => sum + unit.maxHp, 0) ? 'ally' : 'enemy';
  log.push({ round, text: winner === 'ally' ? 'Победа! Противник повержен.' : 'Поражение. Отряд отступил.' });
  return { winner, rounds: round, log, allyHp, enemyHp };
}

export function rollRarity(seed: number, luck = 0): Rarity {
  const roll = mulberry32(seed)() * 100;
  const thresholds = [26 - luck, 24 + luck * 0.4, 21 + luck * 0.3, 16 + luck * 0.2, 9 + luck * 0.1, 4];
  let total = 0;
  for (let index = 0; index < thresholds.length; index += 1) {
    total += thresholds[index];
    if (roll <= total) return rpgRarities[index];
  }
  return 'divine';
}

/** Три случайные карточки пака, из которых игрок забирает ровно одну. */
export function rollPackChoices(seed: number, pool: readonly Character[] = characters, luck = 0): RpgCard[] {
  const random = mulberry32(seed);
  const shuffled = [...pool].sort(() => random() - 0.5);
  return shuffled.slice(0, 3).map((character, index) => createCard({
    id: `pack-${seed}-${index}-${character.id}`,
    character,
    rarity: rollRarity(seed + index * 7919, luck),
    seed: seed + index * 104729,
  }));
}

export function leagueFor(rating: number) {
  return [...leagues].reverse().find((league) => rating >= league.min) ?? leagues[0];
}

const seasonLengthDays = 30;
const seasonAnchor = Date.UTC(2026, 0, 1);

/** Сезон длится ровно 30 дней от фиксированной точки отсчёта. */
export function seasonInfo(now = new Date()) {
  const lengthMs = seasonLengthDays * 86400000;
  const index = Math.floor((now.getTime() - seasonAnchor) / lengthMs);
  const start = new Date(seasonAnchor + index * lengthMs);
  const end = new Date(start.getTime() + lengthMs);
  return {
    index,
    start: start.toISOString(),
    end: end.toISOString(),
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)),
  };
}

export function seasonRewards(leagueId: LeagueId) {
  const tier = leagues.findIndex((league) => league.id === leagueId) + 1;
  return { tokens: tier * 120, shards: tier * 3, cosmetics: tier >= 6 ? ['Эксклюзивная рамка', 'Титул сезона'] : tier >= 3 ? ['Титул сезона'] : [] };
}

export function resetRating(rating: number): number {
  return Math.round(rating * 0.6);
}

export function ratingDelta(win: boolean, playerRating: number, opponentRating: number, streak: number): number {
  const difference = clamp((opponentRating - playerRating) / 100, -0.5, 0.5);
  const streakBonus = win ? Math.min(15, Math.max(0, streak) * 5) : 0;
  return Math.round((win ? 22 : -16) * (1 + difference) + streakBonus);
}

export function findOpponent(rating: number, pool: readonly { name: string; rating: number }[], seed: number) {
  const candidates = pool.filter((entry) => Math.abs(entry.rating - rating) <= 150);
  if (candidates.length === 0) return null;
  return candidates[Math.abs(seed) % candidates.length];
}

export function pveEnemyTeam(stage: PveStage, seed: number): RpgCard[] {
  const random = mulberry32(seed + stage.difficulty * 1000);
  const enemies: RpgCard[] = [];
  for (let index = 0; index < stage.enemies; index += 1) {
    const character = characters[Math.floor(random() * characters.length)];
    const rarity = rpgRarities[Math.min(rpgRarities.length - 1, Math.max(0, rarityIndex(stage.reward.rarity) - 1 + (random() < 0.25 ? 1 : 0)))];
    enemies.push(createCard({
      id: `enemy-${stage.id}-${index}-${seed}`,
      character,
      rarity,
      seed: seed + index * 7717,
      level: Math.min(20, stage.difficulty * 4 + index),
      revealed: true,
      rank: stage.difficulty >= 4 ? 'A' : stage.difficulty >= 2 ? 'C' : 'D',
    }));
  }
  return enemies;
}

export function levelCost(level: number): number {
  return 30 + level * 12;
}

/** Разбор карточки: копии и осколки превращаются в ресурсы. */
export function dismantleCard(card: RpgCard): { shards: number; tokens: number; materials: number } {
  const rarity = rarityIndex(card.rarity) + 1;
  return {
    shards: rarity * 2 + rankIndex(card.rank) + card.copies,
    tokens: rarity * 8 + card.level * 2,
    materials: rarity + Math.floor(card.level / 4),
  };
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  reward: { tokens: number; shards: number; rerollItems?: number; skillResetItems?: number };
}

export const dailyQuests: readonly DailyQuest[] = [
  { id: 'login', title: 'Ежедневный вход', description: 'Заберите награду за визит на арену.', reward: { tokens: 40, shards: 1 } },
  { id: 'pvp', title: 'Схватка на арене', description: 'Проведите один PvP-бой.', reward: { tokens: 50, shards: 0, rerollItems: 1 } },
  { id: 'pve', title: 'Испытание', description: 'Пройдите любое PvE-испытание.', reward: { tokens: 45, shards: 0, skillResetItems: 1 } },
];

export function questKey(questId: string, now = new Date()): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}:${questId}`;
}

/** Бонус коллекции усиливает все награды в Token. */
export function withCollectionTokenBonus(amount: number, cards: RpgCard[]): number {
  return Math.round(amount * (1 + collectionBonuses(cards).tokenBonus / 100));
}

/** Ранг повышает эффективность навыков: SSS даёт +40% к силе эффектов. */
export function skillPower(skill: Skill, rank: RpgRank): number {
  return round((skill.power ?? 0) * (1 + rankIndex(rank) * 0.07));
}

/** Численное преимущество: каждый лишний боец усиливает команду и снижает урон. */
export function teamSizeAdvantage(own: number, enemy: number): { attack: number; defense: number } {
  const diff = own - enemy;
  return {
    attack: diff * 0.04,
    defense: Math.min(0.15, Math.max(-0.15, diff * 0.03)),
  };
}

export interface TradePartner {
  id: string;
  name: string;
  rating: number;
  rarity: Rarity;
}

export const tradePartners: readonly TradePartner[] = [
  { id: 'luna', name: 'Луна', rating: 1050, rarity: 'rare' },
  { id: 'kitsune', name: 'Кицунэ', rating: 1180, rarity: 'epic' },
  { id: 'forge', name: 'Кузьмич', rating: 1360, rarity: 'legendary' },
  { id: 'echo', name: 'Эхо', rating: 1520, rarity: 'mythic' },
];

export function tradeFee(card: RpgCard): number {
  return 50 + rarityIndex(card.rarity) * 30 + rankIndex(card.rank) * 10;
}

/** Карточки, которые игрок получает взамен своей. */
export function tradeOffer(partner: TradePartner, seed: number): RpgCard[] {
  const random = mulberry32(seed);
  const rarity = random() < 0.2
    ? rpgRarities[Math.min(rpgRarities.length - 1, rarityIndex(partner.rarity) + 1)]
    : partner.rarity;
  return [0, 1].map((index) => {
    const character = characters[Math.floor(random() * characters.length)];
    return createCard({
      id: `trade-${partner.id}-${seed}-${index}`,
      character,
      rarity,
      seed: seed + index * 3571,
      revealed: index === 0,
      limited: index === 0 && random() < 0.12,
    });
  });
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  reward: { tokens: number; shards: number; rerollItems?: number; skillResetItems?: number; limited?: boolean };
  check: (state: RpgState) => boolean;
}

export const achievements: readonly Achievement[] = [
  { id: 'first-blood', title: 'Первый бой', description: 'Проведите первый PvP-бой.', reward: { tokens: 60, shards: 2 }, check: (state) => state.wins + state.losses >= 1 },
  { id: 'collector', title: 'Коллекционер', description: 'Соберите 8 карточек.', reward: { tokens: 120, shards: 4, limited: true }, check: (state) => state.cards.length >= 8 },
  { id: 'champion', title: 'Чемпион арены', description: 'Одержите 5 побед подряд.', reward: { tokens: 200, shards: 6, limited: true }, check: (state) => state.streak >= 5 },
  { id: 'legend', title: 'Легенда', description: 'Достигните лиги Diamond.', reward: { tokens: 250, shards: 8, skillResetItems: 1 }, check: (state) => leagueFor(state.rating).min >= 1800 },
  { id: 'maxed', title: 'Потенциал раскрыт', description: 'Доведите карточку до 20 уровня.', reward: { tokens: 180, shards: 5, rerollItems: 2, limited: true }, check: (state) => state.cards.some((card) => card.level >= 20) },
];

export function availableAchievements(state: RpgState): Achievement[] {
  return achievements.filter((entry) => !state.claimedAchievements.includes(entry.id) && entry.check(state));
}

export function createRpgState(seed: number, startingCards: RpgCard[] = []): RpgState {
  const cards = startingCards.length > 0 ? startingCards : [
    createCard({ id: `start-${seed}-1`, character: characters[0], rarity: 'rare', seed: seed + 17, revealed: true, level: 3 }),
    createCard({ id: `start-${seed}-2`, character: characters[1], rarity: 'rare', seed: seed + 97, revealed: true, level: 3 }),
    createCard({ id: `start-${seed}-3`, character: characters[2], rarity: 'epic', seed: seed + 197, revealed: false }),
  ];
  return {
    tokens: 600,
    shards: 8,
    materials: 3,
    rerollItems: 3,
    skillResetItems: 2,
    claimedQuests: [],
    claimedAchievements: [],
    seasonClaimed: 0,
    cards,
    team: { leaderId: cards[0].id, memberIds: cards.slice(0, 5).map((card) => card.id) },
    rating: 1000,
    wins: 0,
    losses: 0,
    streak: 0,
    seasonIndex: seasonInfo().index,
    pveProgress: {},
    history: [],
  };
}
