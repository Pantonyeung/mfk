import type {MfkAdminConfigEnvelope} from './admin-config-sync-v1.ts';

export interface CanonicalComboChoiceProjection{
  readonly id:string;
  readonly type:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
  readonly label:string;
  readonly priceAdjustmentMinor:number;
  readonly active:boolean;
}
export interface CanonicalComboSubPoolProjection{
  readonly id:string;
  readonly name:string;
  readonly priceAdjustmentMinor:number;
  readonly active:boolean;
  readonly choices:readonly CanonicalComboChoiceProjection[];
}
export interface CanonicalComboPoolGroupProjection{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly min:number;
  readonly max:number;
  readonly subPools:readonly CanonicalComboSubPoolProjection[];
}
export interface CanonicalComboPoolProjection{
  readonly id:string;
  readonly name:string;
  readonly kind:'MAIN_COURSE'|'ADDON';
  readonly addonKind?:'SNACK'|'DRINK';
  readonly groups:readonly CanonicalComboPoolGroupProjection[];
}
export interface CanonicalComboProjection{
  readonly id:string;
  readonly name:string;
  readonly basePriceMinor:number;
  readonly active:boolean;
  readonly mainPoolId?:string;
  readonly addonPoolIds:readonly string[];
}
export interface CanonicalComboProjectionSnapshot{
  readonly combos:readonly CanonicalComboProjection[];
  readonly pools:readonly CanonicalComboPoolProjection[];
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function array(value:unknown):readonly unknown[]{return Array.isArray(value)?value:[];}
function string(value:unknown,fallback=''){return typeof value==='string'?value:fallback;}
function bool(value:unknown,fallback=false){return typeof value==='boolean'?value:fallback;}
function integer(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isSafeInteger(n)?n:fallback;
}
function moneyMinor(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}

export function projectCanonicalCombos(
  envelope:Pick<MfkAdminConfigEnvelope,'snapshot'>|null|undefined,
):CanonicalComboProjectionSnapshot{
  const snapshot=record(envelope?.snapshot);
  const catalog=record(snapshot.catalog);

  const combos=array(catalog.combos).map(raw=>{
    const row=record(raw);
    return Object.freeze({
      id:string(row.id),
      name:string(row.name,string(row.id)),
      basePriceMinor:moneyMinor(row.basePrice),
      active:bool(row.active,true),
      mainPoolId:string(row.mainPoolId)||undefined,
      addonPoolIds:Object.freeze(array(row.addonPoolIds).map(value=>string(value)).filter(Boolean)),
    });
  }).filter(row=>row.id&&row.active);

  const pools=array(catalog.comboPools).map(raw=>{
    const pool=record(raw);
    const groups=array(pool.groups).map(groupRaw=>{
      const group=record(groupRaw);
      const choices=array(group.choices).map(choiceRaw=>{
        const choice=record(choiceRaw);
        return {
          id:string(choice.id),
          type:choice.choiceType==='LABEL'?'LABEL' as const:choice.choiceType==='NONE'?'NONE' as const:'PRODUCT' as const,
          productId:string(choice.productId)||undefined,
          label:string(choice.label),
          bandId:string(choice.bandId),
          priceAdjustmentMinor:moneyMinor(choice.priceAdjustment),
          active:bool(choice.active,true),
          position:integer(choice.position,0),
        };
      }).filter(choice=>choice.id&&choice.active);

      const bands=array(group.bands).map(bandRaw=>{
        const band=record(bandRaw);
        const id=string(band.id);
        return Object.freeze({
          id,
          name:string(band.name,id),
          priceAdjustmentMinor:moneyMinor(band.priceAdjustment),
          active:bool(band.active,true),
          position:integer(band.position,0),
          choices:Object.freeze(choices
            .filter(choice=>choice.bandId===id)
            .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
            .map(({bandId:_,position:__,...choice})=>Object.freeze(choice))),
        });
      }).filter(band=>band.id&&band.active)
        .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
        .map(({position:_,...band})=>Object.freeze(band));

      return Object.freeze({
        id:string(group.id),
        name:string(group.name,string(group.id)),
        required:bool(group.required,true),
        min:integer(group.min,1),
        max:integer(group.max,1),
        position:integer(group.position,0),
        subPools:Object.freeze(bands),
      });
    }).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
      .map(({position:_,...group})=>Object.freeze(group));

    const kind=pool.kind==='ADDON'?'ADDON' as const:'MAIN_COURSE' as const;
    return Object.freeze({
      id:string(pool.id),
      name:string(pool.name,string(pool.id)),
      kind,
      addonKind:kind==='ADDON'?(pool.addonKind==='DRINK'?'DRINK' as const:'SNACK' as const):undefined,
      groups:Object.freeze(groups),
    });
  }).filter(pool=>pool.id);

  return Object.freeze({
    combos:Object.freeze(combos),
    pools:Object.freeze(pools),
  });
}
