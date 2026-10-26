from pathlib import Path
import subprocess,json,hashlib,shutil,os,datetime
root=Path(__file__).resolve().parents[1];out=root/'tmp/release167';out.mkdir(exist_ok=True)
node=Path(shutil.which('node'));npm=node.parent/'node_modules/npm/bin/npm-cli.js';assert npm.is_file()
git=lambda *args:subprocess.check_output(['git',*args],cwd=root,text=True).strip()
source=git('rev-parse','HEAD');assert source=='f94f44dfa785da01795943c1c3b75676dc5f20aa'
assert not git('status','--porcelain','--untracked-files=no','--','packages','scripts','package.json','package-lock.json','tsconfig.base.json')
for rel,expected in json.loads((root/'docs/redesign-v1.85.166/source-hashes.json').read_text(encoding='utf-8')).items():assert hashlib.sha256((root/rel).read_bytes()).hexdigest()==expected,rel
runner=(root/'tmp/run-repository162.cjs').read_text(encoding='utf-8').replace('cost162','review167')
(root/'tmp/run-repository167.cjs').write_text(runner,encoding='utf-8',newline='\n')
steps=[]
env=dict(os.environ,QUOTAPULSE_REVIEW_CHECKPOINT='v1.85.166-review167')
commands=[('daemon-build',[str(npm),'run','build','-w','@quotapulse/daemon']),('web-build',[str(npm),'run','build','-w','@quotapulse/web']),('tray-build',[str(npm),'run','build','-w','@quotapulse/tray']),('repository-tests',['tmp/run-repository167.cjs']),('approved-runtime-assets',['--import','tsx','packages/tray/scripts/package-assets.ts']),('review-bundle',['--import','tsx','scripts/build-review-bundle.mts'])]
for name,args in commands:
 assert git('rev-parse','HEAD')==source
 assert not git('diff','HEAD','--','packages','scripts','package.json','package-lock.json','tsconfig.base.json')
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (out/(name+'.log')).open('w',encoding='utf-8') as log:
  result=subprocess.run([str(node),*args],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 steps.append({'name':name,'exitCode':result.returncode,'reused':False,'startedUtc':started,'finishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'log':str(out/(name+'.log'))})
 (out/'build.json').write_text(json.dumps({'sourceCommit':source,'checkout':str(root),'steps':steps},indent=2)+'\n',newline='\n')
 assert result.returncode==0,name
 print(name,'passed',flush=True)
 if name=='web-build':assert hashlib.sha256((root/'packages/web/dist/index.html').read_bytes()).hexdigest()==json.loads((root/'docs/redesign-v1.85.166/delivery.json').read_text(encoding='utf-8'))['productionIndexSha256']
input={'checkout':str(root),'bundle':json.loads((root/'screens/tray-recovery/bundle-build.json').read_text(encoding='utf-8'))['bundle'],'sourceCommit':source,'buildReceipt':str(out/'build.json')}
(out/'inputs.json').write_text(json.dumps(input,indent=2)+'\n',newline='\n')
print(json.dumps(input,indent=2),flush=True)
