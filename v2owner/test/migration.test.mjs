import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const srcRoot=path.resolve(testDir,'../src');
const registry=JSON.parse(fs.readFileSync(path.join(srcRoot,'capabilities.json'),'utf8'));

function readSources(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const target=path.join(dir,entry.name);
    if(entry.isDirectory())return readSources(target);
    if(!/\.(ts|tsx|js|jsx)$/.test(entry.name))return [];
    return [fs.readFileSync(target,'utf8')];
  });
}
const source=readSources(srcRoot).join('\n');

test('owner capability registry is complete and stable',()=>{
  assert.equal(registry.length,94);
  assert.equal(new Set(registry.map(item=>item.CAP_ID)).size,94);
  for(const item of registry){
    for(const key of ['CAP_ID','GROUP','LABEL','SURFACE','KIND','STATUS','OWNER'])assert.ok(item[key],item.CAP_ID+' missing '+key);
    assert.ok(['READ_SHAPE','COMMAND_SHAPE'].includes(item.KIND));
  }
});

test('all owner command shapes are explicitly NOT_WIRED',()=>{
  const commands=registry.filter(item=>item.KIND==='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  assert.deepEqual([...new Set(commands.map(item=>item.STATUS))],['NOT_WIRED']);
});

test('required owner migration surfaces are registered',()=>{
  const ids=new Set(registry.map(item=>item.CAP_ID));
  for(const id of [
    'TODAY_HOME','EFFECTIVE_SALES','ORDER_COUNT','AVERAGE_ORDER_VALUE','BASIC_COMPARISON',
    'ACTION_QUEUE','ORDER_LIST','ORDER_DETAIL','ORDER_STATUS_READBACK','CHANNEL_HEALTH',
    'CHANNEL_PAUSE','SELLABILITY_LIST','PRODUCT_SOLD_OUT','STAFF_PRESENCE','STAFF_ROLE_PERMISSION',
    'DEVICE_HEALTH','PRINTER_HEALTH','REPORTS_HOME','NOTIFICATION_CENTRE','COMMAND_CONFIRM',
    'ADMIN_DEEP_LINK','RECOVERY_OFFLINE','RECOVERY_STALE','RECOVERY_UNKNOWN','RECOVERY_PARTIAL',
    'RECOVERY_FAILURE','RECOVERY_RETRY','ACTIVITY_FEED'
  ])assert.ok(ids.has(id),id);
});

test('owner clean port contains zero live network or cross-port authority calls',()=>{
  const forbidden=[
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\baxios\b/,
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /\/api\//,
    /window\.location/,
    /v2local\//,
    /v2admin\//,
    /v2smm\//,
    /v2customer\//,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./i,
    /physicalPrinter\s*\./i,
    /cashDrawer\s*\./i
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
});

test('owner UI declares migration boundary and recovery semantics',()=>{
  for(const marker of ['PORT_MIGRATION_ONLY','Command = NOT_WIRED','今日','待處理','訂單','更多','OFFLINE','STALE','UNKNOWN','PARTIAL','FAILURE','RETRY'])assert.match(source,new RegExp(marker));
});

test('owner shell exposes no second POS or Admin authoring flow',()=>{
  assert.match(source,/READ_SHAPE ONLY/);
  assert.match(source,/Structural config 留 Admin/);
  assert.match(source,/physical \/ transaction execution 留 SMT/);
});
