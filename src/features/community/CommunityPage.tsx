import { Alert, Text } from '@mantine/core';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { catalog } from '../../catalog';
import { catalogSourceKey } from '../../catalog/titleRef';
import { titleHref } from '../catalog/titleLinks';
import { ActivityList, FriendGrid, Panel, SupportCard } from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import { formatCount, formatShortDate } from './logic';
import { communityRepository } from './repository';
import { useCommunityRequest } from './useCommunityRequest';

const sectionLinks = [
  { to: '/community', label: 'Главная' },
  { to: '/profile', label: 'Профиль' },
  { to: '/profile?tab=cards', label: 'Карточки' },
  { to: '/profile?tab=albums', label: 'Колоды' },
  { to: '/profile?tab=badges', label: 'Достижения' },
  { to: '/shop', label: 'Магазин' },
  { to: '/schedule', label: 'Расписание' },
];

export function CommunityPage() {
  const loadOverview = useCallback((signal: AbortSignal) => communityRepository.getOverview(signal), []);
  const loadProfile = useCallback((signal: AbortSignal) => communityRepository.getProfile(demoHandleDefault, signal), []);
  const loadSchedule = useCallback((signal: AbortSignal) => catalog.getSchedule(signal), []);
  const overview = useCommunityRequest(loadOverview);
  const profile = useCommunityRequest(loadProfile);
  const schedule = useCommunityRequest(loadSchedule);

  if (overview.status === 'loading' || profile.status === 'loading') {
    return <Text role="status">Загружаем сообщество…</Text>;
  }
  if (overview.status === 'error' || profile.status === 'error' || !overview.data || !profile.data) {
    return <Alert role="alert" color="red" title="Сообщество недоступно">Попробуйте открыть страницу позже.</Alert>;
  }

  return (
    <div>
      <section className={s.hubHero}>
        <img className={s.hubHeroArt} src="/images/community-banner.svg" alt="" />
        <div className={s.hubHeroShade} aria-hidden="true" />
        <div className={s.hubHeroContent}>
          <div className={s.eyebrow}>Сообщество · ночной сеанс</div>
          <h1 className={s.hubTitle}>Серии лучше вместе</h1>
          <p className={s.hubLead}>
            Здесь собирают карточки за просмотренные серии, спорят об озвучке, меняются значками
            и оставляют альбомы на память о сезоне.
          </p>
          <div className={s.hubStats}>
            <div><div className={s.hubStatValue}>{formatCount(overview.data.online)}</div><div className={s.hubStatLabel}>в сети</div></div>
            <div><div className={s.hubStatValue}>{formatCount(overview.data.members)}</div><div className={s.hubStatLabel}>участников</div></div>
            <div><div className={s.hubStatValue}>{formatCount(overview.data.discussionsToday)}</div><div className={s.hubStatLabel}>обсуждений сегодня</div></div>
          </div>
        </div>
      </section>

      <nav className={s.tabs} aria-label="Разделы сообщества">
        {sectionLinks.map(({ to, label }) => (
          <Link key={to} to={to} className={s.tab} aria-current={to === '/community' ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>

      <div className={s.hubGrid}>
        <div className={s.hubMain}>
          <Panel title="Лента сообщества" subtitle="Что только что случилось в вашем кругу." flush>
            <ActivityList items={profile.data.activity} />
          </Panel>
          <Panel title="Обсуждения" subtitle="Живые темы от тех, кто смотрит в тот же вечер." flush>
            <ul className={s.activityList}>
              {overview.data.discussions.map((discussion) => (
                <li key={discussion.id} className={s.activityRow}>
                  <span className={s.activityIcon} aria-hidden="true">💬</span>
                  <div className={s.activityBody}>
                    <div className={s.activityTitle}>{discussion.title}</div>
                    <div className={s.activityDetail}>
                      {discussion.section} · {discussion.author} · {discussion.replies} ответов
                    </div>
                  </div>
                  <time className={s.activityTime} dateTime={discussion.at}>{formatShortDate(discussion.at)}</time>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Карточки недели" subtitle="Подборка серий, которые чаще всего добавляли в альбомы."
            action={<Link className={s.panelLink} to="/profile?tab=cards">Все карточки →</Link>}>
            <div className={s.featuredCards}>
              {profile.data.cards.slice(0, 4).map((card) => (
                <Link key={card.id} className={s.featuredCard} to={card.href ?? '/profile?tab=cards'}>
                  <img src={card.image} alt="" loading="lazy" decoding="async" />
                  <span className={s.featuredCardLabel}>
                    <strong>{card.title}</strong>
                    <small>{card.episodeLabel}</small>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
          {schedule.status === 'ready' && schedule.data.length > 0 && (
            <Panel title="Скоро в эфире" subtitle="Ближайшие серии по расписанию." flush>
              <ul className={s.activityList}>
                {schedule.data.slice(0, 6).map((entry) => (
                  <li key={`${entry.day}-${entry.alias}`} className={s.activityRow}>
                    <span className={s.activityIcon} aria-hidden="true">📺</span>
                    <div className={s.activityBody}>
                      <div className={s.activityTitle}>
                        <Link className={s.link} to={titleHref(catalogSourceKey, entry.alias)}>
                          {entry.name}
                        </Link>
                      </div>
                      <div className={s.activityDetail}>
                        День {entry.day} · {entry.publishedEpisode ? `серия ${entry.publishedEpisode.number}` : 'ожидается'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className={s.hubSide}>
          <Panel title="Кто в сети" flush>
            <FriendGrid friends={profile.data.friends.filter((friend) => friend.presence === 'online')} />
          </Panel>
          <Panel title="События" flush>
            <ul className={s.activityList}>
              {overview.data.events.map((event) => (
                <li key={event.id} className={s.eventRow}>
                  <span className={s.activityIcon} aria-hidden="true">{event.icon}</span>
                  <div className={s.activityBody}>
                    <div className={s.activityTitle}>{event.name}</div>
                    <div className={s.activityDetail}>{event.when} · {event.participants} участников</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Топ недели" flush>
            <ul className={s.activityList}>
              {overview.data.topProfiles.map((entry) => (
                <li key={entry.id} className={s.topRow}>
                  <span className={s.activityIcon} aria-hidden="true">{entry.icon}</span>
                  <div className={s.activityBody}>
                    <div className={s.activityTitle}>
                      <Link className={s.link} to={`/user/${encodeURIComponent(entry.id)}`}>{entry.name}</Link>
                    </div>
                    <div className={s.activityDetail}>Уровень {entry.level}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <SupportCard />
        </div>
      </div>
    </div>
  );
}
