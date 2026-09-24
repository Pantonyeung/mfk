import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {OrderingWorkspace} from '../features/ordering/OrderingWorkspace.tsx';
import {ProductConfigWorkspace} from '../features/ordering/OrderingCenterWorkspaces.tsx';
import {CheckoutWorkspace} from '../features/checkout/CheckoutWorkspace.tsx';
import {ActionFeedback,DisabledReason,GuidedProgress} from './SmtUi.tsx';

const noop=()=>undefined;

describe('SMT Premium Interaction Donor Fusion R1',()=>{
  it('keeps frontline queues, text-only catalog and one decisive checkout action',()=>{
    const html=renderToStaticMarkup(<OrderingWorkspace
      view={{
        pendingOrders:[{id:'p1',orderId:'P001',sourceLabel:'現場',waitLabel:'12:10',etaLabel:'ETA 12:30',itemCount:2}],
        activeOrders:[{id:'k1',orderId:'K021',sourceLabel:'Keeta',waitLabel:'12:11',etaLabel:'ETA 12:31',itemCount:1}],
        categories:[{id:'bento',label:'便當'},{id:'drink',label:'飲品'}],
        selectedCategoryId:'bento',
        categoryRows:1,
        categoryColumns:7,
        orderingMode:'quick',
        products:[
          {id:'b1',name:'紫米照燒雞便當',priceLabel:'$68.00',enabled:true,requiresOptions:true,hasRequiredOptions:true},
          {id:'d1',name:'台式奶茶',priceLabel:'$20.00',enabled:true,requiresOptions:false,hasRequiredOptions:false},
        ],
        menuRevisionLabel:'MFK CURRENT',
        cart:{
          orderId:'P002',serviceMode:'takeaway',viewMode:'original',combineSimilar:false,
          lines:[{id:'l1',name:'紫米照燒雞便當',quantity:1,lineTotalLabel:'$68.00',serviceMode:'takeaway',groupId:'bento',groupLabel:'便當',optionDetail:'飯底：紫米飯',note:'少汁',sourceLineIds:['l1']}],
          subtotalLabel:'$68.00',packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:'$68.00',checkoutEnabled:true,
        },
        workItems:[
          {id:'riceball-pool',label:'飯團待組區',count:0,description:'未完成飯團會集中喺呢度',statusLabel:'目前清空',enabled:true,active:false,tone:'riceball'},
          {id:'required',label:'必選區',count:1,description:'需要處理嘅必選會喺呢度',statusLabel:'有 1 項',enabled:true,active:false,tone:'required'},
          {id:'combo',label:'紫米套餐',count:1,description:'建立正式套餐配置',statusLabel:'可設定',enabled:true,active:false,tone:'combo'},
        ],
        cartPulseNonce:0,
        actionAvailability:{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true},
      }}
      actions={{
        onSelectCategory:noop,onAddProduct:noop,onConfigureProduct:noop,
        onChangeServiceMode:noop,onChangeCartView:noop,onToggleCombine:noop,onChangeLineServiceMode:noop,
        onAdjustLineQuantity:noop,onEditCartLine:noop,onHoldCart:noop,onCancelCart:noop,onOpenWorkItem:noop,
        onOpenQueueOrder:noop,onCheckout:noop,
      }}
    />);

    expect(html).toContain('待處理');
    expect(html).toContain('Keeta');
    expect(html).toContain('ETA 12:30');
    expect(html).toContain('便當');
    expect(html).toContain('飲品');
    expect(html).not.toContain('一按加入，有必選先停低');
    expect(html).not.toContain('搜尋商品名稱');
    expect(html).not.toContain('點選模式');
    expect(html).toContain('紫米照燒雞便當');
    expect(html).toContain('飯底：紫米飯');
    expect(html).toContain('備註：少汁');
    expect(html).toContain('飯團待組區');
    expect(html).toContain('必選區');
    expect(html).toContain('紫米套餐');
    expect(html).toContain('前往結帳 $68.00');
    expect(html).not.toContain('<img');
  });

  it('shows one configuration decision at a time with explicit progress and no product imagery',()=>{
    const html=renderToStaticMarkup(<ProductConfigWorkspace
      product={{
        id:'meal',category:'便當',name:'測試便當',priceMinor:5000,priceLabel:'$50.00',imageUrl:'https://example.test/ignored.jpg',
        optionSets:[
          {id:'rice',name:'飯底',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'purple',name:'紫米飯',priceAdjustmentMinor:0,defaultSelected:false,active:true},
          ]},
          {id:'sauce',name:'醬汁',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'less',name:'少汁',priceAdjustmentMinor:0,defaultSelected:false,active:true},
          ]},
        ],
      }}
      onAdd={noop}
    />);

    expect(html).toContain('逐項完成 2 組設定');
    expect(html).toContain('飯底');
    expect(html).toContain('紫米飯');
    expect(html).not.toContain('醬汁');
    expect(html).not.toContain('少汁');
    expect(html).toContain('第 1 步，共 3 步');
    expect(html).toContain('仲有設定未完成');
    expect(html).toContain('加入購物籃');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('<img');
  });

  it('keeps source tender cash and commit on one premium checkout surface',()=>{
    const html=renderToStaticMarkup(<CheckoutWorkspace
      view={{
        order:{orderId:'P003',lines:[{id:'1',name:'飯團',quantity:1,lineTotalLabel:'$41.00'}],subtotalLabel:'$41.00',packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:'$41.00'},
        channels:[{id:'walk-in',label:'現場',selected:true}],
        methods:[{id:'CASH',label:'現金',enabled:true,selected:true}],
        selectedMethodLabel:'現金',
        amount:{dueLabel:'$41.00',receivedLabel:'$50.00',changeLabel:'$9.00'},
        cashInput:'50.00',cashEntryVisible:true,exactCashEnabled:true,confirmEnabled:true,paymentState:'selected',
        channelFields:{showCustomerPhone:false,customerPhone:'',showPlatformFields:false,pickupCode:'',platformOrderNo:''},
        comboMode:false,splitTenders:[],
      }}
      actions={{onBack:noop,onSelectChannel:noop,onSelectMethod:noop,onChangeCustomerPhone:noop,onChangePickupCode:noop,onChangePlatformOrderNo:noop,onChangeSplitAmount:noop,onCashKey:noop,onQuickCash:noop,onExactCash:noop,onConfirm:noop,onRetry:noop,onDone:noop}}
    />);

    expect(html).toContain('快速結帳');
    expect(html).toContain('訂單來源');
    expect(html).toContain('付款方式');
    expect(html).toContain('收款');
    expect(html).toContain('實收現金');
    expect(html).toContain('$50.00');
    expect(html).toContain('$9.00');
    expect(html).toContain('優惠與會員');
    expect(html).toContain('目前未接駁');
    expect(html).toContain('確認收款並建立訂單');
  });

  it('exposes readable state semantics and guided progress',()=>{
    const html=renderToStaticMarkup(<>
      <GuidedProgress current={2} total={4} label="完成必選"/>
      <ActionFeedback tone="warning" title="正在安全保存" detail="請勿重複操作。"/>
      <DisabledReason>完成必選後先可以繼續。</DisabledReason>
    </>);
    expect(html).toContain('第 2 步，共 4 步：完成必選');
    expect(html).toContain('role="status"');
    expect(html).toContain('請勿重複操作');
    expect(html).toContain('完成必選後先可以繼續');
  });
});
