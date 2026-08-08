import type { Scenario, ScenarioKey } from '../types'

const baseLoad = [36,31,28,25,24,30,46,67,82,91,86,74,68,72,78,84,95,100,92,81,70,59,49,41]

export const scenarios: Record<ScenarioKey, Scenario> = {
  rag: {
    key: 'rag', name: 'RAG Agent', short: '知识检索、多轮问答与共享前缀', model: 'Qwen3-235B-A22B', modelSize: '235B / 22B Active', framework: 'vLLM 0.23', runtime: 'CUDA 13.1', comm: 'NCCL 2.30', gpu: 'A5 64GB', gpuCount: 768, nodes: 96,
    peak: 12800, average: 6420, inputTokens: 18.4, outputTokens: 4.2, turns: 8.4, toolCalls: 3.2, reuse: 68, prefixGrowth: 1280, load: baseLoad,
    prefixItems: [{label:'System Prompt',value:94,meta:'全局共享'}, {label:'工具定义',value:82,meta:'Agent 组共享'}, {label:'公共知识上下文',value:68,meta:'业务域共享'}, {label:'会话历史',value:41,meta:'会话内共享'}],
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
    prefixItems: [{label:'会话历史',value:91,meta:'会话内共享'}, {label:'系统指令',value:76,meta:'全局共享'}, {label:'长文档块',value:52,meta:'任务内共享'}, {label:'跨会话上下文',value:19,meta:'低共享'}],
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
    prefixItems: [{label:'仓库上下文',value:84,meta:'任务内共享'}, {label:'工具定义',value:79,meta:'Agent 组共享'}, {label:'系统指令',value:93,meta:'全局共享'}, {label:'执行结果',value:35,meta:'分支内共享'}],
    evolution: [{round:'R1',action:'扫描仓库',tokens:'+7.6K',type:'add'}, {round:'R2',action:'工具结果插入',tokens:'+2.2K',type:'add'}, {round:'R3',action:'失败重试',tokens:'+1.7K',type:'retry'}, {round:'R3-b',action:'创建修复分支',tokens:'+2.4K',type:'branch'}, {round:'R4',action:'回退并验证',tokens:'-0.8K',type:'trim'}],
    bottleneck: 'Decode Scheduling', bottleneckSub: 'KV Transfer',
    prefillNodes: 64, decodeNodes: 48, nodesPerInstance: 2, prefillInstances: 32, decodeInstances: 24, reservedNodes: 0,
    ddrTB: 224, localSsdTB: 256, remoteSsdTB: 384,
    hbmDemandTB: 47.0, ddrDemandTB: 165, localSsdDemandTB: 190, remoteSsdDemandTB: 260, fabricUtilization: 81,
    ttftTarget: 900, ttftResult: 710, tpotTarget: 45, tpotResult: 34,
    throughputTarget: 24.0, throughputResult: 26.1, maxQps: 8240, maxConcurrency: 8192, kvHitRate: 79.2
  }
}
