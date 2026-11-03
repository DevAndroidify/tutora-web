import { RouterProvider } from '@tanstack/react-router';
import { AppProviders, createQueryClient } from '@tutora/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { realtime, session } from './api';
import { router } from './router';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders session={session} queryClient={createQueryClient()} realtime={realtime}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
