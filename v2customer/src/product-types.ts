export type CustomerConnectionState='NOT_CONNECTED'|'LOADING'|'READY'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';
export type CustomerCommandState='CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN'|'NOT_CONNECTED';
export type CustomerOrderStage='RECEIVED'|'REJECTED'|'ACCEPTED'|'PREPARING'|'DELAYED'|'READY'|'PICKUP_VERIFICATION'|'HANDED_OVER'|'COMPLETED';

export interface CustomerStoreContext {
  readonly storeId:string;
  readonly storeName:string;
  readonly channelAvailable:boolean;
  readonly etaLabel?:string;
  readonly notice?:string;
  readonly observedAt:string;
}

export interface CustomerCategory {
  readonly categoryId:string;
  readonly name:string;
  readonly sortOrder:number;
}

export interface CustomerOption {
  readonly optionId:string;
  readonly name:string;
  readonly available:boolean;
}

export interface CustomerOptionGroup {
  readonly optionGroupId:string;
  readonly name:string;
  readonly required:boolean;
  readonly minSelections:number;
  readonly maxSelections:number;
  readonly options:readonly CustomerOption[];
}

export interface CustomerVariation {
  readonly variationId:string;
  readonly name:string;
  readonly available:boolean;
}

export interface CustomerProduct {
  readonly productId:string;
  readonly categoryId:string;
  readonly name:string;
  readonly description:string;
  readonly badge?:string;
  readonly available:boolean;
  readonly displayPriceLabel?:string;
  readonly variationRequired?:boolean;
  readonly variations?:readonly CustomerVariation[];
  readonly optionGroups:readonly CustomerOptionGroup[];
}

export interface CustomerMenuSnapshot {
  readonly revision:string;
  readonly observedAt:string;
  readonly categories:readonly CustomerCategory[];
  readonly products:readonly CustomerProduct[];
}

export interface CustomerCartSelection {
  readonly optionGroupId:string;
  readonly optionId:string;
  readonly optionName:string;
}

export interface CustomerCartLine {
  readonly lineId:string;
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly selectedVariationId?:string;
  readonly selectedVariationName?:string;
  readonly selections:readonly CustomerCartSelection[];
  readonly createdAt:string;
  readonly attention?:string;
}

export interface CustomerQuoteSnapshot {
  readonly quoteId:string;
  readonly revision:string;
  readonly currency:string;
  readonly totalMinor:number;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'MATERIAL_CHANGE'|'UNKNOWN';
}

export interface CustomerCheckoutDraft {
  readonly name:string;
  readonly phone:string;
}

export interface CustomerPendingIntent {
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly createdAt:string;
  readonly updatedAt:string;
  readonly state:'DRAFT'|'NOT_CONNECTED'|'PENDING'|'UNKNOWN';
  readonly cart:readonly CustomerCartLine[];
  readonly checkout:CustomerCheckoutDraft;
  readonly lastMessage?:string;
}

export interface CustomerOrderTimelineItem {
  readonly at:string;
  readonly stage:CustomerOrderStage;
  readonly label:string;
  readonly detail?:string;
}

export interface CustomerOrderProjection {
  readonly orderId:string;
  readonly displayCode:string;
  readonly stage:CustomerOrderStage;
  readonly itemSummary:string;
  readonly amountLabel?:string;
  readonly pickupCode?:string;
  readonly phoneMasked?:string;
  readonly etaLabel?:string;
  readonly rejectionReason?:string;
  readonly handoverState?:'NOT_ARRIVED'|'ARRIVED'|'VERIFIED'|'HANDED_OVER'|'UNKNOWN';
  readonly observedAt:string;
  readonly readback:'CONFIRMED'|'PARTIAL'|'UNKNOWN';
  readonly timeline:readonly CustomerOrderTimelineItem[];
}

export interface CustomerHistoryProjection {
  readonly orderId:string;
  readonly displayCode:string;
  readonly completedAt:string;
  readonly itemSummary:string;
  readonly amountLabel?:string;
  readonly reorderEligible:boolean;
}

export interface CustomerReadModelSnapshot {
  readonly store?:CustomerStoreContext;
  readonly menu?:CustomerMenuSnapshot;
  readonly activeOrders:readonly CustomerOrderProjection[];
  readonly history:readonly CustomerHistoryProjection[];
  readonly observedAt:string;
}

export interface CustomerCommandResult {
  readonly state:CustomerCommandState;
  readonly message:string;
  readonly orderId?:string;
  readonly canonicalRevision?:number;
}

export interface CustomerReorderResult {
  readonly state:CustomerCommandState;
  readonly message:string;
  readonly cart?:readonly CustomerCartLine[];
  readonly attention?:readonly string[];
}

export interface CustomerRuntimePort {
  readonly portId:'MFK_CUSTOMER_PORT_V1';
  readSnapshot():Promise<CustomerReadModelSnapshot>;
  quoteCart?(cart:readonly CustomerCartLine[]):Promise<CustomerQuoteSnapshot>;
  submitOrder?(intent:CustomerPendingIntent):Promise<CustomerCommandResult>;
  readSubmission?(submissionId:string):Promise<CustomerCommandResult>;
  buildReorderCart?(orderId:string):Promise<CustomerReorderResult>;
  requestFallback?():Promise<CustomerCommandResult>;
}
