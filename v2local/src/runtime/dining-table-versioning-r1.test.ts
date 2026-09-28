import {beforeEach,describe,expect,it,vi} from 'vitest';
const KEY='mfk.v2local.runtime.v1';
const ADMIN='mfk.admin-sync.active.v1';
function config(name='堂7',version='V1'){return {schema:'MFK_ADMIN_CONFIG_SYNC_V1',storeId:'MF01',revision:1,publishedAt:new Date().toISOString(),adminFingerprint:'x',fingerprint:'x',snapshot:{storeSettings:{diningTables:[{id:'T0007',name,active:true,sortOrder:1,versions:[{versionId:version,label:name,status:'ACTIVE'}]}]}}};}
describe('Dining table version capture R1',()=>{
 beforeEach(()=>{vi.resetModules();const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,String(v)),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size;}}});localStorage.setItem(ADMIN,JSON.stringify(config()));});
 it('captures immutable label/version and survives restart while legacy remains unknown',async()=>{
  let mod=await import('./local-runtime.ts');let runtime=mod.localRuntime as any;
  const hold=runtime.createHold({kind:'dining',items:[{id:'x',name:'x',qty:1,unitMinor:1}],totalMinor:1,partySize:1});
  await runtime.assignDiningTable(hold.id,'T0007');
  let detail=await runtime.readDiningHold(hold.id);expect(detail.tableLabelAtOpen).toBe('堂7');expect(detail.tableVersionAtOpen).toBe('V1');
  localStorage.setItem(ADMIN,JSON.stringify(config('窗1','V2')));
  detail=await runtime.readDiningHold(hold.id);expect(detail.tableLabelAtOpen).toBe('堂7');expect(detail.tableVersionAtOpen).toBe('V1');
  vi.resetModules();mod=await import('./local-runtime.ts');detail=await (mod.localRuntime as any).readDiningHold(hold.id);expect(detail.tableLabelAtOpen).toBe('堂7');
 });
 it('occupancy fresh read is runtime truth with revision',async()=>{const mod=await import('./local-runtime.ts');const runtime=mod.localRuntime as any;const h=runtime.createHold({kind:'dining',items:[{id:'x',name:'x',qty:1,unitMinor:1}],totalMinor:1});await runtime.assignDiningTable(h.id,'T0007');const r=mod.readDiningOccupancy('T0007');expect(r.activeSessionCount).toBe(1);expect(r.runtimeRevision).toBeGreaterThan(0);});
});