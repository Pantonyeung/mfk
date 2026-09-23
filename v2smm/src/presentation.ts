import type {
  SmmCapacityProjection,
  SmmChannelHealth,
  SmmCommandState,
  SmmConnectionState,
  SmmPrintHealth,
  SmmRefundRequest,
  SmmReportingProjection,
} from './product-types';

export type FeedbackTone='neutral'|'info'|'success'|'warning'|'danger';

export type QuotePresentation=
  | {readonly state:'idle'}
  | {readonly state:'loading'}
  | {readonly state:'ready'}
  | {readonly state:'unavailable';readonly message:string}
  | {readonly state:'error';readonly message:string};

export type CommandPresentation=
  | {readonly state:'idle'}
  | {readonly state:'submitting';readonly submissionId:string}
  | {readonly state:'readback';readonly submissionId:string}
  | {readonly state:'confirmed';readonly message:string;readonly submissionId:string}
  | {readonly state:'rejected';readonly message:string;readonly submissionId:string}
  | {readonly state:'failed';readonly message:string;readonly submissionId:string}
  | {readonly state:'unknown';readonly message:string;readonly submissionId:string}
  | {readonly state:'not-connected';readonly message:string;readonly submissionId:string};

const dateTimeFormatter=new Intl.DateTimeFormat('zh-HK',{
  month:'numeric',
  day:'numeric',
  hour:'2-digit',
  minute:'2-digit',
});

const timeFormatter=new Intl.DateTimeFormat('zh-HK',{
  hour:'2-digit',
  minute:'2-digit',
});

export function formatObservedAt(value:string|undefined):string{
  if(!value)return '未有讀回';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '未有讀回';
  return `最後更新：${dateTimeFormatter.format(date)}`;
}

export function formatObservedTime(value:string|undefined):string{
  if(!value)return '未有讀回';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '未有讀回';
  return timeFormatter.format(date);
}

export function connectionCopy(state:SmmConnectionState):{label:string;detail:string;tone:FeedbackTone}{
  if(state==='READY')return {label:'門店已連接',detail:'資料由門店服務提供',tone:'success'};
  if(state==='LOADING')return {label:'正在同步',detail:'正在讀取最新門店資料',tone:'info'};
  if(state==='ERROR')return {label:'同步失敗',detail:'未能讀取門店資料',tone:'danger'};
  if(state==='STALE')return {label:'資料稍舊',detail:'目前顯示 runtime 標示為稍舊的資料',tone:'warning'};
  if(state==='PARTIAL')return {label:'只有部分資料',detail:'目前顯示 runtime 已提供的部分資料',tone:'warning'};
  if(state==='UNKNOWN')return {label:'連線狀態未明',detail:'暫時未能確認門店連線狀態',tone:'warning'};
  return {label:'門店服務未連接',detail:'正式餐單、報價及訂單會保持空白',tone:'neutral'};
}

export function commandResultPresentation(
  state:SmmCommandState,
  message:string,
  submissionId:string,
):CommandPresentation{
  if(state==='CONFIRMED')return {state:'confirmed',message:message||'門店已確認訂單',submissionId};
  if(state==='REJECTED')return {state:'rejected',message:message||'門店未接受今次提交',submissionId};
  if(state==='FAILED')return {state:'failed',message:message||'提交未完成',submissionId};
  if(state==='UNKNOWN')return {state:'unknown',message:message||'正在確認訂單結果',submissionId};
  return {state:'not-connected',message:message||'門店提交服務目前未連接',submissionId};
}

export function workStateCopy(state:string):{label:string;tone:FeedbackTone;priority:number}{
  if(state==='ACTION_REQUIRED')return {label:'需要人手',tone:'danger',priority:0};
  if(state==='DELAYED')return {label:'已延誤',tone:'warning',priority:1};
  if(state==='UNKNOWN')return {label:'結果未明',tone:'warning',priority:2};
  return {label:'正常進行中',tone:'success',priority:3};
}

export function orderReadbackCopy(state:string):{label:string;tone:FeedbackTone}{
  if(state==='CONFIRMED')return {label:'已確認',tone:'success'};
  if(state==='PARTIAL')return {label:'只有部分資料',tone:'warning'};
  return {label:'正在確認結果',tone:'warning'};
}

export function lifecycleLabel(state:string):string{
  const labels:Record<string,string>={
    ACCEPTED:'已接單',
    PREPARING:'製作中',
    READY:'可取餐',
    COMPLETED:'已完成',
    CANCELLED:'已取消',
    PENDING:'等待處理',
  };
  return labels[state]??'處理中';
}

export function channelStateCopy(state:SmmChannelHealth['state']):{label:string;tone:FeedbackTone}{
  if(state==='CONNECTED')return {label:'連線正常',tone:'success'};
  if(state==='STALE')return {label:'資料稍舊',tone:'warning'};
  if(state==='DEGRADED')return {label:'服務不穩定',tone:'warning'};
  if(state==='OFFLINE')return {label:'目前離線',tone:'danger'};
  return {label:'狀態未明',tone:'warning'};
}

export function capacityStateCopy(state:SmmCapacityProjection['state']):{label:string;tone:FeedbackTone}{
  if(state==='NORMAL')return {label:'運作正常',tone:'success'};
  if(state==='BUSY')return {label:'目前繁忙',tone:'warning'};
  if(state==='PAUSED')return {label:'暫停接單',tone:'danger'};
  return {label:'狀態未明',tone:'warning'};
}

export function reportFreshnessCopy(state:SmmReportingProjection['freshness']):{label:string;tone:FeedbackTone}{
  if(state==='CURRENT')return {label:'資料已更新',tone:'success'};
  if(state==='STALE')return {label:'資料稍舊',tone:'warning'};
  return {label:'狀態未明',tone:'warning'};
}

export function refundStateCopy(state:SmmRefundRequest['state']):{label:string;tone:FeedbackTone}{
  if(state==='PENDING')return {label:'等待跟進',tone:'warning'};
  if(state==='REVIEWING')return {label:'處理中',tone:'info'};
  if(state==='RESOLVED')return {label:'已完成',tone:'success'};
  return {label:'狀態未明',tone:'warning'};
}

export function printStateCopy(state:SmmPrintHealth['state']):{label:string;tone:FeedbackTone}{
  if(state==='READY')return {label:'設備正常',tone:'success'};
  if(state==='DEGRADED')return {label:'需要留意',tone:'warning'};
  if(state==='OFFLINE')return {label:'設備離線',tone:'danger'};
  return {label:'狀態未明',tone:'warning'};
}

export function dineStateLabel(state:string):string{
  const labels:Record<string,string>={
    OPEN:'用餐中',
    SEATED:'已入座',
    CLOSED:'已完成',
    UNKNOWN:'狀態未明',
  };
  return labels[state]??'處理中';
}
