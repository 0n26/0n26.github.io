import { cardPower, defaultCardFlags, dustForRank } from './logic';
import type {
  CardSet, CollectionState, CommunityOverview, InventoryItem, ShopCatalog, UserProfile, WatchCard,
} from './types';

const demoHandle = 'night-owl';

/** Локальная графика: постеры и паки не зависят от стороннего CDN. */
const images = {
  skybreaker: '/images/poster-skybreaker.svg',
  bluehour: '/images/poster-bluehour.svg',
  foxspirit: '/images/poster-foxspirit.svg',
  aoasi: '/images/poster-aoasi.svg',
  starfall: '/images/poster-starfall.svg',
  neon: '/images/poster-neon.svg',
};

interface CardSeed {
  id: string;
  title: string;
  episode: number;
  image: string;
  rank: WatchCard['rank'];
  setId: string;
  note: string;
  level?: number;
  copies?: number;
  frame?: WatchCard['frame'];
  animated?: boolean;
  animationReady?: boolean;
  special?: boolean;
  favorite?: boolean;
  exchangeable?: boolean;
  awakened?: boolean;
  locked?: boolean;
  potential?: WatchCard['potential'];
  watchedAt?: string;
  progress?: number;
}

function card(seed: CardSeed): WatchCard {
  const base: WatchCard = {
    id: seed.id,
    title: seed.title,
    episode: seed.episode,
    episodeLabel: `Серия ${seed.episode}`,
    image: seed.image,
    watchedAt: seed.watchedAt ?? '2026-11-20T21:00:00+03:00',
    progress: seed.progress ?? 45,
    rank: seed.rank,
    note: seed.note,
    href: `/?q=${encodeURIComponent(seed.title)}`,
    setId: seed.setId,
    level: seed.level ?? 0,
    copies: seed.copies ?? 1,
    frame: seed.frame ?? 'blue',
    animated: seed.animated ?? false,
    animationReady: seed.animationReady ?? false,
    special: seed.special ?? false,
    power: 0,
    favorite: seed.favorite ?? false,
    exchangeable: seed.exchangeable ?? true,
    awakened: seed.awakened ?? false,
    locked: seed.locked ?? false,
    potential: seed.potential ?? 'Обычная',
    dustValue: dustForRank(seed.rank),
  };
  return { ...base, power: cardPower(base) };
}

/** Полный каталог: отсюда паки выдают карточки, включая ещё не собранные. */
export const cardCatalog: readonly WatchCard[] = [
  card({ id: 'c1', title: 'Рассекая небосвод', episode: 19, image: images.skybreaker, rank: 'S', setId: 'sky', note: 'Самый ожидаемый эпизод сезона.', level: 7, frame: 'violet', animated: true, animationReady: true, special: true, favorite: true, exchangeable: false, potential: 'Легендарная', watchedAt: '2026-11-22T18:40:00+03:00', progress: 72 }),
  card({ id: 'c2', title: 'Ао Аси 2', episode: 8, image: images.aoasi, rank: 'C', setId: 'green', note: 'Спокойный вечерний футбол.', copies: 3, watchedAt: '2026-11-22T15:10:00+03:00', progress: 40 }),
  card({ id: 'c3', title: 'Голубая шкатулка 2', episode: 7, image: images.bluehour, rank: 'A', setId: 'warm', note: 'Тёплый финал арки.', level: 4, frame: 'white', animationReady: true, favorite: true, watchedAt: '2026-11-20T20:45:00+03:00', progress: 88 }),
  card({ id: 'c4', title: 'Ледяная стена 2', episode: 9, image: images.starfall, rank: 'P', setId: 'night', note: 'Очень красивая анимация боя.', level: 2, frame: 'step', watchedAt: '2026-11-19T21:05:00+03:00', progress: 60 }),
  card({ id: 'c5', title: 'Токийские мстители', episode: 9, image: images.neon, rank: 'S', setId: 'neon', note: 'Сцена, которую стоит пересмотреть.', level: 11, frame: 'violet', animated: true, special: true, potential: 'Эпическая', watchedAt: '2026-11-18T19:23:00+03:00', progress: 35 }),
  card({ id: 'c6', title: 'Во всеоружии: Сила артефактов', episode: 9, image: images.foxspirit, rank: 'D', setId: 'warm', note: 'Лёгкий сериал на фоне.', copies: 5, watchedAt: '2026-11-17T18:30:00+03:00', progress: 20 }),
  card({ id: 'c7', title: 'Свадьба светлячков', episode: 7, image: images.bluehour, rank: 'B', setId: 'warm', note: 'Неожиданно трогательная история.', animationReady: true, watchedAt: '2026-11-16T22:15:00+03:00', progress: 55 }),
  card({ id: 'c8', title: 'Даже у студсовета есть косяки!', episode: 9, image: images.aoasi, rank: 'E', setId: 'green', note: 'Идеально перед сном.', copies: 2, watchedAt: '2026-11-15T18:30:00+03:00', progress: 45 }),
  card({ id: 'c9', title: 'Рассекая небосвод', episode: 12, image: images.skybreaker, rank: 'G', setId: 'sky', note: 'Арка неба собирается по кусочкам.' }),
  card({ id: 'c10', title: 'Ледяная стена 2', episode: 4, image: images.starfall, rank: 'H', setId: 'night', note: 'Первый холодный рывок сезона.' }),
  card({ id: 'c11', title: 'Неоновый город', episode: 11, image: images.neon, rank: 'X', setId: 'neon', note: 'Карта из удалённого тайтла. Выпадает крайне редко.', special: true, frame: 'violet', animationReady: true, potential: 'Мифическая' }),
  card({ id: 'c12', title: 'Лис и полуночный чай', episode: 3, image: images.foxspirit, rank: 'V', setId: 'warm', note: 'Секретная карта клубного события.', special: true }),
  card({ id: 'c13', title: 'Звёздный десант', episode: 6, image: images.starfall, rank: 'N', setId: 'night', note: 'Тёмная рамка ночного марафона.' }),
  card({ id: 'c14', title: 'Порочный круг', episode: 2, image: images.neon, rank: 'L', setId: 'neon', note: 'Светлая клубная рамка.' }),
  card({ id: 'c15', title: 'Сезон дождей', episode: 5, image: images.bluehour, rank: 'K', setId: 'warm', note: 'Карта клуба-победителя недели.' }),
  card({ id: 'c16', title: 'Архив старых серий', episode: 1, image: images.aoasi, rank: 'W', setId: 'green', note: 'Карта из закрытого архива.' }),
];

const ownedIds = new Set(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']);

const cardSets: readonly CardSet[] = [
  { id: 'sky', name: 'Небо над городом', series: 'Рассекая небосвод', description: 'Серии о больших решениях и ещё большем небе.', cover: images.skybreaker, bonus: '+10% опыта за серии сезона' },
  { id: 'warm', name: 'Тёплые истории', series: 'Голубая шкатулка', description: 'Камерные вечера и тихие финалы.', cover: images.bluehour, bonus: '+5 алмазной пыли за набор' },
  { id: 'night', name: 'Ночной дозор', series: 'Ледяная стена', description: 'Холодные бои и длинные ночи.', cover: images.starfall, bonus: '+8% силы карточек' },
  { id: 'neon', name: 'Неоновый район', series: 'Токийские мстители', description: 'Город, который никогда не спит.', cover: images.neon, bonus: '+1 выбор в паке' },
  { id: 'green', name: 'Зелёный газон', series: 'Ао Аси', description: 'Спокойные истории и свои люди.', cover: images.aoasi, bonus: '+3 свитка заточки' },
];

const demoShop: ShopCatalog = {
  packs: [
    {
      id: 'starter', name: 'Утренний пак', description: 'Одна карточка на начало дня. Хороший шанс собрать дубли.',
      price: 70, currency: 'diamonds', amount: 1, accent: '#5da9e9', featured: true,
      image: '/images/pack-morning.svg',
      note: 'Базовая гарантия: не ниже ранга E',
      dropTable: [
        { rank: 'E', weight: 34 }, { rank: 'D', weight: 24 }, { rank: 'C', weight: 16 },
        { rank: 'B', weight: 11 }, { rank: 'G', weight: 7 }, { rank: 'P', weight: 4 },
        { rank: 'A', weight: 2.5 }, { rank: 'S', weight: 1.2 }, { rank: 'X', weight: 0.3 },
      ],
    },
    {
      id: 'season', name: 'Сезонный набор', description: 'Три карточки из текущего сезона с гарантией ранга A.',
      price: 320, currency: 'diamonds', amount: 3, guarantee: 'A', accent: '#f54972',
      image: '/images/pack-season.svg',
      note: 'Гарантия: хотя бы одна карта ранга A или выше',
      dropTable: [
        { rank: 'C', weight: 26 }, { rank: 'B', weight: 22 }, { rank: 'G', weight: 17 },
        { rank: 'P', weight: 13 }, { rank: 'A', weight: 10 }, { rank: 'S', weight: 8 },
        { rank: 'X', weight: 4 },
      ],
    },
    {
      id: 'legend', name: 'Пак легенд', description: 'Пять карточек с повышенным шансом редких рангов.',
      price: 900, currency: 'diamonds', amount: 5, guarantee: 'S', accent: '#a95cff',
      image: '/images/pack-legend.svg',
      note: 'Гарантия: карта ранга S или X',
      dropTable: [
        { rank: 'P', weight: 24 }, { rank: 'A', weight: 27 }, { rank: 'S', weight: 28 },
        { rank: 'X', weight: 12 }, { rank: 'G', weight: 9 },
      ],
    },
    {
      id: 'dust', name: 'Пылевой набор', description: 'Два открытия за пыль, собранную с дублей.',
      price: 600, currency: 'dust', amount: 2, accent: '#83c9a6',
      image: '/images/pack-dust.svg',
      note: 'Пыль можно получить за переплавку дублей',
      dropTable: [
        { rank: 'E', weight: 28 }, { rank: 'D', weight: 30 }, { rank: 'C', weight: 20 },
        { rank: 'B', weight: 12 }, { rank: 'G', weight: 7 }, { rank: 'P', weight: 3 },
      ],
    },
  ],
  cosmetics: [
    { id: 'av-fox', name: 'Аватар «Лис»', description: 'Хитрый спутник ночных марафонов.', price: 300, currency: 'diamonds', category: 'avatar', icon: '🦊', accent: '#df9300', discount: 500 },
    { id: 'av-moon', name: 'Аватар «Луна»', description: 'Для тех, кто смотрит после полуночи.', price: 400, currency: 'diamonds', category: 'avatar', icon: '🌙', accent: '#8b00ff' },
    { id: 'fr-violet', name: 'Рамка «Фиолет»', description: 'Рамка профиля с мягким свечением.', price: 600, currency: 'diamonds', category: 'frame', icon: '▣', accent: '#a95cff' },
    { id: 'cv-neon', name: 'Обложка «Неон»', description: 'Профиль в стиле позднего города.', price: 500, currency: 'diamonds', category: 'cover', icon: '🌆', accent: '#f54972' },
    { id: 'st-marathon', name: 'Статус «Марафонец»', description: '24 серии за один вечер — и только вперёд.', price: 200, currency: 'diamonds', category: 'status', icon: '⚡', accent: '#df9300' },
    { id: 'booster-xp', name: 'Бустер опыта ×2', description: 'Удвоенный опыт за серии на один вечер.', price: 250, currency: 'dust', category: 'boost', icon: '⚗️', accent: '#5da9e9' },
  ],
};

function item(
  id: string, name: string, slot: InventoryItem['slot'], rank: InventoryItem['rank'],
  icon: string, description: string, bonuses: readonly string[], level = 0, quantity = 1,
  equipped = false, setId?: string,
): InventoryItem {
  return {
    id, name, description, slot, rank, icon, quantity, level, bonuses, setId,
    value: 40 + level * 20, equipped, acquiredAt: '2026-09-12',
  };
}

const inventory: readonly InventoryItem[] = [
  item('i1', 'Плащ комментатора', 'aura', 'A', '🧥', 'Ваш ник выделяется в обсуждениях.', ['+8% репутации'], 3, 1, true),
  item('i2', 'Шляпа полуночи', 'avatar', 'S', '🎩', 'Тёмная шляпа с маленькой луной.', ['+12% опыта', 'ночной статус'], 5),
  item('i3', 'Очки зрителя', 'avatar', 'C', '👓', 'Для тех, кто смотрит титры до конца.', ['+3% опыта'], 0, 2),
  item('i4', 'Фон «Неон-город»', 'cover', 'X', '🌆', 'Обложка профиля в стиле позднего города.', ['+20% репутации', 'редкая обложка'], 2, 1, true, 'neon'),
  item('i5', 'Фон «Осенний сезон»', 'cover', 'B', '🍁', 'Листья, плед и новая серия.', ['+5% опыта'], 0, 3),
  item('i6', 'Аватар «Сова»', 'avatar', 'A', '🦉', 'Ваш текущий аватар.', ['+10% силы карточек'], 4, 1, true),
  item('owned-av-fox', 'Аватар «Лис»', 'avatar', 'B', '🦊', 'Хитрый спутник ночных марафонов.', ['+6% удачи в паках'], 1),
  item('i8', 'Рама «Фиолет»', 'frame', 'S', '▣', 'Свечение для карточек и профиля.', ['+15% силы карточек'], 6, 1, true),
  item('i9', 'Рама «Дуб»', 'frame', 'C', '◫', 'Тёплая классическая рамка.', ['+4% репутации'], 0, 2),
  item('i10', 'Статус «Ночной смотритель»', 'status', 'A', '🌙', 'Виден всем в сообществе.', ['+7% опыта'], 2, 1, true),
  item('i11', 'Бустер «Сёнен»', 'boost', 'G', '🗡️', 'Опыт за серии длинных сериалов.', ['+25% опыта за сериал'], 0, 5),
  item('i12', 'Бустер «Алмазная пыль»', 'boost', 'P', '⚗️', 'Больше пыли за переплавку.', ['+30% пыли'], 1, 2),
];

const profile: UserProfile = {
  id: 'u-1001',
  handle: demoHandle,
  name: 'Ночной Фонарь',
  presence: 'online',
  status: 'Досматриваю серию перед сном. Не беспокоить до титров.',
  country: 'Россия',
  joinedAt: '2022-04-18',
  bio: 'Смотрю аниме по расписанию, собираю карточки за серии и спорю об озвучке в комментариях. Люблю длинные сериалы и короткие ночи.',
  level: 42,
  xp: 2380,
  xpToNext: 3200,
  banner: ['#123b57', '#6b3a8c'],
  bannerImage: '/images/community-banner.svg',
  avatar: ['#f6b64d', '#e05f85'],
  avatarIcon: '🦉',
  avatarImage: '/images/avatar-owl.svg',
  stats: { episodes: 1842, watchHours: 736, titles: 214, reviews: 38, friends: 56, reputation: 921 },
  badges: [
    { id: 'b1', name: 'Ночной смотритель', description: '100 серий после полуночи', icon: '🌙', level: 12, xp: 900, progress: 74, rare: true },
    { id: 'b2', name: 'Первый эпизод', description: 'Начатый сериал досмотрен', icon: '🎬', level: 8, xp: 640, progress: 100 },
    { id: 'b3', name: 'Коллекционер', description: '100 тайтлов в избранном', icon: '📚', level: 6, xp: 480, progress: 82 },
    { id: 'b4', name: 'Голос сообщества', description: '50 полезных комментариев', icon: '💬', level: 5, xp: 400, progress: 60 },
    { id: 'b5', name: 'Утренний кофе', description: '30 дней подряд на сайте', icon: '☕', level: 4, xp: 320, progress: 100 },
    { id: 'b6', name: 'Марафонец', description: '24 серии за один вечер', icon: '🏃', level: 3, xp: 240, progress: 45 },
    { id: 'b7', name: 'Знаток жанров', description: '20 жанров в профиле', icon: '🎭', level: 2, xp: 160, progress: 100 },
    { id: 'b8', name: 'Новичок', description: 'Добро пожаловать в сообщество', icon: '⭐', level: 1, xp: 80, progress: 100 },
  ],
  favorites: [
    { id: 'f1', name: 'Рассекая небосвод', poster: images.skybreaker, href: `/?q=${encodeURIComponent('Рассекая небосвод')}`, progress: 72, rating: 9.3, note: 'Серия 19 из 26' },
    { id: 'f2', name: 'Ао Аси 2', poster: images.aoasi, href: `/?q=${encodeURIComponent('Ао Аси')}`, progress: 40, rating: 8.9, note: 'Серия 8 из 12' },
    { id: 'f3', name: 'Голубая шкатулка 2', poster: images.bluehour, href: `/?q=${encodeURIComponent('Голубая шкатулка')}`, progress: 88, rating: 8.6, note: 'Серия 7 из 12' },
    { id: 'f4', name: 'Токийские мстители', poster: images.neon, href: `/?q=${encodeURIComponent('Токийские мстители')}`, progress: 35, rating: 8.5, note: 'Серия 9 из 13' },
    { id: 'f5', name: 'Ледяная стена 2', poster: images.starfall, href: `/?q=${encodeURIComponent('Ледяная стена')}`, progress: 60, rating: 8.7, note: 'Серия 9 из 12' },
    { id: 'f6', name: 'Во всеоружии: Сила артефактов', poster: images.foxspirit, href: `/?q=${encodeURIComponent('Во всеоружии')}`, progress: 20, rating: 8.3, note: 'Серия 9 из 12' },
  ],
  cards: cardCatalog.filter((entry) => ownedIds.has(entry.id)),
  cardSets,
  albums: [
    { id: 'al1', name: 'Осенний марафон', description: 'Серии, которые хочется пересмотреть зимой.', cardIds: ['c1', 'c4', 'c7'] },
    { id: 'al2', name: 'Короткое и тёплое', description: 'Небольшие истории на один вечер.', cardIds: ['c3', 'c6', 'c8'] },
  ],
  inventory,
  friends: [
    { id: 'u-2001', name: 'Сакура_77', icon: '🌸', presence: 'online', status: 'Смотрит «Не ревнуй, Асука»' },
    { id: 'u-2002', name: 'Кодзима', icon: '🎧', presence: 'online', status: 'В плеере · 1080p' },
    { id: 'u-2003', name: 'Тёплый плед', icon: '🧣', presence: 'away', status: 'Отошёл за чаем' },
    { id: 'u-2004', name: 'Сэм', icon: '🦊', presence: 'busy', status: 'Не беспокоить' },
    { id: 'u-2005', name: 'Лунатик', icon: '🌌', presence: 'offline', status: 'Был в сети вчера' },
    { id: 'u-2006', name: 'Тайтл-менеджер', icon: '🗂️', presence: 'online', status: 'Составляет список на сезон' },
  ],
  groups: [
    { id: 'g1', name: 'Клуб ночного сеанса', icon: '🌃', members: 1284, role: 'Основатель' },
    { id: 'g2', name: 'Субтитры против озвучки', icon: '🔊', members: 892, role: 'Модератор' },
    { id: 'g3', name: 'Сезонные зависимости', icon: '🍂', members: 3410 },
    { id: 'g4', name: 'Сто серий в день', icon: '⚡', members: 476 },
  ],
  activity: [
    { id: 'a1', kind: 'card', title: 'Заточена карточка «Рассекая небосвод»', detail: 'Уровень 7 · новая фиолетовая рамка', at: '2026-11-22T18:40:00+03:00', href: '/profile?tab=cards' },
    { id: 'a2', kind: 'pack', title: 'Открыт «Сезонный набор»', detail: 'Выпала карточка ранга A', at: '2026-11-22T17:25:00+03:00', href: '/shop' },
    { id: 'a3', kind: 'badge', title: 'Получен значок «Ночной смотритель»', detail: 'Уровень 12 · +900 опыта', at: '2026-11-21T23:10:00+03:00' },
    { id: 'a4', kind: 'review', title: 'Отзыв о «Голубой шкатулке 2»', detail: '«Камерная история с очень тёплым концом»', at: '2026-11-20T21:05:00+03:00' },
    { id: 'a5', kind: 'inventory', title: 'Экипирован «Плащ комментатора»', detail: 'Эпический предмет коллекции', at: '2026-11-19T19:30:00+03:00' },
    { id: 'a6', kind: 'friend', title: 'Сакура_77 добавилась в друзья', detail: 'Теперь в сообществе 56 друзей', at: '2026-11-18T12:15:00+03:00' },
  ],
  history: [
    { id: 'h1', name: 'Рассекая небосвод', episode: 'Серия 19', at: '2026-11-22T18:40:00+03:00', href: `/?q=${encodeURIComponent('Рассекая небосвод')}` },
    { id: 'h2', name: 'Ледяная стена 2', episode: 'Серия 9', at: '2026-11-22T17:25:00+03:00', href: `/?q=${encodeURIComponent('Ледяная стена')}` },
    { id: 'h3', name: 'Голубая шкатулка 2', episode: 'Серия 7', at: '2026-11-21T22:10:00+03:00', href: `/?q=${encodeURIComponent('Голубая шкатулка')}` },
    { id: 'h4', name: 'Токийские мстители', episode: 'Серия 9', at: '2026-11-20T20:45:00+03:00', href: `/?q=${encodeURIComponent('Токийские мстители')}` },
    { id: 'h5', name: 'Ао Аси 2', episode: 'Серия 8', at: '2026-11-19T19:05:00+03:00', href: `/?q=${encodeURIComponent('Ао Аси')}` },
  ],
  diamonds: 1240,
  dust: 380,
};

const overview: CommunityOverview = {
  online: 1284,
  members: 48210,
  discussionsToday: 316,
  events: [
    { id: 'e1', name: 'Ночь длинных серий', when: '28 ноября, 22:00', participants: 218, icon: '🌙' },
    { id: 'e2', name: 'Обсуждение осеннего сезона', when: '30 ноября, 19:00', participants: 94, icon: '🍂' },
    { id: 'e3', name: 'Турнир знатоков жанров', when: '3 декабря, 18:30', participants: 57, icon: '🏆' },
  ],
  discussions: [
    { id: 'd1', title: 'Какая озвучка стала лучше в этом сезоне?', section: 'Обсуждения', author: 'Кодзима', replies: 128, at: '2026-11-22T16:20:00+03:00' },
    { id: 'd2', title: 'Список тайтлов для долгой зимы', section: 'Подборки', author: 'Тёплый плед', replies: 74, at: '2026-11-22T14:05:00+03:00' },
    { id: 'd3', title: 'Как вы храните историю просмотров?', section: 'Вопросы', author: 'Сэм', replies: 41, at: '2026-11-21T21:35:00+03:00' },
    { id: 'd4', title: 'Колоды карточек: покажите свои подборки', section: 'Коллекционеры', author: 'Тайтл-менеджер', replies: 33, at: '2026-11-21T18:10:00+03:00' },
  ],
  topProfiles: [
    { id: 'u-3001', name: 'Аниме-архивариус', icon: '📼', level: 87 },
    { id: 'u-3002', name: 'Субтитр-мастер', icon: '📝', level: 79 },
    { id: 'u-3003', name: 'Полночный марафон', icon: '🌗', level: 74 },
    { id: 'u-3004', name: 'Сезонный прогноз', icon: '🔮', level: 68 },
  ],
};

export const demoHandleDefault = demoHandle;
export const demoShopCatalog = demoShop;

/** Стартовое состояние игровой коллекции для демо-профиля. */
export function demoCollection(handle: string): CollectionState {
  const source = getDemoProfile(handle);
  return {
    diamonds: source?.diamonds ?? 0,
    dust: source?.dust ?? 0,
    cardLevels: Object.fromEntries((source?.cards ?? []).map((entry) => [entry.id, entry.level])),
    cardCopies: Object.fromEntries((source?.cards ?? []).map((entry) => [entry.id, entry.copies])),
    cardFlags: Object.fromEntries((source?.cards ?? []).map((entry) => [entry.id, defaultCardFlags(entry)])),
    extraCards: [],
    extraInventory: [],
    equipped: Object.fromEntries((source?.inventory ?? []).filter((entry) => entry.equipped).map((entry) => [entry.slot, entry.id])),
    itemLevels: Object.fromEntries((source?.inventory ?? []).map((entry) => [entry.id, entry.level])),
    pity: { s: 0, x: 0, xl: 0 },
    packHistory: [],
  };
}

/** Демо-реализация: данные живут в памяти и заменяются backend-адаптером. */
export function getDemoProfile(handle: string): UserProfile {
  if (handle.toLowerCase() === demoHandle) return profile;
  return {
    ...profile,
    id: `u-guest-${handle}`,
    handle,
    name: handle,
    avatarIcon: '👤',
    avatarImage: undefined,
    status: 'Профиль сообщества',
    level: 1,
    xp: 0,
    stats: { episodes: 0, watchHours: 0, titles: 0, reviews: 0, friends: 0, reputation: 0 },
    badges: [],
    favorites: [],
    friends: [],
    groups: [],
    inventory: [],
    activity: [],
    history: [],
    cards: [],
    cardSets: [],
    albums: [],
    diamonds: 0,
    dust: 0,
  };
}

export function getDemoOverview(): CommunityOverview {
  return overview;
}
