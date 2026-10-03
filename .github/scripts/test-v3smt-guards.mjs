import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(join(root, '.github/workflows/v3smt-a0-foundation.yml'), 'utf8');
const marker = '      - name: Authority, security, sync, ordering, checkout, money, order operations, print and external guard\n        shell: bash\n        run: |\n';
assert.equal(workflow.split(marker).length, 2, 'Exactly one real workflow guard block must be tested');
const guardLines = [];
for (const line of workflow.split(marker)[1].split('\n')) {
  if (line.trim() && !line.startsWith('          ')) break;
  guardLines.push(line.slice(10));
}
const guard = guardLines.join('\n');
const realGrep = spawnSync('which', ['grep'], {encoding:'utf8'}).stdout.trim();
assert.ok(realGrep, 'GNU grep is required, as on the Ubuntu CI runner');

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'mfp-guards-'));
  t.after(() => rmSync(cwd, {recursive:true, force:true}));
  cpSync(join(root, 'v3smt'), join(cwd, 'v3smt'), {
    recursive:true,
    filter: source => !['node_modules', 'dist'].includes(source.slice(source.lastIndexOf('/') + 1)),
  });
  for (const file of [
    'carrier/android/app/src/main/java/com/morefunos/smt/MainActivity.java',
    'carrier/android/app/src/main/java/com/morefunos/smt/storekernel/business/FormalBusinessCommandRouter.java',
  ]) {
    mkdirSync(dirname(join(cwd, file)), {recursive:true});
    cpSync(join(root, file), join(cwd, file));
  }
  // The source guard tests run before build. Supply only its required output
  // contract here; the real build/output is checked by the unchanged later step.
  put(cwd, 'v3smt/dist/build-identity.json', '{"target":"MFP_V3"}\n');
  put(cwd, 'v3smt/dist/_headers', '/*\n  Cache-Control: no-store\n');
  return cwd;
}

function put(cwd, file, contents) {
  mkdirSync(dirname(join(cwd, file)), {recursive:true});
  writeFileSync(join(cwd, file), contents);
}

function run(cwd, env = {}, script = guard) {
  const result = spawnSync('bash', ['--noprofile', '--norc', '-c', script], {
    cwd, encoding:'utf8', timeout:15000,
    env:{...process.env, LC_ALL:'C', ...env},
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'The guard must terminate normally');
  return result;
}

function commandShim(cwd, command, contents) {
  put(cwd, `.test-bin/${command}`, `#!/usr/bin/env bash\n${contents}\n`);
  const result = spawnSync('chmod', ['+x', join(cwd, `.test-bin/${command}`)]);
  assert.equal(result.status, 0);
  return {PATH:`${join(cwd, '.test-bin')}:${process.env.PATH}`};
}

test('the complete workflow guard accepts clean source including assertion fixtures', t => {
  const result = run(fixture(t));
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

// These execute the complete real workflow, so an early failure cannot be
// hidden by its final successful build-identity or response-header assertion.
const forbidden = [
  ['periodic polling', 'v3smt/src/guard-probe.ts', 'setInterval(() => {}, 1000);'],
  ['legacy import', 'v3smt/src/guard-probe.ts', "import value from 'v2local';"],
  ['legacy authority source', 'v3smt/src/guard-probe.ts', 'SMM_INTENT_STORE'],
  ['legacy authority output', 'v3smt/dist/assets/probe.js', 'x-mfk-smm-session'],
  ['credential logging', 'v3smt/src/guard-probe.ts', 'console.log(staffSessionRef);'],
  ['credential URL', 'v3smt/src/guard-probe.ts', 'searchParams.set("session", value);'],
  ['credential storage', 'v3smt/src/guard-probe.ts', 'localStorage.setItem("pin", value);'],
  ['doorbell payload truth', 'v3smt/src/guard-probe.ts', 'doorbell.payload'],
  ['ordering network', 'v3smt/src/ordering-guard-probe.ts', 'fetch("/orders");'],
  ['checkout network', 'v3smt/src/checkout-guard-probe.ts', 'fetch("/payments");'],
  ['checkout storage', 'v3smt/src/checkout-guard-probe.ts', 'sessionStorage.getItem("payment");'],
  ['checkout second authority', 'v3smt/src/checkout-guard-probe.ts', 'class PaymentAuthority {}'],
  ['operations network', 'v3smt/src/order-operations-guard-probe.ts', 'fetch("/orders");'],
  ['operations second authority', 'v3smt/src/order-operations-guard-probe.ts', 'class CapacityAuthority {}'],
  ['print network', 'v3smt/src/print-hardware-guard-probe.ts', 'fetch("/print");'],
  ['print second authority', 'v3smt/src/print-hardware-guard-probe.ts', 'class PrintAuthority {}'],
  ['external network', 'v3smt/src/external-guard-probe.ts', 'fetch("/external");'],
  ['external second authority', 'v3smt/src/external-guard-probe.ts', 'class RefundAuthority {}'],
  ['external credentials', 'v3smt/src/external-guard-probe.ts', 'webhookSecret'],
  ['external credential logging', 'v3smt/src/external-guard-probe.ts', 'console.log(token);'],
  ['A9 raw native mutation', 'v3smt/src/a9-guard-probe.ts', 'store.kernel.commit.v1'],
  ['A9 credential diagnostics', 'v3smt/src/a9-guard-probe.ts', 'providerSecret'],
  ['deployment production source', 'v3smt/src/guard-probe.ts', 'wrangler deploy'],
  ['deployment config', 'v3smt/deployment.json', '{"workers_dev": true}'],
  ['deployment hidden config', 'v3smt/.deployment', 'cloudflare deploy'],
  ['deployment nested config', 'v3smt/config/nested/deploy.json', '{"workers_dev":true}'],
  ['deployment final output', 'v3smt/dist/assets/probe.js', 'cloudflare deploy'],
  ['test-named final output is not exempt', 'v3smt/dist/probe.test.ts', 'wrangler deploy'],
  ['test-named config is not exempt', 'v3smt/config/probe.test.ts', 'wrangler deploy'],
  ['dependency deployment content remains checked', 'v3smt/node_modules/probe/package.json', '{"scripts":{"deploy":"wrangler deploy"}}'],
  ['source test-named wrangler config is not exempt', 'v3smt/src/wrangler.test.ts', ''],
  ['root wrangler config', 'v3smt/wrangler.toml', ''],
  ['nested wrangler config', 'v3smt/config/nested/Wrangler.jsonc', '{}'],
];
for (const [name, file, contents] of forbidden) {
  test(`the workflow rejects ${name}`, t => {
    const cwd = fixture(t);
    put(cwd, file, contents);
    const result = run(cwd);
    assert.equal(result.status, 1, result.stdout + result.stderr);
  });
}

for (const [file, forbiddenText] of [
  ['v3smt/src/ordering-domain.ts', 'orderId'],
  ['v3smt/src/order-operations-domain.ts', "commandType:'ORDER_CREATE'"],
]) {
  test(`the workflow rejects forbidden domain content in ${file}`, t => {
    const cwd = fixture(t);
    // Append instead of replacing the file, preserving every positive assertion.
    put(cwd, file, readFileSync(join(cwd, file), 'utf8') + '\n// ' + forbiddenText + '\n');
    const result = run(cwd);
    assert.equal(result.status, 1, result.stdout + result.stderr);
  });
}

test('source test assertions remain exempt without weakening production scans', t => {
  const cwd = fixture(t);
  put(cwd, 'v3smt/src/a9-guard-probe.test.ts', 'wrangler deploy\nproviderSecret\nstore.kernel.commit.v1\nsetInterval(\n');
  put(cwd, 'v3smt/src/guard-probe.test.tsx', 'cloudflare deploy\n');
  const result = run(cwd);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const [label, trigger] of [
  ['first negative grep', '*'],
  ['external negative grep', '*--include=external-*.ts*'],
]) {
  for (const status of [2, 127]) {
    test(`${label} fails closed and preserves grep error ${status}`, t => {
      const cwd = fixture(t);
      const env = commandShim(cwd, 'grep', `case "$*" in\n  ${trigger}) echo 'injected grep failure' >&2; exit ${status} ;;\nesac\nexec ${JSON.stringify(realGrep)} "$@"`);
      const result = run(cwd, env);
      assert.equal(result.status, status, result.stdout + result.stderr);
      assert.match(result.stderr, /Guard scan failed/);
    });
  }
}

test('find failure cannot be interpreted as absence of deployment configuration', t => {
  const cwd = fixture(t);
  const env = commandShim(cwd, 'find', "echo 'injected find failure' >&2; exit 17");
  const result = run(cwd, env);
  assert.equal(result.status, 17, result.stdout + result.stderr);
});

test('positive required-source assertions still fail closed', t => {
  const cwd = fixture(t);
  const file = join(cwd, 'v3smt/src/state-authority.ts');
  writeFileSync(file, readFileSync(file, 'utf8').replace("formalTransaction:'STORE_KERNEL'", "formalTransaction:'MISSING'"));
  const result = run(cwd);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('missing build artifacts still fail closed', t => {
  const cwd = fixture(t);
  rmSync(join(cwd, 'v3smt/dist'), {recursive:true});
  const result = run(cwd);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
});

// Exercise each actual negative command independently, so overlapping rules
// cannot hide a removed/reverted enforcement wrapper. Mock only grep's process
// exit status here; production-content coverage above uses the real grep.
for (const status of [0, 1, 2, 127]) {
  test(`every negative grep handles process exit ${status} explicitly`, t => {
    const cwd = fixture(t);
    const commands = guard.split('\n').map(line => line.trim())
      .filter(line => line.startsWith('reject_matches grep '));
    assert.equal(commands.length, 31, 'All existing negative grep rules plus the split deployment scan remain present');
    assert.doesNotMatch(guard, /^\s*(! grep|if grep|! find) /m, 'No implicit negation/error-swallowing guards');
    const setup = guard.slice(0, guard.indexOf('reject_matches grep '));
    const env = commandShim(cwd, 'grep', `exit ${status}`);
    for (const command of commands) {
      const result = run(cwd, env, `${setup}\ndeploy_path=v3smt/package.json\n${command}\nprintf REACHED_END`);
      assert.equal(result.status, status === 0 ? 1 : status === 1 ? 0 : status, command + '\n' + result.stderr);
      assert.equal(result.stdout.includes('REACHED_END'), status === 1, command);
      if (status > 1) assert.match(result.stderr, /Guard scan failed/);
    }
  });
}

// Integration keeps the real native binding guards after removing the old unbound placeholder.
for (const [name, file, token] of [
  ['native checkout binding', 'v3smt/src/checkout-runtime.ts', 'authority:nativeFormalCheckoutAuthority'],
  ['checkout authenticated admission', 'v3smt/src/checkout-runtime.ts', "sessionState!=='AUTHENTICATED'||!session"],
  ['native public mutation guard', 'v3smt/src/formal-business-native-transport.ts', 'MFP_NATIVE_MUTATION_DISABLED_PUBLIC'],
  ['native runtime mode guard', 'v3smt/src/formal-business-native-transport.ts', "mfpRuntimeMode(env.currentUrl())!=='ANDROID_RUNTIME'"],
]) {
  test(`${name} remains a required source guard`, t => {
    const cwd = fixture(t);
    const path = join(cwd, file);
    const contents = readFileSync(path, 'utf8');
    assert.ok(contents.includes(token));
    writeFileSync(path, contents.split(token).join('MISSING_REQUIRED_BINDING'));
    assert.notEqual(run(cwd).status, 0);
  });
}

test('native CI runs the complete unit suite and retains reports without hiding failures', () => {
  const native = workflow.split('\n  native-router:')[1];
  assert.ok(native, 'Native CI job is required');
  assert.ok(workflow.includes('      - work/MFP-V3-UNIFIED-INTEGRATION-2026-10-03'));
  assert.ok(native.includes('run: gradle :app:testDebugUnitTest -x verifySmtWebBundle --no-daemon'));
  assert.doesNotMatch(native, /--tests|continue-on-error:\s*true|\|\|\s*true/);
  assert.ok(native.includes('carrier/android/app/build/test-results/testDebugUnitTest/**'));
  assert.ok(native.includes('carrier/android/app/build/reports/tests/testDebugUnitTest/**'));
});
