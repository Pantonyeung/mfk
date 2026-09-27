export type CheckoutChannelId='walk-in'|'whatsapp'|'morefun-app'|'keeta'|'foodpanda';
export type CheckoutTenderId='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME'|'COMBO';
export type CheckoutPaymentState='selected'|'processing'|'success'|'failure';

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

export interface CheckoutChannelViewModel {
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
  readonly selectedMethodLabel:string;
  readonly amount:{readonly dueLabel:string;readonly receivedLabel:string;readonly changeLabel:string};
  readonly cashInput:string;
  readonly cashEntryVisible:boolean;
  readonly exactCashEnabled:boolean;
  readonly confirmEnabled:boolean;
  readonly paymentState:CheckoutPaymentState;
  readonly channelFields:{
    readonly showCustomerPhone:boolean;
    readonly customerPhone:string;
    readonly showPlatformFields:boolean;
    readonly pickupCode:string;
    readonly platformOrderNo:string;
  };
  readonly comboMode:boolean;
  readonly splitTenders:readonly CheckoutSplitTenderViewModel[];
  readonly statusMessage?:string;
  readonly validationMessage?:string;
  readonly failureMessage?:string;
  readonly completionReview?:{
    readonly displayOrderCode:string;
    readonly tenderLabel:string;
    readonly dueLabel:string;
    readonly receivedLabel?:string;
    readonly changeLabel?:string;
    readonly statusLabel:string;
  };
}

export interface CheckoutWorkspaceActions {
  readonly onBack:()=>void;
  readonly onSelectChannel:(channelId:CheckoutChannelId)=>void;
  readonly onSelectMethod:(methodId:CheckoutTenderId)=>void;
  readonly onChangeCustomerPhone:(value:string)=>void;
  readonly onChangePickupCode:(value:string)=>void;
  readonly onChangePlatformOrderNo:(value:string)=>void;
  readonly onChangeSplitAmount:(methodId:Exclude<CheckoutTenderId,'COMBO'>,value:string)=>void;
  readonly onCashKey:(key:string)=>void;
  readonly onQuickCash:(amount:number)=>void;
  readonly onExactCash:()=>void;
  readonly onConfirm:()=>void;
  readonly onRetry:()=>void;
  readonly onDone:()=>void;
}
