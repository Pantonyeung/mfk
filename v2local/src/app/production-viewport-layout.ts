export const SMT_GOLDEN_WIDTH=1920;
export const SMT_GOLDEN_HEIGHT=1080;

export interface ProductionViewportLayout{
  readonly viewportWidth:number;
  readonly viewportHeight:number;
  readonly scale:number;
  readonly renderedWidth:number;
  readonly renderedHeight:number;
  readonly left:number;
  readonly top:number;
}

function positiveFinite(value:number,code:string):number{
  if(!Number.isFinite(value)||value<=0)throw new Error(code);
  return value;
}

export function computeProductionViewportLayout(viewportWidth:number,viewportHeight:number):ProductionViewportLayout{
  const width=positiveFinite(viewportWidth,'SMT_VIEWPORT_WIDTH_INVALID');
  const height=positiveFinite(viewportHeight,'SMT_VIEWPORT_HEIGHT_INVALID');
  const scale=Math.min(width/SMT_GOLDEN_WIDTH,height/SMT_GOLDEN_HEIGHT);
  const renderedWidth=SMT_GOLDEN_WIDTH*scale;
  const renderedHeight=SMT_GOLDEN_HEIGHT*scale;
  return Object.freeze({
    viewportWidth:width,
    viewportHeight:height,
    scale,
    renderedWidth,
    renderedHeight,
    left:Math.max(0,(width-renderedWidth)/2),
    top:Math.max(0,(height-renderedHeight)/2),
  });
}
