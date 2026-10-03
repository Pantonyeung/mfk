import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';

const source=(name)=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
const ordering=()=>ts.createSourceFile('ordering-screens.tsx',source('ordering-screens.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(root,predicate){
  if(predicate(root))return root;
  let match;
  ts.forEachChild(root,node=>{match??=find(node,predicate);});
  return match;
}
function nextHandler(){
  const root=ordering();
  const screen=find(root,node=>ts.isFunctionDeclaration(node)&&node.name?.text==='CheckoutScreen');
  const next=find(screen,node=>ts.isVariableDeclaration(node)&&node.name.getText(root)==='next');
  assert.ok(next?.initializer,'Checkout retains its existing preview navigation handler');
  return ts.transpileModule(`const next=${next.initializer.getText(root)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
}

// The real handler is extracted, not reimplemented; this is a source-level
// transition harness, not a mounted React or browser interaction test.
for(const startingStep of [2,3,99])test(`real checkout handler never submits at step ${startingStep}, including repeated invocation`,()=>{
  let step=startingStep;
  const js=nextHandler();
  for(let retry=0;retry<3;retry++){
    const run=new Function('step','setStep','CUSTOMER_ACCEPTANCE','name','phone','payment','proofName','setProofError','setContactError',`${js}; return next();`);
    run(step,update=>{step=update(step);},{orderSubmission:false,paymentProofUpload:false,paymentConfirmation:false},'Demo','91234567',{requiresProof:false},'forged-proof.png',()=>{},()=>{});
    assert.equal(step,startingStep,'An unbound checkout must not advance into a fake submitted state');
  }
});

test('acceptance capabilities are immutable and have no provider activation input',async()=>{
  const path=new URL('../src/acceptance-capabilities.ts',import.meta.url);
  assert.ok(existsSync(path),'Explicit unbound acceptance capabilities must exist');
  const {CUSTOMER_ACCEPTANCE}=await import(path.href);
  assert.equal(CUSTOMER_ACCEPTANCE.mode,'acceptance-preview');
  for(const key of ['orderSubmission','paymentProofUpload','paymentConfirmation'])assert.equal(CUSTOMER_ACCEPTANCE[key],false,key);
  assert.ok(Object.isFrozen(CUSTOMER_ACCEPTANCE));
  assert.throws(()=>{CUSTOMER_ACCEPTANCE.orderSubmission=true;},TypeError);
  assert.doesNotMatch(readFileSync(path,'utf8'),/localStorage|sessionStorage|location|fetch\(|import\.meta\.env/);
});

test('proof control is disabled without a file handler and submit button is capability blocked',()=>{
  const root=ordering();
  const proof=find(root,node=>ts.isJsxSelfClosingElement(node)&&node.attributes.properties.some(prop=>ts.isJsxAttribute(prop)&&prop.name.getText(root)==='id'&&prop.initializer?.getText(root)==='"payment-proof"'));
  assert.ok(proof,'Existing proof control is retained for visual continuity');
  const attrs=proof.attributes.properties.map(prop=>prop.name?.getText(root));
  assert.ok(attrs.includes('disabled'),'Unbound file input must be disabled');
  assert.ok(!attrs.includes('onChange'),'Disabled file control must not retain a fake proof handler');
  assert.match(proof.getText(root),/disabled=\{!CUSTOMER_ACCEPTANCE\.paymentProofUpload\}/);
  assert.match(source('ordering-screens.tsx'),/disabled=\{step===2&&!CUSTOMER_ACCEPTANCE\.orderSubmission\}/);
});

test('checkout has no fake submitted screen, payment-success fallback, or order callback',()=>{
  const text=source('ordering-screens.tsx');
  assert.doesNotMatch(text,/訂單已送出|付款憑證已提交|MF-NEW|onOrder|SubmittedOrder|setFallbackMode\('paid'\)/);
  assert.match(text,/付款及憑證服務未接駁/);
  assert.match(text,/落單服務未接駁/);
});

test('app always exposes acceptance and exact build identity; submission never creates history',()=>{
  const text=source('App.tsx');
  assert.match(text,/data-customer-acceptance=\{CUSTOMER_ACCEPTANCE\.mode\}/);
  assert.match(text,/data-customer-build=\{CUSTOMER_BUILD_IDENTITY\.buildId\}/);
  assert.match(text,/CUSTOMER_ACCEPTANCE\.notice/);
  assert.doesNotMatch(text,/setSubmittedOrder|submittedOrder|onOrder=/);
  const noticePos=text.indexOf('className="acceptance-notice"');
  assert.ok(noticePos>text.indexOf('return <div className="shell"'),'Notice is rendered in the shared shell');
});

test('fixture order list and detail are marked demo and refresh never claims a live read',()=>{
  const text=source('customer-screens.tsx');
  assert.match(text,/示範訂單，並非真實訂單/);
  assert.match(text,/訂單狀態服務未接駁/);
  assert.doesNotMatch(text,/已讀取最新進度|啱啱更新|付款憑證已提交/);
});

test('build identity exists in runtime and as an emitted artifact with source content digest',async()=>{
  const path=new URL('../src/build-identity.ts',import.meta.url);
  assert.ok(existsSync(path),'Runtime identity module must exist');
  const {CUSTOMER_BUILD_IDENTITY}=await import(path.href);
  assert.equal(CUSTOMER_BUILD_IDENTITY.sourceCommit,'unavailable','No fabricated revision outside a Vite build');
  assert.equal(CUSTOMER_BUILD_IDENTITY.buildId,'unavailable');
  const config=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
  assert.match(config,/customer-build-identity\.json/);
  assert.match(config,/__CUSTOMER_BUILD_IDENTITY__/);
  assert.match(config,/createHash\('sha256'\)/);
  assert.match(config,/sourceDigest/);
  assert.match(config,/GIT_NO_LAZY_FETCH:'1'/);
});

test('actual Vite identity definition and emitted identity artifact are exactly the same',async()=>{
  const {default:config}=await import('../vite.config.ts');
  const identity=JSON.parse(config.define.__CUSTOMER_BUILD_IDENTITY__);
  assert.equal(identity.surface,'MFP_CUSTOMER_V3');
  assert.match(identity.sourceCommit,/^[a-f0-9]{40}$/);
  assert.match(identity.sourceDigest,/^[a-f0-9]{64}$/);
  assert.match(identity.buildId,/^[a-f0-9]{64}$/);
  assert.equal(typeof identity.sourceDirty,'boolean');
  assert.ok(Number.isFinite(Date.parse(identity.builtAt)));
  let emitted;
  config.plugins.find(plugin=>plugin.name==='customer-acceptance-build-identity').generateBundle.call({emitFile:artifact=>{emitted=artifact;}});
  assert.equal(emitted.fileName,'customer-build-identity.json');
  assert.deepEqual(JSON.parse(emitted.source),identity);
});
