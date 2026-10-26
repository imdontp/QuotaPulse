import {useLayoutEffect,useRef,useState} from 'react';

type Tick={at:number;label:string;position:number};

/** Keep exact scope endpoints; show intermediate labels only when they fit.
 * Measuring the rendered locale/font also handles narrow plots and font loading. */
export function CostDateAxis({ticks,title}:{ticks:readonly Tick[];title:(at:number)=>string}){
 const axis=useRef<HTMLDivElement>(null);
 const [layout,setLayout]=useState<{hidden:number[];stacked:boolean}>({hidden:[],stacked:false});
 const key=JSON.stringify(ticks);
 useLayoutEffect(()=>{
  const element=axis.current;if(!element)return;
  let disposed=false;
  const measure=()=>{
   if(disposed)return;
   const boxes=[...element.querySelectorAll('time')].map(node=>node.getBoundingClientRect());
   if(boxes.length<2)return;
   const first=boxes[0]!,last=boxes.at(-1)!,gap=8;
   const stacked=first.right+gap>last.left,hidden:number[]=[];
   let edge=first.right+gap;
   boxes.slice(1,-1).forEach((box,index)=>{
    if(stacked||box.width===0||box.left<edge||box.right>last.left-gap)hidden.push(index+1);
    else edge=box.right+gap;
   });
   setLayout(previous=>previous.stacked===stacked&&previous.hidden.join(',')===hidden.join(',')?previous:{hidden,stacked});
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  void document.fonts.ready.then(measure);
  return()=>{disposed=true;observer.disconnect();};
 },[key]);
 return <div ref={axis} className="qp-cost-plot-dates" data-stacked={layout.stacked||undefined}>{ticks.map((tick,index)=><time key={tick.at} dateTime={new Date(tick.at).toISOString()} title={title(tick.at)} data-hidden={layout.hidden.includes(index)||undefined} style={{left:`${tick.position}%`}}>{tick.label}</time>)}</div>;
}
