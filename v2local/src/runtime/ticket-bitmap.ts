import type {PrintableOrder} from './print-routing.ts';

export const ESC_POS_RASTER_PROFILE=Object.freeze({
  widthDots:576,
  dpi:203,
  margin:18,
  bandHeight:192,
});

export type RasterTicketKind='receipt'|'production'|'packing';

const FONT='"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';

function concatBytes(parts:readonly Uint8Array[]){
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}

function clean(value:unknown){
  return String(value??'').replace(/[\r\n]+/g,' ').trim();
}
function money(minor:number){
  return 'HK$'+(Math.max(0,Number(minor)||0)/100).toFixed(2);
}
function totalUnits(order:PrintableOrder){
  return order.items.reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
}
function orderService(order:PrintableOrder){
  const modes=new Set(order.items.map(item=>item.serviceMode).filter(Boolean));
  if(modes.size===1)return modes.has('dine-in')?'堂食':'外賣';
  if(modes.size>1)return '堂食 / 外賣';
  return '外賣';
}
function hktDateTime(iso:string){
  const date=new Date(iso);
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Hong_Kong',
    year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,
  }).formatToParts(date);
  const pick=(type:string)=>parts.find(part=>part.type===type)?.value??'';
  return pick('year')+'-'+pick('month')+'-'+pick('day')+' '+pick('hour')+':'+pick('minute')+':'+pick('second');
}
function productIdentity(item:PrintableOrder['items'][number]){
  const code=clean(item.productCode);
  const base=clean(item.name).split('｜')[0]||clean(item.name);
  return (code?'('+code+') ':'')+base;
}
function detail(item:PrintableOrder['items'][number]){
  const explicit=clean(item.detail);
  if(explicit)return explicit;
  const pieces=clean(item.name).split('｜');
  return pieces.length>1?pieces.slice(1).join(' / '):'';
}

function font(ctx:CanvasRenderingContext2D,size:number,weight=600){
  ctx.font=weight+' '+size+'px '+FONT;
}
function measureFit(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,preferred:number,min=18,weight=800){
  let size=preferred;
  while(size>min){
    font(ctx,size,weight);
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=2;
  }
  return size;
}
function wrap(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines=5){
  const value=clean(text);
  if(!value)return [''];
  const lines:string[]=[];
  let current='';
  for(const char of Array.from(value)){
    const next=current+char;
    if(current&&ctx.measureText(next).width>maxWidth){
      lines.push(current);
      current=char;
      if(lines.length>=maxLines-1)break;
    }else current=next;
  }
  if(lines.length<maxLines&&current)lines.push(current);
  if(lines.join('').length<value.length&&lines.length){
    let last=lines[lines.length-1]??'';
    while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
    lines[lines.length-1]=last+'…';
  }
  return lines;
}

class TicketCanvas{
  readonly ctx:CanvasRenderingContext2D;
  readonly width:number;
  readonly margin:number;
  y=20;
  constructor(readonly canvas:HTMLCanvasElement){
    this.width=canvas.width;
    this.margin=ESC_POS_RASTER_PROFILE.margin;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('ESC_POS_RASTER_CANVAS_UNAVAILABLE');
    this.ctx=context;
    this.ctx.fillStyle='#fff';
    this.ctx.fillRect(0,0,canvas.width,canvas.height);
    this.ctx.fillStyle='#000';
    this.ctx.textBaseline='top';
  }
  line(gap=16){
    this.ctx.strokeStyle='#000';
    this.ctx.lineWidth=2;
    this.ctx.setLineDash([8,6]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin,this.y);
    this.ctx.lineTo(this.width-this.margin,this.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.y+=gap;
  }
  text(text:string,size=26,weight=600,align:'left'|'center'|'right'='left',lineHeight?:number){
    const value=clean(text);
    font(this.ctx,size,weight);
    this.ctx.textAlign=align;
    const x=align==='center'?this.width/2:align==='right'?this.width-this.margin:this.margin;
    this.ctx.fillStyle='#000';
    this.ctx.fillText(value,x,this.y);
    this.y+=(lineHeight??Math.round(size*1.35));
  }
  wrapped(text:string,size=26,weight=600,maxLines=5,lineHeight?:number){
    font(this.ctx,size,weight);
    const lines=wrap(this.ctx,text,this.width-this.margin*2,maxLines);
    for(const line of lines)this.text(line,size,weight,'left',lineHeight);
  }
  blackBlock(label:string,value:string,height=112){
    const top=this.y;
    this.ctx.fillStyle='#000';
    this.ctx.fillRect(this.margin,top,this.width-this.margin*2,height);
    this.ctx.fillStyle='#fff';
    this.ctx.textBaseline='middle';
    this.ctx.textAlign='left';
    font(this.ctx,30,900);
    this.ctx.fillText(label,this.margin+18,top+height/2);
    const valueMax=this.width-this.margin*2-190;
    const valueSize=measureFit(this.ctx,value,valueMax,66,38,900);
    font(this.ctx,valueSize,900);
    this.ctx.textAlign='right';
    this.ctx.fillText(value,this.width-this.margin-18,top+height/2);
    this.ctx.textBaseline='top';
    this.ctx.fillStyle='#000';
    this.y+=height+18;
  }
  boxedPair(leftLabel:string,leftValue:string,rightLabel:string,rightValue:string){
    const top=this.y;
    const total=this.width-this.margin*2;
    const leftWidth=Math.round(total*0.60);
    const rightWidth=total-leftWidth;
    const height=148;
    this.ctx.strokeStyle='#000';
    this.ctx.lineWidth=3;
    this.ctx.strokeRect(this.margin,top,total,height);
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin+leftWidth,top);
    this.ctx.lineTo(this.margin+leftWidth,top+height);
    this.ctx.stroke();

    this.ctx.textAlign='left';
    this.ctx.textBaseline='top';
    font(this.ctx,24,800);
    this.ctx.fillText(leftLabel,this.margin+14,top+12);
    this.ctx.fillText(rightLabel,this.margin+leftWidth+14,top+12);

    const leftSize=measureFit(this.ctx,leftValue,leftWidth-28,72,42,900);
    font(this.ctx,leftSize,900);
    this.ctx.fillText(leftValue,this.margin+14,top+52);

    font(this.ctx,25,800);
    const rightLines=String(rightValue).split('\n').flatMap(line=>wrap(this.ctx,line,rightWidth-28,2));
    let ry=top+52;
    for(const line of rightLines.slice(0,2)){this.ctx.fillText(line,this.margin+leftWidth+14,ry);ry+=36;}

    this.y+=height+18;
  }
  brand(){
    this.text('More Fun',26,800,'center',32);
    this.text('磨飯',68,900,'center',78);
    this.text('手作 / 真食 / 更有味',25,700,'center',38);
  }
  finish(){
    return Math.min(this.canvas.height,Math.ceil(this.y+20));
  }
}

function receipt(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line(22);
  t.text('客戶收據',50,900,'center',64);
  t.line(22);
  t.boxedPair('訂單編號 No.',clean(order.display),'下單時間',hktDateTime(order.createdAt).replace(' ','\n'));
  t.text('來源：'+clean(order.sourceLabel)+' / '+orderService(order),29,800, 'left',38);
  const pickup=clean(order.providerPickupCode);
  if(pickup){
    t.line(20);
    t.blackBlock('取餐碼',pickup,122);
  }
  t.line(22);
  t.text('品項',28,900,'left',38);
  for(const item of order.items){
    t.wrapped(productIdentity(item),40,900,4,48);
    const d=detail(item);
    if(d)t.wrapped(d,30,700,4,38);
    t.text(String(item.qty)+' × '+money(item.unitMinor)+'     '+money(item.qty*item.unitMinor),29,800,'left',38);
    t.y+=12;
  }
  t.line(22);
  t.text('總數量：'+totalUnits(order)+' 件',40,900,'left',52);
  if(order.utensilPreference)t.text('餐具：'+order.utensilPreference,30,800,'left',40);
  if(clean(order.orderRemark))t.wrapped('備註：'+clean(order.orderRemark),30,800,4,40);
  t.line(22);
  t.text('付款方式：'+clean(order.paymentLabel),30,800,'left',40);
  t.text('合計 '+money(order.totalMinor),50,900,'left',62);
  t.line(22);
  t.text('請核對餐點 / 謝謝光臨',29,800,'center',40);
  t.text('*** 謝謝！***',32,900,'center',42);
  t.text('More Fun Kitchen',24,700,'center',32);
}

function production(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line(22);
  t.text('廚房製作單',54,900,'center',68);
  t.line(22);
  t.text('單號',30,900,'left',40);
  t.text(clean(order.display),92,900,'center',104);
  t.text('落單時間：'+hktDateTime(order.createdAt),28,800,'left',38);
  t.text('來源：'+clean(order.sourceLabel)+' / '+orderService(order),28,800,'left',38);
  t.line(22);
  for(const item of order.items){
    t.wrapped(productIdentity(item),48,900,4,58);
    const d=detail(item);
    if(d)t.wrapped('要求：'+d,32,800,4,42);
    t.blackBlock('數量',String(item.qty)+' 份',118);
    t.line(20);
  }
  if(clean(order.orderRemark))t.wrapped('備註：'+clean(order.orderRemark),32,900,4,42);
  if(order.utensilPreference)t.text('餐具：'+order.utensilPreference,31,900,'left',42);
  if(orderService(order)==='外賣')t.text('外賣請打包',34,900,'left',46);
  t.line(22);
  t.text('*** 謝謝！***',32,900,'center',44);
  t.text('More Fun Kitchen',24,700,'center',34);
}

function checkbox(ctx:CanvasRenderingContext2D,x:number,y:number,checked=false){
  ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.strokeRect(x,y,22,22);
  if(checked){
    ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+4,y+12);ctx.lineTo(x+9,y+18);ctx.lineTo(x+19,y+4);ctx.stroke();
  }
}
function packing(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line(22);
  t.text('外賣打包單',52,900,'center',64);
  t.text('TAKE AWAY',27,800,'center',40);
  t.line(22);
  t.boxedPair('訂單編號 No.',clean(order.display),'下單時間',hktDateTime(order.createdAt).replace(' ','\n'));
  t.text('品項 / 數量 / 備註 / 特別要求',27,900,'left',38);
  t.line(18);
  for(const item of order.items){
    t.wrapped(productIdentity(item),40,900,4,48);
    t.text('數量 '+item.qty,31,900,'left',40);
    const d=detail(item);
    if(d)t.wrapped(d,30,750,4,39);
    t.y+=10;
  }
  t.line(22);
  t.text('總數量：'+totalUnits(order)+' 件',44,900,'left',56);
  t.line(22);
  t.text('餐具（請確認）',30,900,'left',40);
  const cy=t.y;
  checkbox(t.ctx,t.margin,cy,order.utensilPreference==='需要');
  t.ctx.textBaseline='top';t.ctx.textAlign='left';t.ctx.fillStyle='#000';font(t.ctx,27,800);
  t.ctx.fillText('需要 (Y)',t.margin+38,cy-4);
  checkbox(t.ctx,t.margin+275,cy,order.utensilPreference==='不需要');
  t.ctx.fillText('不需要 (N)',t.margin+313,cy-4);
  t.y+=48;
  t.line(18);
  t.text('其他內容物（請確認）',29,900,'left',40);
  const labels=['飲品','醬汁','小食 / 配料','餐巾紙','吸管','其他'];
  for(let i=0;i<labels.length;i++){
    const col=i%2,row=Math.floor(i/2);
    const x=t.margin+col*278,y=t.y+row*43;
    checkbox(t.ctx,x,y,false);
    t.ctx.textAlign='left';t.ctx.textBaseline='top';t.ctx.fillStyle='#000';font(t.ctx,25,750);
    t.ctx.fillText(labels[i]!,x+34,y-3);
  }
  t.y+=142;
  if(clean(order.orderRemark))t.wrapped('訂單備註：'+clean(order.orderRemark),29,800,4,39);
  t.line(22);
  t.text('付款方式：'+clean(order.paymentLabel),30,800,'left',40);
  t.text('金額：'+money(order.totalMinor),40,900,'left',52);
  const pickup=clean(order.providerPickupCode);
  if(pickup){
    t.line(20);
    t.blackBlock('取餐碼',pickup,116);
  }
  t.line(22);
  t.text('請確認餐點後交予顧客  謝謝！',27,800,'center',38);
  t.text('More Fun Kitchen',23,700,'center',32);
}

export function packEscPosRasterPixels(pixels:Uint8Array,width:number,height:number){
  if(width<1||height<1||pixels.length!==width*height)throw new Error('ESC_POS_RASTER_DIMENSION_INVALID');
  const bytesPerRow=Math.ceil(width/8);
  const output=new Uint8Array(bytesPerRow*height);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(!pixels[y*width+x])continue;
      output[y*bytesPerRow+(x>>3)]|=0x80>>(x&7);
    }
  }
  return output;
}

export function buildEscPosRasterPayload(input:{
  readonly bitmap:Uint8Array;
  readonly widthDots:number;
  readonly heightDots:number;
  readonly cutAfter?:boolean;
  readonly kickDrawer?:boolean;
  readonly beepAfter?:boolean;
}){
  const bytesPerRow=Math.ceil(input.widthDots/8);
  if(input.bitmap.length!==bytesPerRow*input.heightDots)throw new Error('ESC_POS_RASTER_BYTES_INVALID');
  const parts:Uint8Array[]=[new Uint8Array([0x1b,0x40])];
  if(input.kickDrawer)parts.push(new Uint8Array([0x1b,0x70,0x00,0x19,0xfa]));
  for(let y=0;y<input.heightDots;y+=ESC_POS_RASTER_PROFILE.bandHeight){
    const bandHeight=Math.min(ESC_POS_RASTER_PROFILE.bandHeight,input.heightDots-y);
    const bytes=input.bitmap.slice(y*bytesPerRow,(y+bandHeight)*bytesPerRow);
    parts.push(new Uint8Array([
      0x1d,0x76,0x30,0x00,
      bytesPerRow&0xff,(bytesPerRow>>8)&0xff,
      bandHeight&0xff,(bandHeight>>8)&0xff,
    ]));
    parts.push(bytes);
  }
  parts.push(new Uint8Array([0x1b,0x64,0x03]));
  if(input.cutAfter)parts.push(new Uint8Array([0x1d,0x56,0x00]));
  if(input.beepAfter)parts.push(new Uint8Array([0x1b,0x42,0x03,0x02]));
  return concatBytes(parts);
}

export async function renderEscPosRasterTicket(input:{
  readonly kind:RasterTicketKind;
  readonly order:PrintableOrder;
  readonly cutAfter?:boolean;
  readonly kickDrawer?:boolean;
  readonly beepAfter?:boolean;
}){
  if(typeof document==='undefined')throw new Error('ESC_POS_RASTER_CANVAS_UNAVAILABLE');
  const estimatedHeight=Math.max(1250,900+input.order.items.length*420);
  const canvas=document.createElement('canvas');
  canvas.width=ESC_POS_RASTER_PROFILE.widthDots;
  canvas.height=estimatedHeight;
  const t=new TicketCanvas(canvas);
  if(input.kind==='receipt')receipt(t,input.order);
  else if(input.kind==='production')production(t,input.order);
  else packing(t,input.order);
  const usedHeight=t.finish();
  const image=t.ctx.getImageData(0,0,canvas.width,usedHeight);
  const mono=new Uint8Array(canvas.width*usedHeight);
  for(let p=0;p<mono.length;p++){
    const offset=p*4;
    const r=image.data[offset]??255;
    const g=image.data[offset+1]??255;
    const b=image.data[offset+2]??255;
    const alpha=image.data[offset+3]??255;
    const luminance=(r*299+g*587+b*114)/1000;
    mono[p]=alpha>20&&luminance<180?1:0;
  }
  return buildEscPosRasterPayload({
    bitmap:packEscPosRasterPixels(mono,canvas.width,usedHeight),
    widthDots:canvas.width,
    heightDots:usedHeight,
    cutAfter:input.cutAfter,
    kickDrawer:input.kickDrawer,
    beepAfter:input.beepAfter,
  });
}
