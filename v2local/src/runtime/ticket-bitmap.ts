import type {PrintableOrder} from './print-routing.ts';

export const ESC_POS_RASTER_PROFILE=Object.freeze({
  widthDots:576,
  dpi:203,
  margin:24,
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
  blackBlock(label:string,value:string,height=92){
    const top=this.y;
    this.ctx.fillStyle='#000';
    this.ctx.fillRect(this.margin,top,this.width-this.margin*2,height);
    this.ctx.fillStyle='#fff';
    this.ctx.textBaseline='middle';
    this.ctx.textAlign='left';
    font(this.ctx,24,800);
    this.ctx.fillText(label,this.margin+16,top+height/2);
    const valueMax=this.width-this.margin*2-160;
    const valueSize=measureFit(this.ctx,value,valueMax,52,30,900);
    font(this.ctx,valueSize,900);
    this.ctx.textAlign='right';
    this.ctx.fillText(value,this.width-this.margin-16,top+height/2);
    this.ctx.textBaseline='top';
    this.ctx.fillStyle='#000';
    this.y+=height+14;
  }
  boxedPair(leftLabel:string,leftValue:string,rightLabel:string,rightValue:string){
    const top=this.y;
    const total=this.width-this.margin*2;
    const leftWidth=Math.round(total*0.64);
    const rightWidth=total-leftWidth;
    this.ctx.strokeStyle='#000';
    this.ctx.lineWidth=2;
    this.ctx.strokeRect(this.margin,top,total,112);
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin+leftWidth,top);
    this.ctx.lineTo(this.margin+leftWidth,top+112);
    this.ctx.stroke();

    this.ctx.textAlign='left';
    this.ctx.textBaseline='top';
    font(this.ctx,19,700);
    this.ctx.fillText(leftLabel,this.margin+12,top+10);
    this.ctx.fillText(rightLabel,this.margin+leftWidth+12,top+10);

    const leftSize=measureFit(this.ctx,leftValue,leftWidth-24,55,34,900);
    font(this.ctx,leftSize,900);
    this.ctx.fillText(leftValue,this.margin+12,top+42);

    const rightSize=measureFit(this.ctx,rightValue,rightWidth-24,27,18,800);
    font(this.ctx,rightSize,800);
    const rightLines=wrap(this.ctx,rightValue,rightWidth-24,2);
    let ry=top+46;
    for(const line of rightLines){this.ctx.fillText(line,this.margin+leftWidth+12,ry);ry+=31;}

    this.y+=126;
  }
  brand(){
    this.text('More Fun',20,700,'center',24);
    this.text('磨飯',54,900,'center',62);
    this.text('手作 / 真食 / 更有味',19,600,'center',30);
  }
  finish(){
    return Math.min(this.canvas.height,Math.ceil(this.y+20));
  }
}

function receipt(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line();
  t.text('客戶收據',38,900,'center',50);
  t.line();
  t.boxedPair('訂單編號 No.','P'+clean(order.display).replace(/^P/i,''),'下單時間',hktDateTime(order.createdAt).replace(' ','\n'));
  t.text('來源：'+clean(order.sourceLabel)+' / '+orderService(order),22,700);
  const pickup=clean(order.providerPickupCode);
  if(pickup){
    t.line();
    t.blackBlock('取餐碼',pickup,100);
  }
  t.line();
  t.text('品項',21,800);
  for(const item of order.items){
    t.wrapped(productIdentity(item),30,900,3,37);
    const d=detail(item);
    if(d)t.wrapped(d,22,600,3,29);
    t.text(String(item.qty)+' × '+money(item.unitMinor)+'     '+money(item.qty*item.unitMinor),22,700);
    t.y+=6;
  }
  t.line();
  t.text('總數量：'+totalUnits(order)+' 件',30,900);
  if(order.utensilPreference)t.text('餐具：'+order.utensilPreference,22,700);
  if(clean(order.orderRemark))t.wrapped('備註：'+clean(order.orderRemark),22,700,3);
  t.line();
  t.text('付款方式：'+clean(order.paymentLabel),22,700);
  t.text('合計 '+money(order.totalMinor),38,900);
  t.line();
  t.text('請核對餐點 / 謝謝光臨',22,700,'center');
  t.text('*** 謝謝！***',24,800,'center');
  t.text('More Fun Kitchen',18,600,'center');
}

function production(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line();
  t.text('廚房製作單',40,900,'center',54);
  t.line();
  t.text('單號',22,800);
  t.text(clean(order.display),70,900,'center',78);
  t.text('落單時間：'+hktDateTime(order.createdAt),20,600);
  t.text('來源：'+clean(order.sourceLabel)+' / '+orderService(order),20,700);
  t.line();
  for(const item of order.items){
    t.wrapped(productIdentity(item),36,900,3,43);
    const d=detail(item);
    if(d)t.wrapped('要求：'+d,23,700,3,30);
    t.blackBlock('數量',String(item.qty)+' 份',84);
    t.line(14);
  }
  if(clean(order.orderRemark))t.wrapped('備註：'+clean(order.orderRemark),24,800,3);
  if(order.utensilPreference)t.text('餐具：'+order.utensilPreference,24,800);
  if(orderService(order)==='外賣')t.text('外賣請打包',24,800);
  t.line();
  t.text('*** 謝謝！***',25,800,'center');
  t.text('More Fun Kitchen',18,600,'center');
}

function checkbox(ctx:CanvasRenderingContext2D,x:number,y:number,checked=false){
  ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.strokeRect(x,y,22,22);
  if(checked){
    ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+4,y+12);ctx.lineTo(x+9,y+18);ctx.lineTo(x+19,y+4);ctx.stroke();
  }
}
function packing(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line();
  t.text('外賣打包單',40,900,'center',48);
  t.text('TAKE AWAY',20,700,'center',30);
  t.line();
  t.boxedPair('訂單編號 No.',clean(order.display),'下單時間',hktDateTime(order.createdAt).replace(' ','\n'));
  t.text('品項 / 數量 / 備註 / 特別要求',20,800);
  t.line(12);
  for(const item of order.items){
    t.wrapped(productIdentity(item),28,900,3,35);
    t.text('數量 '+item.qty,22,800);
    const d=detail(item);
    if(d)t.wrapped(d,22,650,3,29);
    t.y+=6;
  }
  t.line();
  t.text('總數量：'+totalUnits(order)+' 件',34,900);
  t.line();
  t.text('餐具（請確認）',22,800);
  const cy=t.y;
  checkbox(t.ctx,t.margin,cy,order.utensilPreference==='需要');
  t.ctx.textBaseline='top';t.ctx.textAlign='left';t.ctx.fillStyle='#000';font(t.ctx,20,650);
  t.ctx.fillText('需要 (Y)',t.margin+32,cy-1);
  checkbox(t.ctx,t.margin+220,cy,order.utensilPreference==='不需要');
  t.ctx.fillText('不需要 (N)',t.margin+252,cy-1);
  t.y+=38;
  t.line(12);
  t.text('其他內容物（請確認）',21,800);
  const labels=['飲品','醬汁','小食 / 配料','餐巾紙','吸管','其他'];
  for(let i=0;i<labels.length;i++){
    const col=i%2,row=Math.floor(i/2);
    const x=t.margin+col*260,y=t.y+row*34;
    checkbox(t.ctx,x,y,false);
    t.ctx.textAlign='left';t.ctx.textBaseline='top';t.ctx.fillStyle='#000';font(t.ctx,19,600);
    t.ctx.fillText(labels[i]!,x+30,y-1);
  }
  t.y+=112;
  if(clean(order.orderRemark))t.wrapped('訂單備註：'+clean(order.orderRemark),21,700,3);
  t.line();
  t.text('付款方式：'+clean(order.paymentLabel),22,700);
  t.text('金額：'+money(order.totalMinor),28,900);
  const pickup=clean(order.providerPickupCode);
  if(pickup){
    t.line();
    t.blackBlock('取餐碼',pickup,92);
  }
  t.line();
  t.text('請確認餐點後交予顧客  謝謝！',20,700,'center');
  t.text('More Fun Kitchen',17,600,'center');
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
  const estimatedHeight=Math.max(900,650+input.order.items.length*260);
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
