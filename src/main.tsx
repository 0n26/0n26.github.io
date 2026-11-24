import '@mantine/core/styles.css';
import { Container, MantineProvider, Text } from '@mantine/core';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { restoreSession } from './api';
import { App } from './app/App';
import { cssVariablesResolver, theme } from './app/theme';

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

const session = restoreSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="dark">
      <HashRouter>
        <Suspense fallback={<Container component="main" py="xl"><Text role="status">Проверяем сессию…</Text></Container>}>
          <App initialSession={session} />
        </Suspense>
      </HashRouter>
    </MantineProvider>
  </StrictMode>,
);
