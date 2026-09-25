export type ServiceMode='takeaway'|'dine-in';

export interface QueueOrderViewModel {
  readonly id:string;
  readonly orderId:string;
  readonly sourceLabel:string;
  readonly waitLabel:string;
  readonly itemCount:number;
  readonly attentionLabel?:string;
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
  readonly quickAddAllowed:boolean;
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
  readonly blockingMessage?:string;
}

export interface OrderingWorkItemViewModel {
  readonly id:'riceball-pool'|'required'|'combo';
  readonly label:string;
  readonly count:number;
}

export interface QuickDrinkChoiceViewModel{
  readonly id:string;
  readonly label:string;
  readonly priceAdjustmentLabel?:string;
  readonly enabled:boolean;
  readonly requiresConfiguration:boolean;
}

export interface QuickDrinkViewModel{
  readonly open:boolean;
  readonly pendingCount:number;
  readonly targetLabel?:string;
  readonly choices:readonly QuickDrinkChoiceViewModel[];
}

export type OrderingGuidanceTarget='product'|'required'|'quick-drink'|'combo'|'riceball-pool'|'checkout';

export function deriveOrderingGuidance(input:{
  readonly cartItemCount:number;
  readonly requiredCount:number;
  readonly pendingDrinkCount:number;
  readonly comboBlockingCount:number;
  readonly autoPairCount:number;
  readonly checkoutEnabled:boolean;
}):OrderingGuidanceTarget{
  if(input.requiredCount>0)return 'required';
  if(input.pendingDrinkCount>0)return 'quick-drink';
  if(input.comboBlockingCount>0)return 'combo';
  if(input.autoPairCount>0)return 'riceball-pool';
  if(input.cartItemCount>0&&input.checkoutEnabled)return 'checkout';
  return 'product';
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
  readonly categoryRows?:1|2|3;
  readonly categoryColumns?:number;
  readonly productColumns?:number;
  readonly productCardHeight?:number;
  readonly fontScale?:number;
  readonly densityScale?:number;
  readonly serviceModes?:Readonly<{takeaway:boolean;dineIn:boolean}>;
  readonly cart:OrderingCartViewModel;
  readonly orderingMode:'normal'|'quick';
  readonly quickDrink:QuickDrinkViewModel;
  readonly heldCartCount:number;
  readonly workItems:readonly OrderingWorkItemViewModel[];
  readonly recentlyAddedProductId?:string;
  readonly highlightedCartLineId?:string;
  readonly cartPulseNonce:number;
  readonly actionAvailability?:OrderingActionAvailability;
  readonly guidanceTarget?:OrderingGuidanceTarget;
}

export interface OrderingWorkspaceActions {
  readonly onSelectCategory:(categoryId:string)=>void;
  readonly onAddProduct:(productId:string)=>void;
  readonly onConfigureProduct:(productId:string)=>void;
  readonly onChangeOrderingMode:(mode:'normal'|'quick')=>void;
  readonly onToggleQuickDrink:()=>void;
  readonly onSelectQuickDrink:(choiceId:string)=>void;
  readonly onOpenQuickDrinkTargets:()=>void;
  readonly onChangeServiceMode:(mode:ServiceMode)=>void;
  readonly onChangeCartView:(mode:'original'|'organized')=>void;
  readonly onToggleCombine:()=>void;
  readonly onChangeLineServiceMode:(lineIds:readonly string[],mode:ServiceMode)=>void;
  readonly onAdjustLineQuantity:(lineIds:readonly string[],delta:-1|1)=>void;
  readonly onEditCartLine:(lineIds:readonly string[])=>void;
  readonly onRemoveCartLine:(lineIds:readonly string[])=>void;
  readonly onHoldCart:()=>void;
  readonly onOpenHeldOrders:()=>void;
  readonly onCancelCart:()=>void;
  readonly onOpenWorkItem:(workItemId:OrderingWorkItemViewModel['id'])=>void;
  readonly onOpenQueueOrder:(kind:'pending'|'active',id:string)=>void;
  readonly onCheckout:()=>void;
}
