import { Alert, Button, Text } from '@mantine/core';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { Wallet } from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import { communityRepository } from './repository';
import { ShopView } from './ShopView';
import type { UserProfile } from './types';
import { useCollectionState } from './useCollectionState';
import { useCommunityRequest } from './useCommunityRequest';

/** Отдельная страница магазина: паки и оформление без шапки профиля. */
export function ShopPage() {
  const load = useCallback((signal: AbortSignal) =>
    communityRepository.getProfile(demoHandleDefault, signal), []);
  const request = useCommunityRequest(load);

  if (request.status === 'loading') return <Text role="status">Загружаем магазин…</Text>;
  if (request.status === 'error' || !request.data) {
    return <Alert role="alert" color="red" title="Магазин недоступен">Попробуйте открыть страницу позже.</Alert>;
  }
  return <ShopContent profile={request.data} />;
}

function ShopContent({ profile }: { profile: UserProfile }) {
  const collection = useCollectionState(profile.handle, profile);

  return (
    <div className={s.storeShell}>
      <div className={s.storeHero}>
        <div>
          <span className={s.eyebrow}>Магазин сообщества</span>
          <h1 className={s.storeTitle}>Паки и оформление</h1>
          <p className={s.storeLead}>
            Открывайте паки, собирайте ранговые карточки и примеряйте предметы профиля.
            Прогресс сразу попадает в коллекцию.
          </p>
          <div className={s.storeHeroActions}>
            <Button component={Link} to="/profile?tab=cards" size="sm" variant="light">Моя коллекция</Button>
            <Button component={Link} to="/profile?tab=inventory" size="sm" variant="subtle">Инвентарь</Button>
          </div>
        </div>
        <div className={s.storeBalance}>
          <span className={s.detailLabel}>Баланс</span>
          <Wallet diamonds={collection.diamonds} dust={collection.dust} />
          <span className={s.hint}>Алмазы и пыль общие для профиля и магазина.</span>
        </div>
      </div>

      <div className={s.storeColumns}>
        <aside className={s.storeSide} aria-label="Разделы магазина">
          <span className={s.groupTitle}>Разделы</span>
          <Link className={s.storeNavLink} to="/shop" aria-current="page">Паки и гарантии</Link>
          <Link className={s.storeNavLink} to="/profile?tab=cards">Карточки</Link>
          <Link className={s.storeNavLink} to="/profile?tab=albums">Колоды</Link>
          <Link className={s.storeNavLink} to="/profile?tab=inventory">Инвентарь</Link>
          <Link className={s.storeNavLink} to="/profile?tab=settings">Оформление сайта</Link>
          <p className={s.hint}>Пыль приходит за дубли и переплавку, алмазы — из паков и наград сообщества.</p>
        </aside>

        <div className={s.storeMain}>
          <ShopView collectionState={collection.state} diamonds={collection.diamonds}
            dust={collection.dust} pity={collection.state.pity}
            packHistory={collection.state.packHistory} inventory={collection.inventory}
            openPacks={collection.openPacks} buyCosmetic={collection.buyCosmetic} />
        </div>
      </div>
    </div>
  );
}
