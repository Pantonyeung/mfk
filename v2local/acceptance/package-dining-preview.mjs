import {build} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';

const directory=process.env.PROOF_DIR||'/tmp/mfk-dining-proof';
await fs.mkdir(directory,{recursive:true});
const result=await build({
  configFile:false,
  root:process.cwd(),
  base:'./',
  plugins:[react()],
  build:{write:false,cssCodeSplit:false,minify:true,rollupOptions:{input:path.resolve('acceptance/dining.html')}},
});
const outputs=(Array.isArray(result)?result:[result]).flatMap(item=>item.output??[]);
const html=outputs.find(item=>item.type==='asset'&&item.fileName.endsWith('.html'));
if(!html)throw new Error('PREVIEW_HTML_MISSING');
let content=String(html.source);
const used=new Set();
content=content.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,url)=>{
  const item=outputs.find(row=>row.type==='chunk'&&url.endsWith(row.fileName));
  if(!item)throw new Error('PREVIEW_SCRIPT_MISSING:'+url);
  if(item.imports.length||item.dynamicImports.length)throw new Error('PREVIEW_UNEXPECTED_EXTERNAL_CHUNKS');
  used.add(item.fileName);
  return '<script type="module">'+item.code.replace(/<\/script/gi,'<\\/script')+'</script>';
});
content=content.replace(/<link\b[^>]*href="([^"]+)"[^>]*>/g,(tag,url)=>{
  const item=outputs.find(row=>row.type==='asset'&&row.fileName.endsWith('.css')&&url.endsWith(row.fileName));
  if(!item)return tag;
  used.add(item.fileName);
  return '<style>'+String(item.source).replace(/<\/style/gi,'<\\/style')+'</style>';
});
if(/(?:src|href)="[^\"]*assets\//.test(content))throw new Error('PREVIEW_EXTERNAL_ASSET_REMAINS');
await fs.writeFile(path.join(directory,'dining-preview.html'),content);
console.log('ISOLATED_PREVIEW_PACKAGED',content.length,'bytes',Array.from(used));
