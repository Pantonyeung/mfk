export type CheckoutChannelId='walk-in'|'whatsapp'|'morefun-app'|'keeta'|'foodpanda';
export type CheckoutTenderId='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME'|'COMBO';
export type CheckoutPaymentState='selected'|'processing'|'success'|'failure';
export type CheckoutSettlementMode='LOCAL_PAYMENT'|'CHANNEL_INFO';
export type CheckoutChannelFieldId='customerPhone'|'platformOrderNo'|'pickupCode';

export interface CheckoutOrderLineViewModel {
  readonly id:string;
  readonly name:string;
  readonly detail?:string;
  readonly quantity:number;
  readonly lineTotalLabel:string;
}

export interface CheckoutOrderViewModel {
  readonly orderId:string;
  readonly lines:readonly CheckoutOrderLineViewModel[];
  readonly subtotalLabel:string;
  readonly packagingLabel:string;
  readonly discountLabel:string;
  readonly totalLabel:string;
}

// DINING_REAL_CHECKOUT_R3
export interface CheckoutChannelViewModel {
  readonly enabled?:boolean;
  readonly id:CheckoutChannelId;
  readonly label:string;
  readonly selected:boolean;
  readonly helperLabel?:string;
}

export interface CheckoutPaymentMethodViewModel {
  readonly id:CheckoutTenderId;
  readonly label:string;
  readonly enabled:boolean;
  readonly selected:boolean;
}

export interface CheckoutSplitTenderViewModel {
  readonly id:Exclude<CheckoutTenderId,'COMBO'>;
  readonly label:string;
  readonly amount:string;
}

export interface CheckoutWorkspaceViewModel {
  readonly order:CheckoutOrderViewModel;
  readonly channels:readonly CheckoutChannelViewModel[];
  readonly methods:readonly CheckoutPaymentMethodViewModel[];
  readonly settlementMode:CheckoutSettlementMode;
  readonly selectedMethodLabel:string;
  readonly amount:{readonly dueLabel:string;readonly receivedLabel:string;readonly changeLabel:string};
  readonly cashInput:string;
  readonly cashEntryVisible:boolean;
  readonly exactCashEnabled:boolean;
  readonly confirmEnabled:boolean;
  readonly paymentState:CheckoutPaymentState;
  readonly channelInfo:{
    readonly title:string;
    readonly helperLabel?:string;
    readonly fields:readonly {
      readonly id:CheckoutChannelFieldId;
      readonly label:string;
      readonly placeholder:string;
      readonly value:string;
      readonly required:boolean;
    }[];
  };
  readonly comboMode:boolean;
  readonly splitTenders:readonly CheckoutSplitTenderViewModel[];
  readonly statusMessage?:string;
  readonly validationMessage?:string;
  readonly failureMessage?:string;
  readonly completionReview?:{
    readonly heading?:string;
    readonly helperLabel?:string;
    readonly orderId?:string;
    readonly displayOrderCode:string;
    readonly sourceLabel:string;
    readonly tenderLabel:string;
    readonly dueLabel:string;
    readonly receivedLabel?:string;
    readonly changeLabel?:string;
    readonly statusLabel:string;
    readonly printStatusLabel:string;
    readonly drawerStatusLabel:string;
    readonly canCorrectPayment:boolean;
    readonly correctionMethods:readonly CheckoutPaymentMethodViewModel[];
  };
}

export interface CheckoutWorkspaceActions {
  readonly onBack:()=>void;
  readonly onSelectChannel:(channelId:CheckoutChannelId)=>void;
  readonly onSelectMethod:(methodId:CheckoutTenderId)=>void;
  readonly onChangeChannelInfo:(fieldId:CheckoutChannelFieldId,value:string)=>void;
  readonly onChangeSplitAmount:(methodId:Exclude<CheckoutTenderId,'COMBO'>,value:string)=>void;
  readonly onCashKey:(key:string)=>void;
  readonly onQuickCash:(amount:number)=>void;
  readonly onExactCash:()=>void;
  readonly onConfirm:()=>void;
  readonly onRetry:()=>void;
  readonly onCorrectPayment:(methodId:CheckoutTenderId)=>void;
  readonly onDone:()=>void;
}
