import React from 'react';
import { LivePresenceLedger } from '../packages/web/src/redesign/live-record-motion.ts';
import { useLivePresenceMotion } from '../packages/web/src/redesign/use-live-record-motion.ts';
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
const priorDispatcher = internals.ReactCurrentDispatcher.current;
const keys = ['document','window','matchMedia','IntersectionObserver'];
const prior = new Map(keys.map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try {
  const results = [];
  for (const hidden of [false,true]) {
    const effects=[];
    internals.ReactCurrentDispatcher.current={useRef:value=>({current:value}),useLayoutEffect:effect=>effects.push(effect),useEffect:()=>{}};
    Object.assign(globalThis,{document:{hidden,addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),IntersectionObserver:undefined});
    const ledger=new LivePresenceLedger();
    useLivePresenceMotion({current:null},ledger,undefined,'initial',[],'data-live-record','.qp-live-feed',false,false);
    const cleanup=effects[0]();
    results.push({missingRegion:true,documentHidden:hidden,actualStartupSnapshot:ledger.snapshot()});
    cleanup();
  }
  console.log(JSON.stringify({method:'Actual useLivePresenceMotion registered mount effect, captured via isolated React dispatcher; no DOM/browser/production writes',results},null,2));
} finally {
  internals.ReactCurrentDispatcher.current=priorDispatcher;
  for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}
}
