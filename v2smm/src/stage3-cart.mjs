export function smmLineTotalMinor(publishedUnitPriceMinor,quantity){
  const unit=Number(publishedUnitPriceMinor);
  const qty=Number(quantity);
  if(!Number.isSafeInteger(unit)||unit<0||!Number.isSafeInteger(qty)||qty<1)return null;
  const total=unit*qty;
  return Number.isSafeInteger(total)&&total>=0?total:null;
}

export function buildSmmCartRefreshAttention(input){
  const oldUnit=Number.isSafeInteger(Number(input.oldPublishedUnitPriceMinor))
    ?Number(input.oldPublishedUnitPriceMinor)
    :undefined;
  const newUnit=Number.isSafeInteger(Number(input.proposedPublishedUnitPriceMinor))
    ?Number(input.proposedPublishedUnitPriceMinor)
    :undefined;
  const priceChanged=oldUnit!==newUnit;
  if(!input.configChanged&&!priceChanged)return null;
  return Object.freeze({
    kind:input.configChanged?'CONFIG_CHANGED':'PRICE_CHANGED',
    menuRevision:String(input.menuRevision),
    ...(oldUnit===undefined?{}:{oldPublishedUnitPriceMinor:oldUnit}),
    ...(newUnit===undefined?{}:{proposedPublishedUnitPriceMinor:newUnit}),
    ...(Array.isArray(input.proposedSelections)?{proposedSelections:Object.freeze([...input.proposedSelections])}:{}),
    ...(input.proposedCombo?{proposedCombo:input.proposedCombo}:{}),
    canAccept:Boolean(input.canAccept),
    detectedAt:String(input.detectedAt),
  });
}

export function sameSmmCartRefreshAttention(left,right){
  if(left===right)return true;
  if(!left||!right)return false;
  return JSON.stringify({
    kind:left.kind,
    menuRevision:left.menuRevision,
    oldPublishedUnitPriceMinor:left.oldPublishedUnitPriceMinor,
    proposedPublishedUnitPriceMinor:left.proposedPublishedUnitPriceMinor,
    proposedSelections:left.proposedSelections??null,
    proposedCombo:left.proposedCombo??null,
    canAccept:left.canAccept,
  })===JSON.stringify({
    kind:right.kind,
    menuRevision:right.menuRevision,
    oldPublishedUnitPriceMinor:right.oldPublishedUnitPriceMinor,
    proposedPublishedUnitPriceMinor:right.proposedPublishedUnitPriceMinor,
    proposedSelections:right.proposedSelections??null,
    proposedCombo:right.proposedCombo??null,
    canAccept:right.canAccept,
  });
}

export function acceptSmmCartRefresh(cart,lineId){
  let accepted=false;
  const next=cart.map(line=>{
    if(line.lineId!==lineId)return line;
    const attention=line.refreshAttention;
    if(!attention||!attention.canAccept||!Number.isSafeInteger(Number(attention.proposedPublishedUnitPriceMinor)))return line;
    if(line.combo&&!attention.proposedCombo)return line;
    const updated={
      ...line,
      selections:attention.proposedSelections??line.selections,
      publishedUnitPriceMinor:Number(attention.proposedPublishedUnitPriceMinor),
    };
    if(line.combo)updated.combo=attention.proposedCombo;
    delete updated.refreshAttention;
    accepted=true;
    return Object.freeze(updated);
  });
  return Object.freeze({accepted,cart:Object.freeze(next)});
}
