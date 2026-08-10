import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { scenarios } from './mock/scenarios'
import type { ModelWorkloadInput, Scenario, ScenarioKey, Stage } from './types'

const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const paths: Record<string, string> = {
    cube:'M12 2 3 7l9 5 9-5-9-5Zm-9 5v10l9 5V12M21 7v10l-9 5', chip:'M9 3v3m6-3v3m-6 12v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M7 7h10v10H7z', activity:'M3 12h4l2-6 4 12 2-6h6', target:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', sliders:'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6', play:'m9 7 7 5-7 5V7Z', download:'M12 3v12m-5-5 5 5 5-5M5 21h14', check:'m5 12 4 4L19 6', layers:'M12 3 3 8l9 5 9-5-9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5', network:'M12 5v4m-7 6v4m14-4v4M5 15h14M5 15l7-6 7 6M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', alert:'M12 9v4m0 4h.01M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z', arrow:'m9 18 6-6-6-6', database:'M4 6c0 2 16 2 16 0S4 4 4 6Zm0 0v6c0 2 16 2 16 0V6m-16 6v6c0 2 16 2 16 0v-6', menu:'M4 6h16M4 12h16M4 18h16'
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.cube}/></svg>
}

const stageText: Record<Stage,string> = {IDLE:'等待配置',CHECKING:'检查输入与约束',SIMULATING:'执行方案仿真',OPTIMIZING:'搜索候选方案',VALIDATING:'验证性能与 SLO',COMPLETED:'规划完成'}
const stages: Stage[] = ['CHECKING','SIMULATING','OPTIMIZING','VALIDATING','COMPLETED']
const caseFeatures: Record<ScenarioKey,string[]> = {
  rag:['48 卡小规模','峰值 320 req/s','投研证据复用 63%'],
  long:['合同 64K+','风险条款比对','平均 14.6 轮'],
  coding:['双模型协同','峰值 7.6K req/s','7.8 工具/任务'],
}

const getModelInputs=(s:Scenario):ModelWorkloadInput[]=>s.modelInputs??[{
  id:s.key,label:'模型',role:s.short,symbol:s.key==='rag'?'Q3':'DS',model:s.model,modelSize:s.modelSize,framework:s.framework,runtime:s.runtime,comm:s.comm,
  peak:s.peak,average:s.average,inputTokens:s.inputTokens,outputTokens:s.outputTokens,turns:s.turns,toolCalls:s.toolCalls,reuse:s.reuse,prefixGrowth:s.prefixGrowth,load:s.load,
  requestMix:s.requestMix,prefixHotness:s.prefixHotness,prefixItems:s.prefixItems,evolutionBurst:s.evolutionBurst,evolution:s.evolution
}]

const getModelSpecs=(model:ModelWorkloadInput)=>model.model==='Qwen3-32B'
  ? [['模型层数','64','Layers'],['Hidden Size','5,120',''],['Query Heads','40',''],['KV Heads','8',''],['Attention','GQA',''],['模型结构','Dense',''],['Weight / Activation','BF16 / BF16',''],['KV dtype','FP16','']]
  : model.id==='coder'
    ? [['模型层数','60','Layers'],['Hidden Size','5,120',''],['Attention Heads','128',''],['KV 结构','MLA',''],['Attention','MLA',''],['MoE 结构','160 Experts / Top-6',''],['Weight / Activation','BF16 / BF16',''],['KV dtype','FP16','']]
    : model.id==='long'
      ? [['模型层数','61','Layers'],['Hidden Size','7,168',''],['Attention Heads','128',''],['KV 结构','MLA',''],['Attention','MLA',''],['MoE 结构','256 Experts / Top-8',''],['Weight / Activation','BF16 / BF16',''],['KV dtype','FP16','']]
      : [['模型层数','94','Layers'],['Hidden Size','12,288',''],['Query Heads','96',''],['KV Heads','8',''],['Attention','GQA',''],['MoE 结构','128 Experts / Top-8',''],['Weight / Activation','BF16 / BF16',''],['KV dtype','FP16','']]

const getClusterNodes=(s:Scenario):[number,number]=>s.clusterNodes??[Math.floor(s.nodes/2),Math.ceil(s.nodes/2)]
const splitByCluster=(s:Scenario,total:number):[number,number]=>{const [standard]=getClusterNodes(s);const left=Math.round(total*standard/s.nodes*10)/10;return[left,Math.round((total-left)*10)/10]}
const formatThroughput=(value:number)=>value<1?value.toFixed(2):value.toFixed(1)

function App() {
  const [scenarioKey,setScenarioKey] = useState<ScenarioKey>('rag')
  const [workspace,setWorkspace] = useState<'overview'|'input'|'optimization'|'results'>('overview')
  const [stage,setStage] = useState<Stage>('IDLE')
  const [progress,setProgress] = useState(0)
  const [scale,setScale] = useState(1)
  const timer = useRef<number | null>(null)
  const contentScroll = useRef<HTMLDivElement>(null)
  const scenario = scenarios[scenarioKey]

  useEffect(()=>()=>{ if(timer.current) window.clearInterval(timer.current) },[])
  useEffect(()=>{ contentScroll.current?.scrollTo({top:0}) },[workspace,scenarioKey])
  const startSimulation = () => {
    if(timer.current) window.clearInterval(timer.current)
    setWorkspace('optimization'); setStage('CHECKING'); setProgress(3)
    let p = 3
    timer.current = window.setInterval(()=>{
      p += p < 18 ? 3 : p < 74 ? 2 : 4
      if(p >= 100){ p=100; setStage('COMPLETED'); if(timer.current) window.clearInterval(timer.current) }
      else if(p < 18) setStage('CHECKING')
      else if(p < 38) setStage('SIMULATING')
      else if(p < 86) setStage('OPTIMIZING')
      else setStage('VALIDATING')
      setProgress(p)
    },120)
  }

  return <div className="app-shell">
    <Header/>
    <aside className="sidebar">
      <div className="side-kicker">AGENT 业务案例</div>
      <div className="case-list">{(Object.keys(scenarios) as ScenarioKey[]).map((key,i)=>{const item=scenarios[key];return <button key={key} className={`case-item ${scenarioKey===key?'active':''}`} onClick={()=>{setScenarioKey(key);setStage('IDLE');setProgress(0)}}>
        <div className="case-card-head"><span className="case-icon"><Icon name={key==='rag'?'database':key==='long'?'layers':'cube'}/></span><span><small className="case-index">CASE 0{i+1}</small><b>{item.name}</b></span><i/></div><p>{item.short}</p><div className="case-tags">{caseFeatures[key].map(x=><span key={x}>{x}</span>)}</div>
      </button>})}</div>
      <div className="side-divider"/>
    </aside>
    <main className="main">
      <div className="workspace-tabs">
        <button className={workspace==='overview'?'active':''} onClick={()=>setWorkspace('overview')}>工作流总览</button>
        <button className={workspace==='input'?'active':''} onClick={()=>setWorkspace('input')}>输入配置</button>
        <button className={workspace==='optimization'?'active':''} onClick={()=>setWorkspace('optimization')}>仿真寻优</button>
        <button className={workspace==='results'?'active':''} onClick={()=>stage==='COMPLETED'&&setWorkspace('results')}>规划结果 {stage==='COMPLETED'&&<i/>}</button>
      </div>
      <div className="content-scroll" ref={contentScroll}>
        {workspace==='overview' && <WorkflowOverview onStart={()=>setWorkspace('input')}/>} 
        {workspace==='input' && <UnifiedInput scenarioKey={scenarioKey}/>} 
        {workspace==='optimization' && <OptimizationWorkspace scenarioKey={scenarioKey} stage={stage} progress={progress} scale={scale} setScale={setScale} onStart={startSimulation} onViewResults={()=>setWorkspace('results')}/>}
        {workspace==='results' && <Results stage={stage} progress={progress} scenarioKey={scenarioKey}/>}
      </div>
    </main>
    <footer className="statusbar"><span><i className="ok-dot"/>配置完整度 <b>100%</b></span><span>场景 <b>{scenario.name}</b></span><span>资源 <b>{scenario.nodes} 节点 · {scenario.gpuCount} {scenario.gpu.split(' ')[0]}</b></span><span className={`run-state ${stage.toLowerCase()}`}><i/>{stageText[stage]}</span><span className="status-right"><Icon name="check" size={15}/>未发现约束冲突</span></footer>
  </div>
}

function Header(){
  return <header className="header"><div className="brand-mark"><span/><span/><span/></div><div className="brand"><h1>算存网一体化规划仿真平台</h1><p>INTEGRATED COMPUTING · STORAGE · NETWORK PLANNING SIMULATION PLATFORM</p></div><div className="header-context"><button className="ghost-button"><Icon name="download" size={16}/>导出方案</button></div></header>
}

function WorkflowOverview({onStart}:{onStart:()=>void}){
  const steps=[
    {n:'01',title:'业务输入',sub:'INPUT',icon:'cube',desc:'定义规划对象、资源边界、业务请求特征和目标约束。',items:['模型与软件栈','硬件与组网拓扑','请求与前缀特征','SLO 与资源上限']},
    {n:'02',title:'寻优与仿真',sub:'OPTIMIZATION & SIMULATION',icon:'activity',desc:'在参数空间中持续生成候选配置，通过仿真评估完成校验、筛选与迭代。',items:['候选配置生成与实例化','算子、存储与网络流仿真','SLO 与资源约束校验','瓶颈定位、方案筛选与迭代']},
    {n:'03',title:'规划输出',sub:'OUTPUT',icon:'target',desc:'输出推荐规划方案及其性能表现和主要瓶颈。',items:['P/D 实例数量与配比','HBM / DDR / SSD 容量','网络与数据流方案','性能表现与瓶颈']},
  ]
  return <div className="page overview-page"><PageTitle eyebrow="WORKFLOW OVERVIEW" title="算存网一体化规划工作流" desc="从 Agent 业务需求出发，经过方案生成与仿真评估，形成可验证的资源规划方案。" badge="3 阶段 · 1 条闭环"/>
    <div className="workflow-map">{steps.map((x,i)=><div className="workflow-stage" key={x.n}><div className="stage-number">{x.n}</div><div className="stage-icon"><Icon name={x.icon} size={23}/></div><span>{x.sub}</span><h2>{x.title}</h2><p>{x.desc}</p><div>{x.items.map(item=><b key={item}><Icon name="check" size={12}/>{item}</b>)}</div>{i<steps.length-1&&<em><Icon name="arrow" size={20}/></em>}</div>)}</div>
    <div className="workflow-bottom"><div><span>规划逻辑</span><b>输入定义问题边界</b><Icon name="arrow"/><b>候选生成 · 仿真校验 · 迭代筛选</b><Icon name="arrow"/><b>输出可执行规划</b></div><button onClick={onStart}>进入输入配置 <Icon name="arrow" size={15}/></button></div>
  </div>
}

function UnifiedInput({scenarioKey}:{scenarioKey:ScenarioKey}){
  const s=scenarios[scenarioKey]
  const models=getModelInputs(s)
  const [activeModel,setActiveModel]=useState(0)
  useEffect(()=>setActiveModel(0),[scenarioKey])
  const active=models[activeModel]??models[0]
  const modelSpecs=getModelSpecs(active)
  const hbmTB=(s.gpuCount*64/1024).toFixed(1)
  const option=useMemo(()=>({
    grid:{left:30,right:10,top:16,bottom:22},
    xAxis:{type:'category',data:active.load.map((_,i)=>`${i}:00`),axisLabel:{color:'#587087',interval:5,fontSize:8},axisLine:{lineStyle:{color:'#24364c'}},axisTick:{show:false}},
    yAxis:{type:'value',max:100,axisLabel:{show:false},splitLine:{lineStyle:{color:'#182a3e'}}},
    series:[{type:'line',data:active.load,smooth:.35,symbol:'none',lineStyle:{width:2,color:'#38bdf8'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(56,189,248,.3)'},{offset:1,color:'rgba(56,189,248,.01)'}]}}}]
  }),[active])
  return <div className="page unified-input"><PageTitle eyebrow="PLANNING INPUT" title={`${s.name} · 输入配置`} desc="在同一页面确认模型、硬件资源、业务负载以及规划目标。" badge="输入检查通过"/>
    <div className="input-overview-strip"><span><i>01</i><b>模型与软件栈</b><small>{models.length>1?`${models.length} 个模型协同`:active.model}</small></span><Icon name="arrow"/><span><i>02</i><b>业务负载</b><small>{s.peak.toLocaleString()} req/s Peak</small></span><Icon name="arrow"/><span><i>03</i><b>硬件资源</b><small>{s.gpuCount} × {s.gpu}</small></span><Icon name="arrow"/><span><i>04</i><b>目标约束</b><small>TTFT / TPOT / Cost</small></span></div>
    {models.length>1&&<div className="model-input-tabs" role="tablist" aria-label="模型与负载输入"><span>模型与负载输入</span>{models.map((model,i)=><button key={model.id} className={activeModel===i?'active':''} onClick={()=>setActiveModel(i)} role="tab" aria-selected={activeModel===i}><small>{model.label}</small><b>{model.model}</b><em>{model.role}</em></button>)}</div>}
    <div className="unified-grid">
      <Card title="01 · 模型与推理软件栈" subtitle={`${active.label.toUpperCase()} · ${active.role}`} icon="cube"><div className="model-profile"><div className="model-identity"><div className="model-symbol">{active.symbol}</div><div><small>当前模型</small><h2>{active.model}</h2><p>{active.modelSize} · {active.role}</p></div><span><Icon name="check" size={13}/>模型参数已校验</span></div><div className="model-specs">{modelSpecs.map(spec=><Field key={spec[0]} label={spec[0]} value={spec[1]} unit={spec[2]}/>)}</div></div><div className="stack-line"><span>{active.framework}<small>推理框架</small></span><i/><span>{active.runtime}<small>加速运行时</small></span><i/><span>{active.comm}<small>集合通信库</small></span><i/><span>服务控制 · 推理执行 · 资源布局 · 数据移动<small>规划能力边界</small></span></div></Card>
      <Card title="02 · 业务负载特征" subtitle={`${active.label.toUpperCase()} · REQUEST SCALE · PREFIX BEHAVIOR`} icon="activity"><div className="workload-feature-grid"><section className="workload-feature request-scale-feature"><div className="module-subtitle"><span>{active.role} · 请求规模</span><small>REQUEST VOLUME & TOKEN LENGTH</small></div><div className="inline-kpis"><MiniMetric label="峰值请求" value={active.peak.toLocaleString()} unit="req/s"/><MiniMetric label="平均请求" value={active.average.toLocaleString()} unit="req/s"/><MiniMetric label="Input 吞吐" value={active.inputTokens} unit="M tok/s"/><MiniMetric label="Output 吞吐" value={active.outputTokens} unit="M tok/s"/></div><div className="request-scale-body"><div className="request-curve"><small>24H 请求强度 · 峰值归一化</small><ReactECharts option={option} style={{height:172}}/></div><RequestMixTable scenario={active}/></div></section><section className="workload-feature prefix-behavior-feature"><div className="module-subtitle"><span>Prefix 行为特征</span><small>REUSE · SOURCE · EVOLUTION</small></div><PrefixBehavior scenario={active}/></section></div></Card>
      <Card title="03 · 硬件与资源拓扑" subtitle="NODE · SUPERNODE · MEMORY FABRIC · HIERARCHICAL KV STORAGE" icon="chip"><div className="hardware-resource-bar"><Metric icon="chip" label="计算资源" value={`${s.nodes}`} unit={`节点 · ${s.gpuCount} 卡`}/><Metric icon="database" label="L0 · HBM" value={hbmTB} unit="TB · 64 GB/卡"/><Metric icon="layers" label="L1 · DDR Pool" value={`${s.ddrTB}`} unit="TB · 跨节点"/><Metric icon="database" label="L2 · Local SSD" value={`${s.localSsdTB}`} unit="TB · 双集群"/><Metric icon="database" label="L3 · Remote SSD" value={`${s.remoteSsdTB}`} unit="TB · 跨集群"/><Metric icon="network" label="互联资源池" value="4" unit="Rails · Dual Plane"/></div><InputNetworkTopology scenario={s}/></Card>
      <Card title="规划目标与约束" subtitle="OBJECTIVES & CONSTRAINTS" icon="target"><div className="goal-strip"><Objective label="TTFT P95" value={`${s.ttftTarget}`} unit="ms"/><Objective label="TPOT P95" value={`${s.tpotTarget}`} unit="ms"/><Objective label="目标吞吐" value={formatThroughput(s.throughputTarget)} unit="M token/s"/><Objective label="设备上限" value={`${s.gpuCount}`} unit="Cards"/></div></Card>
    </div>
  </div>
}

function RequestMixTable({scenario}:{scenario:Scenario|ModelWorkloadInput}){return <div className="request-mix"><div className="request-mix-head"><span>请求类型</span><span>占比</span><span>Prefix</span><span>Input</span><span>Output</span></div>{scenario.requestMix.map(x=><div key={x.label}><b>{x.label}</b><strong>{x.share}%</strong><span>{x.prefix}</span><span>{x.input}</span><span>{x.output}</span></div>)}</div>}

function PrefixBehavior({scenario}:{scenario:Scenario|ModelWorkloadInput}){const initial=scenario.evolution[0];const trim=scenario.evolution.find(x=>x.type==='trim');return <><div className="prefix-model-params"><span><small>共享前缀请求占比</small><b>{scenario.reuse}%</b></span><span><small>平均会话轮数</small><b>{scenario.turns} 轮</b></span><span><small>每轮上下文净增</small><b>+{scenario.prefixGrowth.toLocaleString()} Token</b></span></div><div className="prefix-behavior-body"><div><div className="composition-title"><span>Prefix 来源构成</span><small>用于生成共享前缀类型</small></div><div className="prefix-composition">{scenario.prefixItems.map((x,i)=><i key={x.label} style={{width:`${x.value}%`}} className={`source-${i+1}`}/>)}</div><div className="composition-legend">{scenario.prefixItems.map((x,i)=><span key={x.label}><i className={`source-${i+1}`}/><b>{x.label}</b><small>{x.value}%</small></span>)}</div></div><div><div className="evolution-caption"><span>会话增长模板</span><small>多轮上下文演进</small></div><div className="growth-template"><span><small>初始 Prefix</small><b>{initial.tokens}</b></span><i>→</i><span><small>常规轮增</small><b>+{scenario.prefixGrowth.toLocaleString()} Token / 轮</b></span><i>→</i><span><small>关键变化</small><b>{scenario.evolutionBurst}{trim?` · 压缩 ${trim.tokens}`:''}</b></span></div></div></div></>}

function InputNetworkTopology({scenario}:{scenario:Scenario}){
  const [standardNodes,superNodes]=getClusterNodes(scenario)
  const [ddrA,ddrB]=splitByCluster(scenario,scenario.ddrTB)
  const [ssdA,ssdB]=splitByCluster(scenario,scenario.localSsdTB)
  return <div className="kv-topology"><div className="network-caption"><span>分层存储与异构传输资源拓扑</span><b>NODE · SUPERNODE · MULTI-RAIL</b></div><svg viewBox="0 0 1120 590" role="img" aria-label="左侧普通节点、右侧超节点的 KV Cache 分层存储网络拓扑">
    <defs><linearGradient id="clusterFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2438"/><stop offset="1" stopColor="#091827"/></linearGradient><linearGradient id="hbmFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0e7296"/><stop offset="1" stopColor="#12415d"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g className="topology-backbone"><rect x="390" y="12" width="150" height="44" rx="5"/><rect x="580" y="12" width="150" height="44" rx="5"/><text x="465" y="30">FABRIC PLANE A</text><text x="465" y="44" className="sub">RDMA / RoCE · RAIL 0 / 2</text><text x="655" y="30">FABRIC PLANE B</text><text x="655" y="44" className="sub">RDMA / RoCE · RAIL 1 / 3</text><path d="M390 34H335V88M540 34H558M580 34H562M730 34H785V88"/><circle cx="560" cy="34" r="3"/></g>
    <path className="intercluster" d="M520 93H600"/><text className="link-label" x="560" y="84">双平面集群互联</text>
    <g className="cluster-box"><rect x="18" y="76" width="502" height="374" rx="9" fill="url(#clusterFill)"/><rect x="600" y="76" width="502" height="374" rx="9" fill="url(#clusterFill)"/><text className="cluster-title" x="40" y="103">CLUSTER A · 普通节点集群</text><text className="cluster-meta" x="495" y="103" textAnchor="end">{standardNodes} Nodes · Local KV Domain</text><text className="cluster-title" x="830" y="103">CLUSTER B · 超节点集群</text><text className="cluster-meta" x="1077" y="103" textAnchor="end">{superNodes} Nodes · Local KV Domain</text></g>
    <g className="gateway"><rect x="308" y="77" width="54" height="28" rx="4"/><text x="335" y="95">GW-A</text><rect x="758" y="77" width="54" height="28" rx="4"/><text x="785" y="95">GW-B</text></g>
    <g className="compute-nodes"><rect className="node-card standard-node" x="42" y="124" width="218" height="104" rx="6"/><rect className="node-card standard-node" x="278" y="124" width="218" height="104" rx="6"/><rect className="node-card super-node" x="624" y="124" width="218" height="104" rx="6"/><rect className="node-card super-node" x="860" y="124" width="218" height="104" rx="6"/><text className="standard-label" x="58" y="146">NODE A1</text><text className="standard-label" x="294" y="146">NODE A2</text><text className="super-label" x="640" y="146">SUPERNODE B1</text><text className="super-label" x="876" y="146">SUPERNODE B2</text>{[58,105,152,199,294,341,388,435,640,687,734,781,876,923,970,1017].map(x=><rect className={`compute-chip ${x<600?'standard-chip':'super-chip'}`} key={x} x={x} y="160" width="32" height="25" rx="3"/>)}{[58,294,640,876].map(x=><g key={x}><rect className="hbm-tier" x={x} y="195" width="184" height="21" rx="3" fill="url(#hbmFill)"/><text className="tier-text" x={x+92} y="209">L0 · HBM KV · 64 GB/Card</text></g>)}</g>
    <g className="memory-lines"><path d="M151 228V258M387 228V258M733 228V258M969 228V258"/><path d="M151 242H387M733 242H969"/><text className="backend-label" x="269" y="237">PCIe DMA / Host Staging</text><text className="backend-label" x="851" y="237">UB · PCIe DMA / Host Staging</text></g>
    <g className="ddr-pool"><rect x="42" y="258" width="454" height="65" rx="6"/><rect x="624" y="258" width="454" height="65" rx="6"/><text x="62" y="281">L1 · DDR KV POOL · 跨节点共享</text><text x="476" y="281" textAnchor="end" className="capacity">{ddrA} TB</text><text x="62" y="302" className="sub">A1 ⇄ A2 高速内存互联 · Global Addressing in Cluster A</text><text x="644" y="281">L1 · DDR KV POOL · 跨节点共享</text><text x="1058" y="281" textAnchor="end" className="capacity">{ddrB} TB</text><text x="644" y="302" className="sub">B1 ⇄ B2 高速内存互联 · Global Addressing in Cluster B</text></g>
    <g className="storage-lines"><path d="M269 323V346"/><path d="M851 323V346"/><text className="backend-label storage" x="269" y="339">NVMe / Storage Backend</text><text className="backend-label storage" x="851" y="339">NVMe / Storage Backend</text></g>
    <g className="local-ssd"><rect x="42" y="346" width="454" height="73" rx="6"/><rect x="624" y="346" width="454" height="73" rx="6"/><text x="62" y="370">L2 · LOCAL SSD KV POOL A</text><text x="476" y="370" textAnchor="end" className="capacity">{ssdA} TB</text><text x="62" y="391" className="sub">集群内共享 · NVMe-oF · 16 GB/s · 2.1M IOPS</text><text x="62" y="406" className="sub">HBM / DDR 淘汰落盘与 Prefetch 回源</text><text x="644" y="370">L2 · LOCAL SSD KV POOL B</text><text x="1058" y="370" textAnchor="end" className="capacity">{ssdB} TB</text><text x="644" y="391" className="sub">集群内共享 · NVMe-oF · 16 GB/s · 2.1M IOPS</text><text x="644" y="406" className="sub">HBM / DDR 淘汰落盘与 Prefetch 回源</text></g>
    <g className="remote-lines"><path d="M269 419V480H425"/><path d="M851 419V480H695"/><circle cx="269" cy="448" r="3"/><circle cx="851" cy="448" r="3"/></g><text className="link-label" x="326" y="472">NVMe-oF / RDMA Storage</text><text className="link-label" x="794" y="472">NVMe-oF / RDMA Storage</text>
    <g className="remote-ssd"><rect x="425" y="458" width="270" height="76" rx="7"/><text x="445" y="482">L3 · REMOTE SSD KV POOL</text><text x="675" y="482" textAnchor="end" className="capacity">{scenario.remoteSsdTB} TB</text><text x="445" y="504" className="sub">跨集群共享 · Global KV Index</text><text x="445" y="519" className="sub">Cluster A ⇄ Cluster B · RDMA Fabric</text></g>
    <g className="tier-legend"><circle cx="28" cy="552" r="4"/><text x="40" y="556">L0 HBM · 节点本地</text><circle cx="28" cy="574" r="4"/><text x="40" y="578">L1 DDR · 跨节点</text><circle cx="216" cy="552" r="4"/><text x="228" y="556">L2 SSD · 集群内</text><circle cx="216" cy="574" r="4"/><text x="228" y="578">L3 SSD · 跨集群</text></g>
  </svg></div>
}

const getKvResourceStack=(s:Scenario)=>s.framework.startsWith('vLLM')?'LMCache + Mooncake Store':'Native KV Manager + Mooncake Store'

const getDecisionCategories=(s:Scenario)=>{
  const kvStack=getKvResourceStack(s)
  return [
  {group:'服务控制层',name:'服务级调度',icon:'network',items:'请求准入 · 实例路由 · P-D Pairing',search:'实例路由 / P-D Pairing / 准入策略',evaluate:'服务排队 · 缓存命中 · SLO',value:'Load-aware · Cache-aware Routing',detail:'Affinity · P-D Pairing · Admission Control'},
  {group:'推理执行层',name:'推理引擎调度',icon:'activity',items:'Batch Size · Chunk Size · 实例内调度',search:'Batch / Chunk / 调度策略组合',evaluate:'排队时延 · 设备利用率',value:'Continuous Batching',detail:`max_seqs ${Math.round(s.maxConcurrency/s.nodes)} · Chunk 4K`},
  {group:'推理执行层',name:'并行策略',icon:'layers',items:'TP · DP · EP · PP',search:'TP / DP / EP / PP 组合',evaluate:'计算效率 · 通信开销',value:'TP 8 · DP 4 · EP 8',detail:'PP 1 · P/D 独立配置'},
  {group:'推理执行层',name:'KV 复用与缓存策略',icon:'cube',items:'Prefix Cache · 准入 · 淘汰 · Prefetch',search:'复用 / 准入 / 淘汰 / 预取组合',evaluate:'前缀复用收益 · 回源开销',value:'Prefix Cache · Adaptive Prefetch',detail:'Cache Admission · Cost-aware LRU'},
  {group:'资源布局层',name:'部署拓扑与资源亲和',icon:'chip',items:'实例数量 · P/D 配比 · 拓扑亲和',search:'P/D 配比 / 实例放置 / NUMA-Rail 亲和',evaluate:'跨节点开销 · 负载均衡 · 通信局部性',value:`P-D 分离 · ${s.prefillNodes}:${s.decodeNodes}`,detail:`${s.prefillNodes}P / ${s.decodeNodes}D 节点 · Topology-aware Pairing`},
  {group:'资源布局层',name:'KV 资源池与分层放置',icon:'database',items:'管理组件 · 池化范围 · 分层放置 · 迁移',search:'LMCache / HiCache / Mooncake 与池化方案',evaluate:'容量成本 · 复用收益 · 搬运开销',value:'分层全局 KV 资源池',detail:`${kvStack} · HBM ↔ DDR ↔ SSD`},
  {group:'数据移动层',name:'数据流编排',icon:'network',items:'Backend · Slice · Rail · Priority',search:'Backend / Slice / Rail / Priority',evaluate:'链路竞争 · 传输时延',value:'Backend · Slice · Rail · Priority',detail:'Topology-aware · Dynamic Remap'},
  ]
}
const decisionGroupOrder=['服务控制层','推理执行层','资源布局层','数据移动层']
const decisionPoints=Array.from({length:7},(_,i)=>{const angle=i*Math.PI*2/7-Math.PI/2;return{x:115+Math.cos(angle)*96,y:115+Math.sin(angle)*96}})

function OptimizationWorkspace({scenarioKey,stage,progress,scale,setScale,onStart,onViewResults}:{scenarioKey:ScenarioKey;stage:Stage;progress:number;scale:number;setScale:(n:number)=>void;onStart:()=>void;onViewResults:()=>void}){
  const decisionCategories=getDecisionCategories(scenarios[scenarioKey])
  const isRunning=stage!=='IDLE'&&stage!=='COMPLETED'
  const iteration=stage==='IDLE'?0:Math.min(25,Math.max(1,Math.ceil(progress/4)))
  return <div className="page optimization-page"><PageTitle eyebrow="SIMULATION & OPTIMIZATION" title="参数空间寻优与方案仿真" desc="在候选空间中持续生成配置、仿真性能并筛选可行方案，最终形成推荐规划结果。" badge={stageText[stage]}/>
    <div className="optimization-layout"><section className="decision-panel"><div className="panel-title"><div><h3>可调参数空间</h3><p>PARAMETER DIMENSIONS</p></div><span>4 GROUPS · 7 DIMENSIONS</span></div><div className="decision-list grouped">{decisionGroupOrder.map((group,groupIndex)=><section className={`decision-group group-${groupIndex+1}`} key={group}><div className="decision-group-head"><span>{group}</span><small>{decisionCategories.filter(x=>x.group===group).length} DIM</small></div>{decisionCategories.filter(x=>x.group===group).map(x=>{const i=decisionCategories.findIndex(item=>item.name===x.name);return <div key={x.name} className={`decision-item ${isRunning?'coupled':''} ${stage==='COMPLETED'?'decided':''}`}><span className="decision-icon"><Icon name={x.icon}/></span><div><small>DIM 0{i+1} · {x.name}</small><b>{stage==='COMPLETED'?x.value:isRunning?x.search:x.items}</b>{(stage==='COMPLETED'||isRunning)&&<p>{stage==='COMPLETED'?x.detail:x.evaluate}</p>}</div><i>{stage==='COMPLETED'?<Icon name="check" size={13}/>:isRunning?<span/>:'···'}</i></div>})}</section>)}</div></section>
      <section className="optimization-stage"><div className={`decision-orbit ${isRunning?'coupling':''} ${stage==='COMPLETED'?'converged':''}`}><svg className="coupling-network" viewBox="0 0 230 230">{decisionPoints.map((point,i)=><line className="radial" key={`r-${i}`} x1="115" y1="115" x2={point.x} y2={point.y}/>)}{decisionPoints.map((point,i)=>{const next=decisionPoints[(i+1)%decisionPoints.length];return <line className="chord" key={`c-${i}`} x1={point.x} y1={point.y} x2={next.x} y2={next.y}/>})}{decisionPoints.map((point,i)=>{const next=decisionPoints[(i+2)%decisionPoints.length];return <line className="cross" key={`x-${i}`} x1={point.x} y1={point.y} x2={next.x} y2={next.y}/>})}</svg><div className={`orbit-core ${stage!=='IDLE'?'running':''}`}><strong>{stage==='IDLE'?'—':progress}<small>{stage==='IDLE'?'READY':'%'}</small></strong><em>SEARCH</em></div>{decisionCategories.map((x,i)=><span key={x.name} className={`orbit-group-${decisionGroupOrder.indexOf(x.group)+1} ${isRunning?'active':''} ${stage==='COMPLETED'?'done':''}`} style={{left:decisionPoints[i].x-18,top:decisionPoints[i].y-18,'--delay':`${i*.12}s`} as React.CSSProperties}><Icon name={x.icon} size={15}/></span>)}</div><div className="space-summary"><span><b>4</b> 类 · 7 维</span><span><b>512</b> 候选组合</span><span><b>3</b> 优化目标</span></div><div className="optimization-copy"><span>{stage}</span><h2>{stage==='IDLE'?'参数空间已就绪':stage==='COMPLETED'?'推荐参数组合已确定':stage==='VALIDATING'?'正在验证候选方案':'正在搜索候选方案'}</h2><p>{stage==='IDLE'?'启动后将持续生成配置组合并执行方案仿真。':stage==='COMPLETED'?'候选空间已经完成评估与收敛，点击下方按钮查看规划方案及对应性能表现。':`第 ${iteration} / 25 轮迭代：候选配置持续变化，当前正在评估性能、成本和资源约束。`}</p></div><div className="global-progress-head"><span>DESIGN SPACE EXPLORATION</span><b>ITERATION {String(iteration).padStart(2,'0')} / 25</b></div><div className="progress decision-progress"><i style={{width:`${progress}%`}}/></div><div className="optimization-stats"><MiniMetric label="组合候选" value={stage==='IDLE'?0:Math.round(512*progress/100)} unit="/ 512"/><MiniMetric label="方案评估" value={stage==='IDLE'?0:Math.round(286*progress/100)} unit="组"/><MiniMetric label="可行方案" value={stage==='IDLE'?0:Math.round(58*progress/100)} unit="组"/><MiniMetric label="当前最优" value={progress<35?'—':`#${Math.max(1,Math.round(183*progress/100))}`} unit="Solution"/></div><div className="optimization-actions">{stage==='IDLE'&&<button className="primary-action" onClick={onStart}><Icon name="play"/>启动参数寻优</button>}{stage==='COMPLETED'&&<button className="view-results" onClick={onViewResults}>查看规划结果 <Icon name="arrow" size={16}/></button>}</div></section></div>
  </div>
}

function InputWorkspace({section,scenarioKey}:{section:string;scenarioKey:ScenarioKey}){
  const s=scenarios[scenarioKey]
  if(section==='hardware') return <Hardware scenarioKey={scenarioKey}/>
  if(section==='workload') return <Workload scenarioKey={scenarioKey}/>
  if(section==='objective') return <Objectives scenarioKey={scenarioKey}/>
  return <div className="page"><PageTitle eyebrow="INPUT / 01" title="模型与推理软件栈" desc="定义推理对象及其运行环境，能力边界仅描述软件栈可支持范围。" badge="输入配置"/>
    <div className="grid two-one"><Card title="模型描述" subtitle="MODEL PROFILE" icon="cube"><div className="model-hero"><div className="model-symbol">Q3</div><div><span className="muted">当前模型</span><h2>{s.model}</h2><p>{s.modelSize} · MoE Architecture</p></div><span className="verified"><Icon name="check" size={13}/>参数已校验</span></div><div className="spec-grid"><Field label="模型层数" value="80" unit="Layers"/><Field label="Hidden Size" value="8,192"/><Field label="Query Heads" value="64"/><Field label="KV Heads" value="8"/><Field label="Attention" value="GQA / Dense"/><Field label="MoE 结构" value="64 Experts / Top-2"/></div></Card>
    <Card title="数据精度" subtitle="DATA TYPE" icon="layers"><div className="dtype-list"><Dtype name="Weight" value="BF16" pct={82}/><Dtype name="Activation" value="BF16" pct={82}/><Dtype name="KV Cache" value="FP16" pct={68}/></div><div className="info-note">精度配置将影响显存占用、计算吞吐与 KV Cache 容量。</div></Card></div>
    <Card title="推理软件栈" subtitle="SOFTWARE CAPABILITY BOUNDARY" icon="chip"><div className="software-row"><Software name="推理框架" value={s.framework} tag="Serving"/><span className="connector"/><Software name="加速运行时" value={s.runtime} tag="Runtime"/><span className="connector"/><Software name="集合通信库" value={s.comm} tag="Collective"/></div><div className="capabilities"><span>能力边界</span>{['连续批处理','P/D 分离','多维并行','Prefix Cache','KV 分层搬运','异步 I/O'].map((x,i)=><b key={x} className={i<5?'supported':''}><Icon name={i<5?'check':'alert'} size={13}/>{x}</b>)}</div></Card>
  </div>
}

function Hardware({scenarioKey}:{scenarioKey:ScenarioKey}){ const s=scenarios[scenarioKey]; return <div className="page"><PageTitle eyebrow="INPUT / 02" title="硬件与资源拓扑" desc="描述计算、主机、网络与存储资源，以及设备间物理连接关系。" badge={`${s.nodes} 个计算节点`}/><div className="resource-strip"><Metric icon="chip" label="加速设备" value={`${s.gpuCount}`} unit={s.gpu}/><Metric icon="database" label="HBM 总容量" value={scenarioKey==='long'?'65.5':'61.4'} unit="TB"/><Metric icon="network" label="Fabric 带宽" value="25.6" unit="Tbps"/><Metric icon="database" label="存储容量" value="320" unit="TB"/></div><div className="grid topology-grid"><Card title="资源连接拓扑" subtitle="PHYSICAL AFFINITY" icon="network"><Topology/></Card><Card title="资源清单" subtitle="RESOURCE INVENTORY" icon="layers"><div className="inventory"><Inventory title="计算资源" value={`${s.gpuCount} × ${s.gpu}`} meta="BF16 989 TFLOPS · HBM 3.35 TB/s"/><Inventory title="主机资源" value={`${s.nodes} × 2-Socket Server`} meta="DDR5 2 TB · 8 NUMA / Node · PCIe 5.0"/><Inventory title="网络资源" value="400 GbE RDMA Fabric" meta="8 Spine · 32 Leaf · 96 ToR · 1:1"/><Inventory title="存储资源" value="NVMe + Remote KV Store" meta="32 GB/s Read · 4.2M IOPS · QD 256"/></div></Card></div></div> }

function Topology(){return <div className="topology"><div className="top-layer">{['SPINE 01','SPINE 02','SPINE 03','SPINE 04'].map(x=><span key={x}>{x}<small>400G</small></span>)}</div><svg viewBox="0 0 800 125" preserveAspectRatio="none">{[100,300,500,700].flatMap((x,i)=>[140,400,660].map((y,j)=><line key={`${i}-${j}`} x1={x} y1="0" x2={y} y2="125"/>))}</svg><div className="leaf-layer">{['LEAF A','LEAF B','LEAF C'].map(x=><span key={x}>{x}<small>48-Port</small></span>)}</div><div className="rack-layer">{['RACK 01–32','RACK 33–64','RACK 65–96'].map(x=><span key={x}><i/><i/><i/><i/><b>{x}</b></span>)}</div><div className="topology-legend"><i/>400GbE Spine-Link <i/>200GbE ToR-Link</div></div>}

function Workload({scenarioKey}:{scenarioKey:ScenarioKey}){const s=scenarios[scenarioKey];const option=useMemo(()=>({grid:{left:36,right:14,top:24,bottom:26},tooltip:{trigger:'axis',backgroundColor:'#13243a',borderColor:'#263d59',textStyle:{color:'#d9e7f7'}},xAxis:{type:'category',data:s.load.map((_,i)=>`${String(i).padStart(2,'0')}:00`),axisLabel:{color:'#60758d',interval:3,fontSize:10},axisLine:{lineStyle:{color:'#24364c'}},axisTick:{show:false}},yAxis:{type:'value',max:100,axisLabel:{formatter:'{value}%',color:'#60758d',fontSize:10},splitLine:{lineStyle:{color:'#182a3e'}}},series:[{type:'line',data:s.load,smooth:.35,symbol:'none',lineStyle:{width:2,color:'#38bdf8'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(56,189,248,.38)'},{offset:1,color:'rgba(56,189,248,.02)'}]}},markPoint:{symbolSize:38,data:[{type:'max',name:'峰值'}],label:{color:'#07111f',fontSize:9}}}]}),[s]);return <div className="page"><PageTitle eyebrow="INPUT / 03" title="Agent 业务负载特征" desc="按请求规模、前缀共享和前缀演化三类特征还原具体业务请求形态。" badge={s.name}/><div className="metric-grid"><MiniMetric label="请求峰值" value={s.peak.toLocaleString()} unit="req/s"/><MiniMetric label="平均请求" value={s.average.toLocaleString()} unit="req/s"/><MiniMetric label="Input Token" value={s.inputTokens} unit="M tok/s"/><MiniMetric label="Output Token" value={s.outputTokens} unit="M tok/s"/><MiniMetric label="会话轮数" value={s.turns} unit="avg"/><MiniMetric label="工具调用" value={s.toolCalls} unit="/ task"/></div><div className="grid workload-grid"><Card title="请求规模特征" subtitle="24H REQUEST PROFILE" icon="activity"><div className="chart-toolbar"><span className="active">Request</span><span>Input Token</span><span>Output Token</span><span>并发会话</span></div><ReactECharts option={option} style={{height:238}}/></Card><Card title="前缀共享特征" subtitle={`REUSE RATE ${s.reuse}%`} icon="layers"><div className="prefix-bars">{s.prefixItems.map(x=><div key={x.label}><div><b>{x.label}</b><small>{x.meta}</small><strong>{x.value}%</strong></div><span><i style={{width:`${x.value}%`}}/></span></div>)}</div></Card></div><Card title="前缀演化特征" subtitle={`AVERAGE GROWTH +${s.prefixGrowth.toLocaleString()} TOKEN / TURN`} icon="network"><div className="timeline">{s.evolution.map((x,i)=><div key={x.round} className={x.type}><span>{x.round}</span><i/><b>{x.action}</b><small>{x.tokens}</small>{i<s.evolution.length-1&&<em/>}</div>)}</div></Card></div>}

function Objectives({scenarioKey}:{scenarioKey:ScenarioKey}){const s=scenarios[scenarioKey];return <div className="page"><PageTitle eyebrow="INPUT / 04" title="目标与约束" desc="定义方案必须满足的服务性能目标与资源边界。" badge="7 项约束已启用"/><div className="grid objective-grid"><Card title="服务性能目标" subtitle="SERVICE LEVEL OBJECTIVE" icon="target"><div className="objective-table"><Objective label="TTFT P95" value={`${s.ttftTarget}`} unit="ms"/><Objective label="TPOT P95" value={`${s.tpotTarget}`} unit="ms"/><Objective label="目标吞吐" value={formatThroughput(s.throughputTarget)} unit="M token/s"/><Objective label="最大 QPS" value={s.maxQps.toLocaleString()} unit="req/s"/><Objective label="目标并发" value={s.maxConcurrency.toLocaleString()} unit="sessions"/></div></Card><Card title="资源与成本约束" subtitle="CAPACITY GUARDRAILS" icon="sliders"><div className="objective-table"><Objective label="设备数量上限" value={`${s.gpuCount}`} unit="Cards"/><Objective label="峰值功耗上限" value={`${Math.round(s.gpuCount*1.05)}`} unit="kW"/><Objective label="年度成本上限" value={`${(s.gpuCount/768*1.2).toFixed(2)}`} unit="亿元"/><div className="constraint-health"><Icon name="check"/><div><b>约束可行性检查通过</b><small>当前资源池存在 46 个可行候选方案</small></div></div></div></Card></div></div>}

function Tunables(){const [cat,setCat]=useState('服务级调度');const cats=['服务级调度','推理引擎调度','并行策略','KV 复用与缓存策略','部署拓扑与资源亲和','KV 资源池与分层放置','数据流编排'];return <div className="page"><PageTitle eyebrow="TUNABLES / 05" title="参数搜索空间" desc="配置四大类、七个全局参数维度的候选范围。" badge="4 GROUPS · 7 DIMENSIONS"/><div className="tunable-layout"><div className="category-list">{cats.map((x,i)=><button className={cat===x?'active':''} onClick={()=>setCat(x)} key={x}><span>0{i+1}</span>{x}<Icon name="arrow" size={14}/></button>)}</div><div><Card title={cat} subtitle="SEARCH RANGE" icon="sliders"><TunableContent cat={cat}/></Card></div></div></div>}

function TunableContent({cat}:{cat:string}){const rows:Record<string,[string,string,string][]>={'服务级调度':[['实例选择','Load-aware','RR / Affinity / Load-aware'],['P-D Pairing','Topology-aware','Static / Load / Topology-aware'],['Admission Control','Enabled','On / Off'],['请求优先级','SLO-aware','FIFO / SLO-aware']],'推理引擎调度':[['max_num_seqs','128','64 — 512'],['max_num_batched_tokens','16,384','8K — 64K'],['实例内调度','Continuous Batching','Continuous / Priority'],['Chunked Prefill','Enabled · 4K','2K — 16K']],并行策略:[['Tensor Parallel','8','4 — 16'],['Data Parallel','4','2 — 16'],['Pipeline Parallel','1','1 — 4'],['Expert Parallel','8','4 — 16']],'KV 复用与缓存策略':[['Prefix Cache','Enabled','On / Off'],['缓存准入','Reuse-aware','All / Reuse-aware'],['淘汰策略','Cost-aware LRU','LRU / LFU / Cost-aware'],['Prefetch','Adaptive','Off / Static / Adaptive']],'部署拓扑与资源亲和':[['部署模式','P-D 分离','共享池 / P-D 分离'],['Prefill 节点','64','32 — 128'],['Decode 节点','32','16 — 96'],['实例放置','Topology-aware','Local / Topology-aware']],'KV 资源池与分层放置':[['KV 管理组件','LMCache','Native / LMCache / HiCache'],['池化范围','Global','Local / Cluster / Global'],['分布式存储','Mooncake Store','Local / Mooncake / 3FS'],['分层放置迁移','HBM ↔ DDR ↔ SSD','2-tier / 3-tier / Global']],'数据流编排':[['Transfer Backend','RDMA Direct','UB / RDMA / NVMe-oF'],['Slice 粒度','Adaptive','Static / Adaptive'],['Rail Mapping','Topology-aware','Single / Multi-Rail'],['传输优先级','SLO-aware','FIFO / SLO-aware']]};return <div className="tunable-table"><div className="tunable-head"><span>参数</span><span>当前值</span><span>寻优范围</span></div>{rows[cat].map(r=><div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><small>{r[2]}</small></div>)}</div>}

function Results({stage,progress,scenarioKey}:{stage:Stage;progress:number;scenarioKey:ScenarioKey}){const s=scenarios[scenarioKey];if(stage!=='COMPLETED')return <div className="page result-loading"><PageTitle eyebrow="SIMULATION / PLANNING" title="算存网一体化规划寻优" desc="正在评估服务控制、推理执行、资源布局与数据移动四大类七维决策空间。" badge={stageText[stage]}/><div className="optimizer"><div className="optimizer-orbit"><span>{progress}<small>%</small></span><i/><i/><i/></div><h2>{stage==='IDLE'?'等待启动仿真规划':stageText[stage]}</h2><p>{stage==='IDLE'?'确认输入与可调参数后，点击左侧“开始仿真规划”。':'基于当前 Agent 负载与 SLO 约束评估可行规划方案'}</p><div className="progress"><i style={{width:`${progress}%`}}/></div><div className="search-stats"><MiniMetric label="候选方案" value={Math.round(512*progress/100)} unit="/ 512"/><MiniMetric label="已评估" value={Math.round(286*progress/100)} unit="组"/><MiniMetric label="满足 SLO" value={Math.round(58*progress/100)} unit="组"/><MiniMetric label="当前最优" value={progress<35?'—':`#${Math.max(1,Math.round(183*progress/100))}`} unit="Solution"/></div><div className="stage-flow">{stages.map(x=><div key={x} className={`${stages.indexOf(x)<stages.indexOf(stage)?'done':''} ${x===stage?'active':''}`}><i>{stages.indexOf(x)<stages.indexOf(stage)?<Icon name="check" size={14}/>:stages.indexOf(x)+1}</i><span>{stageText[x]}</span></div>)}</div></div></div>;
return <div className="page result-page"><div className="result-hero"><div><span className="success-label"><Icon name="check" size={14}/>PLANNING COMPLETED</span><h2>推荐方案 · Solution #183</h2><p>{s.name} · 满足全部 SLO 与资源约束 · 综合评分 92.8</p></div><div className="hero-score"><strong>92.8</strong><span>综合评分</span></div><div className="hero-kpis"><div><small>TTFT P95</small><b>{s.ttftResult} <i>ms</i></b></div><div><small>TPOT P95</small><b>{s.tpotResult} <i>ms</i></b></div><div><small>吞吐</small><b>{formatThroughput(s.throughputResult)} <i>M tok/s</i></b></div><span className="pass-pill">ALL SLO PASS</span></div></div><div className="result-flow"><section className="result-section"><ResultSectionHead index="01" eyebrow="RECOMMENDED PLAN" title="推荐规划方案" desc="明确实例部署、调度路由、KV 资源池和网络数据流配置。"/><Plan s={s}/></section><section className="result-section"><ResultSectionHead index="02" eyebrow="PERFORMANCE VALIDATION" title="方案性能表现" desc="验证服务性能目标，并给出各类资源利用率和运行余量。"/><Performance s={s}/></section><section className="result-section"><ResultSectionHead index="03" eyebrow="BOTTLENECK & ALTERNATIVES" title="瓶颈与寻优结论" desc="定位主要瓶颈、分析参数敏感性，并保留可行候选方案对比。"/><Bottleneck s={s}/></section></div></div>}

function ResultSectionHead({index,eyebrow,title,desc}:{index:string;eyebrow:string;title:string;desc:string}){return <div className="result-section-head"><span>{index}</span><div><small>{eyebrow}</small><h2>{title}</h2><p>{desc}</p></div></div>}

type DeploymentUnit={kind:'prefill'|'decode';nodes:number;instances:number}
type DeploymentZone={model:string;modelLabel:string;role:string;units:DeploymentUnit[];affinity:string;side:'standard'|'super';hot?:boolean}
const getDeploymentZones=(s:Scenario):DeploymentZone[]=>{
  if(s.key==='coding')return [
    {model:'Qwen3-32B',modelLabel:'MODEL A',role:'LOCAL P/D CELL',units:[{kind:'prefill',nodes:16,instances:8},{kind:'decode',nodes:8,instances:4}],affinity:'规划与工具入口 · 24 Nodes',side:'standard'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'EDGE P/D CELL',units:[{kind:'prefill',nodes:8,instances:4},{kind:'decode',nodes:8,instances:4}],affinity:'热点仓库溢出 · 16 Nodes',side:'standard'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'MAIN PREFILL',units:[{kind:'prefill',nodes:40,instances:20}],affinity:'超节点高带宽主池',side:'super'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'MAIN DECODE',units:[{kind:'decode',nodes:32,instances:16}],affinity:'会话 KV 主亲和域',side:'super',hot:true}
  ]
  const model=getModelInputs(s)[0].model
  const [standardNodes]=getClusterNodes(s)
  const standardPrefill=Math.round(s.prefillNodes*standardNodes/s.nodes)
  const superPrefill=s.prefillNodes-standardPrefill
  const standardDecode=Math.round(s.decodeNodes*standardNodes/s.nodes)
  const superDecode=s.decodeNodes-standardDecode
  return [
    {model,modelLabel:'MODEL',role:'PREFILL',units:[{kind:'prefill',nodes:standardPrefill,instances:standardPrefill/s.nodesPerInstance}],affinity:'Cluster A 本地 P/D',side:'standard'},
    {model,modelLabel:'MODEL',role:'DECODE',units:[{kind:'decode',nodes:standardDecode,instances:standardDecode/s.nodesPerInstance}],affinity:'会话与 KV 亲和',side:'standard'},
    {model,modelLabel:'MODEL',role:'PREFILL',units:[{kind:'prefill',nodes:superPrefill,instances:superPrefill/s.nodesPerInstance}],affinity:'Cluster B 本地 P/D',side:'super'},
    {model,modelLabel:'MODEL',role:'DECODE',units:[{kind:'decode',nodes:superDecode,instances:superDecode/s.nodesPerInstance}],affinity:'高带宽域 KV 亲和',side:'super'}
  ]
}

const getModelDeploymentSummary=(s:Scenario)=>s.key==='coding'
  ? [{label:'模型 A · Cluster A',model:'Qwen3-32B',prefillNodes:16,decodeNodes:8,prefillInstances:8,decodeInstances:4,nodes:24,affinity:'普通节点域独立 P/D 单元'},{label:'模型 B · Cross-Cluster',model:'DeepSeek-Coder-V2',prefillNodes:48,decodeNodes:40,prefillInstances:24,decodeInstances:20,nodes:88,affinity:'Cluster A 溢出 16 + Cluster B 主池 72'}]
  : [{label:'模型',model:getModelInputs(s)[0].model,prefillNodes:s.prefillNodes,decodeNodes:s.decodeNodes,prefillInstances:s.prefillInstances,decodeInstances:s.decodeInstances,nodes:s.prefillNodes+s.decodeNodes,affinity:'每个集群内 P/D 就近配对'}]

function Plan({s}:{s:(typeof scenarios)[ScenarioKey]}){
  const hbmTotal=s.gpuCount*64/1024
  const prefillCards=s.prefillNodes*8
  const decodeCards=s.decodeNodes*8
  const prefillPct=Math.round(s.prefillNodes/(s.prefillNodes+s.decodeNodes)*100)
  const kvStack=getKvResourceStack(s)
  const modelDeployments=getModelDeploymentSummary(s)
  return <div className="results-grid">
    <Card title="计算资源与 P/D 部署" subtitle="MODEL · NODE · INSTANCE PLANNING" icon="chip"><div className="plan-primary"><span><small>Prefill 节点</small><b>{s.prefillNodes}</b><i>{s.prefillInstances} 实例组 · {prefillCards} 卡</i></span><span><small>Decode 节点</small><b>{s.decodeNodes}</b><i>{s.decodeInstances} 实例组 · {decodeCards} 卡</i></span><span><small>单实例组</small><b>{s.nodesPerInstance}</b><i>节点/组 · 每节点 8 卡</i></span></div><div className="model-deployment-summary">{modelDeployments.map(x=><div key={x.model}><span><small>{x.label}</small><b>{x.model}</b></span><div className="model-pd-count"><i className="prefill"><small>P 实例</small><b>{x.prefillInstances}</b><em>{x.prefillNodes} 节点</em></i><i className="decode"><small>D 实例</small><b>{x.decodeInstances}</b><em>{x.decodeNodes} 节点</em></i></div><strong>{x.nodes}<small>部署节点</small></strong><em>{x.affinity}</em></div>)}</div><div className="pd-allocation"><div><span>Prefill <b>{prefillPct}%</b></span><span>Decode <b>{100-prefillPct}%</b></span></div><i><b style={{width:`${prefillPct}%`}}/><b style={{width:`${100-prefillPct}%`}}/></i></div><div className="instance-note">共 {s.nodes} 节点 / {s.gpuCount} 卡{s.reservedNodes>0?` · ${s.prefillNodes+s.decodeNodes} 节点部署 + ${s.reservedNodes} 节点余量（每集群 1 节点）`:''}；所有实例组均按 {s.nodesPerInstance} 节点/组折算。</div></Card>
    <Card title="服务调度与引擎执行" subtitle="SERVICE CONTROL / INFERENCE EXECUTION" icon="sliders"><div className="key-value"><p><span>引擎调度</span><b>Continuous Batching</b></p><p><span>Chunked Prefill</span><b>Enabled / 4K</b></p><p><span>服务级路由</span><b>Load-aware · Cache-aware</b></p><p><span>准入控制</span><b className="green">Enabled</b></p></div></Card>
    <div className="plan-wide"><Card title="KV 资源池与分层放置规划" subtitle="POOL STRATEGY / ESTIMATED DEMAND / PLANNED CAPACITY" icon="database"><div className="kv-pool-strategy"><span><small>KV 管理层</small><b>{kvStack.split(' + ')[0]}</b></span><span><small>池化范围</small><b>Cluster + Global</b></span><span><small>分布式存储</small><b>Mooncake Store</b></span><span><small>放置与迁移</small><b>HBM ↔ DDR ↔ SSD</b></span></div><div className="capacity-plan-grid"><CapacityPlan label="HBM Pool" demand={s.hbmDemandTB} total={hbmTotal} scope="模型常驻、运行时与热 KV"/><CapacityPlan label="DDR Pool" demand={s.ddrDemandTB} total={s.ddrTB} scope="Warm KV · 跨节点共享"/><CapacityPlan label="Local SSD Pool" demand={s.localSsdDemandTB} total={s.localSsdTB} scope="集群内冷 KV 与回源"/><CapacityPlan label="Remote SSD Pool" demand={s.remoteSsdDemandTB} total={s.remoteSsdTB} scope="跨集群长尾 KV"/></div><div className="sizing-note"><Icon name="activity" size={14}/><span>需求估算：模型常驻与运行时占用 + 峰值并发 KV + 分层承接量；规划总量按节点/盘组规格向上取整并保留运行余量。</span></div></Card></div>
    <div className="plan-wide"><Card title="规划后算存网拓扑" subtitle="P/D DEPLOYMENT · CAPACITY · BOTTLENECK LOCATION" icon="network"><PlanningNetworkTopology scenario={s}/></Card></div>
  </div>
}

function CapacityPlan({label,demand,total,scope}:{label:string;demand:number;total:number;scope:string}){const pct=Math.round(demand/total*100);return <div className={`capacity-plan ${pct>=88?'near-limit':''}`}><div><small>{label}</small><b>{demand.toFixed(1)} <i>/ {total.toFixed(1)} TB</i></b><span>{pct}% USED · {Math.round((total-demand)*10)/10} TB 余量</span></div><em><i style={{width:`${Math.min(100,pct)}%`}}/></em><p>{scope}</p></div>}

function PlanningNetworkTopology({scenario:s}:{scenario:Scenario}){
  const profile=bottleneckProfiles[s.key]
  const bottleneck=profile.active.toLowerCase()
  const zones=getDeploymentZones(s)
  const positions=[42,278,624,860]
  const primaryFlow=s.key==='coding'?'Model A 规划 → Model B 编码':s.key==='rag'?'Prefix KV / P-D Handoff':'Long KV / Tier Migration'
  const affinity=s.key==='coding'?'模型独占集群 · 集群内 P/D 配对':'每集群内 P/D 配对 · KV 会话亲和'
  const [standardNodes,superNodes]=getClusterNodes(s)
  const deployedBySide=(side:'standard'|'super')=>zones.filter(zone=>zone.side===side).reduce((sum,zone)=>sum+zone.units.reduce((n,unit)=>n+unit.nodes,0),0)
  const standardReserved=standardNodes-deployedBySide('standard'),superReserved=superNodes-deployedBySide('super')
  const hbmCapacity:[number,number]=[standardNodes*8*64/1024,superNodes*8*64/1024]
  const hbmDemand:[number,number]=s.key==='coding'?[15,29]:splitByCluster(s,s.hbmDemandTB)
  const ddrDemand=splitByCluster(s,s.ddrDemandTB),ddrCapacity=splitByCluster(s,s.ddrTB)
  const ssdDemand=splitByCluster(s,s.localSsdDemandTB),ssdCapacity=splitByCluster(s,s.localSsdTB)
  const fabricDemandTbps=1.6*s.fabricUtilization/100
  return <div className="planning-topology"><div className="orchestration-summary"><span><small>模型数据流</small><b>{primaryFlow}</b></span><span><small>部署亲和</small><b>{affinity}</b></span><span><small>Rail 规划</small><b>4 / 4 Rails · NUMA-aware</b></span><span><small>调度与容错</small><b>Cache-aware · Dynamic Remap</b></span></div><svg viewBox="0 0 1120 410" role="img" aria-label="基于输入物理拓扑的模型部署、P D 节点与分层资源规划结果">
    <g className={`plan-fabric ${bottleneck==='fabric'?'hot':''}`}><rect x="390" y="12" width="150" height="44" rx="5"/><rect x="580" y="12" width="150" height="44" rx="5"/><text x="465" y="30">FABRIC PLANE A</text><text x="655" y="30">FABRIC PLANE B</text><text x="465" y="45" className="sub">RAIL 0 / 2</text><text x="655" y="45" className="sub">RAIL 1 / 3</text></g><path className="plan-link" d="M390 34H280V76M730 34H840V76M540 34H580"/>
    <g className="plan-cluster"><rect x="18" y="76" width="502" height="252" rx="9"/><rect x="600" y="76" width="502" height="252" rx="9"/><text x="40" y="102">CLUSTER A · 普通节点集群 · {standardNodes} NODES{standardReserved>0?` · ${standardReserved} RESERVED`:''}</text><text x="622" y="102">CLUSTER B · 超节点集群 · {superNodes} NODES{superReserved>0?` · ${superReserved} RESERVED`:''}</text></g>
    <g className="plan-compute">{zones.map((zone,i)=>{const unitWidth=zone.units.length===1?194:93;return <g key={`${zone.model}-${zone.role}-${i}`}><rect className={`${zone.modelLabel==='MODEL B'?'model-b':'model-a'} ${zone.side}-zone ${zone.hot?'hot':''}`} x={positions[i]} y="124" width="218" height="76" rx="6"/><text x={positions[i]+12} y="143">{zone.modelLabel} · {zone.model}</text><text x={positions[i]+206} y="143" textAnchor="end" className="zone-role">{zone.role}</text>{zone.units.map((unit,j)=><g className={`deployment-unit ${unit.kind} ${bottleneck===unit.kind&&(s.key!=='coding'||zone.hot)?'hot-unit':''}`} key={unit.kind}><rect x={positions[i]+12+j*(unitWidth+8)} y="151" width={unitWidth} height="24" rx="4"/><text x={positions[i]+20+j*(unitWidth+8)} y="166">{unit.kind==='prefill'?'P':'D'} × {unit.instances} 实例</text><text x={positions[i]+unitWidth+4+j*(unitWidth+8)} y="166" textAnchor="end">{unit.nodes}N</text></g>)}<text x={positions[i]+12} y="190" className="sub">{zone.affinity}</text></g>})}</g>
    <g className={`plan-pool hbm ${bottleneck==='hbm'?'hot':''}`}><rect x="42" y="210" width="454" height="45" rx="5"/><rect x="624" y="210" width="454" height="45" rx="5"/><text x="60" y="229">L0 · HBM POOL</text><text x="478" y="229" textAnchor="end">{hbmDemand[0].toFixed(1)} / {hbmCapacity[0].toFixed(1)} TB</text><text x="60" y="245" className="sub">模型常驻 · Runtime · Hot KV</text><text x="642" y="229">L0 · HBM POOL</text><text x="1060" y="229" textAnchor="end">{hbmDemand[1].toFixed(1)} / {hbmCapacity[1].toFixed(1)} TB</text><text x="642" y="245" className="sub">模型常驻 · Runtime · Hot KV</text></g>
    <g className="plan-pool lower"><rect x="42" y="270" width="220" height="43" rx="5"/><rect x="276" y="270" width="220" height="43" rx="5"/><rect x="624" y="270" width="220" height="43" rx="5"/><rect x="858" y="270" width="220" height="43" rx="5"/><text x="56" y="289">L1 DDR · {ddrDemand[0]} / {ddrCapacity[0]} TB</text><text x="290" y="289">L2 SSD · {ssdDemand[0]} / {ssdCapacity[0]} TB</text><text x="638" y="289">L1 DDR · {ddrDemand[1]} / {ddrCapacity[1]} TB</text><text x="872" y="289">L2 SSD · {ssdDemand[1]} / {ssdCapacity[1]} TB</text><text x="56" y="304" className="sub">跨节点 Warm KV</text><text x="290" y="304" className="sub">集群内 Cold KV</text><text x="638" y="304" className="sub">跨节点 Warm KV</text><text x="872" y="304" className="sub">集群内 Cold KV</text></g>
    <g className="planned-flow">{s.key==='coding'?<><path className="handoff" d="M151 194C330 76 785 76 969 194"/><text x="560" y="116">MODEL A → MODEL B · Context Handoff</text></>:<><path className="handoff" d="M151 194C194 108 344 108 387 194"/><path className="handoff" d="M733 194C776 108 926 108 969 194"/><text x="269" y="116">LOCAL P/D · Direct Transfer</text><text x="851" y="116">LOCAL P/D · Direct Transfer</text></>}</g>
    <path className="plan-link remote" d="M386 313V350H470M734 313V350H650"/><g className="plan-remote"><rect x="470" y="336" width="180" height="54" rx="6"/><text x="560" y="357">L3 · REMOTE SSD</text><text x="560" y="375">{s.remoteSsdDemandTB} / {s.remoteSsdTB} TB</text></g>
  </svg><div className="planning-legend"><span><i className="need"/>输入物理拓扑同源映射</span>{s.key==='coding'&&<><span><i className="model-a"/>模型 A</span><span><i className="model-b"/>模型 B</span></>}<span><i className="flow"/>模型 / P-D 数据流</span><span><i className="hot"/>橙色 = 整体平均主瓶颈</span></div><div className="fabric-demand">Fabric 加权平均 {fabricDemandTbps.toFixed(2)} / 1.60 Tbps · {profile.fabric}% · 峰值另行保护</div></div>
}

function Performance({s}:{s:(typeof scenarios)[ScenarioKey]}){const capacityMultiple=s.maxQps/s.peak;const qpsMargin=Math.round((capacityMultiple-1)*100);const throughputMargin=Math.round((s.throughputResult/s.throughputTarget-1)*100);return <div><div className="grid perf-grid"><Card title="服务性能与 SLO" subtitle="ALL TARGETS PASSED" icon="target"><div className="slo-table"><div><span>指标</span><span>目标</span><span>仿真结果</span><span>状态</span></div>{[['TTFT P95',`< ${s.ttftTarget} ms`,`${s.ttftResult} ms`],['TPOT P95',`< ${s.tpotTarget} ms`,`${s.tpotResult} ms`],['Throughput',`> ${s.throughputTarget.toFixed(2)} M tok/s`,`${s.throughputResult.toFixed(2)} M tok/s`],['Availability','99.99%','99.995%']].map(r=><div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><strong>{r[2]}</strong><i>PASS</i></div>)}</div></Card><Card title="业务承载边界" subtitle="VALIDATED CAPACITY ENVELOPE" icon="activity"><div className="capacity-boundary"><span><small>计划业务峰值</small><b>{s.peak.toLocaleString()}</b><em>req/s</em></span><span><small>验证最大 QPS</small><b>{s.maxQps.toLocaleString()}</b><em>req/s</em></span><span><small>请求容量倍数</small><b>{capacityMultiple.toFixed(2)}×</b><em>峰值余量 {qpsMargin}%</em></span><span><small>验证最大并发</small><b>{s.maxConcurrency.toLocaleString()}</b><em>sessions</em></span></div><div className="capacity-boundary-note">在当前请求长度、会话轮数及模型组合下，通过 SLO 仿真验证的稳定承载上限。</div></Card></div><div className="metric-grid result-metrics concise"><MiniMetric label="E2E P95" value={(s.ttftResult/1000+1.9).toFixed(2)} unit="s"/><MiniMetric label="吞吐目标余量" value={throughputMargin} unit="%"/><MiniMetric label="SLO 达标率" value="99.96" unit="%"/><MiniMetric label="KV 命中率" value={s.kvHitRate.toFixed(1)} unit="%"/><MiniMetric label="超时率" value="0.04" unit="%"/></div></div>}

const bottleneckProfiles={
  rag:{active:'Decode',prefill:62,decode:78,hbm:70,ddr:60,fabric:46,ssd:48,signal:'全场景加权平均 78% · 峰值窗口 91% · 排队 P95 18 ms',mechanism:'财务分析与摘要生成的输出阶段较长，Decode 实例在收盘后批量研报窗口率先形成排队',judgement:'48 卡规模下应先增加 Decode 批处理弹性；P/D 已在各集群内就近配对，无需扩大跨集群 KV 流量',secondary:'HBM 加权平均 70% · 峰值占用 2.5 / 3.0 TB（83%）',actions:[['重分配 P/D','4P / 2D → 3P / 3D','Decode 平均 78% → 65%','排队 P95 18 ms → 9 ms'],['启用会话 KV 亲和','Load-aware → Cache-aware','KV 命中 82.5% → 87.0%','TPOT P95 34 ms → 31 ms'],['收盘峰值弹性批处理','Static → Adaptive Batch','峰值 Decode 91% → 82%','最大 QPS 360 → 395']]},
  long:{active:'HBM',prefill:72,decode:67,hbm:86,ddr:74,fabric:58,ssd:69,signal:'全场景加权平均 86% · 峰值占用 58.2 / 64.0 TB（91%）',mechanism:'合同与法规上下文持续增长，峰值窗口触发 HBM 向 DDR / SSD 下沉并增加 Prefetch 回源',judgement:'HBM 是平均负载下最接近阈值的资源；优先优化分层命中与容量，而不是跨集群拆散 P/D 对',secondary:'SSD I/O 加权平均 69% · 峰值 Prefetch 13.6 / 16.0 GB/s',actions:[['热 KV 精度与分层','Hot KV FP16 → FP8','HBM 峰值 58.2 → 50.4 TB','HBM 平均 86% → 75%'],['合同 Prefix 预测预取','Reactive → Predictive','SSD 回源 P95 210 → 145 ms','TTFT P95 1460 → 1320 ms'],['案件会话亲和路由','Global RR → KV Affinity','KV 命中 74.8% → 81.0%','Fabric 平均 58% → 51%']]},
  coding:{active:'Decode',prefill:69,decode:84,hbm:72,ddr:66,fabric:57,ssd:61,signal:'全场景加权平均 84% · 峰值窗口 93% · 排队 P95 31 ms',mechanism:'模型 B 的长代码生成与测试回调延长 Decode 占用，热点仓库会话集中到超节点主池',judgement:'模型 B 已跨集群部署，并在 Cluster A 设置独立溢出 P/D 单元；下一步应调整主池 P/D 配比并按热点仓库动态启停溢出单元',secondary:'跨模型 Fabric 加权平均 57% · 峰值 1.30 / 1.60 Tbps（81%）',actions:[['模型 B 主池重配','40P / 32D → 32P / 40D','Decode 平均 84% → 72%','排队 P95 31 ms → 14 ms'],['溢出 P/D 单元弹性','固定 16 → 8–24 Nodes','热点仓库独立调度','TPOT P95 34 ms → 31 ms'],['跨模型上下文压缩','Full Context → Delta Blocks','Fabric 平均 57% → 49%','峰值 1.30 → 1.12 Tbps']]},
} as const

const bottleneckTypeLabel={compute:'计算',network:'网络带宽',storage:'存储'} as const

function Bottleneck({s}:{s:(typeof scenarios)[ScenarioKey]}){
  const profile=bottleneckProfiles[s.key]
  const baseCost=s.gpuCount/768*1.08
  const cardStep=Math.max(8,Math.round(s.gpuCount*.125/8)*8)
  const rows=[['推荐方案','PASS',s.gpuCount,`¥ ${baseCost.toFixed(2)} 亿`,s.throughputResult.toFixed(2),'综合最优'],['最小资源','PASS',Math.max(8,s.gpuCount-cardStep),`¥ ${(baseCost*.9).toFixed(2)} 亿`,(s.throughputResult*.84).toFixed(2),'资源最少'],['最大吞吐','PASS',s.gpuCount+cardStep*2,`¥ ${(baseCost*1.17).toFixed(2)} 亿`,(s.throughputResult*1.25).toFixed(2),'吞吐最高']]
  return <div><div className="grid bottleneck-grid single"><Card title="瓶颈位置、优化动作与预期结果" subtitle="BOTTLENECK EVIDENCE / ACTION / EXPECTED OUTCOME" icon="alert"><BottleneckPath s={s}/><div className="bottleneck-evidence"><span><small>触发信号</small><b>{profile.signal}</b></span><span><small>影响链路</small><b>{profile.mechanism}</b></span><span><small>规划判断</small><b>{profile.judgement}</b></span></div><div className="bottleneck-remediation">{profile.actions.map((action,i)=><div key={action[0]}><span>0{i+1}</span><div><small>优化动作</small><b>{action[0]}</b><p>{action[1]}</p></div><div><small>预期结果</small><strong>{action[2]}</strong><em>{action[3]}</em></div></div>)}</div><div className="bottleneck-secondary"><span>次要瓶颈</span><b>{s.bottleneckSub}</b><i>{profile.secondary}</i></div></Card></div><Card title="Top-K 候选方案" subtitle="FEASIBLE SOLUTIONS" icon="layers"><div className="candidate-table"><div><span>方案</span><span>SLO</span><span>GPU/NPU</span><span>年度成本</span><span>吞吐</span><span>主要特点</span></div>{rows.map((r,i)=><div className={i===0?'recommended':''} key={String(r[0])}><b>{i===0&&<i>★</i>}{r[0]}</b><span className="pass">{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span><strong>{r[4]} M tok/s</strong><span>{r[5]}</span></div>)}</div></Card></div>
}

function BottleneckPath({s}:{s:Scenario}){const profile=bottleneckProfiles[s.key];const nodes=[{label:'Prefill',value:profile.prefill,type:'compute'},{label:'Decode',value:profile.decode,type:'compute'},{label:'HBM',value:profile.hbm,type:'storage'},{label:'DDR',value:profile.ddr,type:'storage'},{label:'SSD I/O',value:profile.ssd,type:'storage'},{label:'Fabric',value:profile.fabric,type:'network'}] as const;return <div className="bottleneck-visual"><div className="bottleneck-callout"><span>PRIMARY BOTTLENECK</span><b>{s.bottleneck}</b><small>全场景加权平均利用率；触发信号同时给出峰值窗口作为容量保护依据</small><div className="bottleneck-type-legend"><span className="compute">计算</span><span className="network">网络带宽</span><span className="storage">存储</span></div></div><div className="bottleneck-path">{nodes.map((x,i)=><div key={x.label} className={`resource-${x.type} ${x.label===profile.active?'active':''}`}><span>{x.label}</span><small className="resource-kind">{bottleneckTypeLabel[x.type]}</small><b>{x.value}%</b><i><em style={{height:`${Math.min(100,x.value)}%`}}/></i>{i<nodes.length-1&&<u/>}</div>)}</div></div>}

function PageTitle({eyebrow,title,desc,badge}:{eyebrow:string;title:string;desc:string;badge:string}){return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div><b>{badge}</b></div>}
function Card({title,subtitle,icon,children}:{title:string;subtitle:string;icon:string;children:React.ReactNode}){return <section className="card"><div className="card-head"><span><Icon name={icon}/></span><div><h3>{title}</h3><p>{subtitle}</p></div><button>•••</button></div><div className="card-body">{children}</div></section>}
function Field({label,value,unit}:{label:string;value:string;unit?:string}){return <label className="field"><span>{label}</span><div><b>{value}</b>{unit&&<small>{unit}</small>}</div></label>}
function Dtype({name,value,pct}:{name:string;value:string;pct:number}){return <div className="dtype"><span>{name}</span><b>{value}</b><i><em style={{width:`${pct}%`}}/></i></div>}
function Software({name,value,tag}:{name:string;value:string;tag:string}){return <div className="software"><span>{tag}</span><Icon name="chip"/><small>{name}</small><b>{value}</b></div>}
function Metric({icon,label,value,unit}:{icon:string;label:string;value:string;unit:string}){return <div className="resource-metric"><span><Icon name={icon}/></span><div><small>{label}</small><b>{value}</b><i>{unit}</i></div></div>}
function MiniMetric({label,value,unit}:{label:string;value:string|number;unit:string}){return <div className="mini-metric"><span>{label}</span><b>{value}</b><small>{unit}</small></div>}
function Inventory({title,value,meta}:{title:string;value:string;meta:string}){return <div className="inventory-item"><i/><div><span>{title}</span><b>{value}</b><small>{meta}</small></div><Icon name="arrow" size={15}/></div>}
function Objective({label,value,unit}:{label:string;value:string;unit:string}){return <div className="objective"><button className="switch on"><i/></button><b>{label}</b><span>{value}<small>{unit}</small></span></div>}

export default App
