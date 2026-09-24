export interface PrintableSelectionPart{
  readonly key:string;
  readonly value:string;
  readonly kind:'main'|'addon'|'drink'|'modifier'|'note';
}
export interface PrintableSelectionGroups{
  readonly main:readonly string[];
  readonly addon:readonly string[];
  readonly drink:readonly string[];
  readonly modifier:readonly string[];
  readonly note:readonly string[];
}

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
  const normalized=clean(key).toLowerCase();
  if(/飯團|主食|飯底|便當|沙律|麵|主餐|餐點|主菜/.test(normalized))return'main';
  if(/小食|配料|加配|副食/.test(normalized))return'addon';
  if(/飲品|飲料|drink/.test(normalized))return'drink';
  if(/備註|要求|特別要求/.test(normalized))return'note';
  return'modifier';
}
function unique(values:readonly string[]){
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function parsePrintableSelections(detail:unknown):readonly PrintableSelectionPart[]{
  const source=clean(detail);
  if(!source)return Object.freeze([]);
  const rows:PrintableSelectionPart[]=[];
  for(const segment of splitSegments(source)){
    const match=segment.match(/^([^：:]{1,28})[：:]\s*(.+)$/u);
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

export function groupPrintableSelections(detail:unknown):PrintableSelectionGroups{
  const groups:{main:string[];addon:string[];drink:string[];modifier:string[];note:string[]}={
    main:[],addon:[],drink:[],modifier:[],note:[],
  };
  for(const row of parsePrintableSelections(detail))groups[row.kind].push(row.value);
  return Object.freeze({
    main:Object.freeze(unique(groups.main)),
    addon:Object.freeze(unique(groups.addon)),
    drink:Object.freeze(unique(groups.drink)),
    modifier:Object.freeze(unique(groups.modifier)),
    note:Object.freeze(unique(groups.note)),
  });
}

function modifierText(values:readonly string[]){
  const rows=unique(values);
  return rows.length?'('+rows.join('，')+')':'';
}

export function productionBlockLines(detail:unknown):readonly string[]{
  const groups=groupPrintableSelections(detail);
  const lines:string[]=[];
  const main=groups.main[0]??'';
  const addon=groups.addon[0]??'';
  const modifier=modifierText(groups.modifier);
  const mainWithModifier=main?(main+(modifier?' '+modifier:'')):'';
  if(mainWithModifier||addon)lines.push([mainWithModifier,addon].filter(Boolean).join(' / '));
  for(const value of groups.main.slice(1))lines.push(value);
  for(const value of groups.addon.slice(1))lines.push(value);
  for(const value of groups.drink)lines.push(value);
  if(!main&&modifier)lines.push(modifier);
  for(const value of groups.note)lines.push(value);
  return Object.freeze(unique(lines));
}

export function verticalSelectionLines(detail:unknown):readonly string[]{
  const groups=groupPrintableSelections(detail);
  const lines:string[]=[];
  const modifier=modifierText(groups.modifier);
  for(const [index,value] of groups.main.entries()){
    lines.push(value+(index===0&&modifier?' '+modifier:''));
  }
  if(!groups.main.length&&modifier)lines.push(modifier);
  lines.push(...groups.addon,...groups.drink,...groups.note);
  return Object.freeze(unique(lines));
}

export function productLabelContent(input:{
  readonly productName:string;
  readonly detail?:string;
}):Readonly<{title:string;bodyLines:readonly string[]}>{
  const base=clean(input.productName).split('｜')[0]||clean(input.productName);
  const groups=groupPrintableSelections(input.detail);
  const title=groups.main[0]||base;
  const body:string[]=[];
  const modifier=modifierText(groups.modifier);
  if(modifier)body.push(modifier);
  body.push(...groups.main.slice(1),...groups.addon,...groups.drink,...groups.note);
  return Object.freeze({
    title,
    bodyLines:Object.freeze(unique(body.filter(value=>value!==title))),
  });
}

// Compatibility helpers used by existing ticket code/tests.
export function productionSelectionLines(detail:unknown):readonly string[]{
  return productionBlockLines(detail);
}
export function compactSelectionLines(detail:unknown):readonly string[]{
  return verticalSelectionLines(detail);
}
