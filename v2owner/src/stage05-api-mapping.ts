export const OWNER_STAGE05_API_MAPPING=Object.freeze({
  stage:'OA-PLN-001',
  route:'/planning',
  targetInput:'LOCAL_NON_AUTHORITATIVE_PLANNING',
  costInputs:Object.freeze(['屋租','水','電','煤氣','人工','其他']),
  salesSource:'OwnerReadModelSnapshot.planningBasis.currentEffectiveSalesMtdMinor',
  salesMetric:'CURRENT_EFFECTIVE_SALES',
  calculations:Object.freeze({
    mtd:'READ_CANONICAL_CURRENT_EFFECTIVE_SALES_MTD_PROJECTION',
    remaining:'MAX_TARGET_MINUS_MTD_ZERO',
    attainment:'MTD_DIV_TARGET',
    dailyNeeded:'REMAINING_DIV_REMAINING_CALENDAR_DAYS_INCLUSIVE',
    projectedTargetTime:'CURRENT_MTD_CALENDAR_DAY_AVERAGE_PACE',
    estimatedOperatingProfit:'MTD_MINUS_ACTUAL_TO_DATE_COSTS_ENTERED',
  }),
  invariants:Object.freeze([
    'NO_ORDER_RECALCULATION',
    'NO_PRICE_RECALCULATION',
    'NO_SECOND_REPORTING_AUTHORITY',
    'PLANNED_COSTS_NE_ACTUAL_TO_DATE_COSTS',
    'INCOMPLETE_COSTS_MUST_LABEL_PROFIT_AS_ESTIMATE_BY_ENTERED_COSTS',
    'NO_ACCOUNTING_FINALITY_CLAIM',
  ]),
} as const);
