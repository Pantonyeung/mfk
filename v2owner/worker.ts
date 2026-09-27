export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/health'){
      return new Response(JSON.stringify({
        ok:true,
        service:'mfk-owner',
        mode:'PRESENTATION_AND_AUTHENTICATED_READ_ONLY',
      }),{
        status:200,
        headers:{
          'content-type':'application/json; charset=utf-8',
          'cache-control':'no-store',
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
