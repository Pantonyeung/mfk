import React from 'react';
// @ts-expect-error Existing test-only renderer dependency has no installed declarations.
import {act,create} from 'react-test-renderer';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {LinkedPreservationDisclosure} from './linked-preservation-proof.tsx';
const trees:any[]=[];
afterEach(async()=>{for(const tree of trees.splice(0))await act(async()=>tree.unmount());vi.unstubAllGlobals();});
function health(state='MATCH'){
 const metadata={storeId:'MF01',fingerprint:'fnv1a32:12345678',revision:8,publishedAt:'2026-10-03T01:00:00Z',observedAt:'2026-10-03T16:00:00Z'};
 return {preservationProof:{scope:'MFP_V3_LINKED_TEST_MF01_20261003',evidenceKind:'CANONICAL_IDENTITY_COMPARISON',fingerprintAlgorithm:'fnv1a32',observedAt:metadata.observedAt,state,original:metadata,bootstrap:{fingerprint:metadata.fingerprint,publishedAt:metadata.publishedAt,revision:null},linked:{...metadata,fingerprint:'fnv1a32:87654321',revision:3},isolatedCounts:{requestRecords:2,unseenPending:0,seenPending:1,rejected:1,other:0,adminOrderProjectionRecords:0},unavailableReasons:[]}};
}
async function mount(read:()=>Promise<unknown>){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let tree:any;await act(async()=>{tree=create(<LinkedPreservationDisclosure read={read}/>);});trees.push(tree);return tree;}
const content=(tree:any)=>JSON.stringify(tree.toJSON());
describe('explicit read-only acceptance evidence disclosure',()=>{
 it('does not fetch on mount and displays only canonical metadata after an explicit refresh',async()=>{
  const read=vi.fn(async()=>health()),tree=await mount(read);expect(read).not.toHaveBeenCalled();expect(content(tree)).toContain('尚未讀取');
  await act(async()=>tree.root.findByType('button').props.onClick());expect(read).toHaveBeenCalledTimes(1);
  const html=content(tree);for(const text of ['驗收資料','MATCH','fnv1a32:12345678','fnv1a32:87654321','NOT CONNECTED','未記錄','Admin 訂單投影記錄'])expect(html).toContain(text);
  expect(html).not.toContain('全域正式訂單：0');expect(html).not.toContain('全庫未改動');
 });
 it('shows unavailable instead of stale match or invented zero on refresh failure',async()=>{
  let fail=false;const tree=await mount(async()=>{if(fail)throw Error('offline');return health();});await act(async()=>tree.root.findByType('button').props.onClick());expect(content(tree)).toContain('MATCH');fail=true;
  await act(async()=>tree.root.findByType('button').props.onClick());expect(content(tree)).toContain('UNAVAILABLE');expect(content(tree)).not.toContain('fnv1a32:12345678');expect(content(tree)).not.toContain('MATCH');
 });
 it('rejects fabricated match metadata and never renders extra private fields',async()=>{
  const input=health();input.preservationProof.original.fingerprint='fnv1a32:99999999';(input as any).sessionToken='PRIVATE_TOKEN';(input.preservationProof as any).snapshot={staffAuth:'PRIVATE_DATA'};
  const tree=await mount(async()=>input);await act(async()=>tree.root.findByType('button').props.onClick());const html=content(tree);expect(html).toContain('UNAVAILABLE');expect(html).not.toMatch(/PRIVATE_TOKEN|PRIVATE_DATA/);
 });
 it('keeps the newest explicit read when responses arrive out of order',async()=>{
  const resolves:((value:unknown)=>void)[]=[],tree=await mount(()=>new Promise(r=>resolves.push(r)));let first:any,second:any;
  await act(async()=>{first=tree.root.findByType('button').props.onClick();second=tree.root.findByType('button').props.onClick();});
  const newer=health('CHANGED');newer.preservationProof.original.fingerprint='fnv1a32:99999999';await act(async()=>{resolves[1](newer);await second;});expect(content(tree)).toContain('CHANGED');
  await act(async()=>{resolves[0](health());await first;});expect(content(tree)).toContain('CHANGED');expect(content(tree)).not.toContain('MATCH');
 });
 it('discards an old pending response after unmount',async()=>{
  let resolve!:(value:unknown)=>void;const read=vi.fn(()=>new Promise(r=>{resolve=r;})),tree=await mount(read);let pending:any;await act(async()=>{pending=tree.root.findByType('button').props.onClick();});await act(async()=>tree.unmount());trees.splice(trees.indexOf(tree),1);await act(async()=>{resolve(health());await pending;});expect(read).toHaveBeenCalledTimes(1);expect(tree.toJSON()).toBeNull();
 });
});
