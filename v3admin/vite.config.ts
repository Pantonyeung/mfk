import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  server:{
    proxy:{
      '/api':{
        target:'https://admin.morefunos.com',
        changeOrigin:true,
        secure:true,
      },
    },
  },
  build:{outDir:'dist'},
});
