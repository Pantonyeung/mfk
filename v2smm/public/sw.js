const CACHE='mfk-smm-shell-v2';
const SHELL=['/','/index.html','/brand/morefun-logo.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(SHELL.map(async path=>{const response=await fetch(new Request(path,{cache:'reload'}));await cache.put(path,response);}))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.pathname.startsWith('/api/')||url.pathname.includes('/smm/v1/'))return;
  const networkRequest=new Request(event.request,{cache:'no-store'});
  event.respondWith(
    fetch(networkRequest)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(hit=>hit||Response.error()))
  );
});