export type PrintRole='顧客小票'|'製作單'|'打包單'|'產品標籤'|'袋標籤';

export interface PrintBinding{
  readonly id:string;
  readonly routeKey:string;
  readonly name:string;
  readonly model:string;
  readonly role:PrintRole;
  readonly host:string;
  readonly port:number;
  readonly capability:'receipt-80mm/kitchen'|'label-58mm';
  readonly encoding:'gb18030'|'big5'|'utf-8';
}

export interface PrintableOrder{
  readonly id:string;
  readonly display:string;
  readonly createdAt:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly sourceLabel:string;
  readonly items:readonly {readonly id:string;readonly name:string;readonly qty:number;readonly unitMinor:number}[];
}

export interface PlannedPrintJob{
  readonly id:string;
  readonly role:PrintRole;
  readonly binding:PrintBinding;
  readonly payload:string;
}

const money=(minor:number)=>'$'+(Math.max(0,Number(minor)||0)/100).toFixed(2);
const clean=(value:string)=>String(value??'').replace(/[\r\n]+/g,' ').trim();

function receipt(order:PrintableOrder){
  return '\x1b\x40'
    +'磨飯 MFK\n'
    +order.display+'\n'
    +'------------------------------\n'
    +order.items.map(item=>clean(item.name)+' x'+item.qty+'  '+money(item.unitMinor*item.qty)).join('\n')
    +'\n------------------------------\n'
    +'TOTAL '+money(order.totalMinor)+'\n'
    +clean(order.paymentLabel)+'\n'
    +new Date(order.createdAt).toLocaleString('zh-HK')
    +'\n\n\n';
}

function production(order:PrintableOrder){
  return '\x1b\x40'
    +'製作單  '+order.display+'\n'
    +'==============================\n'
    +order.items.map(item=>item.qty+' x '+clean(item.name)).join('\n')
    +'\n==============================\n'
    +clean(order.sourceLabel)
    +'\n\n\n';
}

function packing(order:PrintableOrder){
  return '\x1b\x40'
    +'打包單  '+order.display+'\n'
    +'==============================\n'
    +order.items.map(item=>item.qty+' x '+clean(item.name)).join('\n')
    +'\n==============================\n'
    +'共 '+order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0)+' 件'
    +'\n\n\n';
}

function tsplChineseFont(encoding:PrintBinding['encoding']){
  if(encoding==='big5')return 'TST24.BF2';
  if(encoding==='gb18030')return 'TSS24.BF2';
  return '3';
}

function label(order:PrintableOrder,item:{id:string;name:string;qty:number;unitMinor:number},index:number,total:number,encoding:PrintBinding['encoding']){
  const orderCode=clean(order.display).replace(/"/g,'');
  const product=clean(item.name).replace(/"/g,'');
  const font=tsplChineseFont(encoding);
  return 'SIZE 40 mm,30 mm\r\n'
    +'GAP 2 mm,0 mm\r\n'
    +'DENSITY 8\r\n'
    +'CLS\r\n'
    +'TEXT 20,20,"3",0,1,1,"'+orderCode+'"\r\n'
    +'TEXT 20,55,"'+font+'",0,1,1,"'+product+'"\r\n'
    +'TEXT 20,90,"2",0,1,1,"'+index+'/'+total+'"\r\n'
    +'PRINT 1,1\r\n';
}

function bagLabel(order:PrintableOrder,encoding:PrintBinding['encoding']){
  const orderCode=clean(order.display).replace(/"/g,'');
  const total=order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
  const font=tsplChineseFont(encoding);
  return 'SIZE 40 mm,30 mm\r\n'
    +'GAP 2 mm,0 mm\r\n'
    +'DENSITY 8\r\n'
    +'CLS\r\n'
    +'TEXT 20,20,"3",0,1,1,"'+orderCode+'"\r\n'
    +'TEXT 20,55,"'+font+'",0,1,1,"袋 '+total+' 件"\r\n'
    +'PRINT 1,1\r\n';
}

export function buildOrderPrintPlan(order:PrintableOrder,bindings:readonly PrintBinding[]):readonly PlannedPrintJob[]{
  const active=bindings.filter(binding=>String(binding.host||'').trim()&&Number(binding.port)>0);
  const jobs:PlannedPrintJob[]=[];
  for(const binding of active){
    if(binding.role==='顧客小票'){
      jobs.push({id:order.id+':receipt',role:binding.role,binding,payload:receipt(order)});
      continue;
    }
    if(binding.role==='製作單'){
      jobs.push({id:order.id+':production',role:binding.role,binding,payload:production(order)});
      continue;
    }
    if(binding.role==='打包單'){
      jobs.push({id:order.id+':packing',role:binding.role,binding,payload:packing(order)});
      continue;
    }
    if(binding.role==='袋標籤'){
      jobs.push({id:order.id+':bag-label',role:binding.role,binding,payload:bagLabel(order)});
      continue;
    }
    if(binding.role==='產品標籤'){
      const total=order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
      let labelIndex=0;
      for(const item of order.items){
        const qty=Math.max(0,Math.floor(Number(item.qty)||0));
        for(let i=0;i<qty;i++){
          labelIndex+=1;
          jobs.push({
            id:order.id+':product-label:'+item.id+':'+(i+1),
            role:binding.role,
            binding,
            payload:label(order,item,labelIndex,total,binding.encoding),
          });
        }
      }
    }
  }
  return Object.freeze(jobs.map(job=>Object.freeze(job)));
}
