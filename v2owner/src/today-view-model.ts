import type {OwnerReadModelSnapshot} from './product-types';

export interface OwnerTodayViewModel {
  readonly storeName:string;
  readonly businessDate:string;
  readonly observedAt?:string;
  readonly salesLabel?:string;
  readonly orderCount?:number;
  readonly averageOrderLabel?:string;
  readonly comparisonLabel?:string;
  readonly liveOrders:NonNullable<OwnerReadModelSnapshot['liveOrders']>|null;
  readonly dineIn:NonNullable<OwnerReadModelSnapshot['dineIn']>|null;
  readonly attentionCount:number;
  readonly staffNow?:number;
}

export function buildOwnerTodayViewModel(snapshot:OwnerReadModelSnapshot|null):OwnerTodayViewModel{
  return {
    storeName:snapshot?.store?.storeName??'未連接門店',
    businessDate:snapshot?.store?.businessDate??'營業日未有資料',
    observedAt:snapshot?.store?.observedAt,
    salesLabel:snapshot?.today?.salesLabel,
    orderCount:snapshot?.today?.orderCount,
    averageOrderLabel:snapshot?.today?.averageOrderLabel,
    comparisonLabel:snapshot?.today?.comparisonLabel,
    liveOrders:snapshot?.liveOrders??null,
    dineIn:snapshot?.dineIn??null,
    attentionCount:snapshot?.today?.attentionCount??snapshot?.actions.length??0,
    staffNow:snapshot?.today?.staffNow,
  };
}
