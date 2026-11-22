import { Alert, Text } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Panel, formatCount, formatShortDate } from './components';
import s from './community.module.css';
import { demoHandleDefault } from './demoRepository';
import {
  achievements, artifacts, cardPower, collectionBonuses, dailyQuests, demoOpponents,
  dismantleCard, findOpponent, hashString, leagueFor, leagues, levelCost, pveStages,
  questKey, rarityNames, revealCost, runePool, seasonRewards, shardCost, statKeys,
  statNames, tradeFee, tradePartners,
} from './rpg';
import type { BattleLogLine, RpgCard } from './rpg';
import { communityRepository } from './repository';
import type { UserProfile } from './types';
import { useCommunityRequest } from './useCommunityRequest';
import { useRpgState } from './useRpgState';
import type { RpgActionResult } from './useRpgState';

type Section = 'cards' | 'team' | 'arena' | 'pve' | 'trade' | 'achievements' | 'rating';

interface BattleView {
  title: string;
  detail: string;
  log: readonly BattleLogLine[];
}

const sections: readonly { id: Section; label: string; icon: string; hint: string }[] = [
  { id: 'cards', label: 'Карточки', icon: '▣', hint: 'Раскрытие, уровни, ранги и навыки' },
  { id: 'team', label: 'Отряд', icon: '❖', hint: 'Пять персонажей, лидер и синергии' },
  { id: 'arena', label: 'Арена PvP', icon: '⚔', hint: 'Рейтинг, лиги и сезоны' },
  { id: 'pve', label: 'PvE', icon: '◇', hint: 'Главы, башня, боссы и рейды' },
  { id: 'trade', label: 'Обмен', icon: '⇄', hint: 'Обмен карточек с участниками' },
  { id: 'achievements', label: 'Достижения', icon: '✦', hint: 'Награды и лимитированные карты' },
  { id: 'rating', label: 'Рейтинг', icon: '★', hint: 'Сильнейшие игроки и награды' },
];

/** Отдельный раздел карточной RPG: коллекция, отряд, авто-бои и прогрессия. */
export function RpgPage() {
  const load = useCallback((signal: AbortSignal) =>
    communityRepository.getProfile(demoHandleDefault, signal), []);
  const request = useCommunityRequest(load);

  if (request.status === 'loading') return <Text role="status">Загружаем арену…</Text>;
  if (request.status === 'error' || !request.data) {
    return <Alert role="alert" color="red" title="Арена недоступна">Попробуйте открыть страницу позже.</Alert>;
  }
  return <RpgContent profile={request.data} />;
}

function RpgContent({ profile }: { profile: UserProfile }) {
  const rpg = useRpgState(profile.handle, profile);
  const [section, setSection] = useState<Section>('cards');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleView | null>(null);
  const [ratingTab, setRatingTab] = useState<'weekly' | 'season'>('weekly');
  const [tradePartnerId, setTradePartnerId] = useState(tradePartners[0].id);
  const [tradeTakeId, setTradeTakeId] = useState<string | null>(null);
  const [tradeGiveId, setTradeGiveId] = useState<string | null>(null);

  const selected = rpg.cards.find((card) => card.id === selectedId) ?? rpg.cards[0] ?? null;
  const league = leagueFor(rpg.state.rating);
  const leagueIndex = leagues.findIndex((entry) => entry.id === league.id);
  const nextLeague = leagues[leagueIndex + 1];
  const leagueProgress = nextLeague
    ? Math.min(100, Math.max(0, (rpg.state.rating - league.min) / (nextLeague.min - league.min) * 100))
    : 100;
  const bonuses = useMemo(() => collectionBonuses(rpg.cards), [rpg.cards]);
  const opponent = useMemo(() => findOpponent(
    rpg.state.rating,
    demoOpponents as readonly { name: string; rating: number }[],
    hashString(`${profile.handle}-${rpg.state.wins}-${rpg.state.losses}`),
  ) ?? demoOpponents[0], [profile.handle, rpg.state.rating, rpg.state.wins, rpg.state.losses]);

  const tradePartner = tradePartners.find((entry) => entry.id === tradePartnerId) ?? tradePartners[0];
  const tradeOfferCards = rpg.offerFor(tradePartner.id);
  const tradeTaken = tradeOfferCards.find((card) => card.id === tradeTakeId) ?? tradeOfferCards[0];
  const tradeGive = rpg.cards.find((card) => card.id === tradeGiveId) ?? rpg.cards[0] ?? null;
  const tradeCost = tradeGive ? tradeFee(tradeGive) : 0;
  const unlocked = rpg.unlockedAchievements.map((entry) => entry.id);

  const report = (result: RpgActionResult) => setNotice(result.message);

  const toggleTeam = (card: RpgCard) => {
    const ids = rpg.state.team.memberIds;
    const next = ids.includes(card.id) ? ids.filter((id) => id !== card.id) : [...ids, card.id].slice(0, 5);
    const leader = next.includes(rpg.state.team.leaderId) ? rpg.state.team.leaderId : next[0] ?? '';
    rpg.setTeam(leader, next);
  };

  const runPvp = () => {
    const outcome = rpg.battlePvp();
    setBattle({
      title: `${outcome.result.winner === 'ally' ? 'Победа' : 'Поражение'} · ${outcome.opponent.name}`,
      detail: `${outcome.delta > 0 ? '+' : ''}${outcome.delta} рейтинга · раунд ${outcome.result.rounds}`,
      log: outcome.result.log,
    });
    setNotice(null);
  };

  const runPve = (stageId: string) => {
    const stage = pveStages.find((entry) => entry.id === stageId);
    if (!stage) return;
    const outcome = rpg.battlePve(stage);
    setBattle({
      title: `${outcome.result.winner === 'ally' ? 'Пройдено' : 'Не пройдено'} · ${stage.name}`,
      detail: outcome.rewardCard
        ? `Награда: карточка ${rarityNames[outcome.rewardCard.rarity]} · +${stage.reward.tokens} Token`
        : `+${outcome.result.winner === 'ally' ? stage.reward.tokens : 8} Token`,
      log: outcome.result.log,
    });
    setNotice(null);
  };

  return (
    <div className={s.arenaShell}>
      <div className={s.arenaHero}>
        <div>
          <span className={s.eyebrow}>AniHub RPG</span>
          <h1 className={s.arenaTitle}>Карточная арена</h1>
          <p className={s.arenaLead}>
            Каждая карточка уникальна: редкость задаёт потенциал, а характеристики и навыки
            генерируются отдельно. Раскройте их, соберите отряд и поднимитесь в лиге.
          </p>
          <div className={s.arenaHeroActions}>
            <Link className={s.panelLink} to="/shop">Открыть пак →</Link>
            <Link className={s.panelLink} to="/profile?tab=cards">Коллекция профиля →</Link>
          </div>
        </div>
        <div className={s.arenaBalance}>
          <div className={s.arenaBalanceRow}><span>Token</span><strong>{formatCount(rpg.state.tokens)}</strong></div>
          <div className={s.arenaBalanceRow}><span>Осколки</span><strong>{formatCount(rpg.state.shards)}</strong></div>
          <div className={s.arenaBalanceRow}><span>Предметы</span><strong>{rpg.state.rerollItems} реролл · {rpg.state.skillResetItems} смена · {rpg.state.materials} материал</strong></div>
          <div className={s.arenaBalanceRow}><span>Сезон</span><strong>{rpg.season.daysLeft} дн.</strong></div>
        </div>
      </div>

      {notice && <p className={s.notice} role="status">{notice}</p>}

      <div className={s.arenaColumns}>
        <aside className={s.arenaSide} aria-label="Разделы RPG">
          {sections.map((item) => (
            <button key={item.id} type="button" className={s.arenaNavButton}
              aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
              <span className={s.tabIcon} aria-hidden="true">{item.icon}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className={s.arenaMain}>
          {section === 'cards' && (
            <Panel title="Мои карточки" subtitle="Выберите карточку, чтобы раскрыть или развить её.">
              <div className={s.rpgCardGrid}>
                {rpg.cards.map((card) => (
                  <button key={card.id} type="button" className={s.rpgCard}
                    data-rarity={card.rarity} data-selected={selected?.id === card.id}
                    aria-pressed={selected?.id === card.id} onClick={() => setSelectedId(card.id)}>
                    {card.image && <img className={s.rpgCardArt} src={card.image} alt="" loading="lazy" />}
                    <span className={s.rpgCardMeta}>
                      <strong>{card.name}{card.limited && ' ✦'}</strong>
                      <small>{rarityNames[card.rarity]} · {card.rank} · ур. {card.level}</small>
                      <small>{card.revealed ? `${formatCount(cardPower(card))} силы` : 'характеристики скрыты'}</small>
                    </span>
                  </button>
                ))}
              </div>
              {selected && <CardDetail card={selected} rpg={rpg} report={report} />}
            </Panel>
          )}

          {section === 'team' && (
            <Panel title="Отряд" subtitle="Максимум пять персонажей. Первый в списке — лидер с бонусом для команды.">
              <div className={s.statGrid}>
                <div className={s.stat}><strong className={s.statValue}>{formatCount(rpg.teamPower)}</strong><span className={s.statLabel}>Сила отряда</span></div>
                <div className={s.stat}><strong className={s.statValue}>{rpg.teamCards.length}/5</strong><span className={s.statLabel}>Персонажей</span></div>
                <div className={s.stat}><strong className={s.statValue}>{rpg.buffs.length}</strong><span className={s.statLabel}>Бонусов</span></div>
              </div>
              <div className={s.rpgCardGrid}>
                {rpg.cards.map((card) => {
                  const inTeam = rpg.state.team.memberIds.includes(card.id);
                  const leader = rpg.state.team.leaderId === card.id;
                  return (
                    <div key={card.id} className={s.rpgCard} data-rarity={card.rarity}>
                      {card.image && <img className={s.rpgCardArt} src={card.image} alt="" loading="lazy" />}
                      <span className={s.rpgCardMeta}>
                        <strong>{card.name}</strong>
                        <small>{leader ? 'Лидер' : inTeam ? 'В отряде' : 'В запасе'} · {rarityNames[card.rarity]}</small>
                      </span>
                      <div className={s.detailActions}>
                        <button type="button" className={s.secondaryAction} aria-pressed={inTeam} onClick={() => toggleTeam(card)}>
                          {inTeam ? 'Убрать' : 'В отряд'}
                        </button>
                        {inTeam && !leader && (
                          <button type="button" className={s.secondaryAction} onClick={() => rpg.setTeam(card.id, rpg.state.team.memberIds)}>
                            Сделать лидером
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={s.skillList}>
                <h3 className={s.groupTitle}>Бонусы отряда</h3>
                {rpg.buffs.length === 0 ? <p className={s.hint}>Бонусы появятся после выбора отряда.</p> : rpg.buffs.map((buff) => (
                  <div key={`${buff.label}-${buff.stat}`} className={s.skillItem}><strong>+{buff.percent}%</strong> {buff.label}</div>
                ))}
              </div>
            </Panel>
          )}

          {section === 'arena' && (
            <Panel title="Арена PvP" subtitle="Подбор соперников в диапазоне ±150 рейтинга. Бой идёт автоматически.">
              <div className={s.leagueHeader}>
                <span className={s.leagueBadge}>{league.name}</span>
                <div className={s.leagueMeta}>
                  <strong>{formatCount(rpg.state.rating)} рейтинга</strong>
                  <span>{rpg.state.wins} побед · {rpg.state.losses} поражений · серия {rpg.state.streak}</span>
                </div>
              </div>
              <div className={s.progressTrack}><span className={s.progressFill} style={{ width: `${leagueProgress}%` }} /></div>
              <p className={s.hint}>{nextLeague ? `До ${nextLeague.name}: ${formatCount(nextLeague.min - rpg.state.rating)} рейтинга.` : 'Высшая лига достигнута.'}</p>

              <div className={s.opponentCard}>
                <span className={s.eyebrow}>Соперник</span>
                <strong>{opponent.name}</strong>
                <span>{opponent.rating} рейтинга · поиск ±150</span>
                <button type="button" className={s.primaryAction} disabled={rpg.teamCards.length === 0} onClick={runPvp}>
                  Начать бой
                </button>
              </div>
              <p className={s.hint}>Сезон длится 30 дней. Награды: Token, карточки, рамки и титулы. Сброс рейтинта — 60% от текущего.</p>
              <div className={s.detailActions}>
                <button type="button" className={s.secondaryAction}
                  disabled={rpg.state.seasonClaimed >= rpg.season.index}
                  onClick={() => report(rpg.claimSeason())}>
                  {rpg.state.seasonClaimed >= rpg.season.index ? 'Награда сезона получена' : 'Завершить сезон и получить награду'}
                </button>
                <Link className={s.panelLink} to="/shop">Паки с карточками →</Link>
              </div>
              {battle && <BattleLog battle={battle} />}
            </Panel>
          )}

          {section === 'pve' && (
            <Panel title="PvE-испытания" subtitle="Сюжет, башня, боссы, ежедневные задания и рейды.">
              <div className={s.stageList}>
                {pveStages.map((stage) => (
                  <article key={stage.id} className={s.stageCard}>
                    <div>
                      <span className={s.eyebrow}>{stage.mode}</span>
                      <h3 className={s.panelTitle}>{stage.name}</h3>
                      <p className={s.panelSubtitle}>{stage.description}</p>
                      <span className={s.hint}>
                        Сложность {stage.difficulty} · +{stage.reward.tokens} Token · +{stage.reward.shards} осколков · {rarityNames[stage.reward.rarity]}
                      </span>
                    </div>
                    <button type="button" className={s.secondaryAction} onClick={() => runPve(stage.id)}>Сразиться</button>
                  </article>
                ))}
              </div>
              <div className={s.skillList}>
                <h3 className={s.groupTitle}>Ежедневные задания</h3>
                {dailyQuests.map((quest) => {
                  const key = questKey(quest.id);
                  const claimed = rpg.state.claimedQuests.includes(key);
                  return (
                    <div key={quest.id} className={s.skillItem}>
                      <div><strong>{quest.title}</strong><small>{quest.description}</small></div>
                      <button type="button" className={s.secondaryAction} disabled={claimed}
                        onClick={() => report(rpg.claimQuest(quest.id))}>
                        {claimed ? 'Получено' : `+${quest.reward.tokens} Token`}
                      </button>
                    </div>
                  );
                })}
              </div>
              {battle && <BattleLog battle={battle} />}
            </Panel>
          )}

          {section === 'trade' && (
            <Panel title="Обмен карточками" subtitle="Предложите свою карточку и выберите одну из двух взамен.">
              <div className={s.detailActions}>
                {tradePartners.map((partner) => (
                  <button key={partner.id} type="button" className={s.secondaryAction}
                    aria-pressed={tradePartner.id === partner.id}
                    onClick={() => { setTradePartnerId(partner.id); setTradeTakeId(null); }}>
                    {partner.name} · {rarityNames[partner.rarity]}
                  </button>
                ))}
              </div>
              <p className={s.hint}>Соперник: {tradePartner.rating} рейтинга · комиссия сделки зависит от вашей карточки.</p>
              <div className={s.rpgCardGrid}>
                {tradeOfferCards.map((card) => (
                  <button key={card.id} type="button" className={s.rpgCard} data-rarity={card.rarity}
                    data-selected={tradeTaken?.id === card.id} aria-pressed={tradeTaken?.id === card.id}
                    onClick={() => setTradeTakeId(card.id)}>
                    {card.image && <img className={s.rpgCardArt} src={card.image} alt="" loading="lazy" />}
                    <span className={s.rpgCardMeta}>
                      <strong>{card.name}{card.limited && ' ✦'}</strong>
                      <small>{rarityNames[card.rarity]} · {card.revealed ? 'характеристики открыты' : 'характеристики скрыты'}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className={s.gearRow}>
                <label>
                  <span className={s.detailLabel}>Отдаёте</span>
                  <select value={tradeGive?.id ?? ''} onChange={(event) => setTradeGiveId(event.target.value)}>
                    {rpg.cards.map((card) => (
                      <option key={card.id} value={card.id}>{card.name} · {rarityNames[card.rarity]}</option>
                    ))}
                  </select>
                </label>
                <span className={s.hint}>Комиссия: {tradeCost} Token</span>
                <button type="button" className={s.primaryAction} disabled={!tradeGive || !tradeTaken}
                  onClick={() => report(rpg.tradeCard(tradeGive!.id, tradePartner.id, tradeTaken.id))}>
                  Обменять
                </button>
              </div>
            </Panel>
          )}

          {section === 'achievements' && (
            <Panel title="Достижения" subtitle="За особые успехи выдаются Token и лимитированные карточки.">
              <div className={s.skillList}>
                {achievements.map((achievement) => {
                  const claimed = rpg.state.claimedAchievements.includes(achievement.id);
                  const available = unlocked.includes(achievement.id);
                  return (
                    <div key={achievement.id} className={s.skillItem}>
                      <div>
                        <strong>{achievement.title}{achievement.reward.limited && ' ✦'}</strong>
                        <small>{achievement.description}</small>
                      </div>
                      <button type="button" className={s.secondaryAction} disabled={claimed || !available}
                        onClick={() => report(rpg.claimAchievement(achievement.id))}>
                        {claimed ? 'Получено' : available ? 'Забрать' : 'Не выполнено'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className={s.hint}>Лимитированные карточки помечены ✦. Их нельзя получить в обычном паке.</p>
            </Panel>
          )}

          {section === 'rating' && (
            <Panel title="Таблица лидеров" subtitle="Недельный и сезонный рейтинг сервера.">
              <div className={s.detailActions}>
                <button type="button" className={s.secondaryAction} aria-pressed={ratingTab === 'weekly'}
                  onClick={() => setRatingTab('weekly')}>Неделя</button>
                <button type="button" className={s.secondaryAction} aria-pressed={ratingTab === 'season'}
                  onClick={() => setRatingTab('season')}>Сезон</button>
              </div>
              <p className={s.hint}>{ratingTab === 'weekly'
                ? 'Недельный рейтинг: эксклюзивные титулы за первые места.'
                : `Сезон ${new Date(rpg.season.start).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}: рамки профиля и титулы по лиге.`}</p>
              <div className={s.leaderboard}>
                {[...demoOpponents, { name: `${profile.name} (вы)`, rating: rpg.state.rating }]
                  .sort((a, b) => b.rating - a.rating)
                  .map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className={s.leaderRow} data-me={entry.name.includes('(вы)')}>
                      <span className={s.leaderPlace}>{index + 1}</span>
                      <strong>{entry.name}</strong>
                      <span>{leagueFor(entry.rating).name}</span>
                      <strong>{formatCount(entry.rating)}</strong>
                    </div>
                  ))}
              </div>
              <div className={s.skillList}>
                <h3 className={s.groupTitle}>Награды сезона · {league.name}</h3>
                {seasonRewards(league.id).cosmetics.map((item) => <div key={item} className={s.skillItem}>{item}</div>)}
                <div className={s.skillItem}>+{seasonRewards(league.id).tokens} Token</div>
                <div className={s.skillItem}>+{seasonRewards(league.id).shards} осколков</div>
              </div>
              <div className={s.skillList}>
                <h3 className={s.groupTitle}>Бонусы коллекции</h3>
                {bonuses.labels.length === 0
                  ? <p className={s.hint}>Соберите 10 персонажей и легендарных карточек, чтобы открыть бонусы.</p>
                  : bonuses.labels.map((label) => <div key={label} className={s.skillItem}>{label}</div>)}
              </div>
              <p className={s.hint}>История боёв обновлена {rpg.state.history[0] ? formatShortDate(rpg.state.history[0].at) : 'ещё недавно'}.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function BattleLog({ battle }: { battle: BattleView }) {
  return (
    <div className={s.battleLog}>
      <h3 className={s.groupTitle}>{battle.title}</h3>
      <p className={s.hint}>{battle.detail}</p>
      <div className={s.battleLines}>
        {battle.log.map((line, index) => (
          <p key={`${index}-${line.text}`} className={s.battleLine}><span>r{line.round}</span> {line.text}</p>
        ))}
      </div>
    </div>
  );
}

type RpgApi = ReturnType<typeof useRpgState>;

function CardDetail({ card, rpg, report }: { card: RpgCard; rpg: RpgApi; report: (result: RpgActionResult) => void }) {
  const stats = rpg.stats(card);
  const nextRank = rpg.state.cards.find((entry) => entry.id === card.id)?.rank;
  const preview = card.pending;

  return (
    <div className={s.rpgDetail}>
      <div className={s.rpgDetailHead}>
        <div>
          <span className={s.eyebrow}>{rarityNames[card.rarity]} · {card.rank}{card.limited && ' · Лимитированная'}</span>
          <h2 className={s.panelTitle}>{card.name}</h2>
          <p className={s.panelSubtitle}>Уровень {card.level} из 20 · копий {card.copies} · осколков {card.shards} · {formatCount(cardPower(card))} силы</p>
        </div>
        {!card.revealed && (
          <button type="button" className={s.primaryAction} onClick={() => report(rpg.reveal(card.id))}>
            Раскрыть за {revealCost[card.rarity]} Token
          </button>
        )}
      </div>

      {!card.revealed ? (
        <p className={s.hint}>До раскрытия известны только имя, внешний вид и редкость. Характеристики и навыки скрыты.</p>
      ) : (
        <>
          <div className={s.statLines}>
            {statKeys.map((key) => {
              const after = preview ? preview.before[key] : null;
              return (
                <div key={key} className={s.statLine}>
                  <span>{statNames[key]}</span>
                  <strong>{stats[key]}</strong>
                  {preview && after !== null && (
                    <span className={s.statDelta} data-positive={card.stats[key] >= after}>
                      {card.stats[key] >= after ? '+' : ''}{Math.round((card.stats[key] - after) * 10) / 10}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {preview && (
            <div className={s.choiceBox}>
              <strong>Новый результат улучшения</strong>
              <p className={s.hint}>Характеристики пересчитаны отдельно. Оставьте результат или потратьте предмет на перегенерацию.</p>
              <div className={s.detailActions}>
                <button type="button" className={s.primaryAction} onClick={() => rpg.confirmLevel(card.id)}>Оставить</button>
                <button type="button" className={s.secondaryAction} onClick={() => report(rpg.rerollLevel(card.id))}>
                  Перегенерировать · {rpg.state.rerollItems}
                </button>
              </div>
            </div>
          )}

          <div className={s.detailActions}>
            <button type="button" className={s.secondaryAction}
              disabled={card.level >= 20 || Boolean(card.pending)} onClick={() => report(rpg.levelUp(card.id))}>
              {card.level >= 20 ? 'Максимальный уровень' : `Улучшить · ${levelCost(card.level)} Token`}
            </button>
            <button type="button" className={s.secondaryAction}
              disabled={card.level >= 20 || Boolean(card.pending) || rpg.state.materials < 1}
              onClick={() => report(rpg.levelUp(card.id, true))}>
              С материалом · −1 материал
            </button>
            <button type="button" className={s.secondaryAction} disabled={!card.copies || nextRank === 'SSS'}
              onClick={() => report(rpg.promote(card.id))}>
              Повысить ранг · копия
            </button>
            <button type="button" className={s.secondaryAction} disabled={rpg.state.shards < shardCost[card.rank] || nextRank === 'SSS'}
              onClick={() => report(rpg.promote(card.id, true))}>
              Повысить ранг · {shardCost[card.rank]} осколков
            </button>
          </div>

          <div className={s.skillList}>
            <h3 className={s.groupTitle}>Навыки</h3>
            {card.skills.length === 0 && <p className={s.hint}>Навыки откроются на 5, 10, 15 и 20 уровне.</p>}
            {card.skills.map((skill) => (
              <div key={skill.id} className={s.skillItem}>
                <div><strong>{skill.name}</strong><small>{skill.description}</small></div>
                <button type="button" className={s.secondaryAction} onClick={() => report(rpg.changeSkill(card.id, skill.id))}>
                  Заменить · {rpg.state.skillResetItems}
                </button>
              </div>
            ))}
          </div>

          <div className={s.gearRow}>
            <label>
              <span className={s.detailLabel}>Артефакт</span>
              <select value={card.artifact?.id ?? ''} onChange={(event) => rpg.equipArtifact(card.id, event.target.value || null)}>
                <option value="">Нет</option>
                {artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.name}</option>)}
              </select>
            </label>
            <label>
              <span className={s.detailLabel}>Руна</span>
              <select value={card.runes[0]?.id ?? ''} onChange={(event) => event.target.value && rpg.addRune(card.id, event.target.value)}>
                <option value="">Нет</option>
                {runePool.map((rune) => <option key={rune.id} value={rune.id}>{rune.name}</option>)}
              </select>
            </label>
            <button type="button" className={s.secondaryAction} disabled={card.runes.length === 0} onClick={() => report(rpg.rerollRune(card.id))}>
              Перегенерировать руну · 1 осколок
            </button>
          </div>

          <div className={s.detailActions}>
            <button type="button" className={s.secondaryAction}
              onClick={() => report(rpg.dismantle(card.id))}>
              Разобрать · +{dismantleCard(card).tokens} Token
            </button>
          </div>
        </>
      )}
    </div>
  );
}
