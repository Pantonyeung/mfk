import type {MfkLocalRuntime} from './local-runtime.ts';
import {priceCustomerCart} from './customer-cloud-intake.ts';
import {projectSyncedOrderingCatalog} from './admin-config-projection.ts';
import {readSmtAdminConfigLkg} from './admin-config-sync.ts';
import {readSmtDiningTableRegistry,readSmtStoreSettings} from './admin-operational-config.ts';
import type {SmmLanOrderRequest,SmmLanOrderResponse,SmmLanSubmissionReadbackResponse} from '../../../contracts/smm-lan-v1.ts';

const RESULT_KEY='mfk.v2local.smm-lan-results.v1';

interface StoredResult{readonly submissionId:string;readonly orderId:string;readonly canonicalRevision:number;readonly idempotencyKey:string;readonly requestId:string}

function results():StoredResult[]{
  try{const value=JSON.parse(localStorage.getItem(RESULT_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[]}
}
function writeResults(rows:readonly StoredResult[]){localStorage.setItem(RESULT_KEY,JSON.stringify(rows.slice(-2000)));}
function rejected(req:SmmLanOrderRequest,reasonCode:string):SmmLanOrderResponse{
  return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:req.requestId,submissionId:req.submissionId,idempotencyKey:req.idempotencyKey,disposition:'REJECTED',reasonCode});
}
function paymentLabel(tender:SmmLanOrderRequest['tender']){
  return tender==='CASH'?'現金'
    :tender==='ALIPAY'?'AlipayHK'
    :tender==='WECHAT'?'WeChat Pay HK'
    :tender==='FPS'?'FPS'
    :'PayMe';
}
function serviceModeValue(mode:SmmLanOrderRequest['serviceMode']):'takeaway'|'dine-in'{
  return mode==='DINE_IN'?'dine-in':'takeaway';
}

// Dining projection labels are resolved from the Admin-published table registry.
export function createSmmLanIngress(runtime:MfkLocalRuntime){
  return Object.freeze({
    readSnapshot(){
      const envelope=readSmtAdminConfigLkg();
      if(!envelope)throw new Error('SMM_ADMIN_CONFIG_REQUIRED');
      const takeaway=projectSyncedOrderingCatalog('takeaway',envelope);
      const dineIn=projectSyncedOrderingCatalog('dine-in',envelope);
      const dineById=new Map(dineIn.products.map(row=>[row.id,row] as const));
      return Object.freeze({
        connectionPath:'LAN' as const,
        menu:Object.freeze({
          revision:String(envelope.revision),
          observedAt:new Date().toISOString(),
          categories:Object.freeze(takeaway.categories.map(row=>Object.freeze({categoryId:row.id,name:row.label,sortOrder:row.position}))),
          products:Object.freeze(takeaway.products.map(row=>{
            const dine=dineById.get(row.id);
            return Object.freeze({
              productId:row.id,
              categoryId:row.categoryId,
              name:row.name,
              available:row.sellable&&row.priceReady,
              ...(row.priceReady?{
                publishedTakeawayUnitPriceMinor:row.priceMinor,
                publishedDineInUnitPriceMinor:dine?.priceMinor??row.priceMinor,
              }:{}),
              ...(row.imageUrl?{imageRef:row.imageUrl}:{}),
              optionGroups:Object.freeze(row.optionSets.map(set=>Object.freeze({
                optionGroupId:set.id,name:set.name,required:set.required,minSelections:set.min,maxSelections:set.max,
                options:Object.freeze(set.options.map(option=>Object.freeze({
                  optionId:option.id,
                  name:option.name,
                  available:option.active,
                  publishedAdjustmentMinor:option.priceAdjustmentMinor,
                }))),
              }))),
            });
          })),
        }),
        orders:Object.freeze(runtime.orders().filter(order=>!order.items.length||!order.items.every(item=>item.serviceMode==='dine-in')).map(order=>Object.freeze({
          orderId:order.id,
          displayCode:order.display,
          source:order.sourceLabel,
          lifecycle:order.fulfillmentLabel,
          amountLabel:'HKD '+(order.totalMinor/100).toFixed(2),
          itemSummary:order.items.map(item=>item.name+' ×'+item.qty).join('、'),
          observedAt:order.updatedAt||order.createdAt,
          readback:'CONFIRMED' as const,
          ...(order.orderRemark?{note:order.orderRemark}:{}),
          timeline:Object.freeze([
            Object.freeze({at:order.createdAt,label:'建立訂單',detail:order.sourceLabel}),
            ...(order.updatedAt&&order.updatedAt!==order.createdAt?[Object.freeze({at:order.updatedAt,label:order.fulfillmentLabel})]:[]),
          ]),
        }))),
        work:Object.freeze([]),
        channels:Object.freeze([]),
        dineSessions:Object.freeze(runtime.holds().filter(hold=>hold.kind==='dining').map(hold=>{
          const payments=hold.payments??[];
          const tableNameById=new Map(readSmtDiningTableRegistry().map(table=>[table.id,table.name]));
          const lines=hold.items.map((item,lineIndex)=>{
            const paidQty=payments.reduce((sum,payment)=>sum+payment.selections.filter(selection=>selection.lineIndex===lineIndex).reduce((inner,selection)=>inner+selection.qty,0),0);
            return Object.freeze({lineIndex,name:item.name,qty:item.qty,paidQty,remainingQty:Math.max(0,item.qty-paidQty),unitMinor:item.unitMinor});
          });
          const paidMinor=payments.reduce((sum,payment)=>sum+payment.amountMinor,0);
          return Object.freeze({
            sessionId:hold.id,
            tableLabel:hold.assignedTable?(tableNameById.get(hold.assignedTable)||hold.assignedTable):'輪候 '+hold.codeLabel,
            covers:hold.partySize,
            state:hold.assignedTable?'OCCUPIED':'WAITING',
            openedAt:hold.createdAt,
            itemSummary:hold.items.map(item=>item.name+' ×'+item.qty).join('、'),
            totalMinor:hold.totalMinor,
            paidMinor,
            remainingMinor:Math.max(0,hold.totalMinor-paidMinor),
            lines:Object.freeze(lines),
          });
        })),
        printHealth:Object.freeze([]),
        refundRequests:Object.freeze([]),
        observedAt:new Date().toISOString(),
      });
    },
    quoteCart(cart:any[]){
      const envelope=readSmtAdminConfigLkg();
      if(!envelope)throw new Error('SMM_ADMIN_CONFIG_REQUIRED');
      const catalog=projectSyncedOrderingCatalog('takeaway',envelope);
      const priced=priceCustomerCart(cart,catalog.products);
      return Object.freeze({
        quoteId:'SMM-LAN-'+Date.now(),revision:String(envelope.revision),currency:'HKD',totalMinor:priced.totalMinor,
        lines:Object.freeze(priced.items.map((item:any,index:number)=>Object.freeze({lineId:cart[index]?.lineId??String(index),currency:'HKD',finalUnitPriceMinor:item.unitMinor,lineTotalMinor:item.unitMinor*item.qty}))),
        observedAt:new Date().toISOString(),
      });
    },
    submit(input:SmmLanOrderRequest,context:{deviceId:string;trusted:boolean}):SmmLanOrderResponse{
      if(input.protocolVersion!==1||input.type!=='smm.lan.order.submit.v1')throw new Error('SMM_LAN_PROTOCOL_INVALID');
      if(input.storeId!=='MF01')return rejected(input,'SMM_LAN_STORE_MISMATCH');
      if(!context.trusted||!String(context.deviceId||'').trim())return rejected(input,'SMM_LAN_DEVICE_NOT_TRUSTED');
      if(!input.lines.length)return rejected(input,'SMM_LAN_LINES_REQUIRED');
      if(!String(input.menuRevision||'').trim())return rejected(input,'SMM_MENU_REVISION_REQUIRED');
      if(!Number.isSafeInteger(Number(input.publishedTotalMinor))||Number(input.publishedTotalMinor)<0)return rejected(input,'SMM_PUBLISHED_TOTAL_INVALID');
      if(!['TAKEAWAY','DINE_IN'].includes(String(input.serviceMode)))return rejected(input,'SMM_SERVICE_MODE_INVALID');
      if(!['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(String(input.tender)))return rejected(input,'SMM_TENDER_INVALID');
      if(input.serviceMode==='DINE_IN'&&input.diningTarget?.kind==='TABLE'){
        const tableIds=new Set((readSmtStoreSettings().diningTables.length?readSmtStoreSettings().diningTables:Array.from({length:9},(_,index)=>({id:'T'+String(index+1).padStart(2,'0')}))).map(row=>row.id));
        if(!tableIds.has(input.diningTarget.tableId||''))return rejected(input,'SMM_DINING_TABLE_NOT_PUBLISHED');
      }

      const prior=results().find(row=>row.submissionId===input.submissionId);
      if(prior){
        if(prior.idempotencyKey!==input.idempotencyKey)return rejected(input,'SMM_LAN_IDEMPOTENCY_CONFLICT');
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:prior.orderId,canonicalRevision:prior.canonicalRevision});
      }

      const providerRef='SMM:'+input.submissionId;
      const recovered=runtime.orders().find(order=>order.providerRef===providerRef)
        ??runtime.holds().find(hold=>hold.providerRef===providerRef||(hold.smmSubmissionRefs??[]).includes(providerRef));
      if(recovered){
        const canonicalRevision=1;
        writeResults([...results(),{submissionId:input.submissionId,orderId:recovered.id,canonicalRevision,idempotencyKey:input.idempotencyKey,requestId:input.requestId}]);
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:recovered.id,canonicalRevision});
      }

      const envelope=readSmtAdminConfigLkg();
      if(!envelope)return rejected(input,'SMM_ADMIN_CONFIG_REQUIRED');
      if(String(envelope.revision)!==input.menuRevision)return rejected(input,'SMM_MENU_REVISION_CHANGED');

      const serviceMode=serviceModeValue(input.serviceMode);
      const catalog=projectSyncedOrderingCatalog(serviceMode,envelope);
      let priced;
      try{
        priced=priceCustomerCart(input.lines.map(line=>Object.freeze({
          lineId:line.lineId,
          productId:line.productId,
          productName:line.productName,
          quantity:line.quantity,
          ...(line.selectedVariationId?{selectedVariationId:line.selectedVariationId}:{}),
          ...(line.selectedVariationName?{selectedVariationName:line.selectedVariationName}:{}),
          selections:line.selections,
          createdAt:new Date().toISOString(),
        })),catalog.products);
      }catch(error){
        return rejected(input,error instanceof Error?error.message:'SMM_CART_REVALIDATION_FAILED');
      }

      if(priced.totalMinor!==input.publishedTotalMinor)return rejected(input,'SMM_PUBLISHED_PRICE_CHANGED');
      for(let index=0;index<priced.items.length;index++){
        const published=Number(input.lines[index]?.publishedUnitPriceMinor);
        if(!Number.isSafeInteger(published)||published<0||published!==priced.items[index]!.unitMinor){
          return rejected(input,'SMM_PUBLISHED_PRICE_CHANGED');
        }
      }

      const items=priced.items.map(item=>Object.freeze({...item,serviceMode}));
      const canonicalRevision=1;
      if(input.serviceMode==='DINE_IN'){
        if(!input.diningTarget)return rejected(input,'SMM_DINING_TARGET_REQUIRED');
        const hold=runtime.upsertSmmDiningHold({
          providerRef,
          target:input.diningTarget,
          items:items.map(item=>({id:item.id,name:item.name,qty:item.qty,unitMinor:item.unitMinor})),
          totalMinor:priced.totalMinor,
          sourceLabel:'SMM',
        });
        const canonicalOrderId=hold.formalOrderId??hold.id;
        if(input.diningTarget.kind==='TABLE'&&hold.formalOrderId){
          void runtime.ensureDiningInitialPrint?.(hold.id).catch(()=>{});
        }
        writeResults([...results(),{submissionId:input.submissionId,orderId:canonicalOrderId,canonicalRevision,idempotencyKey:input.idempotencyKey,requestId:input.requestId}]);
        return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:canonicalOrderId,canonicalRevision});
      }
      const order=runtime.createOrder({
        items,
        totalMinor:priced.totalMinor,
        paymentLabel:paymentLabel(input.tender),
        sourceLabel:'SMM',
        providerRef,
        initialFulfillmentLabel:'進行中',
      });
      writeResults([...results(),{submissionId:input.submissionId,orderId:order.id,canonicalRevision,idempotencyKey:input.idempotencyKey,requestId:input.requestId}]);
      return Object.freeze({protocolVersion:1,type:'smm.lan.order.result.v1',requestId:input.requestId,submissionId:input.submissionId,idempotencyKey:input.idempotencyKey,disposition:'ACCEPTED',orderId:order.id,canonicalRevision});
    },
    readSubmission(submissionId:string):SmmLanSubmissionReadbackResponse{
      const prior=results().find(row=>row.submissionId===submissionId);
      return prior
        ?Object.freeze({protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'CONFIRMED',orderId:prior.orderId,canonicalRevision:prior.canonicalRevision})
        :Object.freeze({protocolVersion:1,type:'smm.lan.order.readback.result.v1',submissionId,state:'UNKNOWN'});
    },
  });
}
