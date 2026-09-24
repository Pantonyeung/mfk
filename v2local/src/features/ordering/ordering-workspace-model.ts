export type ServiceMode='takeaway'|'dine-in';

export interface QueueOrderViewModel {
  readonly id:string;
  readonly orderId:string;
  readonly sourceLabel:string;
  readonly waitLabel:string;
  readonly etaLabel?:string;
  readonly itemCount:number;
  readonly demo?:boolean;
}

export interface OrderingCategoryViewModel {
  readonly id:string;
  readonly label:string;
}

export interface OrderingProductViewModel {
  readonly id:string;
  readonly name:string;
  readonly priceLabel:string;
  readonly enabled:boolean;
  readonly requiresOptions:boolean;
  readonly hasRequiredOptions:boolean;
  readonly badge?:string;
  readonly imageUrl?:string;
}

export interface CartLineViewModel {
  readonly id:string;
  readonly name:string;
  readonly quantity:number;
  readonly lineTotalLabel:string;
  readonly serviceMode:ServiceMode;
  readonly groupId:string;
  readonly groupLabel:string;
  readonly detail?:string;
  readonly optionDetail?:string;
  readonly comboDetail?:string;
  readonly note?:string;
  readonly sourceLineIds?:readonly string[];
}

export interface OrderingCartViewModel {
  readonly orderId:string;
  readonly serviceMode:ServiceMode;
  readonly viewMode:'original'|'organized';
  readonly combineSimilar:boolean;
  readonly lines:readonly CartLineViewModel[];
  readonly subtotalLabel:string;
  readonly packagingLabel:string;
  readonly discountLabel:string;
  readonly totalLabel:string;
  readonly checkoutEnabled:boolean;
}

export interface OrderingWorkItemViewModel {
  readonly id:'riceball-pool'|'required'|'combo';
  readonly label:string;
  readonly count:number;
  readonly description:string;
  readonly statusLabel:string;
  readonly enabled:boolean;
  readonly active:boolean;
  readonly tone:'riceball'|'required'|'combo';
}

export interface OrderingActionAvailability {
  readonly lineServiceMode:boolean;
  readonly lineEdit:boolean;
  readonly lineQuantity:boolean;
  readonly holdCart:boolean;
  readonly cancelCart:boolean;
}

export interface OrderingWorkspaceViewModel {
  readonly pendingOrders:readonly QueueOrderViewModel[];
  readonly activeOrders:readonly QueueOrderViewModel[];
  readonly categories:readonly OrderingCategoryViewModel[];
  readonly selectedCategoryId:string;
  readonly categoryRows:1|2;
  readonly categoryColumns:5|6|7;
  readonly products:readonly OrderingProductViewModel[];
  readonly menuRevisionLabel?:string;
  readonly operationalNotice?:string;
  readonly orderingMode:'quick'|'standard';
  readonly feedbackMessage?:string;
  readonly showCategories?:boolean;
  readonly serviceModes?:Readonly<{takeaway:boolean;dineIn:boolean}>;
  readonly cart:OrderingCartViewModel;
  readonly workItems:readonly OrderingWorkItemViewModel[];
  readonly recentlyAddedProductId?:string;
  readonly highlightedCartLineId?:string;
  readonly cartPulseNonce:number;
  readonly actionAvailability?:OrderingActionAvailability;
}

export interface OrderingWorkspaceActions {
  readonly onSelectCategory:(categoryId:string)=>void;
  readonly onChangeOrderingMode:(mode:'quick'|'standard')=>void;
  readonly onAddProduct:(productId:string)=>void;
  readonly onConfigureProduct:(productId:string)=>void;
  readonly onChangeServiceMode:(mode:ServiceMode)=>void;
  readonly onChangeCartView:(mode:'original'|'organized')=>void;
  readonly onToggleCombine:()=>void;
  readonly onChangeLineServiceMode:(lineIds:readonly string[],mode:ServiceMode)=>void;
  readonly onAdjustLineQuantity:(lineIds:readonly string[],delta:-1|1)=>void;
  readonly onEditCartLine:(lineId:string)=>void;
  readonly onHoldCart:()=>void;
  readonly onCancelCart:()=>void;
  readonly onOpenWorkItem:(workItemId:OrderingWorkItemViewModel['id'])=>void;
  readonly onOpenQueueOrder:(kind:'pending'|'active',id:string)=>void;
  readonly onCheckout:()=>void;
}
