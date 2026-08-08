# 算存网一体化规划仿真平台

## 前端方案设计文档 V2.0

## 1. 项目目标

构建一个单页前端 Mock Demo，用于完整展示面向 Agent 推理业务的算、网、存一体化规划过程：

> 输入配置 → 可调参数配置 → 仿真寻优 → 规划方案 → 方案性能表现 → 瓶颈与寻优结果

平台重点用于方案交流、客户演示和内部汇报。第一阶段不要求接入真实后端仿真引擎，但页面需要完整表达业务逻辑、数据关系和规划过程。

第一阶段目标：

* 页面视觉与信息结构完整
* 输入、可调参数和输出边界清晰
* 支持参数配置与预置场景切换
* 支持一键启动仿真规划
* 支持动态展示规划与寻优过程
* 支持展示规划方案及对应性能
* 支持瓶颈分析和多个候选方案对比
* 支持突出最终推荐方案

---

## 2. 产品定位

英文名称：

**Integrated Computing, Storage and Network Planning Simulation Platform**

中文名称：

**算存网一体化规划仿真平台**

副标题：

**面向 Agent 业务的算网存协同资源规划与数字孪生仿真**

核心价值表达：

> 输入模型、推理软件栈、硬件资源拓扑、Agent 业务负载及目标约束，在可配置的调度、部署、并行、路由和 KV 策略空间中进行仿真寻优，输出推荐规划方案、对应性能表现及瓶颈分析。

---

## 3. 当前 Demo 范围

本阶段实现高质量前端 Mock Demo，保持原有产品目标和演示范围，不实现真实后端仿真能力。

### 3.1 实现范围

* 模型、软件栈、硬件拓扑、业务负载和目标约束输入
* 调度、部署、并行、路由、KV 容量、缓存和搬运参数配置
* Agent 请求规模、前缀共享和前缀演化特征展示
* 小时级请求负载曲线及峰值、均值、P95、峰均比
* 规划寻优过程动画
* 计算资源和 P/D 部署方案
* KV Cache 分层容量与策略方案
* Spine-Leaf 网络与存储规划方案
* SLA/SLO 性能仿真结果
* 资源利用率和资源余量
* 瓶颈、参数敏感性及 Top-K 候选方案
* 最终推荐方案

### 3.2 暂不实现

* 真实算子图构建与执行
* 真实网络流级离散事件仿真
* 真实 CANN/CUDA Kernel 执行
* 真实 HCCL/NCCL 集合通信仿真
* 真实存储 I/O 仿真
* 真实调度器和推理框架运行
* 数学优化求解器
* 数据库与后端服务

第一阶段所有展示数据由以下部分组成：

```text
Preset Dataset
+
Front-end Rules
+
Animation
```

算子执行过程和具体网络流属于内部仿真过程，不作为页面顶层最终输出。

---

## 4. 页面信息架构

页面按三段式业务结构组织：

```text
输入配置
  ├─ 模型描述
  ├─ 推理软件栈
  ├─ 硬件与资源拓扑
  ├─ 业务负载特征
  └─ 目标与约束

可调参数
  ├─ 服务调度
  ├─ 部署与实例拓扑
  ├─ 并行策略
  ├─ 请求路由与负载
  ├─ KV 容量
  ├─ KV 缓存策略
  └─ KV 搬运与 I/O

输出结果
  ├─ 规划方案
  ├─ 方案性能表现
  └─ 瓶颈与寻优结果
```

---

## 5. 整体页面布局

采用单页 Dashboard，保持企业级 AI Infra 工具风格。

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header：算存网一体化规划仿真平台          场景选择  保存配置  导入  导出    │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │  输入配置  │  可调参数  │  规划结果                      │
│ 左侧步骤导航     ├───────────────────────────────────────────────────────────┤
│                  │                                                           │
│ ① 模型与软件栈   │                  主工作区                                 │
│ ② 硬件拓扑       │                                                           │
│ ③ 业务负载       │  配置表单 / 拓扑 / 特征图 / 寻优过程 / 结果面板           │
│ ④ 目标约束       │                                                           │
│ ⑤ 可调参数       │                                                           │
│                  │                                                           │
│ [开始仿真规划]   │                                                           │
├──────────────────┴───────────────────────────────────────────────────────────┤
│ 当前配置摘要  │  运行状态  │  告警与约束检查                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

布局建议：

* Header：64px
* 左侧步骤导航：280～320px
* 主工作区：自适应
* 底部状态栏：48～56px
* 页面最小宽度：1440px
* 首选演示分辨率：1920 × 1080
* 主工作区采用 Tab 与卡片组合，避免把全部参数一次性铺开

---

## 6. 输入配置

输入区只描述外部提供的模型、环境、业务和目标，不混入可调参数或仿真中间结果。

### 6.1 模型描述

```text
模型名称             DeepSeek / Qwen / Llama / 自定义
层数                 80
Hidden Size          8,192
Query Head 数        64
KV Head 数           8
Attention 结构       GQA / Dense
MoE 结构             64 Experts / Top-2
Weight dtype         BF16
Activation dtype     BF16
KV dtype             FP16
```

页面使用基础信息卡与结构参数表，不展示算子图、通信算子或网络流。

### 6.2 推理软件栈

```text
推理框架及版本        vLLM / MindIE / 其他
加速运行时及版本      CUDA / CANN / 其他
集合通信库及版本      NCCL / HCCL / 其他
能力边界              调度 / 并行 / 缓存 / KV搬运
```

能力边界使用标签或只读能力矩阵展示，具体策略放入“可调参数”。

### 6.3 硬件与资源拓扑

分为资源清单和拓扑视图。

```text
计算资源
NPU/GPU 型号、数量、各 dtype 有效算力、HBM 容量与带宽

主机资源
CPU、DDR 容量与带宽、NUMA、PCIe 代际与拓扑

存储资源
NVMe / SSD / Remote Store 容量、带宽、IOPS、时延、队列深度

网络资源
NIC、交换机、链路协议、有效带宽、基础时延、并发流能力

连接关系
NPU/GPU、CPU、NUMA、NIC 与存储设备的物理归属和连接关系
```

主工作区提供简化拓扑图，点击节点后在右侧抽屉中查看设备属性。

### 6.4 业务负载特征

业务负载严格按三个模块展示。

#### 请求规模特征

* 请求到达时间
* Input / Output Length
* 会话轮数和轮间隔
* 单任务模型调用次数
* 单任务工具调用次数

#### 前缀共享特征

* 共享前缀长度
* 共享范围
* 复用次数
* 热点度
* 复用间隔

#### 前缀演化特征

* 每轮前缀新增、修改和截断
* 会话分支形成的继承关系
* 重试与回退形成的继承关系

页面使用三张特征卡配合请求时间线，使预置特征能够还原对应的 Agent 业务请求形态。

### 6.5 目标与约束

```text
TTFT P50 / P95 / P99
TPOT P50 / P95 / P99
吞吐目标
最大可承载 QPS / 并发目标
成本上限
设备数量上限
功耗上限
```

目标项使用数字输入框、单位选择器和约束开关。

---

## 7. 可调参数配置

可调参数单独设置，不与输入混排。页面左侧使用参数分类，右侧显示具体配置和推荐搜索范围。

### 7.1 服务调度参数

* `max_num_seqs`
* `max_num_batched_tokens`
* 调度策略
* Chunked Prefill 开关及 chunk 大小
* Partial / Long Prefill 并发数及阈值
* MTP / Speculative Decode 参数

### 7.2 部署与实例拓扑

* 单实例 / 多实例 / 共享资源池 / P-D 分离
* P / D 实例数量
* 单实例卡数
* P:D 实例比例
* 节点、NUMA 和网络拓扑放置

### 7.3 并行策略

* TP / DP / PP
* MoE-TP / MoE-EP
* CP / DCP
* P 侧独立并行配置
* D 侧独立并行配置

### 7.4 请求路由与负载

* 请求并发规模和发送 QPS
* P / D 实例选择策略
* Random / RR / Affinity / Load-aware 路由
* 请求排队和 admission control

原有“负载放大倍率”保留为 QPS/并发的快捷调整方式：

```text
[ 1× ] [ 2× ] [ 5× ] [ 10× ]
```

### 7.5 KV 容量配置

* HBM KV Cache 配额
* CPU / DDR KV 容量
* SSD / Remote Store 容量
* HBM : DDR : SSD : Remote 比例
* KV 池化 / 隔离方式

### 7.6 KV 缓存策略

* Prefix Cache
* Block / Chunk / Page 粒度
* Cache admission
* 淘汰策略
* Write-through / Write-back
* Prefetch
* 本地 / 全局索引与共享策略

### 7.7 KV 搬运与 I/O

* HBM ↔ DDR ↔ SSD ↔ Remote 路径
* 搬运并发数 / Worker 数
* RDMA / TCP
* I/O Backend
* NUMA / NIC / NVMe 亲和放置
* 异步传输与流水重叠参数

---

## 8. Agent 业务负载视图

原有“业务负载编译”和“小时级负载分布”整合为业务负载视图，用于确认输入是否准确表达目标 Agent 场景。

### 8.1 核心指标

```text
请求峰值             12,800 req/s
平均请求             6,420 req/s
Input Token          18.4 M token/s
Output Token         4.2 M token/s
平均会话轮数          8.4
平均工具调用次数       3.2 / task
前缀复用率            68%
平均前缀增长          1,280 token / turn
```

### 8.2 24 小时请求规模分布

图表支持切换：

* Request
* Input Token
* Output Token
* 并发会话
* 模型调用
* 工具调用

右侧摘要展示峰值时刻、均值、P95、峰均比和 Burst Factor。

### 8.3 前缀共享与演化

* 前缀共享使用分组条形图或矩阵展示
* 前缀热点使用 Top-N 列表展示
* 前缀演化使用会话时间线或分支树展示
* 点击一个会话可查看每轮新增、修改、截断、重试和回退

计算需求、存储访问量和网络流量不作为业务输入卡片，它们属于仿真内部推演结果。

---

## 9. 仿真与寻优过程

标题：

**算存网一体化规划寻优**

寻优过程动态展示：

```text
正在搜索候选规划方案

候选方案        356
已评估          214
满足 SLO        46
当前最优        Solution #183
进度            71%
```

寻优目标：

```text
✓ 满足 TTFT / TPOT / 吞吐目标
✓ 满足设备数量与功耗约束
✓ 降低成本
✓ 提高设备与存储利用率
✓ 避免网络和存储瓶颈
```

规划过程可以展示候选方案配置变化，但不把算子执行和具体网络流作为最终输出。

---

## 10. 输出结果总览

输出统一分为三个一级模块：

```text
规划方案
方案性能表现
瓶颈与寻优结果
```

页面顶部显示推荐方案摘要和 SLO 状态，下面通过三个 Tab 展示详细内容。

---

## 11. 规划方案

规划方案集中呈现完整配置，不再将 Compute、P/D、KV、Network 和 Storage 分散成独立一级结果。

### 11.1 计算资源与部署

```text
设备型号          H100 80GB
设备总数          768
服务器节点        96
Prefill GPU       256
Decode GPU        512
P:D Ratio         1:2
TP / DP / PP / EP 8 / 4 / 1 / 8
```

### 11.2 调度与路由

```text
Batch策略              Continuous Batching
Chunked Prefill        Enabled / 4K
路由策略                Load-aware + Affinity
Admission Control      Enabled
```

### 11.3 KV Cache

```text
Total KV Cache Pool    20.4 TB
HBM                    8.2 TB / 40%
DDR                    7.1 TB / 35%
SSD                    5.1 TB / 25%
Remote                 Optional
```

同时展示缓存、淘汰、Prefetch、共享和搬运策略。

### 11.4 网络

```text
Spine                  8 × 64-port 400GbE
Leaf                   32 × 48-port 400GbE
ToR                    96 × 32-port 200GbE
Fabric Bandwidth       25.6 Tbps
Protocol               RDMA
Oversubscription       1:1
```

配合简化 Spine-Leaf 拓扑图展示。

### 11.5 存储

```text
总容量                 320 TB
Read BW                32 GB/s
Write BW               12 GB/s
IOPS                    4.2 M
NVMe / SSD / Remote     分层配置
```

### 11.6 成本与功耗

展示设备成本、网络与存储成本、总成本、峰值功耗和预算余量。

---

## 12. 方案性能表现

### 12.1 服务性能与 SLO

| 指标 | 目标 | 仿真结果 | 状态 |
| --- | ---: | ---: | --- |
| TTFT P95 | < 500 ms | 420 ms | PASS |
| TPOT P95 | < 50 ms | 38 ms | PASS |
| Throughput | > 5,000 token/s | 6,240 token/s | PASS |
| Availability | 99.99% | 99.995% | PASS |

同时展示 TTFT / TPOT P50、P95、P99、E2E Latency、最大 QPS、最大并发、SLO 达标率和超时率。

### 12.2 资源性能

* NPU/GPU、HBM、DDR、网络和存储利用率
* P/D 实例利用率、排队时延、排队长度和负载均衡度
* 网络带宽、存储带宽与 IOPS 利用率
* 各资源余量

### 12.3 KV Cache 性能

* 各层命中率
* 驻留量、淘汰量和迁移量
* Cache miss 重算量
* Preemption 和重算次数

---

## 13. 瓶颈与寻优结果

### 13.1 主要瓶颈

```text
Primary Bottleneck     RDMA Fabric
Secondary Bottleneck   HBM Capacity
Impact                 TPOT P99 +12%
```

瓶颈类型包括算力、HBM、DDR、PCIe、RDMA、SSD 和调度。

### 13.2 参数敏感性

展示关键参数对 TTFT、TPOT、吞吐、成本和功耗的影响，可使用横向条形图或龙卷风图。

### 13.3 Top-K 候选方案

| 方案 | SLO | GPU/NPU | 成本 | 吞吐 | 主要特点 |
| --- | --- | ---: | ---: | ---: | --- |
| 推荐方案 | PASS | 768 | ¥— | 6,240 | 综合最优 |
| 最小资源 | PASS | 704 | ¥— | 5,180 | 资源最少 |
| 最大吞吐 | PASS | 896 | ¥— | 7,920 | 吞吐最高 |

明确显示满足 SLO 的最小资源方案、给定资源下的最大吞吐方案和最终推荐方案。

---

## 14. Demo 交互流程

### Step 1：选择场景并确认输入

选择 RAG Agent、长上下文 Agent 或 Coding Agent，查看对应模型、软件栈、硬件拓扑和三类业务负载特征。

### Step 2：配置目标与可调参数

设置 TTFT、TPOT、吞吐、成本和功耗约束，调整调度、部署、并行、路由和 KV 参数搜索范围。

### Step 3：启动仿真规划

点击：

```text
开始仿真规划
```

页面依次进入配置检查、仿真寻优和结果验证状态。

### Step 4：展示寻优过程

动态更新候选方案数、已评估方案数、满足 SLO 方案数和当前最优方案。

### Step 5：锁定推荐方案

显示推荐规划方案、对应性能表现、主要瓶颈和 Top-K 候选方案。

---

## 15. 预置 Demo 场景

### Scenario A：RAG Agent

* 请求规模：中高 QPS，中等会话轮数
* 前缀共享：System Prompt、工具定义和公共知识上下文复用率高
* 前缀演化：检索结果持续插入，多轮前缀逐步增长
* 规划特点：存储和 KV Cache 需求较高

### Scenario B：长上下文 Agent

* 请求规模：低 QPS、长 Input、长会话
* 前缀共享：会话内共享高，跨会话共享低
* 前缀演化：每轮持续追加，偶尔压缩或截断
* 规划特点：HBM、DDR 和 SSD KV Pool 较大

### Scenario C：Coding Agent

* 请求规模：模型与工具调用频繁，Output Token 较大
* 前缀共享：仓库上下文、工具定义和系统指令可复用
* 前缀演化：工具结果插入频繁，存在分支、失败重试和回退
* 规划特点：Decode 压力、调度和 KV 搬运压力较高

场景切换时同步改变输入、推荐配置、性能结果和瓶颈判断。

---

## 16. Mock 数据结构

数据按 `input`、`tunables`、`output` 三层组织。

```json
{
  "scenario": "rag-agent",
  "input": {
    "model": {},
    "softwareStack": {},
    "hardwareTopology": {},
    "workload": {
      "requestScale": {},
      "prefixSharing": {},
      "prefixEvolution": {}
    },
    "objectives": {}
  },
  "tunables": {
    "scheduling": {},
    "deployment": {},
    "parallelism": {},
    "routing": {},
    "kvCapacity": {},
    "cachePolicy": {},
    "kvTransfer": {}
  },
  "output": {
    "planningSolution": {},
    "performance": {},
    "optimization": {}
  }
}
```

目录建议：

```text
mock/
├── scenarios.json
├── rag-agent.json
├── long-context-agent.json
├── coding-agent.json
├── optimization-process.json
└── candidate-solutions.json
```

通过 `mockPlanningService` 访问数据，组件不直接读取 JSON。

---

## 17. 前端技术方案

```text
React
+
TypeScript
+
Vite
```

推荐组件：

* UI：Ant Design 或 Tailwind CSS
* 图表：Apache ECharts
* 动画：Framer Motion
* 拓扑：SVG

第一版无需引入复杂 3D 或真实拓扑仿真库。

---

## 18. 推荐工程结构

```text
src/
├── components/
│   ├── input/
│   │   ├── ModelInput
│   │   ├── SoftwareStackInput
│   │   ├── HardwareTopologyInput
│   │   ├── WorkloadFeatureInput
│   │   └── ObjectiveInput
│   ├── tunables/
│   │   ├── SchedulingConfig
│   │   ├── DeploymentConfig
│   │   ├── ParallelismConfig
│   │   ├── RoutingConfig
│   │   ├── KVCapacityConfig
│   │   ├── CachePolicyConfig
│   │   └── KVTransferConfig
│   ├── planning/
│   │   ├── OptimizationPanel
│   │   └── CandidateSolutionList
│   └── output/
│       ├── PlanningSolution
│       ├── PerformanceResult
│       └── BottleneckAnalysis
├── mock/
├── pages/
│   └── PlanningDashboard
├── services/
│   └── mockPlanningService
└── App.tsx
```

---

## 19. 状态机设计

```text
IDLE
  ↓
CHECKING
  ↓
SIMULATING
  ↓
OPTIMIZING
  ↓
VALIDATING
  ↓
COMPLETED
```

状态文案：

* IDLE：等待配置
* CHECKING：正在检查输入与约束
* SIMULATING：正在执行方案仿真
* OPTIMIZING：正在搜索候选规划方案
* VALIDATING：正在验证方案性能与 SLO
* COMPLETED：规划完成

---

## 20. UI 视觉设计

整体保持 Dark Theme 和企业级基础设施规划工具风格。

```text
主背景       #07111F
模块背景     #0D1B2A
主强调色     蓝色 / 青色
辅助强调色   紫色 / 绿色
成功状态     绿色
告警状态     橙色
失败状态     红色
```

视觉原则：

* 优先保证配置层级、字段单位和结果关系清晰
* 输入、可调参数和输出使用不同的导航层级
* 推荐方案使用稳定的高亮边框，不使用过度闪烁效果
* 图表服务于负载、性能、利用率和敏感性表达
* 拓扑图用于硬件连接关系和最终网络方案
* 避免做成 NOC 监控大屏或过度科幻的 3D 场景

---

## 21. 最终页面信息层级

```text
① 输入配置
   模型 + 软件栈 + 硬件拓扑 + Agent负载 + 目标约束

                          ↓

② 可调参数
   调度 + 部署 + 并行 + 路由 + KV容量 + 缓存 + 搬运

                          ↓

③ 仿真与寻优
   Search + Evaluate + Validate

                          ↓

④ 规划方案
   Compute + P/D + Network + Storage + KV + Scheduling

                          ↓

⑤ 方案性能表现
   SLO + Throughput + Utilization + Capacity Margin

                          ↓

⑥ 瓶颈与寻优结果
   Bottleneck + Sensitivity + Top-K
```

页面顶部核心表达：

> **从 Agent 业务需求和 SLO 出发，在调度、部署、并行、网络、存储与 KV 策略空间中进行联合仿真寻优，形成可验证的算存网一体化规划方案。**

第一阶段即使使用预置数据，也需要保证输入、可调参数、规划方案、性能表现和瓶颈分析之间的数据关系一致。
