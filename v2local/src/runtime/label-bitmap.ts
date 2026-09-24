export const LABEL_TSC_PROFILE=Object.freeze({
  protocol:'TSC' as const,
  widthMm:50,
  heightMm:40,
  dpi:203,
  leftOffset:0,
  topOffset:0,
  lineGap:28,
  reverseFeed:true,
});

export type RasterLabelKind='product'|'bag';

export interface RasterLabelSpec{
  readonly kind?:RasterLabelKind;
  readonly orderCode:string;
  readonly primaryText:string;
  readonly pieceLabel?:string;
  readonly secondaryText?:string;
  readonly secondaryLines?:readonly string[];
  readonly productCode?:string;
  readonly pickupCode?:string;
}

const mmToDots=(mm:number)=>Math.round(mm*LABEL_TSC_PROFILE.dpi/25.4);
const encoder=new TextEncoder();
const FONT='"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';

function concatBytes(parts:readonly Uint8Array[]):Uint8Array{
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}

export function packMonochromeBitmap(pixels:Uint8Array,width:number,height:number):Uint8Array{
  if(width<1||height<1||pixels.length!==width*height)throw new Error('LABEL_BITMAP_DIMENSION_INVALID');
  const bytesPerRow=Math.ceil(width/8);
  const output=new Uint8Array(bytesPerRow*height);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(!pixels[y*width+x])continue;
      const byteIndex=y*bytesPerRow+(x>>3);
      output[byteIndex]|=0x80>>(x&7);
    }
  }
  return output;
}

export function buildTscBitmapPayload(input:{
  readonly bitmap:Uint8Array;
  readonly widthDots:number;
  readonly heightDots:number;
}):Uint8Array{
  const bytesPerRow=Math.ceil(input.widthDots/8);
  if(input.bitmap.length!==bytesPerRow*input.heightDots)throw new Error('LABEL_BITMAP_BYTES_INVALID');
  const prefix=encoder.encode(
    'SIZE '+LABEL_TSC_PROFILE.widthMm+' mm,'+LABEL_TSC_PROFILE.heightMm+' mm\r\n'
    +'GAP 2 mm,0 mm\r\n'
    +'REFERENCE '+LABEL_TSC_PROFILE.leftOffset+','+LABEL_TSC_PROFILE.topOffset+'\r\n'
    +'DENSITY 8\r\n'
    +'CLS\r\n'
    +'BITMAP 0,0,'+bytesPerRow+','+input.heightDots+',0,'
  );
  const suffix=encoder.encode('\r\nPRINT 1,1\r\nSOUND 3,40\r\n');
  return concatBytes([prefix,input.bitmap,suffix]);
}

function setFont(ctx:CanvasRenderingContext2D,size:number,weight=800){
  ctx.font=weight+' '+size+'px '+FONT;
}

function wrapCharacters(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines:number):string[]{
  const value=String(text||'').trim();
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

function fitFont(
  ctx:CanvasRenderingContext2D,
  text:string,
  maxWidth:number,
  preferred:number,
  minimum:number,
  weight=800,
){
  let size=preferred;
  while(size>minimum){
    setFont(ctx,size,weight);
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=2;
  }
  return size;
}

function outerFrame(ctx:CanvasRenderingContext2D,widthDots:number,heightDots:number){
  const safe=18;
  ctx.strokeStyle='#000';
  ctx.lineWidth=3;
  ctx.strokeRect(safe,safe,widthDots-safe*2,heightDots-safe*2);
  return Object.freeze({safe,inner:safe+8});
}

function drawProductLabel(
  ctx:CanvasRenderingContext2D,
  spec:RasterLabelSpec,
  widthDots:number,
  heightDots:number,
){
  const {safe,inner}=outerFrame(ctx,widthDots,heightDots);
  const gap=8;
  const headerTop=inner;
  const headerHeight=78;
  const usable=widthDots-inner*2;
  const leftWidth=Math.round(usable*0.66);
  const rightX=inner+leftWidth+gap;
  const rightWidth=usable-leftWidth-gap;

  // ONLY the order/display number is black with white text.
  ctx.fillStyle='#000';
  ctx.fillRect(inner,headerTop,leftWidth,headerHeight);
  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const orderCode=String(spec.orderCode||'');
  const orderSize=fitFont(ctx,orderCode,leftWidth-18,52,34,900);
  setFont(ctx,orderSize,900);
  ctx.fillText(orderCode,inner+leftWidth/2,headerTop+headerHeight/2);

  // Piece count stays white with black text.
  ctx.fillStyle='#fff';
  ctx.fillRect(rightX,headerTop,rightWidth,headerHeight);
  ctx.strokeStyle='#000';
  ctx.lineWidth=3;
  ctx.strokeRect(rightX,headerTop,rightWidth,headerHeight);
  ctx.fillStyle='#000';
  const piece=String(spec.pieceLabel||'');
  const pieceSize=fitFont(ctx,piece,rightWidth-12,40,25,900);
  setFont(ctx,pieceSize,900);
  ctx.fillText(piece,rightX+rightWidth/2,headerTop+headerHeight/2);

  // Body: white background, black text, safely inset from all four edges.
  const bodyTop=headerTop+headerHeight+8;
  const bodyBottom=heightDots-safe-8;
  const bodyWidth=usable;
  ctx.fillStyle='#fff';
  ctx.fillRect(inner,bodyTop,bodyWidth,Math.max(1,bodyBottom-bodyTop));
  ctx.fillStyle='#000';
  ctx.textAlign='left';
  ctx.textBaseline='top';

  const title=String(spec.primaryText||'').trim();
  setFont(ctx,32,900);
  const titleLines=wrapCharacters(ctx,title,bodyWidth,2);
  let y=bodyTop+4;
  for(const line of titleLines){
    ctx.fillText(line,inner,y);
    y+=36;
  }

  const bodyLines=(spec.secondaryLines?.length?spec.secondaryLines:[spec.secondaryText??''])
    .map(value=>String(value||'').trim())
    .filter(Boolean);

  if(bodyLines.length){
    y+=2;
    const available=Math.max(26,bodyBottom-y);
    const perLine=Math.max(24,Math.min(31,Math.floor(available/Math.max(1,bodyLines.length))));
    setFont(ctx,perLine,800);
    for(const raw of bodyLines.slice(0,4)){
      const wrapped=wrapCharacters(ctx,raw,bodyWidth,2);
      for(const line of wrapped){
        if(y+perLine>bodyBottom)break;
        ctx.fillText(line,inner,y);
        y+=perLine+3;
      }
    }
  }
}

function drawBagLabel(
  ctx:CanvasRenderingContext2D,
  spec:RasterLabelSpec,
  widthDots:number,
  heightDots:number,
){
  const {safe,inner}=outerFrame(ctx,widthDots,heightDots);
  const gap=8;
  const top=inner;
  const usable=widthDots-inner*2;
  const topHeight=104;
  const leftWidth=Math.round(usable*0.62);
  const rightX=inner+leftWidth+gap;
  const rightWidth=usable-leftWidth-gap;

  // P-number: black background / white text.
  ctx.fillStyle='#000';
  ctx.fillRect(inner,top,leftWidth,topHeight);
  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  const orderCode=String(spec.orderCode||'');
  const orderSize=fitFont(ctx,orderCode,leftWidth-18,68,40,900);
  setFont(ctx,orderSize,900);
  ctx.fillText(orderCode,inner+leftWidth/2,top+topHeight/2);

  // Total count: white background / black text.
  ctx.fillStyle='#fff';
  ctx.fillRect(rightX,top,rightWidth,topHeight);
  ctx.strokeStyle='#000';
  ctx.lineWidth=3;
  ctx.strokeRect(rightX,top,rightWidth,topHeight);
  ctx.fillStyle='#000';
  const total=String(spec.secondaryText||spec.primaryText||'').replace(/\s+/g,'').trim();
  const totalSize=fitFont(ctx,total,rightWidth-12,42,27,900);
  setFont(ctx,totalSize,900);
  ctx.fillText(total,rightX+rightWidth/2,top+topHeight/2);

  // Full-width pickup-code row.
  const pickupTop=top+topHeight+10;
  const pickupBottom=heightDots-safe-8;
  const pickupHeight=Math.max(70,pickupBottom-pickupTop);
  ctx.fillStyle='#fff';
  ctx.fillRect(inner,pickupTop,usable,pickupHeight);
  ctx.strokeStyle='#000';
  ctx.lineWidth=3;
  ctx.strokeRect(inner,pickupTop,usable,pickupHeight);

  const pickup=String(spec.pickupCode||'—').trim();
  ctx.fillStyle='#000';
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  setFont(ctx,28,900);
  ctx.fillText('取餐碼',inner+14,pickupTop+pickupHeight/2);

  const codeMax=usable-150;
  const codeSize=fitFont(ctx,pickup,codeMax,58,34,900);
  setFont(ctx,codeSize,900);
  ctx.textAlign='right';
  ctx.fillText(pickup,inner+usable-14,pickupTop+pickupHeight/2);
}

export async function renderTscRasterLabel(spec:RasterLabelSpec):Promise<Uint8Array>{
  if(typeof document==='undefined')throw new Error('LABEL_CANVAS_UNAVAILABLE');
  const widthDots=mmToDots(LABEL_TSC_PROFILE.widthMm);
  const heightDots=mmToDots(LABEL_TSC_PROFILE.heightMm);
  const canvas=document.createElement('canvas');
  canvas.width=widthDots;
  canvas.height=heightDots;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('LABEL_CANVAS_UNAVAILABLE');

  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,widthDots,heightDots);

  if(spec.kind==='bag')drawBagLabel(ctx,spec,widthDots,heightDots);
  else drawProductLabel(ctx,spec,widthDots,heightDots);

  const image=ctx.getImageData(0,0,widthDots,heightDots);
  const mono=new Uint8Array(widthDots*heightDots);
  for(let pixel=0;pixel<widthDots*heightDots;pixel++){
    const offset=pixel*4;
    const r=image.data[offset]??255;
    const g=image.data[offset+1]??255;
    const b=image.data[offset+2]??255;
    const alpha=image.data[offset+3]??255;
    const luminance=(r*299+g*587+b*114)/1000;
    // Store Xprinter physical acceptance requires inverted TSC bitmap polarity.
    mono[pixel]=alpha>20&&luminance<180?0:1;
  }
  const bitmap=packMonochromeBitmap(mono,widthDots,heightDots);
  return buildTscBitmapPayload({bitmap,widthDots,heightDots});
}
