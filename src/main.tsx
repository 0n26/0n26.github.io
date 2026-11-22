import '@mantine/core/styles.css';
import './app/theme.css';
import { MantineProvider, createTheme } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppearanceProvider, applyAppearance, loadAppearance } from './app/appearance';
import { App } from './app/App';

const theme = createTheme({ primaryColor: 'blue', defaultRadius: 'sm' });

applyAppearance(loadAppearance());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppearanceProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AppearanceProvider>
    </MantineProvider>
  </StrictMode>,
);
