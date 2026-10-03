import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {V3SmtApp} from './App.tsx';
import {mfpQueryClient} from './state-authority.ts';
import {mfpSyncCoordinator} from './sync-binding.ts';
import {startMfpSyncLifecycle} from './sync-runtime.ts';

/** Original flag-off app and its lifecycle remain together, outside the linked test entry. */
export function mountNormalApp(root:HTMLElement){
  startMfpSyncLifecycle(mfpSyncCoordinator);
  createRoot(root).render(<StrictMode><QueryClientProvider client={mfpQueryClient}><V3SmtApp/></QueryClientProvider></StrictMode>);
}
