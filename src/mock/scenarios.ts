import type { Scenario, ScenarioKey } from '../types'

const baseLoad = [36,31,28,25,24,30,46,67,82,91,86,74,68,72,78,84,95,100,92,81,70,59,49,41]

export const scenarios: Record<ScenarioKey, Scenario> = {
  rag: {
    key: 'rag', name: 'RAG Agent', short: '知识检索、多轮问答与共享前缀', model: 'Qwen3-235B-A22B', modelSize: '235B / 22B Active', framework: 'vLLM 0.23', runtime: 'CUDA 13.1', comm: 'NCCL 2.30', gpu: 'A5 64GB', gpuCount: 768, nodes: 96,
    peak: 12800, average: 6420, inputTokens: 18.4, outputTokens: 4.2, turns: 8.4, toolCalls: 3.2, reuse: 68, prefixGrowth: 1280, load: baseLoad,
    requestMix: [{label:'高频检索问答',share:42,prefix:'8K',input:'12K',output:'1.2K'}, {label:'多轮知识问答',share:38,prefix:'18K',input:'24K',output:'1.8K'}, {label:'深度检索分析',share:20,prefix:'32K',input:'48K',output:'3.2K'}],
    prefixHotness: {top:'Top 10%',contribution:74,distribution:'Zipf α 1.18'},
    prefixItems: [{label:'多轮会话',value:45,meta:'会话内'}, {label:'RAG 上下文',value:35,meta:'业务域'}, {label:'System Prompt',value:20,meta:'全局'}],
    evolutionBurst: 'RAG 注入 +1.6K',
    evolution: [{round:'R1',action:'初始请求',tokens:'+3.2K',type:'add'}, {round:'R2',action:'插入检索结果',tokens:'+1.6K',type:'add'}, {round:'R3',action:'工具调用返回',tokens:'+0.9K',type:'add'}, {round:'R4',action:'上下文压缩',tokens:'-1.1K',type:'trim'}, {round:'R5',action:'继续推理',tokens:'+1.3K',type:'add'}],
    bottleneck: 'RDMA Fabric', bottleneckSub: 'HBM Capacity',
    prefillNodes: 64, decodeNodes: 32, nodesPerInstance: 2, prefillInstances: 32, decodeInstances: 16, reservedNodes: 0,
    ddrTB: 192, localSsdTB: 256, remoteSsdTB: 320,
    hbmDemandTB: 40.8, ddrDemandTB: 138, localSsdDemandTB: 184, remoteSsdDemandTB: 210, fabricUtilization: 88,
    ttftTarget: 500, ttftResult: 420, tpotTarget: 50, tpotResult: 38,
    throughputTarget: 22.0, throughputResult: 24.6, maxQps: 13420, maxConcurrency: 9680, kvHitRate: 86.4
  },
  long: {
    key: 'long', name: 'Long-Context Agent', short: '64K+ 上下文分析与持续会话', model: 'DeepSeek-V3', modelSize: '671B / 37B Active', framework: 'MindIE 2.0', runtime: 'CANN 8.0', comm: 'HCCL 8.0', gpu: 'A5 64GB', gpuCount: 1024, nodes: 128,
    peak: 4300, average: 2180, inputTokens: 29.8, outputTokens: 2.8, turns: 14.6, toolCalls: 1.4, reuse: 47, prefixGrowth: 2860, load: baseLoad.map((n,i)=>Math.max(18, n-(i%4)*5)),
    requestMix: [{label:'长文档问答',share:35,prefix:'16K',input:'48K',output:'2K'}, {label:'持续分析会话',share:45,prefix:'32K',input:'64K',output:'3K'}, {label:'全文综合分析',share:20,prefix:'48K',input:'96K',output:'4K'}],
    prefixHotness: {top:'Top 15%',contribution:68,distribution:'Zipf α 0.96'},
    prefixItems: [{label:'多轮会话',value:55,meta:'会话内'}, {label:'长文档上下文',value:30,meta:'任务内'}, {label:'System Prompt',value:15,meta:'全局'}],
    evolutionBurst: '文档载入 +18K',
    evolution: [{round:'R1',action:'载入长文档',tokens:'+18K',type:'add'}, {round:'R2',action:'持续追加',tokens:'+3.6K',type:'add'}, {round:'R3',action:'持续追加',tokens:'+2.9K',type:'add'}, {round:'R4',action:'摘要压缩',tokens:'-8.4K',type:'trim'}, {round:'R5',action:'追问扩展',tokens:'+4.1K',type:'add'}],
    bottleneck: 'HBM Capacity', bottleneckSub: 'SSD KV Bandwidth',
    prefillNodes: 96, decodeNodes: 32, nodesPerInstance: 3, prefillInstances: 32, decodeInstances: 10, reservedNodes: 2,
    ddrTB: 256, localSsdTB: 320, remoteSsdTB: 448,
    hbmDemandTB: 58.2, ddrDemandTB: 221, localSsdDemandTB: 246, remoteSsdDemandTB: 330, fabricUtilization: 74,
    ttftTarget: 1800, ttftResult: 1460, tpotTarget: 55, tpotResult: 44,
    throughputTarget: 32.0, throughputResult: 34.2, maxQps: 4680, maxConcurrency: 6144, kvHitRate: 74.8
  },
  coding: {
    key: 'coding', name: 'Coding Agent', short: '代码理解、工具执行与分支修复', model: 'DeepSeek-Coder-V2', modelSize: '236B / 21B Active', framework: 'vLLM 0.23', runtime: 'CUDA 13.1', comm: 'NCCL 2.30', gpu: 'A5 64GB', gpuCount: 896, nodes: 112,
    peak: 7600, average: 3910, inputTokens: 15.6, outputTokens: 8.9, turns: 11.2, toolCalls: 7.8, reuse: 61, prefixGrowth: 1740, load: baseLoad.map((n,i)=>Math.min(100,n+(i%3)*4)),
    requestMix: [{label:'代码定位',share:38,prefix:'12K',input:'20K',output:'2K'}, {label:'工具执行与修复',share:44,prefix:'24K',input:'36K',output:'4K'}, {label:'仓库级分析',share:18,prefix:'40K',input:'64K',output:'6K'}],
    prefixHotness: {top:'Top 8%',contribution:71,distribution:'Zipf α 1.12'},
    prefixItems: [{label:'任务与会话',value:47,meta:'任务内'}, {label:'仓库上下文',value:35,meta:'项目内'}, {label:'System Prompt',value:18,meta:'全局'}],
    evolutionBurst: '仓库扫描 +7.6K',
    evolution: [{round:'R1',action:'扫描仓库',tokens:'+7.6K',type:'add'}, {round:'R2',action:'工具结果插入',tokens:'+2.2K',type:'add'}, {round:'R3',action:'失败重试',tokens:'+1.7K',type:'retry'}, {round:'R3-b',action:'创建修复分支',tokens:'+2.4K',type:'branch'}, {round:'R4',action:'回退并验证',tokens:'-0.8K',type:'trim'}],
    bottleneck: 'Decode Scheduling', bottleneckSub: 'KV Transfer',
    prefillNodes: 64, decodeNodes: 48, nodesPerInstance: 2, prefillInstances: 32, decodeInstances: 24, reservedNodes: 0,
    ddrTB: 224, localSsdTB: 256, remoteSsdTB: 384,
    hbmDemandTB: 47.0, ddrDemandTB: 165, localSsdDemandTB: 190, remoteSsdDemandTB: 260, fabricUtilization: 81,
    ttftTarget: 900, ttftResult: 710, tpotTarget: 45, tpotResult: 34,
    throughputTarget: 24.0, throughputResult: 26.1, maxQps: 8240, maxConcurrency: 8192, kvHitRate: 79.2
  }
}
