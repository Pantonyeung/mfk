import type {ReactNode} from 'react';
import type {V3BusinessConfigurationExtract} from './business-config-extract.ts';
import {BusinessConfigurationExtractControl} from './formal-publish-history-pages.tsx';

/** No editor, draft provider or publication action is mounted before preservation review. */
export function V3PreservationScreen({storeId,sourceKey,releaseStatus,prepare,onSignOut}:{
  storeId:string;sourceKey:string;releaseStatus:ReactNode;
  prepare:()=>Promise<V3BusinessConfigurationExtract>;onSignOut:()=>void;
}){
  return <main className="v3-auth-shell" data-v3-mode="PRESERVATION">
    <header className="v3-auth-head"><div><small>V3 保全模式</small><h1>正式商業設定只讀擷取</h1><p>Store {storeId}。尚未完成檔案核對；設定新增、修改、刪除、發佈及還原已由伺服器鎖定。</p></div><button type="button" onClick={onSignOut}>登出</button></header>
    {releaseStatus}
    <BusinessConfigurationExtractControl sourceKey={sourceKey} prepare={prepare}/>
    <p>V3 程式已接同一正式資料來源。下載及核對成功前，不會開放設定編輯；目前未宣稱備份完成。</p>
  </main>;
}
