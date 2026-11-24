import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './app/App';
import { cssVariablesResolver, theme } from './app/theme';

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="dark">
      <HashRouter>
        <App />
      </HashRouter>
    </MantineProvider>
  </StrictMode>,
);
