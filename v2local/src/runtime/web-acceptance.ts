export const SMT_PUBLIC_MIRROR_HOSTS=Object.freeze([
  'mfk-smt-web-acceptance.pantonyeung.workers.dev',
  'mfk-smt-web.yeungyi88.workers.dev',
  'smt.morefunos.com',
]);

export const SMT_WEB_ACCEPTANCE_HOSTS=SMT_PUBLIC_MIRROR_HOSTS;

export function isSmtPublicMirror(){
  return typeof window!=='undefined'&&SMT_PUBLIC_MIRROR_HOSTS.includes(window.location.hostname);
}

export const isSmtWebAcceptance=isSmtPublicMirror;

export function smtAdminHttpOrigin(){
  if(isSmtPublicMirror())return window.location.origin+'/__mfk/admin';
  return 'https://admin.morefunos.com';
}

export function smtAdminWebSocketUrl(){
  if(isSmtPublicMirror()){
    const url=new URL(window.location.origin);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    url.pathname='/__mfk/admin/api/admin-sync/events';
    url.search='?storeId=MF01';
    return url.toString();
  }
  return 'wss://admin.morefunos.com/api/admin-sync/events?storeId=MF01';
}
