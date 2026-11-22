import { Button, Menu, useMantineColorScheme } from '@mantine/core';
import styles from './App.module.css';

export function ThemeMenu() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Menu position="bottom-end" returnFocus>
      <Menu.Target>
        <Button variant="default" className={styles.themeButton}>Тема</Button>
      </Menu.Target>
      <Menu.Dropdown aria-label="Цветовая схема">
        <Menu.RadioGroup value={colorScheme}>
          <Menu.RadioItem value="dark" onChange={() => setColorScheme('dark')}>Тёмная</Menu.RadioItem>
          <Menu.RadioItem value="light" onChange={() => setColorScheme('light')}>Светлая</Menu.RadioItem>
          <Menu.RadioItem value="auto" onChange={() => setColorScheme('auto')}>Системная</Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Dropdown>
    </Menu>
  );
}
