import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const ui10=readFileSync(new URL('../src/customer-ui10.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/customer-ui10.css',import.meta.url),'utf8');

test('UI10 exposes dedicated account and recovery routes without redesigning UI0-UI9',()=>{
  assert.match(app,/\/member\/account/);
  assert.match(app,/\/support\/account-recovery/);
  assert.match(app,/CustomerUi10/);
});
test('UI10 is fail-closed for credential and activation mutation',()=>{
  assert.match(ui10,/啟用服務暫未連接/);
  assert.match(ui10,/登入服務暫未連接/);
  assert.match(ui10,/目前未有已證明嘅會員憑證建立／驗證介面/);
  assert.doesNotMatch(ui10,/fetch\(|XMLHttpRequest|sendBeacon|verifyOtp|sendOtp|resetPassword\(/);
});
test('UI10 recovery terminates in manual WhatsApp handoff and no OTP',()=>{
  assert.match(ui10,/用 WhatsApp 聯絡磨飯/);
  assert.match(ui10,/唔會用短訊或電郵驗證碼自動取回舊會員資料/);
  assert.match(ui10,/一次性臨時密碼/);
  assert.match(ui10,/首次登入必須改成你自己嘅新密碼/);
});
test('notification permission is requested only by explicit click handler',()=>{
  assert.match(ui10,/onClick=\{\(\)=>void request\(\)\}/);
  assert.match(ui10,/Notification\.requestPermission\(\)/);
  assert.doesNotMatch(ui10,/useEffect\([^]*Notification\.requestPermission/);
});
test('UI10 has PWA guide and exact mobile acceptance breakpoints',()=>{
  assert.match(ui10,/加入主畫面/);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/@media\(max-width:360px\),\(max-height:780px\)/);
});
