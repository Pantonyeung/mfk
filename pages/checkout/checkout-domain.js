import {recordCheckoutOperator} from '../../shared/operations.js';

const roundMoney=value=>Math.round((Number(value)||0)*100)/100;
const subtotalOf=cart=>roundMoney((cart||[]).reduce((sum,line)=>sum+Number(line.total ?? Number(line.unitPrice||0)*Number(line.qty||0)),0));
const isPlatform=channel=>channel==='Keeta'||channel==='Foodpanda';
const onsitePayments=['現金','Alipay','WeChat Pay','FPS','PayMe','組合付款'];
const policies={
  '現場':{group:'onsite',requiresPaymentMethod:true,paymentMethods:onsitePayments,fields:[],initialPaymentStatus:'已付款'},
  '電話／WhatsApp':{group:'owned',requiresPaymentMethod:false,paymentMethods:[],fields:['note'],initialPaymentStatus:'付款待核實'},
  '磨飯 App':{group:'owned',requiresPaymentMethod:false,paymentMethods:[],fields:['pickupCode','verificationCode','note'],initialPaymentStatus:'付款待核實'},
  'Keeta':{group:'platform',requiresPaymentMethod:false,paymentMethods:[],fields:['platformOrderId','note'],initialPaymentStatus:'平台已付'},
  'Foodpanda':{group:'platform',requiresPaymentMethod:false,paymentMethods:[],fields:['platformOrderId','note'],initialPaymentStatus:'平台已付'},
};
export function getChannelPolicy(channel){
  const policy=policies[channel]||policies['現場'];
  return {...policy,paymentMethods:[...policy.paymentMethods],fields:[...policy.fields]};
}
const studentDiscountBase=item=>{
  const surcharge=Number(item?.specialDrinkSurcharge)||0;
  return item?.studentDiscountEligible===true&&surcharge>=6?surcharge:0;
};
const eligibleStudentUnits=line=>{
  const ownBase=studentDiscountBase(line);
  if(ownBase)return [{qty:Math.max(0,Number(line.qty)||0),base:ownBase}];
  const assignments=(line.drinkAssignments||[]).map(drink=>({qty:1,base:studentDiscountBase(drink)})).filter(item=>item.base);
  if(assignments.length)return assignments;
  return (line.combo?.components||[])
    .filter(component=>component.role==='drink')
    .map(drink=>({qty:Math.max(1,Number(line.qty)||1),base:studentDiscountBase(drink)}))
    .filter(item=>item.base);
};

export function applyCheckoutDiscount(cart,discount={type:'none'},channel='現場'){
  const subtotal=subtotalOf(cart);
  if(!discount||discount.type==='none')return {subtotal,discountAmount:0,payable:subtotal,appliedUnits:0};
  if(isPlatform(channel))throw new Error('平台訂單不可使用本店優惠');
  let discountAmount=0;
  let appliedUnits=0;
  if(discount.type==='student'){
    let remaining=Math.max(0,Math.floor(Number(discount.studentCount)||0));
    for(const line of cart||[]){
      for(const eligible of eligibleStudentUnits(line)){
        if(!remaining)break;
        const units=Math.min(remaining,eligible.qty);
        discountAmount+=eligible.base*.5*units;
        appliedUnits+=units;
        remaining-=units;
      }
    }
  }else if(discount.type==='group'){
    const percent=Math.max(0,Math.min(100,Number(discount.percent)||0));
    discountAmount=subtotal*percent/100;
  }
  discountAmount=roundMoney(discountAmount);
  return {subtotal,discountAmount,payable:roundMoney(Math.max(0,subtotal-discountAmount)),appliedUnits};
}

export function enterKeypadValue(current,key){
  const value=String(current??'');
  if(key==='clear')return '';
  if(key==='backspace')return value.slice(0,-1);
  if(key==='.'&&value.includes('.'))return value;
  if(key==='.')return value?value+'.':'0.';
  if(key==='00')return value&&value!=='0'?(value+'00').slice(0,9):'0';
  if(!/^\d$/.test(String(key)))return value;
  const next=value==='0'?String(key):value+key;
  const [,decimals='']=next.split('.');
  return decimals.length>2?value:next.slice(0,9);
}

export function buildCheckoutRecord({id,identity=null,cart,channel,payment,pricing,discount,terminalId,now,audit=[],channelData={},receivedAmount=0}){
  if(Number(pricing?.payable)<=0)throw new Error('訂單金額必須大於零');
  const policy=getChannelPolicy(channel);
  const deferred=false;
  const pending=policy.initialPaymentStatus==='付款待核實'||deferred;
  const paymentMethod=policy.requiresPaymentMethod?(payment||policy.paymentMethods[0]):policy.group==='platform'?'平台已付':'待核實';
  const base={
    ...(identity||{}),id:identity?.id||id,group:policy.group,
    source:channel,acceptedAt:now,itemCount:(cart||[]).reduce((n,line)=>n+Number(line.qty||0),0),
    subtotal:pricing.subtotal,discountAmount:pricing.discountAmount,amount:pricing.payable,
    discount:{...discount,appliedUnits:pricing.appliedUnits},paymentMethod,paymentStatus:pending?'付款待核實':policy.initialPaymentStatus,
    reconciliationStatus:pending?'pending':policy.group==='platform'?'platform_paid':'not_required',channelData:{...channelData},
    paidAmount:pending?0:roundMoney(pricing.payable),
    receivedAmount:pending?0:roundMoney(paymentMethod==='現金'?receivedAmount:pricing.payable),
    changeAmount:pending?0:roundMoney(paymentMethod==='現金'?Math.max(0,Number(receivedAmount||0)-Number(pricing.payable||0)):0),printStatus:'正常',
    items:(cart||[]).map(line=>({...line})),cart:(cart||[]).map(line=>({...line})),audit:[...audit]
  };
  if(policy.group==='platform'){
    base.platformSalesGross=pricing.subtotal;
    base.platformCommissionRate=.25;
    base.estimatedPlatformCommission=roundMoney(pricing.subtotal*.25);
    base.estimatedPlatformSettlement=roundMoney(pricing.subtotal-base.estimatedPlatformCommission);
  }
  if(discount?.type&&discount.type!=='none')base.audit.push({type:'discount.applied',terminalId,at:now,discount:{...base.discount},amount:pricing.discountAmount});
  return recordCheckoutOperator(base,terminalId,now);
}
