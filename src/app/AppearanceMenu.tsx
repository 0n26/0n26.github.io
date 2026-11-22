import { ActionIcon, Popover, Tooltip } from '@mantine/core';
import { AppearanceControls } from './AppearanceControls';
import s from './Appearance.module.css';

export function AppearanceMenu() {
  return (
    <Popover width={280} position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Tooltip label="Оформление" withArrow>
          <ActionIcon variant="subtle" size="lg" className={s.trigger} aria-label="Настроить оформление">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
            </svg>
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className={s.dropdown}>
        <div className={s.title}>Оформление</div>
        <AppearanceControls />
      </Popover.Dropdown>
    </Popover>
  );
}
