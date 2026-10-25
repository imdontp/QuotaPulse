import assert from 'node:assert/strict';
import test from 'node:test';
import { projectObservedIdentities } from '../src/redesign/project-observed-identities.js';
test('project identities count recorded harnesses and providers independently of row multiplicity',()=>{
 const rows=[{harness:'codex',provider:'openai'},{harness:'codex',provider:'openai'},{harness:'hermes',provider:'openai'},{harness:'hermes',provider:'OpenAI'}];
 assert.deepEqual(projectObservedIdentities(rows),{harnesses:['codex','hermes'],providers:['OpenAI','openai'],hasMissingProvider:false});
 assert.equal(rows.length,4);
});
test('missing, empty and whitespace providers remain unknown without inflating known counts',()=>{
 for(const provider of [null,'',' '])assert.deepEqual(projectObservedIdentities([{harness:'codex',provider}]),{harnesses:['codex'],providers:[],hasMissingProvider:true});
 assert.deepEqual(projectObservedIdentities([{harness:'codex',provider:null},{harness:'codex',provider:'openai'}]).providers,['openai']);
 assert.deepEqual(projectObservedIdentities([]),{harnesses:[],providers:[],hasMissingProvider:false});
});
