import '@mantine/core/styles.css';
import './app/theme.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppearanceProvider, applyAppearance, loadAppearance } from './app/appearance';
import { App } from './app/App';
import { cssVariablesResolver, theme } from './app/theme';

applyAppearance(loadAppearance());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="dark">
      <AppearanceProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AppearanceProvider>
    </MantineProvider>
  </StrictMode>,
);
