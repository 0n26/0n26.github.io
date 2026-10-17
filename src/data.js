// Все данные портфолио редактируются здесь. Не добавляйте непроверенные метрики.
export const profile = {
  handle: '0n26', github: 'https://github.com/0n26',
  intro: 'Код. Инструменты. Моды.',
  description: 'Discord-бот, расширение для редактора и мод для Factorio. Разные задачи, один подход: собрать нужное и оставить код открытым.',
};
export const filters = [{ id: 'all', label: 'Все проекты' }, { id: 'tools', label: 'Инструменты' }, { id: 'mods', label: 'Моды' }];
export const projects = [
  { id: 'brik', number: '01', name: 'brik', category: 'tools', type: 'DISCORD / BOT', art: 'cover-brik.svg',
    description: 'Модульный Discord-бот. Команды и возможности подключаются отдельными модулями.',
    tags: ['TypeScript', 'Bun', 'discord.js'], url: 'https://github.com/0n26/brik', note: 'Модули, команды и unit-тесты.' },
  { id: 'vs-bansos', number: '02', name: 'vs-bansos', category: 'tools', type: 'VS CODE / EXTENSION', art: 'cover-vs-bansos.svg',
    description: 'OpenAI-совместимые провайдеры моделей в VS Code и Copilot Chat через Language Model Chat Provider API.',
    tags: ['TypeScript', 'VS Code', 'Copilot Chat'], url: 'https://github.com/0n26/vs-bansos', note: 'Выбор провайдера внутри редактора.' },
  { id: 'k2-port', number: '03', name: 'k2-port', category: 'mods', type: 'FACTORIO / MOD', art: 'cover-k2-port.svg',
    description: 'Advanced Tank из Krastorio 2 с совместимостью Space Age. Доработки совместимости, технологических бонусов и локализации.',
    tags: ['Lua', 'Factorio', 'Space Age'], url: 'https://github.com/0n26/k2-port',
    note: 'Оригинальные материалы: Krastorio 2 / Krastorio2Assets.' },
];
export const stack = [
  {number:'01', title:'TypeScript', text:'Discord-боты и расширения редактора', tags:'Bun / discord.js / VS Code'},
  {number:'02', title:'Lua', text:'Модификации и игровые механики', tags:'Factorio / Space Age'},
  {number:'03', title:'GitHub', text:'Исходники, история изменений и issues', tags:'Репозитории / документация'},
];
export function filterProjects(category) { return category === 'all' ? projects : projects.filter(p => p.category === category); }
