import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'

const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const paths: Record<string, string> = {
    cube:'M12 2 3 7l9 5 9-5-9-5Zm-9 5v10l9 5V12M21 7v10l-9 5', chip:'M9 3v3m6-3v3m-6 12v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M7 7h10v10H7z', activity:'M3 12h4l2-6 4 12 2-6h6', target:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', sliders:'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6', play:'m9 7 7 5-7 5V7Z', download:'M12 3v12m-5-5 5 5 5-5M5 21h14', check:'m5 12 4 4L19 6', layers:'M12 3 3 8l9 5 9-5-9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5', network:'M12 5v4m-7 6v4m14-4v4M5 15h14M5 15l7-6 7 6M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', alert:'M12 9v4m0 4h.01M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z', arrow:'m9 18 6-6-6-6', database:'M4 6c0 2 16 2 16 0S4 4 4 6Zm0 0v6c0 2 16 2 16 0V6m-16 6v6c0 2 16 2 16 0v-6', menu:'M4 6h16M4 12h16M4 18h16'
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.cube}/></svg>
}

function Header({language='zh',onLanguageChange}:{language?:'zh'|'en';onLanguageChange:(language:'zh'|'en')=>void}){
  const en=language==='en'
  return <header className="header"><div className="brand-switch"><div className="brand-mark"><span/><span/><span/></div><div className="brand"><h1>{en?'Integrated Computing, Storage & Network Planning':'算存网一体化规划仿真平台'}</h1>{en&&<p>PLANNING SIMULATION PLATFORM</p>}</div></div><div className="header-context"><div className="language-switch" role="group" aria-label={en?'Language':'语言切换'}><button className={!en?'active':''} onClick={()=>onLanguageChange('zh')} aria-pressed={!en}>中文</button><button className={en?'active':''} onClick={()=>onLanguageChange('en')} aria-pressed={en}>EN</button></div></div></header>
}

function App(){
  return <ConceptPlanningDemo/>
}

type TopologyKind='clos'|'railClos'|'dualClos'|'torus3d'|'dragonfly'
type TopologyPoint={x:number;y:number;tone?:'a'|'b'|'endpoint'}
type ConceptPriority='performance'|'cost'|'reliability'|'balanced'
type ConceptPlan={label:string;topology:TopologyKind;p:number;d:number;nodes:number;throughput:number;ttft:number;tpot:number;util:number;cost:number;availability:string;network:string;networkNote:string;nodeUplink:string;injectionTbps:number;fabricDiameter:number;fabricUnits:string;kv:string;hbmTotalTB:number;hbmOccupiedTB:number;hbmKvTB:number;ddrTB:number;ssdTB:number;focus:string}
const topologyDefinitions:Record<TopologyKind,{label:string;points:TopologyPoint[];edges:[number,number,string?][]}>={
  clos:{label:'2-Tier CLOS',points:[{x:38,y:8,tone:'a'},{x:62,y:8,tone:'a'},{x:18,y:45},{x:39,y:45},{x:61,y:45},{x:82,y:45},{x:10,y:86,tone:'endpoint'},{x:25,y:86,tone:'endpoint'},{x:32,y:86,tone:'endpoint'},{x:46,y:86,tone:'endpoint'},{x:54,y:86,tone:'endpoint'},{x:68,y:86,tone:'endpoint'},{x:75,y:86,tone:'endpoint'},{x:90,y:86,tone:'endpoint'}],edges:[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,6],[2,7],[3,8],[3,9],[4,10],[4,11],[5,12],[5,13]]},
  railClos:{label:'Rail-Optimized Fat-Tree',points:[{x:17,y:8,tone:'a'},{x:39,y:8,tone:'a'},{x:61,y:8,tone:'b'},{x:83,y:8,tone:'b'},{x:17,y:47},{x:39,y:47},{x:61,y:47},{x:83,y:47},{x:9,y:87,tone:'endpoint'},{x:25,y:87,tone:'endpoint'},{x:31,y:87,tone:'endpoint'},{x:47,y:87,tone:'endpoint'},{x:53,y:87,tone:'endpoint'},{x:69,y:87,tone:'endpoint'},{x:75,y:87,tone:'endpoint'},{x:91,y:87,tone:'endpoint'}],edges:[[0,4,'a'],[0,5,'a'],[1,4,'a'],[1,5,'a'],[2,6,'b'],[2,7,'b'],[3,6,'b'],[3,7,'b'],[4,8],[4,9],[5,10],[5,11],[6,12],[6,13],[7,14],[7,15]]},
  dualClos:{label:'双平面 Rail Fat-Tree',points:[{x:17,y:8,tone:'a'},{x:33,y:8,tone:'a'},{x:67,y:8,tone:'b'},{x:83,y:8,tone:'b'},{x:15,y:47,tone:'a'},{x:35,y:47,tone:'a'},{x:65,y:47,tone:'b'},{x:85,y:47,tone:'b'},{x:8,y:87,tone:'endpoint'},{x:22,y:87,tone:'endpoint'},{x:29,y:87,tone:'endpoint'},{x:43,y:87,tone:'endpoint'},{x:57,y:87,tone:'endpoint'},{x:71,y:87,tone:'endpoint'},{x:78,y:87,tone:'endpoint'},{x:92,y:87,tone:'endpoint'}],edges:[[0,4,'a'],[0,5,'a'],[1,4,'a'],[1,5,'a'],[2,6,'b'],[2,7,'b'],[3,6,'b'],[3,7,'b'],[4,8,'a'],[4,9,'a'],[5,10,'a'],[5,11,'a'],[6,12,'b'],[6,13,'b'],[7,14,'b'],[7,15,'b']]},
  torus3d:{label:'3D Torus',points:[{x:22,y:48,tone:'a'},{x:49,y:48,tone:'a'},{x:76,y:48,tone:'a'},{x:22,y:78,tone:'a'},{x:49,y:78,tone:'a'},{x:76,y:78,tone:'a'},{x:12,y:20,tone:'b'},{x:39,y:20,tone:'b'},{x:66,y:20,tone:'b'},{x:12,y:50,tone:'b'},{x:39,y:50,tone:'b'},{x:66,y:50,tone:'b'}],edges:[[0,1,'a'],[1,2,'a'],[2,0,'a'],[3,4,'a'],[4,5,'a'],[5,3,'a'],[0,3,'a'],[1,4,'a'],[2,5,'a'],[6,7,'b'],[7,8,'b'],[8,6,'b'],[9,10,'b'],[10,11,'b'],[11,9,'b'],[6,9,'b'],[7,10,'b'],[8,11,'b'],[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]]},
  dragonfly:{label:'Dragonfly+',points:[{x:12,y:22,tone:'a'},{x:24,y:12,tone:'a'},{x:28,y:30,tone:'a'},{x:72,y:18,tone:'b'},{x:86,y:12,tone:'b'},{x:88,y:31,tone:'b'},{x:12,y:72,tone:'b'},{x:26,y:64,tone:'b'},{x:28,y:84,tone:'b'},{x:70,y:70,tone:'a'},{x:84,y:62,tone:'a'},{x:88,y:82,tone:'a'}],edges:[[0,1,'a'],[1,2,'a'],[2,0,'a'],[3,4,'b'],[4,5,'b'],[5,3,'b'],[6,7,'b'],[7,8,'b'],[8,6,'b'],[9,10,'a'],[10,11,'a'],[11,9,'a'],[2,3],[1,10],[5,11],[4,7],[8,9],[6,0]]},
}

function ConceptTopology({kind,scale,compact=false,language='zh'}:{kind:TopologyKind;scale:number;compact?:boolean;language?:'zh'|'en'}){
  const topology=topologyDefinitions[kind]
  const topologyLabel=language==='en'&&kind==='dualClos'?'Dual-Plane Rail Fat-Tree':topology.label
  const nodeLabel=language==='en'?'nodes':'节点'
  return <div className={`concept-topology ${kind} ${compact?'compact':''}`}>
    <div className="concept-topology-caption">{(language==='en'||kind==='dualClos')&&<b>{topologyLabel}</b>}<span>{scale} {nodeLabel}</span></div>
    <svg className="concept-topology-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${topologyLabel}, ${scale} ${nodeLabel}`}>
      <g className="topology-svg-edges">{topology.edges.map(([from,to,tone],index)=>{const a=topology.points[from],b=topology.points[to];return <line key={index} className={tone??''} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>})}</g>
      <g className="topology-svg-nodes">{topology.points.map((point,index)=><rect key={index} className={point.tone??''} x={point.x-1.2} y={point.y-3} width="2.4" height="6" rx="1"/>)}</g>
    </svg>
  </div>
}

const conceptPlanOrder:ConceptPriority[]=['performance','cost','reliability','balanced']
const conceptPlanColors:Record<ConceptPriority,string>={performance:'#56d9ef',cost:'#58d9ae',reliability:'#9c9fff',balanced:'#f3c66f'}
const topologySearchProfiles:Record<ConceptPriority,{at:number;nodes:number;topology:TopologyKind}[]>={
  performance:[{at:0,nodes:36,topology:'clos'},{at:36,nodes:40,topology:'clos'},{at:49,nodes:44,topology:'railClos'},{at:64,nodes:42,topology:'dragonfly'},{at:79,nodes:42,topology:'dragonfly'}],
  cost:[{at:0,nodes:36,topology:'clos'},{at:40,nodes:34,topology:'clos'},{at:55,nodes:34,topology:'railClos'},{at:71,nodes:28,topology:'torus3d'},{at:88,nodes:30,topology:'torus3d'}],
  reliability:[{at:0,nodes:36,topology:'clos'},{at:38,nodes:40,topology:'clos'},{at:52,nodes:40,topology:'railClos'},{at:68,nodes:46,topology:'dualClos'},{at:84,nodes:44,topology:'dualClos'}],
  balanced:[{at:0,nodes:36,topology:'clos'},{at:43,nodes:38,topology:'clos'},{at:58,nodes:38,topology:'dragonfly'},{at:74,nodes:40,topology:'railClos'},{at:91,nodes:37,topology:'railClos'}],
}

function smoothOptimizationProgress(progress:number){
  const raw=Math.max(0,Math.min(1,(progress-8)/88))
  return raw*raw*(3-2*raw)
}

function preferenceSearchProgress(progress:number){
  const total=smoothOptimizationProgress(progress),split=.12
  return {total,trunk:Math.min(1,total/split),branch:Math.max(0,(total-split)/(1-split)),split}
}

function DimensionGlyph({index}:{index:number}){
  if(index===0)return <g className="dimension-glyph scheduler"><path d="M-20-12h40M-20 0h40M-20 12h40"/><circle cx="9" cy="-12" r="4"/><circle cx="-7" cy="0" r="4"/><circle cx="3" cy="12" r="4"/></g>
  if(index===1)return <g className="dimension-glyph parallel"><rect x="-18" y="-18" width="14" height="14"/><rect x="4" y="-18" width="14" height="14"/><rect x="-18" y="4" width="14" height="14"/><rect x="4" y="4" width="14" height="14"/><circle cx="0" cy="0" r="3"/><path d="M-11-4v4h8M11-4v4H3M-11 4V0h8M11 4V0H3"/></g>
  if(index===2)return <g className="dimension-glyph topology-cycle">
    <g className="topology-state clos-mini"><rect x="-16" y="-19" width="8" height="6"/><rect x="8" y="-19" width="8" height="6"/><rect x="-22" y="13" width="7" height="6"/><rect x="-4" y="13" width="7" height="6"/><rect x="15" y="13" width="7" height="6"/><path d="M-12-13V0M12-13V0M-19 0h38M-18.5 0v13M-.5 0v13M18.5 0v13"/></g>
    <g className="topology-state torus-mini"><rect x="-17" y="-17" width="8" height="7"/><rect x="9" y="-17" width="8" height="7"/><rect x="-17" y="10" width="8" height="7"/><rect x="9" y="10" width="8" height="7"/><path d="M-9-14h18M-9 14h18M-13-10v20M13-10v20M-13-14C-25-14-25 14-13 14M13-14C25-14 25 14 13 14"/></g>
    <g className="topology-state dragonfly-mini"><circle cx="-15" cy="-12" r="4"/><circle cx="-7" cy="-18" r="4"/><circle cx="-5" cy="-7" r="4"/><circle cx="13" cy="11" r="4"/><circle cx="6" cy="18" r="4"/><circle cx="18" cy="18" r="4"/><path d="M-15-12-7-18-5-7-15-12M13 11 6 18 18 18 13 11M-5-7 13 11M-7-18 18 18"/></g>
  </g>
  if(index===3)return <g className="dimension-glyph tier"><path d="M-20-14h40l-6 8h-28zM-15-3h30L10 5h-20zM-10 8h20l-4 8H-6z"/><path className="tier-transfer" d="M23-12v25m-4-4 4 4 4-4"/></g>
  return <g className="dimension-glyph pd-ratio"><text x="-23" y="-7">P</text><rect className="p-block" x="-13" y="-16" width="34" height="11" rx="2"/><text x="-23" y="14">D</text><rect className="d-block" x="-13" y="5" width="24" height="11" rx="2"/><path d="M24-11v22m-3-3 3 3 3-3"/></g>
}

function HighDimensionalSearch({progress,hasStarted,done,activeKeys,language,onRestart}:{progress:number;hasStarted:boolean;done:boolean;activeKeys:ConceptPriority[];language:'zh'|'en';onRestart:()=>void}){
  const en=language==='en'
  const {total:ratio,branch:branchRatio,split:splitAt}=preferenceSearchProgress(progress)
  const dimensionLabels=en?['SCHED PARAMS','PARALLELISM','TOPOLOGY','KV TIERING','P / D RATIO']:['调度参数','并行策略','网络拓扑','KV 分层','P / D 配比']
  const routePrefix='M282 706 C233 674 249 622 307 615 C366 608 351 558 391 552'
  const sharedStepA='C404 549 416 554 430 552'
  const sharedStepB='C444 550 458 548 470 544'
  const sharedStepC='C484 540 497 536 510 532'
  const paths:Record<ConceptPriority,{curve:string;points:[number,number][]}>={
    performance:{curve:`${routePrefix} C407 550 442 485 530 405 C582 355 580 310 640 280 C698 252 755 292 820 306`,points:[[450,516],[530,405],[600,338],[688,265],[820,306]]},
    cost:{curve:`${routePrefix} ${sharedStepA} ${sharedStepB} ${sharedStepC} C523 528 540 537 550 554 C565 580 563 607 590 612 C626 620 650 556 676 500 C690 467 706 440 720 431`,points:[[536,543],[570,600],[608,606],[681,487],[720,431]]},
    reliability:{curve:`${routePrefix} ${sharedStepA} C445 550 466 543 472 522 C479 494 458 464 424 449 C389 433 350 445 368 430 C399 387 472 378 534 360 C608 339 687 331 765 350`,points:[[462,534],[452,472],[368,430],[610,339],[765,350]]},
    balanced:{curve:`${routePrefix} ${sharedStepA} ${sharedStepB} C489 537 510 520 530 510 C590 494 673 449 720 420 C754 399 782 391 808 398`,points:[[500,528],[530,510],[630,473],[730,414],[808,398]]},
  }
  const paretoRatio=Math.max(0,Math.min(1,branchRatio*1.8))
  const objective=(.38+.55*ratio).toFixed(3),loss=(1.42-1.31*ratio).toFixed(3)
  const delta=hasStarted&&!done?(Math.max(.003,.061*(1-ratio)+Math.abs(Math.sin(progress*.19))*.008)).toFixed(3):'—'
  const exploredSpace=10**(6+9*ratio)
  const exploredExponent=Math.floor(Math.log10(exploredSpace))
  const exploredMantissa=(exploredSpace/10**exploredExponent).toFixed(2)
  return <div className={`high-d-search ${hasStarted?'search-active':''} ${done?'search-complete':''}`}>
    <div className="search-title">{en&&<span>5D OBJECTIVE LANDSCAPE</span>}<b>{en?'Multi-objective adaptive high-dimensional search':'多目标自适应高维寻优'}</b>{en&&<small>PCA PROJECTION · QUALITY-GUIDED SEARCH</small>}</div>
    <svg className="search-manifold" viewBox="0 0 1000 1000" role="img" aria-label={en?'Five-dimensional multi-objective optimization landscape':'五维多目标寻优空间'}>
      <defs>
        <radialGradient id="searchCore"><stop offset="0" stopColor="#183f51" stopOpacity=".88"/><stop offset=".55" stopColor="#0b2231" stopOpacity=".5"/><stop offset="1" stopColor="#06131f" stopOpacity="0"/></radialGradient>
        <radialGradient id="qualityBasin"><stop offset="0" stopColor="#4bd9bd" stopOpacity=".22"/><stop offset=".38" stopColor="#32b7c4" stopOpacity=".09"/><stop offset="1" stopColor="#0a2231" stopOpacity="0"/></radialGradient>
        <linearGradient id="trunkGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#405d6b"/><stop offset=".46" stopColor="#3d91a6"/><stop offset="1" stopColor="#77e2d3"/></linearGradient>
        <filter id="searchGlow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="softBlur"><feGaussianBlur stdDeviation="2.4"/></filter>
      </defs>
      <g className="search-core-field" transform="translate(500 500) scale(.82) translate(-500 -500)">
      <circle cx="500" cy="500" r="445" fill="url(#searchCore)"/>
      <g className="quality-regions"><path className="poor-zone" d="M92 606 C165 503 275 520 351 604 C422 683 385 839 245 893 C128 873 73 762 92 606Z"/><ellipse className="quality-basin" cx="688" cy="350" rx="267" ry="226" fill="url(#qualityBasin)"/><path className="quality-ridge" d="M512 476 C562 397 632 326 751 268 C813 238 854 245 895 268"/></g>
      <g className="manifold-grid">
        {[132,206,281,354,424].map((radius,index)=><ellipse key={radius} cx="500" cy="500" rx={radius} ry={radius*(.72+index*.015)} transform={`rotate(${index%2?8:-7} 500 500)`}/>)}
        <path d="M307 563 C309 519 349 492 391 507 C421 518 449 504 455 536 C461 564 425 566 431 591 C437 616 400 607 378 626 C347 652 302 614 307 563Z"/>
        <path d="M292 546 C268 480 326 437 378 451 C420 462 423 491 462 474 C500 457 498 409 544 389 C590 370 641 400 640 442 C639 478 601 490 608 518 C616 549 573 531 544 548 C506 571 473 631 415 644 C355 657 307 612 292 546Z"/>
        <path d="M234 598 C188 499 273 409 347 397 C405 388 421 430 474 394 C523 361 530 303 603 292 C680 280 746 338 728 405 C714 455 671 478 684 523 C699 574 689 646 624 688 C564 727 512 675 450 704 C373 740 270 680 234 598Z"/>
        <path d="M174 626 C116 485 235 359 329 335 C403 316 433 358 503 308 C567 262 576 213 673 226 C773 239 846 320 810 400 C784 459 738 484 761 547 C789 622 766 700 697 746 C613 801 552 738 480 781 C382 839 209 718 174 626Z"/>
        <path d="M108 658 C42 467 184 300 306 271 C403 248 445 300 528 241 C611 182 650 142 755 180 C875 223 933 323 877 417 C835 488 803 523 843 601 C895 701 791 802 686 832 C565 867 490 807 381 841 C246 883 137 752 108 658Z"/>
        {dimensionLabels.map((_,index)=>{const angle=-Math.PI/2+index*Math.PI*2/5;return <line key={index} x1="500" y1="500" x2={500+Math.cos(angle)*442} y2={500+Math.sin(angle)*442}/>})}
      </g>
      <g className="manifold-contours">
        <path d="M286 426 C292 375 336 337 389 348 C432 357 453 395 438 434 C423 474 382 484 343 468 C310 455 281 450 286 426Z"/>
        <path d="M514 439 C535 365 598 319 657 283 C710 250 774 272 816 313 C855 351 848 400 816 435 C778 476 728 452 687 480 C641 512 594 486 554 468 C527 456 506 458 514 439Z"/>
        <path d="M548 578 C565 527 614 498 666 510 C718 522 750 560 734 605 C719 648 670 666 626 649 C586 634 537 615 548 578Z"/>
      </g>
      <g className="contour-scores"><text x="448" y="540">Q 0.42</text><text x="514" y="500">0.58</text><text x="580" y="466">0.73</text><text x="637" y="438">0.86</text><text x="690" y="413">0.92</text></g>
      <g className="latent-slices" filter="url(#softBlur)"><ellipse cx="470" cy="490" rx="300" ry="118" transform="rotate(32 500 500)"/><ellipse cx="535" cy="515" rx="276" ry="96" transform="rotate(-38 500 500)"/><ellipse cx="500" cy="500" rx="338" ry="68" transform="rotate(78 500 500)"/></g>
      <g className="gradient-vectors">{Array.from({length:18},(_,index)=>{const x=190+((index*97)%610),y=220+((index*71)%520),angle=Math.atan2(348-y,690-x),length=15+(index%4)*4;return <path key={index} d={`M${x} ${y} l${Math.cos(angle)*length} ${Math.sin(angle)*length}`}/>})}</g>
      <g className="pareto-envelope" style={{opacity:paretoRatio}}><path className="pareto-sector" d="M615 450 Q704 305 858 250 Q894 342 890 458 Q738 484 615 450Z"/>{paretoRatio>.2&&en&&<><text className="pareto-label" x="756" y="287">PARETO FEASIBLE REGION</text><text className="dominated-label" x="754" y="466">5D PROJECTED FRONTIER</text></>}</g>
      {hasStarted&&<g className="search-origin" transform="translate(282 706)" filter="url(#searchGlow)"><circle className="origin-halo" r="28"/><circle className="origin-ring" r="14"/><circle className="origin-core" r="5"/><path d="M-20 0h-8M20 0h8M0-20v-8M0 20v8"/><text y="43">{en?'SEARCH START':'寻优起点'}</text></g>}
      {conceptPlanOrder.map(key=>{
        const selected=activeKeys.includes(key)
        return <g key={key} className={`optimization-path ${key} ${selected?'selected':'muted'}`} style={{'--path-color':conceptPlanColors[key]} as React.CSSProperties}>
          <path className="path-progress" pathLength="1" d={paths[key].curve} style={{strokeDashoffset:1-ratio}}/>
          {selected&&done&&<g className="trail-points branch"><circle className="optimum-point" cx={paths[key].points.at(-1)![0]} cy={paths[key].points.at(-1)![1]} r="9"/></g>}
        </g>
      })}
      </g>
      {dimensionLabels.map((label,index)=>{const angle=-Math.PI/2+index*Math.PI*2/5,x=500+Math.cos(angle)*444,y=500+Math.sin(angle)*444;return <g className={`dimension-label dimension-${index+1}`} key={label} transform={`translate(${x} ${y})`}><circle className="dimension-shell" r="52"/><circle className="dimension-inner" r="44"/><circle className="dimension-track" r="48" pathLength="1"/><DimensionGlyph index={index}/><text className="dimension-name" y="67">{label}</text></g>})}
    </svg>
    <div className="search-hud left"><span><small>ITERATION</small><b>{String(Math.ceil(progress/4)).padStart(2,'0')} / 25</b></span><span className="objective-up"><small>OBJECTIVE ↑</small><b>{objective}</b></span><span><small>GRAD NORM</small><b>{hasStarted?(2.84*(1-ratio)+.04).toFixed(3):'—'}</b></span></div>
    <div className="search-hud right"><span><small>CANDIDATES</small><b>{Math.round(512*progress/100)}</b></span><span><small>FEASIBLE</small><b>{Math.round(58*progress/100)}</b></span><span className="loss-down"><small>LOSS ↓</small><b>{loss}</b></span><span><small>ACCEPTED Δ</small><b>{delta}</b></span></div>
    <div className="search-phase"><i style={{width:`${progress}%`}}/>{hasStarted&&<div className="explored-space-marker" style={{left:`${Math.max(8,Math.min(92,progress))}%`}}><small>{en?'EXPLORED SEARCH SPACE':'已探索寻优空间'}</small><b>{exploredMantissa} × 10<sup>{exploredExponent}</sup></b></div>}<span>{hasStarted?(done?(en?'Pareto optima converged':'Pareto 前沿上的四个偏好解已收敛'):ratio<splitAt?(en?'Rejecting weak candidates · moving toward the quality basin':'淘汰较差候选 · 正在进入高质量区域'):(en?'Refining preferences along the Pareto frontier':'沿 Pareto 前沿细化不同偏好')):(en?'Ready for joint search':'等待启动联合寻优')}</span>{done&&<button onClick={onRestart}>{en?'RESTART':'重新寻优'}</button>}</div>
  </div>
}

function OptimizationRadar({plans,progress,activeKeys,language}:{plans:Record<ConceptPriority,ConceptPlan>;progress:number;activeKeys:ConceptPriority[];language:'zh'|'en'}){
  const en=language==='en',search=preferenceSearchProgress(progress)
  const base=[65,63,68,66,72,64]
  const shared=[79,77,80,78,84,79]
  const targets:Record<ConceptPriority,number[]>={performance:[98,96,97,64,88,82],cost:[72,70,76,98,84,80],reliability:[84,82,86,62,99,98],balanced:[90,89,91,87,95,92]}
  const labels=['TTFT P95','TPOT P95','OUTPUT TPS','COST / M TOK','AVAILABILITY','MTTR']
  const series=conceptPlanOrder.filter(key=>activeKeys.includes(key)).map((key,keyIndex)=>({
    name:plans[key].label,
    value:base.map((value,index)=>Math.round(value+(shared[index]-value)*search.trunk+(targets[key][index]-shared[index])*search.branch+(search.branch>0&&progress<94?Math.sin(progress*.19+index+keyIndex)*.75*(1-search.branch):0))),
    symbol:'circle',symbolSize:3,lineStyle:{width:1.5,color:conceptPlanColors[key]},itemStyle:{color:conceptPlanColors[key]},areaStyle:{color:conceptPlanColors[key],opacity:.055},
  }))
  const option={animation:true,animationDurationUpdate:520,animationEasingUpdate:'cubicOut',tooltip:{trigger:'item',backgroundColor:'#071824',borderColor:'#31566a',textStyle:{color:'#cfe6ef',fontSize:10}},legend:{top:4,right:8,itemWidth:8,itemHeight:3,textStyle:{color:'#7898a9',fontSize:8},data:series.map(item=>item.name)},radar:{center:['50%','55%'],radius:'67%',shape:'polygon',splitNumber:4,indicator:labels.map(name=>({name,max:100})),axisName:{color:'#66899d',fontSize:8},axisLine:{lineStyle:{color:'rgba(74,118,139,.26)'}},splitLine:{lineStyle:{color:'rgba(74,118,139,.22)'}},splitArea:{areaStyle:{color:['rgba(10,31,45,.32)','rgba(12,40,54,.18)']} }},series:[{type:'radar',data:series}]}
  return <div className="optimization-radar"><header><span>{en&&<small>QUANTIFIED OBJECTIVE METRICS</small>}<b>{en?'Performance · Cost · Reliability':'性能 · 成本 · 可靠性指标'}</b></span></header><ReactECharts option={option} notMerge lazyUpdate style={{height:'100%',width:'100%'}}/></div>
}

function OptimizationResultCard({priority,plan,progress,selected,language,onOpen}:{priority:ConceptPriority;plan:ConceptPlan;progress:number;selected:boolean;language:'zh'|'en';onOpen:()=>void}){
  const en=language==='en'
  const topologyProfile=topologySearchProfiles[priority]
  const topologyCandidate=topologyProfile.reduce((current,candidate)=>progress>=candidate.at?candidate:current,topologyProfile[0])
  const candidateIndex=topologyProfile.indexOf(topologyCandidate)
  const acceptedProgress=candidateIndex===topologyProfile.length-1?100:topologyCandidate.at
  const search=preferenceSearchProgress(acceptedProgress)
  const interpolate=(start:number,shared:number,end:number)=>Math.round(start+(shared-start)*search.trunk+(end-shared)*search.branch)
  const interpolateCapacity=(start:number,shared:number,end:number)=>Math.round((start+(shared-start)*search.trunk+(end-shared)*search.branch)*10)/10
  const p=interpolate(24,25,plan.p),d=interpolate(12,13,plan.d)
  const hbmKvTB=interpolateCapacity(6.4,7.1,plan.hbmKvTB),ddrTB=interpolateCapacity(48,54,plan.ddrTB),ssdTB=interpolateCapacity(120,132,plan.ssdTB)
  const nodes=progress>=100?plan.nodes:topologyCandidate.nodes
  const topology:TopologyKind=progress>=100?plan.topology:topologyCandidate.topology
  const hasSsd=search.branch>.45&&plan.ssdTB>0,capacityScaleTB=180
  const targetFit={performance:96.8,cost:94.3,reliability:98.1,balanced:96.2}[priority]
  const fit=68+(84-68)*search.trunk+(targetFit-84)*search.branch
  const coreValue=`${fit.toFixed(1)}%`,coreLabel=en?'TARGET FIT':'目标达成度'
  const updateIndex=topologyProfile.findIndex(candidate=>candidate.at>0&&progress>=candidate.at&&progress<candidate.at+2)
  const syncClass=updateIndex>=0&&selected?`sync-${updateIndex%2?'a':'b'}`:''
  return <button className={`optimization-result-card ${priority} ${selected?'selected':'not-selected'} ${syncClass}`} style={{'--plan-color':conceptPlanColors[priority]} as React.CSSProperties} onClick={onOpen} disabled={progress<100||!selected}>
    <header><span><i/><small>{String(conceptPlanOrder.indexOf(priority)+1).padStart(2,'0')} · {plan.label}</small></span><em>{progress>=100&&selected?(en?'CONVERGED':'已收敛'):updateIndex>=0&&selected?(en?'BEST UPDATED':'最优解更新'):progress>0&&selected?(en?'CURRENT BEST':'当前最优'):selected?(en?'SHARED BASELINE':'共同基线'):(en?'NOT SELECTED':'未参与')}</em><strong>{coreValue}<small>{coreLabel}</small></strong></header>
    <div className="card-visuals">
      <section className="card-pd">{en&&<label>P / D INSTANCE RATIO</label>}<div><span className="p" style={{flex:p}}><b>P</b><i>{p}</i></span><u><i/><i/><i/></u><span className="d" style={{flex:d}}><b>D</b><i>{d}</i></span></div></section>
      <section className="card-kv"><label>{en?'KV CAPACITY REQUIRED · TB':'KV 容量需求 · TB'}</label><div><span><b>HBM</b><i><u style={{width:`${hbmKvTB/capacityScaleTB*100}%`}}/></i><em>{hbmKvTB.toFixed(1)}</em></span><span><b>DDR</b><i><u style={{width:`${ddrTB/capacityScaleTB*100}%`}}/></i><em>{ddrTB.toFixed(1)}</em></span>{hasSsd&&<span><b>SSD</b><i><u style={{width:`${ssdTB/capacityScaleTB*100}%`}}/></i><em>{ssdTB.toFixed(1)}</em></span>}</div></section>
      <section className="card-network">{en&&<label>NETWORK · {nodes} NODES</label>}<ConceptTopology key={`${topology}-${nodes}`} kind={topology} scale={nodes} compact language={language}/></section>
    </div>
  </button>
}

function ConceptPlanningDemo(){
  const [language,setLanguage]=useState<'zh'|'en'>('zh')
  const en=language==='en'
  const text=(zh:string,english:string)=>en?english:zh
  const [progress,setProgress]=useState(0)
  const [priorities,setPriorities]=useState<ConceptPriority[]>(conceptPlanOrder)
  const [activeResult,setActiveResult]=useState<ConceptPriority|null>(null)
  const [hasStarted,setHasStarted]=useState(false)
  const [requirements,setRequirements]=useState({ttft:1500,tpot:40,cost:92,availability:99.95,redundancy:2})
  const timer=useRef<number|null>(null)
  const done=progress>=100
  const phase=progress<18?text('模型负载画像','Model workload profiling'):progress<44?text('P / D 实例重组','P / D instance restructuring'):progress<68?text('KV Cache 分层迁移','KV Cache tier migration'):progress<88?text('网络拓扑重构','Network topology restructuring'):progress<100?text('联合性能验证','Joint performance validation'):text('联合寻优完成','Joint optimization complete')
  const plans:Record<ConceptPriority,ConceptPlan>={
    performance:{label:text('性能优先','Performance'),topology:'dragonfly',p:28,d:14,nodes:42,throughput:6.8,ttft:1080,tpot:30,util:74,cost:112,availability:'99.95%',network:'Dragonfly+ · 800G',networkNote:text('6 Group × 7 节点 · 低直径全局链路 · 1:1 注入带宽','6 groups × 7 nodes · Low-diameter global links · 1:1 injection bandwidth'),nodeUplink:'800 Gbps',injectionTbps:33.6,fabricDiameter:3,fabricUnits:text('6 Groups','6 Groups'),kv:text('HBM 热 KV → DDR 温层 → SSD 冷层','HBM Hot KV → DDR Warm Tier → SSD Cold Tier'),hbmTotalTB:21.5,hbmOccupiedTB:12.9,hbmKvTB:8.6,ddrTB:64,ssdTB:96,focus:text('吞吐 6.8 M tok/s · TTFT 1,080 ms','Throughput 6.8 M tok/s · TTFT 1,080 ms')},
    cost:{label:text('成本优先','Cost'),topology:'torus3d',p:20,d:10,nodes:30,throughput:5.2,ttft:1660,tpot:46,util:88,cost:78,availability:'99.92%',network:'3D Torus · 400G',networkNote:text('3 × 2 × 5 节点 · 6 邻接链路 · 拓扑感知放置','3 × 2 × 5 nodes · 6 adjacent links · Topology-aware placement'),nodeUplink:'400 Gbps',injectionTbps:12,fabricDiameter:4,fabricUnits:'3 × 2 × 5',kv:text('HBM 热 KV → 小型 DDR 池 → 大容量 SSD','HBM Hot KV → Compact DDR Pool → Capacity SSD'),hbmTotalTB:15.4,hbmOccupiedTB:10,hbmKvTB:5.4,ddrTB:32,ssdTB:180,focus:text('成本指数 78 · 资源利用率 88%','Cost index 78 · Resource utilization 88%')},
    reliability:{label:text('可靠性优先','Reliability'),topology:'dualClos',p:28,d:16,nodes:44,throughput:5.9,ttft:1480,tpot:40,util:72,cost:115,availability:'99.99%',network:text('双平面 Rail Fat-Tree · 400G','Dual-Plane Rail Fat-Tree · 400G'),networkNote:text('无阻塞 1:1 · A/B Fabric 隔离 · N+1 关键链路','Non-blocking 1:1 · Isolated A/B fabrics · N+1 critical links'),nodeUplink:'2 × 400G',injectionTbps:35.2,fabricDiameter:4,fabricUnits:text('2 Fabrics','2 Fabrics'),kv:text('HBM 热 KV → DDR 双副本 → SSD 冗余层','HBM Hot KV → Dual-Replica DDR → Redundant SSD'),hbmTotalTB:22.5,hbmOccupiedTB:13.7,hbmKvTB:8.8,ddrTB:80,ssdTB:160,focus:text('可用性 99.99% · 双平面冗余','Availability 99.99% · Dual-plane redundancy')},
    balanced:{label:text('综合最优','Balanced'),topology:'railClos',p:24,d:13,nodes:37,throughput:6.1,ttft:1420,tpot:38,util:81,cost:94,availability:'99.97%',network:'Rail-Optimized CLOS · 400G',networkNote:text('P/D Rail 亲和 · 收敛比 1.5:1 · 关键上联冗余','P/D rail affinity · 1.5:1 convergence · Redundant critical uplinks'),nodeUplink:'400 Gbps',injectionTbps:14.8,fabricDiameter:4,fabricUnits:text('2 Rails','2 Rails'),kv:text('HBM 热 KV → DDR 共享池 → SSD 热分层','HBM Hot KV → Shared DDR → SSD Hot Tiering'),hbmTotalTB:18.9,hbmOccupiedTB:11.6,hbmKvTB:7.3,ddrTB:52,ssdTB:128,focus:text('吞吐 6.1 M tok/s · 成本指数 94 · 可用性 99.97%','Throughput 6.1 M tok/s · Cost index 94 · Availability 99.97%')},
  }
  const shownPlan=plans[activeResult??'balanced']

  const requirementPresets:Record<ConceptPriority,typeof requirements>={
    performance:{ttft:1200,tpot:32,cost:112,availability:99.95,redundancy:2},
    cost:{ttft:1750,tpot:48,cost:80,availability:99.92,redundancy:1},
    reliability:{ttft:1500,tpot:40,cost:118,availability:99.99,redundancy:3},
    balanced:{ttft:1450,tpot:38,cost:96,availability:99.97,redundancy:2},
  }

  const start=()=>{
    if(timer.current)window.clearInterval(timer.current)
    setActiveResult(null)
    setHasStarted(true)
    setProgress(0)
    let next=0
    timer.current=window.setInterval(()=>{
      next=Math.min(100,next+1)
      setProgress(next)
      if(next===100&&timer.current)window.clearInterval(timer.current)
    },150)
  }

  const togglePriority=(value:ConceptPriority)=>{
    setPriorities(current=>{
      if(!current.includes(value)){
        setRequirements(requirementPresets[value])
        return [...current,value]
      }
      if(current.length===1){
        setRequirements(requirementPresets[value])
        return current
      }
      const next=current.filter(item=>item!==value)
      setRequirements(requirementPresets[next[next.length-1]])
      return next
    })
    setActiveResult(null)
    setHasStarted(false)
    setProgress(0)
    if(timer.current)window.clearInterval(timer.current)
  }

  const updateRequirement=(key:keyof typeof requirements,value:number)=>{
    setRequirements(current=>({...current,[key]:value}))
    setActiveResult(null)
    setHasStarted(false)
    setProgress(0)
    if(timer.current)window.clearInterval(timer.current)
  }

  useEffect(()=>{
    return()=>{if(timer.current)window.clearInterval(timer.current)}
  },[])

  const optionMeta:Record<ConceptPriority,{index:string;description:string;tags:string[]}>= {
    performance:{index:'01',description:text('压低时延，最大化吞吐','Minimize latency and maximize throughput'),tags:[text('吞吐 ↑','Throughput ↑'),text('时延 ↓','Latency ↓')]},
    cost:{index:'02',description:text('满足约束下压缩资源成本','Reduce resource cost within constraints'),tags:[text('成本 ↓','Cost ↓'),text('利用率 ↑','Utilization ↑')]},
    reliability:{index:'03',description:text('强化冗余与故障域隔离','Strengthen redundancy and fault isolation'),tags:['SLA ↑',text('风险 ↓','Risk ↓')]},
    balanced:{index:'04',description:text('兼顾性能、成本与可靠性','Balance performance, cost, and reliability'),tags:[text('均衡解','Balanced'),text('余量适中','Moderate headroom')]},
  }
  const showingPlanDetail=Boolean(activeResult)

  return <div className={`concept-shell concept-v8 ${done?'is-done':hasStarted?'is-running':'is-idle'} ${showingPlanDetail?'showing-detail':''}`}>
    <Header language={language} onLanguageChange={setLanguage}/>
    <main className="concept-main">
      <section className="concept-workspace">
        <aside className="concept-decisions">
          <div className="concept-section-label strategy-title">{en&&<span>01 / PLANNING STRATEGY</span>}<h2>{text('规划策略','Planning Strategy')}</h2><p>{text('选择需要参与仿真与对比的候选方案','Select candidate plans for simulation and comparison')}</p></div>
          <div className="decision-heading">{en&&<span>PLAN OPTIONS</span>}<b>{text('候选方案（可多选）','Candidate Plans (Multi-select)')}</b><em>{text(`已选 ${priorities.length}`,`${priorities.length} selected`)}</em></div>
          <div className="decision-list">
            {(Object.keys(optionMeta) as ConceptPriority[]).map(key=>{const meta=optionMeta[key],selected=priorities.includes(key);return <button key={key} className={selected?'active':''} onClick={()=>togglePriority(key)} aria-pressed={selected}><i>{selected?<Icon name="check" size={12}/>:meta.index}</i><span><b>{plans[key].label}</b><small>{meta.description}</small><u>{meta.tags.map(tag=><em key={tag}>{tag}</em>)}</u></span></button>})}
          </div>
          <div className="planning-requirements-title">{en&&<span>02 / PLANNING REQUIREMENT</span>}<h2>{text('规划需求','Planning Requirements')}</h2><p>{text('模型、SLO、成本与可靠性约束','Model, SLO, cost, and reliability constraints')}</p></div>
          <div className="concept-model-choices" role="group" aria-label={text('模型选择示意','Model selection preview')}>
            <article className="model-choice muted"><header>{en&&<span>DENSE</span>}<em>{text('稠密模型','Dense')}</em></header><div className="model-architecture dense"><i/><i/><i/><i/></div><strong>Qwen3-32B</strong><p>32B Dense · GQA · 64K Context</p><small>{text('峰值请求 3,200 req/s','Peak Requests 3,200 req/s')}</small></article>
            <article className="model-choice selected" aria-current="true"><header>{en&&<span>SPARSE</span>}<em>{text('已选','Selected')}</em></header><div className="model-architecture sparse"><i/><i/><i/><i/><i/></div><strong>DeepSeek-V4-Pro</strong><p>49B Active · MoE Sparse · 1M Context</p><small>{text('峰值请求 3,200 req/s','Peak Requests 3,200 req/s')}</small></article>
            <article className="model-choice muted"><header>{en&&<span>MULTIMODAL</span>}<em>{text('多模态','Multimodal')}</em></header><div className="model-architecture multimodal"><i/><i/><i/><i/></div><strong>Qwen2.5-VL-72B</strong><p>72B VLM · ViT + LLM · 128K Context</p><small>{text('峰值请求 3,200 req/s','Peak Requests 3,200 req/s')}</small></article>
          </div>
          <div className="requirement-sliders">
            <div className="slider-group"><header><b>SLO</b>{en&&<span>SERVICE LEVEL OBJECTIVE</span>}</header><RequirementSlider label="TTFT P95" value={requirements.ttft} min={900} max={2200} step={50} unit="ms" onChange={value=>updateRequirement('ttft',value)}/><RequirementSlider label="TPOT P95" value={requirements.tpot} min={24} max={64} step={2} unit="ms" onChange={value=>updateRequirement('tpot',value)}/></div>
            <div className="slider-group compact"><header><b>{text('成本','Cost')}</b>{en&&<span>COST LIMIT</span>}</header><RequirementSlider label={text('成本指数上限','Maximum Cost Index')} value={requirements.cost} min={70} max={120} step={1} unit="" onChange={value=>updateRequirement('cost',value)}/></div>
            <div className="slider-group compact"><header><b>{text('可靠性','Reliability')}</b>{en&&<span>RELIABILITY</span>}</header><RequirementSlider label={text('可用性目标','Availability Target')} value={requirements.availability} min={99.9} max={99.99} step={.01} unit="%" digits={2} onChange={value=>updateRequirement('availability',value)}/><RequirementSlider label={text('冗余等级','Redundancy Level')} value={requirements.redundancy} min={1} max={3} step={1} unit={` · ${en?['Basic','N+1','Active-Active'][requirements.redundancy-1]:['基础','N+1','双活'][requirements.redundancy-1]}`} onChange={value=>updateRequirement('redundancy',value)}/></div>
          </div>
          <button className="start-concept-simulation" onClick={start}><span><Icon name="play" size={14}/>{text('开始仿真规划','Start Planning Simulation')}</span><small>{text(`${priorities.length} 组方案 · 联合寻优`,`${priorities.length} PLANS · JOINT OPTIMIZATION`)}</small></button>
        </aside>

        <div className="concept-center" aria-hidden={showingPlanDetail}>
          <HighDimensionalSearch progress={progress} hasStarted={hasStarted} done={done} activeKeys={priorities} language={language} onRestart={start}/>
        </div>

        <aside className={`concept-result ${activeResult?'detail-mode':'compare-mode'}`} aria-live="polite">
          {activeResult?<><div className="result-success"><i><Icon name="check" size={17}/></i><span>{en&&<small>OPTIMIZATION COMPLETE</small>}<h2>{text('方案详情','Plan Details')}</h2></span><button className="back-to-compare" onClick={()=>setActiveResult(null)}>{text('返回四方案总览','Back to Overview')}</button></div><ConceptPlanDetail plan={shownPlan} priority={activeResult} topology={shownPlan.topology} language={language}/></>:<div className="optimization-overview">
            <OptimizationRadar plans={plans} progress={progress} activeKeys={priorities} language={language}/>
            <div className="optimization-cards">{conceptPlanOrder.map(key=><OptimizationResultCard key={key} priority={key} plan={plans[key]} progress={progress} selected={priorities.includes(key)} language={language} onOpen={()=>setActiveResult(key)}/>)}</div>
          </div>}
        </aside>
      </section>
    </main>
    <footer className="concept-status"><span><i className={done?'done':''}/>{done?text(`寻优完成 · 已生成 ${priorities.length} 组方案`,`OPTIMIZATION COMPLETE · ${priorities.length} PLANS GENERATED`):hasStarted?`${phase} · ${progress}%`:text('等待开始仿真规划','WAITING TO START PLANNING SIMULATION')}</span><span>{en&&'MODEL '}<b>DEEPSEEK-V4-PRO</b></span><span>{en&&'PLAN '}<b>{priorities.map(key=>plans[key].label).join(' / ')}</b></span>{!done&&<span className="concept-status-right">{hasStarted?text('P/D · KV Cache · Network 联合搜索','P/D · KV CACHE · NETWORK JOINT SEARCH'):text('方案选择仅更新目标参数','Plan selection updates target parameters only')}</span>}</footer>
  </div>
}

function RequirementSlider({label,value,min,max,step,unit,digits=0,onChange}:{label:string;value:number;min:number;max:number;step:number;unit:string;digits?:number;onChange:(value:number)=>void}){
  const progress=(value-min)/(max-min)*100
  return <label className="requirement-slider"><span><b>{label}</b><em>{value.toFixed(digits)}{unit}</em></span><input type="range" min={min} max={max} step={step} value={value} style={{background:`linear-gradient(90deg,#45d7ee ${progress}%,#173346 ${progress}%)`}} onChange={event=>onChange(Number(event.target.value))}/></label>
}

function ConceptPlanDetail({plan,priority,topology,language}:{plan:ConceptPlan;priority:'performance'|'cost'|'reliability'|'balanced';topology:TopologyKind;language:'zh'|'en'}){
  const en=language==='en'
  const text=(zh:string,english:string)=>en?english:zh
  const totalInstances=plan.p+plan.d
  const prefillShare=Math.round(plan.p/totalInstances*100)
  const decodeShare=100-prefillShare
  const hasSsd=plan.ssdTB>0,capacityScaleTB=180
  const runtimePlan={
    performance:{maxSeqs:192,maxTokens:'32,768',chunk:'8,192',policy:text('SLO 优先级调度','SLO-aware priority')},
    cost:{maxSeqs:96,maxTokens:'16,384',chunk:'4,096',policy:text('FCFS 连续批处理','FCFS continuous batching')},
    reliability:{maxSeqs:128,maxTokens:'24,576',chunk:'8,192',policy:text('优先级调度 + 准入保护','Priority + admission guard')},
    balanced:{maxSeqs:128,maxTokens:'24,576',chunk:'4,096',policy:text('SLO 优先级调度','SLO-aware priority')},
  }[priority]
  return <div className="concept-plan-detail">
    <div className="result-focus"><span>{plan.label}</span><strong>{plan.focus}</strong></div>
    <div className="result-kpis"><span><small>{text('吞吐','Throughput')}</small><b>{plan.throughput}</b><em>M tok/s</em></span><span><small>TTFT P95</small><b>{plan.ttft}</b><em>ms</em></span><span><small>TPOT P95</small><b>{plan.tpot}</b><em>ms</em></span><span><small>{text('可用性','Availability')}</small><b>{plan.availability}</b><em>SLA</em></span></div>
    <section className="result-plan"><span>{text('规划结果','PLANNING RESULT')}</span>
      <div className="result-runtime-summary">
        <section><header>{en&&<small>ENGINE SCHEDULING</small>}<b>{text('调度参数','Scheduling Parameters')}</b></header><div className="runtime-params"><span><small>max_num_seqs</small><b>{runtimePlan.maxSeqs}</b></span><span><small>max_num_batched_tokens</small><b>{runtimePlan.maxTokens}</b></span><span><small>chunked_prefill</small><b>{runtimePlan.chunk}</b></span><span><small>scheduling_policy</small><b>{runtimePlan.policy}</b></span></div></section>
        <section><header>{en&&<small>MODEL PARALLEL</small>}<b>{text('模型并行','Model Parallelism')}</b></header><strong>TP 8 · PP 2 · EP 8</strong><p>{text(`Prefill DP ${plan.p} · Decode DP ${plan.d}；PP 跨节点流水，EP 对齐 MoE 专家组。`,`Prefill DP ${plan.p} · Decode DP ${plan.d}; cross-node PP with MoE-aligned EP groups.`)}</p></section>
      </div>
      <div className="detail-visual-grid">
        <div className="detail-visual-card topology-card"><header>{en&&<small>NETWORK TOPOLOGY</small>}<b>{text('网络拓扑','Network Topology')}</b></header><ConceptTopology kind={topology} scale={plan.nodes} language={language}/><div className="topology-metrics"><span><small>NODE SCALE</small><b>{plan.nodes}<em>NODES</em></b></span><span><small>NODE UPLINK</small><b>{plan.nodeUplink}</b></span><span><small>INJECTION BW</small><b>{plan.injectionTbps.toFixed(1)}<em>TBPS</em></b></span><span><small>FABRIC DIAMETER</small><b>{plan.fabricDiameter}<em>HOPS</em></b></span></div><footer><span><i className="network"/>{plan.network}</span><span><i className="network"/>{plan.fabricUnits}</span></footer></div>
        <div className="detail-visual-card pd-card"><header>{en&&<small>PREFILL / DECODE</small>}<b>{text('P/D 实例配比','P/D Instance Ratio')}</b></header><div className="pd-visual"><span className="prefill" style={{flex:plan.p}}><small>PREFILL</small><strong>{plan.p}</strong><em>{prefillShare}%</em><i>{Array.from({length:Math.min(10,Math.ceil(plan.p/3))},(_,index)=><b key={index}/>)}</i></span><u><i/><i/><i/></u><span className="decode" style={{flex:plan.d}}><small>DECODE</small><strong>{plan.d}</strong><em>{decodeShare}%</em><i>{Array.from({length:Math.min(8,Math.ceil(plan.d/2))},(_,index)=><b key={index}/>)}</i></span></div><footer><span><i className="prefill"/>Prefill {plan.p}</span><span><i className="decode"/>Decode {plan.d}</span></footer></div>
        <div className="detail-visual-card kv-card"><header>{en&&<small>CACHE CAPACITY · ABSOLUTE SIZE</small>}<b>{text('KV Cache 分层容量','KV Cache Tier Capacity')}</b></header><div className="kv-layer-visual"><span className="hbm"><b>HBM</b><i><u style={{width:`${plan.hbmKvTB/capacityScaleTB*100}%`}}/></i><em>{plan.hbmKvTB.toFixed(1)} TB · {text(`总量 ${plan.hbmTotalTB.toFixed(1)} − 权重/运行占用 ${plan.hbmOccupiedTB.toFixed(1)}`,`Total ${plan.hbmTotalTB.toFixed(1)} − weights/runtime ${plan.hbmOccupiedTB.toFixed(1)}`)}</em></span><strong>↓</strong><span className="ddr"><b>DDR</b><i><u style={{width:`${plan.ddrTB/capacityScaleTB*100}%`}}/></i><em>{plan.ddrTB.toFixed(1)} TB · {text('需规划的温 KV 容量','Planned warm-KV capacity')}</em></span>{hasSsd&&<><strong>↓</strong><span className="ssd"><b>SSD</b><i><u style={{width:`${plan.ssdTB/capacityScaleTB*100}%`}}/></i><em>{plan.ssdTB.toFixed(1)} TB · {text('需规划的冷 KV 容量','Planned cold-KV capacity')}</em></span></>}</div><footer><span><i className="cache"/>{plan.kv}</span></footer></div>
      </div>
    </section>
  </div>
}


export default App
