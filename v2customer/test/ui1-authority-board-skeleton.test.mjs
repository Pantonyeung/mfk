import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../src/stage1/Stage1Home.tsx',import.meta.url),'utf8');
test('UI1 authority-board skeleton exposes real store, order, closed and shortcut information',()=>{
 for(const copy of ['營業中','休息中','todayHours','店舖已接單','餐點製作中','可以取餐啦','預計 ','常購清單','記憶券','期間限定'])assert.ok(home.includes(copy),copy);
 assert.match(home,/stage1-store-status/);
 assert.match(home,/role="status" aria-label=\{'店舖狀態：'/);
 assert.doesNotMatch(home,/aria-label="通知"|stage1-order-steps|下次營業/);
 assert.match(home,/今日營業時間 · \{todayHours\}/);
});
