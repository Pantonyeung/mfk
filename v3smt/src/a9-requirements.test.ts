import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const runtime=read('./a9-runtime.ts');
const acceptance=read('./a9-acceptance.ts');
const checkCenter=read('./check-center.tsx');
const vite=read('../vite.config.ts');
const workflow=read('../../.github/workflows/v3smt-a0-foundation.yml');
const handoff=read('../../docs/handoff/MFP_V3_A9_PUBLIC_DIAGNOSTICS_PHYSICAL_CUTOVER_CODEX_HANDOFF_2026-10-02.md');
const runbook=read('../../docs/acceptance/MFP_V3_A9_PHYSICAL_ACCEPTANCE_RUNBOOK_2026-10-02.md');
const allA9=runtime+acceptance+checkCenter;

const rules:ReadonlyArray<readonly [number,string,()=>boolean]>=[
  [1,'exact source SHA visible',()=>runtime.includes('MFP_BUILD_IDENTITY.sourceSha')],
  [2,'build target MFP_V3',()=>vite.includes("target:'MFP_V3'")],
  [3,'candidate appassets identity accepted',()=>runtime.includes("RUNTIME_PATH='/runtime/index.html'")],
  [4,'release/version mismatch rejected',()=>runtime.includes('releaseId!==runtimeVersion')],
  [5,'non-appassets ready rejected',()=>runtime.includes('url.origin!==APP_ORIGIN')],
  [6,'StrictMode ready once',()=>runtime.includes('if(sent||!bridge)return false')],
  [7,'stable packaged baseline explicit',()=>runtime.includes("runtimeVersion==='packaged-baseline'")],
  [8,'source mismatch blocks readiness',()=>runtime.includes('MFP_EXPECTED_SOURCE_SHA_MISMATCH')],
  [9,'native request correlation',()=>runtime.includes('value.requestId!==requestId')],
  [10,'native timeout fail closed',()=>runtime.includes('MFP_NATIVE_TIMEOUT')],
  [11,'async completion listener',()=>runtime.includes("addEventListener?.('message'")],
  [12,'public browser native disabled',()=>runtime.includes('MFP_NATIVE_MUTATION_DISABLED_PUBLIC')],
  [13,'diagnostics exclude credential fields',()=>!allA9.match(/staffSessionRef|providerSecret|paymentEvidence/)],
  [14,'no arbitrary raw send API',()=>!runtime.match(/\bsendNative\b|\bsendRaw\b/)],
  [15,'security unbound blocks',()=>runtime.includes('MFP_SECURITY_PRODUCTION_BINDING_MISSING')],
  [16,'Store Kernel formal router source verified',()=>runtime.includes('FORMAL_COMMAND_ROUTER_SOURCE_VERIFIED')],
  [17,'sync unbound blocks',()=>runtime.includes('MFP_SYNC_PRODUCTION_BINDING_MISSING')],
  [18,'checkout unbound blocks',()=>runtime.includes('MFP_CHECKOUT_PRODUCTION_BINDING_MISSING')],
  [19,'orders unbound blocks',()=>runtime.includes('MFP_ORDER_OPERATIONS_PRODUCTION_BINDING_MISSING')],
  [20,'print unbound blocks',()=>runtime.includes('MFP_CANONICAL_PRINT_BINDING_MISSING')],
  [21,'Customer unbound visible',()=>runtime.includes('MFP_CUSTOMER_PRODUCTION_BINDING_MISSING')],
  [22,'Keeta unbound visible',()=>runtime.includes('MFP_KEETA_PRODUCTION_BINDING_MISSING')],
  [23,'high-level command is not client-translated to commit',()=>!allA9.includes('store.kernel.commit.v1')],
  [24,'formal router source status is explicit',()=>runtime.includes("status:'SOURCE_VERIFIED' as const")],
  [25,'no second business engine',()=>!allA9.match(/class\s+\w*(Order|Pricing|Payment|Print|Capacity)(Engine|Authority)/)],
  [26,'Carrier health readback',()=>runtime.includes("request('carrier.health'")],
  [27,'Store Kernel health readback',()=>runtime.includes("request('store.kernel.health.v1'")],
  [28,'sync diagnostics fields',()=>['HeadSeq','AppliedSeq','Checkpoint','Doorbell','Last apply'].every(value=>checkCenter.includes(value))],
  [29,'print gateway snapshot',()=>runtime.includes("request('print.gateway.snapshot'")],
  [30,'runtime current candidate previous selected',()=>['currentReleaseId','candidateReleaseId','previousReleaseId','selectedReleaseId'].every(value=>checkCenter.includes(value))],
  [31,'fault journal read',()=>runtime.includes("request('diagnostics.faults.read'")],
  [32,'fault UI omits message and stack',()=>!checkCenter.match(/fault\.message|fault\.stack/)],
  [33,'stable error code validation',()=>runtime.includes('STABLE_CODE')],
  [34,'readiness verdict deterministic',()=>runtime.includes('evaluateMfpA9Readiness')],
  [35,'safe local backup allowlist',()=>runtime.includes("'presentation settings','printer bindings','bounded device metadata','diagnostics export'")],
  [36,'sessions and secrets excluded from backup',()=>runtime.includes("'staff PIN/proof/session','provider secrets'")],
  [37,'browser cannot restore canonical truth',()=>runtime.includes("'canonical Orders','Pricing','Payment','PrintJobs','Store Kernel DB'")],
  [38,'missing native backup shows BLOCKED',()=>runtime.includes('MFP_NATIVE_CANONICAL_BACKUP_BINDING_MISSING')],
  [39,'MFK source references Builder PR 174',()=>handoff.includes('Builder PR #174')],
  [40,'A9 guard forbids legacy package assumptions',()=>workflow.includes("store\\.kernel\\.commit\\.v1")&&workflow.includes('v2local|v2smm')],
  [41,'candidate format exact-source-derived',()=>handoff.includes('runtime-candidate-mfk-<source SHA first 12>')],
  [42,'MFK A9 contains no Builder publish request',()=>!allA9.includes('mfk-runtime-ota-request.txt')],
  [43,'public identity no-store artifact',()=>vite.includes('Cache-Control: no-store')],
  [44,'public safe mode forbids native print and drawer',()=>checkCenter.includes('no native print, drawer')],
  [45,'public does not impersonate device',()=>checkCenter.includes('device impersonation')],
  [46,'public does not become Store Kernel writer',()=>checkCenter.includes('Store Kernel writer')],
  [47,'public parity not treated as deployed',()=>runtime.includes('MFP_PUBLIC_ACCEPTANCE_NOT_DEPLOYED')],
  [48,'physical records require exact identity fields',()=>['device:string','sourceSha:string','releaseId:string','timestamp:string'].every(value=>acceptance.includes(value))],
  [49,'physical result is not inferred from source',()=>acceptance.includes('MFP_PHYSICAL_GATE_MISSING')],
  [50,'failed physical gate blocks',()=>acceptance.includes("startsWith('MFP_PHYSICAL_GATE_FAILED:')")],
  [51,'rollback retains Previous identity',()=>runbook.includes('Current = Previous stable runtime')],
  [52,'activation alone is not physical verification',()=>acceptance.includes("unique.length?'BLOCKED':'PHYSICAL_VERIFIED'")],
  [53,'cutover requires Owner authorization',()=>acceptance.includes('MFP_OWNER_CUTOVER_AUTHORIZATION_REQUIRED')],
  [54,'SMM gate requires physical acceptance',()=>acceptance.includes('MFP_PHYSICAL_ACCEPTANCE_REQUIRED')],
  [55,'source stage does not delete SMM',()=>handoff.includes('Do not delete SMM in A9 source implementation')],
  [56,'unresolved blocker prevents final readiness',()=>runtime.includes("status:codes.length?'BLOCKED'")],
  [57,'A1 Store Kernel remains present',()=>read('./store-kernel-port.ts').includes('createMfpStoreKernelPort')],
  [58,'A2 Security remains present',()=>read('./security-port.ts').includes('createMfpSecurityPort')],
  [59,'A3 Sync remains present',()=>read('./sync-port.ts').includes('createMfpSyncCoordinator')],
  [60,'A4 Ordering remains present',()=>read('./ordering-domain.ts').includes('createMfpOrderingSurfaceDomains')],
  [61,'A5 Checkout remains present',()=>read('./checkout-domain.ts').includes("commandType:'CHECKOUT_PAYMENT_CONFIRM'")],
  [62,'A6 Order Operations remains present',()=>read('./order-operations-domain.ts').includes('createMfpOrderOperationSession')],
  [63,'A7 Print remains present',()=>read('./print-hardware-domain.ts').includes('createMfpPrintHardwareSession')],
  [64,'A8 External remains present',()=>read('./external-domain.ts').includes('createMfpExternalAdmissionSession')],
  [65,'A9 imports no V2 client state',()=>!allA9.match(/from .*(v2local|v2smm)/)],
  [66,'A9 imports no SMM authority',()=>!allA9.match(/SMM_INTENT_STORE|SMM.{0,20}HeadSeq|mfk-smm-web/)],
  [67,'A9 adds no business authority class',()=>!allA9.match(/class\s+\w*(Order|Pricing|Payment|Print|Capacity|BusinessDay)(Engine|Authority)/)],
  [68,'A9 adds no periodic polling',()=>!allA9.match(/setInterval\s*\(/)],
  [69,'production build command remains available',()=>read('../package.json').includes('"build": "vite build"')],
  [70,'A9 CI runs test typecheck build and static guards',()=>['npm test','npm run typecheck','npm run build','MFP_NATIVE_MUTATION_DISABLED_PUBLIC'].every(value=>workflow.includes(value))],
];

describe('MFP V3 A9 required source gates',()=>{
  it.each(rules)('A9-%i %s',(_number,_description,check)=>expect(check()).toBe(true));
});
