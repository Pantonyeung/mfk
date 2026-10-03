import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const text=readFileSync(new URL('../src/linked-test-app.tsx',import.meta.url),'utf8');
const source=ts.createSourceFile('linked-test-app.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(node,predicate){if(predicate(node))return node;let match;ts.forEachChild(node,child=>{match??=find(child,predicate);});return match;}
function evaluate(expression,bindings){return new Function(...Object.keys(bindings),ts.transpileModule(`return (${expression});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(bindings));}
const button=find(source,node=>ts.isJsxOpeningElement(node)&&node.tagName.getText(source)==='button'&&node.attributes.properties.some(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)==='aria-label'&&attr.initializer?.getText(source).includes('選擇 ${p.name}')));
function attribute(name){const attr=button.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)===name);assert.ok(attr?.initializer&&ts.isJsxExpression(attr.initializer));return attr.initializer.expression.getText(source);}
const refresh=find(source,node=>ts.isVariableDeclaration(node)&&node.name.getText(source)==='refreshCatalog').initializer.arguments[0].getText(source);

// Executes the real React callback and JSX admission expressions. Browser native
// pointer dispatch is separately covered by the deterministic Playwright case.
test('canonical refresh between pointer down and up keeps read-only product navigation enabled',async()=>{
  let ready=true,selected=null,resolveCatalog;
  const canonical={fingerprint:'unchanged',products:[{id:'p1',available:true}]};
  const setReady=value=>{ready=value;};
  const callback=evaluate(refresh,{catalogSequence:{current:0},mounted:{current:true},fingerprint:{current:'unchanged'},setCatalogReady:setReady,setCatalogError:()=>{},linkedRequest:()=>new Promise(resolve=>resolveCatalog=resolve),parseLinkedCatalog:value=>value,setCart:()=>{},setProductId:value=>selected=value,setNotice:()=>{},setCatalog:()=>{},errorText:error=>String(error)});
  const bindings=()=>({p:canonical.products[0],model:{},catalogReady:ready,setProductId:value=>selected=value});
  assert.equal(evaluate(attribute('disabled'),bindings()),false,'Pointer-down begins on enabled product');
  const pending=callback();assert.equal(ready,false,'Real refresh invalidates canonical mutation readiness immediately');
  assert.equal(evaluate(attribute('disabled'),bindings()),false,'Read-only navigation must survive until pointer-up while catalog is refreshing');
  evaluate(attribute('onClick'),bindings())();assert.equal(selected,'p1');
  resolveCatalog(canonical);await pending;assert.equal(ready,true);assert.equal(selected,'p1','Unchanged fingerprint keeps selected product');
});
test('navigation fix keeps unavailable products, option edits and request submission fail-closed',()=>{
  assert.equal(evaluate(attribute('disabled'),{p:{available:false},model:{},catalogReady:true}),true);
  assert.equal(evaluate(attribute('disabled'),{p:{available:true},model:null,catalogReady:true}),true);
  const fieldset=find(source,node=>ts.isJsxOpeningElement(node)&&node.tagName.getText(source)==='fieldset');
  const gate=fieldset.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)==='disabled').initializer.expression;
  assert.equal(evaluate(gate.getText(source),{ready:false}),true);
  const add=find(source,node=>ts.isFunctionDeclaration(node)&&node.name?.text==='add');let adds=0;
  evaluate(add.getText(source),{ready:false,onAdd:()=>adds++,linkedLine:()=>{throw Error('must not build stale line');},setError:()=>{}})();assert.equal(adds,0);
  const submitButton=find(source,node=>ts.isJsxOpeningElement(node)&&node.tagName.getText(source)==='button'&&node.attributes.properties.some(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)==='onClick'&&attr.initializer?.getText(source)==='{()=>void submit()}'));
  const submitGate=submitButton.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)==='disabled').initializer.expression;
  assert.equal(evaluate(submitGate.getText(source),{model:{},catalog:{},catalogReady:false,cart:[{}],busy:false}),true);
});
test('a changed canonical fingerprint still discards old product selection and cart',async()=>{
  let ready=true,selected='p1',cart=[{productId:'p1'}];const canonical={fingerprint:'new'};
  const callback=evaluate(refresh,{catalogSequence:{current:0},mounted:{current:true},fingerprint:{current:'old'},setCatalogReady:value=>ready=value,setCatalogError:()=>{},linkedRequest:async()=>canonical,parseLinkedCatalog:value=>value,setCart:value=>cart=value,setProductId:value=>selected=value,setNotice:()=>{},setCatalog:()=>{},errorText:error=>String(error)});
  await callback();assert.equal(selected,null);assert.deepEqual(cart,[]);assert.equal(ready,true);
});
