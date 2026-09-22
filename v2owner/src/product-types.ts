export type OwnerConnectionState='NOT_CONNECTED'|'LOADING'|'READY'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';
export type OwnerCertainty='CONFIRMED'|'PARTIAL'|'UNKNOWN';
export type OwnerActionState='CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN'|'NOT_CONNECTED';

export interface OwnerStoreContext {
  readonly storeId:string;
  readonly storeName:string;
  readonly businessDate:string;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'PARTIAL'|'UNKNOWN';
}

export interface OwnerTodaySummary {
  readonly salesLabel:string;
  readonly orderCount:number;
  readonly averageOrderLabel:string;
  readonly comparisonLabel:string;
  readonly staffNow:number;
  readonly attentionCount:number;
}

export interface OwnerReadinessItem {
  readonly id:string;
  readonly label:string;
  readonly value:string;
  readonly tone:'GOOD'|'WARN'|'CRITICAL'|'UNKNOWN';
  readonly observedAt:string;
}

export interface OwnerActionItem {
  readonly actionId:string;
  readonly severity:'URGENT'|'ATTENTION'|'INFO';
  readonly domain:string;
  readonly title:string;
  readonly detail:string;
  readonly target:string;
  readonly certainty:OwnerCertainty;
  readonly actionLabel?:string;
  readonly observedAt:string;
}

export interface OwnerOrderProjection {
  readonly orderId:string;
  readonly displayCode:string;
  readonly source:string;
  readonly lifecycle:string;
  readonly amountLabel?:string;
  readonly tenderLabel?:string;
  readonly fulfillmentLabel?:string;
  readonly externalRef?:string;
  readonly itemSummary:string;
  readonly readback:OwnerCertainty;
  readonly observedAt:string;
  readonly prints:readonly string[];
  readonly exceptions:readonly string[];
  readonly timeline:readonly string[];
}

export interface OwnerChannelHealth {
  readonly channelId:string;
  readonly name:string;
  readonly desired:string;
  readonly observed:string;
  readonly health:'HEALTHY'|'DEGRADED'|'OFFLINE'|'UNKNOWN';
  readonly freshness:string;
  readonly observedAt:string;
}

export interface OwnerSellabilityItem {
  readonly targetId:string;
  readonly name:string;
  readonly grain:string;
  readonly state:string;
  readonly scope:string;
}

export interface OwnerStaffPresence {
  readonly staffId:string;
  readonly name:string;
  readonly role:string;
  readonly presence:string;
  readonly schedule?:string;
  readonly permissions:string;
}

export interface OwnerDeviceHealth {
  readonly deviceId:string;
  readonly name:string;
  readonly kind:string;
  readonly health:'HEALTHY'|'DEGRADED'|'OFFLINE'|'UNKNOWN';
  readonly lastSeen?:string;
  readonly binding?:string;
  readonly jobs?:string;
  readonly affected?:string;
}

export interface OwnerReportCard {
  readonly reportId:string;
  readonly name:string;
  readonly value:string;
  readonly compare?:string;
  readonly freshness:string;
}

export interface OwnerCustomerSummary {
  readonly totalLabel:string;
  readonly newLabel:string;
  readonly returningLabel:string;
  readonly consentLabel:string;
  readonly experienceLabel?:string;
}

export interface OwnerCampaignSummary {
  readonly campaignId:string;
  readonly name:string;
  readonly attributedOrdersLabel:string;
  readonly attributedSalesLabel:string;
  readonly fundingLabel?:string;
  readonly freshness:string;
}

export interface OwnerSettlementSummary {
  readonly channel:string;
  readonly salesLabel:string;
  readonly feesLabel:string;
  readonly payoutLabel:string;
  readonly finality:string;
  readonly differenceLabel?:string;
}

export interface OwnerCashSummary {
  readonly expectedLabel:string;
  readonly actualLabel:string;
  readonly varianceLabel:string;
  readonly closeoutState:string;
  readonly observedAt:string;
}

export interface OwnerInventoryAttention {
  readonly itemId:string;
  readonly name:string;
  readonly state:'LOW'|'COUNT_REQUIRED'|'WASTE_ATTENTION'|'NORMAL'|'UNKNOWN';
  readonly detail:string;
}

export interface OwnerNotification {
  readonly notificationId:string;
  readonly cadence:'IMMEDIATE'|'DIGEST'|'INBOX';
  readonly title:string;
  readonly detail:string;
  readonly state:string;
  readonly observedAt:string;
}

export interface OwnerActivityRecord {
  readonly activityId:string;
  readonly title:string;
  readonly actor:string;
  readonly requester?:string;
  readonly approver?:string;
  readonly result:string;
  readonly readback?:string;
  readonly observedAt:string;
}

export interface OwnerReadModelSnapshot {
  readonly store?:OwnerStoreContext;
  readonly today?:OwnerTodaySummary;
  readonly readiness:readonly OwnerReadinessItem[];
  readonly actions:readonly OwnerActionItem[];
  readonly orders:readonly OwnerOrderProjection[];
  readonly channels:readonly OwnerChannelHealth[];
  readonly sellability:readonly OwnerSellabilityItem[];
  readonly staff:readonly OwnerStaffPresence[];
  readonly devices:readonly OwnerDeviceHealth[];
  readonly reports:readonly OwnerReportCard[];
  readonly customers?:OwnerCustomerSummary;
  readonly campaigns:readonly OwnerCampaignSummary[];
  readonly settlements:readonly OwnerSettlementSummary[];
  readonly cash?:OwnerCashSummary;
  readonly inventory:readonly OwnerInventoryAttention[];
  readonly notifications:readonly OwnerNotification[];
  readonly activity:readonly OwnerActivityRecord[];
  readonly adminLinkLabel?:string;
  readonly observedAt:string;
}

export interface OwnerCommandResult {
  readonly state:OwnerActionState;
  readonly message:string;
  readonly readback?:string;
}

export interface OwnerBoundedAction {
  readonly actionType:string;
  readonly target:string;
  readonly reason:string;
  readonly operationId:string;
}

export interface OwnerRuntimePort {
  readonly portId:'MFK_OWNER_PORT_V1';
  readSnapshot():Promise<OwnerReadModelSnapshot>;
  requestBoundedAction?(input:OwnerBoundedAction):Promise<OwnerCommandResult>;
  requestAdminDeepLink?():Promise<OwnerCommandResult>;
}
