export type ServiceMode='takeaway'|'dine-in';

export interface QueueOrderViewModel {
  readonly id:string;
  readonly orderId:string;
  readonly sourceLabel:string;
  readonly waitLabel:string;
  readonly itemCount:number;
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
}

export interface OrderingCartViewModel {
  readonly orderId:string;
  readonly serviceMode:ServiceMode;
  readonly viewMode:'original'|'organized';
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
  readonly products:readonly OrderingProductViewModel[];
  readonly menuRevisionLabel?:string;
  readonly operationalNotice?:string;
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
  readonly onAddProduct:(productId:string)=>void;
  readonly onConfigureProduct:(productId:string)=>void;
  readonly onChangeServiceMode:(mode:ServiceMode)=>void;
  readonly onChangeCartView:(mode:'original'|'organized')=>void;
  readonly onChangeLineServiceMode:(lineId:string,mode:ServiceMode)=>void;
  readonly onAdjustLineQuantity:(lineId:string,delta:-1|1)=>void;
  readonly onEditCartLine:(lineId:string)=>void;
  readonly onHoldCart:()=>void;
  readonly onCancelCart:()=>void;
  readonly onOpenWorkItem:(workItemId:OrderingWorkItemViewModel['id'])=>void;
  readonly onOpenQueueOrder:(kind:'pending'|'active',id:string)=>void;
  readonly onCheckout:()=>void;
}
