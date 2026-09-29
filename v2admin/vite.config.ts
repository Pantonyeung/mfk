const MFK_SOURCE_SHA=process.env.MFK_SOURCE_SHA||process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||'DEV';
const MFK_BUILD_AT=process.env.MFK_BUILD_AT||new Date().toISOString();
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define:{__MFK_SOURCE_SHA__:JSON.stringify(MFK_SOURCE_SHA),__MFK_BUILD_AT__:JSON.stringify(MFK_BUILD_AT)},
  plugins:[react()],
  server:{host:true},
});
