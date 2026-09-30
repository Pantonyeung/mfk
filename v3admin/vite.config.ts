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
        headers:{
          origin:'https://admin.morefunos.com',
          'sec-fetch-site':'same-origin',
        },
      },
    },
  },
  build:{outDir:'dist'},
});
