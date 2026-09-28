export const SMT_WEB_ACCEPTANCE_HOSTS=Object.freeze([
  'mfk-smt-web-acceptance.pantonyeung.workers.dev',
  'mfk-smt-web.yeungyi88.workers.dev',
  'smt.morefunos.com',
]);

export function isSmtWebAcceptance(){
  return typeof window!=='undefined'&&SMT_WEB_ACCEPTANCE_HOSTS.includes(window.location.hostname);
}

export function smtAdminHttpOrigin(){
  if(isSmtWebAcceptance())return window.location.origin+'/__mfk/admin';
  return 'https://admin.morefunos.com';
}

export function smtAdminWebSocketUrl(){
  if(isSmtWebAcceptance()){
    const url=new URL(window.location.origin);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    url.pathname='/__mfk/admin/api/admin-sync/events';
    url.search='?storeId=MF01';
    return url.toString();
  }
  return 'wss://admin.morefunos.com/api/admin-sync/events?storeId=MF01';
}
