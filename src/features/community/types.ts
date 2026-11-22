/** Модели сообщества. Не зависят от адаптеров аниме-источников и плеера. */

export type Presence = 'online' | 'away' | 'busy' | 'offline';

/** Ранг карточки. Порядок в массиве — от самого желанного к младшему. */
export type Rank = 'X' | 'S' | 'A' | 'P' | 'G' | 'B' | 'C' | 'D' | 'E' | 'H' | 'N' | 'V' | 'Q' | 'L' | 'K' | 'W';

export type ActivityKind = 'watched' | 'review' | 'badge' | 'inventory' | 'friend' | 'card' | 'pack';

export type CardFrame = 'blue' | 'white' | 'green' | 'brown' | 'violet' | 'step';

export type EquipSlot = 'avatar' | 'frame' | 'cover' | 'status' | 'aura' | 'boost';

export type Currency = 'diamonds' | 'dust';

export interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  level: number;
  xp: number;
  progress: number;
  rare?: boolean;
}

/** Предмет оформления профиля. Ранг и слот определяют его место в инвентаре. */
export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  slot: EquipSlot;
  rank: Rank;
  icon: string;
  quantity: number;
  level: number;
  bonuses: readonly string[];
  setId?: string;
  value: number;
  equipped?: boolean;
  acquiredAt: string;
}

export interface FavoriteTitle {
  id: string;
  name: string;
  poster?: string;
  href?: string;
  progress?: number;
  rating?: number;
  note?: string;
}

export interface Friend {
  id: string;
  name: string;
  icon: string;
  presence: Presence;
  status: string;
}

export interface CommunityGroup {
  id: string;
  name: string;
  icon: string;
  members: number;
  role?: string;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
  href?: string;
  poster?: string;
}

export interface WatchHistoryEntry {
  id: string;
  name: string;
  episode: string;
  at: string;
  href?: string;
  poster?: string;
}

/** Карточка за просмотренную серию — основа коллекции профиля. */
export interface WatchCard {
  id: string;
  title: string;
  episode: number;
  episodeLabel: string;
  image: string;
  watchedAt: string;
  progress: number;
  rank: Rank;
  note: string;
  href?: string;
  setId: string;
  level: number;
  copies: number;
  frame: CardFrame;
  animated: boolean;
  animationReady: boolean;
  special: boolean;
  power: number;
  favorite: boolean;
  exchangeable: boolean;
  awakened: boolean;
  locked: boolean;
  potential: 'Обычная' | 'Редкая' | 'Эпическая' | 'Легендарная' | 'Мифическая';
  dustValue: number;
}

export interface CardSet {
  id: string;
  name: string;
  series: string;
  description: string;
  cover: string;
  bonus: string;
}

export interface Album {
  id: string;
  name: string;
  description: string;
  cardIds: readonly string[];
}

export interface ProfileStats {
  episodes: number;
  watchHours: number;
  titles: number;
  reviews: number;
  friends: number;
  reputation: number;
}

export interface UserProfile {
  id: string;
  handle: string;
  name: string;
  presence: Presence;
  status: string;
  country: string;
  joinedAt: string;
  bio: string;
  level: number;
  xp: number;
  xpToNext: number;
  banner: readonly [string, string];
  avatar: readonly [string, string];
  avatarIcon: string;
  avatarImage?: string;
  bannerImage?: string;
  stats: ProfileStats;
  badges: readonly ProfileBadge[];
  favorites: readonly FavoriteTitle[];
  friends: readonly Friend[];
  groups: readonly CommunityGroup[];
  activity: readonly ActivityItem[];
  inventory: readonly InventoryItem[];
  history: readonly WatchHistoryEntry[];
  cards: readonly WatchCard[];
  cardSets: readonly CardSet[];
  albums: readonly Album[];
  diamonds: number;
  dust: number;
}

export interface CommunityEvent {
  id: string;
  name: string;
  when: string;
  participants: number;
  icon: string;
}

export interface Discussion {
  id: string;
  title: string;
  section: string;
  author: string;
  replies: number;
  at: string;
}

export interface CommunityOverview {
  online: number;
  members: number;
  discussionsToday: number;
  events: readonly CommunityEvent[];
  discussions: readonly Discussion[];
  topProfiles: readonly { id: string; name: string; icon: string; level: number }[];
}

/* ---------- Магазин и коллекционные паки ---------- */

export interface PackDrop {
  rank: Rank;
  weight: number;
}

export interface ShopPack {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  amount: number;
  guarantee?: Rank;
  dropTable: readonly PackDrop[];
  accent: string;
  image?: string;
  featured?: boolean;
  note?: string;
}

export interface ShopCosmetic {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  category: 'avatar' | 'frame' | 'cover' | 'status' | 'boost';
  icon: string;
  accent: string;
  discount?: number;
}

export interface ShopCatalog {
  packs: readonly ShopPack[];
  cosmetics: readonly ShopCosmetic[];
}

export interface PackResult {
  id: string;
  packId: string;
  cardId: string;
  rank: Rank;
  at: string;
  duplicate: boolean;
  bonus?: string;
}

export interface CardFlags {
  favorite: boolean;
  exchangeable: boolean;
  locked: boolean;
  awakened: boolean;
}

/** Всё, что пользователь меняет в игровой части профиля. */
export interface CollectionState {
  diamonds: number;
  dust: number;
  cardLevels: Readonly<Record<string, number>>;
  cardCopies: Readonly<Record<string, number>>;
  cardFlags: Readonly<Record<string, CardFlags>>;
  extraCards: readonly WatchCard[];
  extraInventory: readonly InventoryItem[];
  equipped: Readonly<Partial<Record<EquipSlot, string>>>;
  itemLevels: Readonly<Record<string, number>>;
  pity: { s: number; x: number; xl: number };
  packHistory: readonly PackResult[];
}
