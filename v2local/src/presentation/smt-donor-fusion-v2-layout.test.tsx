import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OrderingWorkspace} from '../features/ordering/OrderingWorkspace.tsx';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const css=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

const noop=()=>undefined;
const actions={
  onSelectCategory:noop,
  onAddProduct:noop,
  onConfigureProduct:noop,
  onChangeServiceMode:noop,
  onChangeCartView:noop,
  onToggleCombine:noop,
  onChangeLineServiceMode:noop,
  onAdjustLineQuantity:noop,
  onEditCartLine:noop,
  onRemoveCartLine:noop,
  onHoldCart:noop,
  onOpenHeldOrders:noop,
  onCancelCart:noop,
  onOpenWorkItem:noop,
  onOpenQueueOrder:noop,
  onCheckout:noop,
};

function view(){
  return {
    pendingOrders:[],
    activeOrders:[],
    categories:[{id:'riceball',label:'飯團'},{id:'bento',label:'便當'}],
    selectedCategoryId:'riceball',
    products:[
      {id:'p1',name:'原味飯團',priceLabel:'$41.00',enabled:true,requiresOptions:false},
      {id:'p2',name:'泡菜豬肉飯團',priceLabel:'$45.00',enabled:true,requiresOptions:true},
    ],
    showCategories:true,
    serviceModes:{takeaway:true,dineIn:true},
    cart:{
      orderId:'P001',
      serviceMode:'takeaway' as const,
      viewMode:'original' as const,
      combineSimilar:false,
      lines:[],
      subtotalLabel:'$0.00',
      packagingLabel:'$0.00',
      discountLabel:'$0.00',
      totalLabel:'$0.00',
      checkoutEnabled:false,
    },
    heldCartCount:0,
    workItems:[
      {id:'riceball-pool' as const,label:'快速組合',count:0},
      {id:'required' as const,label:'必選區',count:0},
      {id:'combo' as const,label:'紫米套餐區',count:0},
    ],
    cartPulseNonce:0,
    actionAvailability:{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true},
  };
}

describe('SMT donor skeleton fusion V2 layout',()=>{
  it('locks product cards to four columns with fixed rows',()=>{
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important');
    expect(css).toContain('grid-auto-rows:142px!important');
  });

  it('keeps active-cart footer dense without large subtotal dashboard blocks',()=>{
    const base=view();
    const html=renderToStaticMarkup(<OrderingWorkspace view={{
      ...base,
      cart:{
        ...base.cart,
        lines:[{id:'l1',name:'原味飯團',quantity:1,lineTotalLabel:'$41.00',serviceMode:'takeaway',groupId:'riceball',groupLabel:'飯團',sourceLineIds:['l1']}],
        subtotalLabel:'$41.00',
        totalLabel:'$41.00',
        checkoutEnabled:true,
      },
    }} actions={actions}/>);
    expect(html).toContain('ordering-cart-price-strip');
    expect(html).toContain('暫存');
    expect(html).toContain('清除訂單');
    expect(html).toContain('前往結帳');
    expect(html).toContain('刪除 原味飯團');
    expect(html).not.toContain('ordering-cart-facts');
    expect(html).not.toContain('ordering-cart-total');
  });

  it('shows retrieve only when cart is empty and ordinary holds exist',()=>{
    const base=view();
    const html=renderToStaticMarkup(<OrderingWorkspace view={{...base,heldCartCount:2}} actions={actions}/>);
    expect(html).toContain('取單');
    expect(html).not.toContain('前往結帳');
    expect(html).not.toContain('暫存');
  });

  it('keeps the three MoreFunOS accelerators in fixed positions even at zero',()=>{
    const html=renderToStaticMarkup(<OrderingWorkspace view={view()} actions={actions}/>);
    expect(html).toContain('快速組合');
    expect(html).toContain('必選區');
    expect(html).toContain('紫米套餐區');
    expect(html).toContain('ordering-workbar');
  });

  it('keeps independent item identity by default and only groups in explicit combine mode',()=>{
    expect(app).toContain('const [combineSimilar,setCombineSimilar]=useState(false)');
    expect(app).toContain('if(!combineSimilar)');
    expect(app).toContain('JSON.stringify(line.optionSelections??{})');
    expect(app).toContain('JSON.stringify(line.comboDraft??null)');
  });

  it('keeps dining holds out of ordinary retrieve list',()=>{
    expect(app).toContain("heldCarts.filter(hold=>hold.kind==='waiting')");
    expect(app).toContain('heldCartCount:waitingHolds.length');
    expect(app).toContain('holds={waitingHolds as readonly WorkspaceHoldDraft[]}');
  });

  it('uses the donor three-second non-blocking incoming order attention pattern',()=>{
    expect(app).toContain('window.setTimeout(()=>setGlobalArrival(null),3000)');
    expect(app).toContain('稍後處理');
    expect(app).toContain('立即處理');
    expect(app).not.toContain('30 秒後再提示');
  });
});
