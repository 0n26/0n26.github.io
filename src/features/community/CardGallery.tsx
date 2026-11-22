import { Menu } from '@mantine/core';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { formatShortDate, rarityName, rarityStyle } from './components';
import { pluralCards } from './logic';
import s from './community.module.css';
import type { Album, WatchCard } from './types';

interface CardGridProps {
  cards: readonly WatchCard[];
  albums: readonly Album[];
  onAddToAlbum: (albumId: string, cardId: string) => void;
  onCreateAlbum: (name: string, cardId: string) => void;
  showAlbums?: boolean;
}

export function WatchCardGrid({ cards, albums, onAddToAlbum, onCreateAlbum, showAlbums = true }: CardGridProps) {
  if (cards.length === 0) return <p className={s.empty}>Карточек пока нет — они появятся после просмотра серий.</p>;
  return (
    <div className={s.cardGrid}>
      {cards.map((card) => (
        <WatchCardTile key={card.id} card={card} albums={albums}
          onAddToAlbum={onAddToAlbum} onCreateAlbum={onCreateAlbum} showAlbums={showAlbums} />
      ))}
    </div>
  );
}

type CardTileProps = Omit<CardGridProps, 'cards' | 'showAlbums'> & { card: WatchCard; showAlbums?: boolean };

export function WatchCardTile({ card, albums, onAddToAlbum, onCreateAlbum, showAlbums }: CardTileProps) {
  const [newAlbum, setNewAlbum] = useState('');
  const memberships = albums.filter((album) => album.cardIds.includes(card.id));
  const style = { ...rarityStyle(card.rarity), '--card-progress': `${Math.max(0, Math.min(100, card.progress))}%` } as CSSProperties;

  return (
    <article className={s.cardTile} style={style} data-rarity={card.rarity}>
      <div className={s.cardArt}>
        <img src={card.image} alt="" loading="lazy" decoding="async" />
        <span className={s.cardEpisode}>{card.episodeLabel}</span>
        <span className={s.cardRarity}>{rarityName(card.rarity)}</span>
        <span className={s.cardProgress} aria-hidden="true" />
      </div>
      <div className={s.cardBody}>
        <h3 className={s.cardTitle}>
          {card.href ? <Link className={s.cardLink} to={card.href}>{card.title}</Link> : card.title}
        </h3>
        <p className={s.cardNote}>{card.note}</p>
        <div className={s.cardMeta}>
          <time dateTime={card.watchedAt}>{formatShortDate(card.watchedAt)}</time>
          <span>{card.progress}% сериала</span>
        </div>
        {showAlbums && memberships.length > 0 && (
          <div className={s.cardAlbumTags}>
            {memberships.map((album) => <span key={album.id} className={s.albumTag}>{album.name}</span>)}
          </div>
        )}
        {showAlbums && (
          <Menu shadow="md" width={230} position="bottom-end" withinPortal>
            <Menu.Target>
              <button type="button" className={s.cardAction}>+ В альбом</button>
            </Menu.Target>
            <Menu.Dropdown className={s.menuDropdown}>
              <Menu.Label>Добавить в альбом</Menu.Label>
              {albums.map((album) => (
                <Menu.Item key={album.id} disabled={album.cardIds.includes(card.id)}
                  onClick={() => onAddToAlbum(album.id, card.id)}>
                  {album.name}{album.cardIds.includes(card.id) ? ' · уже там' : ''}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <div className={s.menuNew}>
                <input aria-label="Название нового альбома" placeholder="Новый альбом"
                  value={newAlbum} maxLength={48}
                  onChange={(event) => setNewAlbum(event.currentTarget.value)} />
                <button type="button" disabled={!newAlbum.trim()}
                  onClick={() => { onCreateAlbum(newAlbum, card.id); setNewAlbum(''); }}>
                  Создать
                </button>
              </div>
            </Menu.Dropdown>
          </Menu>
        )}
      </div>
    </article>
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
        <input aria-label="Название альбома" placeholder="Название нового альбома"
          value={name} maxLength={48} onChange={(event) => setName(event.currentTarget.value)} />
        <button type="submit" disabled={!name.trim()}>Создать альбом</button>
      </form>
      {albums.length === 0 ? <p className={s.empty}>Альбомов пока нет. Соберите первую подборку из карточек.</p> : (
        <div className={s.albumGrid}>
          {albums.map((album) => {
            const covers = album.cardIds
              .map((id) => cards.find((card) => card.id === id))
              .filter((card): card is WatchCard => Boolean(card))
              .slice(0, 3);
            return (
              <button key={album.id} type="button" className={s.albumCard} onClick={() => onOpen(album.id)}>
                <span className={s.albumCovers}>
                  {covers.length > 0 ? covers.map((card) => <img key={card.id} src={card.image} alt="" loading="lazy" />)
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
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is WatchCard => Boolean(card));

  return (
    <section className={s.panel}>
      <div className={s.albumHeader}>
        <button type="button" className={s.backButton} onClick={onBack}>← Все альбомы</button>
        <div className={s.albumHeaderRow}>
          <input aria-label="Название альбома" value={name} maxLength={48}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => onRename(name)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          <button type="button" className={s.dangerButton} onClick={onDelete}>Удалить альбом</button>
        </div>
        <p className={s.albumHint}>{entries.length} {pluralCards(entries.length)} в подборке · имя сохраняется автоматически</p>
      </div>
      {entries.length === 0 ? <p className={s.empty}>Альбом пуст. Добавьте карточки на вкладке «Карточки».</p> : (
        <div className={s.albumCards}>
          {entries.map((card) => (
            <div key={card.id} className={s.albumEntry}>
              <WatchCardTile card={card} albums={[]} onAddToAlbum={() => undefined}
                onCreateAlbum={() => undefined} showAlbums={false} />
              <button type="button" className={s.removeFromAlbum} onClick={() => onRemove(card.id)}>
                Убрать из альбома
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
