import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const contract=read('../../carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/FormalBusinessCommandContract.java');
const router=read('../../carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/FormalBusinessCommandRouter.java');
const security=read('../../carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/FormalSecurityAuthority.java');
const bridge=read('../../carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/FormalBusinessCommandBridgeController.java');
const main=read('../../carrier/android/app/src/main/java/com/morefunos/smt/MainActivity.java');
const transport=read('./formal-business-native-transport.ts');
const matrix=read('../../docs/architecture/MFP_V3_A9R_FORMAL_BUSINESS_COMMAND_MATRIX_2026-10-02.md');
const native=contract+router+security+bridge+main;
const a9rSources=contract+router+security+bridge+transport;
const commands=[
  'CHECKOUT_PAYMENT_CONFIRM','ORDER_FULFILLMENT_SET','ORDER_MODIFICATION_REQUEST','ORDER_PAYMENT_CORRECTION',
  'ORDER_REFUND','ORDER_CANCEL','DINING_FORMAL_ADMIT','DINING_WAITING_CREATE','DINING_TABLE_ASSIGN',
  'DINING_TABLE_TRANSFER','DINING_ITEMS_ADD','RUNTIME_AVAILABILITY_SET','CAPACITY_POOL_CORRECT',
  'CAPACITY_OVERRIDE_CREATE','CUSTOMER_NEW_ORDER_ACCEPTANCE_SET','ORDER_MODIFICATION_CUSTOMER_DECISION',
  'EXTERNAL_KEETA_LIFECYCLE_APPLY','EXTERNAL_CUSTOMER_ORDER_ADMIT','EXTERNAL_KEETA_ORDER_ADMIT',
] as const;

describe('MFP V3 A9R source authority gates',()=>{
  it('keeps one native authority owner and routes commits through the existing coordinator',()=>{
    expect(router).toContain('STORE_KERNEL_FORMAL_BUSINESS_AUTHORITY');
    expect(bridge).toContain('coordinator.commit(request)');
  });

  it('registers every known V3 command and maps every command in the state matrix',()=>{
    for(const command of commands){expect(contract).toContain(`commands.put("${command}"`);expect(matrix).toContain(`\`${command}\``);}
    expect(contract.match(/commands\.put\(/g)).toHaveLength(commands.length);
  });

  it('rejects aggregate injection at the parser boundary',()=>{
    for(const field of ['aggregateType','aggregateId','mutations','canonicalOrderState','canonicalPaymentState','finalCanonicalAggregateState'])expect(contract).toContain(`"${field}"`);
    expect(contract).toContain('FORMAL_AGGREGATE_INJECTION_REJECTED');
  });

  it('makes the complete formal Security admission contract explicit without implementing PIN logic',()=>{
    for(const fact of ['device is authorized','staff session exists','unexpired','not revoked','frontline-eligible'])expect(security).toContain(fact);
    expect(security).not.toMatch(/verifyPin|checkPin|pinHash/);
  });

  it('performs receipt readback before Security and handler dispatch',()=>{
    expect(router.indexOf('gateway.read(command.storeId')).toBeLessThan(router.indexOf('security.authorize(command)'));
    expect(router.indexOf('security.authorize(command)')).toBeLessThan(router.indexOf('handler.prepare(command)'));
  });

  it('requires a receipt for COMMITTED and keeps UNKNOWN fail-closed',()=>{
    expect(router).toContain('!stored.receiptPresent');
    expect(contract).toContain('readbackRequired", true');
    expect(contract).toContain('retryPermitted", false');
  });

  it('exposes only bounded formal submit/readback and blocks direct low-level commit',()=>{
    expect(main).toContain('STORE_KERNEL_DIRECT_COMMIT_FORBIDDEN');
    expect(transport).toContain("type:'mfp.store-kernel.command.v1'");
    expect(transport).toContain("type:'mfp.store-kernel.submission.read.v1'");
    expect(transport).not.toMatch(/sendRaw|store\.kernel\.commit\.v1/);
  });

  it('keeps Checkout source-bound but fail-closed on missing canonical admission and tender data',()=>{
    expect(contract).toContain('FORMAL_PRICING_AUTHORITY_DEPENDENCY_MISSING');
    expect(contract).toContain('FORMAL_TENDER_AUTHORITY_DEPENDENCY_MISSING');
    expect(matrix).toContain('public bridge is source-bound and fails closed');
  });

  it('imports no v2 runtime or SMM authority and adds no publish/cutover operation',()=>{
    expect(native+transport).not.toMatch(/from .*(v2local|v2smm)|localRuntime|SMM_INTENT_STORE|mfk-smm-web/);
    expect(a9rSources).not.toMatch(/runtime\.update\.activate|runtime\.rollback|wrangler deploy/);
  });
});
