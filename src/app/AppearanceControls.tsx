import { SegmentedControl, Text } from '@mantine/core';
import { palettes, useAppearance } from './appearance';
import type { PaletteId } from './appearance';
import s from './Appearance.module.css';

const paletteIds = Object.keys(palettes) as Exclude<PaletteId, 'custom'>[];

export function AppearanceControls() {
  const { settings, setMode, setPalette, setAccent, setBackground, reset } = useAppearance();

  return (
    <div className={s.controls}>
      <SegmentedControl fullWidth size="xs" value={settings.mode}
        data={[{ value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }]}
        onChange={(value) => setMode(value as 'dark' | 'light')} />

      <div className={s.group}>
        <div className={s.label}>Палитра</div>
        <div className={s.swatches}>
          {paletteIds.map((id) => (
            <button key={id} type="button" className={s.swatch} title={palettes[id].name}
              aria-label={palettes[id].name} aria-pressed={settings.palette === id}
              onClick={() => setPalette(id)}
              style={{ background: `linear-gradient(135deg, ${palettes[id].accent} 0 45%, ${palettes[id].dark} 45% 75%, ${palettes[id].light} 75%)` }} />
          ))}
        </div>
      </div>

      <div className={s.group}>
        <div className={s.label}>Свой цвет</div>
        <label className={s.colorRow}>
          <span>Акцент</span>
          <input type="color" aria-label="Цвет акцента" value={settings.accent}
            onChange={(event) => setAccent(event.currentTarget.value)} />
          <code>{settings.accent}</code>
        </label>
        <label className={s.colorRow}>
          <span>Фон</span>
          <input type="color" aria-label="Цвет фона" value={settings.background}
            onChange={(event) => setBackground(event.currentTarget.value)} />
          <code>{settings.background}</code>
        </label>
        <Text size="xs" c="dimmed" mt={6}>Пипетка в системном окне выберет цвет с экрана.</Text>
      </div>

      <button type="button" className={s.reset} onClick={reset}>Сбросить оформление</button>
    </div>
  );
}
