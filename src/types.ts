export type ScenarioKey = 'rag' | 'long' | 'coding'
export type Stage = 'IDLE' | 'CHECKING' | 'SIMULATING' | 'OPTIMIZING' | 'VALIDATING' | 'COMPLETED'

export interface ModelWorkloadInput {
  id: string
  label: string
  role: string
  symbol: string
  model: string
  modelSize: string
  framework: string
  runtime: string
  comm: string
  peak: number
  average: number
  inputTokens: number
  outputTokens: number
  turns: number
  toolCalls: number
  reuse: number
  prefixGrowth: number
  load: number[]
  requestMix: { label: string; share: number; prefix: string; input: string; output: string }[]
  prefixHotness: { top: string; contribution: number; distribution: string }
  prefixItems: { label: string; value: number; meta: string }[]
  evolutionBurst: string
  evolution: { round: string; action: string; tokens: string; type: string }[]
}

export interface Scenario {
  key: ScenarioKey
  name: string
  short: string
  model: string
  modelSize: string
  framework: string
  runtime: string
  comm: string
  gpu: string
  gpuCount: number
  nodes: number
  clusterNodes?: [number, number]
  peak: number
  average: number
  inputTokens: number
  outputTokens: number
  turns: number
  toolCalls: number
  reuse: number
  prefixGrowth: number
  load: number[]
  requestMix: { label: string; share: number; prefix: string; input: string; output: string }[]
  prefixHotness: { top: string; contribution: number; distribution: string }
  prefixItems: { label: string; value: number; meta: string }[]
  evolutionBurst: string
  evolution: { round: string; action: string; tokens: string; type: string }[]
  bottleneck: string
  bottleneckSub: string
  prefillNodes: number
  decodeNodes: number
  nodesPerInstance: number
  prefillInstances: number
  decodeInstances: number
  reservedNodes: number
  ddrTB: number
  localSsdTB: number
  remoteSsdTB: number
  hbmDemandTB: number
  ddrDemandTB: number
  localSsdDemandTB: number
  remoteSsdDemandTB: number
  fabricUtilization: number
  ttftTarget: number
  ttftResult: number
  tpotTarget: number
  tpotResult: number
  throughputTarget: number
  throughputResult: number
  maxQps: number
  maxConcurrency: number
  kvHitRate: number
  modelInputs?: ModelWorkloadInput[]
}
