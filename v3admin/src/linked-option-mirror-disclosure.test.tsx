import React from 'react';
// @ts-expect-error Existing test-only renderer dependency has no installed declarations.
import {act,create} from 'react-test-renderer';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LinkedOptionMirrorDisclosure} from './linked-option-mirror-disclosure.tsx';
import * as planner from './linked-option-mirror-plan.ts';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {V3FormalDraftProvider,v3FormalDraftQueryKey,type V3FormalAdminDraft} from './formal-draft.tsx';

const context=vi.hoisted(()=>({value:null as any}));
vi.mock('./formal-draft.tsx',async importOriginal=>{
  const actual=await importOriginal<typeof import('./formal-draft.tsx')>();
  return {...actual,useV3FormalDraft:()=>context.value??actual.useV3FormalDraft()};
});
const trees:any[]=[];
const clients:QueryClient[]=[];
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);context.value=null;});
afterEach(async()=>{for(const tree of trees.splice(0))await act(async()=>tree.unmount());for(const client of clients.splice(0))client.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
function source(){
  return {
    catalog:{categories:[{id:'cat',name:'Food',active:true,position:10}],products:[{id:'p1',name:'Product',productCode:'P1',categoryId:'cat',basePrice:'12.00',description:'',active:true,modifierGroupIds:[]}],modifierGroups:[]},
    optionCenter:{sets:[{id:'g1',name:'Size',selection:'SINGLE',min:1,max:1,required:true,forceShow:true,allowQuantities:false,active:true,options:[{id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,position:10}]}],productLinks:[{productId:'p1',setId:'g1',defaultOptionIds:['o1']}]},
    privateExtra:{secret:'PRIVATE_SNAPSHOT_VALUE'},
  };
}
function formal(snapshot:Record<string,unknown>=source()){
  const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:8,publishedAt:'2026-10-03T01:00:00Z',adminFingerprint:'a8',snapshot});
  const draft:V3FormalAdminDraft={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',draftRevision:2,baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'fixture'};
  return {canonical,draft,workingSnapshot:snapshot,isLoading:false,isSaving:false,isPublishing:false,isRollingBack:false,readError:null as Error|null,error:null as Error|null,
    mutateSnapshot:vi.fn(async(mutator:(current:Record<string,unknown>)=>Record<string,unknown>)=>({...draft,draftRevision:3,snapshot:mutator(snapshot)})),
    saveSnapshot:vi.fn(),publish:vi.fn(),discard:vi.fn(),refresh:vi.fn()};
}
const content=(tree:any)=>JSON.stringify(tree.toJSON());
const planState=(tree:any)=>tree.root.findAllByProps({'aria-label':'唯讀選項相容性結果'})[0]?.findByType('strong').children.join('')??'';
const button=(tree:any,label:string)=>tree.root.findAllByType('button').find((node:any)=>node.children.join('')===label)!;
const inspect=(tree:any)=>act(async()=>{await button(tree,'檢查選項相容性').props.onClick();});
const prepare=(tree:any)=>act(async()=>{await button(tree,'準備鏡像對齊草稿').props.onClick();});
async function mount(value=formal()){
  context.value=value;let tree:any;await act(async()=>{tree=create(<LinkedOptionMirrorDisclosure/>);});trees.push(tree);return tree;
}
async function update(tree:any,value:any){context.value=value;await act(async()=>tree.update(<LinkedOptionMirrorDisclosure/>));}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

describe('linked-only explicit option compatibility disclosure',()=>{
  it('does not plan, write or fetch until inspection, and inspection stays read-only',async()=>{
    const spy=vi.spyOn(planner,'planLinkedOptionMirrors'),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const value=formal(),tree=await mount(value);expect(spy).not.toHaveBeenCalled();expect(content(tree)).toContain('尚未檢查');
    await inspect(tree);expect(spy).toHaveBeenCalledOnce();expect(planState(tree)).toBe('READY');expect(value.mutateSnapshot).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
  it('shows only allowed counts, IDs, codes and paths without snapshots, prices or private extras',async()=>{
    const tree=await mount();await inspect(tree);const html=content(tree);
    expect(planState(tree)).toBe('READY');expect(html).toContain('canonical');expect(html).toContain('legacy');expect(html).toContain('/snapshot/catalog');
    for(const disclosed of ['OPTION_MIRROR_CONFLICT','OPTION_BINDING_MIRROR_CONFLICT','g1','p1'])expect(html).toContain(disclosed);
    expect(html).not.toMatch(/PRIVATE_SNAPSHOT_VALUE|privateExtra|12\.00|0\.00|"productLinks"|"baseline"/);
    expect(html).toContain('原始 MF01');expect(html).toContain('隔離測試草稿');
  });
  it('shows raw missing option IDs from an actual safe partial mirror fixture',async()=>{
    const snapshot=source();snapshot.catalog.modifierGroups.push({...snapshot.optionCenter.sets[0],options:[]} as never);
    const tree=await mount(formal(snapshot));await inspect(tree);expect(planState(tree)).toBe('READY');
    for(const disclosed of ['OPTION_MIRROR_CONFLICT','OPTION_BINDING_MIRROR_CONFLICT','g1','o1','p1','/snapshot/catalog/modifierGroups/0/options/0'])expect(content(tree)).toContain(disclosed);
  });
  it('identifies the inspected canonical and draft metadata without revealing the baseline',async()=>{
    const value=formal(),tree=await mount(value);await inspect(tree);expect(content(tree)).toContain(value.canonical.fingerprint);expect(content(tree)).toContain('canonical revision 8');expect(content(tree)).toContain('draft revision 2');
    await update(tree,{...value,draft:null});await inspect(tree);expect(content(tree)).toContain('尚無草稿');
  });
  it('masks unknown extension paths and never renders diagnostic messages',async()=>{
    const value=formal(),tree=await mount(value);vi.spyOn(planner,'planLinkedOptionMirrors').mockReturnValue({state:'BLOCKED',baseline:'PRIVATE_BASELINE',summary:{canonicalSets:1,legacySets:0,bindingConflicts:1},diagnostics:[{code:'OPTION_EXTENSION_UNVALIDATED',path:'/snapshot/optionCenter/PRIVATE_KEY',message:'PRIVATE_MESSAGE'}],changedPaths:[]});await inspect(tree);expect(content(tree)).toContain('未驗證欄位');expect(content(tree)).not.toMatch(/PRIVATE_BASELINE|PRIVATE_KEY|PRIVATE_MESSAGE/);
  });
  it('blocks orphan facts and unchanged plans rather than offering a write',async()=>{
    const snapshot=source();snapshot.catalog.modifierGroups.push({...snapshot.optionCenter.sets[0],id:'orphan'} as never);
    const value=formal(snapshot),tree=await mount(value);await inspect(tree);expect(planState(tree)).toBe('BLOCKED');expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);await prepare(tree);expect(value.mutateSnapshot).not.toHaveBeenCalled();
    const ready=planner.planLinkedOptionMirrors(source());expect(ready.state).toBe('READY');await update(tree,formal(ready.snapshot!));await inspect(tree);expect(planState(tree)).toBe('UNCHANGED');expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);
  });
  it('prepares exactly the real planner candidate using the existing atomic mutator only',async()=>{
    const value=formal(),tree=await mount(value);await inspect(tree);await prepare(tree);
    expect(value.mutateSnapshot).toHaveBeenCalledOnce();const result=await value.mutateSnapshot.mock.results[0].value;
    expect(result.snapshot).toEqual(planner.planLinkedOptionMirrors(value.workingSnapshot).snapshot);
    expect(value.saveSnapshot).not.toHaveBeenCalled();expect(value.publish).not.toHaveBeenCalled();expect(value.discard).not.toHaveBeenCalled();
  });
  it('invalidates a preview and its captured click callback after a source or draft revision changes',async()=>{
    const value=formal(),tree=await mount(value);await inspect(tree);const oldClick=button(tree,'準備鏡像對齊草稿').props.onClick;
    await update(tree,{...value,draft:{...value.draft,draftRevision:3}});expect(content(tree)).toContain('重新檢查');expect(planState(tree)).toBe('');await act(async()=>oldClick());expect(value.mutateSnapshot).not.toHaveBeenCalled();
    await inspect(tree);expect(planState(tree)).toBe('READY');
  });
  it('revalidates the actual current snapshot inside the existing mutator before any write',async()=>{
    const value=formal(),tree=await mount(value);await inspect(tree);let writes=0;
    value.mutateSnapshot.mockImplementation(async mutator=>{const candidate=mutator({...value.workingSnapshot,newer:true});writes++;return {...value.draft,snapshot:candidate};});
    await prepare(tree);expect(writes).toBe(0);expect(content(tree)).toContain('DRAFT_SAVE_UNCONFIRMED');expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);
  });
  it('coalesces same-frame duplicate clicks before React commits pending state',async()=>{
    const value=formal(),pending=deferred<V3FormalAdminDraft>();value.mutateSnapshot.mockImplementation(()=>pending.promise);
    const tree=await mount(value);await inspect(tree);const click=button(tree,'準備鏡像對齊草稿').props.onClick;let first:any;
    await act(async()=>{first=click();void click();});expect(value.mutateSnapshot).toHaveBeenCalledOnce();expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);
    await act(async()=>{pending.resolve(value.draft);await first;});
  });
  it('does not render an old success after a newer source has replaced a pending write',async()=>{
    const value=formal(),pending=deferred<V3FormalAdminDraft>();value.mutateSnapshot.mockImplementation(()=>pending.promise);
    const tree=await mount(value);await inspect(tree);let saving:any;await act(async()=>{saving=button(tree,'準備鏡像對齊草稿').props.onClick();});
    await update(tree,formal({...source(),newer:true}));await act(async()=>{pending.resolve(value.draft);await saving;});
    expect(content(tree)).not.toContain('DRAFT_PREPARED');expect(content(tree)).toContain('重新檢查');
  });
  it('never revives old success after intervening source changes even when the expected candidate later appears',async()=>{
    const value=formal(),candidate=planner.planLinkedOptionMirrors(value.workingSnapshot).snapshot!,saved={...value.draft,draftRevision:3,snapshot:candidate},pending=deferred<V3FormalAdminDraft>();value.mutateSnapshot.mockImplementation(()=>pending.promise);
    const tree=await mount(value);await inspect(tree);let saving:any;await act(async()=>{saving=button(tree,'準備鏡像對齊草稿').props.onClick();});
    await update(tree,{...value,workingSnapshot:{...source(),unrelated:true},draft:{...value.draft,draftRevision:4}});
    await update(tree,{...value,workingSnapshot:candidate,draft:saved});await act(async()=>{pending.resolve(saved);await saving;});
    expect(content(tree)).not.toContain('DRAFT_PREPARED');
  });
  it('rejects a delayed mutator callback after the rendered source changes',async()=>{
    const value=formal(),pending=deferred<V3FormalAdminDraft>();let apply!:(snapshot:Record<string,unknown>)=>Record<string,unknown>;
    value.mutateSnapshot.mockImplementation(mutator=>{apply=mutator;return pending.promise;});
    const tree=await mount(value);await inspect(tree);let saving:any;await act(async()=>{saving=button(tree,'準備鏡像對齊草稿').props.onClick();});
    await update(tree,formal({...source(),newer:true}));expect(()=>apply(value.workingSnapshot)).toThrow('LINKED_OPTION_PREVIEW_STALE');await act(async()=>{pending.reject(Error('stale'));await saving;});expect(content(tree)).not.toContain('DRAFT_SAVE_UNCONFIRMED');
  });
  it('ignores pending completion and captured actions after unmount',async()=>{
    const value=formal(),pending=deferred<V3FormalAdminDraft>();value.mutateSnapshot.mockImplementation(()=>pending.promise);
    const tree=await mount(value);await inspect(tree);const click=button(tree,'準備鏡像對齊草稿').props.onClick;let saving:any;
    await act(async()=>{saving=click();});await act(async()=>tree.unmount());trees.splice(trees.indexOf(tree),1);await act(async()=>{pending.resolve(value.draft);await saving;await click();});
    expect(value.mutateSnapshot).toHaveBeenCalledOnce();expect(tree.toJSON()).toBeNull();
  });
  it.each(['isLoading','isSaving','isPublishing','isRollingBack','readError'] as const)('fails closed and invalidates prior readiness on %s',async key=>{
    const value=formal(),tree=await mount(value);await inspect(tree);const oldClick=button(tree,'準備鏡像對齊草稿').props.onClick;
    await update(tree,{...value,[key]:key==='readError'?Error('PRIVATE_ERROR'):true});expect(planState(tree)).toBe('');expect(content(tree)).not.toContain('PRIVATE_ERROR');expect(button(tree,'檢查選項相容性').props.disabled).toBe(true);
    await act(async()=>oldClick());expect(value.mutateSnapshot).not.toHaveBeenCalled();await update(tree,value);expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);
  });
  it('fails closed on planner exceptions without rendering private exception text',async()=>{
    const tree=await mount();vi.spyOn(planner,'planLinkedOptionMirrors').mockImplementation(()=>{throw Error('PRIVATE_ERROR');});await inspect(tree);
    expect(content(tree)).toContain('INSPECTION_UNAVAILABLE');expect(content(tree)).not.toContain('PRIVATE_ERROR');expect(button(tree,'準備鏡像對齊草稿').props.disabled).toBe(true);
  });
  it('keeps failed saves locked without automatic or blind manual retry',async()=>{
    const value=formal();value.mutateSnapshot.mockRejectedValue(Error('PRIVATE_ERROR'));
    const tree=await mount(value);await inspect(tree);await prepare(tree);await inspect(tree);await prepare(tree);
    expect(value.mutateSnapshot).toHaveBeenCalledOnce();expect(content(tree)).toContain('DRAFT_SAVE_UNCONFIRMED');expect(content(tree)).not.toContain('PRIVATE_ERROR');
  });
  it('uses the real provider draft CAS with a real safe fixture, without mount or inspection network',async()=>{
    const value=formal(),client=new QueryClient({defaultOptions:{queries:{enabled:false},mutations:{retry:false}}});clients.push(client);client.setQueryData(v3FormalDraftQueryKey('MF01'),value.draft);
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({...value.draft,draftRevision:3,snapshot:body.snapshot}));});vi.stubGlobal('fetch',fetcher);
    let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={client}><V3FormalDraftProvider storeId="MF01" sessionToken="synthetic" canonical={value.canonical}><LinkedOptionMirrorDisclosure/></V3FormalDraftProvider></QueryClientProvider>);});trees.push(tree);
    await inspect(tree);expect(fetcher).not.toHaveBeenCalled();await prepare(tree);expect(fetcher).toHaveBeenCalledOnce();expect(content(tree)).toContain('DRAFT_PREPARED');expect(content(tree)).toContain('尚未發佈');
    const [url,init]=fetcher.mock.calls[0];expect(url).toBe('/api/admin-browser/draft?storeId=MF01');expect(init?.method).toBe('PUT');expect(JSON.parse(String(init?.body))).toMatchObject({expectedDraftRevision:2,baseFingerprint:value.canonical.fingerprint,snapshot:planner.planLinkedOptionMirrors(value.workingSnapshot).snapshot});
  });
});
