import { Alert, Text } from '@mantine/core';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { defaultSource } from '../../sources';
import { ActivityList, FriendGrid, Panel, SupportCard } from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import { formatCount, formatShortDate } from './logic';
import { communityRepository } from './repository';
import { useCommunityRequest } from './useCommunityRequest';

const sectionLinks = [
  { to: '/community', label: 'Главная' },
  { to: '/profile?tab=friends', label: 'Друзья' },
  { to: '/profile?tab=badges', label: 'Значки' },
  { to: '/profile?tab=inventory', label: 'Инвентарь' },
  { to: '/schedule', label: 'Расписание' },
];

export function CommunityPage() {
  const loadOverview = useCallback((signal: AbortSignal) => communityRepository.getOverview(signal), []);
  const loadProfile = useCallback((signal: AbortSignal) => communityRepository.getProfile(demoHandleDefault, signal), []);
  const loadSchedule = useCallback((signal: AbortSignal) =>
    defaultSource.getSchedule ? defaultSource.getSchedule(signal) : Promise.resolve([]), []);
  const overview = useCommunityRequest(loadOverview);
  const profile = useCommunityRequest(loadProfile);
  const schedule = useCommunityRequest(loadSchedule);

  if (overview.status === 'loading' || profile.status === 'loading') {
    return <Text role="status">Загружаем сообщество…</Text>;
  }
  if (overview.status === 'error' || profile.status === 'error' || !profile.data) {
    return <Alert role="alert" color="red" title="Сообщество недоступно">Попробуйте открыть страницу позже.</Alert>;
  }

  return (
    <div>
      <section className={s.hubHero}>
        <div className={s.eyebrow}>Сообщество</div>
        <h1 className={s.hubTitle}>Ночной сеанс</h1>
        <p className={s.hubLead}>
          Место, где серии превращаются в историю: обсуждайте премьеры, меняйтесь значками,
          собирайте коллекцию и смотрите вместе.
        </p>
        <div className={s.hubStats}>
          <div>
            <div className={s.hubStatValue}>{formatCount(overview.data.online)}</div>
            <div className={s.hubStatLabel}>в сети</div>
          </div>
          <div>
            <div className={s.hubStatValue}>{formatCount(overview.data.members)}</div>
            <div className={s.hubStatLabel}>участников</div>
          </div>
          <div>
            <div className={s.hubStatValue}>{formatCount(overview.data.discussionsToday)}</div>
            <div className={s.hubStatLabel}>обсуждений сегодня</div>
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
          <Panel title="Лента сообщества" flush>
            <ActivityList items={profile.data.activity} />
          </Panel>
          <Panel title="Обсуждения" flush>
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
          {schedule.status === 'ready' && schedule.data.length > 0 && (
            <Panel title="Скоро в эфире" flush>
              <ul className={s.activityList}>
                {schedule.data.slice(0, 6).map((entry) => (
                  <li key={`${entry.day}-${entry.alias}`} className={s.activityRow}>
                    <span className={s.activityIcon} aria-hidden="true">📺</span>
                    <div className={s.activityBody}>
                      <div className={s.activityTitle}>
                        <Link className={s.link} to={`/anime/${encodeURIComponent(defaultSource.key)}/${encodeURIComponent(entry.alias)}`}>
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
