import {validateMfkAdminConfigAck,validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {validateSmtProjectionBatch} from '../contracts/smt-projection-v1.ts';
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
    'access-control-allow-headers':'content-type,x-mfk-admin-publish-key',
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

function row(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function rows(value){return Array.isArray(value)?value:[];}
function customerPublicSnapshot(active,customerOrders=[]){
  const snapshot=row(active?.snapshot);
  const catalog=row(snapshot.catalog);
  const optionCenter=row(snapshot.optionCenter);
  const availability=row(snapshot.availability);
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
    current.push({setId,defaultOptionIds:rows(link.defaultOptionIds).map(String)});
    linksByProduct.set(productId,current);
  }
  const products=rows(catalog.products)
    .map(raw=>{
      const item=row(raw);
      const productId=String(item.id||'');
      const categoryId=String(item.categoryId||'');
      const sellability=row(availability[productId]);
      const optionGroups=(linksByProduct.get(productId)||[]).flatMap(link=>{
        const set=sets.get(link.setId);
        if(!set||set.active===false)return[];
        const options=rows(set.options)
          .map(optionRaw=>{const option=row(optionRaw);return{
            optionId:String(option.id||option.code||''),
            name:String(option.name||option.id||option.code||''),
            available:option.active!==false,
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
      return{
        productId,
        categoryId,
        name:String(item.name||productId),
        description:String(item.description||''),
        available:item.active!==false&&sellability.sellable!==false,
        optionGroups,
        position:Number(item.legacySourcePosition??item.position??0),
      };
    })
    .filter(item=>item.productId&&categoryIds.has(item.categoryId)&&item.available)
    .sort((a,b)=>a.position-b.position||a.productId.localeCompare(b.productId))
    .map(({position,...item})=>item);
  const settings=row(snapshot.storeSettings);
  const customerPresentation=row(row(snapshot.presentation).customer);
  const channelAvailable=customerPresentation.channelAvailable===false?false:true;
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
      amountLabel:'HK$'+(totalMinor/100).toFixed(2),
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
      notice:typeof customerPresentation.notice==='string'?customerPresentation.notice:undefined,
      observedAt:new Date().toISOString(),
    },
    menu:{
      revision:String(active?.revision??'0'),
      observedAt:new Date().toISOString(),
      categories:categories.map(item=>({categoryId:item.id,name:item.name,sortOrder:item.position})),
      products,
    },
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

  async projectionCashRows(prefix){
    const rows=await this.state.storage.list({prefix});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.businessDate||'').localeCompare(String(a.businessDate||'')));
  }

  async projectionReports(){
    const [orders,openings,closes]=await Promise.all([
      this.projectionOrders(),
      this.projectionCashRows('projection:cash-opening:'),
      this.projectionCashRows('projection:day-close:'),
    ]);
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
    const openingByDate=new Map(openings.map(row=>[String(row.businessDate||''),row]));
    const closeByDate=new Map(closes.map(row=>[String(row.businessDate||''),row]));
    const dates=new Set([...byDate.keys(),...openingByDate.keys(),...closeByDate.keys()]);
    return [...dates].sort((a,b)=>b.localeCompare(a)).map(date=>({
      ...(byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0}),
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

    if(url.pathname.startsWith('/api/customer/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const customerId=env.CUSTOMER_RUNTIME.idFromName(storeId);
      const customer=env.CUSTOMER_RUNTIME.get(customerId);
      const adminId=env.ADMIN_SYNC.idFromName(storeId);
      const admin=env.ADMIN_SYNC.get(adminId);

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

      if(url.pathname.startsWith('/api/customer/smt/')){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/smt/'+url.pathname.slice('/api/customer/smt/'.length);
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
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
