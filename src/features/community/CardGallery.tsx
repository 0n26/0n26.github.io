import { Menu, Modal } from '@mantine/core';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { rankStyle } from './components';
import {
  awakenCost, cardFilterModes, cardSortTitles, formatCount, formatShortDate, frameTitles,
  pluralCards, pluralCopies, rankFlavor, rankName, rankOrder, sharpenCost,
} from './logic';
import type { CardFilterMode, CardFilters, CardSort } from './logic';
import s from './community.module.css';
import type { Album, CardSet, Rank, WatchCard } from './types';

interface CardGridProps {
  cards: readonly WatchCard[];
  albums: readonly Album[];
  onAddToAlbum: (albumId: string, cardId: string) => void;
  onCreateAlbum: (name: string, cardId: string) => void;
  onSharpen?: (card: WatchCard) => void;
  onMelt?: (card: WatchCard) => void;
  onAwaken?: (card: WatchCard) => void;
  onToggleFavorite?: (card: WatchCard) => void;
  onToggleExchange?: (card: WatchCard) => void;
  onToggleLock?: (card: WatchCard) => void;
  dust?: number;
  showAlbums?: boolean;
  compact?: boolean;
}

type CardTileProps = Omit<CardGridProps, 'cards' | 'compact'> & { card: WatchCard };

export function WatchCardGrid(props: CardGridProps) {
  const { cards, compact, ...tileProps } = props;
  if (cards.length === 0) {
    return <p className={s.empty}>Карточек пока нет. Смотрите серии или откройте пак в магазине.</p>;
  }
  return (
    <div className={compact ? s.cardGridCompact : s.cardGrid}>
      {cards.map((card) => <WatchCardTile key={card.id} {...tileProps} card={card} />)}
    </div>
  );
}

export function WatchCardTile({
  card, albums, onAddToAlbum, onCreateAlbum, onSharpen, onMelt, onAwaken,
  onToggleFavorite, onToggleExchange, onToggleLock, dust = 0, showAlbums = true,
}: CardTileProps) {
  const [details, setDetails] = useState(false);
  const [newAlbum, setNewAlbum] = useState('');
  const memberships = albums.filter((album) => album.cardIds.includes(card.id));
  const style = {
    ...rankStyle(card.rank),
    '--card-progress': `${Math.max(0, Math.min(100, card.progress))}%`,
  } as CSSProperties;

  return (
    <>
      <article className={s.cardTile} style={style} data-rank={card.rank} data-frame={card.frame}
        data-animated={card.animated || card.awakened ? 'true' : undefined}
        data-special={card.special ? 'true' : undefined}>
        <button type="button" className={s.cardOpen} onClick={() => setDetails(true)}
          aria-label={`Подробнее: ${card.title}, ${rankName(card.rank)}`}>
          <span className={s.cardArt}>
            <img src={card.image} alt="" loading="lazy" decoding="async" />
            <span className={s.cardGlow} aria-hidden="true" />
            <span className={s.rankBadge}>{card.rank}</span>
            {card.level > 0 && <span className={s.levelBadge}>+{card.level}</span>}
            {card.animated && <span className={s.animatedBadge}>GIF</span>}
            {!card.animated && card.animationReady && <span className={s.animatedBadge}>A+</span>}
            {card.special && <span className={s.specialBadge}>✦</span>}
            {card.favorite && <span className={s.favoriteBadge} title="В избранном">★</span>}
            {card.locked && <span className={s.lockBadge} title="Закреплено">🔒</span>}
            {card.copies > 1 && <span className={s.copiesBadge}>×{card.copies}</span>}
            <span className={s.cardProgress} aria-hidden="true" />
          </span>
          <span className={s.cardBody}>
            <span className={s.cardSet}>{rankFlavor[card.rank]} · {card.episodeLabel}</span>
            <span className={s.cardTitle}>{card.title}</span>
            <span className={s.cardMeta}>
              <span>⚡ {formatCount(card.power)}</span>
              <span>{card.progress}%</span>
            </span>
          </span>
        </button>
        {showAlbums && (
          <div className={s.cardFooter}>
            <Menu shadow="md" width={230} position="bottom-end" withinPortal>
              <Menu.Target>
                <button type="button" className={s.cardAction}>+ В колоду</button>
              </Menu.Target>
              <Menu.Dropdown className={s.menuDropdown}>
                <Menu.Label>Добавить в колоду</Menu.Label>
                {albums.map((album) => (
                  <Menu.Item key={album.id} disabled={album.cardIds.includes(card.id)}
                    onClick={() => onAddToAlbum(album.id, card.id)}>
                    {album.name}{album.cardIds.includes(card.id) ? ' · уже там' : ''}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <div className={s.menuNew}>
                  <input aria-label="Название новой колоды" placeholder="Новая колода"
                    value={newAlbum} maxLength={48}
                    onChange={(event) => setNewAlbum(event.currentTarget.value)} />
                  <button type="button" disabled={!newAlbum.trim()}
                    onClick={() => { onCreateAlbum(newAlbum, card.id); setNewAlbum(''); }}>
                    Создать
                  </button>
                </div>
              </Menu.Dropdown>
            </Menu>
            {memberships.length > 0 && (
              <span className={s.albumTags}>
                {memberships.map((album) => <span key={album.id} className={s.albumTag}>{album.name}</span>)}
              </span>
            )}
          </div>
        )}
      </article>

      <Modal opened={details} onClose={() => setDetails(false)} title="Карточка коллекции" centered size="md"
        classNames={{ content: s.modalContent, header: s.modalHeader, title: s.modalTitle }}>
        <CardDetail card={card} albums={albums} dust={dust}
          onAddToAlbum={onAddToAlbum} onCreateAlbum={onCreateAlbum}
          onSharpen={onSharpen} onMelt={onMelt} onAwaken={onAwaken}
          onToggleFavorite={onToggleFavorite} onToggleExchange={onToggleExchange} onToggleLock={onToggleLock} />
      </Modal>
    </>
  );
}

function CardDetail({
  card, albums, dust, onAddToAlbum, onCreateAlbum, onSharpen, onMelt, onAwaken,
  onToggleFavorite, onToggleExchange, onToggleLock,
}: {
  card: WatchCard;
  albums: readonly Album[];
  dust: number;
  onAddToAlbum: (albumId: string, cardId: string) => void;
  onCreateAlbum: (name: string, cardId: string) => void;
  onSharpen?: (card: WatchCard) => void;
  onMelt?: (card: WatchCard) => void;
  onAwaken?: (card: WatchCard) => void;
  onToggleFavorite?: (card: WatchCard) => void;
  onToggleExchange?: (card: WatchCard) => void;
  onToggleLock?: (card: WatchCard) => void;
}) {
  const [newAlbum, setNewAlbum] = useState('');
  const sharpenPrice = sharpenCost(card.level);
  const canSharpen = dust >= sharpenPrice;
  const canMelt = card.copies >= 3 && card.rank !== 'X';
  const canAwaken = card.animationReady && !card.awakened && card.copies >= 3;

  return (
    <div className={s.detail} style={rankStyle(card.rank)} data-rank={card.rank}>
      <div className={s.detailArt}>
        <img src={card.image} alt="" />
        <span className={s.rankBadge}>{card.rank}</span>
        {card.level > 0 && <span className={s.levelBadge}>+{card.level}</span>}
      </div>
      <div className={s.detailBody}>
        <h3 className={s.detailTitle}>{card.title}</h3>
        <p className={s.detailNote}>{card.note}</p>
        <dl className={s.detailStats}>
          <div><dt>Ранг</dt><dd>{rankName(card.rank)} · {rankFlavor[card.rank]}</dd></div>
          <div><dt>Заточка</dt><dd>+{card.level} · {sharpenPrice} ✧ за уровень</dd></div>
          <div><dt>Копии</dt><dd>{card.copies} {pluralCopies(card.copies)}</dd></div>
          <div><dt>Рамка</dt><dd>{frameTitles[card.frame]}</dd></div>
          <div><dt>Потенциал</dt><dd>{card.potential}</dd></div>
          <div><dt>Анимация</dt><dd>{card.animated ? 'есть' : card.animationReady ? 'осколок A+' : 'нет'}</dd></div>
          <div><dt>Сила</dt><dd>{formatCount(card.power)}</dd></div>
          <div><dt>Пыль</dt><dd>{card.dustValue} за переплавку</dd></div>
          <div><dt>Просмотрено</dt><dd>{formatShortDate(card.watchedAt)} · {card.progress}%</dd></div>
        </dl>

        <div className={s.detailFlags}>
          <button type="button" className={s.flagButton} aria-pressed={card.favorite} disabled={!onToggleFavorite}
            onClick={() => onToggleFavorite?.(card)}>{card.favorite ? '★ В избранном' : '☆ В избранное'}</button>
          <button type="button" className={s.flagButton} aria-pressed={card.exchangeable} disabled={!onToggleExchange}
            onClick={() => onToggleExchange?.(card)}>{card.exchangeable ? '↔ Доступна к обмену' : '⊘ Не обменивается'}</button>
          <button type="button" className={s.flagButton} aria-pressed={card.locked} disabled={!onToggleLock}
            onClick={() => onToggleLock?.(card)}>{card.locked ? '🔒 Закреплена' : '🔓 Не закреплена'}</button>
        </div>

        <div className={s.detailActions}>
          <button type="button" className={s.primaryAction} disabled={!canSharpen}
            title={canSharpen ? undefined : 'Не хватает алмазной пыли'} onClick={() => onSharpen?.(card)}>
            Заточить · {sharpenPrice} ✧
          </button>
          <button type="button" className={s.secondaryAction} disabled={!canMelt}
            title={card.rank === 'X' ? 'Карты X переплавлять нельзя' : 'Нужно 3 копии'} onClick={() => onMelt?.(card)}>
            Переплавить
          </button>
          <button type="button" className={s.secondaryAction} disabled={!canAwaken}
            title={!card.animationReady ? 'Нет осколка анимации' : 'Нужно 3 копии'} onClick={() => onAwaken?.(card)}>
            Пробудить · {awakenCost()} копии
          </button>
        </div>

        <div className={s.detailAlbums}>
          <span className={s.detailLabel}>Колоды</span>
          <div className={s.albumTags}>
            {albums.map((album) => (
              <button key={album.id} type="button" className={s.albumTag} disabled={album.cardIds.includes(card.id)}
                onClick={() => onAddToAlbum(album.id, card.id)}>
                {album.name}{album.cardIds.includes(card.id) ? ' ✓' : ' +'}
              </button>
            ))}
          </div>
          <form className={s.menuNew} onSubmit={(event) => {
            event.preventDefault();
            onCreateAlbum(newAlbum, card.id);
            setNewAlbum('');
          }}>
            <input aria-label="Новая колода" placeholder="Новая колода" value={newAlbum} maxLength={48}
              onChange={(event) => setNewAlbum(event.currentTarget.value)} />
            <button type="submit" disabled={!newAlbum.trim()}>Создать</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function CardFiltersBar({ filters, onChange, total, shown }: {
  filters: CardFilters;
  onChange: (next: CardFilters) => void;
  total: number;
  shown: number;
}) {
  const ranks: readonly (Rank | 'all')[] = ['all', ...rankOrder];
  return (
    <div className={s.cardToolbar}>
      <div className={s.rankTabs} role="group" aria-label="Фильтр по рангу">
        {ranks.map((rank) => (
          <button key={rank} type="button" className={s.rankTab}
            style={rank === 'all' ? undefined : rankStyle(rank)}
            aria-pressed={filters.rank === rank} onClick={() => onChange({ ...filters, rank })}>
            {rank === 'all' ? 'Все' : rank}
          </button>
        ))}
      </div>
      <div className={s.filterRow}>
        <label className={s.cardSearch}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Найти карту" placeholder="Название или тайтл" value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.currentTarget.value })} />
        </label>
        <select className={s.sortSelect} aria-label="Сортировка карточек" value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.currentTarget.value as CardSort })}>
          {(Object.keys(cardSortTitles) as readonly CardSort[]).map((sort) => (
            <option key={sort} value={sort}>{cardSortTitles[sort]}</option>
          ))}
        </select>
        <span className={s.filterCount}>{shown} из {total}</span>
      </div>
      <div className={s.modeChips} role="group" aria-label="Особые выборки">
        {cardFilterModes.map((mode) => (
          <button key={mode.id} type="button" className={s.modeChip} aria-pressed={filters.mode === mode.id}
            onClick={() => onChange({ ...filters, mode: mode.id as CardFilterMode })}>
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AlbumList({ albums, cards, onOpen, onCreate }: {
  albums: readonly Album[];
  cards: readonly WatchCard[];
  onOpen: (albumId: string) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className={s.albumGridWrap}>
      <form className={s.albumCreate} onSubmit={(event) => {
        event.preventDefault();
        onCreate(name);
        setName('');
      }}>
        <input aria-label="Название колоды" placeholder="Название новой колоды"
          value={name} maxLength={48} onChange={(event) => setName(event.currentTarget.value)} />
        <button type="submit" disabled={!name.trim()}>Создать колоду</button>
      </form>
      {albums.length === 0 ? <p className={s.empty}>Колод пока нет. Соберите первую подборку из карточек.</p> : (
        <div className={s.albumGrid}>
          {albums.map((album) => {
            const covers = album.cardIds
              .map((cardId) => cards.find((card) => card.id === cardId))
              .filter((card): card is WatchCard => Boolean(card))
              .slice(0, 3);
            return (
              <button key={album.id} type="button" className={s.albumCard} onClick={() => onOpen(album.id)}>
                <span className={s.albumCovers}>
                  {covers.length > 0
                    ? covers.map((card) => <img key={card.id} src={card.image} alt="" loading="lazy" />)
                    : <span className={s.albumEmpty} aria-hidden="true">✦</span>}
                </span>
                <span className={s.albumName}>{album.name}</span>
                <span className={s.albumCount}>{album.cardIds.length} {pluralCards(album.cardIds.length)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AlbumDetail({ album, cards, onBack, onRemove, onRename, onDelete }: {
  album: Album;
  cards: readonly WatchCard[];
  onBack: () => void;
  onRemove: (cardId: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(album.name);
  const entries = album.cardIds
    .map((cardId) => cards.find((card) => card.id === cardId))
    .filter((card): card is WatchCard => Boolean(card));

  return (
    <section className={s.panel}>
      <div className={s.albumHeader}>
        <button type="button" className={s.backButton} onClick={onBack}>← Все колоды</button>
        <div className={s.albumHeaderRow}>
          <input aria-label="Название колоды" value={name} maxLength={48}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => onRename(name)}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          <button type="button" className={s.dangerButton} onClick={onDelete}>Удалить колоду</button>
        </div>
        <p className={s.albumHint}>{entries.length} {pluralCards(entries.length)} в колоде · имя сохраняется автоматически</p>
      </div>
      {entries.length === 0 ? <p className={s.empty}>Колода пуста. Добавьте карточки на вкладке «Карточки».</p> : (
        <div className={s.albumCards}>
          {entries.map((card) => (
            <div key={card.id} className={s.albumEntry}>
              <WatchCardTile card={card} albums={[]} onAddToAlbum={() => undefined}
                onCreateAlbum={() => undefined} showAlbums={false} />
              <button type="button" className={s.removeFromAlbum} onClick={() => onRemove(card.id)}>
                Убрать из колоды
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CardSetStrip({ sets, cards }: { sets: readonly CardSet[]; cards: readonly WatchCard[] }) {
  if (sets.length === 0) return null;
  return (
    <div className={s.setStrip}>
      {sets.map((set) => {
        const owned = cards.filter((card) => card.setId === set.id).length;
        return (
          <article key={set.id} className={s.setCard}
            style={{ backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(8, 14, 24, 0.9)), url(${set.cover})` }}>
            <span className={s.setName}>{set.name}</span>
            <span className={s.setCount}>{owned} {pluralCards(owned)}</span>
            <span className={s.setBonus}>{set.bonus}</span>
          </article>
        );
      })}
    </div>
  );
}

export function CardLink({ card }: { card: WatchCard }) {
  if (!card.href) return <>{card.title}</>;
  return <Link className={s.cardLink} to={card.href}>{card.title}</Link>;
}
