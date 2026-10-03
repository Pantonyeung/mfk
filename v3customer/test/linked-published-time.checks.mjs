import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import ts from 'typescript';

const source=ts.createSourceFile('linked-test-app.tsx',readFileSync(new URL('../src/linked-test-app.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const times=[];
function visit(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='time')times.push(node);ts.forEachChild(node,visit);}
visit(source);
assert.equal(times.length,1,'Execute the linked publication time element from the real UI');
const renderTime=ts.transpileModule(`return (${times[0].getText(source)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
const cases=[
  {publishedAt:'2026-10-03T15:59:59Z',hongKongClock:'2026-10-03T23:59:59Z'},
  {publishedAt:'2026-10-03T16:05:35Z',hongKongClock:'2026-10-04T00:05:35Z'},
  {publishedAt:'2026-10-04T00:05:35+08:00',hongKongClock:'2026-10-04T00:05:35Z'},
  {publishedAt:'2026-12-31T16:00:00Z',hongKongClock:'2027-01-01T00:00:00Z'},
];

// Render the actual JSX in fresh processes, rather than changing this runner's
// timezone or testing a duplicate formatter. Browser acceptance remains separate.
for(const timeZone of ['UTC','America/Los_Angeles','Asia/Hong_Kong']){
  test(`linked publication time uses Hong Kong time on a ${timeZone} host`,()=>{
    const program=`
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      const render=new Function('React','catalog',${JSON.stringify(renderTime)});
      const rendered=${JSON.stringify(cases)}.map(({publishedAt})=>{
        const element=render(React,{publishedAt});
        return {dateTime:element.props.dateTime,text:element.props.children,markup:renderToStaticMarkup(element)};
      });
      console.log(JSON.stringify({hostTimeZone:new Intl.DateTimeFormat().resolvedOptions().timeZone,rendered}));
    `;
    const actual=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',program],{cwd:new URL('../',import.meta.url),env:{...process.env,TZ:timeZone},encoding:'utf8'}));
    assert.equal(actual.hostTimeZone,timeZone,'The child process must use the requested host timezone');
    cases.forEach(({publishedAt,hongKongClock},index)=>{
      // The explicit expected calendar values are formatted in UTC solely to
      // follow the runtime's zh-HK punctuation, without calculating HKT again.
      const expected=new Date(hongKongClock).toLocaleString('zh-HK',{timeZone:'UTC'});
      assert.equal(actual.rendered[index].dateTime,publishedAt,'Canonical machine-readable instant stays untouched');
      assert.equal(actual.rendered[index].text,expected,`${publishedAt} must show the expected Hong Kong calendar date and time`);
      assert.equal(actual.rendered[index].markup,`<time dateTime="${publishedAt}">${expected}</time>`);
    });
  });
}
