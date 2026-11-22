import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Panel, RankBadge, Wallet, formatCount, formatShortDate, rankName, rankStyle,
} from './components';
import { pityLimits, rankColors, rankIndex, slotTitles } from './logic';
import { characterFromCard, createCard, hashString, rarityFromLegacyRank } from './rpg';
import type { RpgCard } from './rpg';
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
  buyPackChoice: (pack: ShopPack) => boolean;
  claimPackChoice: (card: WatchCard) => boolean;
  addRpgCard: (card: RpgCard) => void;
  buyCosmetic: (cosmetic: ShopCosmetic) => boolean;
}

interface PackChoice {
  id: string;
  watch: WatchCard;
  rpg: RpgCard;
}

function pickThree(catalog: readonly WatchCard[], seed: number): PackChoice[] {
  const shuffled = [...catalog].sort((a, b) => hashString(a.id + seed) - hashString(b.id + seed));
  return shuffled.slice(0, 3).map((watch, index) => ({
    id: `choice-${seed}-${index}`,
    watch,
    rpg: createCard({
      id: `rpg-pack-${watch.id}-${seed}`,
      character: characterFromCard(watch),
      rarity: rarityFromLegacyRank(watch.rank),
      seed: seed + index * 104729,
    }),
  }));
}

function currencyMark(currency: ShopPack['currency']): string {
  return currency === 'dust' ? '✧' : '◆';
}

function priceLabel(pack: Pick<ShopPack, 'price' | 'currency'>): string {
  return `${formatCount(pack.price)} ${currencyMark(pack.currency)}`;
}

export function ShopView({
  collectionState, diamonds, dust, pity, packHistory, inventory,
  buyPackChoice, claimPackChoice, addRpgCard, buyCosmetic,
}: ShopViewProps) {
  const loadShop = useCallback((signal: AbortSignal) => communityRepository.getShop(signal), []);
  const loadCatalog = useCallback((signal: AbortSignal) => communityRepository.getCardCatalog(signal), []);
  const shopRequest = useCommunityRequest<ShopCatalog>(loadShop);
  const catalogRequest = useCommunityRequest<readonly WatchCard[]>(loadCatalog);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choices, setChoices] = useState<readonly PackChoice[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
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

  const affordable = selected ? canAfford(selected, 1, collectionState) : false;

  const handleOpen = () => {
    if (!selected || opening || catalog.length === 0) return;
    if (!buyPackChoice(selected)) {
      setNotice('Не хватает валюты на открытие.');
      return;
    }
    const seed = Date.now() + Math.floor(Math.random() * 100000);
    setNotice(`${selected.name} открыт · выберите одну из трёх карточек.`);
    setChoices(pickThree(catalog, seed));
    setChosenId(null);
    setOpening(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpening(false), 650);
  };

  const handleClaim = () => {
    const chosen = choices.find((choice) => choice.id === chosenId);
    if (!chosen) return;
    claimPackChoice(chosen.watch);
    addRpgCard(chosen.rpg);
    setNotice(`Забрана карточка «${chosen.watch.title}». Остальные две отправлены в пыль.`);
    setChoices([]);
    setChosenId(null);
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
          <p className={s.shopLead}>Каждый пак предлагает три случайные карточки — вы забираете только одну. Редкость определяет потенциал, а итоговые характеристики раскрываются отдельно за Token.</p>
          {notice && <p className={s.notice} role="status">{notice}</p>}
        </div>

        <div className={s.packGrid}>
          {packs.map((pack) => (
            <button key={pack.id} type="button" className={s.packCard}
              style={{ '--pack-accent': pack.accent } as CSSProperties}
              aria-pressed={selected?.id === pack.id} onClick={() => setSelectedId(pack.id)}>
              <span className={s.packArt}>
                {pack.image && <img src={pack.image} alt="" loading="lazy" />}
                {pack.featured && <span className={s.packFeatured}>Хит</span>}
              </span>
              <span className={s.packName}>{pack.name}</span>
              <span className={s.packDescription}>{pack.description}</span>
              <span className={s.packFooter}>
                <span>3 карточки на выбор</span>
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
              <div className={s.openSummary}>
                <span>Вариантов на выбор: 3</span>
                <span>Стоимость: {priceLabel(selected)}</span>
              </div>
              <button type="button" className={s.openButton} disabled={!affordable || opening} onClick={handleOpen}>
                {opening ? 'Открываем…' : 'Открыть пак · выбрать одну'}
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

      {choices.length > 0 && (
        <div className={s.revealOverlay} role="dialog" aria-modal="true" aria-label="Выбор карточки из пака">
          <div className={s.revealPanel}>
            <div className={s.revealHead}>
              <div>
                <span className={s.eyebrow}>Рулетка пака</span>
                <h2 className={s.revealTitle}>{opening ? 'Карточки вылетают…' : 'Выберите одну карточку'}</h2>
                <p className={s.revealLead}>Остальные две будут переплавлены в пыль. Нажмите на карточку, чтобы забрать её.</p>
              </div>
            </div>
            <div className={s.revealCards}>
              {choices.map((choice, index) => (
                <button key={choice.id} type="button"
                  className={s.revealCard} style={{ ...rankStyle(choice.watch.rank), animationDelay: `${index * 70}ms` }}
                  data-rank={choice.watch.rank} data-selected={chosenId === choice.id}
                  aria-pressed={chosenId === choice.id} onClick={() => setChosenId(choice.id)}>
                  <img src={choice.watch.image} alt="" />
                  <span className={s.rankBadge}>{choice.watch.rank}</span>
                  <span className={s.revealCardName}>{choice.watch.title}</span>
                  <span className={s.revealCardNote}>
                    {rarityFromLegacyRank(choice.watch.rank)} · {choice.rpg.revealed ? 'изучена' : 'не изучена'}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className={s.primaryAction} disabled={!chosenId || opening} onClick={handleClaim}>
              Забрать выбранную карточку
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
