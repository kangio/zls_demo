# 算存网一体化规划仿真平台

## 前端方案设计文档 V1.0

## 1. 项目目标

构建一个基于 HTML 的单页演示系统，用于展示：

> 业务 SLA 输入 → 负载模型选择与放大 → 负载编译 → 规划寻优 → 算网存资源输出 → SLA 验证

重点用于方案交流、客户演示、内部汇报，不要求后端真实仿真能力。

第一阶段目标：

* 页面视觉完整
* 业务逻辑完整
* 数据链路“看起来真实”
* 支持参数调整
* 支持一键启动规划
* 支持动态展示规划过程
* 支持展示多个规划方案
* 支持展示最终推荐方案

---

# 2. 产品定位

产品名称建议：

**Integrated Computing, Storage and Network Planning Simulation Platform**

中文：

**算存网一体化规划仿真平台**

副标题：

**面向Agent业务的算网存协同资源规划与数字孪生仿真**

核心价值表达：

> 输入业务 SLA 和业务规模，基于学习得到的业务负载模型，自动推演计算、网络、存储及 KV Cache 资源需求，并给出满足 SLA 的推荐基础设施方案。

---

# 3. 当前 Demo 范围

本阶段只实现前端 Mock Demo。

### 实现

* SLA 参数输入
* 业务模型选择
* 负载模型选择
* 负载放大倍数
* 新增业务入口
* 新增负载入口
* 小时级负载曲线
* 峰值、均值、峰均比
* P/D 节点规划
* KV Cache Pool 规划
* GPU 规划
* Spine-Leaf 网络规划
* Storage 规划
* SLA 仿真验证
* 多方案对比
* 推荐方案
* 规划过程动画

### 暂不实现

* Agent真实运行日志学习
* 真实负载模型训练
* 真实离散事件仿真
* 真实GPU性能模型
* 网络包级仿真
* 存储IO模型
* 数学优化求解器
* 数据库
* 后端服务

所有输出均由：

```text
Preset Dataset
+
Front-end Rules
+
Animation
```

实现。

---

# 4. 整体页面结构

建议采用单页 Dashboard。

```text
┌─────────────────────────────────────────────────────────────┐
│ Header：Integrated Computing, Storage and Network Planning Simulation Platform │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ 左侧输入区    │              主工作区                        │
│              │                                              │
│ SLA          │  ① 负载编译与特征                            │
│ 业务模型      │                                              │
│ 放大倍数      │  ② 规划寻优                                  │
│ 新增业务      │                                              │
│              │  ③ 规划结果                                  │
│ [仿真规划]    │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

建议比例：

* 左栏：280~320px
* 右侧：自适应
* 页面最小宽度：1440px
* 首选演示分辨率：1920×1080

---

# 5. 一级页面模块

建议页面只保留四个一级模块。

## 5.1 需求输入区

位于左侧。

包括：

### SLA目标

```text
TTFT              < 500 ms
TPOT              < 50 ms
吞吐率             > 5,000 token/s
并发用户           10,000
可用性             99.99%
```

控件建议：

* 数字输入框
* Slider
* 下拉框

但 Demo 第一版可以只让部分参数可编辑。

---

### 业务模型

强调：

> 业务模型是平台通过历史运行数据学习得到的，而不是现场人工填写。

展示方式：

```text
已学习业务模型

● RAG Agent
  知识问答业务

○ Coding Agent

○ Multi-turn Chat
```

每个业务模型可以带一个简短标签：

```text
RAG Agent
Learned Model · 30 Days
```

---

### 负载放大

这是演示重点。

```text
规划规模

当前业务规模
10,000 Users

放大倍率

[ 1× ] [ 2× ] [ 5× ] [ 10× ]

当前：
5×
```

对应：

```text
现网负载 → 未来业务负载
```

例如：

```text
当前峰值并发：10,000
规划峰值并发：50,000
```

---

### 新增业务 / 新增负载

两个入口即可：

```text
+ 新增业务模型
+ 导入负载模型
```

Demo阶段点击后显示 Modal。

不需要真正上传文件。

可以模拟：

```text
业务名称
业务类型
模型大小
采样周期
状态：已学习
```

---

### 仿真规划按钮

左侧最下方突出：

```text
开始仿真规划
```

点击后触发整套演示动画。

---

# 6. 负载编译模块

这是右侧第一层。

标题建议：

**业务负载编译**

副标题：

> 将学习得到的Agent业务模型转换为算网存基础设施负载需求

---

## 6.1 负载核心指标

建议展示 6 张卡片：

```text
请求峰值
12,800 req/s

平均请求
6,420 req/s

Input Token
18.4 M token/s

Output Token
4.2 M token/s

计算需求
3.8 EFLOPS

数据访问
32.6 GB/s
```

每个指标同时显示：

```text
Peak
Avg
P95
```

例如：

```text
Input Token

Avg     12.8 M/s
Peak    18.4 M/s
P95     16.9 M/s
```

---

# 7. 小时级负载分布

必须作为负载编译区域的核心图。

标题：

**24小时业务负载分布**

横轴：

```text
00:00 → 24:00
```

纵轴可切换：

```text
Request
Input Token
Output Token
GPU Load
Network
Storage IO
```

推荐默认展示：

* 请求量
* Input Token
* Output Token

例如：

```text
凌晨低谷
06:00 开始增长
10:00 第一峰
14:00 第二峰
20:00 最大峰值
```

右侧显示：

```text
峰值时刻     20:00
平均负载     6,420 req/s
峰值负载     12,800 req/s
峰均比       1.99
Burst Factor 2.18
```

---

# 8. 规划寻优模块

负载编译和规划寻优可以放在同一视觉层。

标题：

**基础设施规划寻优**

呈现方式不要只是“Loading”。

建议模拟真实优化过程。

例如：

```text
正在搜索基础设施方案

候选方案：
356

已评估：
214

满足SLA：
46

当前最优：
Solution #183
```

配一个进度条：

```text
██████████████████░░░░
71%
```

---

# 9. 寻优目标

建议在该区域明确展示目标：

```text
优化目标

✓ SLA满足
✓ GPU数量最少
✓ TCO最低
✓ HBM利用率最大
✓ 网络无拥塞
✓ Storage满足峰值IO
```

内部可以用一个评分公式做视觉表达：

```text
Planning Score

SLA         40%
Cost        25%
Utilization 20%
Reliability 15%
```

不需要真正算。

---

# 10. P/D节点规划

这是第一类核心规划结果。

标题：

**Prefill / Decode 推理架构规划**

页面展示两个 Cluster。

```text
Prefill Cluster

P Nodes
32

GPU / Node
8 × H100

Total GPU
256
```

以及：

```text
Decode Cluster

D Nodes
64

GPU / Node
8 × H100

Total GPU
512
```

可以显示关系：

```text
             KV Transfer
Prefill ─────────────────→ Decode
```

配：

```text
P:D Ratio

1 : 2
```

---

# 11. KV Cache Pool规划

这是 Demo 的另一个核心亮点。

标题：

**KV Cache Pool规划**

首先显示：

```text
Total KV Cache Pool

20.4 TB
```

下面是三级存储。

```text
HBM
8.2 TB
40%

DDR
7.1 TB
35%

SSD
5.1 TB
25%
```

视觉上推荐使用：

### 堆叠条

```text
HBM ████████████
DDR ██████████
SSD ███████
```

或者环形图。

---

同时增加性能信息：

| 层级  |    容量 |  占比 | 用途   |
| --- | ----: | --: | ---- |
| HBM | 8.2TB | 40% | 热 KV |
| DDR | 7.1TB | 35% | 温 KV |
| SSD | 5.1TB | 25% | 冷 KV |

演示逻辑：

```text
Recent / Hot KV
        ↓
HBM

Warm KV
        ↓
DDR

Cold KV
        ↓
SSD
```

---

# 12. Compute规划结果

标题：

**计算资源规划**

展示：

```text
GPU型号
H100 80GB

GPU总数
768

Prefill GPU
256

Decode GPU
512

服务器节点
96

目标GPU利用率
72%
```

为了更像规划工具，可以增加：

```text
Current
384 GPU

Planned
768 GPU

Growth
+100%
```

---

# 13. Network规划结果

这是必须重点强化的部分。

标题：

**Spine-Leaf网络规划**

直接展示拓扑：

```text
              Spine × 8
        ─────────────────────
          │       │       │

      Leaf ×32  Leaf ×32 ...

          │       │

       GPU Server
```

核心结果：

```text
Spine

数量：
8

规格：
64 × 400GbE


Leaf

数量：
32

规格：
48 × 400GbE


ToR

数量：
96

规格：
32 × 200GbE
```

同时展示：

```text
总Fabric带宽
25.6 Tbps

Oversubscription
1 : 1

平均利用率
63%

峰值利用率
81%

RDMA
Enabled
```

---

# 14. Storage规划

这里建议区分：

### 普通业务数据 Storage

和：

### KV Cache Pool

避免概念混淆。

Storage规划：

```text
业务数据存储

容量
320 TB

Read BW
32 GB/s

Write BW
12 GB/s

IOPS
4.2 M
```

下面可以显示：

```text
NVMe
120 TB

SSD
160 TB

Object Storage
40 TB
```

---

# 15. 最终规划结果区域

页面最下面做一个非常明显的：

# 推荐基础设施方案

建议使用 4 张大卡片。

```text
计算资源

96 Nodes
768 H100 GPU
```

```text
网络资源

8 Spine
32 Leaf
400GbE Fabric
```

```text
KV Cache

20.4 TB

HBM 40%
DDR 35%
SSD 25%
```

```text
Storage

320 TB
32 GB/s
4.2M IOPS
```

---

# 16. SLA验证

最终结果旁边加入：

**SLA Simulation Validation**

例如：

| SLA          |            目标 |   规划仿真值 | 状态   |
| ------------ | ------------: | ------: | ---- |
| TTFT         |        <500ms |   420ms | PASS |
| TPOT         |         <50ms |    38ms | PASS |
| Throughput   | >5000 token/s |    6240 | PASS |
| Availability |        99.99% | 99.995% | PASS |

非常适合演示时讲：

> 这个方案不是简单算资源，而是经过仿真验证之后满足业务SLA。

---

# 17. Demo交互流程

建议规划成 5 个步骤。

### Step 1

用户选择：

```text
RAG Agent
```

设置：

```text
SLA:
TTFT 500ms
TPOT 50ms

Scale:
5×
```

---

### Step 2

点击：

```text
开始仿真规划
```

按钮进入：

```text
Analyzing Workload...
```

持续 1 秒左右。

---

### Step 3

展示负载编译：

图表动态加载。

```text
Peak Request:
12,800 req/s

Peak Token:
18.4M/s
```

---

### Step 4

寻优过程运行。

动态刷新：

```text
Searching Configuration

10 / 500
57 / 500
126 / 500
...
```

同时方案会变化：

```text
P: 16
D: 96

↓

P: 24
D: 80

↓

P: 32
D: 64
```

让客户直观感受到：

> 系统正在“搜索最优解”。

---

### Step 5

锁定推荐方案。

弹出：

```text
Planning Completed

Recommended Solution
```

最下方资源结果全部亮起。

---

# 18. 建议准备三套预置Demo数据

为了客户演示效果，不建议只有一个场景。

### Scenario A：RAG Agent

```text
特点：

Storage重
KV Cache中等
LLM调用高
```

规划结果：

```text
P 32
D 64
KV 20TB
```

---

### Scenario B：长上下文Chat

特点：

```text
KV Cache非常重
DDR/SSD Pool大
```

例如：

```text
P 24
D 96

KV Cache:
48TB
```

---

### Scenario C：Coding Agent

特点：

```text
Tool调用频繁
Output Token较大
Decode压力高
```

结果：

```text
P 16
D 128
```

这样切业务模型时，规划结果变化会非常明显。

---

# 19. 推荐Mock数据结构

前端建议全部放：

```text
mock/
```

目录。

例如：

```text
mock
 ├── scenarios.json
 ├── rag-agent.json
 ├── chat-agent.json
 ├── coding-agent.json
 ├── planning-result.json
 └── optimization-process.json
```

业务模型：

```json
{
  "scenario": "rag-agent",
  "name": "RAG Agent",
  "scale": 5,
  "sla": {
    "ttft": 500,
    "tpot": 50,
    "throughput": 5000
  }
}
```

小时级负载：

```json
{
  "hourlyLoad": [
    {
      "hour": "00:00",
      "requests": 3200,
      "inputTokens": 5.2,
      "outputTokens": 1.1
    },
    {
      "hour": "01:00",
      "requests": 2800,
      "inputTokens": 4.8,
      "outputTokens": 0.9
    }
  ]
}
```

---

规划结果：

```json
{
  "compute": {
    "gpu": "H100 80GB",
    "gpuCount": 768,
    "nodes": 96
  },

  "pd": {
    "prefillNodes": 32,
    "decodeNodes": 64
  },

  "kvCache": {
    "totalTB": 20.4,
    "hbm": 40,
    "ddr": 35,
    "ssd": 25
  },

  "network": {
    "spineCount": 8,
    "spineSpec": "64x400GbE",
    "leafCount": 32,
    "leafSpec": "48x400GbE",
    "fabricBandwidth": "25.6Tbps"
  },

  "storage": {
    "capacity": "320TB",
    "throughput": "32GB/s",
    "iops": "4.2M"
  }
}
```

---

# 20. 前端技术方案

如果只是做一个高质量演示 Demo，我建议：

```text
React
+
TypeScript
+
Vite
```

UI：

```text
Ant Design
```

或者：

```text
Tailwind CSS
```

图表：

```text
Apache ECharts
```

特别适合：

* 小时级曲线
* KV Cache占比
* GPU负载
* 寻优散点
* Network拓扑

动画：

```text
Framer Motion
```

拓扑：

简单版本直接：

```text
SVG
```

即可。

没必要第一版引入复杂3D。

---

# 21. 推荐工程结构

```text
src/

├── components/
│
│   ├── SLAInput
│   ├── WorkloadSelector
│   ├── WorkloadChart
│   ├── OptimizationPanel
│   ├── PDPlanner
│   ├── KVCachePlanner
│   ├── ComputePlanner
│   ├── NetworkPlanner
│   ├── StoragePlanner
│   └── SLAValidation
│
├── mock/
│
├── pages/
│   └── PlanningDashboard
│
├── services/
│   └── mockPlanningService
│
└── App.tsx
```

注意：

即使没有后端，也建议设计：

```text
mockPlanningService
```

而不要组件直接读取 JSON。

这样未来接真实仿真引擎时：

```text
Mock Service

↓

REST API
```

前端基本不用重构。

---

# 22. 状态机设计

前端最好明确规划状态：

```text
IDLE

↓

COMPILING

↓

OPTIMIZING

↓

VALIDATING

↓

COMPLETED
```

页面对应：

### IDLE

```text
等待开始规划
```

### COMPILING

```text
正在编译业务负载...
```

### OPTIMIZING

```text
正在搜索最优基础设施方案...
```

### VALIDATING

```text
正在执行SLA仿真验证...
```

### COMPLETED

```text
规划完成
```

这会极大增强 Demo 的“仿真感”。

---

# 23. UI视觉建议

整体继续保持：

```text
Dark Theme
```

主背景：

```text
#07111F
```

模块背景：

```text
#0D1B2A
```

强调信息可以用：

```text
蓝色
青色
紫色
绿色
```

但不要过度“科幻大屏”。

更推荐：

> 企业级 AI Infra 工具 + 少量科技视觉

也就是更接近：

```text
Datacenter Planning Tool
+
Cloud Management Console
+
AI Digital Twin
```

而不是 NOC 监控大屏。

---

# 24. 页面信息层级建议

最终页面从上到下：

```text
① SLA + 业务负载输入

          ↓

② 业务负载编译
   Hourly Distribution
   Peak / Avg / P95

          ↓

③ 基础设施规划寻优
   Search / Compare / Select

          ↓

④ P/D + KV Cache + Compute
   Network + Storage

          ↓

⑤ 推荐基础设施方案

          ↓

⑥ SLA仿真验证
```

整个 Demo 最核心的一句话可以放在页面顶部：

> **从业务SLA出发，自动规划满足未来Agent负载需求的算力、网络、存储与KV Cache基础设施。**

第一阶段前端只要把这条链路表现完整，即使后端全部是预设数据，也已经足够用于方案交流。
