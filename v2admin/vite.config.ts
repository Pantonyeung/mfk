import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const sourceSha=String(process.env.MFK_SOURCE_SHA||'DEV').trim()||'DEV';

export default defineConfig({
  plugins:[react()],
  define:{
    __MFK_SOURCE_SHA__:JSON.stringify(sourceSha),
  },
  server:{host:true},
});
