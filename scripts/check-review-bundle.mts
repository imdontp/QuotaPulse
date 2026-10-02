import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root=fileURLToPath(new URL('..', import.meta.url));
const output=resolve(root,'screens/tray-recovery');
const built=JSON.parse(readFileSync(resolve(output,'bundle-build.json'),'utf8'));
const extracted=mkdtempSync(resolve(tmpdir(),'QuotaPulse-review-'));
cpSync(built.bundle,extracted,{recursive:true});
const require=createRequire(resolve(extracted,'package.json'));
for(const name of ['fastify','better-sqlite3','electron']) assert.ok(require.resolve(name).startsWith(extracted),`${name} fell back to original dependencies`);
const ps=resolve(process.env.WINDIR!,'System32/WindowsPowerShell/v1.0/powershell.exe');
const data=resolve(extracted,'review-data');
const checks:string[]=[];
function script(name:string,...args:string[]) {
  const result=spawnSync(ps,['-NoProfile','-NonInteractive','-File',resolve(extracted,'scripts',name),...args],{encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stderr+result.stdout);
  return result.stdout;
}
try {
  script('start-review.ps1','-WhatIf');
  assert.equal(existsSync(data),false);
  checks.push('start WhatIf creates no review profile or processes');
  script('start-review.ps1');
  const lock=JSON.parse(readFileSync(resolve(data,'daemon.lock'),'utf8'));
  const response=await fetch(`http://127.0.0.1:${lock.port}/api/health`,{headers:{'x-quotapulse-token':lock.token}});
  assert.equal(response.status,200);
  const health=await response.json() as any;
  assert.deepEqual(health.scheduler.sources,[]);
  assert.ok(existsSync(resolve(data,'electron')));
  const processes=JSON.parse(readFileSync(resolve(data,'review-processes.json'),'utf8'));
  assert.ok(processes.daemon.pid>0&&processes.tray.pid>0);
  checks.push('extracted bundle outside repository dependencies starts its real daemon/tray with readers off and isolated profile');
  script('stop-review.ps1','-WhatIf');
  assert.doesNotThrow(()=>process.kill(processes.daemon.pid,0));
  assert.doesNotThrow(()=>process.kill(processes.tray.pid,0));
  checks.push('stop WhatIf retains both recorded processes');
  script('stop-review.ps1');
  await delay(500);
  for(const record of [processes.daemon,processes.tray]) assert.throws(()=>process.kill(record.pid,0));
  assert.ok(existsSync(resolve(data,'usage.db')));
  checks.push('scoped stop ends recorded processes and preserves database');
  script('start-review.ps1'); script('stop-review.ps1');
  checks.push('restart tolerates retained review process records and stale daemon lock');
  mkdirSync(output,{recursive:true});
  writeFileSync(resolve(output,'bundle-verification.json'),JSON.stringify({status:'passed',extracted,checks,requiredNodeAbi:built.requiredNodeAbi,externalNode:true,limitations:['local Windows review bundle; unsigned and not an installer','readers disabled; empty usage database','host Node prerequisite; no logon tasks installed']},null,2));
  console.log(`Review bundle passed: ${checks.length} checks outside the repository dependency tree.`);
} finally { if(existsSync(resolve(data,'review-processes.json'))) script('stop-review.ps1'); }
