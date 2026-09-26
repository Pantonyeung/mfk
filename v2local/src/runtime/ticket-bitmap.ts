import type {PrintableOrder} from './print-routing.ts';
import {groupPrintableSelections,verticalSelectionLines} from './print-content.ts';

export const ESC_POS_RASTER_PROFILE=Object.freeze({
  widthDots:576,
  dpi:203,
  margin:18,
  bandHeight:192,
});

export type RasterTicketKind='receipt'|'table'|'production'|'packing';

const FONT='"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';

function concatBytes(parts:readonly Uint8Array[]){
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}

function clean(value:unknown){
  return String(value??'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
}
function money(minor:number){
  return 'HK$'+(Math.max(0,Number(minor)||0)/100).toFixed(2);
}
function moneyCompact(minor:number){
  const value=Math.max(0,Number(minor)||0)/100;
  return 'HK$'+(Number.isInteger(value)?String(value):value.toFixed(2));
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
function itemTitle(item:PrintableOrder['items'][number]){
  return clean(item.name).split('｜')[0]||clean(item.name);
}
function detailSource(item:PrintableOrder['items'][number]){
  const explicit=clean(item.detail);
  if(explicit)return explicit;
  const pieces=clean(item.name).split('｜');
  return pieces.length>1?pieces.slice(1).join(' · '):'';
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
function wrap(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines=6){
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

  line(gap=18){
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

  text(text:string,size=28,weight=700,align:'left'|'center'|'right'='left',lineHeight?:number){
    const value=clean(text);
    font(this.ctx,size,weight);
    this.ctx.textAlign=align;
    this.ctx.textBaseline='top';
    const x=align==='center'?this.width/2:align==='right'?this.width-this.margin:this.margin;
    this.ctx.fillStyle='#000';
    this.ctx.fillText(value,x,this.y);
    this.y+=(lineHeight??Math.round(size*1.35));
  }

  wrapped(text:string,size=30,weight=700,maxLines=6,lineHeight?:number,maxWidth?:number){
    font(this.ctx,size,weight);
    const width=maxWidth??(this.width-this.margin*2);
    const lines=wrap(this.ctx,text,width,maxLines);
    for(const line of lines)this.text(line,size,weight,'left',lineHeight);
  }

  brand(){
    this.text('More Fun',26,800,'center',32);
    this.text('磨飯',68,900,'center',78);
    this.text('手作 / 真食 / 更有味',25,700,'center',38);
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
    for(const line of rightLines.slice(0,2)){
      this.ctx.fillText(line,this.margin+leftWidth+14,ry);
      ry+=36;
    }

    this.y+=height+18;
  }

  productionItemBlock(item:PrintableOrder['items'][number]){
    const groups=groupPrintableSelections(detailSource(item));
    const modifier=groups.modifier.length?'('+groups.modifier.join('，')+')':'';
    const main=groups.main[0]??'';
    const addon=groups.addon[0]??'';
    const firstRow=[
      main?(main+(modifier?' '+modifier:'')):(modifier||''),
      addon,
    ].filter(Boolean).join(' / ');
    const normalRows=[
      ...(firstRow?[firstRow]:[]),
      ...groups.main.slice(1),
      ...groups.addon.slice(1),
      ...groups.note,
    ];
    const drinks=[...groups.drink];

    const top=this.y;
    const totalWidth=this.width-this.margin*2;
    const gap=14;
    const qtyWidth=132;
    const leftWidth=totalWidth-qtyWidth-gap;

    font(this.ctx,42,900);
    const titleLines=wrap(this.ctx,itemTitle(item),leftWidth,3);
    const normalWrapped:string[]=[];
    font(this.ctx,39,900);
    for(const row of normalRows){
      for(const wrapped of wrap(this.ctx,row,leftWidth,3))normalWrapped.push(wrapped);
    }

    const drinkWrapped:string[]=[];
    font(this.ctx,39,900);
    for(const drink of drinks){
      for(const wrapped of wrap(this.ctx,drink,leftWidth-22,3))drinkWrapped.push(wrapped);
    }

    const textHeight=16+titleLines.length*52+(normalWrapped.length?8+normalWrapped.length*48:0);
    const drinkHeight=drinkWrapped.length?Math.max(62,18+drinkWrapped.length*46):0;
    const bodyHeight=Math.max(160,textHeight+(drinkHeight?14+drinkHeight:0)+16);

    this.ctx.fillStyle='#000';
    this.ctx.textAlign='left';
    this.ctx.textBaseline='top';
    let textY=top+8;

    font(this.ctx,42,900);
    for(const line of titleLines){
      this.ctx.fillText(line,this.margin,textY);
      textY+=52;
    }

    font(this.ctx,39,900);
    for(const line of normalWrapped){
      this.ctx.fillText(line,this.margin,textY);
      textY+=48;
    }

    if(drinkWrapped.length){
      textY+=8;
      const drinkTop=textY;
      this.ctx.strokeStyle='#000';
      this.ctx.lineWidth=3;
      this.ctx.strokeRect(this.margin,drinkTop,leftWidth,drinkHeight);
      font(this.ctx,39,900);
      let drinkY=drinkTop+9;
      for(const line of drinkWrapped){
        this.ctx.fillText(line,this.margin+10,drinkY);
        drinkY+=46;
      }
    }

    const qtyX=this.margin+leftWidth+gap;
    this.ctx.strokeStyle='#000';
    this.ctx.lineWidth=3;
    this.ctx.strokeRect(qtyX,top,qtyWidth,bodyHeight);
    this.ctx.textAlign='center';
    this.ctx.textBaseline='middle';
    font(this.ctx,46,900);
    this.ctx.fillText(String(item.qty)+'份',qtyX+qtyWidth/2,top+bodyHeight/2);
    this.ctx.textBaseline='top';
    this.ctx.textAlign='left';
    this.y+=bodyHeight+14;
  }

  structuredItemBlock(input:{
    item:PrintableOrder['items'][number];
    lines:readonly string[];
    qtyBox:boolean;
    priceBox?:boolean;
  }){
    const {item,lines,qtyBox,priceBox=false}=input;
    const top=this.y;
    const totalWidth=this.width-this.margin*2;
    const gap=14;
    const boxWidth=priceBox?144:132;
    const leftWidth=qtyBox?totalWidth-boxWidth-gap:totalWidth;

    font(this.ctx,42,900);
    const titleLines=wrap(this.ctx,itemTitle(item),leftWidth,3);
    const bodyLines:string[]=[];
    font(this.ctx,39,900);
    for(const value of lines){
      for(const row of wrap(this.ctx,value,leftWidth,3))bodyLines.push(row);
    }
    const bodyHeight=Math.max(
      priceBox?176:150,
      16+titleLines.length*52+(bodyLines.length?8+bodyLines.length*48:0)+16
    );

    this.ctx.fillStyle='#000';
    this.ctx.textAlign='left';
    this.ctx.textBaseline='top';
    let textY=top+8;

    font(this.ctx,42,900);
    for(const line of titleLines){
      this.ctx.fillText(line,this.margin,textY);
      textY+=52;
    }

    font(this.ctx,39,900);
    for(const line of bodyLines){
      this.ctx.fillText(line,this.margin,textY);
      textY+=48;
    }

    if(qtyBox){
      const boxX=this.margin+leftWidth+gap;
      this.ctx.strokeStyle='#000';
      this.ctx.lineWidth=3;
      this.ctx.strokeRect(boxX,top,boxWidth,bodyHeight);

      this.ctx.textAlign='center';
      this.ctx.textBaseline='middle';
      font(this.ctx,46,900);

      if(priceBox){
        const split=top+Math.round(bodyHeight*0.56);
        this.ctx.beginPath();
        this.ctx.moveTo(boxX,split);
        this.ctx.lineTo(boxX+boxWidth,split);
        this.ctx.stroke();
        this.ctx.fillText(String(item.qty)+'份',boxX+boxWidth/2,top+(split-top)/2);
        const price=moneyCompact(item.qty*item.unitMinor);
        const priceSize=measureFit(this.ctx,price,boxWidth-14,34,23,900);
        font(this.ctx,priceSize,900);
        this.ctx.fillText(price,boxX+boxWidth/2,split+(top+bodyHeight-split)/2);
      }else{
        this.ctx.fillText(String(item.qty)+'份',boxX+boxWidth/2,top+bodyHeight/2);
      }
      this.ctx.textAlign='left';
      this.ctx.textBaseline='top';
    }

    this.y+=bodyHeight+14;
  }

  totalRow(label:string,value:string){
    const top=this.y;
    const height=62;
    font(this.ctx,42,900);
    this.ctx.textAlign='left';
    this.ctx.textBaseline='middle';
    this.ctx.fillStyle='#000';
    this.ctx.fillText(label,this.margin,top+height/2);
    font(this.ctx,48,900);
    this.ctx.textAlign='right';
    this.ctx.fillText(value,this.width-this.margin,top+height/2);
    this.ctx.textAlign='left';
    this.ctx.textBaseline='top';
    this.y+=height+8;
  }

  checkboxRow(labels:readonly string[]){
    const top=this.y;
    const usable=this.width-this.margin*2;
    const colWidth=usable/labels.length;
    for(let i=0;i<labels.length;i++){
      const x=this.margin+i*colWidth;
      this.ctx.strokeStyle='#000';
      this.ctx.lineWidth=3;
      this.ctx.strokeRect(x,top+4,30,30);
      this.ctx.textAlign='left';
      this.ctx.textBaseline='top';
      this.ctx.fillStyle='#000';
      font(this.ctx,28,800);
      this.ctx.fillText(labels[i]??'',x+40,top);
    }
    this.y+=48;
  }

  finish(){
    return Math.min(this.canvas.height,Math.ceil(this.y+24));
  }
}

function receipt(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line(22);
  t.text('客戶收據',50,900,'center',64);
  t.line(22);
  t.boxedPair('訂單編號 No.',clean(order.display),'下單時間',hktDateTime(order.createdAt).replace(' ','\n'));
  t.text('來源：'+clean(order.sourceLabel)+' / '+orderService(order),30,800,'left',40);
  t.line(20);
  t.text('品項',29,900,'left',40);

  for(const item of order.items){
    t.structuredItemBlock({
      item,
      lines:verticalSelectionLines(detailSource(item)),
      qtyBox:true,
      priceBox:true,
    });
    t.line(18);
  }

  t.totalRow('總數量：',String(totalUnits(order))+'份');
  t.line(18);
  t.text('付款方式：'+clean(order.paymentLabel),32,800,'left',42);
  t.text('合計 '+money(order.totalMinor),52,900,'left',64);
  t.line(22);
  t.text('請核對餐點 / 謝謝光臨',28,800,'center',38);
  t.text('*** 謝謝！***',30,900,'center',40);
  t.text('More Fun Kitchen',23,700,'center',32);
}

function tableTicket(t:TicketCanvas,order:PrintableOrder){
  t.brand();
  t.line(22);
  t.text('堂食枱單',52,900,'center',64);
  t.text('未付款 / 核對用途',28,900,'center',40);
  t.line(22);
  t.boxedPair('枱號',clean(order.diningTableLabel??'—'),'訂單編號',clean(order.display));
  t.text('下單時間：'+hktDateTime(order.createdAt),28,800,'left',40);
  t.line(18);
  for(const item of order.items){
    t.structuredItemBlock({item,lines:verticalSelectionLines(detailSource(item)),qtyBox:true,priceBox:true});
    t.line(18);
  }
  t.totalRow('總數量：',String(totalUnits(order))+'份');
  t.line(18);
  t.text('合計 '+money(order.totalMinor),48,900,'left',60);
  t.line(20);
  t.text('此單不代表付款完成',30,900,'center',42);
}

function production(t:TicketCanvas,order:PrintableOrder){
  t.text(orderService(order),72,900,'center',88);
  t.line(24);
  t.text('單號',30,900,'left',40);
  t.text(clean(order.display),96,900,'center',108);
  t.text('時間：'+hktDateTime(order.createdAt),30,800,'left',42);
  t.line(24);

  for(const item of order.items){
    t.productionItemBlock(item);
    t.line(22);
  }

  if(clean(order.orderRemark))t.wrapped('備註：'+clean(order.orderRemark),34,900,4,44);
  t.line(20);
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
    t.structuredItemBlock({
      item,
      lines:verticalSelectionLines(detailSource(item)),
      qtyBox:true,
    });
    t.line(18);
  }

  t.totalRow('總數量：',String(totalUnits(order))+'件');
  t.line(18);
  t.checkboxRow(['餐具','飲品','醬汁']);
  t.line(18);
  t.text('付款方式：'+clean(order.paymentLabel),32,800,'left',42);
  t.text('金額：'+money(order.totalMinor),44,900,'left',56);
  t.line(20);
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
  const estimatedHeight=Math.max(1800,1150+input.order.items.length*620);
  const canvas=document.createElement('canvas');
  canvas.width=ESC_POS_RASTER_PROFILE.widthDots;
  canvas.height=estimatedHeight;
  const t=new TicketCanvas(canvas);

  if(input.kind==='receipt')receipt(t,input.order);
  else if(input.kind==='table')tableTicket(t,input.order);
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
