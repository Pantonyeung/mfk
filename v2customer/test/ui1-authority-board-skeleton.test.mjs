import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');
test('UI1 authority-board skeleton exposes real store, order, closed and shortcut information',()=>{
 for(const copy of ['營業中','休息中','todayHours','已接單','製作中','快完成','可取餐','預計 ','我的收藏','回憶券','期間限定'])assert.ok(home.includes(copy),copy);
 assert.match(home,/aria-label="通知"/);
 assert.match(home,/activeOrders\.length\?<i\/>/);
 assert.match(home,/todayHours\?' · '\+todayHours/);
});
