import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OrderingWorkspace} from '../features/ordering/OrderingWorkspace.tsx';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const globalCss=fs.readFileSync(path.join(root,'styles.css'),'utf8');

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

function baseView(){
  return {
    pendingOrders:[],
    activeOrders:[],
    categories:[{id:'riceball',label:'飯團'},{id:'bento',label:'便當'}],
    selectedCategoryId:'riceball',
    categoryRows:1 as const,
    categoryColumns:7 as const,
    showProductImages:false,
    productDensity:'standard' as const,
    products:[
      {id:'p1',name:'原味飯團',priceLabel:'$41.00',enabled:true,requiresOptions:false},
      {id:'p2',name:'泡菜豬肉飯團',priceLabel:'$45.00',enabled:true,requiresOptions:true,hasRequiredOptions:true},
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
      {id:'riceball-pool' as const,label:'飯團待組',count:0,enabled:false,tone:'riceball' as const},
      {id:'required' as const,label:'必選',count:0,enabled:false,tone:'required' as const},
      {id:'combo' as const,label:'紫米套餐',count:0,enabled:true,tone:'combo' as const},
    ],
    cartPulseNonce:0,
    actionAvailability:{lineServiceMode:true,lineEdit:true,lineQuantity:true,holdCart:true,cancelCart:true},
  };
}

describe('SMT Full Fusion Optimization R1',()=>{
  it('keeps the selling surface fixed at four product columns and stable row heights',()=>{
    expect(css).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important');
    expect(css).toContain('grid-auto-rows:142px!important');
    expect(css).toContain('grid-auto-rows:116px!important');
    expect(css).not.toMatch(/ordering-product-grid[^}]*grid-auto-rows:minmax\([^}]*1fr/s);
  });

  it('removes subtotal packaging discount blocks from the ordering cart and keeps total in checkout CTA only',()=>{
    const view=baseView();
    const html=renderToStaticMarkup(<OrderingWorkspace view={{
      ...view,
      cart:{
        ...view.cart,
        lines:[{id:'l1',name:'原味飯團',quantity:1,lineTotalLabel:'$41.00',serviceMode:'takeaway',groupId:'riceball',groupLabel:'飯團',sourceLineIds:['l1']}],
        subtotalLabel:'$41.00',totalLabel:'$41.00',checkoutEnabled:true,
      },
    }} actions={actions}/>);
    expect(html).toContain('前往結帳');
    expect(html).toContain('$41.00');
    expect(html).not.toContain('小計');
    expect(html).not.toContain('包裝');
    expect(html).not.toContain('折扣');
    expect(html).toContain('暫存');
    expect(html).toContain('取消');
    expect(html).not.toContain('取回訂單');
  });

  it('shows a single retrieve action only when the cart is empty and held checks exist',()=>{
    const view=baseView();
    const html=renderToStaticMarkup(<OrderingWorkspace view={{...view,heldCartCount:2}} actions={actions}/>);
    expect(html).toContain('取回訂單');
    expect(html).toContain('2');
    expect(html).not.toContain('前往結帳');
    expect(html).not.toContain('暫存');
  });

  it('keeps the three MoreFunOS fast lanes fixed and compact',()=>{
    const html=renderToStaticMarkup(<OrderingWorkspace view={baseView()} actions={actions}/>);
    expect(html).toContain('飯團待組');
    expect(html).toContain('必選');
    expect(html).toContain('紫米套餐');
    expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(css).toContain('min-height:54px');
  });

  it('uses independent cart lines by default and groups only when combine is enabled',()=>{
    expect(app).toContain('const [combineSimilar,setCombineSimilar]=useState(false)');
    expect(app).toContain('if(!combineSimilar)');
    expect(app).toContain("const key=[line.productId,line.serviceMode,line.unitMinor,line.detail??''].join('::')");
    expect(app).toContain('onToggleCombine:()=>setCombineSimilar');
  });

  it('keeps display preferences grouped in the rail and never makes product columns a setting',()=>{
    expect(app).toContain('clean-display-settings');
    expect(app).toContain('分類行數');
    expect(app).toContain('分類每行');
    expect(app).toContain('商品圖片');
    expect(app).toContain('商品密度');
    expect(app).toContain('商品固定每行 4 格');
    expect(globalCss).toContain('.clean-display-settings');
  });

  it('saves held checks immediately and clears the active cart',()=>{
    expect(app).toMatch(/onHoldCart:\(\)=>\{[\s\S]*localRuntime\.createHold\(\{kind:'waiting'[\s\S]*finishHold\(\);/);
    expect(app).toContain("onOpenHeldOrders:()=>{if(!cart.length&&savedCarts.length)setPanel({type:'holds'});}");
  });
});
