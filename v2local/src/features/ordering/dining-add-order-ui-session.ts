export interface DiningAddOrderRequest{
  readonly holdId:string;
  readonly submissionId:string;
  readonly codeLabel:string;
  readonly tableLabel:string;
  readonly formalOrderId:string;
}

export const DINING_ADD_ORDER_UI_KEY='mfk.smt.dining-add-order-ui.v1' as const;

function valid(value:unknown):value is DiningAddOrderRequest{
  if(!value||typeof value!=='object')return false;
  const row=value as DiningAddOrderRequest;
  return typeof row.holdId==='string'&&Boolean(row.holdId)&&
    typeof row.submissionId==='string'&&Boolean(row.submissionId)&&row.submissionId.length<=200&&
    typeof row.codeLabel==='string'&&Boolean(row.codeLabel)&&
    typeof row.tableLabel==='string'&&
    typeof row.formalOrderId==='string'&&Boolean(row.formalOrderId);
}

export function readDiningAddOrderUiSession(storage:Pick<Storage,'getItem'>=localStorage):DiningAddOrderRequest|null{
  try{
    const parsed=JSON.parse(storage.getItem(DINING_ADD_ORDER_UI_KEY)||'null');
    return parsed?.version===1&&valid(parsed.request)?parsed.request:null;
  }catch{return null;}
}

export function saveDiningAddOrderUiSession(
  request:DiningAddOrderRequest,
  storage:Pick<Storage,'setItem'>=localStorage,
){
  if(!valid(request))throw new Error('DINING_ADD_ORDER_SESSION_INVALID');
  storage.setItem(DINING_ADD_ORDER_UI_KEY,JSON.stringify({version:1,request}));
}

export function clearDiningAddOrderUiSession(storage:Pick<Storage,'removeItem'>=localStorage){
  storage.removeItem(DINING_ADD_ORDER_UI_KEY);
}
