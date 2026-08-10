export type ScenarioKey = 'rag' | 'long' | 'coding'
export type Stage = 'IDLE' | 'CHECKING' | 'SIMULATING' | 'OPTIMIZING' | 'VALIDATING' | 'COMPLETED'

export interface TopologyDevice {
  id: string
  type: 'compute' | 'leaf' | 'spine'
  name: string
  clusterId: 'cluster-a' | 'cluster-b' | 'fabric'
  plane?: 'A' | 'B'
  rackId?: string
  gpuCount?: number
  nodeKind?: 'standard' | 'supernode'
}

export interface TopologyNic {
  id: string
  ownerId: string
  rail: number
  plane: 'A' | 'B'
  bandwidthGbps: number
  protocol: 'RoCE' | 'IB' | 'UB'
}

export interface TopologyLink {
  id: string
  source: string
  target: string
  bandwidthGbps: number
  latencyUs: number
  protocol: 'RoCE' | 'IB' | 'UB'
  rail: number
  plane: 'A' | 'B'
}

export interface TopologyConfiguration {
  acceleratorsPerNode: number
  acceleratorInterconnect: 'HCCS'
  hccsBandwidthGBs: number
  hostBus: 'PCIe 5.0'
  hostBusBandwidthGBs: number
  nicsPerNode: number
  nicProtocol: 'RDMA/RoCE'
  nicBandwidthGbps: number
  leafUplinkBandwidthGbps: number
  localStorageProtocol: 'PCIe/NVMe'
  localStorageBandwidthGBs: number
  remoteStorageProtocol: 'NVMe-oF/RDMA'
  remoteStorageBandwidthGBs: number
}

export interface NetworkTopology {
  devices: TopologyDevice[]
  nics: TopologyNic[]
  links: TopologyLink[]
  configuration: TopologyConfiguration
}

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
  networkTopology: NetworkTopology
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
  sloAttainmentRate: number
  kvHitRate: number
  modelInputs?: ModelWorkloadInput[]
}
