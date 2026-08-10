import type { Scenario, ScenarioKey } from '../types'

const baseLoad = [36,31,28,25,24,30,46,67,82,91,86,74,68,72,78,84,95,100,92,81,70,59,49,41]

export const scenarios: Record<ScenarioKey, Scenario> = {
  rag: {
    key: 'rag', name: '轻量单模型 Agent', short: '小集群部署、共享上下文复用与轻量多轮处理', model: 'Qwen3-32B', modelSize: '32B Dense', framework: 'vLLM 0.23', runtime: 'CUDA 13.1', comm: 'NCCL 2.30', gpu: 'A5 64GB', gpuCount: 48, nodes: 6, clusterNodes:[3,3],
    peak: 320, average: 146, inputTokens: 0.58, outputTokens: 0.14, turns: 6.2, toolCalls: 2.4, reuse: 63, prefixGrowth: 760, load: baseLoad.map((n,i)=>Math.max(18,n-(i%5)*6)),
    requestMix: [{label:'知识检索问答',share:46,prefix:'6K',input:'10K',output:'1.1K'}, {label:'结构化信息分析',share:34,prefix:'12K',input:'18K',output:'1.8K'}, {label:'综合结果生成',share:20,prefix:'18K',input:'28K',output:'2.4K'}],
    prefixHotness: {top:'Top 12%',contribution:70,distribution:'Zipf α 1.08'},
    prefixItems: [{label:'任务会话上下文',value:42,meta:'任务内'}, {label:'共享知识资料',value:38,meta:'资料集内'}, {label:'System Prompt',value:20,meta:'全局'}],
    evolutionBurst: '检索证据 +1.2K',
    evolution: [{round:'R1',action:'载入基础资料',tokens:'+2.4K',type:'add'}, {round:'R2',action:'检索关联证据',tokens:'+1.2K',type:'add'}, {round:'R3',action:'工具结果返回',tokens:'+0.8K',type:'add'}, {round:'R4',action:'上下文去重压缩',tokens:'-0.7K',type:'trim'}, {round:'R5',action:'生成综合结果',tokens:'+1.0K',type:'add'}],
    bottleneck: 'Decode Compute', bottleneckSub: 'HBM Capacity',
    prefillNodes: 4, decodeNodes: 2, nodesPerInstance: 1, prefillInstances: 4, decodeInstances: 2, reservedNodes: 0,
    ddrTB: 12, localSsdTB: 24, remoteSsdTB: 48,
    hbmDemandTB: 2.5, ddrDemandTB: 7.2, localSsdDemandTB: 11.5, remoteSsdDemandTB: 18, fabricUtilization: 46,
    ttftTarget: 600, ttftResult: 430, tpotTarget: 45, tpotResult: 34,
    throughputTarget: 0.55, throughputResult: 0.63, maxQps: 360, maxConcurrency: 640, sloAttainmentRate: 99.2, kvHitRate: 82.5
  },
  long: {
    key: 'long', name: '规模化单模型 Agent', short: '大规模部署、长上下文处理与深度多轮推理', model: 'DeepSeek-V3', modelSize: '671B / 37B Active', framework: 'MindIE 2.0', runtime: 'CANN 8.0', comm: 'HCCL 8.0', gpu: 'A5 64GB', gpuCount: 1024, nodes: 128, clusterNodes:[64,64],
    peak: 4300, average: 2180, inputTokens: 29.8, outputTokens: 2.8, turns: 14.6, toolCalls: 1.4, reuse: 47, prefixGrowth: 2860, load: baseLoad.map((n,i)=>Math.max(18, n-(i%4)*5)),
    requestMix: [{label:'长文档信息抽取',share:35,prefix:'16K',input:'48K',output:'2K'}, {label:'多文档关联比对',share:45,prefix:'32K',input:'64K',output:'3K'}, {label:'深层上下文推理',share:20,prefix:'48K',input:'96K',output:'4K'}],
    prefixHotness: {top:'Top 15%',contribution:68,distribution:'Zipf α 0.96'},
    prefixItems: [{label:'长程会话上下文',value:55,meta:'会话内'}, {label:'文档与参考资料',value:30,meta:'任务集内'}, {label:'任务规则 Prompt',value:15,meta:'全局'}],
    evolutionBurst: '主文档载入 +18K',
    evolution: [{round:'R1',action:'载入主文档',tokens:'+18K',type:'add'}, {round:'R2',action:'追加关联材料',tokens:'+3.6K',type:'add'}, {round:'R3',action:'补充参考证据',tokens:'+2.9K',type:'add'}, {round:'R4',action:'重复内容压缩',tokens:'-8.4K',type:'trim'}, {round:'R5',action:'生成综合结论',tokens:'+4.1K',type:'add'}],
    bottleneck: 'HBM Capacity', bottleneckSub: 'SSD KV Bandwidth',
    prefillNodes: 96, decodeNodes: 30, nodesPerInstance: 3, prefillInstances: 32, decodeInstances: 10, reservedNodes: 2,
    ddrTB: 256, localSsdTB: 320, remoteSsdTB: 448,
    hbmDemandTB: 58.2, ddrDemandTB: 221, localSsdDemandTB: 246, remoteSsdDemandTB: 330, fabricUtilization: 58,
    ttftTarget: 1800, ttftResult: 1460, tpotTarget: 55, tpotResult: 44,
    throughputTarget: 32.0, throughputResult: 34.2, maxQps: 4680, maxConcurrency: 6144, sloAttainmentRate: 98.7, kvHitRate: 74.8
  },
  coding: {
    key: 'coding', name: '多模型协同 Agent', short: '大规模双模型分工、工具密集执行与跨模型协同', model: 'Qwen3-32B + DeepSeek-Coder-V2', modelSize: '32B + 236B / 21B Active', framework: 'vLLM 0.23', runtime: 'CUDA 13.1', comm: 'NCCL 2.30', gpu: 'A5 64GB', gpuCount: 896, nodes: 112, clusterNodes:[40,72],
    peak: 7600, average: 3910, inputTokens: 15.6, outputTokens: 8.9, turns: 11.2, toolCalls: 7.8, reuse: 61, prefixGrowth: 1740, load: baseLoad.map((n,i)=>Math.min(100,n+(i%3)*4)),
    requestMix: [{label:'任务理解与规划',share:38,prefix:'12K',input:'20K',output:'2K'}, {label:'工具执行与反馈',share:44,prefix:'24K',input:'36K',output:'4K'}, {label:'复杂结果生成',share:18,prefix:'40K',input:'64K',output:'6K'}],
    prefixHotness: {top:'Top 8%',contribution:71,distribution:'Zipf α 1.12'},
    prefixItems: [{label:'任务与会话',value:47,meta:'任务内'}, {label:'跨模型共享上下文',value:35,meta:'执行链内'}, {label:'System Prompt',value:18,meta:'全局'}],
    evolutionBurst: '上下文载入 +7.6K',
    evolution: [{round:'R1',action:'载入任务上下文',tokens:'+7.6K',type:'add'}, {round:'R2',action:'工具结果插入',tokens:'+2.2K',type:'add'}, {round:'R3',action:'失败重试反馈',tokens:'+1.7K',type:'retry'}, {round:'R3-b',action:'创建并行分支',tokens:'+2.4K',type:'branch'}, {round:'R4',action:'汇总压缩并验证',tokens:'-0.8K',type:'trim'}],
    bottleneck: 'Decode Scheduling', bottleneckSub: 'KV Transfer',
    prefillNodes: 64, decodeNodes: 48, nodesPerInstance: 2, prefillInstances: 32, decodeInstances: 24, reservedNodes: 0,
    ddrTB: 224, localSsdTB: 256, remoteSsdTB: 384,
    hbmDemandTB: 44.0, ddrDemandTB: 165, localSsdDemandTB: 190, remoteSsdDemandTB: 260, fabricUtilization: 57,
    ttftTarget: 900, ttftResult: 710, tpotTarget: 45, tpotResult: 34,
    throughputTarget: 24.0, throughputResult: 26.1, maxQps: 8240, maxConcurrency: 8192, sloAttainmentRate: 98.5, kvHitRate: 79.2,
    modelInputs: [
      {
        id:'planner', label:'模型 A', role:'任务规划与工具编排', symbol:'QA', model:'Qwen3-32B', modelSize:'32B Dense', framework:'vLLM 0.23', runtime:'CUDA 13.1', comm:'NCCL 2.30',
        peak:2600, average:1280, inputTokens:6.1, outputTokens:2.1, turns:6.8, toolCalls:5.4, reuse:72, prefixGrowth:980, load:baseLoad.map((n,i)=>Math.max(20,n-(i%4)*4)),
        requestMix:[{label:'需求理解与拆解',share:36,prefix:'8K',input:'14K',output:'1.2K'},{label:'工具规划与路由',share:44,prefix:'16K',input:'22K',output:'1.8K'},{label:'结果校验与决策',share:20,prefix:'20K',input:'30K',output:'2.4K'}],
        prefixHotness:{top:'Top 10%',contribution:76,distribution:'Zipf α 1.20'}, prefixItems:[{label:'任务计划',value:42,meta:'任务内'},{label:'工具状态',value:38,meta:'执行链'},{label:'System Prompt',value:20,meta:'全局'}],
        evolutionBurst:'工具结果 +2.1K', evolution:[{round:'R1',action:'任务拆解',tokens:'+3.4K',type:'add'},{round:'R2',action:'工具选择',tokens:'+1.2K',type:'add'},{round:'R3',action:'结果汇总',tokens:'+2.1K',type:'add'},{round:'R4',action:'计划压缩',tokens:'-0.9K',type:'trim'}]
      },
      {
        id:'coder', label:'模型 B', role:'专业执行与复杂结果生成', symbol:'DX', model:'DeepSeek-Coder-V2', modelSize:'236B / 21B Active', framework:'vLLM 0.23', runtime:'CUDA 13.1', comm:'NCCL 2.30',
        peak:5000, average:2630, inputTokens:9.5, outputTokens:6.8, turns:13.4, toolCalls:9.1, reuse:55, prefixGrowth:2140, load:baseLoad.map((n,i)=>Math.min(100,n+(i%3)*4)),
        requestMix:[{label:'上下文理解与定位',share:34,prefix:'12K',input:'24K',output:'2K'},{label:'复杂内容生成',share:48,prefix:'28K',input:'42K',output:'5K'},{label:'执行结果验证',share:18,prefix:'44K',input:'72K',output:'7K'}],
        prefixHotness:{top:'Top 8%',contribution:68,distribution:'Zipf α 1.08'}, prefixItems:[{label:'专业执行上下文',value:49,meta:'任务域内'},{label:'工具执行结果',value:33,meta:'任务内'},{label:'System Prompt',value:18,meta:'全局'}],
        evolutionBurst:'上下文载入 +7.6K', evolution:[{round:'R1',action:'载入执行上下文',tokens:'+7.6K',type:'add'},{round:'R2',action:'生成中间结果',tokens:'+3.1K',type:'add'},{round:'R3',action:'工具反馈回流',tokens:'+2.4K',type:'retry'},{round:'R4',action:'压缩并验证',tokens:'-1.2K',type:'trim'}]
      }
    ]
  }
}
