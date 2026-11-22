import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({
  colors: {
    dark: ['#f5eff9', '#e5dced', '#bcb0c8', '#a092ae', '#786984', '#302939', '#211c2a', '#14141a', '#111015', '#0a090d'],
    amber: ['#fff6e0', '#ffebc2', '#ffdf99', '#ffda8b', '#ffd27c', '#f5b64e', '#cd8d2d', '#a96816', '#865100', '#613805'],
  },
  primaryColor: 'amber',
  primaryShade: { light: 8, dark: 4 },
  autoContrast: true,
  defaultRadius: 'md',
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--app-glow': '#eee4fb',
    '--mantine-color-body': '#faf8f5',
    '--mantine-color-text': '#211c2a',
    '--mantine-color-default-border': 'var(--mantine-color-gray-6)',
    '--mantine-color-yellow-light-color': '#763900',
    '--mantine-color-dimmed': 'var(--mantine-color-gray-7)',
    '--mantine-color-placeholder': 'var(--mantine-color-gray-7)',
  },
  dark: {
    '--app-glow': '#292139',
  },
});
