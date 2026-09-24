export interface PrintableSelectionPart{
  readonly key:string;
  readonly value:string;
  readonly kind:'main'|'addon'|'drink'|'modifier'|'note';
}

const STRUCTURAL_MAIN_KEYS=[
  '選擇飯團','飯團','主食','飯底','便當','沙律','麵','主餐','餐點',
];
const STRUCTURAL_ADDON_KEYS=['小食','配料','加配','副食'];
const STRUCTURAL_DRINK_KEYS=['飲品','飲料'];
const NOTE_KEYS=['備註','要求','特別要求'];

function clean(value:unknown){
  return String(value??'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim();
}
function stripPriceSuffix(value:string){
  return value
    .replace(/\s*\([+-]?(?:HK\$|\$)?\d+(?:\.\d{1,2})?\)\s*$/i,'')
    .trim();
}
function splitSegments(detail:string){
  return clean(detail)
    .split(/\s*[·｜]\s*/u)
    .map(part=>part.trim())
    .filter(Boolean);
}
function classifyKey(key:string):PrintableSelectionPart['kind']{
  const normalized=clean(key);
  if(STRUCTURAL_MAIN_KEYS.includes(normalized))return'main';
  if(STRUCTURAL_ADDON_KEYS.includes(normalized))return'addon';
  if(STRUCTURAL_DRINK_KEYS.includes(normalized))return'drink';
  if(NOTE_KEYS.includes(normalized))return'note';
  return'modifier';
}

export function parsePrintableSelections(detail:unknown):readonly PrintableSelectionPart[]{
  const source=clean(detail);
  if(!source)return Object.freeze([]);
  const rows:PrintableSelectionPart[]=[];
  for(const segment of splitSegments(source)){
    const match=segment.match(/^([^：:]{1,24})[：:]\s*(.+)$/u);
    if(match){
      const key=clean(match[1]);
      const value=stripPriceSuffix(clean(match[2]));
      if(value)rows.push(Object.freeze({key,value,kind:classifyKey(key)}));
      continue;
    }
    const value=stripPriceSuffix(segment);
    if(value)rows.push(Object.freeze({key:'',value,kind:'note'}));
  }
  return Object.freeze(rows);
}

export function productionSelectionLines(detail:unknown):readonly string[]{
  return Object.freeze(parsePrintableSelections(detail).map(row=>row.value).filter(Boolean));
}

export function productLabelContent(input:{
  readonly productName:string;
  readonly detail?:string;
}):Readonly<{title:string;modifierLines:readonly string[]}>{
  const base=clean(input.productName).split('｜')[0]||clean(input.productName);
  const rows=parsePrintableSelections(input.detail);
  const main=rows.find(row=>row.kind==='main');
  const title=main?.value||base;
  const modifierLines=rows
    .filter(row=>row.kind==='modifier'||row.kind==='note')
    .map(row=>row.value)
    .filter(value=>value&&value!==title);
  return Object.freeze({
    title,
    modifierLines:Object.freeze([...new Set(modifierLines)]),
  });
}

export function compactSelectionLines(detail:unknown):readonly string[]{
  return productionSelectionLines(detail);
}
