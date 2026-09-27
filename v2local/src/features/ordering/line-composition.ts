import {
  MFK_ORDER_LINE_COMPOSITION_SCHEMA,
  normalizeMfkOrderLineCompositionV1,
  type MfkOrderLineCompositionV1,
  type MfkOrderLineOptionSelections,
} from '../../../../contracts/order-line-composition-v1.ts';

export interface StructuredOrderingLine{
  readonly id:string;
  readonly optionSelections?:MfkOrderLineOptionSelections;
  readonly freeNote?:string;
}

export function serializeProductLineComposition(line:StructuredOrderingLine):MfkOrderLineCompositionV1{
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:'PRODUCT',
    cartLineId:line.id,
    ...(line.optionSelections&&Object.keys(line.optionSelections).length?{optionSelections:line.optionSelections}:{}),
    ...(line.freeNote!==undefined?{freeNote:line.freeNote}:{}),
  });
}

export function restoreProductLineComposition<T extends StructuredOrderingLine>(
  line:T,
  value:unknown,
):T{
  const composition=normalizeMfkOrderLineCompositionV1(value);
  if(!composition||composition.kind!=='PRODUCT')return line;
  return {
    ...line,
    id:composition.cartLineId,
    ...(composition.optionSelections?{optionSelections:composition.optionSelections}:{optionSelections:undefined}),
    ...(composition.freeNote!==undefined?{freeNote:composition.freeNote}:{freeNote:undefined}),
  } as T;
}
