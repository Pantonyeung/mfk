import React from 'react';
// @ts-expect-error The existing test-only renderer dependency has no installed declarations.
import {act,create as createRenderer} from 'react-test-renderer';
type ReactTestInstance={props:Record<string,any>;children:(string|ReactTestInstance)[];findAllByType:(type:string)=>ReactTestInstance[];findByType:(type:string)=>ReactTestInstance};
type Renderer={root:ReactTestInstance;update:(node:React.ReactNode)=>void;unmount:()=>void};
const create=createRenderer as (node:React.ReactNode)=>Renderer;
import {afterEach,describe,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {FormalProductEditor} from './formal-product-editor.tsx';
import {FormalModifiersPage} from './formal-modifiers-page.tsx';
import {V3FormalDraftProvider,v3FormalDraftQueryKey,type V3FormalAdminDraft} from './formal-draft.tsx';
import {patchFormalModifierOptionPrice} from './formal-catalog.ts';

function source(){
  const sets=[{id:'g1',name:'Size',selection:'SINGLE',min:1,max:1,required:true,forceShow:true,allowQuantities:false,active:true,options:[
    {id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,position:10},
    {id:'o2',code:'L',name:'Large',priceAdjustment:'2.50',active:true,position:20},
  ]},{id:'g2',name:'Extras',selection:'MULTI',min:0,max:2,required:false,forceShow:false,allowQuantities:false,active:true,options:[
    {id:'o3',code:'X',name:'Extra',priceAdjustment:'-1.00',active:true,position:10},
    {id:'o4',code:'I',name:'Inactive',priceAdjustment:'3.00',active:false,position:20},
  ]}];
  return {catalog:{categories:[{id:'cat',name:'Food',active:true,position:10}],products:[{id:'p1',name:'Product',productCode:'AUTO-1',categoryId:'cat',basePrice:'12.00',description:'',active:true,modifierGroupIds:['g1'],unknown:'kept'}],modifierGroups:structuredClone(sets)},optionCenter:{sets,productLinks:[{productId:'p1',setId:'g1',defaultOptionIds:['o2'],unknown:{kept:true}}]}} as any;
}
const content=(node:ReactTestInstance):string=>node.children.map(child=>typeof child==='string'?child:content(child)).join('');
const button=(tree:ReturnType<typeof create>,label:string)=>tree.root.findAllByType('button').find(node=>content(node)===label)!;
const checkbox=(tree:ReturnType<typeof create>,label:string)=>tree.root.findAllByType('input').find(node=>node.props['aria-label']===label)!;
const field=(tree:ReturnType<typeof create>,label:string)=>tree.root.findAllByType('label').find(node=>content(node).startsWith(label))!.findByType('input');
const mounted:{tree:ReturnType<typeof create>;client:QueryClient}[]=[];
afterEach(async()=>{for(const {tree,client} of mounted.splice(0)){await act(async()=>tree.unmount());client.clear();}vi.unstubAllGlobals();});
async function setup(snapshot=source(),productId:string|null='p1',page=false){
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'a27',snapshot});
  const client=new QueryClient({defaultOptions:{queries:{enabled:false},mutations:{retry:false}}});
  let current:V3FormalAdminDraft={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:3,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'fixture'};
  client.setQueryData(v3FormalDraftQueryKey('MF01'),current);
  const requests:any[]=[];const onClose=vi.fn();
  const fetcher=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
    const payload=JSON.parse(String(init?.body??'{}'));requests.push({url:String(url),method:init?.method,payload});
    if(init?.method==='GET')return new Response(JSON.stringify(current));
    if(init?.method==='PUT'){
      if(payload.expectedDraftRevision!==current.draftRevision)return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
      current={...current,draftRevision:current.draftRevision+1,snapshot:payload.snapshot};return new Response(JSON.stringify(current));
    }
    if(init?.method==='POST'){
      const product={id:'server-id',productCode:'AUTO-SERVER',...payload.product};
      current={...current,draftRevision:current.draftRevision+1,snapshot:{...current.snapshot,catalog:{...(current.snapshot.catalog as any),products:[...(current.snapshot.catalog as any).products,product]}}};
      return new Response(JSON.stringify({state:'CREATED',product,draft:current}));
    }
    throw new Error('Unexpected fixture request');
  });vi.stubGlobal('fetch',fetcher);
  const render=(id=productId,key='first')=><QueryClientProvider client={client}><V3FormalDraftProvider canonical={canonical} storeId="MF01" sessionToken="synthetic">{page?<FormalModifiersPage/>:<FormalProductEditor key={key} productId={id} onClose={onClose}/>}</V3FormalDraftProvider></QueryClientProvider>;
  let tree!:ReturnType<typeof create>;await act(async()=>{tree=create(render());});mounted.push({tree,client});
  return {tree,client,onClose,fetcher,requests,get current(){return current;},set current(value){current=value;},render};
}
const click=async(node:ReactTestInstance)=>{await act(async()=>{await node.props.onClick();});};
const check=async(node:ReactTestInstance,checked:boolean)=>{await act(async()=>node.props.onChange({target:{checked}}));};
const change=async(node:ReactTestInstance,value:string)=>{await act(async()=>node.props.onChange({target:{value}}));};

describe('formal product options right-sheet flow',()=>{
  it('shows reusable groups, explicit defaults, prices, required completion and source limitations',async()=>{
    const s=await setup();expect(content(s.tree.root)).toContain('商品選項與預設');
    expect(checkbox(s.tree,'套用 Size').props.checked).toBe(true);expect(checkbox(s.tree,'預設 Size / Large').props.checked).toBe(true);
    expect(content(s.tree.root)).toContain('2.50');expect(content(s.tree.root)).toContain('下單時');expect(content(s.tree.root)).toContain('Server');
    expect(s.requests).toHaveLength(0);
  });
  it('saves attachment/defaults and basics in one CAS PUT and retains source identity and unknown data',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'Mine');await check(checkbox(s.tree,'套用 Extras'),true);await check(checkbox(s.tree,'預設 Extras / Extra'),true);
    await check(checkbox(s.tree,'預設 Size / Small'),true);await click(button(s.tree,'儲存正式草稿'));
    expect(s.requests).toHaveLength(1);expect(s.requests[0].method).toBe('PUT');expect(s.requests[0].payload.expectedDraftRevision).toBe(3);
    expect((s.current.snapshot.catalog as any).products[0]).toMatchObject({id:'p1',productCode:'AUTO-1',name:'Mine',unknown:'kept',modifierGroupIds:['g1','g2']});
    expect((s.current.snapshot.optionCenter as any).productLinks).toEqual([{productId:'p1',setId:'g1',defaultOptionIds:['o1'],unknown:{kept:true}},{productId:'p1',setId:'g2',defaultOptionIds:['o3']}]);expect(s.onClose).toHaveBeenCalledOnce();
  });
  it('can explicitly clear a required group default without choosing the first option',async()=>{
    const s=await setup();await click(button(s.tree,'清除 Size 預設'));expect(checkbox(s.tree,'預設 Size / Large').props.checked).toBe(false);
    await click(button(s.tree,'儲存正式草稿'));expect((s.current.snapshot.optionCenter as any).productLinks[0].defaultOptionIds).toEqual([]);
  });
  it('detaches and reattaches locally without losing the original defaults before save',async()=>{
    const s=await setup();await check(checkbox(s.tree,'套用 Size'),false);await check(checkbox(s.tree,'套用 Size'),true);
    expect(checkbox(s.tree,'預設 Size / Large').props.checked).toBe(true);expect(s.requests).toHaveLength(0);
  });
  it('blocks selecting inactive options and unavailable groups without fabricating support',async()=>{
    const snapshot=source();snapshot.optionCenter.sets[1].active=false;snapshot.catalog.modifierGroups[1].active=false;
    const s=await setup(snapshot);expect(checkbox(s.tree,'套用 Extras').props.disabled).toBe(true);
    expect(content(s.tree.root)).toContain('停用');
  });
  it('preserves imported quantity values, disables new quantity bindings/default edits and explains why',async()=>{
    const snapshot=source();snapshot.optionCenter.sets[1].allowQuantities=true;snapshot.catalog.modifierGroups[1].allowQuantities=true;
    const s=await setup(snapshot);expect(checkbox(s.tree,'套用 Extras').props.disabled).toBe(true);expect(content(s.tree.root)).toContain('未支援每個選項的數量');
    await change(field(s.tree,'商品名稱'),'Renamed');await click(button(s.tree,'儲存正式草稿'));
    expect((s.current.snapshot.optionCenter as any).sets[1].allowQuantities).toBe(true);
  });
  it('disables central quantity toggle while retaining a true imported value',async()=>{
    const snapshot=source();snapshot.optionCenter.sets[1].allowQuantities=true;snapshot.catalog.modifierGroups[1].allowQuantities=true;
    const s=await setup(snapshot,'p1',true);await click(s.tree.root.findAllByType('button').find(node=>content(node).startsWith('Extras'))!);
    const toggle=s.tree.root.findAllByType('label').find(node=>content(node).includes('允許同一子選項多件'))!.findByType('input');
    expect(toggle.props.disabled).toBe(true);expect(toggle.props.checked).toBe(true);expect(content(s.tree.root)).toContain('未支援每個選項的數量');
  });
  it('does not save raw invalid data through a normalized partial view',async()=>{
    const snapshot=source();snapshot.optionCenter.productLinks[0].defaultOptionIds=['foreign'];
    const s=await setup(snapshot);expect(content(s.tree.root)).toContain('/snapshot/optionCenter/productLinks/0/defaultOptionIds/0');expect(button(s.tree,'儲存正式草稿').props.disabled).toBe(true);expect(s.requests).toHaveLength(0);
  });
  it('keeps edits visible after a server revision conflict and does not close or overwrite server data',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'My pending name');await click(button(s.tree,'清除 Size 預設'));
    s.current={...s.current,draftRevision:4,snapshot:{...s.current.snapshot,newer:true}};
    await click(button(s.tree,'儲存正式草稿'));expect(content(s.tree.root)).toContain('另一個分頁');expect(field(s.tree,'商品名稱').props.value).toBe('My pending name');expect(checkbox(s.tree,'預設 Size / Large').props.checked).toBe(false);expect(s.onClose).not.toHaveBeenCalled();expect(s.current.draftRevision).toBe(4);
  });
  it('blocks a refetched stale form after Pricing changed without losing its inputs',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'My pending name');
    const newer={...s.current,draftRevision:4,snapshot:patchFormalModifierOptionPrice(s.current.snapshot,'g1','o2','8.00')};
    await act(async()=>{s.client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);await new Promise(resolve=>setTimeout(resolve,10));});
    await click(button(s.tree,'儲存正式草稿'));expect(s.requests).toHaveLength(0);expect(content(s.tree.root)).toContain('已被更新');expect(field(s.tree,'商品名稱').props.value).toBe('My pending name');
  });
  it('holds the editor open and ignores duplicate Save/Cancel while a write is in flight',async()=>{
    const s=await setup();let resolve!:(value:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    await change(field(s.tree,'商品名稱'),'Pending');const save=button(s.tree,'儲存正式草稿').props.onClick;
    let pending:any;await act(async()=>{pending=save();save();await Promise.resolve();});
    expect(s.fetcher).toHaveBeenCalledOnce();expect(button(s.tree,'取消').props.disabled).toBe(true);
    await act(async()=>{resolve(new Response(JSON.stringify({...s.current,draftRevision:4})));await pending;});
  });
  it('keeps unsaved edits on Stay and discards them only after explicit confirmation',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'Unsaved');await click(button(s.tree,'取消'));expect(s.onClose).not.toHaveBeenCalled();expect(content(s.tree.root)).toContain('放棄未儲存變更');
    await click(button(s.tree,'繼續編輯'));expect(field(s.tree,'商品名稱').props.value).toBe('Unsaved');
    await click(button(s.tree,'關閉'));await click(button(s.tree,'放棄變更並關閉'));expect(s.onClose).toHaveBeenCalledOnce();expect(s.requests).toHaveLength(0);
  });
  it('reopens persisted defaults after a simulated reload of the same formal server draft',async()=>{
    const s=await setup();await check(checkbox(s.tree,'預設 Size / Small'),true);await click(button(s.tree,'儲存正式草稿'));
    await act(async()=>s.tree.update(s.render('p1','reopened')));expect(checkbox(s.tree,'預設 Size / Small').props.checked).toBe(true);
    const reloaded=await setup(structuredClone(s.current.snapshot));expect(checkbox(reloaded.tree,'預設 Size / Small').props.checked).toBe(true);expect((reloaded.current.snapshot.catalog as any).products[0].productCode).toBe('AUTO-1');
  });
  it('does not create a placeholder on open or cancel; clearly defers options until basic creation',async()=>{
    const s=await setup(source(),null);expect(content(s.tree.root)).toContain('建立基本草稿後');expect(s.tree.root.findAllByType('input').filter(node=>String(node.props['aria-label']??'').startsWith('套用'))).toHaveLength(0);
    await click(button(s.tree,'取消'));expect(s.requests).toHaveLength(0);expect((s.current.snapshot.catalog as any).products).toHaveLength(1);
  });
  it('creates a complete basic product only on Save with server-owned identity and no hidden second write',async()=>{
    const s=await setup(source(),null);await change(field(s.tree,'商品名稱'),'New product');await change(field(s.tree,'基本價格'),'20.00');
    await click(button(s.tree,'建立商品並儲存草稿'));expect(s.requests).toHaveLength(1);expect(s.requests[0].url).toContain('/draft/products');expect(s.requests[0].payload.product).not.toHaveProperty('id');expect(s.requests[0].payload.product).not.toHaveProperty('productCode');expect((s.current.snapshot.catalog as any).products.at(-1).id).toBe('server-id');
  });
});

function browser(){
  const target=new EventTarget(),entries=[{url:'https://fixture.invalid/admin/catalog/categories#before',state:{route:'before'}},{url:'https://fixture.invalid/admin/catalog/products#list',state:{route:'products'}}];
  let index=1;
  const location={href:entries[index].url};
  const pop=()=>{location.href=entries[index].url;target.dispatchEvent(new Event('popstate'));};
  const history={
    get state(){return entries[index].state;},get length(){return entries.length;},get index(){return index;},
    pushState(state:any,_unused:string,url:string){entries.splice(index+1);entries.push({state,url});index++;location.href=url;},
    replaceState(state:any,_unused:string,url:string){entries[index]={state,url};location.href=url;},
    back(){if(index>0){index--;pop();}},forward(){if(index<entries.length-1){index++;pop();}},
  };
  vi.stubGlobal('window',{location,history,addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target)});
  return {target,location,history};
}

describe('product sheet interruption and history ownership',()=>{
  it('dirty reload warns, clean reload does not, and unmount removes warning listeners',async()=>{
    const b=browser(),s=await setup();let event=new Event('beforeunload',{cancelable:true});b.target.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
    await change(field(s.tree,'商品名稱'),'Unsaved');event=new Event('beforeunload',{cancelable:true});b.target.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
    await act(async()=>s.tree.unmount());event=new Event('beforeunload',{cancelable:true});b.target.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
  });
  it('uncertain saves retain local inputs, prohibit blind retry and permit explicit readback',async()=>{
    const s=await setup();s.fetcher.mockRejectedValueOnce(new TypeError('Network unavailable'));
    await change(field(s.tree,'商品名稱'),'Possibly saved');await click(button(s.tree,'儲存正式草稿'));
    expect(content(s.tree.root)).toContain('儲存結果未確認');expect(field(s.tree,'商品名稱').props.value).toBe('Possibly saved');expect(button(s.tree,'儲存正式草稿').props.disabled).toBe(true);
    await click(button(s.tree,'儲存正式草稿'));expect(s.fetcher).toHaveBeenCalledOnce();await click(button(s.tree,'重新讀取草稿'));expect(s.requests.at(-1).method).toBe('GET');expect(button(s.tree,'儲存正式草稿').props.disabled).toBe(true);
  });
  it('retains a dirty form and an explicit discard route when its product is deleted during refetch',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'Pending');const snapshot=structuredClone(s.current.snapshot) as any;snapshot.catalog.products=[];snapshot.optionCenter.productLinks=[];
    await act(async()=>{s.client.setQueryData(v3FormalDraftQueryKey('MF01'),{...s.current,draftRevision:4,snapshot});await new Promise(resolve=>setTimeout(resolve,10));});
    expect(field(s.tree,'商品名稱').props.value).toBe('Pending');expect(button(s.tree,'儲存正式草稿').props.disabled).toBe(true);
    await click(button(s.tree,'取消'));await click(button(s.tree,'放棄變更並關閉'));expect(s.onClose).toHaveBeenCalledOnce();
  });

});


describe('product editor late completion',()=>{
  it('does not close a newer editor when an old unmounted save settles',async()=>{
    const s=await setup();let resolve!:(value:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    let pending:any;await act(async()=>{pending=button(s.tree,'儲存正式草稿').props.onClick();await Promise.resolve();});
    await act(async()=>s.tree.update(s.render('p1','new-editor')));
    await act(async()=>{resolve(new Response(JSON.stringify({...s.current,draftRevision:4})));await pending;});
    expect(s.onClose).not.toHaveBeenCalled();expect(content(s.tree.root)).toContain('商品選項與預設');
  });
});

describe('option-only save preserves raw basic fields',()=>{
  it('does not synthesize absent optional basic fields',async()=>{
    const snapshot=source();delete snapshot.catalog.products[0].description;delete snapshot.catalog.products[0].active;
    const s=await setup(snapshot);await click(button(s.tree,'清除 Size 預設'));await click(button(s.tree,'儲存正式草稿'));
    const product=(s.current.snapshot.catalog as any).products[0];expect(Object.hasOwn(product,'description')).toBe(false);expect(Object.hasOwn(product,'active')).toBe(false);
  });
  it('does not trim unchanged historical basic text',async()=>{
    const snapshot=source();snapshot.catalog.products[0].name=' Product ';snapshot.catalog.products[0].description='  keep spaces  ';
    const s=await setup(snapshot);await click(button(s.tree,'清除 Size 預設'));await click(button(s.tree,'儲存正式草稿'));
    expect((s.current.snapshot.catalog as any).products[0]).toMatchObject({name:' Product ',description:'  keep spaces  '});
  });
});

describe('product draft response integrity',()=>{
  it('does not replace newer refetched revision 5 with late successful PUT revision 4',async()=>{
    const s=await setup();let resolve!:(r:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>resolve=done));
    let pending:any;await act(async()=>{pending=button(s.tree,'儲存正式草稿').props.onClick();await Promise.resolve();});
    const response4={...s.current,draftRevision:4},newer={...s.current,draftRevision:5,snapshot:{...s.current.snapshot,newer:'retain'}};
    await act(async()=>{s.client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);await new Promise(done=>setTimeout(done,10));});
    await act(async()=>{resolve(new Response(JSON.stringify(response4)));await pending;});
    expect(s.client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(newer);
  });
  it.each(['different-draft','discarded','different-store','equal-revision-conflict'])('rejects late response crossing %s without replacing current identity',async kind=>{
    const s=await setup();let resolve!:(r:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>resolve=done));
    let pending:any;await act(async()=>{pending=button(s.tree,'儲存正式草稿').props.onClick();await Promise.resolve();});
    const response={...s.current,draftRevision:4,storeId:kind==='different-store'?'OTHER':'MF01'};
    const current=kind==='discarded'?null:kind==='different-draft'?{...s.current,draftId:'new-draft'}:kind==='equal-revision-conflict'?{...s.current,draftRevision:4,snapshot:{...s.current.snapshot,newer:true}}:s.current;
    await act(async()=>{s.client.setQueryData(v3FormalDraftQueryKey('MF01'),current);await new Promise(done=>setTimeout(done,10));});
    await act(async()=>{resolve(new Response(JSON.stringify(response)));await pending;});
    expect(s.client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(current);expect(s.onClose).not.toHaveBeenCalled();expect(content(s.tree.root)).toContain('儲存結果未確認');
  });
  it('invalidates an already-open discard action when Save starts',async()=>{
    const s=await setup();await change(field(s.tree,'商品名稱'),'Pending');await click(button(s.tree,'取消'));
    const discard=button(s.tree,'放棄變更並關閉').props.onClick;let resolve!:(r:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>resolve=done));
    let pending:any;await act(async()=>{pending=button(s.tree,'儲存正式草稿').props.onClick();await Promise.resolve();});
    await act(async()=>discard());expect(s.onClose).not.toHaveBeenCalled();
    await act(async()=>{resolve(new Response(JSON.stringify({...s.current,draftRevision:4})));await pending;});expect(s.onClose).toHaveBeenCalledOnce();
  });
  it('guards clean-but-uncertain close and reload just like dirty edits',async()=>{
    const b=browser(),s=await setup();s.fetcher.mockRejectedValueOnce(new TypeError('Network unavailable'));await click(button(s.tree,'儲存正式草稿'));
    await click(button(s.tree,'取消'));expect(s.onClose).not.toHaveBeenCalled();expect(content(s.tree.root)).toContain('放棄未儲存變更');
    const event=new Event('beforeunload',{cancelable:true});b.target.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
  });
});

describe('in-flight draft read and session integrity',()=>{
  it('cancels an older in-flight read so it cannot overwrite a completed save',async()=>{
    const s=await setup();let resolveRead!:(r:Response)=>void;
    const response4={...s.current,draftRevision:4,snapshot:{...s.current.snapshot,saved:true}};
    s.fetcher.mockImplementation(async(_url:RequestInfo|URL,init?:RequestInit)=>init?.method==='GET'?new Promise(done=>resolveRead=done):new Response(JSON.stringify(response4)));
    let reading!:Promise<unknown>;await act(async()=>{reading=s.client.fetchQuery({queryKey:v3FormalDraftQueryKey('MF01'),queryFn:async()=>{const response=await fetch('/synthetic',{method:'GET'});return response.json();}}).catch(error=>error);await Promise.resolve();});
    await click(button(s.tree,'儲存正式草稿'));
    await act(async()=>{resolveRead(new Response(JSON.stringify(s.current)));await reading;});
    expect(s.client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(response4);
  });
  it('does not install a pending write response after its provider session is replaced',async()=>{
    const s=await setup();let resolve!:(r:Response)=>void;s.fetcher.mockImplementation(()=>new Promise(done=>resolve=done));
    let pending:any;await act(async()=>{pending=button(s.tree,'儲存正式草稿').props.onClick();await Promise.resolve();});
    const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'a27',snapshot:source()});
    await act(async()=>s.tree.update(<QueryClientProvider client={s.client}><V3FormalDraftProvider key='new-session' canonical={canonical} storeId='MF01' sessionToken='new-synthetic'><FormalProductEditor productId='p1' onClose={s.onClose}/></V3FormalDraftProvider></QueryClientProvider>));
    await act(async()=>{resolve(new Response(JSON.stringify({...s.current,draftRevision:4})));await pending;});
    expect(s.client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(s.current);expect(s.onClose).not.toHaveBeenCalled();
  });
});
