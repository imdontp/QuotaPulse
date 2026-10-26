const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const root=process.cwd(),cli=path.join(path.dirname(require.resolve('tsx/package.json')),'dist/cli.mjs'),stages=[];
for(const workspace of ['daemon','web','tray']){
 const args=[cli,'--test','--test-concurrency=2','test/*.test.ts'];
 const result=cp.spawnSync(process.execPath,args,{cwd:path.resolve('packages',workspace),encoding:'utf8',maxBuffer:50000000});
 fs.writeFileSync(path.join(root,'tmp/review167-tests-'+workspace+'.log'),result.stdout+'\n'+result.stderr);
 stages.push({workspace,status:result.status,signal:result.signal,concurrency:2,arguments:args});if(result.status!==0)break;
}
const status=stages.length===3&&stages.every(s=>s.status===0)?0:1;fs.writeFileSync('tmp/review167-test-result.json',JSON.stringify({status,stages},null,2)+'\n');console.log(JSON.stringify({status,stages:stages.map(({workspace,status})=>({workspace,status}))}));process.exitCode=status;
