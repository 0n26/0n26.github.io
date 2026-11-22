import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import {
  formatCount, formatDate, formatShortDate, levelPercent, presenceTitles, profileTabs,
  rankColors, rankName, rankTitles, slotTitles, tabIcons, tabTitles,
} from './logic';
import type { ProfileTab } from './logic';
import type {
  ActivityItem, CommunityGroup, EquipSlot, FavoriteTitle, Friend, Presence, ProfileBadge, Rank,
} from './types';
import s from './community.module.css';

export { formatCount, formatDate, formatShortDate, rankName };

const palettes: readonly (readonly [string, string])[] = [
  ['#2f6d92', '#412f73'], ['#7a3d5e', '#263b70'], ['#376b5f', '#283a63'],
  ['#715032', '#51304c'], ['#3c4c87', '#6a3262'], ['#335f74', '#4b3a86'],
];

function palette(seed: string): readonly [string, string] {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return palettes[sum % palettes.length];
}

export function Panel({ title, subtitle, action, flush, className, children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${s.panel} ${className ?? ''}`}>
      <div className={s.panelHeader}>
        <div className={s.panelHeading}>
          <h2 className={s.panelTitle}>{title}</h2>
          {subtitle && <p className={s.panelSubtitle}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={flush ? undefined : s.panelBody}>{children}</div>
    </section>
  );
}

export function PresenceDot({ presence }: { presence: Presence }) {
  return (
    <span className={s.presenceDot} data-presence={presence}
      title={presenceTitles[presence]} aria-label={presenceTitles[presence]} />
  );
}

export function rankStyle(rank: Rank): CSSProperties {
  return { '--rank': rankColors[rank] } as CSSProperties;
}

export function RankBadge({ rank, size = 'md' }: { rank: Rank; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={s.rankBadge} data-rank={rank} data-size={size} style={rankStyle(rank)}
      title={rankTitles[rank]}>
      {rank}
    </span>
  );
}

export function SlotChip({ slot }: { slot: EquipSlot }) {
  return <span className={s.slotChip}>{slotTitles[slot]}</span>;
}

export function Wallet({ diamonds, dust }: { diamonds: number; dust: number }) {
  return (
    <div className={s.wallet}>
      <span className={s.walletChip} title="Алмазы">◆ {formatCount(diamonds)}</span>
      <span className={s.walletChip} data-dust title="Алмазная пыль">✧ {formatCount(dust)}</span>
    </div>
  );
}

export function Poster({ name, src, rating }: { name: string; src?: string; rating?: number }) {
  const [from, to] = palette(name);
  return (
    <div className={s.poster} style={{ '--poster-from': from, '--poster-to': to } as CSSProperties}>
      {src
        ? <img src={src} alt="" loading="lazy" decoding="async"
            onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
        : <span aria-hidden="true">{name.slice(0, 1)}</span>}
      <span className={s.posterShade} aria-hidden="true" />
      {rating !== undefined && <span className={s.rating}>★ {rating.toFixed(1)}</span>}
    </div>
  );
}

export function FavoriteShowcase({ items }: { items: readonly FavoriteTitle[] }) {
  if (items.length === 0) return <p className={s.empty}>Пока нет избранных тайтлов.</p>;
  return (
    <div className={s.showcaseGrid}>
      {items.map((item) => {
        const content = (
          <>
            <Poster name={item.name} src={item.poster} rating={item.rating} />
            <span className={s.showcaseName}>{item.name}</span>
            {item.note && <span className={s.showcaseNote}>{item.note}</span>}
            {item.progress !== undefined && (
              <>
                <div className={s.progressTrack}>
                  <div className={s.progressFill} style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                </div>
                <span className={s.progressLabel}>Просмотрено {item.progress}%</span>
              </>
            )}
          </>
        );
        return item.href
          ? <Link key={item.id} to={item.href} className={s.showcaseCard}>{content}</Link>
          : <div key={item.id} className={s.showcaseCard}>{content}</div>;
      })}
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: readonly ProfileBadge[] }) {
  if (badges.length === 0) return <p className={s.empty}>Значки появятся после первых достижений.</p>;
  return (
    <div className={s.badgeGrid}>
      {badges.map((badge) => (
        <article key={badge.id} className={s.badgeCard} data-rare={badge.rare ? 'true' : undefined}>
          <div className={s.badgeIcon} aria-hidden="true">{badge.icon}</div>
          <div className={s.badgeName}>{badge.name}</div>
          <div className={s.badgeDesc}>{badge.description}</div>
          <div className={s.badgeProgress} title={`${badge.progress}%`}>
            <div className={s.progressFill} style={{ width: `${Math.max(0, Math.min(100, badge.progress))}%` }} />
          </div>
          <div className={s.badgeFooter}>
            <span>Ур. {badge.level}</span>
            <span>+{formatCount(badge.xp)} XP</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function FriendGrid({ friends }: { friends: readonly Friend[] }) {
  if (friends.length === 0) return <p className={s.empty}>В этом профиле нет друзей.</p>;
  return (
    <div className={s.friendGrid}>
      {friends.map((friend) => (
        <article key={friend.id} className={s.friendCard}>
          <div className={s.friendAvatar} aria-hidden="true">{friend.icon}</div>
          <div className={s.friendName}>
            <PresenceDot presence={friend.presence} /> {friend.name}
          </div>
          <div className={s.friendStatus}>{friend.status}</div>
        </article>
      ))}
    </div>
  );
}

const activityIcons: Record<ActivityItem['kind'], string> = {
  watched: '▶', review: '✎', badge: '★', inventory: '🎁', friend: '＋', card: '▣', pack: '✦',
};

export function ActivityList({ items }: { items: readonly ActivityItem[] }) {
  if (items.length === 0) return <p className={s.empty}>Активности пока нет.</p>;
  return (
    <ul className={s.activityList}>
      {items.map((item) => (
        <li key={item.id} className={s.activityRow}>
          <span className={s.activityIcon} aria-hidden="true">{activityIcons[item.kind]}</span>
          <div className={s.activityBody}>
            <div className={s.activityTitle}>
              {item.href ? <Link className={s.link} to={item.href}>{item.title}</Link> : item.title}
            </div>
            <div className={s.activityDetail}>{item.detail}</div>
          </div>
          <time className={s.activityTime} dateTime={item.at}>{formatShortDate(item.at)}</time>
        </li>
      ))}
    </ul>
  );
}

export function GroupList({ groups }: { groups: readonly CommunityGroup[] }) {
  if (groups.length === 0) return <p className={s.empty}>Профиль не состоит в группах.</p>;
  return (
    <ul className={s.groupList}>
      {groups.map((group) => (
        <li key={group.id} className={s.groupRow}>
          <span className={s.groupIcon} aria-hidden="true">{group.icon}</span>
          <div className={s.activityBody}>
            <div className={s.activityTitle}>{group.name}</div>
            <div className={s.activityDetail}>{formatCount(group.members)} участников</div>
          </div>
          {group.role && <span className={s.roleChip}>{group.role}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ProfileTabs({ active, linkFor, counts }: {
  active: ProfileTab;
  linkFor: (tab: ProfileTab) => string;
  counts?: Partial<Record<ProfileTab, number>>;
}) {
  return (
    <nav className={`${s.tabs} ${s.profileNav}`} aria-label="Разделы профиля">
      {profileTabs.map((tab) => (
        <Link key={tab} to={linkFor(tab)} className={`${s.tab} ${active === tab ? s.tabActive : ''}`}
          aria-current={active === tab ? 'page' : undefined}>
          <span className={s.tabIcon} aria-hidden="true">{tabIcons[tab]}</span>
          {tabTitles[tab]}
          {counts?.[tab] !== undefined && <span className={s.tabCount}>{counts[tab]}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SupportCard({ to, title, text }: { to?: string; title?: string; text?: string }) {
  const target = to ?? '/shop';
  return (
    <div className={s.supportCard}>
      <div className={s.eyebrow}>Магазин</div>
      <p className={s.supportTitle}>{title ?? 'Соберите свою колоду'}</p>
      <p className={s.supportText}>{text ?? 'Паки, рамки и статусы помогают оформить профиль. Карточки из паков сразу попадают в коллекцию.'}</p>
      <Link className={s.supportLink} to={target}>Открыть магазин →</Link>
    </div>
  );
}

export function LevelBar({ xp, xpToNext }: { xp: number; xpToNext: number }) {
  return (
    <div className={s.xpRow}>
      <div className={s.xpTrack} role="progressbar" aria-label="Опыт до следующего уровня"
        aria-valuenow={levelPercent(xp, xpToNext)} aria-valuemin={0} aria-valuemax={100}>
        <div className={s.xpFill} style={{ width: `${levelPercent(xp, xpToNext)}%` }} />
      </div>
      <span className={s.xpCaption}>{formatCount(xp)} / {formatCount(xpToNext)} XP</span>
    </div>
  );
}
