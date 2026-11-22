/** Модели сообщества. Не зависят от адаптеров аниме-источников и плеера. */

export type Presence = 'online' | 'away' | 'busy' | 'offline';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type ActivityKind = 'watched' | 'review' | 'badge' | 'inventory' | 'friend';

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

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  kind: string;
  rarity: Rarity;
  icon: string;
  quantity: number;
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
  stats: ProfileStats;
  badges: readonly ProfileBadge[];
  favorites: readonly FavoriteTitle[];
  friends: readonly Friend[];
  groups: readonly CommunityGroup[];
  activity: readonly ActivityItem[];
  inventory: readonly InventoryItem[];
  history: readonly WatchHistoryEntry[];
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
