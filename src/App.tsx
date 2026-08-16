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
  rag:['6 节点 · 48 卡','单模型部署','共享前缀 63%'],
  long:['128 节点 · 1024 卡','单模型 · 64K+','平均 14.6 轮'],
  coding:['112 节点 · 896 卡','双模型协同','7.8 工具/任务'],
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
  const [demoMode,setDemoMode] = useState<'classic'|'agent'>('classic')
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

  if(demoMode==='agent') return <AgentPlanningDemo onToggle={()=>setDemoMode('classic')}/>

  return <div className="app-shell">
    <Header onToggle={()=>setDemoMode('agent')}/>
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
        <button className={workspace==='optimization'?'active':''} onClick={()=>setWorkspace('optimization')}>仿真规划</button>
        <button className={workspace==='results'?'active':''} onClick={()=>stage==='COMPLETED'&&setWorkspace('results')}>规划结果 {stage==='COMPLETED'&&<i/>}</button>
      </div>
      <div className="content-scroll" ref={contentScroll}>
        {workspace==='overview' && <WorkflowOverview onStart={()=>setWorkspace('input')}/>} 
        {workspace==='input' && <UnifiedInput scenarioKey={scenarioKey} onProceed={()=>setWorkspace('optimization')}/>}
        {workspace==='optimization' && <OptimizationWorkspace scenarioKey={scenarioKey} stage={stage} progress={progress} scale={scale} setScale={setScale} onStart={startSimulation} onViewResults={()=>setWorkspace('results')}/>}
        {workspace==='results' && <Results stage={stage} progress={progress} scenarioKey={scenarioKey}/>}
      </div>
    </main>
    <footer className="statusbar"><span><i className="ok-dot"/>配置完整度 <b>100%</b></span><span>场景 <b>{scenario.name}</b></span><span>资源 <b>{scenario.nodes} 节点 · {scenario.gpuCount} {scenario.gpu.split(' ')[0]}</b></span><span className={`run-state ${stage.toLowerCase()}`}><i/>{stageText[stage]}</span><span className="status-right"><Icon name="check" size={15}/>未发现约束冲突</span></footer>
  </div>
}

type AgentConfig={id:string;index:string;name:string;role:string;icon:string;color:string;model:string;peak:number;average:number;ttft:number;tpot:number;throughput:string}

const initialAgents:AgentConfig[]=[
  {id:'insight',index:'AGENT 01',name:'知识洞察 Agent',role:'检索、归纳与可信回答',icon:'database',color:'cyan',model:'Qwen3-32B',peak:1280,average:620,ttft:600,tpot:45,throughput:'0.8M'},
  {id:'research',index:'AGENT 02',name:'深度研究 Agent',role:'长上下文分析与多步推理',icon:'layers',color:'violet',model:'DeepSeek-V3',peak:860,average:390,ttft:1800,tpot:55,throughput:'5.2M'},
  {id:'coding',index:'AGENT 03',name:'研发执行 Agent',role:'任务规划、工具调用与代码生成',icon:'cube',color:'green',model:'Qwen3-32B',peak:2460,average:1180,ttft:900,tpot:45,throughput:'3.4M'},
]

const optimizationDimensions=[
  ['服务级调度','Agent → 模型路由'],['推理引擎调度','批处理与 Prefill'],['并行策略','TP / DP / EP'],['数据流编排','RDMA 路径与优先级'],['部署拓扑与资源亲和','模型 → 节点放置'],['KV 复用与缓存','HBM 热上下文共享'],['KV 资源池与分层放置','HBM → DDR → SSD']
]

function AgentPlanningDemo({onToggle}:{onToggle:()=>void}){
  const [agents,setAgents]=useState(initialAgents)
  const [openAgent,setOpenAgent]=useState<string|null>(null)
  const [phase,setPhase]=useState<'steps'|'running'|'done'>('steps')
  const [progress,setProgress]=useState(0)
  const [showResults,setShowResults]=useState(false)
  const timer=useRef<number|null>(null)
  useEffect(()=>()=>{if(timer.current)window.clearInterval(timer.current)},[])
  const updateAgent=(id:string,key:keyof AgentConfig,value:string|number)=>setAgents(current=>current.map(agent=>agent.id===id?{...agent,[key]:value}:agent))
  const start=()=>{
    if(timer.current)window.clearInterval(timer.current)
    setShowResults(false);setOpenAgent(null);setPhase('running');setProgress(1)
    let next=1
    timer.current=window.setInterval(()=>{
      next=Math.min(100,next+1)
      setProgress(next)
      if(next===100){setPhase('done');if(timer.current)window.clearInterval(timer.current)}
    },120)
  }
  return <div className="agent-demo-shell">
    <Header onToggle={onToggle}/>
    <main className="agent-demo-main">
      <aside className="agent-panel">
        <div className="agent-panel-title"><span>PLANNING OBJECTS</span><h2>Agent 业务编排</h2><p>选择卡片配置独立模型、负载与 SLO</p></div>
        <div className="agent-stack">{agents.map(agent=>{const opened=openAgent===agent.id;return <section key={agent.id} className={`agent-card ${agent.color} ${opened?'opened':''}`}>
          <button className="agent-card-summary" onClick={()=>setOpenAgent(opened?null:agent.id)} aria-expanded={opened}>
            <span className="agent-card-icon"><Icon name={agent.icon} size={19}/></span>
            <span className="agent-card-copy">
              <small>{agent.index}</small><b>{agent.name}</b><em>{agent.role}</em>
              <span className="agent-card-model"><Icon name="chip" size={12}/><strong>{agent.model}</strong><i>{agent.id==='research'?'独立模型服务':'共享模型服务'}</i></span>
              <span className="agent-card-metrics">
                <span><small>峰值负载</small><b>{agent.peak.toLocaleString()} <i>req/s</i></b></span>
                <span><small>平均负载</small><b>{agent.average.toLocaleString()} <i>req/s</i></b></span>
                <span><small>TTFT P95</small><b>{agent.ttft} <i>ms</i></b></span>
              </span>
            </span>
            <span className="agent-card-status"><i/>READY</span><Icon name="arrow" size={15}/>
          </button>
        </section>})}</div>
        <button className="agent-simulate-button" onClick={start}><Icon name="play" size={18}/><span>{phase==='running'?'重新开始仿真规划':'开始仿真规划'}<small>{agents.length} AGENTS · 2 MODELS · 7 DIMENSIONS</small></span></button>
      </aside>
      <section className="agent-stage">
        {phase==='steps'?<AgentFlowSteps/>:<AgentSimulation agents={agents} progress={progress} done={phase==='done'} onResults={()=>setShowResults(true)}/>}
      </section>
      {openAgent&&<AgentSettingsDrawer agent={agents.find(agent=>agent.id===openAgent)!} onClose={()=>setOpenAgent(null)} onUpdate={updateAgent}/>}
      <div className={`agent-result-backdrop ${showResults?'visible':''}`} onClick={()=>setShowResults(false)}/>
      <aside className={`agent-result-drawer ${showResults?'visible':''}`} aria-hidden={!showResults}><div className="agent-result-drawer-head"><div><span>PLANNING OUTPUT</span><h2>联合规划结果</h2></div><button onClick={()=>setShowResults(false)}>×</button></div><div className="agent-result-scroll"><Results stage="COMPLETED" progress={100} scenarioKey="coding" hideTopology agentPlan/></div></aside>
    </main>
    <footer className="agent-statusbar"><span><i/>3 个 Agent 配置就绪</span><span>模型池 <b>2 MODELS</b></span><span>规划维度 <b>7 DIMENSIONS</b></span><span className="agent-status-right">{phase==='steps'?'等待启动':phase==='done'?'仿真规划完成':`寻优进行中 · ${progress}%`}</span></footer>
  </div>
}

function AgentSettingsDrawer({agent,onClose,onUpdate}:{agent:AgentConfig;onClose:()=>void;onUpdate:(id:string,key:keyof AgentConfig,value:string|number)=>void}){
  const source=agent.id==='research'?scenarios.long:agent.id==='insight'?scenarios.rag:scenarios.coding.modelInputs![0]
  const specs=getModelSpecs(source as ModelWorkloadInput)
  const loadOption=useMemo(()=>({animation:false,grid:{left:28,right:10,top:12,bottom:20},xAxis:{type:'category',data:source.load.map((_,i)=>String(i).padStart(2,'0')),axisLabel:{color:'#587087',interval:3,fontSize:7},axisLine:{lineStyle:{color:'#24364c'}},axisTick:{show:false}},yAxis:{type:'value',max:100,axisLabel:{show:false},splitLine:{lineStyle:{color:'#182a3e'}}},series:[{type:'line',data:source.load,smooth:.35,symbol:'none',lineStyle:{width:2,color:agent.color==='violet'?'#818cf8':agent.color==='green'?'#34d399':'#38bdf8'},areaStyle:{color:'rgba(56,189,248,.12)'}}]}),[agent.color,source])
  return <><div className="agent-config-backdrop" onClick={onClose}/><aside className="agent-config-drawer"><div className="agent-config-head"><span className={`agent-card-icon ${agent.color}`}><Icon name={agent.icon}/></span><div><small>{agent.index} · AGENT CONFIGURATION</small><h2>{agent.name}</h2><p>{agent.role}</p></div><button onClick={onClose}>×</button></div><div className="agent-config-scroll">
    <section className="config-section"><div className="config-section-title"><span>01</span><div><b>模型与软件栈</b><small>MODEL PROFILE · RUNTIME</small></div><em>{agent.id==='insight'||agent.id==='coding'?'共享模型服务':'独立模型服务'}</em></div><div className="config-model-hero"><div><small>当前模型</small><strong>{agent.model}</strong><p>{source.modelSize} · {'role' in source?source.role:agent.role}</p></div><label><span>模型选择</span><select value={agent.model} onChange={e=>onUpdate(agent.id,'model',e.target.value)}><option>Qwen3-32B</option><option>DeepSeek-V3</option></select></label></div><div className="config-spec-grid">{specs.slice(0,6).map(spec=><Field key={spec[0]} label={spec[0]} value={spec[1]} unit={spec[2]}/>)}</div><div className="config-stack"><span><small>推理框架</small><b>{source.framework}</b></span><i/><span><small>运行时</small><b>{source.runtime}</b></span><i/><span><small>通信库</small><b>{source.comm}</b></span></div></section>
    <section className="config-section"><div className="config-section-title"><span>02</span><div><b>业务负载</b><small>REQUEST PROFILE · TOKEN · PREFIX</small></div></div><div className="config-input-grid"><label><span>峰值请求</span><div><input type="number" value={agent.peak} onChange={e=>onUpdate(agent.id,'peak',Number(e.target.value))}/><i>req/s</i></div></label><label><span>平均请求</span><div><input type="number" value={agent.average} onChange={e=>onUpdate(agent.id,'average',Number(e.target.value))}/><i>req/s</i></div></label><label><span>Input Token</span><div><input readOnly value={source.inputTokens}/><i>M tps</i></div></label><label><span>Output Token</span><div><input readOnly value={source.outputTokens}/><i>M tps</i></div></label></div><div className="config-load"><div><small>24H 请求强度</small><ReactECharts option={loadOption} style={{height:145}}/></div><RequestMixTable scenario={source}/></div><div className="config-prefix"><span><small>共享 Prefix</small><b>{source.reuse}%</b></span><span><small>平均会话</small><b>{source.turns} 轮</b></span><span><small>上下文增长</small><b>+{source.prefixGrowth.toLocaleString()} Token/轮</b></span><span><small>工具调用</small><b>{source.toolCalls} / Task</b></span></div></section>
    <section className="config-section"><div className="config-section-title"><span>03</span><div><b>SLO 目标</b><small>LATENCY · THROUGHPUT</small></div></div><div className="config-input-grid three"><label><span>TTFT P95</span><div><input type="number" value={agent.ttft} onChange={e=>onUpdate(agent.id,'ttft',Number(e.target.value))}/><i>ms</i></div></label><label><span>TPOT P95</span><div><input type="number" value={agent.tpot} onChange={e=>onUpdate(agent.id,'tpot',Number(e.target.value))}/><i>ms</i></div></label><label><span>目标吞吐</span><div><input value={agent.throughput} onChange={e=>onUpdate(agent.id,'throughput',e.target.value)}/><i>tps</i></div></label></div></section>
  </div></aside></>
}

function AgentFlowSteps(){const steps=[
  {n:'01',icon:'sliders',title:'配置 Agent',desc:'分别定义三个 Agent 的模型、业务负载和服务目标。',tags:['独立模型','请求负载','SLO 约束']},
  {n:'02',icon:'activity',title:'联合仿真寻优',desc:'七类决策同时改变服务、模型、资源和数据路径，并持续观察指标反馈。',tags:['七维耦合','指标反馈','候选对比']},
  {n:'03',icon:'network',title:'生成资源规划',desc:'将模型实例直接映射到同构集群节点，输出算存网部署方案。',tags:['节点放置','同构网络','容量规划']},
];return <div className="agent-flow-intro"><div className="agent-stage-heading"><span>SINGLE PAGE WORKFLOW</span><h1>多 Agent 联合规划</h1><p>从业务配置到资源落位，在同一视图完成仿真规划闭环。</p><b>点击左侧 Agent 卡片开始配置</b></div><div className="agent-flow-steps">{steps.map((step,i)=><section key={step.n}><span className="flow-step-number">{step.n}</span><div className="flow-step-icon"><Icon name={step.icon} size={24}/></div><small>STEP {step.n}</small><h2>{step.title}</h2><p>{step.desc}</p><div>{step.tags.map(tag=><b key={tag}><Icon name="check" size={12}/>{tag}</b>)}</div>{i<2&&<em><Icon name="arrow" size={18}/></em>}</section>)}</div><div className="agent-flow-note"><Icon name="activity"/><span><b>联动逻辑</b>Agent 负载与 SLO 驱动模型实例规模，七维寻优决定实例参数、缓存层级、节点放置和网络数据路径。</span></div></div>}

function DimensionProgressBorder({progress}:{progress:number}){
  const edge=(start:number)=>Math.max(0,Math.min(1,(progress-start)/25))
  return <span className="dimension-progress-border" aria-hidden="true"><i className="edge edge-top" style={{transform:`scaleX(${edge(0)})`}}/><i className="edge edge-right" style={{transform:`scaleY(${edge(25)})`}}/><i className="edge edge-bottom" style={{transform:`scaleX(${edge(50)})`}}/><i className="edge edge-left" style={{transform:`scaleY(${edge(75)})`}}/></span>
}

function AgentSimulation({agents,progress,done,onResults}:{agents:AgentConfig[];progress:number;done:boolean;onResults:()=>void}){
  const wave=Math.sin(progress*.18)
  const kvHit=Math.min(79,Math.round(51+progress*.28+wave*2))
  const qwenInstances=12+Math.round(progress*.08),deepseekInstances=20+Math.round(progress*.16)
  const qwenTtft=Math.max(430,Math.round(720-progress*2.9+wave*18)),qwenTpot=Math.max(31,Math.round(47-progress*.16-wave*2)),qwenThroughput=(7.2+progress*.026+wave*.12).toFixed(1)
  const dsTtft=Math.max(780,Math.round(1480-progress*7+wave*42)),dsTpot=Math.max(41,Math.round(69-progress*.28-wave*3)),dsThroughput=(11.2+progress*.054+wave*.2).toFixed(1)
  const phase=done?'规划仿真完成':progress<28?'生成与筛选候选配置':progress<68?'实例映射与资源联调':'SLO 校验与方案收敛'
  const dimensionValues=[
    `路由 ${progress<38?'Load-aware':'Cache-aware'} · 准入 ${Math.round(820+progress*3.1)} req/s`,
    `Batch ${96+Math.round(progress*.32)} · Chunk ${progress<52?'8K':'4K'} · Queue ${Math.max(6,18-Math.round(progress*.11))}ms`,
    `Qwen TP${4+Math.round(progress*.04)}/DP${2+Math.round(progress*.06)} · DS TP${8+Math.round(progress*.08)}/EP${4+Math.round(progress*.04)}`,
    `RDMA QP ${16+progress} · Slice ${progress<60?'4':'2'}MB · Rail ${1+Math.floor(progress/34)}`,
    `Qwen ${Math.max(1,Math.round(progress*.4))}/40 Nodes · DS ${Math.max(1,Math.round(progress*.72))}/72 Nodes`,
    `Prefix ${kvHit}% · LRU ${Math.round(48+progress*.44)}K · Block ${progress<55?'32':'16'}K`,
    `HBM ${(13.4+progress*.041).toFixed(2)}T · DDR ${(132+progress*.44).toFixed(1)}T · SSD ${(248+progress*1.36).toFixed(1)}T`,
  ]
  const dimensionRates=[.72,1.28,.88,1.46,.78,1.12,.96]
  const dimensionProgress=dimensionRates.map(rate=>Math.min(100,Math.round(100*Math.pow(progress/100,rate))))
  const kpiBar=(label:string,value:string,width:number,tone:string,target:string)=><i className={tone}><span>{label}<small>{target}</small></span><b>{value}</b><em><u style={{width:`${Math.max(6,Math.min(100,width))}%`}}/></em></i>
  return <div className={`agent-simulation ${done?'done':''}`}>
    <div className="simulation-head"><div><span>JOINT PLANNING SIMULATION</span><h1>{phase}</h1></div><div className="simulation-head-numbers"><span><small>当前候选</small><b>#{String(Math.max(1,Math.round(progress*1.83))).padStart(3,'0')}</b></span><strong>{progress}<small>%</small></strong></div></div>
    <div className="simulation-canvas">
      <div className="planning-live-grid"><aside className="dimension-map"><div className="dimension-map-head"><span>7D PARAMETERS</span><b>动态规划参数</b></div>{optimizationDimensions.map((dimension,i)=><div key={dimension[0]} className={`dimension-item dimension-${i+1} ${dimensionProgress[i]===100?'dimension-complete':''}`}><DimensionProgressBorder progress={dimensionProgress[i]}/><i>{i+1}</i><span><b>{dimension[0]}</b><em className="dimension-scope">{dimension[1]}</em><small className="dimension-live-value"><strong>{dimensionProgress[i]}%</strong><span>{dimensionValues[i]}</span></small></span></div>)}</aside><div className="live-topology">
        <div className="sim-layer agent-layer"><label>01 · BUSINESS DEMAND & SLO</label><div>{agents.map(agent=>{const actualTtft=agent.model==='DeepSeek-V3'?dsTtft:qwenTtft;const actualTpot=agent.model==='DeepSeek-V3'?dsTpot:qwenTpot;const passed=progress>=12&&actualTtft<=agent.ttft&&actualTpot<=agent.tpot;return <span key={agent.id} className={`sim-agent ${agent.color} ${passed?'slo-pass':'slo-fail'}`}><Icon name={agent.icon} size={15}/><b>{agent.name.replace(' Agent','')}</b><small>{agent.peak} req/s · {agent.throughput} tps</small><u>TTFT &lt; {agent.ttft} ms · TPOT &lt; {agent.tpot} ms</u></span>})}</div></div>
        <svg className="agent-model-routes" viewBox="0 0 700 58" preserveAspectRatio="none" aria-label="Agent 到模型服务的请求路由"><path className="qwen-route" d="M115 0 C115 28 225 22 225 58M585 0 C585 28 225 22 225 58"/><path className="deepseek-route" d="M350 0 C350 28 480 22 480 58"/><circle className="packet" r="3"><animateMotion dur="1.5s" repeatCount="indefinite" path="M115 0 C115 28 225 22 225 58"/></circle><circle className="packet" r="3"><animateMotion begin="-.7s" dur="1.7s" repeatCount="indefinite" path="M585 0 C585 28 225 22 225 58"/></circle><circle className="packet deepseek-packet" r="3"><animateMotion begin="-.3s" dur="1.6s" repeatCount="indefinite" path="M350 0 C350 28 480 22 480 58"/></circle></svg>
        <div className="sim-layer model-layer"><label>02 · MODEL PERFORMANCE & ENGINE TUNING</label><div>
          <span className="sim-model model-0"><Icon name="cube" size={17}/><b>Qwen3-32B</b><small>Agent 01 + Agent 03 · {qwenInstances} Instances · TP8</small><div className="model-live-kpis">{kpiBar('TTFT',`${qwenTtft}ms`,28+(qwenTtft-430)/290*62,'latency','P95 · ↓')}{kpiBar('TPOT',`${qwenTpot}ms`,28+(qwenTpot-31)/16*62,'latency','P95 · ↓')}{kpiBar('吞吐',`${qwenThroughput}M`,28+(Number(qwenThroughput)-7.2)/2.6*62,'throughput','TPS · ↑')}</div><div className="model-engine-tunables"><span>Batch <b>{96+Math.round(progress*.32)}</b></span><span>Chunk <b>{progress<52?'8K':'4K'}</b></span><span>Prefix <b>{kvHit}%</b></span><span>P/D <b>{52+Math.round(progress*.12)}:{48-Math.round(progress*.12)}</b></span></div></span>
          <span className="sim-model model-1"><Icon name="cube" size={17}/><b>DeepSeek-V3</b><small>Agent 02 · {deepseekInstances} Instances · EP8</small><div className="model-live-kpis">{kpiBar('TTFT',`${dsTtft}ms`,28+(dsTtft-780)/700*62,'latency','P95 · ↓')}{kpiBar('TPOT',`${dsTpot}ms`,28+(dsTpot-41)/28*62,'latency','P95 · ↓')}{kpiBar('吞吐',`${dsThroughput}M`,28+(Number(dsThroughput)-11.2)/5.4*62,'throughput','TPS · ↑')}</div><div className="model-engine-tunables"><span>Batch <b>{48+Math.round(progress*.24)}</b></span><span>Chunk <b>{progress<58?'16K':'8K'}</b></span><span>Prefix <b>{Math.max(38,kvHit-11)}%</b></span><span>P/D <b>{56+Math.round(progress*.08)}:{44-Math.round(progress*.08)}</b></span></div></span>
        </div></div>
        <div className="model-fabric-links"><i/><i/></div>
        <DetailedSimulationTopology progress={progress}/>
      </div></div>
    </div>
    <div className="simulation-footer"><div className="sim-progress"><i style={{width:`${progress}%`}}/></div><span>{done?'512 个候选完成仿真 · 已选出满足全部 Agent SLO 的最低成本方案':`候选 ${Math.round(512*progress/100)} / 512 · SLO 通过 ${Math.round(58*progress/100)} · 节点映射持续变动`}</span>{done&&<button onClick={onResults}>查看规划结果 <Icon name="arrow" size={15}/></button>}</div>
  </div>
}

function DetailedSimulationTopology({progress}:{progress:number}){
  const nodeTargets=[24,16,40,32]
  const nodeStarts=nodeTargets.map((_,index)=>nodeTargets.slice(0,index).reduce((sum,count)=>sum+count,0))
  const plannedNodes=Math.min(112,Math.round(112*progress/100))
  const visibleNodes=nodeTargets.map((target,index)=>Math.min(target,Math.max(0,plannedNodes-nodeStarts[index])))
  const revealRatio=(index:number)=>visibleNodes[index]/nodeTargets[index]
  const [qwenPrefillNodes,qwenDecodeNodes,dsPrefillNodes,dsDecodeNodes]=visibleNodes
  const qwenPrefill=Math.ceil(qwenPrefillNodes/2),qwenDecode=Math.ceil(qwenDecodeNodes/2)
  const dsPrefill=Math.ceil(dsPrefillNodes/2),dsDecode=Math.ceil(dsDecodeNodes/2)
  const qwenNodes=qwenPrefillNodes+qwenDecodeNodes,dsNodes=dsPrefillNodes+dsDecodeNodes
  const remoteUsed=190+Math.round(progress*.7),remoteCapacity=384
  const nodeRange=(start:number,count:number)=>count>0?`N${String(start).padStart(3,'0')}–N${String(start+count-1).padStart(3,'0')}`:'PENDING'
  const servers=[
    {x:32,node:nodeRange(1,qwenPrefillNodes),nodeCount:qwenPrefillNodes,reveal:revealRatio(0),model:'QWEN3-32B',role:`PREFILL × ${qwenPrefill}`,instances:qwenPrefill,maxInstances:12,kind:'prefill',tone:'qwen',util:58+progress*.2+Math.sin(progress*.12)*4,ddr:28+Math.round(progress*.12),ddrCap:48,ssd:32+Math.round(progress*.18),ssdCap:64},
    {x:228,node:nodeRange(25,qwenDecodeNodes),nodeCount:qwenDecodeNodes,reveal:revealRatio(1),model:'QWEN3-32B',role:`DECODE × ${qwenDecode}`,instances:qwenDecode,maxInstances:8,kind:'decode',tone:'qwen',util:64+progress*.17+Math.sin(progress*.11+1)*5,ddr:19+Math.round(progress*.09),ddrCap:32,ssd:24+Math.round(progress*.14),ssdCap:48},
    {x:424,node:nodeRange(41,dsPrefillNodes),nodeCount:dsPrefillNodes,reveal:revealRatio(2),model:'DEEPSEEK-V3',role:`PREFILL × ${dsPrefill}`,instances:dsPrefill,maxInstances:20,kind:'prefill',tone:'deepseek',util:56+progress*.21+Math.sin(progress*.1+2)*4,ddr:45+Math.round(progress*.2),ddrCap:80,ssd:58+Math.round(progress*.35),ssdCap:128},
    {x:620,node:nodeRange(81,dsDecodeNodes),nodeCount:dsDecodeNodes,reveal:revealRatio(3),model:'DEEPSEEK-V3',role:`DECODE × ${dsDecode}`,instances:dsDecode,maxInstances:16,kind:'decode',tone:'deepseek',util:66+progress*.18+Math.sin(progress*.13+3)*5,ddr:36+Math.round(progress*.16),ddrCap:64,ssd:44+Math.round(progress*.28),ssdCap:96},
  ]
  return <div className="sim-network detailed"><label>03 · HOMOGENEOUS LEAF–SPINE FABRIC · SERVER RESOURCE PLACEMENT</label><svg viewBox="0 0 820 565" role="img" aria-label="同构 Leaf Spine 网络以及服务器内部模型实例 NPU HBM HCCS DDR NIC SSD 连接关系">
    <g className="sim-fabric-links progressive-links">{[116,312,508,704].flatMap((leafX,i)=>[330,490].map((spineX,j)=><path key={`${i}-${j}`} pathLength="1" style={{strokeDasharray:1,strokeDashoffset:1-servers[i].reveal,opacity:servers[i].nodeCount>0?1:0}} d={`M${spineX} 46 C${spineX} 70 ${leafX} 65 ${leafX} 92`}/>))}</g>
    <g className="sim-spines"><rect x="270" y="16" width="120" height="30" rx="5"/><rect x="430" y="16" width="120" height="30" rx="5"/><text x="330" y="35">SPINE 01 · 800G</text><text x="490" y="35">SPINE 02 · 800G</text></g>
    <g className="sim-leaves">{[116,312,508,704].map((x,i)=><g key={x} className="progressive-leaf" style={{opacity:servers[i].nodeCount>0?.35+servers[i].reveal*.65:0}}><rect x={x-55} y="92" width="110" height="27" rx="4"/><text x={x} y="109">LEAF {String(i+1).padStart(2,'0')} · 48P</text></g>)}</g>
    <g className="sim-cluster-shells"><rect x="12" y="133" width="796" height="355" rx="7"/><text x="26" y="151">CLUSTER 01 · 112 HOMOGENEOUS NODES · 896 × A5 64GB</text><text className="planned-node-count" x="794" y="151" textAnchor="end">PLANNING {plannedNodes} / 112 NODES</text></g>
    <g className="model-node-allocation"><rect className="allocation-base" x="32" y="157" width="756" height="8" rx="4"/><rect className="allocation-qwen-prefill" x="32" y="157" width={756*qwenPrefillNodes/112} height="8" rx="4"/><rect className="allocation-qwen-decode" x={32+756*qwenPrefillNodes/112} y="157" width={756*qwenDecodeNodes/112} height="8"/><rect className="allocation-deepseek-prefill" x={32+756*qwenNodes/112} y="157" width={756*dsPrefillNodes/112} height="8"/><rect className="allocation-deepseek-decode" x={32+756*(qwenNodes+dsPrefillNodes)/112} y="157" width={756*dsDecodeNodes/112} height="8"/></g>
    <g className="sim-leaf-node-links progressive-links">{servers.map((server,i)=><path key={server.x} pathLength="1" style={{strokeDasharray:1,strokeDashoffset:1-server.reveal,opacity:server.nodeCount>0?1:.12}} d={`M${[116,312,508,704][i]} 119 V170 H${server.x+84}`}/>)}</g>
    <g className="sim-server-cards">{servers.map((server,i)=><g key={server.x} className={`${server.tone} ${server.kind}`}>
      <rect className="server-shell" x={server.x} y="170" width="168" height="300" rx="6"/>
      {server.nodeCount===0&&<text className="server-pending" x={server.x+84} y="320" textAnchor="middle">WAITING FOR NODE ALLOCATION</text>}
      <g className="server-planned-content" style={{opacity:server.nodeCount>0?.35+server.reveal*.65:0}}><text className="server-id" x={server.x+10} y="188">NODE {server.node} · {server.nodeCount}N</text><text className="server-model" x={server.x+10} y="204">{server.model}</text>
      <rect className="instance-block" x={server.x+10} y="216" width="148" height="31" rx="4"/><rect className="instance-allocation-fill" x={server.x+11} y="217" width={146*Math.min(1,server.instances/server.maxInstances)} height="29" rx="3"/><text x={server.x+84} y="229">{server.role}</text><text className="sub" x={server.x+84} y="240">TP {i<2?'8':'16'} · DP {i<2?Math.max(2,Math.round(server.instances/2)):Math.max(2,Math.round(server.instances/4))} · {Math.round(server.util)}% UTIL</text>
      <g className="npu-row">{Array.from({length:8},(_,n)=><rect key={n} x={server.x+10+n*19} y="258" width="15" height="18" rx="2"/>)}<text x={server.x+84} y="287">NPU × 8 · A5 64GB</text></g>
      <rect className="hbm-block" x={server.x+10} y="298" width="148" height="31" rx="4"/><rect className="capacity-fill hbm-fill" x={server.x+12} y="325" width={(144*Math.min(1,(3.2+i*.8+progress*.009)/(i<2?10:18)))} height="2"/><text x={server.x+20} y="311">HBM · HOT KV</text><text className="capacity" x={server.x+148} y="321" textAnchor="end">{(3.2+i*.8+progress*.009).toFixed(1)} / {i<2?'10':'18'} TB</text>
      <path className="hccs-link" d={`M${server.x+20} 340 H${server.x+148}`}/><text className="hccs-text" x={server.x+84} y="350">HCCS · 200 GB/s</text>
      <path className="resource-link" d={`M${server.x+84} 352 V365 M${server.x+84} 365 H${server.x+50} M${server.x+84} 365 H${server.x+126}`}/>
      <rect className="ddr-block" x={server.x+10} y="370" width="92" height="38" rx="4"/><rect className="capacity-fill ddr-fill" x={server.x+12} y="404" width={88*Math.min(1,server.ddr/server.ddrCap)} height="2"/><text x={server.x+20} y="384">DDR · WARM KV</text><text className="sub" x={server.x+20} y="398">{server.ddr} / {server.ddrCap} TB</text>
      <rect className="nic-block" x={server.x+110} y="370" width="48" height="38" rx="4"/><text x={server.x+134} y="384">NIC 0</text><text className="sub" x={server.x+134} y="398">400G</text>
      <path className="resource-link" d={`M${server.x+50} 408 V419 H${server.x+84} M${server.x+134} 408 V419 H${server.x+84}`}/>
      <rect className="ssd-block" x={server.x+10} y="423" width="148" height="31" rx="4"/><rect className="capacity-fill ssd-fill" x={server.x+12} y="450" width={144*Math.min(1,server.ssd/server.ssdCap)} height="2"/><text x={server.x+20} y="436">LOCAL SSD · COLD KV</text><text className="capacity" x={server.x+148} y="447" textAnchor="end">{server.ssd} / {server.ssdCap} TB</text></g>
    </g>)}</g>
    <g className="remote-links progressive-links">{servers.map(server=>{const sourceX=server.x+84;const innerX=410+(sourceX-410)*.18;return <path key={server.x} pathLength="1" style={{strokeDasharray:1,strokeDashoffset:1-server.reveal,opacity:server.nodeCount>0?1:.12}} d={`M${sourceX} 454 C${sourceX} 476 ${innerX} 484 410 506`}/>})}</g><g className="remote-store"><rect x="315" y="506" width="190" height="40" rx="6"/><text x="410" y="522">REMOTE SSD · GLOBAL KV STORE</text><text className="sub" x="410" y="537">{remoteUsed} / {remoteCapacity} TB · NVMe-oF / RDMA</text><rect className="remote-capacity-fill" x="317" y="542" width={186*remoteUsed/remoteCapacity} height="2" rx="1"/><circle className="remote-ingress" cx="410" cy="506" r="3"/></g>
  </svg><div className="network-legend"><span><i className="qwen"/>Qwen3 实例</span><span><i className="deepseek"/>DeepSeek 实例</span><span><i className="rdma"/>400G RoCE / RDMA · Single Rail</span><span><i className="hccs"/>节点内 HCCS</span></div></div>
}

function Header({onToggle}:{onToggle:()=>void}){
  return <header className="header"><button className="brand-switch" onClick={onToggle} title="切换 Demo 方案" aria-label="切换 Demo 方案"><div className="brand-mark"><span/><span/><span/></div><div className="brand"><h1>算存网一体化规划仿真平台</h1><p>INTEGRATED COMPUTING · STORAGE · NETWORK PLANNING SIMULATION PLATFORM</p></div></button><div className="header-context"><button className="ghost-button"><Icon name="download" size={16}/>导出方案</button></div></header>
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

function UnifiedInput({scenarioKey,onProceed}:{scenarioKey:ScenarioKey;onProceed:()=>void}){
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
      <Card title="02 · 业务负载特征" subtitle={`${active.label.toUpperCase()} · REQUEST SCALE · PREFIX BEHAVIOR`} icon="activity"><div className="workload-feature-grid"><section className="workload-feature request-scale-feature"><div className="module-subtitle"><span>{active.role} · 请求规模</span><small>REQUEST VOLUME & TOKEN LENGTH</small></div><div className="inline-kpis"><MiniMetric label="峰值请求" value={active.peak.toLocaleString()} unit="req/s"/><MiniMetric label="平均请求" value={active.average.toLocaleString()} unit="req/s"/><MiniMetric label="Input 吞吐" value={active.inputTokens} unit="M tps"/><MiniMetric label="Output 吞吐" value={active.outputTokens} unit="M tps"/></div><div className="request-scale-body"><div className="request-curve"><small>24H 请求强度 · 峰值归一化</small><ReactECharts option={option} style={{height:172}}/></div><RequestMixTable scenario={active}/></div></section><section className="workload-feature prefix-behavior-feature"><div className="module-subtitle"><span>Prefix 行为特征</span><small>REUSE · SOURCE · EVOLUTION</small></div><PrefixBehavior scenario={active}/></section></div></Card>
      <Card title="03 · 硬件与资源拓扑" subtitle="NODE · SUPERNODE · MEMORY FABRIC · HIERARCHICAL KV STORAGE" icon="chip"><div className="hardware-metrics-stack"><div className="hardware-resource-bar metrics-six"><Metric icon="chip" label="计算资源" value={`${s.nodes}`} unit={`节点 · ${s.gpuCount} 卡`}/><Metric icon="chip" label="节点规格" value={`${s.networkTopology.configuration.acceleratorsPerNode}`} unit="NPU / Server"/><Metric icon="database" label="L0 · HBM" value={hbmTB} unit="TB · 64 GB/卡"/><Metric icon="layers" label="L1 · DDR Pool" value={`${s.ddrTB}`} unit="TB · 跨节点"/><Metric icon="database" label="L2 · Local SSD" value={`${s.localSsdTB}`} unit="TB · 双集群"/><Metric icon="database" label="L3 · Remote SSD" value={`${s.remoteSsdTB}`} unit="TB · 跨集群"/></div><div className="hardware-resource-bar metrics-six"><Metric icon="activity" label="节点内互联" value={`${s.networkTopology.configuration.hccsBandwidthGBs}`} unit={`GB/s · ${s.networkTopology.configuration.acceleratorInterconnect}`}/><Metric icon="layers" label="Host I/O" value={`${s.networkTopology.configuration.hostBusBandwidthGBs}`} unit={`GB/s · ${s.networkTopology.configuration.hostBus}`}/><Metric icon="network" label="单轨节点上联" value={`${s.networkTopology.configuration.nicBandwidthGbps}`} unit={`Gbps · ${s.networkTopology.configuration.nicProtocol}`}/><Metric icon="network" label="Leaf–Spine" value={`${s.networkTopology.configuration.leafUplinkBandwidthGbps}`} unit="Gbps / Link"/><Metric icon="database" label="本地 SSD" value={`${s.networkTopology.configuration.localStorageBandwidthGBs}`} unit={`GB/s · ${s.networkTopology.configuration.localStorageProtocol}`}/><Metric icon="database" label="远端存储" value={`${s.networkTopology.configuration.remoteStorageBandwidthGBs}`} unit={`GB/s · ${s.networkTopology.configuration.remoteStorageProtocol}`}/></div></div><IntegratedResourceTopology scenario={s}/></Card>
      <Card title="规划目标与约束" subtitle="OBJECTIVES & CONSTRAINTS" icon="target"><div className="goal-strip"><Objective label="TTFT P95" value={`${s.ttftTarget}`} unit="ms"/><Objective label="TPOT P95" value={`${s.tpotTarget}`} unit="ms"/><Objective label="目标吞吐" value={formatThroughput(s.throughputTarget)} unit="M tps"/><Objective label="设备上限" value={`${s.gpuCount}`} unit="Cards"/></div></Card>
    </div>
    <div className="workflow-bottom input-next-action"><div><span>NEXT STEP</span><b>输入配置已完成，可进入方案仿真与规划。</b></div><button onClick={onProceed}>进入仿真规划 <Icon name="arrow" size={15}/></button></div>
  </div>
}

function RequestMixTable({scenario}:{scenario:Scenario|ModelWorkloadInput}){return <div className="request-mix"><div className="request-mix-head"><span>请求类型</span><span>占比</span><span>Prefix</span><span>Input</span><span>Output</span></div>{scenario.requestMix.map(x=><div key={x.label}><b>{x.label}</b><strong>{x.share}%</strong><span>{x.prefix}</span><span>{x.input}</span><span>{x.output}</span></div>)}</div>}

function PrefixBehavior({scenario}:{scenario:Scenario|ModelWorkloadInput}){const initial=scenario.evolution[0];const trim=scenario.evolution.find(x=>x.type==='trim');return <><div className="prefix-model-params"><span><small>共享前缀请求占比</small><b>{scenario.reuse}%</b></span><span><small>平均会话轮数</small><b>{scenario.turns} 轮</b></span><span><small>每轮上下文净增</small><b>+{scenario.prefixGrowth.toLocaleString()} Token</b></span></div><div className="prefix-behavior-body"><div><div className="composition-title"><span>Prefix 来源构成</span><small>用于生成共享前缀类型</small></div><div className="prefix-composition">{scenario.prefixItems.map((x,i)=><i key={x.label} style={{width:`${x.value}%`}} className={`source-${i+1}`}/>)}</div><div className="composition-legend">{scenario.prefixItems.map((x,i)=><span key={x.label}><i className={`source-${i+1}`}/><b>{x.label}</b><small>{x.value}%</small></span>)}</div></div><div><div className="evolution-caption"><span>会话增长模板</span><small>多轮上下文演进</small></div><div className="growth-template"><span><small>初始 Prefix</small><b>{initial.tokens}</b></span><i>→</i><span><small>常规轮增</small><b>+{scenario.prefixGrowth.toLocaleString()} Token / 轮</b></span><i>→</i><span><small>关键变化</small><b>{scenario.evolutionBurst}{trim?` · 压缩 ${trim.tokens}`:''}</b></span></div></div></div></>}

function IntegratedResourceTopology({scenario}:{scenario:Scenario}){
  const topology=scenario.networkTopology
  const cfg=topology.configuration
  const [nodesA,nodesB]=getClusterNodes(scenario)
  const [ddrA,ddrB]=splitByCluster(scenario,scenario.ddrTB)
  const [ssdA,ssdB]=splitByCluster(scenario,scenario.localSsdTB)
  const leafA=topology.devices.filter(device=>device.type==='leaf'&&device.clusterId==='cluster-a').length
  const leafB=topology.devices.filter(device=>device.type==='leaf'&&device.clusterId==='cluster-b').length
  const formatLocalCapacity=(total:number,nodes:number)=>{const value=total/nodes;return value>=1?`${Number(value.toFixed(1))} TB/N`:`${Math.round(value*1024)} GB/N`}
  const serverGroups=[
    {x:42,label:'SERVER A001',count:1,kind:'standard' as const,ddr:formatLocalCapacity(ddrA,nodesA),ssd:formatLocalCapacity(ssdA,nodesA)},
    {x:272,label:`SERVER A${String(nodesA).padStart(3,'0')}`,count:1,kind:'standard' as const,ddr:formatLocalCapacity(ddrA,nodesA),ssd:formatLocalCapacity(ssdA,nodesA)},
    {x:622,label:'SERVER B001',count:1,kind:'supernode' as const,ddr:formatLocalCapacity(ddrB,nodesB),ssd:formatLocalCapacity(ssdB,nodesB)},
    {x:852,label:`SERVER B${String(nodesB).padStart(3,'0')}`,count:1,kind:'supernode' as const,ddr:formatLocalCapacity(ddrB,nodesB),ssd:formatLocalCapacity(ssdB,nodesB)}
  ]
  const renderServer=(server:typeof serverGroups[number])=><g key={server.x} className={`server-node ${server.kind}`}>
    <rect className="server-shell" x={server.x} y="202" width="206" height="286" rx="7"/>
    <text className="server-title" x={server.x+12} y="222">{server.label}</text>
    <g className="accelerator-row">{Array.from({length:cfg.acceleratorsPerNode},(_,index)=><rect key={index} x={server.x+12+index*23} y="236" width="18" height="22" rx="2"/>)}</g>
    <text className="accelerator-label" x={server.x+103} y="251">NPU × {cfg.acceleratorsPerNode}</text>
    <rect className="hbm-local" x={server.x+12} y="264" width="182" height="20" rx="3"/><text className="hbm-label" x={server.x+103} y="278">HBM · 64 GB / NPU · LOCAL</text>
    <path className="hccs-bus" d={`M${server.x+20} 294H${server.x+186}`}/><text className="hccs-label" x={server.x+103} y="306">HCCS · {cfg.hccsBandwidthGBs} GB/s</text>
    <path className="pcie-link" d={`M${server.x+103} 310V329`}/><text className="pcie-label" x={server.x+113} y="322">{cfg.hostBus}</text>
    <rect className="host-memory" x={server.x+12} y="329" width="112" height="52" rx="4"/><text x={server.x+22} y="348">CPU / NUMA</text><text className="sub" x={server.x+22} y="367">DDR · {server.ddr}</text>
    <rect className="local-nvme" x={server.x+132} y="329" width="62" height="52" rx="4"/><text x={server.x+163} y="348" textAnchor="middle">LOCAL</text><text className="sub" x={server.x+163} y="367" textAnchor="middle">SSD {server.ssd}</text>
    <path className="pcie-fanout" d={`M${server.x+103} 329H${server.x+163}M${server.x+68} 381V398M${server.x+163} 381V398`}/>
    <rect className="nic-block" x={server.x+12} y="398" width="182" height="42" rx="4"/><text x={server.x+22} y="416">ROCE NIC · SINGLE RAIL</text><text className="sub" x={server.x+22} y="431">{cfg.nicBandwidthGbps} Gbps · NUMA / PCIe AFFINITY</text>
    <rect className="node-storage-note" x={server.x+12} y="448" width="182" height="25" rx="3"/><text x={server.x+103} y="464">{cfg.localStorageProtocol} · {cfg.localStorageBandwidthGBs} GB/s</text>
  </g>

  return <div className="node-network-topology physical">
    <svg viewBox="0 0 1120 675" role="img" aria-label="服务器内部 HCCS HBM DDR NIC 本地 SSD 以及跨节点 RDMA Leaf Spine 和远端存储的物理拓扑">
      <g className="physical-cluster-shells"><rect x="18" y="92" width="502" height="468" rx="9"/><rect x="600" y="92" width="502" height="468" rx="9"/><text x="36" y="114">CLUSTER A · {nodesA} SERVERS · 2 SERVER / 2 LEAF SHOWN</text><text x="1084" y="114" textAnchor="end">CLUSTER B · {nodesB} SERVERS · 2 SERVER / 2 LEAF SHOWN</text></g>
      <g className="fabric-spines"><rect x="374" y="28" width="150" height="31" rx="5"/><rect x="596" y="28" width="150" height="31" rx="5"/><text x="449" y="47">SPINE 01</text><text x="671" y="47">SPINE 02</text><text className="fabric-title plane-a" x="560" y="16">HUAWEI SINGLE-RAIL FABRIC</text></g>
      <g className="leaf-spine-links"><path className="plane-a" d="M145 143C145 80 449 80 449 59M145 143C145 80 671 80 671 59M375 143C375 80 449 80 449 59M375 143C375 80 671 80 671 59M725 143C725 80 449 80 449 59M725 143C725 80 671 80 671 59M955 143C955 80 449 80 449 59M955 143C955 80 671 80 671 59"/></g>
      <g className="leaf-switches"><rect className="plane-a" x="88" y="128" width="114" height="31" rx="5"/><rect className="plane-a" x="318" y="128" width="114" height="31" rx="5"/><rect className="plane-a" x="668" y="128" width="114" height="31" rx="5"/><rect className="plane-a" x="898" y="128" width="114" height="31" rx="5"/><text x="145" y="147">LEAF A01</text><text x="375" y="147">LEAF A{String(leafA).padStart(2,'0')}</text><text x="725" y="147">LEAF B01</text><text x="955" y="147">LEAF B{String(leafB).padStart(2,'0')}</text><g className="topology-ellipsis"><circle cx="252" cy="143" r="2"/><circle cx="260" cy="143" r="2"/><circle cx="268" cy="143" r="2"/><circle cx="832" cy="143" r="2"/><circle cx="840" cy="143" r="2"/><circle cx="848" cy="143" r="2"/></g></g>
      <g className="rdma-node-links"><path className="plane-a" d="M145 398V159M375 398V159M725 398V159M955 398V159"/><text x="260" y="188">NIC → LEAF · {cfg.nicProtocol} · {cfg.nicBandwidthGbps} Gbps · SINGLE RAIL</text><text x="840" y="188">NIC → LEAF · {cfg.nicProtocol} · {cfg.nicBandwidthGbps} Gbps · SINGLE RAIL</text></g>
      <g className="remote-storage-links"><path d="M449 59V76H560V605M671 59V76H560"/><text x="560" y="582">{cfg.remoteStorageProtocol} · {cfg.remoteStorageBandwidthGBs} GB/s</text></g>
      {serverGroups.map(renderServer)}
      <g className="server-ellipsis"><circle cx="252" cy="350" r="2"/><circle cx="260" cy="350" r="2"/><circle cx="268" cy="350" r="2"/><circle cx="832" cy="350" r="2"/><circle cx="840" cy="350" r="2"/><circle cx="848" cy="350" r="2"/></g>
      <g className="remote-storage"><rect x="465" y="605" width="190" height="52" rx="7"/><text x="560" y="627">REMOTE SSD / KV STORE</text><text className="sub" x="560" y="645">{scenario.remoteSsdTB} TB · FABRIC ATTACHED</text></g>
    </svg>
    <div className="physical-legend"><span><i className="plane-a"/>单轨 RoCE/RDMA 网络</span><span><i className="hccs"/>HCCS 仅位于服务器节点内部</span><span><i className="rail"/>NIC 外部端口接入 Leaf 交换机</span><span><i className="rail"/>本地 NVMe SSD 位于服务器内</span></div>
  </div>
}

const getKvResourceStack=(s:Scenario)=>s.framework.startsWith('vLLM')?'LMCache + Mooncake Store':'Native KV Manager + Mooncake Store'

const getDecisionCategories=(s:Scenario)=>{
  const kvStack=getKvResourceStack(s)
  return [
  {group:'服务控制层',name:'服务级调度',icon:'network',items:'请求准入 · 实例路由 · P-D Pairing',search:'实例路由 / P-D Pairing / 准入策略',evaluate:'服务排队 · 缓存命中 · SLO',value:'Load-aware · Cache-aware Routing',detail:'Affinity · P-D Pairing · Admission Control'},
  {group:'推理执行层',name:'推理引擎调度',icon:'activity',items:'Batch Size · Chunk Size · 实例内调度',search:'Batch / Chunk / 调度策略组合',evaluate:'排队时延 · 设备利用率',value:'Continuous Batching',detail:`max_seqs ${Math.round(s.maxConcurrency/s.nodes)} · Chunk 4K`},
  {group:'推理执行层',name:'并行策略',icon:'layers',items:'TP · DP · EP · PP',search:'TP / DP / EP / PP 组合',evaluate:'计算效率 · 通信开销',value:'TP 8 · DP 4 · EP 8',detail:'PP 1 · P/D 独立配置'},
  {group:'推理执行层',name:'KV 复用与缓存策略',icon:'cube',items:'Prefix Cache · 准入 · 淘汰 · Prefetch',search:'复用 / 准入 / 淘汰 / 预取组合',evaluate:'前缀复用收益 · 回源开销',value:'Prefix Cache · Adaptive Prefetch',detail:'Cache Admission · Cost-aware LRU'},
  {group:'资源布局层',name:'部署拓扑与资源亲和',icon:'chip',items:'实例数量 · P/D 配比 · 拓扑亲和',search:'P/D 配比 / 实例放置 / NUMA-NIC 亲和',evaluate:'跨节点开销 · 负载均衡 · 通信局部性',value:`P-D 分离 · ${s.prefillNodes}:${s.decodeNodes}`,detail:`${s.prefillNodes}P / ${s.decodeNodes}D 节点 · Topology-aware Pairing`},
  {group:'资源布局层',name:'KV 资源池与分层放置',icon:'database',items:'管理组件 · 池化范围 · 分层放置 · 迁移',search:'LMCache / HiCache / Mooncake 与池化方案',evaluate:'容量成本 · 复用收益 · 搬运开销',value:'分层全局 KV 资源池',detail:`${kvStack} · HBM ↔ DDR ↔ SSD`},
  {group:'数据移动层',name:'数据流编排',icon:'network',items:'Backend · Slice · Link · Priority',search:'Backend / Slice / Link / Priority',evaluate:'链路竞争 · 传输时延',value:'RDMA · Single Rail · Priority',detail:'Server NIC → Leaf → Spine'},
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

function Workload({scenarioKey}:{scenarioKey:ScenarioKey}){const s=scenarios[scenarioKey];const option=useMemo(()=>({grid:{left:36,right:14,top:24,bottom:26},tooltip:{trigger:'axis',backgroundColor:'#13243a',borderColor:'#263d59',textStyle:{color:'#d9e7f7'}},xAxis:{type:'category',data:s.load.map((_,i)=>`${String(i).padStart(2,'0')}:00`),axisLabel:{color:'#60758d',interval:3,fontSize:10},axisLine:{lineStyle:{color:'#24364c'}},axisTick:{show:false}},yAxis:{type:'value',max:100,axisLabel:{formatter:'{value}%',color:'#60758d',fontSize:10},splitLine:{lineStyle:{color:'#182a3e'}}},series:[{type:'line',data:s.load,smooth:.35,symbol:'none',lineStyle:{width:2,color:'#38bdf8'},areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(56,189,248,.38)'},{offset:1,color:'rgba(56,189,248,.02)'}]}},markPoint:{symbolSize:38,data:[{type:'max',name:'峰值'}],label:{color:'#07111f',fontSize:9}}}]}),[s]);return <div className="page"><PageTitle eyebrow="INPUT / 03" title="Agent 业务负载特征" desc="按请求规模、前缀共享和前缀演化三类特征还原具体业务请求形态。" badge={s.name}/><div className="metric-grid"><MiniMetric label="请求峰值" value={s.peak.toLocaleString()} unit="req/s"/><MiniMetric label="平均请求" value={s.average.toLocaleString()} unit="req/s"/><MiniMetric label="Input Token" value={s.inputTokens} unit="M tps"/><MiniMetric label="Output Token" value={s.outputTokens} unit="M tps"/><MiniMetric label="会话轮数" value={s.turns} unit="avg"/><MiniMetric label="工具调用" value={s.toolCalls} unit="/ task"/></div><div className="grid workload-grid"><Card title="请求规模特征" subtitle="24H REQUEST PROFILE" icon="activity"><div className="chart-toolbar"><span className="active">Request</span><span>Input Token</span><span>Output Token</span><span>并发会话</span></div><ReactECharts option={option} style={{height:238}}/></Card><Card title="前缀共享特征" subtitle={`REUSE RATE ${s.reuse}%`} icon="layers"><div className="prefix-bars">{s.prefixItems.map(x=><div key={x.label}><div><b>{x.label}</b><small>{x.meta}</small><strong>{x.value}%</strong></div><span><i style={{width:`${x.value}%`}}/></span></div>)}</div></Card></div><Card title="前缀演化特征" subtitle={`AVERAGE GROWTH +${s.prefixGrowth.toLocaleString()} TOKEN / TURN`} icon="network"><div className="timeline">{s.evolution.map((x,i)=><div key={x.round} className={x.type}><span>{x.round}</span><i/><b>{x.action}</b><small>{x.tokens}</small>{i<s.evolution.length-1&&<em/>}</div>)}</div></Card></div>}

function Objectives({scenarioKey}:{scenarioKey:ScenarioKey}){const s=scenarios[scenarioKey];return <div className="page"><PageTitle eyebrow="INPUT / 04" title="目标与约束" desc="定义方案必须满足的服务性能目标与资源边界。" badge="7 项约束已启用"/><div className="grid objective-grid"><Card title="服务性能目标" subtitle="SERVICE LEVEL OBJECTIVE" icon="target"><div className="objective-table"><Objective label="TTFT P95" value={`${s.ttftTarget}`} unit="ms"/><Objective label="TPOT P95" value={`${s.tpotTarget}`} unit="ms"/><Objective label="目标吞吐" value={formatThroughput(s.throughputTarget)} unit="M tps"/><Objective label="最大 QPS" value={s.maxQps.toLocaleString()} unit="req/s"/><Objective label="目标并发" value={s.maxConcurrency.toLocaleString()} unit="sessions"/></div></Card><Card title="资源与成本约束" subtitle="CAPACITY GUARDRAILS" icon="sliders"><div className="objective-table"><Objective label="设备数量上限" value={`${s.gpuCount}`} unit="Cards"/><Objective label="峰值功耗上限" value={`${Math.round(s.gpuCount*1.05)}`} unit="kW"/><Objective label="年度成本上限" value={`${(s.gpuCount/768*1.2).toFixed(2)}`} unit="亿元"/><div className="constraint-health"><Icon name="check"/><div><b>约束可行性检查通过</b><small>当前资源池存在 46 个可行候选方案</small></div></div></div></Card></div></div>}

function Tunables(){const [cat,setCat]=useState('服务级调度');const cats=['服务级调度','推理引擎调度','并行策略','KV 复用与缓存策略','部署拓扑与资源亲和','KV 资源池与分层放置','数据流编排'];return <div className="page"><PageTitle eyebrow="TUNABLES / 05" title="参数搜索空间" desc="配置四大类、七个全局参数维度的候选范围。" badge="4 GROUPS · 7 DIMENSIONS"/><div className="tunable-layout"><div className="category-list">{cats.map((x,i)=><button className={cat===x?'active':''} onClick={()=>setCat(x)} key={x}><span>0{i+1}</span>{x}<Icon name="arrow" size={14}/></button>)}</div><div><Card title={cat} subtitle="SEARCH RANGE" icon="sliders"><TunableContent cat={cat}/></Card></div></div></div>}

function TunableContent({cat}:{cat:string}){const rows:Record<string,[string,string,string][]>={'服务级调度':[['实例选择','Load-aware','RR / Affinity / Load-aware'],['P-D Pairing','Topology-aware','Static / Load / Topology-aware'],['Admission Control','Enabled','On / Off'],['请求优先级','SLO-aware','FIFO / SLO-aware']],'推理引擎调度':[['max_num_seqs','128','64 — 512'],['max_num_batched_tokens','16,384','8K — 64K'],['实例内调度','Continuous Batching','Continuous / Priority'],['Chunked Prefill','Enabled · 4K','2K — 16K']],并行策略:[['Tensor Parallel','8','4 — 16'],['Data Parallel','4','2 — 16'],['Pipeline Parallel','1','1 — 4'],['Expert Parallel','8','4 — 16']],'KV 复用与缓存策略':[['Prefix Cache','Enabled','On / Off'],['缓存准入','Reuse-aware','All / Reuse-aware'],['淘汰策略','Cost-aware LRU','LRU / LFU / Cost-aware'],['Prefetch','Adaptive','Off / Static / Adaptive']],'部署拓扑与资源亲和':[['部署模式','P-D 分离','共享池 / P-D 分离'],['Prefill 节点','64','32 — 128'],['Decode 节点','32','16 — 96'],['实例放置','Topology-aware','Local / Topology-aware']],'KV 资源池与分层放置':[['KV 管理组件','LMCache','Native / LMCache / HiCache'],['池化范围','Global','Local / Cluster / Global'],['分布式存储','Mooncake Store','Local / Mooncake / 3FS'],['分层放置迁移','HBM ↔ DDR ↔ SSD','2-tier / 3-tier / Global']],'数据流编排':[['Transfer Backend','RDMA Direct','RDMA / NVMe-oF'],['Slice 粒度','Adaptive','Static / Adaptive'],['节点上联','Single Rail','Fixed by input topology'],['传输优先级','SLO-aware','FIFO / SLO-aware']]};return <div className="tunable-table"><div className="tunable-head"><span>参数</span><span>当前值</span><span>寻优范围</span></div>{rows[cat].map(r=><div key={r[0]}><b>{r[0]}</b><span>{r[1]}</span><small>{r[2]}</small></div>)}</div>}

function Results({stage,progress,scenarioKey,hideTopology=false,agentPlan=false}:{stage:Stage;progress:number;scenarioKey:ScenarioKey;hideTopology?:boolean;agentPlan?:boolean}){const s=scenarios[scenarioKey];if(stage!=='COMPLETED')return <div className="page result-loading"><PageTitle eyebrow="SIMULATION / PLANNING" title="算存网一体化规划寻优" desc="正在评估服务控制、推理执行、资源布局与数据移动四大类七维决策空间。" badge={stageText[stage]}/><div className="optimizer"><div className="optimizer-orbit"><span>{progress}<small>%</small></span><i/><i/><i/></div><h2>{stage==='IDLE'?'等待启动仿真规划':stageText[stage]}</h2><p>{stage==='IDLE'?'确认输入与可调参数后，点击左侧“开始仿真规划”。':'基于当前 Agent 负载与 SLO 约束评估可行规划方案'}</p><div className="progress"><i style={{width:`${progress}%`}}/></div><div className="search-stats"><MiniMetric label="候选方案" value={Math.round(512*progress/100)} unit="/ 512"/><MiniMetric label="已评估" value={Math.round(286*progress/100)} unit="组"/><MiniMetric label="满足 SLO" value={Math.round(58*progress/100)} unit="组"/><MiniMetric label="当前最优" value={progress<35?'—':`#${Math.max(1,Math.round(183*progress/100))}`} unit="Solution"/></div><div className="stage-flow">{stages.map(x=><div key={x} className={`${stages.indexOf(x)<stages.indexOf(stage)?'done':''} ${x===stage?'active':''}`}><i>{stages.indexOf(x)<stages.indexOf(stage)?<Icon name="check" size={14}/>:stages.indexOf(x)+1}</i><span>{stageText[x]}</span></div>)}</div></div></div>;
const sloGroups=agentPlan?
  [{title:'共享模型服务 · Agent 01 + 03',detail:'TTFT P95 ≤ 600 ms · TPOT P95 ≤ 45 ms · 吞吐 ≥ 4.2M tps'},{title:'独立模型服务 · Agent 02',detail:'TTFT P95 ≤ 1,800 ms · TPOT P95 ≤ 55 ms · 吞吐 ≥ 5.2M tps'}]:
  [{title:`${s.name} · 服务 SLO`,detail:`TTFT P95 ≤ ${s.ttftTarget} ms · TPOT P95 ≤ ${s.tpotTarget} ms · 吞吐 ≥ ${formatThroughput(s.throughputTarget)}M tps`}];
return <div className="page result-page"><div className="result-hero cost-optimal-hero"><div className="cost-optimal-copy"><span className="success-label"><Icon name="check" size={14}/>COST-OPTIMAL PLAN</span><h2>{agentPlan?'满足全部 Agent SLO 的成本最优方案':'满足 SLO 的成本最优方案'}</h2><p>{agentPlan?'在两类模型服务均满足所承载 Agent SLO 与资源约束的可行方案中，选择资源成本最低的部署组合。':'在满足服务 SLO 与资源约束的可行方案中，选择资源成本最低的部署组合。'}</p></div><div className={`result-slo-constraints ${sloGroups.length===1?'single':''}`}>{sloGroups.map(group=><div key={group.title}><small>{group.title}</small><b>{group.detail}</b></div>)}</div><span className="pass-pill cost-optimal-pill">ALL SLO PASS · MIN COST</span></div><div className="result-flow"><section className="result-section"><ResultSectionHead index="01" eyebrow="RECOMMENDED PLAN" title="推荐规划方案" desc="明确实例部署、调度路由、KV 资源池和网络数据流配置。"/><Plan s={s} hideTopology={hideTopology} agentPlan={agentPlan}/></section><section className="result-section"><ResultSectionHead index="02" eyebrow="PERFORMANCE VALIDATION" title="方案性能表现" desc="验证服务性能目标，并给出各类资源利用率和运行余量。"/><Performance s={s}/></section><section className="result-section"><ResultSectionHead index="03" eyebrow="PRODUCTION RESILIENCE" title="生产韧性增强方案" desc="在当前成本最优解已满足 SLO 的基础上，评估生产扰动风险，并给出闭合风险缺口的最小增量方案。"/><Bottleneck s={s}/></section></div></div>}

function ResultSectionHead({index,eyebrow,title,desc}:{index:string;eyebrow:string;title:string;desc:string}){return <div className="result-section-head"><span>{index}</span><div><small>{eyebrow}</small><h2>{title}</h2><p>{desc}</p></div></div>}

type DeploymentUnit={kind:'prefill'|'decode';nodes:number;instances:number}
type DeploymentZone={model:string;modelLabel:string;role:string;units:DeploymentUnit[];side:'standard'|'super';hot?:boolean}
const getDeploymentZones=(s:Scenario):DeploymentZone[]=>{
  if(s.key==='coding')return [
    {model:'Qwen3-32B',modelLabel:'MODEL A',role:'LOCAL P/D CELL',units:[{kind:'prefill',nodes:16,instances:8},{kind:'decode',nodes:8,instances:4}],side:'standard'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'EDGE P/D CELL',units:[{kind:'prefill',nodes:8,instances:4},{kind:'decode',nodes:8,instances:4}],side:'standard'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'MAIN PREFILL',units:[{kind:'prefill',nodes:40,instances:20}],side:'super'},
    {model:'DeepSeek-Coder-V2',modelLabel:'MODEL B',role:'MAIN DECODE',units:[{kind:'decode',nodes:32,instances:16}],side:'super',hot:true}
  ]
  const model=getModelInputs(s)[0].model
  const [standardNodes]=getClusterNodes(s)
  const standardPrefill=Math.round(s.prefillNodes*standardNodes/s.nodes)
  const superPrefill=s.prefillNodes-standardPrefill
  const standardDecode=Math.round(s.decodeNodes*standardNodes/s.nodes)
  const superDecode=s.decodeNodes-standardDecode
  return [
    {model,modelLabel:'MODEL',role:'PREFILL',units:[{kind:'prefill',nodes:standardPrefill,instances:standardPrefill/s.nodesPerInstance}],side:'standard'},
    {model,modelLabel:'MODEL',role:'DECODE',units:[{kind:'decode',nodes:standardDecode,instances:standardDecode/s.nodesPerInstance}],side:'standard'},
    {model,modelLabel:'MODEL',role:'PREFILL',units:[{kind:'prefill',nodes:superPrefill,instances:superPrefill/s.nodesPerInstance}],side:'super'},
    {model,modelLabel:'MODEL',role:'DECODE',units:[{kind:'decode',nodes:superDecode,instances:superDecode/s.nodesPerInstance}],side:'super'}
  ]
}

const getModelDeploymentSummary=(s:Scenario)=>s.key==='coding'
  ? [{label:'模型 A · Cluster A',model:'Qwen3-32B',prefillNodes:16,decodeNodes:8,prefillInstances:8,decodeInstances:4,nodes:24,affinity:'普通节点域独立 P/D 单元'},{label:'模型 B · Cross-Cluster',model:'DeepSeek-Coder-V2',prefillNodes:48,decodeNodes:40,prefillInstances:24,decodeInstances:20,nodes:88,affinity:'Cluster A 溢出 16 + Cluster B 主池 72'}]
  : [{label:'模型',model:getModelInputs(s)[0].model,prefillNodes:s.prefillNodes,decodeNodes:s.decodeNodes,prefillInstances:s.prefillInstances,decodeInstances:s.decodeInstances,nodes:s.prefillNodes+s.decodeNodes,affinity:'每个集群内 P/D 就近配对'}]

function Plan({s,hideTopology=false,agentPlan=false}:{s:(typeof scenarios)[ScenarioKey];hideTopology?:boolean;agentPlan?:boolean}){
  const prefillCards=s.prefillNodes*8
  const decodeCards=s.decodeNodes*8
  const prefillPct=Math.round(s.prefillNodes/(s.prefillNodes+s.decodeNodes)*100)
  const kvStack=getKvResourceStack(s)
  const modelDeployments=agentPlan?[{label:'共享模型 · Agent 01 + Agent 03',model:'Qwen3-32B',prefillNodes:24,decodeNodes:16,prefillInstances:12,decodeInstances:8,nodes:40,affinity:'双 Agent 共享模型服务与 Prefix Cache'},{label:'独立模型 · Agent 02',model:'DeepSeek-V3',prefillNodes:40,decodeNodes:32,prefillInstances:20,decodeInstances:16,nodes:72,affinity:'长上下文实例池 · 集群内 P/D 配对'}]:getModelDeploymentSummary(s)
  const enginePlans=agentPlan?[
    {model:'Qwen3-32B',scope:'共享服务 · Agent 01 + 03',tone:'qwen',prefill:'TP 8 · DP 6 · PP 1',decode:'TP 8 · DP 4 · PP 1',scheduler:[['max_num_seqs','128'],['max_num_batched_tokens','16,384'],['max_model_len','32,768'],['chunked_prefill','ON · 4,096']]},
    {model:'DeepSeek-V3',scope:'独立服务 · Agent 02',tone:'deepseek',prefill:'TP 16 · DP 5 · EP ON',decode:'TP 16 · DP 4 · EP ON',scheduler:[['max_num_seqs','72'],['max_num_batched_tokens','32,768'],['max_model_len','65,536'],['chunked_prefill','ON · 8,192']]}
  ]:[{model:getModelInputs(s)[0].model,scope:s.name,tone:'qwen',prefill:'TP 8 · DP 4 · PP 1',decode:'TP 8 · DP 4 · PP 1',scheduler:[['max_num_seqs',`${Math.round(s.maxConcurrency/s.nodes)}`],['max_num_batched_tokens','16,384'],['max_model_len','32,768'],['chunked_prefill','ON · 4,096']]}]
  const kvModelPlans=agentPlan?[
    {model:'Qwen3-32B',scope:'Agent 01 + 03 · 高 Prefix 复用',tone:'qwen',stack:'LMCache · Prefix Cache · Cost-aware LRU',tiers:[['HBM','16.0'],['DDR','54.0'],['Local SSD','62.0'],['Remote SSD','84.0']]},
    {model:'DeepSeek-V3',scope:'Agent 02 · 长上下文推理',tone:'deepseek',stack:'LMCache · Mooncake Store · Adaptive Prefetch',tiers:[['HBM','28.0'],['DDR','111.0'],['Local SSD','128.0'],['Remote SSD','176.0']]}
  ]:[{model:getModelInputs(s)[0].model,scope:s.name,tone:'qwen',stack:`${kvStack} · Adaptive Prefetch`,tiers:[['HBM',s.hbmDemandTB.toFixed(1)],['DDR',s.ddrDemandTB.toFixed(1)],['Local SSD',s.localSsdDemandTB.toFixed(1)],['Remote SSD',s.remoteSsdDemandTB.toFixed(1)]]}]
  return <div className="results-grid">
    <Card title="计算资源与 P/D 部署" subtitle="MODEL · NODE · INSTANCE PLANNING" icon="chip"><div className="plan-primary"><span><small>Prefill 节点</small><b>{s.prefillNodes}</b><i>{s.prefillInstances} 实例组 · {prefillCards} 卡</i></span><span><small>Decode 节点</small><b>{s.decodeNodes}</b><i>{s.decodeInstances} 实例组 · {decodeCards} 卡</i></span><span><small>单实例组</small><b>{s.nodesPerInstance}</b><i>节点/组 · 每节点 8 卡</i></span></div><div className="model-deployment-summary">{modelDeployments.map(x=><div key={x.model}><span><small>{x.label}</small><b>{x.model}</b></span><div className="model-pd-count"><i className="prefill"><small>P 实例</small><b>{x.prefillInstances}</b><em>{x.prefillNodes} 节点</em></i><i className="decode"><small>D 实例</small><b>{x.decodeInstances}</b><em>{x.decodeNodes} 节点</em></i></div><strong>{x.nodes}<small>部署节点</small></strong><em>{x.affinity}</em></div>)}</div><div className="pd-allocation"><div><span>Prefill <b>{prefillPct}%</b></span><span>Decode <b>{100-prefillPct}%</b></span></div><i><b style={{width:`${prefillPct}%`}}/><b style={{width:`${100-prefillPct}%`}}/></i></div><div className="instance-note">共 {s.nodes} 节点 / {s.gpuCount} 卡{s.reservedNodes>0?` · ${s.prefillNodes+s.decodeNodes} 节点部署 + ${s.reservedNodes} 节点余量（每集群 1 节点）`:''}；所有实例组均按 {s.nodesPerInstance} 节点/组折算。</div></Card>
    <Card title="服务调度与引擎执行" subtitle="VLLM SCHEDULER / PARALLEL CONFIG" icon="sliders"><div className="engine-compare-flat">{enginePlans.map(plan=><section key={plan.model} className={plan.tone}><header><div><b>{plan.model}</b><small>{plan.scope}</small></div><em>vLLM</em></header><div className="engine-pd-lines"><p><span>Prefill</span><b>{plan.prefill}</b></p><p><span>Decode</span><b>{plan.decode}</b></p></div><div className="engine-flat-params">{plan.scheduler.map(([key,value])=><p key={key}><code>{key}</code><strong>{value}</strong></p>)}</div></section>)}</div></Card>
    <div className="plan-wide"><Card title="KV 资源池与分层放置规划" subtitle="MODEL-SPECIFIC KV SIZING / GLOBAL TOTAL" icon="database"><div className="kv-model-plan-grid">{kvModelPlans.map(plan=><section key={plan.model} className={`kv-model-plan ${plan.tone}`}><header><div><small>{plan.scope}</small><b>{plan.model}</b></div><em>{plan.stack}</em></header><div className="kv-model-tiers">{plan.tiers.map(([tier,value])=><span key={tier}><small>{tier}</small><b>{value}<i> TB</i></b></span>)}</div></section>)}</div><div className="kv-total-plan"><div><small>GLOBAL KV CAPACITY PLAN</small><b>全局 KV 分层规划总量</b><span>两类模型的峰值 KV 需求合并后，按各层实际规划容量汇总。</span></div><div className="capacity-plan-grid"><CapacityPlan label="HBM Pool" demand={s.hbmDemandTB} scope="模型常驻、运行时与热 KV"/><CapacityPlan label="DDR Pool" demand={s.ddrDemandTB} scope="Warm KV · 跨节点共享"/><CapacityPlan label="Local SSD Pool" demand={s.localSsdDemandTB} scope="集群内冷 KV 与回源"/><CapacityPlan label="Remote SSD Pool" demand={s.remoteSsdDemandTB} scope="跨集群长尾 KV"/></div></div><div className="sizing-note"><Icon name="activity" size={14}/><span>规划口径：模型常驻与运行时占用 + 峰值并发 KV + 分层承接量；以上数值即本方案需要配置的容量。</span></div></Card></div>
    {!hideTopology&&<div className="plan-wide"><Card title="模型与资源部署拓扑" subtitle="MODEL / P-D PLACEMENT · HBM / DDR / SSD · DATA FLOW" icon="network"><PlanningNetworkTopology scenario={s}/></Card></div>}
  </div>
}

function CapacityPlan({label,demand,scope}:{label:string;demand:number;scope:string}){return <div className="capacity-plan planned-demand"><div><small>{label}</small><b>{demand.toFixed(1)} <i>TB</i></b><span>PLANNED CAPACITY</span></div><p>{scope}</p></div>}

function PlanningNetworkTopology({scenario:s}:{scenario:Scenario}){
  const profile=bottleneckProfiles[s.key]
  const bottleneck=profile.active.toLowerCase()
  const zones=getDeploymentZones(s)
  const positions=[42,278,624,860]
  const primaryFlow=s.key==='coding'?'Model A 规划 → Model B 执行':s.key==='rag'?'Prefix KV / P-D Handoff':'Long KV / Tier Migration'
  const placement=s.key==='coding'?'模型分区 · 集群内 P/D 单元':'双集群部署 · 集群内 P/D 配对'
  const [standardNodes,superNodes]=getClusterNodes(s)
  const deployedBySide=(side:'standard'|'super')=>zones.filter(zone=>zone.side===side).reduce((sum,zone)=>sum+zone.units.reduce((n,unit)=>n+unit.nodes,0),0)
  const standardReserved=standardNodes-deployedBySide('standard'),superReserved=superNodes-deployedBySide('super')
  const hbmDemand:[number,number]=s.key==='coding'?[15,29]:splitByCluster(s,s.hbmDemandTB)
  const ddrDemand=splitByCluster(s,s.ddrDemandTB),ddrCapacity=splitByCluster(s,s.ddrTB)
  const ssdDemand=splitByCluster(s,s.localSsdDemandTB),ssdCapacity=splitByCluster(s,s.localSsdTB)
  const network=s.networkTopology.configuration
  return <div className="planning-topology server-deployment-topology"><div className="orchestration-summary"><span><small>模型数据流</small><b>{primaryFlow}</b></span><span><small>实例放置</small><b>{placement}</b></span><span><small>跨节点承载</small><b>{network.nicBandwidthGbps} Gbps · Single Rail · {network.nicProtocol}</b></span></div><svg viewBox="0 0 1120 510" role="img" aria-label="服务器内模型实例、计算、内存、网卡和存储的实际部署拓扑">
    <g className="deployment-clusters"><rect x="18" y="18" width="502" height="405" rx="9"/><rect x="600" y="18" width="502" height="405" rx="9"/><text x="40" y="42">CLUSTER A · STANDARD · {standardNodes} NODES{standardReserved>0?` · ${standardReserved} RESERVED`:''}</text><text x="622" y="42">CLUSTER B · SUPERNODE · {superNodes} NODES{superReserved>0?` · ${superReserved} RESERVED`:''}</text></g>
    <g className="server-data-links">{zones.map((_,i)=><g key={i}><path d={`M${positions[i]+151} 190V212`}/><path d={`M${positions[i]+74} 280V292`}/><path d={`M${positions[i]+151} 280V292`}/></g>)}</g>
    <g className="deployment-servers">{zones.map((zone,i)=>{const x=positions[i],clusterIndex=zone.side==='standard'?0:1,clusterNodes=clusterIndex===0?standardNodes:superNodes,clusterDeployed=Math.max(1,deployedBySide(zone.side)),zoneNodes=zone.units.reduce((sum,unit)=>sum+unit.nodes,0),share=zoneNodes/clusterDeployed,hbmUsed=hbmDemand[clusterIndex]*share,hbmCap=zoneNodes*8*64/1024,ddrUsed=ddrDemand[clusterIndex]*share,ddrCap=ddrCapacity[clusterIndex]*zoneNodes/clusterNodes,ssdUsed=ssdDemand[clusterIndex]*share,ssdCap=ssdCapacity[clusterIndex]*zoneNodes/clusterNodes,instanceLabel=zone.units.map(unit=>`${unit.kind==='prefill'?'P':'D'}×${unit.instances}`).join(' / ');return <g className={`deployment-server ${zone.modelLabel==='MODEL B'?'model-b':'model-a'} ${zone.hot?'hot':''}`} key={`${zone.model}-${zone.role}-${i}`}><rect className="server-frame" x={x} y="64" width="218" height="320" rx="7"/><text className="server-role" x={x+12} y="84">{zone.role}</text><text className="server-count" x={x+206} y="84" textAnchor="end">{zoneNodes} NODES</text><text className="server-model" x={x+12} y="101">{zone.modelLabel} · {zone.model}</text><g className="server-compute"><rect x={x+12} y="114" width="194" height="76" rx="5"/><text x={x+22} y="132">{instanceLabel} · NPU × 8 / SERVER</text><rect className="npu-block" x={x+22} y="143" width="76" height="29" rx="3"/><text x={x+60} y="161" textAnchor="middle">P / D INSTANCE</text><rect className={`server-hbm ${bottleneck==='hbm'?'hot-resource':''}`} x={x+110} y="143" width="86" height="29" rx="3"/><text x={x+153} y="155" textAnchor="middle">HBM · HOT KV</text><text className="capacity" x={x+153} y="167" textAnchor="middle">{hbmUsed.toFixed(1)} / {hbmCap.toFixed(1)} TB</text></g><g className="server-hccs"><path d={`M${x+30} 201H${x+188}`}/><circle cx={x+48} cy="201" r="3"/><circle cx={x+94} cy="201" r="3"/><circle cx={x+140} cy="201" r="3"/><circle cx={x+186} cy="201" r="3"/><text x={x+109} y="198" textAnchor="middle">HCCS</text></g><g className="server-host"><rect x={x+12} y="212" width="194" height="68" rx="5"/><text x={x+22} y="229">CPU · NUMA 0</text><rect className="server-ddr" x={x+22} y="239" width="108" height="29" rx="3"/><text x={x+76} y="251" textAnchor="middle">DDR · WARM KV</text><text className="capacity" x={x+76} y="263" textAnchor="middle">{ddrUsed.toFixed(1)} / {ddrCap.toFixed(1)} TB</text><rect className="server-nic" x={x+140} y="239" width="56" height="29" rx="3"/><text x={x+168} y="251" textAnchor="middle">NIC 0</text><text className="capacity" x={x+168} y="263" textAnchor="middle">RDMA</text></g><g className="server-ssd"><rect x={x+12} y="292" width="194" height="42" rx="5"/><text x={x+22} y="309">LOCAL SSD · COLD KV</text><text className="capacity" x={x+196} y="325" textAnchor="end">{ssdUsed.toFixed(1)} / {ssdCap.toFixed(1)} TB</text></g><text className="server-pattern" x={x+109} y="360" textAnchor="middle">SERVER PATTERN × {zoneNodes}</text></g>})}</g>
    <g className="server-ellipsis"><circle cx="269" cy="222" r="2.3"/><circle cx="269" cy="232" r="2.3"/><circle cx="269" cy="242" r="2.3"/><circle cx="851" cy="222" r="2.3"/><circle cx="851" cy="232" r="2.3"/><circle cx="851" cy="242" r="2.3"/></g>
    <g className="deployment-rdma">{s.key==='coding'?<><path d="M210 268V405H792V268"/><text x="501" y="401">MODEL A → MODEL B · CONTEXT / KV · RDMA</text></>:<><path d="M210 268V405H446V268"/><path d="M792 268V405H1028V268"/><text x="328" y="401">P → D · KV RDMA</text><text x="910" y="401">P → D · KV RDMA</text></>}</g>
    <g className="deployment-remote-links"><path d="M151 334V447H470M387 334V431H492M733 334V431H628M969 334V447H650"/></g><g className="plan-remote"><rect x="470" y="431" width="180" height="54" rx="6"/><text x="560" y="452">L3 · REMOTE SSD</text><text x="560" y="470">{s.remoteSsdDemandTB} / {s.remoteSsdTB} TB</text></g>
  </svg><div className="planning-legend">{s.key==='coding'&&<><span><i className="model-a"/>模型 A</span><span><i className="model-b"/>模型 B</span></>}<span><i className="flow"/>RDMA 数据流</span><span><i className="capacity"/>已规划 / 可用容量</span><span><i className="hot"/>橙色 = 峰值窗口 P95 最高资源</span></div></div>
}

function Performance({s}:{s:(typeof scenarios)[ScenarioKey]}){const capacityMultiple=s.maxQps/s.peak;const qpsMargin=Math.round((capacityMultiple-1)*100);const throughputMargin=Math.round((s.throughputResult/s.throughputTarget-1)*100);const e2e=(s.ttftResult/1000+1.9).toFixed(2);return <div className="grid perf-grid performance-organized"><Card title="服务 SLO 验证" subtitle="LATENCY / THROUGHPUT" icon="target"><div className="performance-group-title"><span>时延 SLO</span><small>LATENCY TARGETS</small></div><div className="slo-latency-grid"><SloValidationMetric label="TTFT P95" target={`< ${s.ttftTarget} ms`} result={`${s.ttftResult} ms`} margin={`余量 ${s.ttftTarget-s.ttftResult} ms`}/><SloValidationMetric label="TPOT P95" target={`< ${s.tpotTarget} ms`} result={`${s.tpotResult} ms`} margin={`余量 ${s.tpotTarget-s.tpotResult} ms`}/></div><div className="performance-group-title throughput"><span>吞吐 SLO</span><small>THROUGHPUT TARGET</small></div><div className="slo-throughput-row"><div><small>目标吞吐</small><b>&gt; {s.throughputTarget.toFixed(2)} M tps</b></div><Icon name="arrow" size={14}/><div><small>仿真结果</small><b>{s.throughputResult.toFixed(2)} M tps</b></div><strong>PASS · +{throughputMargin}%</strong></div><div className="slo-summary"><Icon name="check" size={14}/><span><b>全部输入 SLO 约束通过</b><small>TTFT、TPOT 与目标吞吐均满足本次规划要求。</small></span></div></Card><Card title="承载能力与运行效率" subtitle="CAPACITY ENVELOPE / RUNTIME HEALTH" icon="activity"><div className="performance-group-title"><span>业务承载边界</span><small>CAPACITY ENVELOPE</small></div><div className="capacity-boundary"><span><small>业务峰值</small><b>{s.peak.toLocaleString()}</b><em>req/s</em></span><span><small>稳定承载上限</small><b>{s.maxQps.toLocaleString()}</b><em>req/s</em></span><span><small>峰值承载倍数</small><b>{capacityMultiple.toFixed(2)}×</b><em>余量 {qpsMargin}%</em></span><span><small>活跃会话上限</small><b>{s.maxConcurrency.toLocaleString()}</b><em>sessions</em></span></div><div className="performance-group-title runtime"><span>运行效率</span><small>RUNTIME EFFICIENCY</small></div><div className="runtime-efficiency"><span><small>E2E P95</small><b>{e2e}<i>s</i></b></span><span><small>KV 命中率</small><b>{s.kvHitRate.toFixed(1)}<i>%</i></b></span></div></Card></div>}

function SloValidationMetric({label,target,result,margin}:{label:string;target:string;result:string;margin:string}){return <div className="slo-validation-metric"><header><b>{label}</b><i>PASS</i></header><div><span><small>SLO 目标</small><b>{target}</b></span><span><small>仿真结果</small><strong>{result}</strong></span></div><em>{margin}</em></div>}

const bottleneckProfiles={
  rag:{active:'Decode',prefill:62,prefillP95:75,decode:78,decodeP95:91,hbm:70,hbmP95:83,ddr:60,ddrP95:72,fabric:46,fabricP95:58,ssd:48,ssdP95:60,signal:'Decode 峰值窗口 P95 91% · 全场景加权平均 78% · 排队 P95 18 ms',mechanism:'峰值请求上浮或输出长度偏差会首先推高 Decode 排队，并使 TPOT 接近边界',judgement:'只增加 1 个 Decode 节点即可闭合当前扰动场景缺口，其他资源保持观察',secondary:'HBM P95 83% · Fabric P95 58% · 均已低于 85% 保护线',riskMetric:'排队 P95',riskBefore:'18 ms',riskTarget:'≤ 20 ms',riskAfter:'9 ms',stressBefore:'2 / 3',criticalAfter:'82%',actions:[['增加 Decode 算力','2D → 3D · 新增 1 个 Decode 节点','Decode P95 91% → 82%','扰动场景 SLO 2/3 → 3/3'],['扩充 HBM 热 KV 容量','Hot KV 容量 +0.5 TB','HBM P95 83% → 74%','KV 命中 82.5% → 87.0%'],['增加峰值弹性实例','新增 1 个 Decode Burst 实例','排队 P95 18 ms → 9 ms','峰值承载余量提升']]},
  long:{active:'HBM',prefill:72,prefillP95:82,decode:67,decodeP95:78,hbm:86,hbmP95:91,ddr:74,ddrP95:83,fabric:58,fabricP95:70,ssd:69,ssdP95:85,signal:'HBM 峰值窗口 P95 91% · 全场景加权平均 86% · SSD 回源 P95 210 ms',mechanism:'上下文长度或 KV 命中率偏离预测时，热 KV 驻留不足会放大 SSD 回源并推高 TTFT',judgement:'扩充 8 TB HBM 即可覆盖上下文与命中率扰动，SSD 和 Fabric 暂不扩容',secondary:'SSD I/O P95 85% · Fabric P95 70% · 当前处于保护线内',riskMetric:'SSD 回源 P95',riskBefore:'210 ms',riskTarget:'≤ 160 ms',riskAfter:'150 ms',stressBefore:'1 / 3',criticalAfter:'81%',actions:[['扩充 HBM 资源池','64 TB → 72 TB','HBM P95 91% → 81%','扰动场景 SLO 1/3 → 3/3'],['扩充 SSD 回源带宽','16 GB/s → 20 GB/s','SSD I/O P95 85% → 68%','TTFT P95 1460 ms → 1320 ms'],['增加 KV 预取节点','Prefetch Worker +25%','SSD 回源 P95 210 ms → 145 ms','长上下文承载余量提升']]},
  coding:{active:'Decode',prefill:69,prefillP95:80,decode:84,decodeP95:93,hbm:72,hbmP95:82,ddr:66,ddrP95:76,fabric:57,fabricP95:81,ssd:61,ssdP95:72,signal:'Decode 峰值窗口 P95 93% · 全场景加权平均 84% · 排队 P95 31 ms',mechanism:'输出长度波动或单个 Decode 实例组降级时，当前 Decode 负载会突破保护线并威胁 TPOT SLO',judgement:'增加 8 个模型 B Decode 节点即可同时闭合利用率、排队与扰动场景缺口',secondary:'HBM P95 82% · Fabric P95 81% · 均已低于 85% 保护线，不建议扩容',riskMetric:'排队 P95',riskBefore:'31 ms',riskTarget:'≤ 20 ms',riskAfter:'14 ms',stressBefore:'1 / 3',criticalAfter:'82%',actions:[['增加模型 B Decode 算力','32D → 40D · 新增 8 Nodes','Decode P95 93% → 82%','扰动场景 SLO 1/3 → 3/3'],['扩展溢出 P/D 单元','16 Nodes → 24 Nodes','热点任务弹性容量提升','TPOT P95 34 ms → 31 ms'],['扩充跨模型 Fabric','1.60 Tbps → 2.00 Tbps','Fabric P95 81% → 65%','跨模型峰值流量余量提升']]},
} as const

function Bottleneck({s}:{s:(typeof scenarios)[ScenarioKey]}){
  const profile=bottleneckProfiles[s.key]
  const criticalBefore=profile.active==='Decode'?profile.decodeP95:profile.hbmP95
  const primary=profile.actions[0]
  return <div><div className="grid bottleneck-grid single"><Card title="生产扰动目标与最小增量方案" subtitle="RESILIENCE TARGET / GAP CLOSURE" icon="alert"><div className="resilience-story"><div className="resilience-stress"><small>生产扰动验证集</small><div><span>峰值负载 +10%</span><span>输出 / 上下文 P95 +15%</span><span>单个关键实例组降级</span></div></div><div className="resilience-objectives"><header><small>NEXT-STEP TARGETS</small><b>生产韧性验收目标</b></header><div className="resilience-targets"><span><small>结果目标</small><b>扰动场景 SLO 3 / 3</b><em>三类扰动下全部通过</em></span><span><small>容量保护线</small><b>关键资源 P95 ≤ 85%</b><em>避免资源接近饱和</em></span><span><small>时延保护线</small><b>{profile.riskMetric} {profile.riskTarget}</b><em>避免排队放大 SLO 风险</em></span></div></div></div><BottleneckPath s={s}/><div className="bottleneck-evidence resilience-evidence"><span><small>当前风险缺口</small><b>{profile.signal}</b></span><span><small>扰动失守原因</small><b>{profile.mechanism}</b></span><span><small>最小投入判断</small><b>{profile.judgement}</b></span></div><div className="resilience-action"><div className="resilience-action-plan"><span>MINIMUM INCREMENT</span><b>{primary[0]}</b><p>{primary[1]}</p></div><div className="resilience-gap-closure"><span><small>{profile.active} 峰值 P95</small><b>{criticalBefore}% <i>→</i> {profile.criticalAfter}</b><em>目标 ≤ 85%</em></span><span><small>{profile.riskMetric}</small><b>{profile.riskBefore} <i>→</i> {profile.riskAfter}</b><em>目标 {profile.riskTarget}</em></span><span><small>扰动场景 SLO</small><b>{profile.stressBefore} <i>→</i> 3 / 3</b><em>全部通过</em></span></div></div><div className="resilience-watch"><Icon name="check" size={14}/><span><small>无需同步扩容</small><b>{profile.secondary}</b></span></div></Card></div></div>
}

function BottleneckPath({s}:{s:Scenario}){const profile=bottleneckProfiles[s.key];const nodes=[{label:'Prefill',value:profile.prefillP95,average:profile.prefill,type:'compute'},{label:'Decode',value:profile.decodeP95,average:profile.decode,type:'compute'},{label:'HBM',value:profile.hbmP95,average:profile.hbm,type:'storage'},{label:'DDR',value:profile.ddrP95,average:profile.ddr,type:'storage'},{label:'SSD I/O',value:profile.ssdP95,average:profile.ssd,type:'storage'},{label:'Fabric',value:profile.fabricP95,average:profile.fabric,type:'network'}] as const;return <div className="bottleneck-visual resilience-path"><div className="bottleneck-callout"><span>PRODUCTION RISK EXPOSURE</span><b>{s.bottleneck}</b><small>比较峰值窗口 P95 与 85% 生产保护线，识别扰动场景下最先失守的资源。</small><div className="bottleneck-type-legend"><span className="compute">计算</span><span className="network">网络带宽</span><span className="storage">存储</span></div></div><div className="bottleneck-path">{nodes.map((x,i)=><div key={x.label} className={`resource-${x.type} ${x.label===profile.active?'active':''}`}><span>{x.label}</span><small className="resource-kind">均值 {x.average}%</small><b>{x.value}%</b><i><mark/><em style={{height:`${Math.min(100,x.value)}%`}}/></i>{i<nodes.length-1&&<u/>}</div>)}</div></div>}

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
