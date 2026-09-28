import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pwa=fs.readFileSync(new URL('../src/pwa-staff.ts',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const stage0=fs.readFileSync(new URL('../src/StageZero.tsx',import.meta.url),'utf8');

test('SMM direct login accepts human loginId but binds proof/session to canonical staffId',()=>{
  assert.match(pwa,/body:JSON\.stringify\(\{loginId:identifier\}\)/);
  assert.match(pwa,/canonicalStaffId=String\(challengeBody\.staffId/);
  assert.match(pwa,/MFK_SMM_STAFF_LOGIN_V1\\n'\+challengeId\+'\\n'\+canonicalStaffId/);
  assert.match(pwa,/body:JSON\.stringify\(\{staffId:canonicalStaffId,challengeId,proofHex\}\)/);
  assert.match(worker,/row\.staffId===identifier\|\|row\.loginId===identifier/);
  assert.match(worker,/matches\.length!==1/);
  assert.match(worker,/const staffId=current\.staff\.staffId/);
});

test('SMM staff UI keeps internal identity hidden behind human loginId presentation',()=>{
  assert.match(app,/item\.loginId\?item\.loginId\+' · '/);
  assert.match(stage0,/row\.loginId\?row\.loginId\+' · '/);
  assert.match(stage0,/登入編號/);
  assert.doesNotMatch(stage0,/>Internal Staff ID</);
});
