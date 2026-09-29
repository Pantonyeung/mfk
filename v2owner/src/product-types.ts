export type OwnerGlobalState='LOADING'|'EMPTY'|'FRESH'|'STALE'|'PARTIAL'|'OFFLINE_READONLY'|'PERMISSION_DENIED'|'ERROR'|'UNKNOWN';
export type OwnerConnectionState=OwnerGlobalState;
export type OwnerCertainty='CONFIRMED'|'PARTIAL'|'UNKNOWN';
export type OwnerActionState='CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN'|'NOT_CONNECTED';

export interface OwnerStoreContext {
  readonly storeId:string;
  readonly storeName:string;
  readonly businessDate:string;
  readonly operatingStatus:string;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'PARTIAL'|'UNKNOWN';
}

export interface OwnerTodaySummary {
  readonly salesLabel:string;
  readonly orderCount:number;
  readonly averageOrderLabel:string;
  readonly comparisonLabel:string;
  readonly staffNow?:number;
  readonly scheduledStaffCount?:number;
  readonly onBreakStaffCount?:number;
  readonly abnormalStaffCount?:number;
  readonly attentionCount?:number;
}

export interface OwnerLiveOrderSummaryItem {
  readonly orderId:string;
  readonly displayCode:string;
  readonly source:string;
  readonly amountLabel?:string;
  readonly fulfillmentLabel:string;
  readonly elapsedLabel?:string;
  readonly promisedTimeLabel?:string;
  readonly exceptionBadge?:string;
  readonly hasAttention?:boolean;
}

export interface OwnerLiveOrdersSummary {
  readonly activeCount:number;
  readonly attentionCount?:number;
  readonly readyCount:number;
  readonly recentOrders:readonly OwnerLiveOrderSummaryItem[];
  readonly observedAt:string;
}

export type OwnerDineInPaymentState='UNPAID'|'PARTIAL'|'SETTLED';

export interface OwnerDineInOpenCheck {
  readonly checkId:string;
  readonly displayCode?:string;
  readonly tableLabel:string;
  readonly openedAt:string;
  readonly guestCount?:number;
  readonly currentOrderTotalLabel:string;
  readonly confirmedPaidLabel:string;
  readonly outstandingLabel:string;
  readonly paymentState:OwnerDineInPaymentState;
}

export interface OwnerDineInSummary {
  readonly activeCheckCount:number;
  readonly unpaidCheckCount:number;
  readonly estimatedOpenAmountLabel:string;
  readonly oldestOpenAgeLabel?:string;
  readonly openChecks:readonly OwnerDineInOpenCheck[];
  readonly includedInEffectiveSales:false;
  readonly observedAt:string;
}

export type OwnerHealthKind='INTERNET'|'KEETA'|'OWN_PLATFORM'|'SMT'|'PRINTER'|'OTHER';

export interface OwnerReadinessItem {
  readonly id:string;
  readonly kind?:OwnerHealthKind;
  readonly label:string;
  readonly value:string;
  readonly tone:'GOOD'|'WARN'|'CRITICAL'|'UNKNOWN';
  readonly observedAt:string;
}

export interface OwnerActionItem {
  readonly actionId:string;
  readonly severity:'URGENT'|'ATTENTION'|'INFO';
  readonly domain:string;
  readonly ownerDomain?:string;
  readonly title:string;
  readonly detail:string;
  readonly target:string;
  readonly certainty:OwnerCertainty;
  readonly actionLabel?:string;
  readonly safeNextStepLabel?:string;
  readonly elapsedLabel?:string;
  readonly state?:'OPEN'|'PENDING_READBACK'|'RESOLVED'|'UNKNOWN';
  readonly readbackSummary?:string;
  readonly resolutionProofLabel?:string;
  readonly correlationId?:string;
  readonly incidentId?:string;
  readonly observedAt:string;
}

export interface OwnerOrderItemLine {
  readonly lineId:string;
  readonly name:string;
  readonly quantity:number;
  readonly optionLabels?:readonly string[];
  readonly modifierLabels?:readonly string[];
  readonly remark?:string;
  readonly amountLabel?:string;
}

export interface OwnerOrderAdjustment {
  readonly label:string;
  readonly amountLabel:string;
}

export interface OwnerOrderFulfillmentEvent {
  readonly label:string;
  readonly atLabel?:string;
  readonly state?:string;
}

export interface OwnerOrderSideEffects {
  readonly receipt?:string;
  readonly production?:string;
  readonly packing?:string;
  readonly label?:string;
}

export interface OwnerOrderAuditEvent {
  readonly title:string;
  readonly actorLabel?:string;
  readonly atLabel:string;
  readonly resultLabel?:string;
}

export type OwnerCanonicalFulfillmentState='待處理'|'進行中'|'可取餐'|'已完成'|'已取消';

export interface OwnerOrderProjection {
  readonly orderId:string;
  readonly displayCode:string;
  readonly source:string;
  readonly lifecycle:string;
  readonly workflowStatusLabel?:string;
  readonly businessDate?:string;
  readonly customerName?:string;
  readonly customerPhone?:string;
  readonly amountLabel?:string;
  readonly originalAmountLabel?:string;
  readonly adjustmentAmountLabel?:string;
  readonly currentEffectiveAmountLabel?:string;
  readonly referenceValueLabel?:string;
  readonly effectiveTransactionLabel?:string;
  readonly pricingAuthority?:string;
  readonly printState?:'PENDING'|'DONE'|'UNKNOWN';
  readonly tenderLabel?:string;
  readonly currentTenderLabel?:string;
  readonly paymentState?:'OPEN'|'PARTIAL'|'SETTLED'|string;
  readonly fulfillmentLabel?:OwnerCanonicalFulfillmentState;
  readonly fulfillmentMode?:'DINE_IN'|'TAKEAWAY'|'PICKUP'|'DELIVERY'|string;
  readonly elapsedLabel?:string;
  readonly promisedTimeLabel?:string;
  readonly externalProvider?:string;
  readonly externalRef?:string;
  readonly externalCancelRequestLabel?:string;
  readonly itemSummary:string;
  readonly itemLines?:readonly OwnerOrderItemLine[];
  readonly orderRemark?:string;
  readonly adjustments?:readonly OwnerOrderAdjustment[];
  readonly fulfillmentHistory?:readonly OwnerOrderFulfillmentEvent[];
  readonly sideEffects?:OwnerOrderSideEffects;
  readonly exceptionBadges?:readonly string[];
  readonly auditTrail?:readonly OwnerOrderAuditEvent[];
  readonly readback:OwnerCertainty;
  readonly observedAt:string;
  readonly prints:readonly string[];
  readonly exceptions:readonly string[];
  readonly timeline:readonly string[];
}

export type OwnerChannelMode='NORMAL'|'BUSY'|'SNOOZED'|'PAUSED'|'CLOSED';
export type OwnerChannelCause='manual'|'schedule'|'internet'|'integration'|'provider'|'platform_suspension'|'policy';

export interface OwnerChannelLastCommand {
  readonly action:'PAUSE'|'RESUME'|'SNOOZE'|'BUSY';
  readonly state:'CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN'|'IDEMPOTENT';
  readonly requestedAt?:string;
  readonly completedAt?:string;
}

export interface OwnerChannelHealth {
  readonly channelId:string;
  readonly name:string;
  readonly acceptingOrders:boolean|null;
  readonly desiredState:string;
  readonly observedState:string;
  readonly health:'HEALTHY'|'DEGRADED'|'OFFLINE'|'UNKNOWN';
  readonly mode:OwnerChannelMode;
  readonly cause:OwnerChannelCause;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'PARTIAL'|'UNKNOWN';
  readonly lastCommand?:OwnerChannelLastCommand;
  readonly readback:'CONFIRMED'|'PARTIAL'|'UNKNOWN';
  readonly recentOrderDiagnostics?:readonly {readonly providerOrderId:string;readonly canonicalDisplay:string|null;readonly state:string;readonly mappingState:string;readonly ackState:string;readonly commercialState:string|null;readonly providerConfirmState:string|null;readonly providerReadyState:string|null;readonly receivedAt:string}[];
  readonly controls:Readonly<{
    pause:boolean;
    resume:boolean;
    snooze:boolean;
    busy:boolean;
  }>;
}


export type OwnerCostCategory='RENT'|'UTILITIES_WATER'|'UTILITIES_ELECTRICITY'|'UTILITIES_GAS'|'LABOR'|'OTHER'|'CUSTOM';
export type OwnerCostCoverage='COMPLETE'|'PARTIAL'|'MANUAL_ESTIMATE';

export interface OwnerMonthlyCostLine {
  readonly costLineId:string;
  readonly category:OwnerCostCategory;
  readonly label:string;
  readonly plannedMonthlyMinor:number;
  readonly actualToDateMinor?:number;
  readonly note?:string;
  readonly updatedAt:string;
  readonly updatedBy:string;
}

export interface OwnerMonthlyPlan {
  readonly schema:'MFK_OWNER_MONTHLY_PLAN_V1';
  readonly storeId:string;
  readonly monthKey:string;
  readonly monthlyRevenueTargetMinor:number;
  readonly note?:string;
  readonly revision:number;
  readonly updatedAt:string;
  readonly updatedBy:string;
  readonly costLines:readonly OwnerMonthlyCostLine[];
}

export interface OwnerPlanningMetrics {
  readonly currentEffectiveSalesMinor:number;
  readonly monthlyRevenueTargetMinor:number;
  readonly achievementPercent:number;
  readonly remainingMinor:number;
  readonly remainingCalendarDays:number;
  readonly remainingOperatingDays?:number;
  readonly requiredDailyAverageMinor:number;
  readonly actualDailyAverageMinor:number;
  readonly paceState:'ON_TRACK'|'ATTENTION'|'TARGET_REACHED';
  readonly monthlyPlannedCostMinor:number;
  readonly targetOperatingSurplusMinor:number;
  readonly actualToDateCostMinor:number;
  readonly actualCostAvailable:boolean;
  readonly estimatedOperatingProfitToDateMinor?:number;
  readonly costCoverage:OwnerCostCoverage;
  readonly forecastTargetDate?:string;
  readonly forecastLabel?:'預計';
  readonly salesSource:'CURRENT_EFFECTIVE_SALES';
}

export interface OwnerPlanningSnapshot {
  readonly plan:OwnerMonthlyPlan;
  readonly metrics:OwnerPlanningMetrics;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'PARTIAL'|'UNKNOWN';
  readonly readback:'CONFIRMED'|'PARTIAL'|'UNKNOWN';
}

export interface OwnerPlanningSaveInput {
  readonly monthKey:string;
  readonly monthlyRevenueTargetMinor:number;
  readonly note?:string;
  readonly expectedRevision:number;
  readonly operationId:string;
  readonly costLines:readonly {
    readonly costLineId:string;
    readonly category:OwnerCostCategory;
    readonly label:string;
    readonly plannedMonthlyMinor:number;
    readonly actualToDateMinor?:number;
    readonly note?:string;
  }[];
}

export interface OwnerPlanningCommandResult {
  readonly state:'CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN';
  readonly message:string;
  readonly snapshot?:OwnerPlanningSnapshot;
  readonly readback?:string;
}

export interface OwnerChannelCommandInput {
  readonly channelId:string;
  readonly action:'PAUSE'|'RESUME'|'SNOOZE'|'BUSY';
  readonly operationId:string;
  readonly snoozeUntil?:string;
  readonly extraPrepMinutes?:number;
}

export interface OwnerChannelCommandResult {
  readonly state:'CONFIRMED'|'REJECTED'|'FAILED'|'UNKNOWN';
  readonly message:string;
  readonly channel?:OwnerChannelHealth;
  readonly readback?:string;
}

export type OwnerSellabilityGrain='PRODUCT'|'OPTION'|'MODIFIER'|'COMBO_CHILD';
export type OwnerSellabilityScope='ALL'|'ONLINE_ONLY';
export type OwnerSellabilityReadback='CONFIRMED'|'PARTIAL'|'UNKNOWN';

export interface OwnerSellabilityItem {
  readonly targetId:string;
  readonly name:string;
  readonly grain:OwnerSellabilityGrain;
  readonly state:'SELLABLE'|'SOLD_OUT'|'UNKNOWN';
  readonly scope:OwnerSellabilityScope;
  readonly restoreAt?:string;
  readonly quantity?:number;
  readonly observedAt:string;
  readonly readback:OwnerSellabilityReadback;
}

export interface OwnerSellabilityCommandTarget {
  readonly targetId:string;
  readonly grain:OwnerSellabilityGrain;
}

export interface OwnerSellabilityCommandInput {
  readonly operationId:string;
  readonly action:'SOLD_OUT'|'RESTORE';
  readonly scope:OwnerSellabilityScope;
  readonly targets:readonly OwnerSellabilityCommandTarget[];
  readonly restoreAt?:string;
  readonly reason?:string;
}

export interface OwnerSellabilityTargetResult {
  readonly targetId:string;
  readonly grain:OwnerSellabilityGrain;
  readonly state:'CONFIRMED'|'REJECTED'|'UNKNOWN';
  readonly readback?:OwnerSellabilityItem;
  readonly message:string;
}

export interface OwnerSellabilityCommandResult {
  readonly state:'CONFIRMED'|'PARTIAL'|'UNKNOWN';
  readonly message:string;
  readonly revision?:number;
  readonly targets:readonly OwnerSellabilityTargetResult[];
}

export interface OwnerStaffPresence {
  readonly staffId:string;
  readonly loginId?:string;
  readonly name:string;
  readonly role:string;
  readonly presence:string;
  readonly schedule?:string;
  readonly capabilitySummary?:string;
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

export interface OwnerTodayInsight {
  readonly topProductLabel?:string;
  readonly currentHourTrendLabel?:string;
  readonly observedAt:string;
  readonly freshness:'CURRENT'|'STALE'|'PARTIAL'|'UNKNOWN';
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
  readonly actorStaffId?:string;
  readonly target?:string;
  readonly correlationId?:string;
  readonly incidentId?:string;
  readonly linkedActionId?:string;
  readonly detail?:string;
  readonly requester?:string;
  readonly requesterStaffId?:string;
  readonly approver?:string;
  readonly approverStaffId?:string;
  readonly result:string;
  readonly readback?:string;
  readonly observedAt:string;
}

export interface OwnerReadModelSnapshot {
  readonly globalState?:OwnerGlobalState;
  readonly store?:OwnerStoreContext;
  readonly today?:OwnerTodaySummary;
  readonly planning?:OwnerPlanningSnapshot;
  readonly insight?:OwnerTodayInsight;
  readonly liveOrders?:OwnerLiveOrdersSummary;
  readonly dineIn?:OwnerDineInSummary;
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

export interface OwnerAuthSession {
  readonly staffId:string;
  readonly loginId:string;
  readonly displayName:string;
  readonly role:'OWNER';
  readonly scope:string;
  readonly permissions:readonly string[];
  readonly sessionToken:string;
  readonly expiresAt?:string;
}

export interface OwnerRuntimePort {
  readonly portId:'MFK_OWNER_PORT_V1';
  readSnapshot():Promise<OwnerReadModelSnapshot>;
  readOwnerSession?():Promise<OwnerAuthSession|null>;
  loginOwner?(loginId:string,pin:string):Promise<OwnerAuthSession>;
  logoutOwner?():Promise<void>;
  requestBoundedAction?(input:OwnerBoundedAction):Promise<OwnerCommandResult>;
  readChannels?():Promise<readonly OwnerChannelHealth[]>;
  readPlanning?(monthKey:string):Promise<OwnerPlanningSnapshot>;
  savePlanning?(input:OwnerPlanningSaveInput):Promise<OwnerPlanningCommandResult>;
  readSellability?():Promise<readonly OwnerSellabilityItem[]>;
  commandSellability?(input:OwnerSellabilityCommandInput):Promise<OwnerSellabilityCommandResult>;
  requestAdminDeepLink?():Promise<OwnerCommandResult>;
}
