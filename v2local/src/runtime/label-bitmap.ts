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
  readonly productCode?:string;
}

const mmToDots=(mm:number)=>Math.round(mm*LABEL_TSC_PROFILE.dpi/25.4);
const encoder=new TextEncoder();

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
    ctx.font=weight+' '+size+'px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=2;
  }
  return size;
}

function drawProductLabel(
  ctx:CanvasRenderingContext2D,
  spec:RasterLabelSpec,
  widthDots:number,
  heightDots:number,
){
  const margin=14;
  const gap=8;
  const top=12;
  const headerHeight=78;
  const leftWidth=Math.round(widthDots*0.66);
  const rightX=leftWidth+gap;
  const rightWidth=widthDots-rightX-margin;

  // Operational header: order number and piece count are separate black/white blocks.
  ctx.fillStyle='#000';
  ctx.fillRect(margin,top,leftWidth-margin,headerHeight);
  ctx.fillRect(rightX,top,rightWidth,headerHeight);
  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  const orderCode=String(spec.orderCode||'');
  fitFont(ctx,orderCode,leftWidth-margin-18,46,30,900);
  ctx.fillText(orderCode,margin+(leftWidth-margin)/2,top+headerHeight/2);

  const piece=String(spec.pieceLabel||'');
  fitFont(ctx,piece,rightWidth-12,38,25,900);
  ctx.fillText(piece,rightX+rightWidth/2,top+headerHeight/2);

  // Product identity.
  ctx.fillStyle='#000';
  ctx.textAlign='left';
  ctx.textBaseline='top';
  const code=String(spec.productCode||'').trim();
  const name=(code?code+' · ':'')+String(spec.primaryText||'').trim();
  ctx.font='900 34px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const lines=wrapCharacters(ctx,name,widthDots-margin*2,3);
  let y=108;
  for(const line of lines){
    ctx.fillText(line,margin,y);
    y+=40;
  }

  if(spec.secondaryText){
    const secondaryY=Math.max(y+4,heightDots-58);
    ctx.font='600 22px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
    const secondary=wrapCharacters(ctx,String(spec.secondaryText),widthDots-margin*2,1)[0]??'';
    ctx.fillText(secondary,margin,secondaryY);
  }
}

function drawBagLabel(
  ctx:CanvasRenderingContext2D,
  spec:RasterLabelSpec,
  widthDots:number,
  heightDots:number,
){
  const margin=12;
  const gap=10;
  const top=16;
  const height=heightDots-top*2;
  const usable=widthDots-margin*2;
  const leftWidth=Math.round(usable*0.62);
  const rightX=margin+leftWidth+gap;
  const rightWidth=usable-leftWidth-gap;

  // Owner-locked bag label: landscape, no logo, no bag sequence.
  // LEFT = order/display number, RIGHT = total item count.
  ctx.fillStyle='#000';
  ctx.fillRect(margin,top,leftWidth,height);
  ctx.fillRect(rightX,top,rightWidth,height);

  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  const orderCode=String(spec.orderCode||'');
  fitFont(ctx,orderCode,leftWidth-18,76,42,900);
  ctx.fillText(orderCode,margin+leftWidth/2,top+height/2);

  const total=String(spec.secondaryText||spec.primaryText||'').replace(/\s+/g,'').trim();
  fitFont(ctx,total,rightWidth-12,48,30,900);
  ctx.fillText(total,rightX+rightWidth/2,top+height/2);
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
    // Keep the existing printer bitmap polarity contract.
    mono[pixel]=alpha>20&&luminance<180?1:0;
  }
  const bitmap=packMonochromeBitmap(mono,widthDots,heightDots);
  return buildTscBitmapPayload({bitmap,widthDots,heightDots});
}
