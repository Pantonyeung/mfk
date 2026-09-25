export interface SmtFrontlineUiPreferences{
  readonly categoryRows:1|2|3;
  readonly categoryColumns:number;
  readonly productColumns:number;
  readonly productCardHeight:number;
  readonly showImages:boolean;
  readonly showCategories:boolean;
  readonly fontScale:number;
  readonly densityScale:number;
}

const KEY='mfk.smt.frontline-ui.v1';

export const DEFAULT_SMT_FRONTLINE_UI_PREFERENCES:SmtFrontlineUiPreferences=Object.freeze({
  categoryRows:2,
  categoryColumns:7,
  productColumns:4,
  productCardHeight:142,
  showImages:true,
  showCategories:true,
  fontScale:1,
  densityScale:1,
});

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const finite=(value:unknown,fallback:number)=>{
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
};

export function normalizeSmtFrontlineUiPreferences(input:unknown):SmtFrontlineUiPreferences{
  const row=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
  const rows=Math.round(clamp(finite(row.categoryRows,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.categoryRows),1,3)) as 1|2|3;
  return Object.freeze({
    categoryRows:rows,
    categoryColumns:Math.round(clamp(finite(row.categoryColumns,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.categoryColumns),4,9)),
    productColumns:Math.round(clamp(finite(row.productColumns,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.productColumns),3,6)),
    productCardHeight:Math.round(clamp(finite(row.productCardHeight,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.productCardHeight),100,190)),
    showImages:typeof row.showImages==='boolean'?row.showImages:DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.showImages,
    showCategories:typeof row.showCategories==='boolean'?row.showCategories:DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.showCategories,
    fontScale:Math.round(clamp(finite(row.fontScale,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.fontScale),0.85,1.25)*100)/100,
    densityScale:Math.round(clamp(finite(row.densityScale,DEFAULT_SMT_FRONTLINE_UI_PREFERENCES.densityScale),0.85,1.15)*100)/100,
  });
}

export function readSmtFrontlineUiPreferences():SmtFrontlineUiPreferences{
  if(typeof localStorage==='undefined')return DEFAULT_SMT_FRONTLINE_UI_PREFERENCES;
  try{return normalizeSmtFrontlineUiPreferences(JSON.parse(localStorage.getItem(KEY)||'null'));}
  catch{return DEFAULT_SMT_FRONTLINE_UI_PREFERENCES;}
}

export function writeSmtFrontlineUiPreferences(next:SmtFrontlineUiPreferences){
  if(typeof localStorage==='undefined')return;
  localStorage.setItem(KEY,JSON.stringify(normalizeSmtFrontlineUiPreferences(next)));
}
