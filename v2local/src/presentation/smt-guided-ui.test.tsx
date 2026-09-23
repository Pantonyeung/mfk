import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProductConfigWorkspace} from '../features/ordering/OrderingCenterWorkspaces.tsx';
import {CheckoutWorkspace} from '../features/checkout/CheckoutWorkspace.tsx';
import {ActionFeedback,EmptyState,GuidedProgress} from './SmtUi.tsx';

describe('SMT human-centered guided UI',()=>{
  it('shows one product decision at a time while keeping quantity and computed pricing visible',()=>{
    const html=renderToStaticMarkup(<ProductConfigWorkspace
      product={{
        id:'meal',category:'便當',name:'測試便當',priceMinor:5000,priceLabel:'$50.00',
        optionSets:[
          {id:'size',name:'份量',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'large',name:'大份',priceAdjustmentMinor:500,defaultSelected:false,active:true},
          ]},
          {id:'spice',name:'辣度',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,options:[
            {id:'hot',name:'大辣',priceAdjustmentMinor:0,defaultSelected:false,active:true},
          ]},
        ],
      }}
      onAdd={()=>undefined}
    />);

    expect(html).toContain('由菜單與已選選項自動計算');
    expect(html).toContain('份量');
    expect(html).toContain('大份');
    expect(html).not.toContain('辣度');
    expect(html).not.toContain('大辣');
    expect(html).toContain('仲有設定未完成');
    expect(html).toContain('基價');
    expect(html).toContain('+$5.00');
    expect(html).toContain('加入購物籃');
    expect(html).toContain('disabled=""');
  });

  it('keeps source, tender, amount and the final commit action on one checkout surface',()=>{
    const nothing=()=>undefined;
    const html=renderToStaticMarkup(<CheckoutWorkspace view={{
      order:{orderId:'P001',lines:[{id:'1',name:'飯團',quantity:1,lineTotalLabel:'$41.00'}],subtotalLabel:'$41.00',packagingLabel:'$0.00',discountLabel:'$0.00',totalLabel:'$41.00'},
      channels:[{id:'walk-in',label:'現場',selected:true}],
      methods:[{id:'CASH',label:'現金',enabled:true,selected:true}],selectedMethodLabel:'現金',
      amount:{dueLabel:'$41.00',receivedLabel:'$0.00',changeLabel:'$0.00'},cashInput:'',cashEntryVisible:true,exactCashEnabled:true,confirmEnabled:false,paymentState:'selected',
      channelFields:{showCustomerPhone:false,customerPhone:'',showPlatformFields:false,pickupCode:'',platformOrderNo:''},comboMode:false,splitTenders:[],
    }} actions={{onBack:nothing,onSelectChannel:nothing,onSelectMethod:nothing,onChangeCustomerPhone:nothing,onChangePickupCode:nothing,onChangePlatformOrderNo:nothing,onChangeSplitAmount:nothing,onCashKey:nothing,onQuickCash:nothing,onExactCash:nothing,onConfirm:nothing,onRetry:nothing,onDone:nothing}}/>);

    expect(html).toContain('訂單來源');
    expect(html).toContain('付款方式');
    expect(html).toContain('收款');
    expect(html).toContain('優惠與會員');
    expect(html).toContain('學生優惠');
    expect(html).toContain('正式優惠計價尚未接駁');
    expect(html).toContain('確認收款並建立訂單');
    expect(html).not.toContain('繼續：');
  });

  it('exposes progress and feedback with readable status semantics',()=>{
    const html=renderToStaticMarkup(<>
      <GuidedProgress current={2} total={4} label="付款方式"/>
      <ActionFeedback tone="warning" title="正在確認" detail="請勿重複操作。"/>
      <EmptyState icon="✓" title="目前冇工作" detail="新工作會顯示喺呢度。"/>
    </>);

    expect(html).toContain('第 2 步，共 4 步：付款方式');
    expect(html).toContain('role="status"');
    expect(html).toContain('請勿重複操作');
    expect(html).toContain('目前冇工作');
  });
});
