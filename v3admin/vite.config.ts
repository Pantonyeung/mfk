import {execSync} from 'node:child_process';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

function sourceSha(){
  if(process.env.GITHUB_SHA)return process.env.GITHUB_SHA;
  try{return execSync('git rev-parse HEAD',{encoding:'utf8'}).trim();}catch{return 'DEV_UNKNOWN_SHA';}
}

export default defineConfig(()=>{
  const sha=sourceSha();
  const releaseId=process.env.MFK_V3ADMIN_RELEASE_ID||'v3admin-'+sha.slice(0,12);
  const buildTime=new Date().toISOString();
  const releaseJson=JSON.stringify({releaseId,sourceSha:sha,buildTime});

  return {
    plugins:[
      react(),
      {
        name:'mfk-v3admin-release-identity',
        configureServer(server){
          server.middlewares.use('/release.json',(_req,res)=>{
            res.statusCode=200;
            res.setHeader('content-type','application/json; charset=utf-8');
            res.setHeader('cache-control','no-store');
            res.end(releaseJson);
          });
        },
        generateBundle(){
          this.emitFile({type:'asset',fileName:'release.json',source:releaseJson});
        },
      },
    ],
    define:{
      __MFK_CLIENT_RELEASE_ID__:JSON.stringify(releaseId),
      __MFK_CLIENT_SOURCE_SHA__:JSON.stringify(sha),
      __MFK_CLIENT_BUILD_TIME__:JSON.stringify(buildTime),
    },
    server:{
      fs:{allow:['..']},
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
  };
});
