import {PageHeader,StatusBadge} from './ui.tsx';

export function FormalQuickReasonsGapPage(){
  return <div className="v3-functional-page">
    <PageHeader eyebrow="門店設定" title="快捷原因" description="目前正式 Canonical / Server Draft contract 未定義 Quick Reason schema；唔會由 V3 自己發明第二份設定格式。"/>
    <section className="v3-functional-section">
      <header><div><h3>Quick Reason schema seam 未接</h3><p>需要先鎖定 reason identity、domain、排序、啟用狀態、SMT/SMM 使用方式，同 publish validation。</p></div><StatusBadge tone="warning">SCHEMA SEAM REQUIRED</StatusBadge></header>
      <div className="v3-mobile-form-note">Preview UI 可以驗收操作，但正式儲存保持關閉，直到 Canonical schema 同 runtime consumer 一齊完成。</div>
    </section>
  </div>;
}
