const STORAGE_KEY='mfk.local.pos.v1';

const products=[
  {id:'r1',name:'原味飯團',category:'飯團',price:41},
  {id:'r2',name:'紫菜吞拿魚飯團',category:'飯團',price:43},
  {id:'r3',name:'泡菜豬肉飯團',category:'飯團',price:45},
  {id:'b1',name:'肉燥便當',category:'便當',price:48},
  {id:'b2',name:'咖喱便當',category:'便當',price:50},
  {id:'s1',name:'香脆薯角',category:'小食',price:18},
  {id:'d1',name:'台式奶茶',category:'飲品',price:16},
  {id:'d2',name:'手打檸檬茶',category:'飲品',price:20},
];

const state={
  view:'pos',
  category:'全部',
  cart:[],
  orders:loadOrders(),
  modal:null,
};

function loadOrders(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed.orders)?parsed.orders:[];
  }catch{return []}
}

function saveOrders(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify({orders:state.orders}));
}

function money(n){return '$'+Number(n).toFixed(0)}
function cartTotal(){return state.cart.reduce((sum,l)=>sum+l.price*l.qty,0)}
function nextDisplay(){
  const today=new Date().toISOString().slice(0,10);
  const count=state.orders.filter(o=>o.businessDate===today).length+1;
  return 'P'+String(count).padStart(3,'0');
}

function addProduct(product){
  const found=state.cart.find(l=>l.id===product.id);
  if(found)found.qty+=1;
  else state.cart.push({...product,qty:1,remark:''});
  render();
}

function changeQty(id,delta){
  const line=state.cart.find(l=>l.id===id);
  if(!line)return;
  line.qty+=delta;
  if(line.qty<=0)state.cart=state.cart.filter(l=>l.id!==id);
  render();
}

function openCheckout(){
  if(!state.cart.length)return;
  state.modal={type:'checkout',tender:'CASH',received:cartTotal()};
  render();
}

function confirmCheckout(){
  const total=cartTotal();
  const received=Number(state.modal.received||0);
  if(received<total){
    alert('收款不足');
    return;
  }
  const now=new Date();
  const order={
    id:crypto.randomUUID?crypto.randomUUID():'order-'+Date.now(),
    display:nextDisplay(),
    businessDate:now.toISOString().slice(0,10),
    createdAt:now.toISOString(),
    total,
    tender:'CASH',
    received,
    change:received-total,
    status:'COMPLETED',
    items:state.cart.map(l=>({id:l.id,name:l.name,price:l.price,qty:l.qty})),
  };
  state.orders.unshift(order);
  saveOrders();
  state.cart=[];
  state.modal={type:'done',order};
  render();
}

function clearAllLocalData(){
  if(!confirm('清除所有本機訂單？'))return;
  state.orders=[];
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function render(){
  const root=document.querySelector('#app');
  const categories=['全部',...new Set(products.map(p=>p.category))];
  const visible=products.filter(p=>state.category==='全部'||p.category===state.category);

  root.innerHTML=`
    <div class="app">
      <header class="top">
        <div>
          <h1>磨飯 MFK POS</h1>
          <div class="status">LOCAL ONLY · 無網絡依賴</div>
        </div>
        <div class="tabs">
          <button data-view="pos" class="${state.view==='pos'?'active':''}">點單</button>
          <button data-view="history" class="${state.view==='history'?'active':''}">訂單</button>
        </div>
      </header>

      ${state.view==='pos'?renderPos(categories,visible):renderHistory()}
      ${renderModal()}
    </div>
  `;

  bind();
}

function renderPos(categories,visible){
  return `
    <main class="main">
      <section class="panel">
        <div class="notice">本頁所有商品、購物車、收款、訂單記錄都只在本機運行。</div>
        <div class="toolbar">
          ${categories.map(c=>`<button data-category="${c}" class="${state.category===c?'active':''}">${c}</button>`).join('')}
        </div>
        <div class="products">
          ${visible.map(p=>`
            <button class="product" data-product="${p.id}">
              <span>${p.category}</span>
              <strong>${p.name}</strong>
              <b>${money(p.price)}</b>
            </button>
          `).join('')}
        </div>
      </section>

      <aside class="panel cart">
        <h2>購物車</h2>
        <div class="cart-lines">
          ${state.cart.length?state.cart.map(l=>`
            <div class="line">
              <div>
                <strong>${l.name}</strong>
                <small>${money(l.price)} × ${l.qty}</small>
              </div>
              <div class="qty">
                <button data-dec="${l.id}">−</button>
                <b>${l.qty}</b>
                <button data-inc="${l.id}">＋</button>
              </div>
            </div>
          `).join(''):'<div class="empty">未有商品</div>'}
        </div>
        <div class="summary">
          <div class="total"><span>合計</span><span>${money(cartTotal())}</span></div>
          <button class="checkout" data-checkout>現金結帳</button>
          <button class="secondary" data-clear-cart>清空購物車</button>
        </div>
      </aside>
    </main>
  `;
}

function renderHistory(){
  return `
    <main class="main" style="grid-template-columns:1fr">
      <section class="panel history">
        <div class="toolbar" style="justify-content:space-between">
          <strong>本機訂單</strong>
          <button data-clear-orders>清除本機測試資料</button>
        </div>
        ${state.orders.length?`
          <table>
            <thead><tr><th>流水號</th><th>時間</th><th>付款</th><th>金額</th><th>狀態</th></tr></thead>
            <tbody>
              ${state.orders.map(o=>`
                <tr>
                  <td><strong>${o.display}</strong></td>
                  <td>${new Date(o.createdAt).toLocaleString('zh-HK')}</td>
                  <td>${o.tender}</td>
                  <td>${money(o.total)}</td>
                  <td>${o.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `:'<div class="empty">未有本機訂單</div>'}
      </section>
    </main>
  `;
}

function renderModal(){
  if(!state.modal)return '';
  if(state.modal.type==='checkout'){
    const total=cartTotal();
    const received=Number(state.modal.received||0);
    return `
      <div class="modal-backdrop">
        <section class="modal">
          <h2>現金結帳</h2>
          <p>應收：<strong>${money(total)}</strong></p>
          <div class="cash-row">
            <label>實收
              <input data-received type="number" min="0" step="1" value="${received}">
            </label>
            <label>找續
              <input disabled value="${money(Math.max(0,received-total))}">
            </label>
          </div>
          <div class="modal-actions">
            <button data-cancel-modal>返回</button>
            <button class="primary" data-confirm-checkout>確認收款</button>
          </div>
        </section>
      </div>
    `;
  }
  if(state.modal.type==='done'){
    const o=state.modal.order;
    return `
      <div class="modal-backdrop">
        <section class="modal">
          <h2>訂單已建立</h2>
          <p><strong>${o.display}</strong></p>
          <p>金額 ${money(o.total)} · 現金 · 找續 ${money(o.change)}</p>
          <div class="modal-actions">
            <button class="primary" data-done>完成</button>
          </div>
        </section>
      </div>
    `;
  }
  return '';
}

function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});
  document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;render()});
  document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>addProduct(products.find(p=>p.id===b.dataset.product)));
  document.querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
  document.querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
  const checkout=document.querySelector('[data-checkout]'); if(checkout)checkout.onclick=openCheckout;
  const clearCart=document.querySelector('[data-clear-cart]'); if(clearCart)clearCart.onclick=()=>{state.cart=[];render()};
  const cancel=document.querySelector('[data-cancel-modal]'); if(cancel)cancel.onclick=()=>{state.modal=null;render()};
  const received=document.querySelector('[data-received]'); if(received)received.oninput=()=>{state.modal.received=Number(received.value||0);render()};
  const confirmBtn=document.querySelector('[data-confirm-checkout]'); if(confirmBtn)confirmBtn.onclick=confirmCheckout;
  const done=document.querySelector('[data-done]'); if(done)done.onclick=()=>{state.modal=null;render()};
  const clearOrders=document.querySelector('[data-clear-orders]'); if(clearOrders)clearOrders.onclick=clearAllLocalData;
}

render();
