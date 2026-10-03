/** Operator-facing recovery only; does not create a binding or submit a command. */
export function MfpUnavailableState({title,description,code,onRetry,onCheckConnection}:{
  title:string;description:string;code?:string;onRetry?:()=>void;onCheckConnection?:()=>void;
}){
  return <section className="mfp-unavailable-state" role="status">
    <span className="mfp-connection-badge">尚未連接</span>
    <h2>{title}</h2><p>{description}</p>
    <div className="mfp-recovery-actions">
      {onRetry?<button type="button" onClick={onRetry}>重新讀取</button>:null}
      {onCheckConnection?<button type="button" className="primary" onClick={onCheckConnection}>檢查連線</button>:null}
    </div>
    {code?<details><summary>技術資料</summary><code>{code}</code></details>:null}
  </section>;
}
