import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],test:{setupFiles:['./src/test-dining-registry.ts']},build:{target:'chrome83'}});
