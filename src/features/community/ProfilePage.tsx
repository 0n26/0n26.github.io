import { Alert, Button, Text } from '@mantine/core';
import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AppearanceControls } from '../../app/AppearanceControls';
import { AlbumDetail, AlbumList, WatchCardGrid } from './CardGallery';
import {
  ActivityList, BadgeGrid, FavoriteShowcase, FriendGrid, GroupList, LevelBar,
  Panel, PresenceDot, ProfileTabs, SupportCard, rarityName, rarityStyle,
} from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import { formatCount, formatDate, groupInventory, parseProfileTab, pluralCards, rarityOrder } from './logic';
import type { ProfileTab } from './logic';
import { communityRepository } from './repository';
import type { InventoryItem, Rarity, UserProfile } from './types';
import { useAlbumState } from './useAlbumState';
import { useCommunityRequest } from './useCommunityRequest';

type LinkFor = (tab: ProfileTab) => string;

export function ProfilePage() {
  const { handle } = useParams();
  const [params] = useSearchParams();
  const active = parseProfileTab(params.get('tab'));
  const profileHandle = handle ?? demoHandleDefault;
  const load = useCallback((signal: AbortSignal) => communityRepository.getProfile(profileHandle, signal), [profileHandle]);
  const request = useCommunityRequest(load);
  const baseLink = handle ? `/user/${encodeURIComponent(handle)}` : '/profile';
  const linkFor: LinkFor = (tab) => (tab === 'overview' ? baseLink : `${baseLink}?tab=${tab}`);

  if (request.status === 'loading') return <Text role="status">Загружаем профиль…</Text>;
  if (request.status === 'error' || !request.data) {
    return <Alert role="alert" color="red" title="Профиль недоступен">Попробуйте открыть страницу позже.</Alert>;
  }
  return <ProfileContent profile={request.data} active={active} linkFor={linkFor} />;
}

function ProfileContent({ profile, active, linkFor }: { profile: UserProfile; active: ProfileTab; linkFor: LinkFor }) {
  const albumsState = useAlbumState(profile.handle, profile.albums);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const openAlbum = albumsState.albums.find((album) => album.id === openAlbumId);

  return (
    <div className={s.profileGrid}>
      <div className={s.profileMain}>
        <div>
          <ProfileHeader profile={profile} linkFor={linkFor} />
          <ProfileTabs active={active} linkFor={linkFor} counts={{
            cards: profile.cards.length,
            albums: albumsState.albums.length,
            inventory: profile.inventory.length,
            badges: profile.badges.length,
            friends: profile.friends.length,
            history: profile.history.length,
          }} />
        </div>

        {active === 'overview' && (
          <Overview profile={profile} linkFor={linkFor} albumsState={albumsState} />
        )}
        {active === 'cards' && (
          <Panel title={`Карточки за серии · ${profile.cards.length}`}
            subtitle="Каждая просмотренная серия становится карточкой. Собирайте её в альбомы.">
            <WatchCardGrid cards={profile.cards} albums={albumsState.albums}
              onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />
          </Panel>
        )}
        {active === 'albums' && (openAlbum ? (
          <AlbumDetail album={openAlbum} cards={profile.cards} onBack={() => setOpenAlbumId(null)}
            onRemove={(cardId) => albumsState.removeCard(openAlbum.id, cardId)}
            onRename={(name) => albumsState.rename(openAlbum.id, name)}
            onDelete={() => { albumsState.removeAlbum(openAlbum.id); setOpenAlbumId(null); }} />
        ) : (
          <Panel title={`Альбомы · ${albumsState.albums.length}`} subtitle="Подборки карточек по настроению, сезону или сериалу.">
            <AlbumList albums={albumsState.albums} cards={profile.cards}
              onOpen={setOpenAlbumId} onCreate={albumsState.create} />
          </Panel>
        ))}
        {active === 'badges' && (
          <Panel title={`Значки и достижения · ${profile.badges.length}`}
            subtitle="Открываются за серии, комментарии и верные зрительские привычки.">
            <BadgeGrid badges={profile.badges} />
          </Panel>
        )}
        {active === 'inventory' && <InventoryView items={profile.inventory} />}
        {active === 'friends' && (
          <Panel title={`Друзья · ${profile.friends.length}`} flush>
            <FriendGrid friends={profile.friends} />
          </Panel>
        )}
        {active === 'history' && <HistoryView profile={profile} />}
        {active === 'settings' && <SettingsView profile={profile} albumsCount={albumsState.albums.length} onResetAlbums={albumsState.reset} />}
      </div>

      <div className={s.profileSide}>
        <Panel title="Статистика">
          <div className={s.statGrid}>
            <Stat value={formatCount(profile.stats.episodes)} label="Серий просмотрено" />
            <Stat value={formatCount(profile.stats.watchHours)} label="Часов в плеере" />
            <Stat value={formatCount(profile.stats.titles)} label="Тайтлов в списке" />
            <Stat value={formatCount(profile.stats.reviews)} label="Отзывов" />
            <Stat value={formatCount(profile.stats.friends)} label="Друзей" />
            <Stat value={formatCount(profile.stats.reputation)} label="Репутация" />
          </div>
        </Panel>
        <Panel title="О профиле"><p className={s.bio}>{profile.bio}</p></Panel>
        <Panel title="Группы" action={<Link className={s.panelLink} to="/community">Все группы →</Link>} flush>
          <GroupList groups={profile.groups.slice(0, 3)} />
        </Panel>
        <Panel title="В сети" flush>
          <FriendGrid friends={profile.friends.filter((friend) => friend.presence === 'online').slice(0, 4)} />
        </Panel>
        <SupportCard />
      </div>
    </div>
  );
}

function ProfileHeader({ profile, linkFor }: { profile: UserProfile; linkFor: LinkFor }) {
  const bannerStyle = { '--banner-from': profile.banner[0], '--banner-to': profile.banner[1] } as CSSProperties;
  const avatarStyle = { '--avatar-from': profile.avatar[0], '--avatar-to': profile.avatar[1] } as CSSProperties;
  return (
    <div>
      <div className={s.banner} style={bannerStyle}>
        {profile.bannerImage && <img className={s.bannerImage} src={profile.bannerImage} alt="" />}
        <div className={s.bannerArt} aria-hidden="true" />
        <div className={s.bannerShade} aria-hidden="true" />
        <span className={s.bannerCaption}>Личный архив · на сайте с {formatDate(profile.joinedAt)}</span>
      </div>
      <div className={s.identity}>
        <div className={s.avatar} style={avatarStyle}>
          {profile.avatarImage
            ? <img className={s.avatarImage} src={profile.avatarImage} alt="" />
            : <span aria-hidden="true">{profile.avatarIcon}</span>}
        </div>
        <div className={s.identityMain}>
          <div className={s.nameRow}>
            <PresenceDot presence={profile.presence} />
            <span className={s.displayName}>{profile.name}</span>
            <span className={s.levelPill}>★ Уровень {profile.level}</span>
          </div>
          <p className={s.statusText}>{profile.status}</p>
          <LevelBar xp={profile.xp} xpToNext={profile.xpToNext} />
          <div className={s.identityMeta}>
            <span>@{profile.handle}</span><span>{profile.country}</span>
            <span>{formatCount(profile.stats.episodes)} серий за спиной</span>
          </div>
        </div>
        <div className={s.identityActions}>
          <Button component={Link} to="/profile" size="sm" variant="light">Мой профиль</Button>
          <Button component={Link} to={linkFor('cards')} size="sm" variant="light">Карточки</Button>
          <Button component={Link} to={linkFor('albums')} size="sm" variant="light">Альбомы</Button>
          <Button component={Link} to="/community" size="sm" variant="subtle">Сообщество</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statValue}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

function Overview({ profile, linkFor, albumsState }: {
  profile: UserProfile;
  linkFor: LinkFor;
  albumsState: ReturnType<typeof useAlbumState>;
}) {
  const [collection, setCollection] = useState<'badges' | 'cards' | 'albums' | 'inventory'>('badges');
  return (
    <>
      <Panel title="Продолжить просмотр" subtitle="Незаконченные истории ждут на полке."
        action={<Link className={s.panelLink} to={linkFor('history')}>Вся история →</Link>} flush>
        <FavoriteShowcase items={profile.favorites} />
      </Panel>
      <Panel title="Карточки за серии" subtitle="Свежие серии, которые уже в коллекции."
        action={<Link className={s.panelLink} to={linkFor('cards')}>Все карточки →</Link>}>
        <WatchCardGrid cards={profile.cards.slice(0, 4)} albums={albumsState.albums}
          onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />
      </Panel>
      <Panel title="Недавняя активность" flush>
        <ActivityList items={profile.activity} />
      </Panel>
      <section className={s.panel}>
        <div className={s.panelHeader}>
          <div>
            <h2 className={s.panelTitle}>Коллекция профиля</h2>
            <p className={s.panelSubtitle}>Значки, карточки и альбомы — всё в одном месте.</p>
          </div>
          <Link className={s.panelLink} to={linkFor(collection)}>Открыть раздел →</Link>
        </div>
        <div className={`${s.tabs} ${s.collectionTabs}`} role="group" aria-label="Разделы коллекции">
          {([
            ['badges', 'Значки', profile.badges.length],
            ['cards', 'Карточки', profile.cards.length],
            ['albums', 'Альбомы', albumsState.albums.length],
            ['inventory', 'Инвентарь', profile.inventory.length],
          ] as const).map(([id, label, count]) => (
            <button key={id} type="button" className={`${s.tab} ${collection === id ? s.tabActive : ''}`}
              aria-pressed={collection === id} onClick={() => setCollection(id)}>
              {label} <span className={s.tabCount}>{count}</span>
            </button>
          ))}
        </div>
        <div className={s.collectionBody}>
          {collection === 'badges' && <BadgeGrid badges={profile.badges.slice(0, 4)} />}
          {collection === 'cards' && <WatchCardGrid cards={profile.cards.slice(0, 4)} albums={albumsState.albums}
            onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />}
          {collection === 'albums' && (
            <div className={s.albumPreview}>
              {albumsState.albums.map((album) => (
                <Link key={album.id} className={s.albumPreviewItem} to={linkFor('albums')}>
                  <span className={s.albumPreviewName}>{album.name}</span>
                  <span className={s.albumPreviewCount}>{album.cardIds.length} {pluralCards(album.cardIds.length)}</span>
                </Link>
              ))}
              {albumsState.albums.length === 0 && <p className={s.empty}>Альбомов пока нет.</p>}
            </div>
          )}
          {collection === 'inventory' && <InventoryPreview items={profile.inventory.slice(0, 8)} />}
        </div>
      </section>
    </>
  );
}

function InventoryPreview({ items }: { items: readonly InventoryItem[] }) {
  return (
    <div className={s.inventoryPreview}>
      {items.map((item) => (
        <div key={item.id} className={s.itemCard} data-rarity={item.rarity} title={item.name} style={rarityStyle(item.rarity)}>
          <span className={s.itemIcon} aria-hidden="true">{item.icon}</span>
          {item.quantity > 1 && <span className={s.itemQty}>{item.quantity}</span>}
        </div>
      ))}
    </div>
  );
}

function InventoryView({ items }: { items: readonly InventoryItem[] }) {
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = filter === 'all' ? items : items.filter((item) => item.rarity === filter);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const groups = groupInventory(filtered);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h2 className={s.panelTitle}>Инвентарь · {formatCount(total)} предметов</h2>
          <p className={s.panelSubtitle}>{items.length} позиций · цвет рамки показывает редкость.</p>
        </div>
      </div>
      <div className={s.inventoryToolbar} role="group" aria-label="Фильтр по редкости">
        <button type="button" className={s.rarityFilter} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все</button>
        {rarityOrder.map((rarity) => (
          <button key={rarity} type="button" className={s.rarityFilter} style={rarityStyle(rarity)}
            aria-pressed={filter === rarity} onClick={() => setFilter(rarity)}>
            {rarityName(rarity)}
          </button>
        ))}
      </div>
      <div className={s.inventoryContent}>
        <div>
          {groups.length === 0 ? <p className={s.empty}>Предметов такой редкости нет.</p> : groups.map((group) => (
            <div key={group.kind} className={s.inventoryGroup}>
              <h3 className={s.groupTitle}>{group.kind} · {group.items.length}</h3>
              <div className={s.inventoryGrid}>
                {group.items.map((item) => (
                  <button key={item.id} type="button" className={s.itemCard} data-rarity={item.rarity}
                    style={rarityStyle(item.rarity)} aria-label={`${item.name}, ${rarityName(item.rarity)}`}
                    aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
                    <span className={s.itemIcon} aria-hidden="true">{item.icon}</span>
                    {item.quantity > 1 && <span className={s.itemQty}>{item.quantity}</span>}
                    {item.equipped && <span className={s.equippedChip}>надето</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <aside className={s.itemDetail} aria-live="polite">
            <div className={s.itemDetailIcon} aria-hidden="true">{selected.icon}</div>
            <h3 className={s.itemDetailTitle}>{selected.name}</h3>
            <span className={s.rarityChip} style={rarityStyle(selected.rarity)}>{rarityName(selected.rarity)}</span>
            <p className={s.itemDetailText}>{selected.description}</p>
            <div className={s.itemDetailRow}><span className={s.muted}>Тип</span><span>{selected.kind}</span></div>
            <div className={s.itemDetailRow}><span className={s.muted}>Количество</span><span>{selected.quantity}</span></div>
            <div className={s.itemDetailRow}><span className={s.muted}>Получено</span><span>{formatDate(selected.acquiredAt)}</span></div>
            {selected.equipped && <div className={s.itemDetailRow}><span className={s.equippedChip}>Экипировано</span></div>}
          </aside>
        )}
      </div>
    </section>
  );
}

function HistoryView({ profile }: { profile: UserProfile }) {
  return (
    <Panel title={`История просмотров · ${profile.history.length}`} flush>
      {profile.history.length === 0 ? <p className={s.empty}>История пуста.</p> : (
        <ul className={s.historyList}>
          {profile.history.map((entry) => (
            <li key={entry.id} className={s.historyRow}>
              <div className={s.activityBody}>
                {entry.href ? <Link className={s.historyName} to={entry.href}>{entry.name}</Link>
                  : <span className={s.historyName}>{entry.name}</span>}
                <div className={s.historyEpisode}>{entry.episode}</div>
              </div>
              <time className={s.activityTime} dateTime={entry.at}>{formatDate(entry.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SettingsView({ profile, albumsCount, onResetAlbums }: {
  profile: UserProfile;
  albumsCount: number;
  onResetAlbums: () => void;
}) {
  return (
    <div className={s.settingsStack}>
      <Panel title="Оформление сайта" subtitle="Тема, палитра и цвет фона применяются сразу и запоминаются в браузере.">
        <AppearanceControls />
      </Panel>
      <Panel title="Профиль">
        <Text size="sm" c="dimmed" mb="md">
          Данные профиля приходят через контракт сообщества. После подключения backend они сменятся на API без правки интерфейса.
        </Text>
        <dl>
          <div className={s.itemDetailRow}><dt>Идентификатор</dt><dd>{profile.id}</dd></div>
          <div className={s.itemDetailRow}><dt>Имя пользователя</dt><dd>{profile.handle}</dd></div>
          <div className={s.itemDetailRow}><dt>Уровень</dt><dd>{profile.level}</dd></div>
          <div className={s.itemDetailRow}><dt>Альбомов</dt><dd>{albumsCount}</dd></div>
        </dl>
        <Button size="sm" variant="light" mt="md" onClick={onResetAlbums}>Вернуть исходные альбомы</Button>
      </Panel>
    </div>
  );
}
