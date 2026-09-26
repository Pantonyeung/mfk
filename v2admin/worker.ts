import {validateMfkAdminConfigAck,validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {validateSmtProjectionBatch} from '../contracts/smt-projection-v1.ts';
import {MFK_ADMIN_REFUND_SCHEMA,validateAdminRefundEvent} from '../contracts/admin-refund-v1.ts';
import {KeetaRuntimeStore} from './keeta-runtime.ts';
import {CustomerRuntimeStore} from './customer-runtime.ts';
export {KeetaRuntimeStore,CustomerRuntimeStore};

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const ADMIN_ORIGIN='https://admin.morefunos.com';
const SMT_ORIGIN='https://appassets.androidplatform.net';
const CUSTOMER_ORIGIN='https://order.morefunos.com';
const CORS_ORIGINS=new Set([ADMIN_ORIGIN,SMT_ORIGIN,CUSTOMER_ORIGIN]);

function json(value,status=200,extra={}){
  return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extra}});
}
function cors(request){
  const origin=request.headers.get('origin')||'';
  return CORS_ORIGINS.has(origin)?{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type,x-mfk-admin-publish-key,x-mfk-smm-session',
    'access-control-allow-credentials':'true',
    'vary':'origin',
  }:{};
}
async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function storeIdFrom(url){return (url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';}
function hktBusinessDate(iso,cutoff='05:00'){
  const at=Date.parse(String(iso||''));
  const parsed=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(cutoff||''));
  const cutoffMinutes=parsed?Number(parsed[1])*60+Number(parsed[2]):300;
  const shifted=new Date((Number.isFinite(at)?at:Date.now())+8*60*60*1000-cutoffMinutes*60*1000);
  return shifted.toISOString().slice(0,10);
}
function isCashMethod(method){
  const value=String(method||'').toUpperCase();
  return value.includes('CASH')||String(method||'').includes('現金');
}

async function resolveSmmStaffSession(request,storeId){
  const token=String(request.headers.get('x-mfk-smm-session')||'').trim();
  if(!token)return null;
  const url=new URL('https://smm.morefunos.com/api/smm/staff/session');
  url.searchParams.set('storeId',storeId);
  let response;
  try{
    response=await fetch(url.toString(),{
      method:'GET',
      headers:{'x-mfk-smm-session':token,'accept':'application/json'},
    });
  }catch{return null;}
  if(!response.ok)return null;
  const body=await response.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const staffId=String(body.staffId||'').trim();
  const displayName=String(body.displayName||'').trim();
  const role=String(body.role||'STAFF').trim();
  if(!staffId||!displayName)return null;
  return Object.freeze({staffId,displayName,role});
}

function row(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function rows(value){return Array.isArray(value)?value:[];}
function minorFromMoney(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}
function moneyLabel(minor){
  const value=Math.max(0,Number(minor)||0)/100;
  return 'HK'+String.fromCharCode(36)+(Number.isInteger(value)?String(value):value.toFixed(2));
}
function customerPublicSnapshot(active,customerOrders=[]){
  const snapshot=row(active?.snapshot);
  const catalog=row(snapshot.catalog);
  const optionCenter=row(snapshot.optionCenter);
  const availability=row(snapshot.availability);
  const productMedia=row(snapshot.productMedia);
  const categories=rows(catalog.categories)
    .map((raw,index)=>{const item=row(raw);return{id:String(item.id||''),name:String(item.name||''),position:Number(item.position??index*10),active:item.active!==false};})
    .filter(item=>item.id&&item.name&&item.active)
    .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const categoryIds=new Set(categories.map(item=>item.id));
  const sets=new Map(rows(optionCenter.sets).map(raw=>{const item=row(raw);return[String(item.id||''),item]}).filter(([id])=>id));
  const linksByProduct=new Map();
  for(const raw of rows(optionCenter.productLinks)){
    const link=row(raw),productId=String(link.productId||''),setId=String(link.setId||'');
    if(!productId||!setId)continue;
    const current=linksByProduct.get(productId)||[];
    current.push({setId});
    linksByProduct.set(productId,current);
  }
  const products=rows(catalog.products)
    .map(raw=>{
      const item=row(raw);
      const productId=String(item.id||'');
      const categoryId=String(item.categoryId||'');
      const sellability=row(availability[productId]);
      const media=row(productMedia[productId]);
      const optionGroups=(linksByProduct.get(productId)||[]).flatMap(link=>{
        const set=sets.get(link.setId);
        if(!set||set.active===false)return[];
        const options=rows(set.options)
          .map(optionRaw=>{const option=row(optionRaw);return{
            optionId:String(option.id||option.code||''),
            name:String(option.name||option.id||option.code||''),
            available:option.active!==false,
            publishedAdjustmentMinor:minorFromMoney(option.priceAdjustment),
            position:Number(option.position||0),
          }})
          .filter(option=>option.optionId&&option.name&&option.available)
          .sort((a,b)=>a.position-b.position||a.optionId.localeCompare(b.optionId))
          .map(({position,...option})=>option);
        return[{
          optionGroupId:String(set.id),
          name:String(set.name||set.id||'選項'),
          required:set.required===true,
          minSelections:Math.max(0,Number(set.min)||0),
          maxSelections:Math.max(1,Number(set.max)||1),
          options,
        }];
      });
      const priceText=String(item.basePrice??'').trim();
      const priceReady=priceText!==''&&Number.isFinite(Number(priceText));
      const baseMinor=minorFromMoney(priceText);
      const takeawayMinor=minorFromMoney(item.takeawayAdjustment)+(item.takeawaySurchargeEnabled===true?100:0);
      const imageUrl=String(media.publicUrl||media.canonicalImageRef||item.imageRef||'').trim();
      return{
        productId,
        categoryId,
        name:String(item.name||productId),
        description:String(item.description||''),
        available:item.active!==false&&sellability.sellable!==false&&priceReady,
        ...(priceReady?{displayPriceLabel:moneyLabel(baseMinor+takeawayMinor),publishedUnitPriceMinor:baseMinor+takeawayMinor}:{}),
        ...(imageUrl?{imageUrl,imageAlt:String(item.name||productId)}:{}),
        optionGroups,
        position:Number(item.legacySourcePosition??item.position??0),
      };
    })
    .filter(item=>item.productId&&categoryIds.has(item.categoryId)&&item.available)
    .sort((a,b)=>a.position-b.position||a.productId.localeCompare(b.productId))
    .map(({position,...item})=>item);
  const settings=row(snapshot.storeSettings);
  const defaultPaymentChannels=[
    {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
    {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
    {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
    {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
  ];
  const configuredPaymentChannels=Array.isArray(settings.customerPaymentChannels)?settings.customerPaymentChannels:defaultPaymentChannels;
  const paymentChannels=configuredPaymentChannels
    .map((raw,index)=>{const item=row(raw);const channelId=String(item.id||'').trim().toUpperCase();const label=String(item.name||'').trim();const url=String(item.qrImageUrl||'').trim();return{
      channelId,
      label,
      enabled:item.enabled!==false,
      sortOrder:Number(item.sortOrder??index+1),
      qrImageUrl:url.startsWith('https://')?url:'',
    };})
    .filter(item=>/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(item.channelId)&&item.label&&item.enabled)
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.channelId.localeCompare(b.channelId))
    .map(({enabled,sortOrder,qrImageUrl,...item})=>({...item,...(qrImageUrl?{qrImageUrl}:{})}));
  const rawWhatsappDigits=String(settings.customerWhatsAppNumber||'').replace(/\D/g,'').slice(0,15);
  const whatsappDigits=rawWhatsappDigits.length===8?'852'+rawWhatsappDigits:rawWhatsappDigits;
  const fallbackTemplate=String(settings.customerWhatsAppTemplate||'你好，我想經 WhatsApp 落單。\n姓名：{name}\n電話：{phone}\n餐點：\n{items}\n總額：{total}\n網上自動接單暫時未能連接，請人工確認。').trim().slice(0,2000);
  const customerFallback={
    enabled:settings.customerWhatsAppEnabled!==false&&whatsappDigits.length>=8&&Boolean(fallbackTemplate),
    phone:whatsappDigits,
    template:fallbackTemplate,
    retryAttempts:3,
  };
  const customerPresentation=row(row(snapshot.presentation).customer);
  const customerChannel=row(snapshot.customerChannelPolicy);
  const channelAvailable=customerChannel.enabled===true;
  const stageFor=label=>label==='待處理'?'RECEIVED':label==='進行中'?'PREPARING':label==='可取餐'?'READY':label==='已完成'?'COMPLETED':label==='已取消'?'REJECTED':'RECEIVED';
  const projectOrder=rawOrder=>{
    const order=row(rawOrder);
    const stage=stageFor(String(order.fulfillmentLabel||''));
    const observedAt=String(order.updatedAt||order.createdAt||new Date().toISOString());
    const itemRows=rows(order.items);
    const display=String(order.display||'');
    const totalMinor=Math.max(0,Number(order.totalMinor)||0);
    return{
      orderId:String(order.orderId||''),
      displayCode:display,
      stage,
      itemSummary:itemRows.map(item=>String(row(item).name||'')).filter(Boolean).join('、'),
      amountLabel:moneyLabel(totalMinor),
      pickupCode:display||undefined,
      observedAt,
      readback:'CONFIRMED',
      timeline:[{at:observedAt,stage,label:String(order.fulfillmentLabel||stage)}],
    };
  };
  const projectedOrders=customerOrders.map(projectOrder).filter(order=>order.orderId&&order.displayCode);
  return{
    store:{
      storeId:String(active?.storeId||'MF01'),
      storeName:String(settings.storeName||'磨飯'),
      channelAvailable,
      notice:typeof customerPresentation.body==='string'&&customerPresentation.body.trim()?customerPresentation.body.trim():undefined,
      observedAt:new Date().toISOString(),
    },
    menu:{
      revision:String(active?.revision??'0'),
      observedAt:new Date().toISOString(),
      categories:categories.map(item=>({categoryId:item.id,name:item.name,sortOrder:item.position})),
      products,
    },
    paymentChannels,
    fallback:customerFallback,
    activeOrders:projectedOrders.filter(order=>order.stage!=='COMPLETED'),
    history:projectedOrders.filter(order=>order.stage==='COMPLETED').map(order=>({
      orderId:order.orderId,
      displayCode:order.displayCode,
      completedAt:order.observedAt,
      itemSummary:order.itemSummary,
      amountLabel:order.amountLabel,
      reorderEligible:true,
    })),
    observedAt:new Date().toISOString(),
  };
}

export class AdminSyncStore{
  constructor(state,env){this.state=state;this.env=env;}

  async authorizePublish(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const incoming=await sha256(key);
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled){
      await this.state.storage.put('publisherKeyHash',incoming);
      await this.state.storage.put('publisherEnrolledAt',new Date().toISOString());
      return true;
    }
    return enrolled===incoming;
  }

  async authorizeAdminRead(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled)return false;
    return enrolled===await sha256(key);
  }

  async authorizeProjectionWrite(request,events){
    if(request.headers.get('origin')!==SMT_ORIGIN)return false;
    const acks=await this.state.storage.get('acks')||{};
    return events.every(event=>Boolean(acks[event.deviceId]));
  }
  async authorizeSmtDevice(request){
    if(request.headers.get('origin')!==SMT_ORIGIN)return false;
    const url=new URL(request.url);
    const deviceId=(url.searchParams.get('deviceId')||'').trim();
    if(!deviceId)return false;
    const acks=await this.state.storage.get('acks')||{};
    return Boolean(acks[deviceId]);
  }

  async projectionOrders(){
    const rows=await this.state.storage.list({prefix:'projection:order:'});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  }

  async adminRefunds(){
    const rows=await this.state.storage.list({prefix:'admin:refund:'});
    return [...rows.values()]
      .map(row=>row?.refund??row)
      .filter(Boolean)
      .map(row=>{try{return validateAdminRefundEvent(row);}catch{return null;}})
      .filter(Boolean)
      .sort((a,b)=>String(b.executionAt||'').localeCompare(String(a.executionAt||'')));
  }

  async adminRefundAddenda(){
    const rows=await this.state.storage.list({prefix:'admin:day-close-addendum:'});
    return [...rows.values()]
      .filter(Boolean)
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }

  async businessCutoff(){
    const active=await this.state.storage.get('active');
    const raw=active?.snapshot?.businessDay?.cutoff;
    return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(String(raw||''))?String(raw):'05:00';
  }

  async createAdminRefund(input){
    const orderId=String(input?.orderId||'').trim();
    const lineId=String(input?.lineId||'').trim();
    const quantity=Math.max(0,Math.floor(Number(input?.quantity)||0));
    const amountMinor=Math.max(0,Math.round(Number(input?.amountMinor)||0));
    const method=String(input?.method||'').trim();
    const note=String(input?.note||'').trim().slice(0,500);
    if(!orderId)return {error:'ADMIN_REFUND_ORDER_REQUIRED',status:400};
    if(!lineId)return {error:'ADMIN_REFUND_LINE_REQUIRED',status:400};
    if(quantity<1)return {error:'ADMIN_REFUND_QUANTITY_INVALID',status:400};
    if(amountMinor<1)return {error:'ADMIN_REFUND_AMOUNT_INVALID',status:400};
    if(!['CASH','FPS','PAYME','ALIPAY','WECHAT'].includes(method))return {error:'ADMIN_REFUND_METHOD_INVALID',status:400};

    const orders=await this.projectionOrders();
    const order=orders.find(row=>String(row.orderId||'')===orderId);
    if(!order)return {error:'ADMIN_REFUND_ORDER_NOT_FOUND',status:404};
    if(/^Keeta\b|^Foodpanda\b|^第三方/.test(String(order.sourceLabel||'')))return {error:'PROVIDER_REFUND_USE_AFTERSALE',status:409};
    const line=(Array.isArray(order.items)?order.items:[]).find(row=>String(row?.id||'')===lineId);
    if(!line)return {error:'ADMIN_REFUND_LINE_NOT_FOUND',status:404};
    if(quantity>Math.max(0,Math.floor(Number(line.qty)||0)))return {error:'ADMIN_REFUND_QUANTITY_INVALID',status:400};

    const closes=await this.projectionCashRows('projection:day-close:');
    const originalBusinessDate=String(order.businessDate||'');
    const close=closes.filter(row=>String(row.businessDate||'')===originalBusinessDate)
      .sort((a,b)=>(Number(b.version)||0)-(Number(a.version)||0))[0];
    if(!close)return {error:'ADMIN_REFUND_ORIGINAL_DAY_CLOSE_REQUIRED',status:409};

    const refunds=await this.adminRefunds();
    const embedded=(Array.isArray(order.refunds)?order.refunds:[]).filter(Boolean);
    const allRefunds=[...refunds,...embedded].filter((row,index,rows)=>
      String(row?.orderId||orderId)===orderId&&rows.findIndex(other=>String(other?.refundId||other?.id||'')===String(row?.refundId||row?.id||''))===index
    );
    const lineOriginalMinor=Math.max(0,Math.floor(Number(line.qty)||0)*Math.max(0,Math.round(Number(line.unitMinor)||0)));
    const priorLineRefund=allRefunds.flatMap(row=>Array.isArray(row?.lines)?row.lines:[])
      .filter(row=>String(row?.lineId||'')===lineId)
      .reduce((sum,row)=>sum+Math.max(0,Math.round(Number(row?.amountMinor)||0)),0);
    const lineRemaining=Math.max(0,lineOriginalMinor-priorLineRefund);
    const selectedMax=Math.max(0,quantity*Math.max(0,Math.round(Number(line.unitMinor)||0)));
    if(amountMinor>lineRemaining||amountMinor>selectedMax)return {error:'ADMIN_REFUND_EXCEEDS_LINE_REMAINING',status:409};
    const priorOrderRefund=allRefunds.reduce((sum,row)=>sum+Math.max(0,Math.round(Number(row?.amountMinor)||0)),0);
    if(priorOrderRefund+amountMinor>Math.max(0,Math.round(Number(order.totalMinor)||0))){
      return {error:'ADMIN_REFUND_EXCEEDS_ORDER_REMAINING',status:409};
    }

    const executionAt=new Date().toISOString();
    const cutoff=await this.businessCutoff();
    const executionBusinessDate=hktBusinessDate(executionAt,cutoff);
    const existingAddenda=(await this.adminRefundAddenda()).filter(row=>String(row.businessDate||'')===originalBusinessDate);
    const addendumSequence=existingAddenda.length+1;
    const originalDayCloseVersion=Math.max(1,Math.floor(Number(close.version)||1));
    const refundId='AR-'+crypto.randomUUID();
    const event=validateAdminRefundEvent({
      schema:MFK_ADMIN_REFUND_SCHEMA,
      refundId,
      storeId:'MF01',
      orderId,
      display:String(order.display||orderId),
      originalBusinessDate,
      originalCreatedAt:String(order.createdAt||executionAt),
      executionAt,
      executionBusinessDate,
      method,
      amountMinor,
      lines:[{
        lineId,
        itemName:String(line.name||lineId),
        quantity,
        amountMinor,
      }],
      note,
      source:'ADMIN',
      originalDayCloseVersion,
      addendumSequence,
      addendumVersionLabel:String(originalDayCloseVersion)+'.'+String(addendumSequence),
    });
    const addendum={
      schema:'MFK_DAY_CLOSE_REFUND_ADDENDUM_V1',
      id:'DCA-'+originalBusinessDate+'-'+String(addendumSequence).padStart(3,'0'),
      storeId:'MF01',
      businessDate:originalBusinessDate,
      baseVersion:originalDayCloseVersion,
      addendumSequence,
      versionLabel:event.addendumVersionLabel,
      createdAt:executionAt,
      refundId,
      orderId,
      display:event.display,
      originalCreatedAt:event.originalCreatedAt,
      executionAt,
      executionBusinessDate,
      method,
      amountMinor,
      lines:event.lines,
      note,
      postingMode:'NON_POSTING_REFERENCE',
    };
    await this.state.storage.put('admin:refund:'+refundId,{refund:event});
    await this.state.storage.put(
      'admin:day-close-addendum:'+originalBusinessDate+':'+String(addendumSequence).padStart(6,'0')+':'+refundId,
      addendum,
    );
    const doorbell=JSON.stringify({
      type:'ADMIN_REFUND_AVAILABLE',
      storeId:'MF01',
      refundId,
      orderId,
      executionAt,
      executionBusinessDate,
    });
    for(const socket of this.state.getWebSockets()){
      try{socket.send(doorbell);}catch{}
    }
    return {event,addendum};
  }

  async projectionCashRows(prefix){
    const rows=await this.state.storage.list({prefix});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.businessDate||'').localeCompare(String(a.businessDate||'')));
  }

  async projectionReports(){
    const [orders,openings,closes,adminRefunds]=await Promise.all([
      this.projectionOrders(),
      this.projectionCashRows('projection:cash-opening:'),
      this.projectionCashRows('projection:day-close:'),
      this.adminRefunds(),
    ]);
    const cutoff=await this.businessCutoff();
    const byDate=new Map();
    for(const order of orders){
      const date=String(order.businessDate||'');
      if(!date)continue;
      const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0};
      const cancelled=String(order.fulfillmentLabel||'')==='已取消';
      if(!cancelled){
        const total=Math.max(0,Number(order.totalMinor)||0);
        row.grossMinor+=total;
        row.netMinor+=total;
        row.orders+=1;
        const label=String(order.paymentLabel||'');
        if(label.toUpperCase().startsWith('COMBO')){
          const match=label.match(/\bCASH\s+\$?([0-9]+(?:\.[0-9]{1,2})?)/i);
          if(match)row.cashSalesMinor+=Math.round(Number(match[1])*100);
        }else if(label.toUpperCase().includes('CASH')||label.includes('現金')){
          row.cashSalesMinor+=total;
        }
      }
      byDate.set(date,row);
    }
    const refundById=new Map();
    for(const order of orders){
      for(const refund of Array.isArray(order.refunds)?order.refunds:[]){
        const id=String(refund?.refundId||refund?.id||'').trim();
        if(!id)continue;
        refundById.set(id,{
          ...refund,
          refundId:id,
          orderId:String(order.orderId||''),
          originalBusinessDate:String(order.businessDate||''),
          executionBusinessDate:hktBusinessDate(String(refund.createdAt||''),cutoff),
          executionAt:String(refund.createdAt||''),
        });
      }
    }
    for(const refund of adminRefunds)refundById.set(refund.refundId,refund);
    for(const refund of refundById.values()){
      const date=String(refund.executionBusinessDate||hktBusinessDate(refund.executionAt,cutoff));
      if(!date)continue;
      const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0,refundMinor:0,cashRefundMinor:0};
      const amount=Math.max(0,Math.round(Number(refund.amountMinor)||0));
      row.refundMinor=(Number(row.refundMinor)||0)+amount;
      row.cashRefundMinor=(Number(row.cashRefundMinor)||0)+(isCashMethod(refund.method)?amount:0);
      row.adjustmentMinor=-(Number(row.refundMinor)||0);
      row.netMinor=(Number(row.grossMinor)||0)-(Number(row.refundMinor)||0);
      byDate.set(date,row);
    }
    const openingByDate=new Map(openings.map(row=>[String(row.businessDate||''),row]));
    const closeByDate=new Map(closes.map(row=>[String(row.businessDate||''),row]));
    const dates=new Set([...byDate.keys(),...openingByDate.keys(),...closeByDate.keys()]);
    return [...dates].sort((a,b)=>b.localeCompare(a)).map(date=>({
      ...(()=>{const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0,refundMinor:0,cashRefundMinor:0};const refundMinor=Number(row.refundMinor)||0;return {...row,refundMinor,cashRefundMinor:Number(row.cashRefundMinor)||0,adjustmentMinor:-refundMinor,netMinor:(Number(row.grossMinor)||0)-refundMinor};})(),
      openingCash:openingByDate.get(date)||null,
      dayClose:closeByDate.get(date)||null,
    }));
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/authorize-admin'){
      if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_READ_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/authorize-publish'){
      if(!await this.authorizePublish(request))return json({code:'ADMIN_PUBLISH_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/authorize-smt-device'){
      if(!await this.authorizeSmtDevice(request))return json({code:'SMT_DEVICE_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/customer-orders'&&request.method==='GET'){
      const wanted=new Set(url.searchParams.getAll('submissionId').map(value=>String(value).trim()).filter(Boolean).slice(0,24));
      if(!wanted.size)return json({orders:[]});
      const orders=(await this.projectionOrders()).filter(order=>{
        const ref=String(order.externalRef||'');
        return ref.startsWith('CUSTOMER:')&&wanted.has(ref.slice('CUSTOMER:'.length));
      });
      return json({orders});
    }
    if(url.pathname==='/customer-doorbell'&&request.method==='POST'){
      let body;
      try{body=await request.json();}catch{return json({code:'CUSTOMER_DOORBELL_INVALID'},400);}
      if(!['CUSTOMER_QUOTE_AVAILABLE','CUSTOMER_ORDER_AVAILABLE'].includes(String(body?.type||''))){
        return json({code:'CUSTOMER_DOORBELL_TYPE_INVALID'},400);
      }
      const message=JSON.stringify({
        type:String(body.type),
        storeId:'MF01',
        requestId:body.requestId?String(body.requestId):undefined,
        submissionId:body.submissionId?String(body.submissionId):undefined,
        receivedAt:new Date().toISOString(),
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(message);}catch{}
      }
      return json({state:'DOORBELL_SENT'});
    }
    if(url.pathname==='/provider-doorbell'&&request.method==='POST'){
      let body;
      try{body=await request.json();}catch{return json({code:'PROVIDER_DOORBELL_INVALID'},400);}
      if(body?.type!=='KEETA_ORDER_AVAILABLE')return json({code:'PROVIDER_DOORBELL_TYPE_INVALID'},400);
      const message=JSON.stringify({
        type:'KEETA_ORDER_AVAILABLE',
        storeId:'MF01',
        provider:'KEETA',
        providerOrderId:String(body.providerOrderId||''),
        providerMessageId:String(body.providerMessageId||''),
        receivedAt:new Date().toISOString(),
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(message);}catch{}
      }
      return json({state:'DOORBELL_SENT'});
    }
    if(url.pathname==='/active'){
      const active=await this.state.storage.get('active');
      return active?json(active):json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},404);
    }
    if(url.pathname==='/publish'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizePublish(request))return json({code:'ADMIN_CONFIG_PUBLISH_UNAUTHORIZED'},401);
      let envelope;
      try{envelope=validateMfkAdminConfigEnvelope(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_INVALID'},400);}
      const current=await this.state.storage.get('active');
      if(current){
        if(envelope.revision<current.revision)return json({code:'ADMIN_CONFIG_REVISION_STALE',currentRevision:current.revision},409);
        if(envelope.revision===current.revision){
          if(envelope.fingerprint!==current.fingerprint)return json({code:'ADMIN_CONFIG_REVISION_CONFLICT',currentFingerprint:current.fingerprint},409);
          return json({state:'IDEMPOTENT',active:current});
        }
      }
      await this.state.storage.put('active',envelope);
      await this.state.storage.put('activeMeta',{revision:envelope.revision,fingerprint:envelope.fingerprint,publishedAt:envelope.publishedAt});
      const doorbell=JSON.stringify({
        type:'ADMIN_CONFIG_AVAILABLE',
        storeId:envelope.storeId,
        revision:envelope.revision,
        fingerprint:envelope.fingerprint,
        publishedAt:envelope.publishedAt,
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(doorbell);}catch{}
      }
      return json({state:'PUBLISHED',active:{revision:envelope.revision,fingerprint:envelope.fingerprint,publishedAt:envelope.publishedAt}});
    }
    if(url.pathname==='/ack'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let ack;
      try{ack=validateMfkAdminConfigAck(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_ACK_INVALID'},400);}
      const active=await this.state.storage.get('active');
      if(!active)return json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},409);
      if(ack.revision!==active.revision||ack.fingerprint!==active.fingerprint){
        return json({code:'ADMIN_CONFIG_ACK_MISMATCH',expectedRevision:active.revision,expectedFingerprint:active.fingerprint},409);
      }
      const acks=await this.state.storage.get('acks')||{};
      acks[ack.deviceId]=ack;
      await this.state.storage.put('acks',acks);
      return json({state:'ACKED',ack});
    }
    if(url.pathname==='/acks'){
      const acks=await this.state.storage.get('acks')||{};
      return json({acks:Object.values(acks).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)))});
    }
    if(url.pathname==='/events'){
      if(request.headers.get('upgrade')!=='websocket')return json({code:'WEBSOCKET_REQUIRED'},426);
      const pair=new WebSocketPair();
      const client=pair[0],server=pair[1];
      this.state.acceptWebSocket(server);
      const active=await this.state.storage.get('active');
      if(active){
        server.send(JSON.stringify({type:'ADMIN_CONFIG_AVAILABLE',storeId:active.storeId,revision:active.revision,fingerprint:active.fingerprint,publishedAt:active.publishedAt}));
      }
      return new Response(null,{status:101,webSocket:client});
    }

    if(url.pathname==='/refunds'){
      if(request.method==='GET'){
        if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_REFUND_READ_UNAUTHORIZED'},401);
        return json({refunds:await this.adminRefunds(),addenda:await this.adminRefundAddenda()});
      }
      if(request.method==='POST'){
        if(!await this.authorizePublish(request))return json({code:'ADMIN_REFUND_WRITE_UNAUTHORIZED'},401);
        let input;
        try{input=await request.json();}catch{return json({code:'ADMIN_REFUND_INPUT_INVALID'},400);}
        const created=await this.createAdminRefund(input);
        if(created.error)return json({code:created.error},created.status||400);
        return json({state:'REFUNDED',refund:created.event,addendum:created.addendum},201);
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }

    if(url.pathname==='/smt-refunds'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeSmtDevice(request))return json({code:'SMT_REFUND_READ_UNAUTHORIZED'},401);
      return json({refunds:(await this.adminRefunds()).slice(0,500)});
    }

    if(url.pathname==='/projection/events'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let batch;
      try{batch=validateSmtProjectionBatch(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'PROJECTION_BATCH_INVALID'},400);}
      if(!await this.authorizeProjectionWrite(request,batch.events))return json({code:'PROJECTION_WRITE_UNAUTHORIZED'},401);
      const accepted=[];
      const eventTypes=new Set();
      for(const event of batch.events){
        const eventKey='projection:event:'+event.eventId;
        const existing=await this.state.storage.get(eventKey);
        if(existing){accepted.push(event.eventId);continue;}
        if(event.type==='ORDER_UPSERT'){
          const key='projection:order:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||!Number.isFinite(currentAt)||incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }else if(event.type==='CASH_OPENING_CONFIRMED'){
          await this.state.storage.put('projection:cash-opening:'+event.entityId,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
        }else if(event.type==='DAY_CLOSE_RECORDED'){
          const key='projection:day-close:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingVersion=Number(event.payload?.version)||0;
          const currentVersion=Number(current?.payload?.version)||0;
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||incomingVersion>currentVersion||incomingVersion===currentVersion&&incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }
        await this.state.storage.put(eventKey,{type:event.type,entityId:event.entityId,occurredAt:event.occurredAt});
        accepted.push(event.eventId);
        eventTypes.add(event.type);
      }
      if(eventTypes.size){
        const doorbell=JSON.stringify({
          type:'SMT_PROJECTION_AVAILABLE',
          storeId:batch.events[0]?.storeId||'MF01',
          eventTypes:[...eventTypes],
          receivedAt:new Date().toISOString(),
        });
        for(const socket of this.state.getWebSockets()){
          try{socket.send(doorbell);}catch{}
        }
      }
      return json({state:'ACKED',accepted});
    }

    if(url.pathname==='/projection/orders'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({orders:await this.projectionOrders()});
    }

    if(url.pathname==='/projection/reports'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({days:await this.projectionReports()});
    }

    return json({code:'NOT_FOUND'},404);
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname==='/api/admin/payment-qr'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const storeId=storeIdFrom(url);
      const channelId=String(url.searchParams.get('channelId')||'').trim().toUpperCase();
      if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(channelId))return json({code:'PAYMENT_CHANNEL_ID_INVALID'},400);
      const adminId=env.ADMIN_SYNC.idFromName(storeId);
      const admin=env.ADMIN_SYNC.get(adminId);
      const authUrl=new URL(request.url);authUrl.pathname='/authorize-publish';authUrl.search='';
      const authResponse=await admin.fetch(new Request(authUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
      if(!authResponse.ok)return json({code:'ADMIN_PAYMENT_QR_UNAUTHORIZED'},401);
      const contentType=String(request.headers.get('content-type')||'').toLowerCase();
      if(!['image/jpeg','image/png','image/webp'].includes(contentType))return json({code:'PAYMENT_QR_TYPE_INVALID'},415);
      const declared=Number(request.headers.get('content-length')||0);
      if(declared>5*1024*1024)return json({code:'PAYMENT_QR_TOO_LARGE'},413);
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength<1||bytes.byteLength>5*1024*1024)return json({code:'PAYMENT_QR_SIZE_INVALID'},413);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const sha=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
      const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
      const objectKey='customer-payment-qr/'+storeId+'/'+channelId+'/'+sha+'.'+ext;
      await env.CUSTOMER_PAYMENT_EVIDENCE.put(objectKey,bytes,{httpMetadata:{contentType},customMetadata:{storeId,channelId,sha256:sha,kind:'PAYMENT_QR'}});
      const qrImageUrl=ADMIN_ORIGIN+'/api/customer/payment-qr?storeId='+encodeURIComponent(storeId)+'&ref='+encodeURIComponent(objectKey);
      return json({state:'UPLOADED',objectKey,qrImageUrl,sha256:sha,uploadedAt:new Date().toISOString()},201);
    }

    if(url.pathname.startsWith('/api/customer/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const customerId=env.CUSTOMER_RUNTIME.idFromName(storeId);
      const customer=env.CUSTOMER_RUNTIME.get(customerId);
      const adminId=env.ADMIN_SYNC.idFromName(storeId);
      const admin=env.ADMIN_SYNC.get(adminId);

      if(url.pathname==='/api/customer/channel-health'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const response=await customer.fetch(new Request('https://internal/public/channel-health',{method:'GET'}));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/snapshot'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
        if(!activeResponse.ok)return json({code:'CUSTOMER_CONFIG_NOT_PUBLISHED'},503,cors(request));
        const active=await activeResponse.json();
        const ids=url.searchParams.getAll('submissionId').map(value=>String(value).trim()).filter(Boolean).slice(0,24);
        const ordersUrl=new URL('https://internal/customer-orders');
        for(const id of ids)ordersUrl.searchParams.append('submissionId',id);
        const orderResponse=await admin.fetch(new Request(ordersUrl.toString(),{method:'GET'}));
        const orderBody=orderResponse.ok?await orderResponse.json():{orders:[]};
        return json(customerPublicSnapshot(active,Array.isArray(orderBody.orders)?orderBody.orders:[]),200,cors(request));
      }

      if(url.pathname==='/api/customer/payment-qr'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const objectKey=String(url.searchParams.get('ref')||'').trim();
        if(!objectKey.startsWith('customer-payment-qr/'+storeId+'/'))return json({code:'PAYMENT_QR_REF_INVALID'},400,cors(request));
        const object=await env.CUSTOMER_PAYMENT_EVIDENCE.get(objectKey);
        if(!object||object.customMetadata?.kind!=='PAYMENT_QR')return json({code:'PAYMENT_QR_NOT_FOUND'},404,cors(request));
        const headers=new Headers(cors(request));
        headers.set('content-type',object.httpMetadata?.contentType||'image/png');
        headers.set('cache-control','public, max-age=300, must-revalidate');
        if(url.searchParams.get('download')==='1')headers.set('content-disposition','attachment; filename="payment-qr.'+(object.httpMetadata?.contentType==='image/jpeg'?'jpg':object.httpMetadata?.contentType==='image/webp'?'webp':'png')+'"');
        return new Response(object.body,{status:200,headers});
      }

      if(url.pathname==='/api/customer/payment-evidence'&&request.method==='POST'){
        const contentType=String(request.headers.get('content-type')||'').toLowerCase();
        if(!['image/jpeg','image/png','image/webp'].includes(contentType))return json({code:'PAYMENT_EVIDENCE_TYPE_INVALID'},415,cors(request));
        const declared=Number(request.headers.get('content-length')||0);
        if(declared>8*1024*1024)return json({code:'PAYMENT_EVIDENCE_TOO_LARGE'},413,cors(request));
        const bytes=await request.arrayBuffer();
        if(bytes.byteLength<1||bytes.byteLength>8*1024*1024)return json({code:'PAYMENT_EVIDENCE_SIZE_INVALID'},413,cors(request));
        const evidenceId=crypto.randomUUID();
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
        const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
        const evidenceRef='customer-payment/'+storeId+'/'+evidenceId+'/'+sha256+'.'+ext;
        await env.CUSTOMER_PAYMENT_EVIDENCE.put(evidenceRef,bytes,{httpMetadata:{contentType},customMetadata:{storeId,evidenceId,sha256,kind:'PAYMENT_SCREENSHOT',verificationState:'PENDING'}});
        return json({state:'UPLOADED',evidenceRef,sha256,uploadedAt:new Date().toISOString()},201,cors(request));
      }

      if(url.pathname==='/api/customer/staff-orders/submit'){
        if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const staff=await resolveSmmStaffSession(request,storeId);
        if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'SMM 員工工作階段無效'},401,cors(request));
        const orderBody=await request.json().catch(()=>null);
        if(!orderBody)return json({code:'SMM_STAFF_ORDER_INVALID'},400,cors(request));
        const response=await customer.fetch(new Request('https://internal/public/staff-orders/submit',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({request:orderBody,staff}),
        }));
        if(response.status===202){
          try{
            const result=await response.clone().json();
            await admin.fetch(new Request('https://internal/customer-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type:'CUSTOMER_ORDER_AVAILABLE',
                source:'SMM',
                submissionId:result.submissionId,
              }),
            }));
          }catch{}
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/staff-orders/readback'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const staff=await resolveSmmStaffSession(request,storeId);
        if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'SMM 員工工作階段無效'},401,cors(request));
        const submissionId=String(url.searchParams.get('submissionId')||'').trim();
        const target=new URL('https://internal/public/staff-orders/readback');
        target.searchParams.set('submissionId',submissionId);
        const response=await customer.fetch(new Request(target.toString(),{method:'GET'}));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/smt/diagnostics'&&request.method==='GET'){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({ok:false,stage:'SMT_DEVICE_AUTH',status:authResponse.status,code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const quoteResponse=await customer.fetch(new Request('https://internal/smt/quotes/pending',{method:'GET'}));
        const quoteBody=quoteResponse.ok?await quoteResponse.json():{};
        const orderResponse=await customer.fetch(new Request('https://internal/smt/orders/pending',{method:'GET'}));
        const orderBody=orderResponse.ok?await orderResponse.json():{};
        const traceResponse=await customer.fetch(new Request('https://internal/smt/diagnostics',{method:'GET'}));
        const traceBody=traceResponse.ok?await traceResponse.json():{};
        return json({
          ok:quoteResponse.ok&&orderResponse.ok&&traceResponse.ok,
          stage:quoteResponse.ok&&orderResponse.ok&&traceResponse.ok?'CUSTOMER_BRIDGE_PULL_READY':'CUSTOMER_RUNTIME_PULL_FAILED',
          deviceAuthorized:true,
          pendingQuotes:Array.isArray(quoteBody.quotes)?quoteBody.quotes.length:null,
          pendingOrders:Array.isArray(orderBody.orders)?orderBody.orders.length:null,
          quotePullStatus:quoteResponse.status,
          orderPullStatus:orderResponse.status,
          lastPublicQuote:traceBody.lastPublicQuote??null,
          lastQuotePull:traceBody.lastQuotePull??null,
          lastQuoteAck:traceBody.lastQuoteAck??null,
          observedAt:new Date().toISOString(),
        },quoteResponse.ok&&orderResponse.ok&&traceResponse.ok?200:502,cors(request));
      }

      if(url.pathname==='/api/customer/smt/payment-evidence'&&request.method==='GET'){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const evidenceRef=String(url.searchParams.get('ref')||'').trim();
        if(!evidenceRef.startsWith('customer-payment/'+storeId+'/'))return json({code:'PAYMENT_EVIDENCE_REF_INVALID'},400,cors(request));
        const object=await env.CUSTOMER_PAYMENT_EVIDENCE.get(evidenceRef);
        if(!object)return json({code:'PAYMENT_EVIDENCE_NOT_FOUND'},404,cors(request));
        const headers=new Headers(cors(request));
        headers.set('content-type',object.httpMetadata?.contentType||'application/octet-stream');
        headers.set('cache-control','private, no-store');
        return new Response(object.body,{status:200,headers});
      }

      if(url.pathname.startsWith('/api/customer/smt/')){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/smt/'+url.pathname.slice('/api/customer/smt/'.length);
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          if(url.pathname==='/api/customer/orders/submit'&&normalizedCustomerOrderBody){
            init.headers.set('content-type','application/json');
            init.body=JSON.stringify(normalizedCustomerOrderBody);
          }else{
            const body=await request.arrayBuffer();
            if(body.byteLength)init.body=body;
          }
        }
        const response=await customer.fetch(new Request(target.toString(),init));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      const publicMap={
        '/api/customer/quote':'/public/quote',
        '/api/customer/quote/readback':'/public/quote/readback',
        '/api/customer/orders/submit':'/public/orders/submit',
        '/api/customer/orders/readback':'/public/orders/readback',
      };
      const targetPath=publicMap[url.pathname];
      let normalizedCustomerOrderBody=null;
      if(targetPath&&(url.pathname==='/api/customer/quote'||url.pathname==='/api/customer/orders/submit')){
        const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
        if(!activeResponse.ok)return json({code:'CUSTOMER_CONFIG_NOT_PUBLISHED'},503,cors(request));
        const active=await activeResponse.json();
        const activeSnapshot=row(active?.snapshot);
        const policy=row(activeSnapshot.customerChannelPolicy);
        if(policy.enabled!==true)return json({code:'CUSTOMER_CHANNEL_DISABLED'},503,cors(request));
        if(url.pathname==='/api/customer/orders/submit'){
          const intent=await request.clone().json().catch(()=>null);
          const checkout=row(row(intent).checkout);
          if(checkout.paymentMethod==='ELECTRONIC'){
            const channelId=String(checkout.paymentChannelId||'').trim().toUpperCase();
            const channelLabel=String(checkout.paymentChannelLabel||'').trim();
            const settings=row(activeSnapshot.storeSettings);
            const configured=Array.isArray(settings.customerPaymentChannels)?settings.customerPaymentChannels:[
              {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
              {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
              {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
              {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
            ];
            const channel=configured.map(raw=>row(raw)).find(item=>String(item.id||'').trim().toUpperCase()===channelId&&item.enabled!==false);
            const qr=channel?String(channel.qrImageUrl||'').trim():'';
            const currentLabel=channel?String(channel.name||'').trim():'';
            if(!channel||!currentLabel||!qr)return json({code:'CUSTOMER_PAYMENT_CHANNEL_UNAVAILABLE'},409,cors(request));
            if(channelLabel&&channelLabel!==currentLabel)return json({code:'CUSTOMER_PAYMENT_CHANNEL_CHANGED'},409,cors(request));
            normalizedCustomerOrderBody={
              ...row(intent),
              checkout:{...checkout,paymentChannelId:channelId,paymentChannelLabel:currentLabel},
            };
          }
        }
      }
      if(targetPath){
        const target=new URL(request.url);
        target.pathname=targetPath;
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        const response=await customer.fetch(new Request(target.toString(),init));
        if(response.status===202&&(url.pathname==='/api/customer/quote'||url.pathname==='/api/customer/orders/submit')){
          try{
            const body=await response.clone().json();
            await admin.fetch(new Request('https://internal/customer-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type:url.pathname==='/api/customer/quote'?'CUSTOMER_QUOTE_AVAILABLE':'CUSTOMER_ORDER_AVAILABLE',
                requestId:body.requestId,
                submissionId:body.submissionId,
              }),
            }));
          }catch{}
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }
      return json({code:'NOT_FOUND'},404,cors(request));
    }

    if(url.pathname.startsWith('/api/keeta/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const keetaId=env.KEETA_RUNTIME.idFromName(storeId);
      const keeta=env.KEETA_RUNTIME.get(keetaId);

      if(url.pathname.startsWith('/api/keeta/smt/')){
        const adminId=env.ADMIN_SYNC.idFromName(storeId);
        const admin=env.ADMIN_SYNC.get(adminId);
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{
          method:'GET',
          headers:new Headers(request.headers),
        }));
        if(!authResponse.ok)return json({code:'KEETA_SMT_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/smt/'+url.pathname.slice('/api/keeta/smt/'.length);
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        const response=await keeta.fetch(new Request(target.toString(),init));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname.startsWith('/api/keeta/admin/')){
        const adminId=env.ADMIN_SYNC.idFromName(storeId);
        const admin=env.ADMIN_SYNC.get(adminId);
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-admin';
        authorizeUrl.search='';
        let authResponse;
        try{
          authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{
            method:'GET',
            headers:new Headers(request.headers),
          }));
        }catch{
          return json({code:'KEETA_ADMIN_AUTH_RUNTIME_FAILED'},500,cors(request));
        }
        if(!authResponse.ok)return json({code:'KEETA_ADMIN_UNAUTHORIZED'},401,cors(request));
        const adminSubpath=url.pathname.slice('/api/keeta/admin/'.length);
        const target=new URL(request.url);
        target.pathname='/admin/'+adminSubpath;
        target.search=url.search;
        const init={method:request.method,headers:new Headers(request.headers)};
        const activeConfigSubpaths=new Set([
          'menu/preview','menu/sync',
          'sellability/preview','sellability/sync',
          'store/preview','store/hours/sync',
        ]);
        if(activeConfigSubpaths.has(adminSubpath)&&request.method==='POST'){
          const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
          if(!activeResponse.ok)return json({code:'KEETA_ADMIN_CONFIG_NOT_PUBLISHED'},409,cors(request));
          const active=await activeResponse.json();
          init.headers.set('content-type','application/json');
          init.body=JSON.stringify({
            revision:active.revision,
            adminFingerprint:active.fingerprint,
            snapshot:active.snapshot,
          });
        }else if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        let response;
        try{
          response=await keeta.fetch(new Request(target.toString(),init));
        }catch{
          return json({code:'KEETA_RUNTIME_DO_FETCH_FAILED'},500,cors(request));
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      const providerEnvelope=url.pathname==='/api/keeta/webhook'&&request.method==='POST'
        ?await request.clone().json().catch(()=>null)
        :null;
      const target=new URL(request.url);
      target.pathname=url.pathname==='/api/keeta/webhook'
        ?'/webhook'
        :url.pathname==='/api/keeta/oauth/callback'
          ?'/oauth/callback'
          :'/not-found';
      const forwardedHeaders=new Headers(request.headers);
      if(url.pathname==='/api/keeta/webhook'||url.pathname==='/api/keeta/oauth/callback'){
        forwardedHeaders.set('x-mfk-keeta-external-url',request.url);
      }else{
        forwardedHeaders.delete('x-mfk-keeta-external-url');
      }
      const init={method:request.method,headers:forwardedHeaders};
      if(request.method!=='GET'&&request.method!=='HEAD'){
        const body=await request.arrayBuffer();
        if(body.byteLength)init.body=body;
      }
      const response=await keeta.fetch(new Request(target.toString(),init));
      if(response.ok&&providerEnvelope){
        try{
          const eventId=Number(providerEnvelope.eventId);
          const message=typeof providerEnvelope.message==='string'?JSON.parse(providerEnvelope.message):null;
          const orderInfo=message?.orderInfo??message;
          const baseOrder=orderInfo?.baseOrder;
          const providerOrderId=String(
            eventId===1001
              ?baseOrder?.orderViewIdStr??baseOrder?.orderViewId??''
              :message?.orderViewIdStr??message?.orderViewId??''
          ).trim();
          if(providerOrderId){
            const adminId=env.ADMIN_SYNC.idFromName(storeId);
            const admin=env.ADMIN_SYNC.get(adminId);
            const type=eventId===1001
              ?'KEETA_ORDER_AVAILABLE'
              :[1002,1003,1004,1006,1008].includes(eventId)
                ?'KEETA_ORDER_EVENT_AVAILABLE'
                :[1005,1007].includes(eventId)
                  ?'KEETA_AFTER_SALE_AVAILABLE'
                  :null;
            if(type)await admin.fetch(new Request('https://internal/provider-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type,
                eventId,
                providerOrderId,
                providerMessageId:String(providerEnvelope.messageId||''),
              }),
            }));
          }
        }catch{}
      }
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname==='/api/admin-sync/provider-doorbell'||url.pathname==='/api/admin-sync/customer-doorbell'||url.pathname==='/api/admin-sync/customer-orders'||url.pathname==='/api/admin-sync/authorize-smt-device'){
      return json({code:'NOT_FOUND'},404,cors(request));
    }
    if(url.pathname.startsWith('/api/admin-sync/')||url.pathname.startsWith('/api/projection/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const id=env.ADMIN_SYNC.idFromName(storeId);
      const stub=env.ADMIN_SYNC.get(id);
      const targetPath=url.pathname.startsWith('/api/projection/')
        ?'/projection/'+url.pathname.slice('/api/projection/'.length)
        :url.pathname.replace('/api/admin-sync','')||'/active';
      const target=new URL(request.url);
      target.pathname=targetPath;
      target.search='';
      const forwarded=new Request(target.toString(),request);
      const response=await stub.fetch(forwarded);
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-admin'});
    return env.ASSETS.fetch(request);
  },
};

