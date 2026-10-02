export type SmmConnectionState='NOT_CONNECTED'|'LOADING'|'READY'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';
export type SmmCommandState='CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN'|'NOT_CONNECTED';
export type SmmBusinessDayState='OPEN'|'CLOSED'|'UNKNOWN';

export interface SmmCategory {
  readonly categoryId:string;
  readonly name:string;
  readonly sortOrder:number;
}

export interface SmmOption {
  readonly optionId:string;
  readonly name:string;
  readonly available:boolean;
  readonly publishedAdjustmentMinor?:number;
}

export interface SmmOptionGroup {
  readonly optionGroupId:string;
  readonly name:string;
  readonly required:boolean;
  readonly minSelections:number;
  readonly maxSelections:number;
  readonly options:readonly SmmOption[];
}

export interface SmmVariation {
  readonly variationId:string;
  readonly name:string;
  readonly available:boolean;
}


export type SmmComboChoiceType='PRODUCT'|'LABEL'|'NONE';

export interface SmmComboChoice {
  readonly choiceId:string;
  readonly choiceType:SmmComboChoiceType;
  readonly productId?:string;
  readonly label:string;
  readonly available:boolean;
  readonly publishedAdjustmentMinor:number;
}

export interface SmmComboSubPool {
  readonly subPoolId:string;
  readonly name:string;
  readonly publishedAdjustmentMinor:number;
  readonly choices:readonly SmmComboChoice[];
}

export interface SmmComboGroup {
  readonly groupId:string;
  readonly name:string;
  readonly required:boolean;
  readonly minSelections:number;
  readonly maxSelections:number;
  readonly subPools:readonly SmmComboSubPool[];
}

export interface SmmComboPool {
  readonly poolId:string;
  readonly name:string;
  readonly kind:'MAIN_COURSE'|'ADDON';
  readonly addonKind?:'SNACK'|'DRINK';
  readonly groups:readonly SmmComboGroup[];
}

export interface SmmCombo {
  readonly comboId:string;
  readonly name:string;
  readonly publishedBasePriceMinor:number;
  readonly mainPoolId?:string;
  readonly addonPoolIds:readonly string[];
}

export interface SmmCartComboSelection {
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
  readonly choiceType:SmmComboChoiceType;
  readonly choiceLabel:string;
  readonly productId?:string;
  readonly publishedAdjustmentMinor:number;
}

export interface SmmCartComboIntent {
  readonly comboId:string;
  readonly comboName:string;
  readonly publishedBasePriceMinor:number;
  readonly selections:readonly SmmCartComboSelection[];
}

export interface SmmProduct {
  readonly productId:string;
  readonly categoryId:string;
  readonly name:string;
  readonly description?:string;
  readonly imageRef?:string;
  readonly available:boolean;
  readonly publishedTakeawayUnitPriceMinor?:number;
  readonly publishedDineInUnitPriceMinor?:number;
  readonly variationRequired?:boolean;
  readonly variations?:readonly SmmVariation[];
  readonly optionGroups:readonly SmmOptionGroup[];
  readonly comboId?:string;
}

export interface SmmMenuSnapshot {
  readonly revision:string;
  readonly observedAt:string;
  readonly categories:readonly SmmCategory[];
  readonly products:readonly SmmProduct[];
  readonly combos?:readonly SmmCombo[];
  readonly comboPools?:readonly SmmComboPool[];
}

export interface SmmQuoteLine {
  readonly lineId:string;
  readonly currency:string;
  readonly finalUnitPriceMinor:number;
  readonly lineTotalMinor:number;
}

export interface SmmQuoteSnapshot {
  readonly quoteId:string;
  readonly revision:string;
  readonly currency:string;
  readonly totalMinor:number;
  readonly lines:readonly SmmQuoteLine[];
  readonly observedAt:string;
}

export interface SmmCartSelection {
  readonly optionGroupId:string;
  readonly optionId:string;
  readonly optionName:string;
  readonly publishedAdjustmentMinor?:number;
}

export type SmmCartRefreshKind='PRICE_CHANGED'|'CONFIG_CHANGED';

export interface SmmCartRefreshAttention {
  readonly kind:SmmCartRefreshKind;
  readonly menuRevision:string;
  readonly oldPublishedUnitPriceMinor?:number;
  readonly proposedPublishedUnitPriceMinor?:number;
  readonly proposedSelections?:readonly SmmCartSelection[];
  readonly proposedCombo?:SmmCartComboIntent;
  readonly canAccept:boolean;
  readonly detectedAt:string;
}

export interface SmmCartLine {
  readonly lineId:string;
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly selectedVariationId?:string;
  readonly selectedVariationName?:string;
  readonly selections:readonly SmmCartSelection[];
  readonly combo?:SmmCartComboIntent;
  readonly publishedUnitPriceMinor?:number;
  readonly refreshAttention?:SmmCartRefreshAttention;
  readonly createdAt:string;
}

export type SmmServiceMode='TAKEAWAY'|'DINE_IN';
export type SmmTender='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME';

export interface SmmDiningTarget{
  readonly kind:'TABLE'|'WAITING';
  readonly tableId?:string;
  readonly covers:number;
}

export interface SmmStaffCheckout {
  readonly serviceMode:SmmServiceMode;
  readonly tender?:SmmTender;
  readonly diningTarget?:SmmDiningTarget;
}

export interface SmmPendingIntent {
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly createdAt:string;
  readonly updatedAt:string;
  readonly state:'DRAFT'|'NOT_CONNECTED'|'PENDING'|'REJECTED'|'UNKNOWN';
  readonly menuRevision:string;
  readonly publishedTotalMinor:number;
  readonly checkout:SmmStaffCheckout;
  readonly cart:readonly SmmCartLine[];
  readonly lastMessage?:string;
}

export interface SmmOrderTimelineItem {
  readonly at:string;
  readonly label:string;
  readonly detail?:string;
}

export interface SmmOrderProjection {
  readonly orderId:string;
  readonly displayCode:string;
  readonly source:string;
  readonly lifecycle:string;
  readonly amountLabel?:string;
  readonly itemSummary:string;
  readonly observedAt:string;
  readonly readback:'CONFIRMED'|'PARTIAL'|'UNKNOWN';
  readonly note?:string;
  readonly timeline:readonly SmmOrderTimelineItem[];

  /** Optional canonical Stage 7 presentation fields. */
  readonly orderTime?:string;
  readonly itemCount?:number;
  readonly sourceGroup?:'ONSITE'|'SMM'|'OWN_PLATFORM'|'THIRD_PARTY';
  readonly effectiveAmountLabel?:string;
  readonly tenderLabel?:string;
  readonly fulfillmentLabel?:string;
  readonly eta?:string;
  readonly externalRef?:string;
  readonly customerName?:string;
  readonly customerPhone?:string;
  readonly customerPhonePermitted?:boolean;
  readonly items?:readonly {
    readonly quantity:number;
    readonly name:string;
    readonly detail?:string;
    readonly amountLabel?:string;
    readonly remark?:string;
  }[];
}

export interface SmmWorkItem {
  readonly workId:string;
  readonly orderId?:string;
  readonly displayCode?:string;
  readonly kind:string;
  readonly summary:string;
  readonly eta?:string;
  readonly state:'NORMAL'|'DELAYED'|'ACTION_REQUIRED'|'UNKNOWN';
  readonly observedAt:string;

  /** Optional canonical projection fields for Stage 6 presentation only. */
  readonly source?:string;
  readonly orderTime?:string;
  readonly itemCount?:number;
  readonly serviceMode?:SmmServiceMode;
  readonly statusLabel?:string;
  readonly customerName?:string;
  readonly customerContact?:string;
  readonly note?:string;
  readonly items?:readonly {
    readonly quantity:number;
    readonly name:string;
    readonly detail?:string;
    readonly amountLabel?:string;
  }[];
}

export interface SmmChannelHealth {
  readonly channel:string;
  readonly state:'CONNECTED'|'STALE'|'DEGRADED'|'OFFLINE'|'UNKNOWN';
  readonly detail:string;
  readonly observedAt:string;
}

export interface SmmDiningTableDefinition{
  readonly tableId:string;
  readonly label:string;
  readonly sortOrder:number;
}

export interface SmmDineSession {
  readonly sessionId:string;
  readonly tableLabel:string;
  readonly covers:number;
  readonly state:string;
  readonly openedAt:string;
  readonly itemSummary?:string;
  readonly totalMinor?:number;
  readonly paidMinor?:number;
  readonly remainingMinor?:number;
  readonly lines?:readonly {
    readonly lineIndex:number;
    readonly name:string;
    readonly qty:number;
    readonly paidQty:number;
    readonly remainingQty:number;
    readonly unitMinor:number;
  }[];
}

export interface SmmRefundRequest {
  readonly refundId:string;
  readonly orderId:string;
  readonly displayCode:string;
  readonly source:string;
  readonly amountLabel?:string;
  readonly reason:string;
  readonly state:'PENDING'|'REVIEWING'|'RESOLVED'|'UNKNOWN';
  readonly observedAt:string;
}

export interface SmmCapacityProjection {
  readonly state:'NORMAL'|'BUSY'|'PAUSED'|'UNKNOWN';
  readonly label:string;
  readonly detail:string;
  readonly observedAt:string;
}

export interface SmmReportingProjection {
  readonly businessDate:string;
  readonly orderCount:number;
  readonly salesLabel:string;
  readonly averageOrderLabel:string;
  readonly freshness:'CURRENT'|'STALE'|'UNKNOWN';
  readonly observedAt:string;
}

export interface SmmPrintHealth {
  readonly logicalPrinterId:string;
  readonly label:string;
  readonly state:'READY'|'DEGRADED'|'OFFLINE'|'UNKNOWN';
  readonly detail:string;
  readonly observedAt:string;
}

export interface SmmStaffContext {
  readonly actorId:string;
  readonly displayName:string;
  readonly roleLabel:string;
  readonly storeId:string;
  readonly deviceLabel?:string;
}

export interface SmmBusinessDayProjection {
  readonly businessDate:string;
  readonly state:SmmBusinessDayState;
  readonly observedAt:string;
  readonly recordOnly:true;
}

export interface SmmReadModelSnapshot {
  readonly connectionPath?:'LAN'|'INTERNET';
  readonly menu?:SmmMenuSnapshot;
  readonly orders:readonly SmmOrderProjection[];
  readonly work:readonly SmmWorkItem[];
  readonly channels:readonly SmmChannelHealth[];
  readonly dineSessions:readonly SmmDineSession[];
  readonly diningTables?:readonly SmmDiningTableDefinition[];
  readonly printHealth:readonly SmmPrintHealth[];
  readonly refundRequests:readonly SmmRefundRequest[];
  readonly capacity?:SmmCapacityProjection;
  readonly reporting?:SmmReportingProjection;
  readonly staff?:SmmStaffContext;
  readonly businessDay?:SmmBusinessDayProjection;
  readonly observedAt:string;
}

export interface SmmCommandResult {
  readonly state:SmmCommandState;
  readonly message:string;
  readonly orderId?:string;
  readonly displayCode?:string;
  readonly canonicalRevision?:number;
}

export interface SmmRuntimePort {
  readonly portId:'MFK_SMM_PORT_V1';
  readSnapshot():Promise<SmmReadModelSnapshot>;
  quoteCart?(cart:readonly SmmCartLine[]):Promise<SmmQuoteSnapshot>;
  submitOrder?(intent:SmmPendingIntent):Promise<SmmCommandResult>;
  readSubmission?(submissionId:string):Promise<SmmCommandResult>;
  fulfillOrder?(input:{orderId:string;action:'ACCEPT'|'READY'}):Promise<SmmCommandResult>;
  setSellability?(input:{productId:string;available:boolean;operationId:string}):Promise<SmmCommandResult>;
  createDineSession?(input:{tableLabel:string;covers:number;operationId:string}):Promise<SmmCommandResult>;
  subscribeConfigChanges?(listener:(headSeq:number)=>void):()=>void;
}
