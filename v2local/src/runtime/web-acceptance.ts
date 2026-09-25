export const SMT_WEB_ACCEPTANCE_HOST='mfk-smt-web-acceptance.pantonyeung.workers.dev';

export function isSmtWebAcceptance(){
  return typeof window!=='undefined'&&window.location.hostname===SMT_WEB_ACCEPTANCE_HOST;
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
