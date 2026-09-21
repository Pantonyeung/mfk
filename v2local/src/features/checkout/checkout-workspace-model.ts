export type CheckoutChannelId='walk-in'|'phone'|'app'|'keeta'|'foodpanda';
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
  readonly id:string;
  readonly label:string;
  readonly enabled:boolean;
  readonly selected:boolean;
}

export interface CheckoutWorkspaceViewModel {
  readonly order:CheckoutOrderViewModel;
  readonly channels:readonly CheckoutChannelViewModel[];
  readonly methods:readonly CheckoutPaymentMethodViewModel[];
  readonly amount:{readonly dueLabel:string;readonly receivedLabel:string;readonly changeLabel:string};
  readonly cashInput:string;
  readonly exactCashEnabled:boolean;
  readonly confirmEnabled:boolean;
  readonly paymentState:CheckoutPaymentState;
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
  readonly onSelectMethod:(methodId:string)=>void;
  readonly onCashKey:(key:string)=>void;
  readonly onExactCash:()=>void;
  readonly onConfirm:()=>void;
  readonly onRetry:()=>void;
  readonly onDone:()=>void;
}
