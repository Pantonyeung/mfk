import {CUSTOMER_FINAL_SOURCE} from './source-assets';
import {useState} from 'react';
import type {CustomerMemberProjection,CustomerWhatsAppFallback} from './product-types';

export type Ui10Mode='ACCOUNT'|'RECOVERY';

const digits=(value:string)=>value.replace(/\D/g,'');

function openSupport(fallback:CustomerWhatsAppFallback|undefined,phone:string){
  if(!fallback?.enabled)return false;
  const target=fallback.phone.replace(/\D/g,'');
  if(target.length<8)return false;
  const message='你好，我需要協助處理磨飯會員帳戶。'+(digits(phone).length>=8?'\n聯絡電話：'+phone.trim():'');
  window.open('https://wa.me/'+target+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
  return true;
}

function PwaGuide(){
  const [open,setOpen]=useState(false);
  return <section className="ui10-card">
    <span className="ui10-kicker">主畫面</span><h2>下次更快打開磨飯</h2>
    <p>你可以將磨飯加到手機主畫面，之後像一般 App 一樣開啟。</p>
    <button className="ui10-secondary" type="button" onClick={()=>setOpen(value=>!value)}>{open?'收起教學':'查看安裝方法'}</button>
    {open?<ol className="ui10-guide"><li>在瀏覽器開啟磨飯。</li><li>按分享，再選「加入主畫面」。</li><li>確認名稱後按「加入」。</li></ol>:null}
  </section>;
}

function NotificationConsent(){
  const [asked,setAsked]=useState(false);
  const [result,setResult]=useState<string|null>(null);
  const request=async()=>{
    setAsked(true);
    if(!('Notification' in window)){setResult('呢部裝置暫時未支援網頁通知。');return}
    try{
      const permission=await Notification.requestPermission();
      setResult(permission==='granted'?'瀏覽器已允許通知；訂單通知服務仍以正式服務狀態為準。':permission==='denied'?'瀏覽器未允許通知，你仍然可以正常點餐。':'今次未有更改通知設定。');
    }catch{setResult('暫時未能開啟通知設定，你仍然可以正常點餐。')}
  };
  return <section className="ui10-card">
    <span className="ui10-kicker">訂單通知</span><h2>由你決定幾時開啟</h2>
    <p>通知權限只會喺你主動要求後先向瀏覽器申請。會員身份唔等於推廣訊息同意。</p>
    <button className="ui10-secondary" type="button" onClick={()=>void request()}>{asked?'再次查看通知設定':'開啟訂單通知'}</button>
    {result?<p className="ui10-result" role="status">{result}</p>:null}
  </section>;
}

export function CustomerUi10({mode,member,fallback,defaultPhone,onMember,onRecovery,onBack}:{mode:Ui10Mode;member?:CustomerMemberProjection;fallback?:CustomerWhatsAppFallback;defaultPhone?:string;onMember:()=>void;onRecovery:()=>void;onBack:()=>void}){
  const [phone,setPhone]=useState(defaultPhone??'');
  const [password,setPassword]=useState('');
  const [notice,setNotice]=useState<string|null>(null);
  const activated=member?.state==='READY';

  if(mode==='RECOVERY')return <section className="page ui10-page" data-ui10="recovery">
    <header className="ui10-header"><button type="button" onClick={onBack}>返回</button><div><span>帳戶支援</span><strong>找回會員帳戶</strong></div></header>
    <section className="ui10-hero"><img className="ui10-art-slot" src={CUSTOMER_FINAL_SOURCE.femaleIpSheet.url} alt="" aria-hidden="true" data-source-asset={CUSTOMER_FINAL_SOURCE.femaleIpSheet.sourceFile}/><span>人工核對</span><h1>忘記密碼或換咗電話？</h1><p>磨飯唔會用短訊或電郵驗證碼自動取回舊會員資料。帳戶資料核對約需 1–2 個工作日。</p></section>
    <section className="ui10-card"><span className="ui10-kicker">聯絡資料</span><h2>先提供你記得嘅電話</h2><label className="ui10-field"><span>舊電話／聯絡電話</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="例如 9123 4567"/></label><p>店舖會經 WhatsApp 人工核對已登記資料。唔會因為輸入電話就自動取得會員資料。</p><button className="ui10-primary" type="button" onClick={()=>setNotice(openSupport(fallback,phone)?'已開啟 WhatsApp；請由你主動送出訊息。':'WhatsApp 支援暫時未能使用，請稍後再試或直接聯絡店舖。')}>用 WhatsApp 聯絡磨飯</button>{notice?<p className="ui10-result" role="status">{notice}</p>:null}</section>
    <section className="ui10-card ui10-disabled-card" aria-disabled="true"><span className="ui10-kicker">臨時密碼</span><h2>核對完成後首次登入</h2><p>店舖核對完成後，可以提供一次性臨時密碼。首次登入必須改成你自己嘅新密碼；目前自動重設服務尚未連接。</p><label className="ui10-field"><span>一次性臨時密碼</span><input type="password" disabled placeholder="由店舖提供"/></label><label className="ui10-field"><span>新密碼</span><input type="password" disabled placeholder="設定新密碼"/></label><button className="ui10-primary" type="button" disabled>更改密碼</button></section>
    <button className="ui10-link" type="button" onClick={onMember}>返回會員頁</button>
  </section>;

  return <section className="page ui10-page" data-ui10="account">
    <header className="ui10-header"><button type="button" onClick={onBack}>返回</button><div><span>會員帳戶</span><strong>帳戶與裝置</strong></div></header>
    <section className="ui10-hero"><img className="ui10-art-slot" src={CUSTOMER_FINAL_SOURCE.maleIpSheet.url} alt="" aria-hidden="true" data-source-asset={CUSTOMER_FINAL_SOURCE.maleIpSheet.sourceFile}/><span>{activated?'正式會員':'會員啟用'}</span><h1>{activated?(member?.displayName?member.displayName+' 嘅帳戶':'你嘅磨飯帳戶'):'用電話同密碼建立正式會員'}</h1><p>{activated?'會員身份以店舖正式會員資料為準。':'你仍然可以照常點餐；未啟用唔會影響現有購物流程。'}</p></section>
    <section className="ui10-card"><span className="ui10-kicker">{activated?'登入資料':'啟用會員'}</span><h2>{activated?'電話 + 密碼':'設定你嘅會員登入'}</h2><label className="ui10-field"><span>電話</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="例如 9123 4567"/></label><label className="ui10-field"><span>密碼</span><input type="password" autoComplete={activated?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="輸入密碼"/></label><button className="ui10-primary" type="button" disabled>{activated?'登入服務暫未連接':'啟用服務暫未連接'}</button><p className="ui10-safe">目前未有已證明嘅會員憑證建立／驗證介面，所以呢度唔會自行建立帳戶、驗證密碼或重設密碼。</p><button className="ui10-link" type="button" onClick={onRecovery}>忘記密碼／換手機／更改電話</button></section>
    <PwaGuide/><NotificationConsent/>
    <section className="ui10-card ui10-privacy"><span className="ui10-kicker">私隱與同意</span><h2>會員、服務通知、獎賞通知分開</h2><p>加入會員唔代表同意推廣訊息。任何通知只會按你主動選擇同正式服務設定處理。</p></section>
  </section>;
}
