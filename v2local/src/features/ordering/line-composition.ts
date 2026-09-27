import {
  MFK_ORDER_LINE_COMPOSITION_SCHEMA,
  normalizeMfkOrderLineCompositionV1,
  type MfkOrderLineComboRole,
  type MfkOrderLineCompositionV1,
  type MfkOrderLineOptionSelections,
} from '../../../../contracts/order-line-composition-v1.ts';

export interface StructuredPairingIdentity{
  readonly groupLabel:string;
  readonly comboId:string;
  readonly comboName:string;
  readonly role:'MAIN'|'SNACK';
  readonly source:'AUTO'|'SPECIFIED';
}

export interface StructuredOrderingLine{
  readonly id:string;
  readonly productId?:string;
  readonly name?:string;
  readonly unitMinor?:number;
  readonly serviceMode?:'takeaway'|'dine-in';
  readonly detail?:string;
  readonly optionSelections?:MfkOrderLineOptionSelections;
  readonly freeNote?:string;
  readonly pairing?:StructuredPairingIdentity;
}

const comboRole=(role:StructuredPairingIdentity['role']):MfkOrderLineComboRole=>
  role==='MAIN'?'MAIN_COURSE':'SNACK';

export function serializeProductLineComposition(line:StructuredOrderingLine):MfkOrderLineCompositionV1{
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:'PRODUCT',
    cartLineId:line.id,
    ...(line.optionSelections&&Object.keys(line.optionSelections).length?{optionSelections:line.optionSelections}:{}),
    ...(line.freeNote!==undefined?{freeNote:line.freeNote}:{}),
  });
}

export function serializeLineComposition(
  line:StructuredOrderingLine,
  siblings:readonly StructuredOrderingLine[]=[],
):MfkOrderLineCompositionV1{
  if(!line.pairing)return serializeProductLineComposition(line);
  const group=siblings.filter(row=>
    row.pairing?.groupLabel===line.pairing?.groupLabel&&
    row.pairing?.comboId===line.pairing?.comboId,
  );
  const components=group.flatMap(row=>{
    if(!row.pairing||!row.productId||!row.name||!Number.isSafeInteger(row.unitMinor)||row.unitMinor!<0||!row.serviceMode)return [];
    const role=comboRole(row.pairing.role);
    return [Object.freeze({
      groupId:'pairing:'+role,
      groupName:row.pairing.role==='MAIN'?'飯團／主餐':'小食',
      role,
      choiceId:row.productId,
      choiceLabel:row.name,
      sourceLineId:row.id,
      snapshot:Object.freeze({
        productId:row.productId,
        name:row.name,
        unitMinor:row.unitMinor!,
        serviceMode:row.serviceMode,
        ...(row.detail?{detail:row.detail}:{}),
        ...(row.optionSelections&&Object.keys(row.optionSelections).length?{optionSelections:row.optionSelections}:{}),
        ...(row.freeNote!==undefined?{freeNote:row.freeNote}:{}),
      }),
    })];
  });
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:'COMBO',
    cartLineId:line.id,
    ...(line.optionSelections&&Object.keys(line.optionSelections).length?{optionSelections:line.optionSelections}:{}),
    ...(line.freeNote!==undefined?{freeNote:line.freeNote}:{}),
    combo:Object.freeze({
      comboId:line.pairing.comboId,
      comboName:line.pairing.comboName,
      pairingLabel:line.pairing.groupLabel,
      source:line.pairing.source,
      components:Object.freeze(components),
      resolvedChoices:Object.freeze([]),
      pendingGroups:Object.freeze([]),
    }),
  });
}

export function restoreProductLineComposition<T extends StructuredOrderingLine>(
  line:T,
  value:unknown,
):T{
  const composition=normalizeMfkOrderLineCompositionV1(value);
  if(!composition)return line;
  const ownComponent=composition.combo?.components.find(component=>component.sourceLineId===composition.cartLineId);
  const pairing=composition.kind==='COMBO'&&composition.combo&&ownComponent
    ?Object.freeze({
      groupLabel:composition.combo.pairingLabel,
      comboId:composition.combo.comboId,
      comboName:composition.combo.comboName,
      role:(ownComponent.role==='MAIN_COURSE'?'MAIN':'SNACK') as 'MAIN'|'SNACK',
      source:composition.combo.source,
    })
    :undefined;
  return {
    ...line,
    id:composition.cartLineId,
    ...(composition.optionSelections?{optionSelections:composition.optionSelections}:{optionSelections:undefined}),
    ...(composition.freeNote!==undefined?{freeNote:composition.freeNote}:{freeNote:undefined}),
    ...(pairing?{pairing}:{pairing:undefined}),
  } as T;
}
