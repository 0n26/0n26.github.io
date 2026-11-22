import type { CommunityOverview, UserProfile } from './types';

const demoHandle = 'night-owl';
/** Локальная графика: постеры не зависят от стороннего CDN. */
const images = {
  skybreaker: '/images/poster-skybreaker.svg',
  bluehour: '/images/poster-bluehour.svg',
  foxspirit: '/images/poster-foxspirit.svg',
  aoasi: '/images/poster-aoasi.svg',
  starfall: '/images/poster-starfall.svg',
  neon: '/images/poster-neon.svg',
};

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
    { id: 'f1', name: 'Рассекая небосвод', poster: images.skybreaker, href: '/?q=' + encodeURIComponent('Рассекая небосвод'), progress: 72, rating: 9.3, note: 'Серия 19 из 26' },
    { id: 'f2', name: 'Ао Аси 2', poster: images.aoasi, href: '/?q=' + encodeURIComponent('Ао Аси'), progress: 40, rating: 8.9, note: 'Серия 8 из 12' },
    { id: 'f3', name: 'Голубая шкатулка 2', poster: images.bluehour, href: '/?q=' + encodeURIComponent('Голубая шкатулка'), progress: 88, rating: 8.6, note: 'Серия 7 из 12' },
    { id: 'f4', name: 'Токийские мстители', poster: images.neon, href: '/?q=' + encodeURIComponent('Токийские мстители'), progress: 35, rating: 8.5, note: 'Серия 9 из 13' },
    { id: 'f5', name: 'Ледяная стена 2', poster: images.starfall, href: '/?q=' + encodeURIComponent('Ледяная стена'), progress: 60, rating: 8.7, note: 'Серия 9 из 12' },
    { id: 'f6', name: 'Во всеоружии: Сила артефактов', poster: images.foxspirit, href: '/?q=' + encodeURIComponent('Во всеоружии'), progress: 20, rating: 8.3, note: 'Серия 9 из 12' },
  ],
  cards: [
    { id: 'c1', title: 'Рассекая небосвод', episode: 19, episodeLabel: 'Серия 19', image: images.skybreaker, watchedAt: '2026-11-22T18:40:00+03:00', progress: 72, rarity: 'legendary', note: 'Самый ожидаемый эпизод сезона.', href: '/?q=' + encodeURIComponent('Рассекая небосвод') },
    { id: 'c2', title: 'Ао Аси 2', episode: 8, episodeLabel: 'Серия 8', image: images.aoasi, watchedAt: '2026-11-22T15:10:00+03:00', progress: 40, rarity: 'rare', note: 'Спокойный вечерний футбол.', href: '/?q=' + encodeURIComponent('Ао Аси') },
    { id: 'c3', title: 'Голубая шкатулка 2', episode: 7, episodeLabel: 'Серия 7', image: images.bluehour, watchedAt: '2026-11-20T20:45:00+03:00', progress: 88, rarity: 'epic', note: 'Тёплый финал арки.', href: '/?q=' + encodeURIComponent('Голубая шкатулка') },
    { id: 'c4', title: 'Ледяная стена 2', episode: 9, episodeLabel: 'Серия 9', image: images.starfall, watchedAt: '2026-11-19T21:05:00+03:00', progress: 60, rarity: 'rare', note: 'Очень красивая анимация боя.', href: '/?q=' + encodeURIComponent('Ледяная стена') },
    { id: 'c5', title: 'Токийские мстители', episode: 9, episodeLabel: 'Серия 9', image: images.neon, watchedAt: '2026-11-18T19:23:00+03:00', progress: 35, rarity: 'legendary', note: 'Сцена, которую стоит пересмотреть.', href: '/?q=' + encodeURIComponent('Токийские мстители') },
    { id: 'c6', title: 'Во всеоружии: Сила артефактов', episode: 9, episodeLabel: 'Серия 9', image: images.foxspirit, watchedAt: '2026-11-17T18:30:00+03:00', progress: 20, rarity: 'common', note: 'Лёгкий сериал на фоне.', href: '/?q=' + encodeURIComponent('Во всеоружии') },
    { id: 'c7', title: 'Свадьба светлячков', episode: 7, episodeLabel: 'Серия 7', image: images.bluehour, watchedAt: '2026-11-16T22:15:00+03:00', progress: 55, rarity: 'epic', note: 'Неожиданно трогательная история.', href: '/?q=' + encodeURIComponent('Свадьба светлячков') },
    { id: 'c8', title: 'Даже у студсовета есть косяки!', episode: 9, episodeLabel: 'Серия 9', image: images.aoasi, watchedAt: '2026-11-15T18:30:00+03:00', progress: 45, rarity: 'common', note: 'Идеально перед сном.', href: '/?q=' + encodeURIComponent('Студсовет') },
  ],
  albums: [
    { id: 'al1', name: 'Осенний марафон', description: 'Серии, которые хочется пересмотреть зимой.', cardIds: ['c1', 'c4', 'c7'] },
    { id: 'al2', name: 'Короткое и тёплое', description: 'Небольшие истории на один вечер.', cardIds: ['c3', 'c6', 'c8'] },
  ],
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
    { id: 'a1', kind: 'watched', title: 'Рассекая небосвод', detail: 'Серия 19 · карточка добавлена в коллекцию', at: '2026-11-22T18:40:00+03:00', href: '/?q=' + encodeURIComponent('Рассекая небосвод') },
    { id: 'a2', kind: 'watched', title: 'Ледяная стена 2', detail: 'Серия 9 · Озвучка', at: '2026-11-22T17:25:00+03:00', href: '/?q=' + encodeURIComponent('Ледяная стена') },
    { id: 'a3', kind: 'badge', title: 'Получен значок «Ночной смотритель»', detail: 'Уровень 12 · +900 опыта', at: '2026-11-21T23:10:00+03:00' },
    { id: 'a4', kind: 'review', title: 'Отзыв о «Голубой шкатулке 2»', detail: '«Камерная история с очень тёплым концом»', at: '2026-11-20T21:05:00+03:00' },
    { id: 'a5', kind: 'inventory', title: 'Экипирован «Плащ комментатора»', detail: 'Эпический предмет коллекции', at: '2026-11-19T19:30:00+03:00' },
    { id: 'a6', kind: 'friend', title: 'Сакура_77 добавилась в друзья', detail: 'Теперь в сообществе 56 друзей', at: '2026-11-18T12:15:00+03:00' },
  ],
  inventory: [
    { id: 'i1', name: 'Плащ комментатора', description: 'Ваш ник выделяется в обсуждениях.', kind: 'Оболочки профиля', rarity: 'epic', icon: '🧥', quantity: 1, equipped: true, acquiredAt: '2026-11-19' },
    { id: 'i2', name: 'Шляпа полуночи', description: 'Тёмная шляпа с маленькой луной.', kind: 'Оболочки профиля', rarity: 'legendary', icon: '🎩', quantity: 1, acquiredAt: '2026-10-02' },
    { id: 'i3', name: 'Очки зрителя', description: 'Для тех, кто смотрит титры до конца.', kind: 'Оболочки профиля', rarity: 'rare', icon: '👓', quantity: 2, acquiredAt: '2026-08-14' },
    { id: 'i4', name: 'Фон «Неон-город»', description: 'Обложка профиля в стиле позднего города.', kind: 'Обложки профиля', rarity: 'mythic', icon: '🌆', quantity: 1, acquiredAt: '2026-09-27' },
    { id: 'i5', name: 'Фон «Осенний сезон»', description: 'Листья, плед и новая серия.', kind: 'Обложки профиля', rarity: 'rare', icon: '🍁', quantity: 3, acquiredAt: '2026-09-20' },
    { id: 'i6', name: 'Аватар «Сова»', description: 'Ваш текущий аватар.', kind: 'Аватары', rarity: 'epic', icon: '🦉', quantity: 1, equipped: true, acquiredAt: '2026-05-11' },
    { id: 'i7', name: 'Аватар «Лис»', description: 'Хитрый спутник ночных марафонов.', kind: 'Аватары', rarity: 'rare', icon: '🦊', quantity: 1, acquiredAt: '2026-06-03' },
    { id: 'i8', name: 'Аватар «Кофе»', description: 'На случай утренних серий.', kind: 'Аватары', rarity: 'common', icon: '☕', quantity: 4, acquiredAt: '2026-03-18' },
    { id: 'i9', name: 'Бустер «Фэнтези»', description: 'Увеличивает опыт за просмотр жанра.', kind: 'Бустеры', rarity: 'legendary', icon: '⚗️', quantity: 2, acquiredAt: '2026-11-01' },
    { id: 'i10', name: 'Бустер «Сёнен»', description: 'Опыт за серии длинных сериалов.', kind: 'Бустеры', rarity: 'rare', icon: '🗡️', quantity: 5, acquiredAt: '2026-10-22' },
    { id: 'i11', name: 'Эмблема клуба', description: 'Значок участника «Клуба ночного сеанса».', kind: 'Эмблемы', rarity: 'common', icon: '🌃', quantity: 1, acquiredAt: '2026-04-19' },
    { id: 'i12', name: 'Купон на аватар', description: 'Разовый выбор любого аватара.', kind: 'Эмблемы', rarity: 'epic', icon: '🎟️', quantity: 1, acquiredAt: '2026-11-15' },
  ],
  history: [
    { id: 'h1', name: 'Рассекая небосвод', episode: 'Серия 19', at: '2026-11-22T18:40:00+03:00', href: '/?q=' + encodeURIComponent('Рассекая небосвод') },
    { id: 'h2', name: 'Ледяная стена 2', episode: 'Серия 9', at: '2026-11-22T17:25:00+03:00', href: '/?q=' + encodeURIComponent('Ледяная стена') },
    { id: 'h3', name: 'Голубая шкатулка 2', episode: 'Серия 7', at: '2026-11-21T22:10:00+03:00', href: '/?q=' + encodeURIComponent('Голубая шкатулка') },
    { id: 'h4', name: 'Токийские мстители', episode: 'Серия 9', at: '2026-11-20T20:45:00+03:00', href: '/?q=' + encodeURIComponent('Токийские мстители') },
    { id: 'h5', name: 'Ао Аси 2', episode: 'Серия 8', at: '2026-11-19T19:05:00+03:00', href: '/?q=' + encodeURIComponent('Ао Аси') },
  ],
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
    { id: 'd4', title: 'Альбомы карточек: покажите свои подборки', section: 'Коллекционеры', author: 'Тайтл-менеджер', replies: 33, at: '2026-11-21T18:10:00+03:00' },
  ],
  topProfiles: [
    { id: 'u-3001', name: 'Аниме-архивариус', icon: '📼', level: 87 },
    { id: 'u-3002', name: 'Субтитр-мастер', icon: '📝', level: 79 },
    { id: 'u-3003', name: 'Полночный марафон', icon: '🌗', level: 74 },
    { id: 'u-3004', name: 'Сезонный прогноз', icon: '🔮', level: 68 },
  ],
};

export const demoHandleDefault = demoHandle;

/** Демо-реализация: данные живут в памяти и полностью заменяются backend-реализацией. */
export function getDemoProfile(handle: string): UserProfile | null {
  return handle.toLowerCase() === demoHandle ? profile : {
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
    friends: [],
    groups: [],
    inventory: [],
    badges: [],
    favorites: [],
    activity: [],
    history: [],
    cards: [],
    albums: [],
  };
}

export function getDemoOverview(): CommunityOverview {
  return overview;
}
