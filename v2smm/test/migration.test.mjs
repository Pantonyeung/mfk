import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(testDir,'../src');
const srcRoot=root;
const repoRoot=path.resolve(testDir,'../..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'capabilities.json'),'utf8'));
const sourceFiles=fs.readdirSync(root).filter(name=>/\.(ts|tsx|js|jsx)$/.test(name));
const source=sourceFiles.map(name=>fs.readFileSync(path.join(root,name),'utf8')).join('\n');

test('capability registry stays unique and only staff order intent is wired while SMT keeps authority',()=>{
  assert.equal(registry.length,54);
  assert.equal(new Set(registry.map(item=>item.id)).size,54);
  const commands=registry.filter(item=>item.kind==='COMMAND_SHAPE');
  assert.ok(commands.length>=1);
  const order=commands.find(item=>item.id==='FORMAL_ORDER_COMMAND');
  assert.equal(order?.status,'WIRED_TO_SMT');
  assert.match(String(order?.owner),/SMT formal order authority/);
  assert.deepEqual([...new Set(commands.filter(item=>item.id!=='FORMAL_ORDER_COMMAND').map(item=>item.status))],['NOT_WIRED']);
  const reads=registry.filter(item=>item.kind!=='COMMAND_SHAPE');
  assert.deepEqual([...new Set(reads.map(item=>item.status))],['PRODUCT_READY_NOT_CONNECTED']);
});

test('SMM UI remains free of canonical writer and transport stays isolated',()=>{
  const forbidden=[
    /\bWebSocket\b/,
    /\bXMLHttpRequest\b/,
    /\bindexedDB\b/,
    /createFormalOrder/,
    /allocateDisplayNumber/,
    /storeKernel\s*\./,
    /\bD1Database\b/,
    /new\s+Worker\s*\(/
  ];
  for(const pattern of forbidden)assert.equal(pattern.test(source),false,String(pattern));
  const pwaLan=fs.readFileSync(path.join(root,'pwa-lan.ts'),'utf8');
  const pwaRuntime=fs.readFileSync(path.join(root,'pwa-runtime.ts'),'utf8');
  assert.match(pwaLan,/fetch\s*\(/);
  assert.match(pwaLan,/smm\/v1\/health/);
  assert.match(pwaRuntime,/\/api\/smm\/snapshot/);
  assert.match(pwaRuntime,/connectionPath:'INTERNET'/);
  assert.match(pwaRuntime,/SMM_LAN_SNAPSHOT_INVALID/);
});

test('local persistence is explicitly non-authoritative',()=>{
  const persistence=fs.readFileSync(path.join(root,'persistence.ts'),'utf8');
  assert.match(persistence,/LOCAL_NON_AUTHORITATIVE/);
  assert.match(persistence,/localStorage/);
  assert.match(persistence,/smm-direct:/);
  assert.doesNotMatch(persistence,/Formal Order|Store Kernel|Pricing engine/i);
});

test('production App no longer imports fixtures or exposes migration/demo operator copy',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\.\/fixtures/);
  assert.doesNotMatch(app,/Migration Mode|DEMO|Capability Registry|所有 Command：NOT_WIRED/);
  assert.match(app,/尚未連接門店服務/);
  assert.match(app,/唔會顯示假資料/);
  assert.match(app,/本機草稿/);
  assert.match(app,/結果未明/);
});

test('complete operator routes and failure states are present',()=>{
  for(const marker of[
    '快速點餐','前線工作','訂單記錄','桌面管理','店務工具',
    '搜尋商品','商品設定','購物草稿','待提交草稿','平台狀態',
    '連線設定','商品供應','營業日','產能','營運報表','退款要求','列印狀態','診斷','正在同步餐單',
    '同步失敗','重新確認結果'
  ])assert.match(source,new RegExp(marker));
});

test('typed runtime port is an injected boundary only',()=>{
  const runtime=fs.readFileSync(path.join(root,'runtime.ts'),'utf8');
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  assert.match(runtime,/__MFK_SMM_PRODUCT_PORT__/);
  assert.match(types,/MFK_SMM_PORT_V1/);
  assert.match(types,/readSnapshot\(\)/);
  assert.match(types,/submitOrder\?/);
  assert.doesNotMatch(runtime,/fetch|WebSocket|XMLHttpRequest/);
});

test('UNKNOWN flow preserves identity and reads back before any resend',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(app,/readSubmission/);
  assert.match(app,/唔會自動重送/);
  assert.match(app,/未有重新提交/);
  assert.match(app,/submissionId/);
  const persistence=fs.readFileSync(path.join(root,'persistence.ts'),'utf8');
  assert.match(persistence,/idempotencyKey/);
});

test('Business Day remains record-only and non-blocking',()=>{
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(types,/recordOnly:true/);
  assert.match(app,/永遠唔會阻止落單、付款或者本機提交/);
});


test('production source contains no static fixture module or fake product truth',()=>{
  assert.equal(fs.existsSync(path.join(root,'fixtures.ts')),false);
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.doesNotMatch(app,/\$6,420|Keeta provider readback|紫米飯團 ×2|DEMO/);
});

test('SMM uses the shared published menu price and SMT validates only on submit',()=>{
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  const contract=fs.readFileSync(path.join(repoRoot,'contracts','smm-lan-v1.ts'),'utf8');
  assert.match(types,/publishedTakeawayUnitPriceMinor/);
  assert.match(types,/publishedDineInUnitPriceMinor/);
  assert.match(app,/已發布總額/);
  assert.match(app,/SMT 提交時再核對/);
  assert.doesNotMatch(app,/等待門店報價/);
  assert.doesNotMatch(app,/port\?\.quoteCart/);
  assert.match(app,/port\?\.submitOrder/);
  assert.match(contract,/menuRevision/);
  assert.match(contract,/publishedTotalMinor/);
  assert.match(contract,/serviceMode/);
  assert.match(contract,/tender/);
});


test('previously banked SMM read surfaces are not dropped by product completion',()=>{
  const types=fs.readFileSync(path.join(root,'product-types.ts'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  for(const marker of['refundRequests','capacity','reporting','printHealth','channels','dineSessions'])assert.match(types,new RegExp(marker));
  for(const marker of['退款要求','產能資料尚未連接','營運報表尚未連接','列印狀態尚未連接'])assert.match(app,new RegExp(marker));
});


test('runtime boundary remains UI-independent while transport adapters own LAN and Internet fetches',()=>{
  const runtime=fs.readFileSync(path.join(srcRoot,'runtime.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(runtime,/installSmmRuntimePort/);
  assert.match(runtime,/__MFK_SMM_PRODUCT_PORT__/);
  assert.doesNotMatch(app,/fetch\s*\(/);
  assert.doesNotMatch(app,/WebSocket\s*\(/);
  assert.doesNotMatch(app,/XMLHttpRequest/);
  assert.doesNotMatch(app,/fetch\s*\(/);
  assert.match(app,/SMT 位址/);
});


test('live-link contract stays bounded and UNKNOWN-safe without UI transport ownership',()=>{
  const contract=fs.readFileSync(path.join(repoRoot,'contracts','smm-lan-v1.ts'),'utf8');
  const adapter=fs.readFileSync(path.join(srcRoot,'smt-lan-adapter.ts'),'utf8');
  const app=fs.readFileSync(path.join(srcRoot,'App.tsx'),'utf8');
  assert.match(contract,/smm\.lan\.order\.submit\.v1/);
  assert.match(contract,/smm\.lan\.order\.readback\.v1/);
  assert.match(adapter,/state:'UNKNOWN'/);
  assert.match(adapter,/readSubmission/);
  assert.doesNotMatch(app,/fetch\s*\(/);
  assert.doesNotMatch(app,/WebSocket\s*\(/);
});


test('LAN failure falls back to Internet and connection setup stays out of the ordering surface',()=>{
  const runtime=fs.readFileSync(path.join(root,'pwa-runtime.ts'),'utf8');
  const main=fs.readFileSync(path.join(root,'main.tsx'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(runtime,/fall through to the Internet projection/);
  assert.match(runtime,/readCloudSnapshot/);
  assert.match(main,/SmmErrorBoundary/);
  assert.match(main,/SMM 顯示已自動保護/);
  assert.match(app,/title="連線設定"/);
  assert.match(app,/tool==='connection'\?<ConnectionSettings/);
  assert.doesNotMatch(app,/Internet 資料通道運作中/);
});


test('dedicated SMM worker keeps auth session only and proxies orders to the shared customer bridge',()=>{
  const worker=fs.readFileSync(path.join(repoRoot,'v2smm','worker.ts'),'utf8');
  const wrangler=fs.readFileSync(path.join(repoRoot,'v2smm','wrangler.jsonc'),'utf8');
  assert.match(worker,/admin\.morefunos\.com\/api\/admin-sync\/active/);
  assert.match(worker,/publishedTakeawayUnitPriceMinor/);
  assert.match(worker,/publishedDineInUnitPriceMinor/);
  assert.match(worker,/publishedAdjustmentMinor/);
  assert.match(worker,/projectSyncedOrderingCatalog/);
  assert.match(worker,/projectSyncedOrderingCatalog\('takeaway',envelope\)/);
  assert.match(worker,/projectSyncedOrderingCatalog\('dine-in',envelope\)/);
  assert.doesNotMatch(worker,/takeawaySurchargeEnabled|takeawayAdjustment/);
  assert.match(worker,/url\.pathname==='\/api\/smm\/snapshot'/);
  assert.match(worker,/SmmIntentStore/);
  assert.match(worker,/\/api\/smm\/orders\/submit/);
  assert.match(worker,/admin\.morefunos\.com\/api\/customer\/staff-orders\/submit/);
  assert.match(worker,/admin\.morefunos\.com\/api\/customer\/staff-orders\/readback/);
  assert.doesNotMatch(worker,/\/api\/smm\/smt\/orders\/pending/);
  assert.doesNotMatch(worker,/url\.pathname==='\/orders\/submit'/);
  assert.match(worker,/SMM_STAFF_UNAUTHORIZED/);
  assert.match(worker,/validateRuntimeStaffAuthSnapshot/);
  assert.match(worker,/snapshot\.staffAuth/);
  assert.match(worker,/hmacHex/);
  assert.doesNotMatch(worker,/verifyStaffPin|deriveBits\s*\(/);
  assert.match(worker,/sessions\/create/);
  assert.match(worker,/sessions\/read/);
  assert.match(worker,/auth-selftest/);
  assert.match(worker,/\/api\/smm\/staff\/challenge/);
  assert.match(worker,/auth\/challenge\/create/);
  assert.match(worker,/auth\/challenge\/consume/);
  assert.match(worker,/CLIENT_PBKDF2/);
  assert.match(worker,/SMM_SESSION_STORE_UNAVAILABLE/);
  assert.doesNotMatch(worker,/snapshot\.staff\b/);
  assert.match(wrangler,/SMM_INTENT_STORE/);
  assert.match(wrangler,/new_sqlite_classes/);
  assert.match(worker,/env\.ASSETS\.fetch/);
  assert.doesNotMatch(worker,/createOrder|StoreKernel|D1Database/);
});


test('SMM staff checkout has service mode and tender but no automatic drawer or QR handoff',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  const ingress=fs.readFileSync(path.join(repoRoot,'v2local','src','runtime','smm-lan-ingress.ts'),'utf8');
  assert.match(app,/服務方式/);
  assert.match(app,/堂食/);
  assert.match(app,/收款方式/);
  assert.match(app,/現金只會記錄為收款方式；需要開錢箱時由 SMT 人手操作/);
  assert.doesNotMatch(app,/產生 QR|QR 交接|createSmmQrHandoff|renderSmmQrHandoff/);
  assert.match(ingress,/paymentLabel/);
  assert.match(ingress,/SMM_MENU_REVISION_CHANGED/);
  assert.match(ingress,/SMM_PUBLISHED_PRICE_CHANGED/);
  assert.doesNotMatch(ingress,/drawer|openDrawer|cashDrawer/);
});


test('Internet staff orders use same-account auth and the existing customer bridge into the same SMT ingress',()=>{
  const cloud=fs.readFileSync(path.join(root,'pwa-cloud.ts'),'utf8');
  const staff=fs.readFileSync(path.join(root,'pwa-staff.ts'),'utf8');
  const runtime=fs.readFileSync(path.join(root,'pwa-runtime.ts'),'utf8');
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  const sharedBridge=fs.readFileSync(path.join(repoRoot,'v2local','src','runtime','customer-cloud-intake.ts'),'utf8');
  const main=fs.readFileSync(path.join(repoRoot,'v2local','src','main.tsx'),'utf8');
  assert.match(staff,/localStorage/);
  assert.match(staff,/\/api\/smm\/staff\/challenge/);
  assert.match(staff,/\/api\/smm\/staff\/verify/);
  assert.match(staff,/\/api\/smm\/staff\/session/);
  assert.match(staff,/derivePinKeyHex/);
  assert.match(staff,/PBKDF2/);
  assert.match(staff,/HMAC/);
  assert.match(staff,/sessionToken/);
  assert.doesNotMatch(staff,/readonly\s+pin\s*:/);
  assert.match(cloud,/\/api\/customer\/staff-orders\/submit/);
  assert.match(cloud,/\/api\/customer\/staff-orders\/readback/);
  assert.doesNotMatch(cloud,/\/api\/smm\/orders\/submit/);
  assert.match(cloud,/x-mfk-smm-session/);
  assert.doesNotMatch(cloud,/x-mfk-staff-pin/);
  assert.doesNotMatch(cloud,/x-mfk-staff-id/);
  assert.match(runtime,/hybridTransport/);
  assert.match(runtime,/local\.kind!=='UNAVAILABLE'/);
  assert.match(app,/員工帳戶/);
  assert.match(app,/同 SMT 共用同一員工身份/);
  assert.match(sharedBridge,/bridgeKind==='SMM_STAFF'/);
  assert.match(sharedBridge,/smmIngress\.submit/);
  assert.match(sharedBridge,/\/api\/customer\/smt\/orders\/pending/);
  assert.doesNotMatch(main,/installSmmCloudIntake/);
  assert.equal(fs.existsSync(path.join(repoRoot,'v2local','src','runtime','smm-cloud-intake.ts')),false);
});


test('SMM Internet menu and SMT commit share one published catalog projection',()=>{
  const worker=fs.readFileSync(path.join(repoRoot,'v2smm','worker.ts'),'utf8');
  const ingress=fs.readFileSync(path.join(repoRoot,'v2local','src','runtime','smm-lan-ingress.ts'),'utf8');
  assert.match(worker,/projectSyncedOrderingCatalog/);
  assert.match(ingress,/projectSyncedOrderingCatalog/);
  assert.match(worker,/publishedTakeawayUnitPriceMinor:row\.priceMinor/);
  assert.match(ingress,/publishedTakeawayUnitPriceMinor:row\.priceMinor/);
  assert.match(ingress,/SMM_PUBLISHED_PRICE_CHANGED/);
});


test('persisted cart reprices from the current published menu before resubmit',()=>{
  const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
  assert.match(app,/cart\.map\(line=>/);
  assert.match(app,/publishedUnitPriceMinor:unitMinor/);
  assert.match(app,/menu\?\.revision,menu\?\.observedAt/);
  assert.match(app,/購物草稿已按目前發布價格重新計算/);
  assert.match(app,/SMM_PUBLISHED_PRICE_CHANGED/);
  assert.match(app,/SMT 發現餐單版本／價格已更新/);
  assert.match(app,/removeIntent\(pending\.submissionId\)/);
});


test('SMM Internet orders reuse the proven Customer cloud-to-SMT bridge',()=>{
  const cloud=fs.readFileSync(path.join(root,'pwa-cloud.ts'),'utf8');
  const admin=fs.readFileSync(path.join(repoRoot,'v2admin','worker.ts'),'utf8');
  const customerRuntime=fs.readFileSync(path.join(repoRoot,'v2admin','customer-runtime.ts'),'utf8');
  const intake=fs.readFileSync(path.join(repoRoot,'v2local','src','runtime','customer-cloud-intake.ts'),'utf8');
  assert.match(cloud,/admin\.morefunos\.com/);
  assert.match(cloud,/\/api\/customer\/staff-orders\/submit/);
  assert.match(cloud,/\/api\/customer\/staff-orders\/readback/);
  assert.doesNotMatch(cloud,/\/api\/smm\/orders\/submit/);
  assert.match(admin,/CUSTOMER_ORDER_AVAILABLE/);
  assert.match(customerRuntime,/bridgeKind:'SMM_STAFF'/);
  assert.match(intake,/bridgeKind==='SMM_STAFF'/);
  assert.match(intake,/smmIngress\.submit/);
});
