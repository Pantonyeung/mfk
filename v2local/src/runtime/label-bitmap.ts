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

export interface RasterLabelSpec{
  readonly orderCode:string;
  readonly primaryText:string;
  readonly pieceLabel:string;
  readonly secondaryText?:string;
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
  const suffix=encoder.encode('\r\nPRINT 1,1\r\n');
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
  ctx.fillStyle='#000';
  ctx.textBaseline='top';

  const left=18;
  const usableWidth=widthDots-left*2;

  ctx.font='700 32px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
  ctx.fillText(String(spec.orderCode||''),left,22);

  ctx.font='700 42px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const productLines=wrapCharacters(ctx,spec.primaryText,usableWidth,2);
  let y=72;
  for(const line of productLines){
    ctx.fillText(line,left,y);
    y+=50;
  }

  if(spec.secondaryText){
    ctx.font='500 24px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
    ctx.fillText(spec.secondaryText,left,Math.max(y+LABEL_TSC_PROFILE.lineGap,190));
  }

  ctx.font='700 28px "Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';
  ctx.fillText(String(spec.pieceLabel||''),left,heightDots-52);

  const image=ctx.getImageData(0,0,widthDots,heightDots);
  const mono=new Uint8Array(widthDots*heightDots);
  for(let pixel=0;pixel<widthDots*heightDots;pixel++){
    const offset=pixel*4;
    const r=image.data[offset]??255;
    const g=image.data[offset+1]??255;
    const b=image.data[offset+2]??255;
    const alpha=image.data[offset+3]??255;
    const luminance=(r*299+g*587+b*114)/1000;
    mono[pixel]=alpha>20&&luminance<180?0:1;
  }
  const bitmap=packMonochromeBitmap(mono,widthDots,heightDots);
  return buildTscBitmapPayload({bitmap,widthDots,heightDots});
}
