import type {DiningCheckoutRequest} from '../../presentation/RuntimeDiningWorkspace.tsx';

export const DINING_CHECKOUT_UI_KEY='mfk.smt.dining-checkout-ui.v1' as const;

function valid(value:unknown):value is DiningCheckoutRequest{
  if(!value||typeof value!=='object')return false;
  const row=value as DiningCheckoutRequest;
  if(typeof row.holdId!=='string'||!row.holdId||
     typeof row.codeLabel!=='string'||
     typeof row.tableLabel!=='string'||
     typeof row.submissionId!=='string'||!row.submissionId||row.submissionId.length>200||
     typeof row.expectedRevision!=='string'||!row.expectedRevision)return false;
  if(!Array.isArray(row.selections)||!row.selections.length||
     !Array.isArray(row.lines)||row.lines.length!==row.selections.length)return false;
  const indexes=new Set<number>();
  for(const selected of row.selections){
    if(!selected||!Number.isSafeInteger(selected.lineIndex)||selected.lineIndex<0||
       !Number.isSafeInteger(selected.qty)||selected.qty<=0||
       indexes.has(selected.lineIndex))return false;
    indexes.add(selected.lineIndex);
    const matching=row.lines.filter(line=>line.lineIndex===selected.lineIndex);
    if(matching.length!==1)return false;
    const line=matching[0];
    if(typeof line.id!=='string'||!line.id||
       typeof line.name!=='string'||
       line.qty!==selected.qty||
       !Number.isSafeInteger(line.unitMinor)||line.unitMinor<0)return false;
  }
  return true;
}

export function readDiningCheckoutUiSession(storage:Pick<Storage,'getItem'>=localStorage):DiningCheckoutRequest|null{
  try{
    const parsed=JSON.parse(storage.getItem(DINING_CHECKOUT_UI_KEY)||'null');
    return parsed?.version===1&&valid(parsed.request)?parsed.request:null;
  }catch{return null;}
}

export function saveDiningCheckoutUiSession(
  request:DiningCheckoutRequest,
  storage:Pick<Storage,'setItem'>=localStorage,
){
  if(!valid(request))throw new Error('DINING_CHECKOUT_REFRESH_REQUIRED');
  storage.setItem(DINING_CHECKOUT_UI_KEY,JSON.stringify({version:1,request}));
}

export function clearDiningCheckoutUiSession(storage:Pick<Storage,'removeItem'>=localStorage){
  storage.removeItem(DINING_CHECKOUT_UI_KEY);
}

export function diningCheckoutCart(request:DiningCheckoutRequest){
  return request.lines.map((line,index)=>{
    const parts=line.name.split('｜');
    const name=parts.shift()||line.name;
    const detail=parts.length?parts.join('｜'):undefined;
    return {
      id:'dining-checkout-'+request.holdId+'-'+line.lineIndex+'-'+index,
      productId:line.id,
      name,
      qty:line.qty,
      unitMinor:line.unitMinor,
      serviceMode:'dine-in' as const,
      ...(detail?{detail}:{}),
    };
  });
}
