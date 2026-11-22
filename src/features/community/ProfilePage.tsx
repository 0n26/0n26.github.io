import { Alert, Button, Text } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { AppearanceControls } from '../../app/AppearanceControls';
import { AlbumDetail, AlbumList, CardFiltersBar, CardSetStrip, WatchCardGrid } from './CardGallery';
import {
  ActivityList, BadgeGrid, FavoriteShowcase, FriendGrid, GroupList, LevelBar, Panel,
  PresenceDot, ProfileTabs, RankBadge, SupportCard, Wallet, formatDate, formatCount, rankName,
} from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import {
  equipSlots, equippedBonus, filterCards, formatShortDate, groupInventory, itemUpgradeCost,
  parseProfileTab, pluralCards, rankColors, rankIndex, rankOrder, slotTitles, userRank,
} from './logic';
import type { CardFilters, ProfileTab } from './logic';
import { communityRepository } from './repository';
import type { EquipSlot, InventoryItem, Rank, UserProfile } from './types';
import { useAlbumState } from './useAlbumState';
import { useCollectionState } from './useCollectionState';
import { useCommunityRequest } from './useCommunityRequest';

type LinkFor = (tab: ProfileTab) => string;

export function ProfilePage() {
  const { handle } = useParams();
  const [params] = useSearchParams();
  const requestedTab = params.get('tab');
  const active = parseProfileTab(requestedTab);
  const profileHandle = handle ?? demoHandleDefault;
  const load = useCallback((signal: AbortSignal) => communityRepository.getProfile(profileHandle, signal), [profileHandle]);
  const request = useCommunityRequest(load);
  const baseLink = handle ? `/user/${encodeURIComponent(handle)}` : '/profile';
  const linkFor: LinkFor = (tab) => (tab === 'overview' ? baseLink : `${baseLink}?tab=${tab}`);

  if (requestedTab === 'shop') return <Navigate to="/shop" replace />;
  if (request.status === 'loading') return <Text role="status">Загружаем профиль…</Text>;
  if (request.status === 'error' || !request.data) {
    return <Alert role="alert" color="red" title="Профиль недоступен">Попробуйте открыть страницу позже.</Alert>;
  }
  return <ProfileContent profile={request.data} active={active} linkFor={linkFor} />;
}

function ProfileContent({ profile, active, linkFor }: { profile: UserProfile; active: ProfileTab; linkFor: LinkFor }) {
  const albumsState = useAlbumState(profile.handle, profile.albums);
  const collection = useCollectionState(profile.handle, profile);
  const [filters, setFilters] = useState<CardFilters>({ rank: 'all', query: '', mode: 'all', sort: 'rank' });
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const openAlbum = albumsState.albums.find((album) => album.id === openAlbumId);
  const shownCards = useMemo(() => filterCards(collection.cards, filters), [collection.cards, filters]);
  const rank = userRank(profile.level);
  const bonuses = equippedBonus(collection.inventory, collection.state.equipped);
  const totalPower = useMemo(() => collection.cards.reduce((sum, card) => sum + card.power, 0), [collection.cards]);
  const topRankCards = useMemo(() => collection.cards.filter((card) => rankIndex(card.rank) <= 2).length, [collection.cards]);

  const cardActions = {
    onSharpen: collection.sharpenCard,
    onMelt: collection.meltCard,
    onAwaken: collection.awakenCard,
    onToggleFavorite: (card: UserProfile['cards'][number]) => collection.toggleFlag(card, 'favorite'),
    onToggleExchange: (card: UserProfile['cards'][number]) => collection.toggleFlag(card, 'exchangeable'),
    onToggleLock: (card: UserProfile['cards'][number]) => collection.toggleFlag(card, 'locked'),
    onAddToAlbum: albumsState.addCard,
    onCreateAlbum: albumsState.create,
    dust: collection.dust,
  };

  return (
    <div className={s.profileShell}>
      <ProfileHeader profile={profile} linkFor={linkFor} rankTitle={rank.short} />
      <div className={s.profileLayout}>
        <aside className={s.profileMenu} aria-label="Навигация профиля">
          <ProfileTabs active={active} linkFor={linkFor} counts={{
            cards: collection.cards.length,
            albums: albumsState.albums.length,
            badges: profile.badges.length,
            inventory: collection.inventory.length,
            friends: profile.friends.length,
            history: profile.history.length,
          }} />
        </aside>

        <div className={s.profileMain}>
          {active === 'overview' && (
            <Overview profile={profile} linkFor={linkFor} albumsState={albumsState}
              collection={collection} cardActions={cardActions} />
          )}

          {active === 'cards' && (
            <>
              <CardSetStrip sets={profile.cardSets} cards={collection.cards} />
              <Panel title={`Карточки · ${collection.cards.length}`}
                subtitle="Ранг, заточка, дубли и sets — всё собирается в одну коллекцию.">
                <CardFiltersBar filters={filters} onChange={setFilters}
                  total={collection.cards.length} shown={shownCards.length} />
                <WatchCardGrid cards={shownCards} albums={albumsState.albums}
                  {...cardActions} onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />
              </Panel>
            </>
          )}

          {active === 'albums' && (openAlbum ? (
            <AlbumDetail album={openAlbum} cards={collection.cards} onBack={() => setOpenAlbumId(null)}
              onRemove={(cardId) => albumsState.removeCard(openAlbum.id, cardId)}
              onRename={(name) => albumsState.rename(openAlbum.id, name)}
              onDelete={() => { albumsState.removeAlbum(openAlbum.id); setOpenAlbumId(null); }} />
          ) : (
            <Panel title={`Колоды · ${albumsState.albums.length}`}
              subtitle="Подборки карточек по сезону, настроению или сериалу.">
              <AlbumList albums={albumsState.albums} cards={collection.cards}
                onOpen={setOpenAlbumId} onCreate={albumsState.create} />
            </Panel>
          ))}

          {active === 'badges' && (
            <Panel title={`Достижения · ${profile.badges.length}`}
              subtitle="Открываются за серии, комментарии и верные зрительские привычки.">
              <BadgeGrid badges={profile.badges} />
            </Panel>
          )}

          {active === 'inventory' && (
            <InventoryView items={collection.inventory} equipped={collection.state.equipped}
              dust={collection.dust} onEquip={collection.equip} onUpgrade={collection.upgradeItem} />
          )}

          {active === 'friends' && (
            <Panel title={`Друзья · ${profile.friends.length}`} flush>
              <FriendGrid friends={profile.friends} />
            </Panel>
          )}

          {active === 'history' && <HistoryView profile={profile} />}

          {active === 'settings' && (
            <SettingsView profile={profile} albumsCount={albumsState.albums.length}
              onResetAlbums={albumsState.reset} onResetCollection={collection.reset} />
          )}
        </div>

        <div className={s.profileSide}>
          <Panel title="Сила коллекции" subtitle="Сумма заточки, копий и редких карточек.">
            <div className={s.statGrid}>
              <Stat value={formatCount(collection.cards.length)} label="Карточек" />
              <Stat value={formatCount(totalPower)} label="Суммарная сила" />
              <Stat value={formatCount(topRankCards)} label="Ранга A и выше" />
              <Stat value={formatCount(albumsState.albums.length)} label="Колод" />
            </div>
          </Panel>

          <Panel title="Ранг профиля" subtitle="Считается по уровню, а не по XP внутри уровня.">
            <div className={s.rankPanel}>
              <div className={s.rankCrest} aria-hidden="true">{rank.short.slice(0, 1)}</div>
              <div className={s.rankPanelBody}>
                <div className={s.rankPanelTitle}>{rank.title}</div>
                <p className={s.rankPerk}>{rank.perks}</p>
                <div className={s.progressTrack}>
                  <div className={s.progressFill} style={{ width: `${rank.progress}%` }} />
                </div>
                <span className={s.progressLabel}>
                  {rank.next ? `До ранга «${userRank(rank.next).short}» · ${rank.next} ур.` : 'Максимальный ранг'}
                </span>
              </div>
            </div>
            {bonuses.length > 0 && (
              <div className={s.bonusList}>
                {bonuses.map((bonus) => <span key={bonus} className={s.bonusChip}>{bonus}</span>)}
              </div>
            )}
          </Panel>

          <Panel title="Кошелёк" subtitle="Алмазы и пыль приходят из паков и переплавки дублей.">
            <Wallet diamonds={collection.diamonds} dust={collection.dust} />
            <Link className={s.panelLink} to="/shop">Открыть магазин →</Link>
          </Panel>

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

          <Panel title="В сети" flush>
            <FriendGrid friends={profile.friends.filter((friend) => friend.presence === 'online').slice(0, 4)} />
          </Panel>
          <Panel title="Группы" action={<Link className={s.panelLink} to="/community">Все →</Link>} flush>
            <GroupList groups={profile.groups.slice(0, 3)} />
          </Panel>
          <SupportCard to="/shop" />
        </div>
      </div>
    </div>
  );
}

function ProfileHeader({ profile, linkFor, rankTitle }: {
  profile: UserProfile;
  linkFor: LinkFor;
  rankTitle: string;
}) {
  const bannerStyle = { '--banner-from': profile.banner[0], '--banner-to': profile.banner[1] } as CSSProperties;
  const avatarStyle = { '--avatar-from': profile.avatar[0], '--avatar-to': profile.avatar[1] } as CSSProperties;
  return (
    <div className={s.profileHero}>
      <div className={s.heroBanner} style={bannerStyle}>
        {profile.bannerImage && <img className={s.heroBannerImage} src={profile.bannerImage} alt="" />}
        <div className={s.heroBannerShade} aria-hidden="true" />
        <span className={s.heroCaption}>Личный архив · на сайте с {formatDate(profile.joinedAt)}</span>
      </div>
      <div className={s.heroIdentity}>
        <div className={s.heroAvatarWrap} style={avatarStyle}>
          <div className={s.heroAvatar}>
            {profile.avatarImage
              ? <img src={profile.avatarImage} alt="" />
              : <span aria-hidden="true">{profile.avatarIcon}</span>}
          </div>
          <span className={s.avatarFrame} aria-hidden="true" />
        </div>
        <div className={s.heroInfo}>
          <div className={s.heroNameRow}>
            <PresenceDot presence={profile.presence} />
            <h1 className={s.heroName}>{profile.name}</h1>
            <span className={s.rankMark}>{rankTitle}</span>
            <span className={s.levelChip}>Уровень {profile.level}</span>
          </div>
          <p className={s.heroStatus}>{profile.status}</p>
          <div className={s.heroMeta}>
            <span>@{profile.handle}</span><span>{profile.country}</span>
            <span>{formatCount(profile.stats.episodes)} серий за спиной</span>
          </div>
          <LevelBar xp={profile.xp} xpToNext={profile.xpToNext} />
        </div>
        <div className={s.heroActions}>
          <Button component={Link} to={linkFor('cards')} size="sm" variant="light">Карточки</Button>
          <Button component={Link} to={linkFor('albums')} size="sm" variant="light">Колоды</Button>
          <Button component={Link} to={linkFor('inventory')} size="sm" variant="light">Инвентарь</Button>
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

function EquippedShowcase({ items, equipped }: {
  items: readonly InventoryItem[];
  equipped: Readonly<Partial<Record<InventoryItem['slot'], string>>>;
}) {
  return (
    <div className={s.equipStrip}>
      {equipSlots.map((slot) => {
        const item = items.find((entry) => equipped[slot] === entry.id);
        return (
          <div key={slot} className={s.equipSlot} style={item ? { '--rank': rankColors[item.rank] } as CSSProperties : undefined}>
            <span className={s.equipSlotName}>{slotTitles[slot]}</span>
            <span className={s.equipSlotIcon} aria-hidden="true">{item?.icon ?? '—'}</span>
            <span className={s.equipSlotItem}>{item?.name ?? 'Пусто'}</span>
          </div>
        );
      })}
    </div>
  );
}

type CollectionApi = ReturnType<typeof useCollectionState>;
type AlbumsApi = ReturnType<typeof useAlbumState>;
type CardActions = {
  onSharpen: CollectionApi['sharpenCard'];
  onMelt: CollectionApi['meltCard'];
  onAwaken: CollectionApi['awakenCard'];
  onToggleFavorite: (card: UserProfile['cards'][number]) => void;
  onToggleExchange: (card: UserProfile['cards'][number]) => void;
  onToggleLock: (card: UserProfile['cards'][number]) => void;
  onAddToAlbum: AlbumsApi['addCard'];
  onCreateAlbum: AlbumsApi['create'];
  dust: number;
};

function Overview({ profile, linkFor, albumsState, collection, cardActions }: {
  profile: UserProfile;
  linkFor: LinkFor;
  albumsState: AlbumsApi;
  collection: CollectionApi;
  cardActions: CardActions;
}) {
  return (
    <>
      <Panel title="Экипировка" subtitle="Предметы видны всем, кто откроет вашу страницу."
        action={<Link className={s.panelLink} to={linkFor('inventory')}>Изменить →</Link>}>
        <EquippedShowcase items={collection.inventory} equipped={collection.state.equipped} />
      </Panel>

      <Panel title="Избранные карточки" subtitle="Четыре карты, которые хочется показать первыми."
        action={<Link className={s.panelLink} to={linkFor('cards')}>Все карточки →</Link>}>
        <WatchCardGrid cards={collection.cards.filter((card) => card.favorite).slice(0, 4)}
          albums={albumsState.albums} showAlbums={false} compact {...cardActions}
          onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />
      </Panel>

      <Panel title="Карточки за серии" subtitle="Свежие попадания в коллекцию."
        action={<Link className={s.panelLink} to={linkFor('cards')}>Открыть коллекцию →</Link>}>
        <WatchCardGrid cards={collection.cards.slice(0, 4)} albums={albumsState.albums}
          showAlbums={false} compact {...cardActions}
          onAddToAlbum={albumsState.addCard} onCreateAlbum={albumsState.create} />
      </Panel>

      <Panel title="Значки" action={<Link className={s.panelLink} to={linkFor('badges')}>Все →</Link>} flush>
        <BadgeGrid badges={profile.badges.slice(0, 4)} />
      </Panel>

      <Panel title="Продолжить просмотр" action={<Link className={s.panelLink} to={linkFor('history')}>История →</Link>} flush>
        <FavoriteShowcase items={profile.favorites.slice(0, 4)} />
      </Panel>

      <Panel title="Недавняя активность" flush>
        <ActivityList items={profile.activity} />
      </Panel>
    </>
  );
}

function InventoryView({ items, equipped, dust, onEquip, onUpgrade }: {
  items: readonly InventoryItem[];
  equipped: Readonly<Partial<Record<EquipSlot, string>>>;
  dust: number;
  onEquip: (item: InventoryItem) => void;
  onUpgrade: (item: InventoryItem) => void;
}) {
  const [slot, setSlot] = useState<EquipSlot | 'all'>('all');
  const [rank, setRank] = useState<Rank | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = items.filter((item) =>
    (slot === 'all' || item.slot === slot) && (rank === 'all' || item.rank === rank));
  const groups = groupInventory(filtered);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h2 className={s.panelTitle}>Инвентарь · {formatCount(total)} предметов</h2>
          <p className={s.panelSubtitle}>Слоты, ранги и экипировка. Нажмите на предмет, чтобы надеть или снять.</p>
        </div>
      </div>
      <div className={s.panelBody}>
        <EquippedShowcase items={items} equipped={equipped} />

        <div className={s.inventoryToolbar} role="group" aria-label="Фильтр инвентаря">
          <button type="button" className={s.rankFilter} aria-pressed={slot === 'all'} onClick={() => setSlot('all')}>Все слоты</button>
          {equipSlots.map((entry) => (
            <button key={entry} type="button" className={s.rankFilter}
              aria-pressed={slot === entry} onClick={() => setSlot(entry)}>{slotTitles[entry]}</button>
          ))}
          <span className={s.toolbarDivider} aria-hidden="true" />
          <button type="button" className={s.rankFilter} aria-pressed={rank === 'all'} onClick={() => setRank('all')}>Все ранги</button>
          {rankOrder.map((entry) => (
            <button key={entry} type="button" className={s.rankFilter} aria-pressed={rank === entry}
              onClick={() => setRank(entry)}>{entry}</button>
          ))}
        </div>
      </div>

      <div className={s.inventoryContent}>
        <div>
          {groups.length === 0 ? <p className={s.empty}>Предметов с такими фильтрами нет.</p> : groups.map((group) => (
            <div key={group.slot} className={s.inventoryGroup}>
              <h3 className={s.groupTitle}>{slotTitles[group.slot]} · {group.items.length}</h3>
              <div className={s.inventoryGrid}>
                {group.items.map((item) => (
                  <button key={item.id} type="button" className={s.itemCard}
                    style={{ '--rank': rankColors[item.rank] } as CSSProperties}
                    aria-label={`${item.name}, ранг ${rankName(item.rank)}`}
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
            <div className={s.itemDetailIcon} style={{ color: rankColors[selected.rank] }} aria-hidden="true">{selected.icon}</div>
            <h3 className={s.itemDetailTitle}>{selected.name}</h3>
            <RankBadge rank={selected.rank} size="sm" />
            <p className={s.itemDetailText}>{selected.description}</p>
            <div className={s.itemDetailRow}><span className={s.muted}>Слот</span><span>{slotTitles[selected.slot]}</span></div>
            <div className={s.itemDetailRow}><span className={s.muted}>Уровень</span><span>+{selected.level}</span></div>
            <div className={s.itemDetailRow}><span className={s.muted}>Количество</span><span>{selected.quantity}</span></div>
            <div className={s.itemDetailRow}><span className={s.muted}>Получено</span><span>{formatDate(selected.acquiredAt)}</span></div>
            {selected.setId && <div className={s.itemDetailRow}><span className={s.muted}>Сет</span><span>{selected.setId}</span></div>}
            <div className={s.bonusList}>
              {selected.bonuses.map((bonus) => <span key={bonus} className={s.bonusChip}>{bonus}</span>)}
            </div>
            <div className={s.detailActions}>
              <button type="button" className={s.primaryAction} onClick={() => onEquip(selected)}>
                {selected.equipped ? 'Снять' : 'Надеть'}
              </button>
              <button type="button" className={s.secondaryAction} disabled={dust < itemUpgradeCost(selected.level)}
                onClick={() => onUpgrade(selected)}>
                Улучшить · {itemUpgradeCost(selected.level)} ✧
              </button>
            </div>
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
              <time className={s.activityTime} dateTime={entry.at}>{formatShortDate(entry.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SettingsView({ profile, albumsCount, onResetAlbums, onResetCollection }: {
  profile: UserProfile;
  albumsCount: number;
  onResetAlbums: () => void;
  onResetCollection: () => void;
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
          <div className={s.itemDetailRow}><dt>Колод</dt><dd>{albumsCount}</dd></div>
        </dl>
        <div className={s.settingsActions}>
          <Button size="sm" variant="light" onClick={onResetAlbums}>Вернуть исходные колоды</Button>
          <Button size="sm" variant="subtle" onClick={onResetCollection}>Сбросить коллекцию</Button>
        </div>
      </Panel>
    </div>
  );
}

export function pluralCardsLabel(count: number): string {
  return pluralCards(count);
}
