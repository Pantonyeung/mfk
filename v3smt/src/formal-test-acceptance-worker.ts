interface AssetFetcher{
  fetch(request:Request):Promise<Response>;
}

interface VersionMetadata{
  id:string;
  timestamp:string;
}

export interface FormalTestAcceptanceEnv{
  ASSETS:AssetFetcher;
  MFK_SOURCE_SHA?:string;
  MFK_BUILD_ID?:string;
  MFK_VERSION?:VersionMetadata;
}

const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-mfk-smt-mode':'TEST_ACCEPTANCE',
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
}

function identity(env:FormalTestAcceptanceEnv){
  return Object.freeze({
    product:'MFK',
    surface:'SMT',
    mode:'TEST_ACCEPTANCE',
    sourceSha:String(env.MFK_SOURCE_SHA||'UNKNOWN'),
    buildId:String(env.MFK_BUILD_ID||env.MFK_VERSION?.id||'UNKNOWN'),
    deployedAt:String(env.MFK_VERSION?.timestamp||'UNKNOWN'),
    authRequired:false,
  });
}

export const formalTestAcceptanceWorker={
  async fetch(request:Request,env:FormalTestAcceptanceEnv){
    const url=new URL(request.url);

    if(request.method==='GET'&&url.pathname==='/__mfk/build'){
      return json(identity(env));
    }

    if(request.method==='GET'&&url.pathname==='/__mfk/health'){
      return json({
        ok:true,
        ...identity(env),
        backendProxy:false,
        checkoutConnected:false,
        physicalPrintConnected:false,
        cashDrawerConnected:false,
      });
    }

    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__mfk/')){
      return json({
        code:'MFP_V3_TEST_ACCEPTANCE_BACKEND_NOT_BOUND',
        state:'UNAVAILABLE',
        detail:'This public test surface does not proxy the legacy backend.',
      },503);
    }

    if(request.method!=='GET'&&request.method!=='HEAD'){
      return json({code:'MFP_V3_TEST_ACCEPTANCE_METHOD_BLOCKED',state:'BLOCKED'},405);
    }

    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    const contentType=headers.get('content-type')||'';
    headers.set('x-mfk-smt-mode','TEST_ACCEPTANCE');
    headers.set('cache-control',contentType.includes('text/html')?'no-store':'public, max-age=300');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};

export default formalTestAcceptanceWorker;
