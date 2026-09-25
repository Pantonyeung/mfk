// Payment methods are Admin-published; channel IDs are stable opaque keys.
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
  readonly publishedAdjustmentMinor?:number;
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
  readonly publishedUnitPriceMinor?:number;
  readonly imageUrl?:string;
  readonly imageAlt?:string;
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
  readonly publishedAdjustmentMinor?:number;
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
  readonly note?:string;
  readonly attention?:string;
  readonly publishedUnitPriceMinor?:number;
}

export type CustomerProjectionState='READY'|'EMPTY'|'LOADING'|'STALE'|'ERROR'|'NOT_CONNECTED';

export interface CustomerMemorySeedProjection {
  readonly state:CustomerProjectionState;
  readonly valueLabel?:string;
  readonly progressLabel?:string;
  readonly nextBenefitLabel?:string;
  readonly history?:readonly {readonly label:string;readonly occurredAt:string}[];
}

export interface CustomerMemoryBadgeProjection {
  readonly badgeId:string;
  readonly name:string;
  readonly state:'EARNED'|'LOCKED';
  readonly detail?:string;
  readonly progressLabel?:string;
  readonly earnedAt?:string;
}

export interface CustomerMemoryCouponProjection {
  readonly couponId:string;
  readonly name:string;
  readonly state:'AVAILABLE'|'LOCKED'|'USED'|'EXPIRED';
  readonly detail?:string;
  readonly expiryLabel?:string;
}

export interface CustomerMemberProjection {
  readonly state:CustomerProjectionState;
  readonly displayName?:string;
  readonly memberLabel?:string;
  readonly lastVisitLabel?:string;
  readonly observedAt:string;
  readonly preferences?:readonly string[];
  readonly frequentTasteLabels?:readonly string[];
  readonly careMessage?:string;
  readonly seeds?:CustomerMemorySeedProjection;
  readonly badges?:readonly CustomerMemoryBadgeProjection[];
  readonly coupons?:readonly CustomerMemoryCouponProjection[];
}

export interface CustomerQuoteSnapshot {
  readonly quoteId:string;
  readonly revision:string;
  readonly currency:string;
  readonly totalMinor:number;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'MATERIAL_CHANGE'|'UNKNOWN';
}

export type CustomerPaymentMethod='PAY_AT_STORE'|'ELECTRONIC';
export type CustomerPaymentChannelId=string;

export interface CustomerPaymentChannel{
  readonly channelId:CustomerPaymentChannelId;
  readonly label:string;
  readonly qrImageUrl?:string;
}

export interface CustomerPaymentEvidenceDraft {
  readonly fileName:string;
  readonly mimeType:string;
  readonly size:number;
  readonly state:'LOCAL_PENDING_UPLOAD'|'UPLOADED'|'VERIFIED'|'REJECTED';
  readonly evidenceRef?:string;
}

export interface CustomerCheckoutDraft {
  readonly name:string;
  readonly phone:string;
  readonly paymentMethod:CustomerPaymentMethod;
  readonly paymentChannelId?:CustomerPaymentChannelId;
  readonly paymentChannelLabel?:string;
  readonly paymentEvidence?:CustomerPaymentEvidenceDraft;
}

export interface CustomerPendingIntent {
  readonly submissionId:string;
  readonly menuRevision:string;
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

export interface CustomerWhatsAppFallback {
  readonly enabled:boolean;
  readonly phone:string;
  readonly template:string;
  readonly retryAttempts:number;
}

export interface CustomerReadModelSnapshot {
  readonly store?:CustomerStoreContext;
  readonly menu?:CustomerMenuSnapshot;
  readonly activeOrders:readonly CustomerOrderProjection[];
  readonly history:readonly CustomerHistoryProjection[];
  readonly paymentChannels?:readonly CustomerPaymentChannel[];
  readonly fallback?:CustomerWhatsAppFallback;
  readonly member?:CustomerMemberProjection;
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
  probeOrderBackend?():Promise<Readonly<{reachable:boolean;attempts:number;reason?:string}>>;
  requestFallback?():Promise<CustomerCommandResult>;
  uploadPaymentEvidence?(file:File):Promise<{readonly evidenceRef:string}>;
}
