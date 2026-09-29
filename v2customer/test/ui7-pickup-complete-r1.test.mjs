import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const repoRoot=path.resolve(here,'../..');
const app=fs.readFileSync(path.join(src,'App.tsx'),'utf8');
const ui7=fs.readFileSync(path.join(src,'components/customer-pickup-ui7.tsx'),'utf8');
const ui6=fs.readFileSync(path.join(src,'components/customer-fulfillment-ui6.tsx'),'utf8');
const types=fs.readFileSync(path.join(src,'product-types.ts'),'utf8');
const styles=fs.readFileSync(path.join(src,'styles.css'),'utf8');
const primitives=fs.readFileSync(path.join(src,'ui/primitives.tsx'),'utf8');
const admin=fs.readFileSync(path.join(repoRoot,'v2admin/worker.ts'),'utf8');

test('UI7 route owns READY onward while UI6 remains the pre-pickup read-only surface',()=>{
  assert.match(app,/const pickupMatch=pathname\.match/);
  assert.match(app,/return \{view:'pickup',pickupOrderId/);
  assert.match(app,/openPickupRoute/);
  assert.match(app,/\['READY','ARRIVED','VERIFIED','HANDED_OVER','PICKUP_EXCEPTION','COMPLETED'\]/);
  assert.match(app,/PickupCompleteUi7View/);
  assert.match(ui6,/可取餐唔代表已交收/);
});

test('core Stage 7 state lock stays explicit',()=>{
  for(const state of['READY','ARRIVED','VERIFIED','HANDED_OVER','COMPLETED']){
    assert.match(types,new RegExp("\\|'"+state+"'|='"+state+"'"));
  }
  assert.match(ui7,/真正交畀你之後先會顯示完成/);
  assert.match(ui7,/到店通知唔等於核對、交收或完成|我到了/);
  assert.match(ui7,/真正交付完成後/);
  assert.match(ui7,/問題解決前，訂單唔會顯示「已完成」/);
});

test('arrival seam is classified unavailable and never mutates fulfillment',()=>{
  assert.match(ui7,/SAFE_UNAVAILABLE_FIRST_BREAK:CUSTOMER_ARRIVAL_NOTIFICATION_SEAM_MISSING_IN_CURRENT_MAIN/);
  assert.match(ui7,/>我到了</);
  assert.match(ui7,/disabled aria-disabled="true"/);
  assert.match(ui7,/功能稍後開放/);
  assert.doesNotMatch(ui7,/requestArrival|arrivalFetch|markArrived|setArrived/);
});

test('ARRIVED VERIFIED HANDED_OVER COMPLETED are canonical readback-only projections',()=>{
  assert.match(admin,/customerHandoverState/);
  assert.match(admin,/canonicalHandover==='ARRIVED'\?'ARRIVED'/);
  assert.match(admin,/canonicalHandover==='VERIFIED'\?'VERIFIED'/);
  assert.match(admin,/canonicalHandover==='HANDED_OVER'\?'HANDED_OVER'/);
  assert.match(admin,/canonicalHandover==='COMPLETED'\?'COMPLETED'/);
  assert.doesNotMatch(ui7,/markOrderReady|acceptOrder|updateFulfillment|completeOrder|handoverOrder/);
});

test('unresolved pickup exception always blocks Completed projection',()=>{
  assert.match(admin,/if\(pickupException&&pickupException\.resolved!==true\)stage='PICKUP_EXCEPTION'/);
  assert.match(ui7,/const unresolvedException=Boolean/);
  assert.match(ui7,/unresolvedException\?'PICKUP_EXCEPTION':canonicalStage/);
  assert.match(ui7,/CODE_MISMATCH/);
  assert.match(ui7,/MISSING_BAG/);
  assert.match(ui7,/SAME_NAME/);
});

test('Pickup Code and Display Number remain separate and no internal identity is rendered',()=>{
  assert.match(ui7,/>取餐碼</);
  assert.match(ui7,/>流水號</);
  assert.match(ui7,/取餐碼同流水號用途不同/);
  assert.match(ui7,/取餐時跟畫面提示出示即可/);
  assert.doesNotMatch(ui7,/\{order\??\.orderId\}/);
  assert.doesNotMatch(ui7,/\{intent\??\.canonicalOrderId\}/);
});

test('completion time is shown only from canonical projected fact',()=>{
  assert.match(ui7,/const completedAt=order\?\.completedAt\?\?historyOrder\?\.completedAt/);
  assert.match(ui7,/formatTime\(completedAt\)/);
  assert.match(ui7,/完成時間暫未提供；畫面唔會自行估算/);
  assert.doesNotMatch(ui7,/Date\.now\(\).*completed|new Date\(\)\.toISOString\(\).*completed/i);
});

test('UI7 preserves weak-network fail-closed freshness',()=>{
  for(const state of['LOADING','ERROR','OFFLINE','STALE','UNKNOWN']){
    assert.match(ui7,new RegExp(state));
  }
  assert.match(ui7,/只會更新取餐進度/);
  assert.match(ui7,/未確認前唔會顯示已核對、已交付或已完成/);
});


test('UI7 healthy no-stage state is deterministic EMPTY while unsupported is UNKNOWN',()=>{
  assert.match(ui7,/type Ui7EmptyState='LOADING'\|'EMPTY'\|'ERROR'\|'OFFLINE'\|'STALE'\|'UNKNOWN'/);
  assert.match(ui7,/const emptyStateFrom=\(freshness:Ui7Freshness\):Ui7EmptyState=>freshness==='CURRENT'\?'EMPTY':freshness/);
  assert.match(ui7,/const unsupported=Boolean\(order&&!canonicalStage&&!isKnownPreUi7Stage\(order\.stage\)\)/);
  assert.match(ui7,/const emptyState:Ui7EmptyState=unsupported\?'UNKNOWN':emptyStateFrom\(freshness\)/);
  assert.match(ui7,/data-ui7-state=\{emptyState\}/);
  assert.match(ui7,/emptyState==='EMPTY'\?'暫時未有取餐狀態':'取餐狀態等待讀回'/);
  assert.match(ui7,/店舖真正準備好後先會顯示「可取餐」/);
  assert.doesNotMatch(ui7,/freshness==='CURRENT'\?'READY'/);
});

test('UI7 keeps exactly five fixed bottom-nav items with Orders active',()=>{
  const navBlock=primitives.slice(primitives.indexOf('export function BottomNavigation'),primitives.indexOf('export interface ProductOriginRect'));
  const navIds=[...navBlock.matchAll(/\{id:'(home|menu|cart|orders|more)' as const/g)].map(match=>match[1]);
  assert.deepEqual(navIds,['home','menu','cart','orders','more']);
  assert.match(app,/view==='cart'\|\|view==='checkout'\?'cart'/);
  assert.match(app,/view==='more'\\|\\|view==='account'\\|\\|view==='recovery'\\?'more':'orders'/);
  assert.doesNotMatch(app,/\['checkout','submit','waiting','pickup'\]/);
  assert.match(app,/pulseKey=\{jarPulseKey\} onChange=\{changeView\}/);
  assert.match(styles,/\.bottom-navigation\{position:fixed[\s\S]*grid-template-columns:repeat\(5,1fr\)[\s\S]*env\(safe-area-inset-bottom\)/);
  const buttonMinHeight=styles.match(/\.bottom-navigation button\{[^}]*min-height:(\d+)px/);
  assert.ok(buttonMinHeight);
  assert.ok(Number(buttonMinHeight[1])>=44);
  assert.doesNotMatch(navBlock,/ARRIVED|VERIFIED|HANDED_OVER|COMPLETED|updateFulfillment|markArrived/);
});

test('UI7 contains no Stage8 reward or instant seed issuance',()=>{
  assert.doesNotMatch(ui7,/reorder|再來一單|seed|reward|coupon|badge/i);
});

test('formal Stage 7 composition uses supplied IP assets, touch target and reduced motion',()=>{
  assert.doesNotMatch(ui7,/data-final-art-pending="true"/);
  assert.match(ui7,/data-source-asset=/);\n  assert.match(ui7,/source-ip-crop/);
  assert.match(ui7,/data-character-slot=\{variant\}/);
  assert.match(styles,/\.ui7-arrival-unavailable button[\s\S]*min-height:48px/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.ui7-shell/);
});
