const MFK_SOURCE_SHA=process.env.MFK_SOURCE_SHA||process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||'DEV';
const MFK_BUILD_AT=process.env.MFK_BUILD_AT||new Date().toISOString();
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  define:{'import.meta.env.VITE_MFK_SOURCE_SHA':JSON.stringify(MFK_SOURCE_SHA),'import.meta.env.VITE_MFK_BUILD_AT':JSON.stringify(MFK_BUILD_AT)},base:'./',plugins:[react()],test:{setupFiles:['./src/test-dining-registry.ts']},build:{target:'chrome83'}});
