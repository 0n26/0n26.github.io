import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Panel, RankBadge, Wallet, formatCount, formatShortDate, rankName, rankStyle,
} from './components';
import { pityLimits, pluralCards, pluralPacks, rankColors, rankIndex, slotTitles } from './logic';
import { communityRepository } from './repository';
import type {
  CollectionState, InventoryItem, PackResult, ShopCatalog, ShopCosmetic, ShopPack, WatchCard,
} from './types';
import { canAfford } from './useCollectionState';
import { useCommunityRequest } from './useCommunityRequest';
import s from './community.module.css';

interface ShopViewProps {
  collectionState: CollectionState;
  diamonds: number;
  dust: number;
  pity: { s: number; x: number; xl: number };
  packHistory: readonly PackResult[];
  inventory: readonly InventoryItem[];
  openPacks: (pack: ShopPack, quantity: number, catalog: readonly WatchCard[]) => readonly PackResult[];
  buyCosmetic: (cosmetic: ShopCosmetic) => boolean;
}

const quantities = [1, 3, 5, 10] as const;

function currencyMark(currency: ShopPack['currency']): string {
  return currency === 'dust' ? '✧' : '◆';
}

function priceLabel(pack: Pick<ShopPack, 'price' | 'currency'>): string {
  return `${formatCount(pack.price)} ${currencyMark(pack.currency)}`;
}

export function ShopView({
  collectionState, diamonds, dust, pity, packHistory, inventory, openPacks, buyCosmetic,
}: ShopViewProps) {
  const loadShop = useCallback((signal: AbortSignal) => communityRepository.getShop(signal), []);
  const loadCatalog = useCallback((signal: AbortSignal) => communityRepository.getCardCatalog(signal), []);
  const shopRequest = useCommunityRequest<ShopCatalog>(loadShop);
  const catalogRequest = useCommunityRequest<readonly WatchCard[]>(loadCatalog);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [results, setResults] = useState<readonly PackResult[]>([]);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const packs = shopRequest.status === 'ready' ? shopRequest.data.packs : [];
  const cosmetics = shopRequest.status === 'ready' ? shopRequest.data.cosmetics : [];
  const catalog = catalogRequest.status === 'ready' ? catalogRequest.data : [];
  const selected = packs.find((pack) => pack.id === selectedId) ?? packs[0] ?? null;
  const cardsById = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);

  const affordable = selected ? canAfford(selected, quantity, collectionState) : false;

  const handleOpen = () => {
    if (!selected || opening) return;
    const rolls = openPacks(selected, quantity, catalog);
    if (rolls.length === 0) {
      setNotice('Не хватает валюты на открытие.');
      return;
    }
    setNotice(`Открыто ${quantity} ${pluralPacks(quantity)} · ${rolls.length} ${pluralCards(rolls.length)}`);
    setResults(rolls);
    setOpening(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpening(false), 950);
  };

  const handleBuy = (cosmetic: ShopCosmetic) => {
    const bought = buyCosmetic(cosmetic);
    setNotice(bought
      ? `${cosmetic.name} куплен и надет.`
      : 'Предмет уже в инвентаре или не хватает валюты.');
  };

  if (shopRequest.status === 'loading' || catalogRequest.status === 'loading') {
    return <Panel title="Магазин" subtitle="Собираем витрину паков."><p className={s.empty}>Загружаем каталог…</p></Panel>;
  }
  if (shopRequest.status === 'error' || catalogRequest.status === 'error') {
    return <Panel title="Магазин"><p className={s.empty}>Магазин временно недоступен.</p></Panel>;
  }

  return (
    <div className={s.shopStack}>
      <Panel title="Магазин паков" subtitle="Выберите набор, проверьте гарантии и откройте его." action={<Wallet diamonds={diamonds} dust={dust} />}>
        <div className={s.shopIntro}>
          <p className={s.shopLead}>Карточки падают взвешенно: обычные ранги встречаются часто, X — крайне редко. Гарантии срабатывают на 51-м, 200-м и 500-м паке.</p>
          {notice && <p className={s.notice} role="status">{notice}</p>}
        </div>

        <div className={s.packGrid}>
          {packs.map((pack) => (
            <button key={pack.id} type="button" className={s.packCard}
              style={{ '--pack-accent': pack.accent } as CSSProperties}
              aria-pressed={selected?.id === pack.id} onClick={() => { setSelectedId(pack.id); setQuantity(1); }}>
              <span className={s.packArt}>
                {pack.image && <img src={pack.image} alt="" loading="lazy" />}
                {pack.featured && <span className={s.packFeatured}>Хит</span>}
              </span>
              <span className={s.packName}>{pack.name}</span>
              <span className={s.packDescription}>{pack.description}</span>
              <span className={s.packFooter}>
                <span>{pack.amount} {pluralCards(pack.amount)}</span>
                <strong>{priceLabel(pack)}</strong>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {selected && (
        <Panel title={`Открытие · ${selected.name}`} subtitle={selected.note} action={<Wallet diamonds={diamonds} dust={dust} />}>
          <div className={s.openLayout}>
            <div className={s.openMain}>
              <div className={s.quantityRow} role="group" aria-label="Количество паков">
                <span className={s.detailLabel}>Сколько паков открыть</span>
                {quantities.map((value) => (
                  <button key={value} type="button" className={s.quantityButton}
                    aria-pressed={quantity === value} onClick={() => setQuantity(value)}>
                    ×{value}
                  </button>
                ))}
              </div>
              <div className={s.openSummary}>
                <span>Карточек: {selected.amount * quantity}</span>
                <span>Стоимость: {priceLabel({ price: selected.price * quantity, currency: selected.currency })}</span>
              </div>
              <button type="button" className={s.openButton} disabled={!affordable || opening} onClick={handleOpen}>
                {opening ? 'Открываем…' : `Открыть ${quantity} ${pluralPacks(quantity)}`}
              </button>
              {!affordable && <p className={s.hint}>Не хватает валюты. Пыль можно собрать за дубли карточек.</p>}

              <div className={s.dropTable}>
                <h3 className={s.groupTitle}>Шансы выпадения</h3>
                {[...selected.dropTable]
                  .sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank))
                  .map((drop) => {
                    const total = selected.dropTable.reduce((sum, entry) => sum + entry.weight, 0);
                    const chance = total > 0 ? (drop.weight / total) * 100 : 0;
                    return (
                      <div key={drop.rank} className={s.dropRow}>
                        <RankBadge rank={drop.rank} size="sm" />
                        <span className={s.dropName}>{rankName(drop.rank)}</span>
                        <span className={s.dropBar}><span className={s.dropFill}
                          style={{ width: `${Math.max(2, Math.min(100, chance * 4))}%`, background: rankColors[drop.rank] }} /></span>
                        <span className={s.dropChance}>{chance.toFixed(1)}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <aside className={s.openSide}>
              <h3 className={s.groupTitle}>Гарантии</h3>
              <div className={s.pityGrid}>
                <div className={s.pityCell} data-kind="s">
                  <span className={s.pityValue}>{pity.s}</span>
                  <span className={s.pityLabel}>до S · {pityLimits.s}</span>
                </div>
                <div className={s.pityCell} data-kind="x">
                  <span className={s.pityValue}>{pity.x}</span>
                  <span className={s.pityLabel}>до X · {pityLimits.x}</span>
                </div>
                <div className={s.pityCell} data-kind="xl">
                  <span className={s.pityValue}>{pity.xl}</span>
                  <span className={s.pityLabel}>до XL · {pityLimits.xl}</span>
                </div>
              </div>
              <p className={s.hint}>Счётчики общие для всех паков и сбрасываются, когда выпадает карта нужного ранга.</p>

              <h3 className={`${s.groupTitle} ${s.historyTitle}`}>Последние открытия</h3>
              {packHistory.length === 0 ? <p className={s.empty}>История паков пока пуста.</p> : (
                <ul className={s.packHistory}>
                  {packHistory.slice(0, 6).map((entry) => {
                    const card = cardsById.get(entry.cardId);
                    return (
                      <li key={entry.id} className={s.historyPackRow}>
                        <RankBadge rank={entry.rank} size="sm" />
                        <span className={s.activityBody}>
                          <span className={s.activityTitle}>{card?.title ?? 'Карточка'}</span>
                          <span className={s.activityDetail}>
                            {entry.duplicate ? 'дубль · +пыль' : 'новая карта'}{entry.bonus ? ` · ${entry.bonus}` : ''}
                          </span>
                        </span>
                        <time className={s.activityTime} dateTime={entry.at}>{formatShortDate(entry.at)}</time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          </div>
        </Panel>
      )}

      <Panel title="Оформление профиля" subtitle="Покупайте предметы и примеряйте их сразу.">
        <div className={s.cosmeticGrid}>
          {cosmetics.map((cosmetic) => {
            const owned = inventory.some((item) => item.id === `owned-${cosmetic.id}`);
            const affordableCosmetic = cosmetic.currency === 'dust'
              ? dust >= cosmetic.price
              : diamonds >= cosmetic.price;
            return (
              <article key={cosmetic.id} className={s.cosmeticCard}
                style={{ '--pack-accent': cosmetic.accent } as CSSProperties}>
                <div className={s.cosmeticIcon} aria-hidden="true" style={rankStyle('A')}>{cosmetic.icon}</div>
                <div className={s.cosmeticBody}>
                  <h3 className={s.cosmeticName}>{cosmetic.name}</h3>
                  <p className={s.cosmeticText}>{cosmetic.description}</p>
                  <span className={s.slotChip}>{slotTitles[cosmetic.category]}</span>
                  <div className={s.cosmeticPrice}>
                    <strong>{priceLabel(cosmetic)}</strong>
                    {cosmetic.discount && <s>{formatCount(cosmetic.discount)} {currencyMark(cosmetic.currency)}</s>}
                  </div>
                </div>
                <button type="button" className={s.secondaryAction} disabled={owned || !affordableCosmetic}
                  onClick={() => handleBuy(cosmetic)}>
                  {owned ? 'В инвентаре' : 'Купить и надеть'}
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      {results.length > 0 && (
        <div className={s.revealOverlay} role="status" aria-live="polite" onClick={() => setResults([])}>
          <div className={s.revealPanel} onClick={(event) => event.stopPropagation()}>
            <div className={s.revealHead}>
              <div>
                <span className={s.eyebrow}>Рулетка пака</span>
                <h2 className={s.revealTitle}>{opening ? 'Карточки вылетают…' : 'Что выпало'}</h2>
              </div>
              <button type="button" className={s.revealClose} onClick={() => setResults([])} aria-label="Закрыть">×</button>
            </div>
            <div className={s.revealCards}>
              {results.map((entry, index) => {
                const card = cardsById.get(entry.cardId);
                return (
                  <div key={entry.id} className={s.revealCard} style={{ ...rankStyle(entry.rank), animationDelay: `${index * 70}ms` }}
                    data-rank={entry.rank}>
                    {card && <img src={card.image} alt="" />}
                    <span className={s.rankBadge}>{entry.rank}</span>
                    <span className={s.revealCardName}>{card?.title ?? 'Карточка'}</span>
                    <span className={s.revealCardNote}>
                      {entry.duplicate ? 'дубль' : 'новая'}{entry.bonus ? ` · ${entry.bonus}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <button type="button" className={s.primaryAction} onClick={() => setResults([])}>Забрать карточки</button>
          </div>
        </div>
      )}
    </div>
  );
}
