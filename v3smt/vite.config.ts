import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'node:child_process';

const sourceSha=(process.env.MFP_SOURCE_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim().toLowerCase();
if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('MFP_BUILD_SOURCE_SHA_INVALID');
const buildId=(process.env.MFP_BUILD_ID??`mfp-v3-${sourceSha.slice(0,12)}`).trim();
if(!/^[A-Za-z0-9._-]{1,160}$/.test(buildId))throw new Error('MFP_BUILD_ID_INVALID');
const buildIdentity=Object.freeze({
  target:'MFP_V3',sourceSha,buildId,
  linkedTestEnabled:process.env.VITE_MFP_V3_LINKED_TEST==='1',
  builtAt:process.env.MFP_BUILD_TIMESTAMP?.trim()||null,
});

export default defineConfig({
  plugins:[react(),{
    name:'mfp-build-identity',
    generateBundle(){
      this.emitFile({type:'asset',fileName:'build-identity.json',source:JSON.stringify(buildIdentity,null,2)+'\n'});
      this.emitFile({type:'asset',fileName:'_headers',source:'/build-identity.json\n  Cache-Control: no-store, max-age=0\n'});
    },
  }],
  define:{__MFP_BUILD_IDENTITY__:JSON.stringify(buildIdentity)},
  build:{outDir:'dist'},
  // A static identity artifact gives public acceptance a no-store exact-source readback.
  // Packaging uses the same object embedded in the runtime bundle.
});
