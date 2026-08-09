# 面向算网存一体化仿真的网络建模与 TENT 数据搬运调度分析

## 1. 背景

大模型推理服务正在从单机、单实例逐步演进到：

- 多 NPU / GPU 并行；
- Prefill / Decode 分离；
- HBM / DDR / SSD 多层级 KV Cache；
- 跨服务器、跨机柜甚至跨数据中心的数据复用；
- 算力、存储与网络资源池化。

在这类系统中，网络不再只是“把已经确定的数据从 A 送到 B”，而会直接影响：

- TTFT；
- TPOT；
- 请求吞吐；
- P99 尾时延；
- KV Cache 复用收益；
- 算力利用率；
- 存储池化收益。

因此，算网存一体化仿真的网络部分不能只建模“链路带宽 + 时延”，还需要显式描述：

> 业务如何产生数据流、数据如何映射到传输资源、网络如何承载这些数据，以及网络状态如何反向影响算力和存储调度。
   
---

# 2. 基础概念

## 2.1 NPU / GPU

NPU / GPU 是计算和 HBM 数据的生产、消费节点。

例如一个 Prefill 实例完成计算以后，KV Cache 首先位于：

```text
Prefill NPU HBM
```

如果 Decode 实例在另一张卡或者另一台服务器，则需要发生数据移动。

NPU 本身与 NIC、网络交换机是不同层级的资源。

---

## 2.2 HBM / DDR / SSD

推理系统常见的数据层级：

```text
HBM
 ↓
DDR
 ↓
SSD / NVMe
 ↓
Remote Storage
```

特点大致为：

| 层级 | 特点 |
|---|---|
| HBM | 容量小、带宽最高、距离计算最近 |
| DDR | 容量较大、速度低于 HBM |
| SSD | 容量大、访问时延明显增加 |
| Remote Pool | 容量进一步池化，但引入网络 |

KV Cache 在这些层级间迁移时，本质上会产生数据搬运请求。

---

## 2.3 NIC

NIC（Network Interface Card）是服务器实际连接外部网络的物理网络接口。

例如：

```text
Server A

NPU0
NPU1
NPU2
NPU3

NIC0 400G
NIC1 400G
```

跨服务器通信最终需要经过 NIC：

```text
NPU HBM
   ↓
服务器内部 I/O
   ↓
NIC
   ↓
交换网络
   ↓
Remote NIC
   ↓
Remote NPU / DDR
```

NIC 是物理设备。

---

## 2.4 PCIe Root / PCIe Switch / NUMA

服务器内部，NPU 和 NIC 通常不是任意等价连接。

典型结构：

```text
                CPU / SoC

          ┌────────┴─────────┐
       PCIe Root0         PCIe Root1
          │                   │
      PCIe Switch          PCIe Switch
       /      \             /      \
    NPU0     NIC0        NPU4      NIC2
```

PCIe Root Complex 是 PCIe 拓扑的根节点。

PCIe Switch 用于在多个 Endpoint 之间提供互连。

NPU、NIC 都可以作为 PCIe Endpoint。

因此：

```text
NPU0 → NIC0
```

和：

```text
NPU0 → NIC2
```

虽然都可以完成通信，但成本可能不同。

前者可能：

```text
NPU0
 ↓
同一个 PCIe Root
 ↓
NIC0
```

后者可能：

```text
NPU0
 ↓
PCIe Root0
 ↓
跨 NUMA / CPU Socket
 ↓
PCIe Root1
 ↓
NIC2
```

因此通信软件会考虑 NPU 与 NIC 的拓扑亲和性。

---

## 2.5 NUMA

NUMA（Non-Uniform Memory Access）的核心含义是：

> 一个处理器访问“附近资源”和“远端资源”的代价不同。

例如：

```text
NUMA 0                  NUMA 1

NPU0                    NPU4
NIC0                    NIC2
DDR0                    DDR1
```

NPU0 使用 NIC0：

```text
同 NUMA
→ 路径短
→ 带宽通常更好
```

NPU0 使用 NIC2：

```text
跨 NUMA
→ 经过额外互连
→ 可能降低有效带宽
```

---

## 2.6 静态 NUMA 优先级

所谓“静态 NUMA 优先级”，就是根据硬件拓扑提前确定：

```text
对 NPU0：

NIC0：优先级 1
NIC1：优先级 2
NIC2：优先级 3
```

它关注：

- 是否同 NUMA；
- 是否同 PCIe Root；
- 是否跨 Socket；
- 理论链路能力。

特点是：

> 只看“理论上谁离我近”，不看“现在谁更空闲”。

例如：

```text
NIC0：同 NUMA，但当前 95% busy
NIC2：跨 NUMA，但当前几乎空闲
```

静态策略仍可能优先 NIC0。

TENT 的核心改进之一，就是在静态亲和性之外加入运行时状态。

---

# 3. Fabric、Link、Path 和 Rail

这几个概念需要严格区分。

## 3.1 Link

Link 是一条具体物理链路。

例如：

```text
NIC0 ───── Leaf0
```

或者：

```text
Leaf0 ───── Spine2
```

---

## 3.2 Path

Path 是一次通信经过的一组链路。

例如：

```text
NIC0
 ↓
Leaf0
 ↓
Spine2
 ↓
Leaf8
 ↓
NIC4
```

这是一个网络内部 Path。

---

## 3.3 Fabric

Fabric 是一整个互连网络。

例如：

```text
Server
 ↓
Leaf
 ↓
Spine
 ↓
Leaf
 ↓
Server
```

整个 Leaf-Spine 网络可以称为：

```text
Network Fabric
```

服务器内部：

```text
NPU
 ↕
PCIe Switch
 ↕
CPU / NIC
```

也可以称作：

```text
PCIe / I/O Fabric
```

所以：

> Link 是一条边，Path 是一串边，Fabric 是整个互连图。

---

## 3.4 Rail

Rail 不是一种物理硬件。

它更接近：

> 通信软件可以独立使用的一条端到端传输资源。

最简单情况下：

```text
Rail0：
Server A NIC0
→ Network
→ Server B NIC0

Rail1：
Server A NIC1
→ Network
→ Server B NIC1
```

所以常见情况下：

```text
一个 NIC Port ≈ 一条 Rail
```

但严格来说 Rail 还可能包含：

- Source NIC；
- Destination NIC；
- RDMA Endpoint；
- Transport Backend；
- PCIe / NUMA affinity；
- 对应网络可达性。

因此：

```text
Rail ≠ 单纯一张 NIC
```

---

# 4. Flow、Chunk、Slice 和 Packet

## 4.1 Flow

Flow 可以理解为一次逻辑上的大规模数据传输。

例如：

```text
Prefill Server
     │
     │ 2 GB KV Cache
     ↓
Decode Server
```

这 2 GB KV 可以视为一个大的业务数据 Flow。

---

## 4.2 Chunk / Slice

Transfer Engine 不会一次把 2 GB 当作一个不可拆分对象。

通常会切成：

```text
Flow
 ↓
Chunk / Slice 0
Chunk / Slice 1
Chunk / Slice 2
...
```

Slice 是传输调度层的粒度。

---

## 4.3 Packet

Slice 进入 RDMA / Ethernet 等底层协议后，还会继续形成真正的网络 Packet。

因此层级是：

```text
Flow
 ↓
Slice / Chunk
 ↓
Rail / Transport
 ↓
Network Packet
```

不能把 Slice Size 与网络 MTU / Packet Size 混为一谈。

---

# 5. Endpoint 和 QP

## 5.1 Endpoint

Endpoint 是通信软件看到的一个通信端点。

例如：

```text
Server A NPU0
      ↓
RDMA
      ↓
Server B NPU4
```

软件里会建立 Endpoint，记录：

- 对端身份；
- 网络地址；
- 使用的 NIC；
- Transport；
- 连接状态。

可以粗略理解为：

> “我要和谁通信”的软件对象。

---

## 5.2 QP

QP（Queue Pair）是 RDMA / InfiniBand / RoCE 中的重要通信对象。

典型包含：

```text
Send Queue
+
Receive Queue
```

应用提交：

```text
RDMA WRITE
src address
dst address
length
```

到发送队列。

NIC / HCA 根据 QP 保存的连接信息完成实际传输。

可以把 QP 粗略理解为：

> RDMA 世界中建立在 NIC 上的一条硬件通信通道。

---

# 6. Transport Backend

Transport Backend 指真正执行数据搬运的底层机制。

典型包括：

- RDMA / RoCE；
- InfiniBand；
- TCP；
- NVLink；
- PCIe P2P；
- Host DDR staging；
- GDS / Storage transport；
- Ascend UB 等。

上层希望统一调用：

```text
Transfer(src, dst, size)
```

底下可以映射成不同 Backend。

例如：

```text
HBM → HBM
```

可能通过：

```text
Direct RDMA
```

也可能由于硬件限制变成：

```text
HBM
 ↓
DDR
 ↓
RDMA
 ↓
DDR
 ↓
HBM
```

后者称为 staging / compound path。

---

# 7. ECMP 与网络内部选路

需要特别强调：

> TENT 并不等于取代交换机 ECMP。

假设 TENT 已经选择：

```text
Rail1：
Source NIC1 → Destination NIC1
```

进入网络后：

```text
NIC1
 ↓
Leaf0
 ↓
Spine0 / Spine1 / Spine2
 ↓
Leaf8
 ↓
NIC1
```

具体经过哪个 Spine，仍可能由：

- ECMP；
- Adaptive Routing；
- Flowlet Routing；
- 网络控制面；

决定。

因此可以分成：

```text
业务调度：
谁和谁通信

      ↓

TENT / Transfer Engine：
用什么 transport / rail

      ↓

Network Fabric：
具体 Leaf / Spine 路径
```

---

# 8. 灵衢 UB：统一总线视角

灵衢 UB 的理念与传统“服务器 + NIC + 网络”不同。

传统模式：

```text
NPU A
 ↓
通信库
 ↓
NIC
 ↓
Network
 ↓
NIC
 ↓
NPU B
```

UB 更希望抽象为：

```text
NPU / CPU / Memory / Storage
          │
          ↓
     Unified Bus Fabric
```

其目标是：

> 将跨芯片、跨板、跨节点资源统一到一个更接近“总线”的访问体系。

---

## 8.1 统一寻址

传统远端访问首先认为：

```text
这是一个 Remote Node
```

然后建立通信。

UB 希望首先认为：

```text
这是一个可以访问的远端资源
```

通过：

- Endpoint / Entity ID；
- Memory Segment；
- Address；
- Token / Permission；
- 地址翻译；

建立跨节点资源访问。

---

## 8.2 UMMU

可以把 UMMU 粗略理解为：

> 面向统一互联空间的地址翻译与权限管理组件。

类似传统：

```text
Virtual Address
 ↓
MMU
 ↓
Physical Address
```

扩展为：

```text
Global / Remote Address
 ↓
UMMU
 ↓
目标设备实际 Memory Address
```

---

## 8.3 UB 对仿真的意义

在传统 RoCE 架构中：

```text
存储位置
+
网络传输
```

是两个相对明确的阶段。

UB 下，两者更容易融合为：

> 一个远端资源访问问题。

因此仿真需要进一步关注：

- Local vs Remote Access；
- UB domain；
- TP Channel；
- 多路径；
- Switch contention；
- 统一地址空间中的资源位置；
- Load / Store 与 Bulk Transfer 的差异。

---

# 9. TENT 要解决什么问题

TENT 面向的是：

> Disaggregated LLM Serving 中的大规模数据移动。

典型场景包括：

- P/D 分离后的 KV Cache 传输；
- Remote Prefix Cache；
- HBM / DDR 数据迁移；
- Tensor / Checkpoint 数据移动；
- 多 NIC / Multi-Rail 环境。

---

# 10. TENT 之前的方案

以传统 Transfer Engine / UCX / Mooncake TE 类方案为例，大数据传输通常已经支持：

```text
大 Flow
 ↓
切 Chunk
 ↓
Multi-Rail
```

因此 TENT 的创新并不是：

> 从单路径变成多路径。

而是：

> 从静态、状态无感知的 Multi-Rail 分配，变成运行时状态感知的 Slice Spraying。

传统方式可以简化为：

```text
2 GB KV

 ↓ 切块

Chunk 0 → Rail0
Chunk 1 → Rail1
Chunk 2 → Rail2
Chunk 3 → Rail3
Chunk 4 → Rail0
...
```

依据通常是：

- Round Robin；
- Hash；
- 静态 NIC 带宽；
- 静态 NUMA affinity。

问题是它不知道：

```text
Rail0 现在很空闲
Rail1 现在很空闲
Rail2 现在严重拥塞
Rail3 现在很空闲
```

仍可能继续：

```text
25% → Rail2
```

导致 Rail2 形成队列和 Straggler。

最后整个大 Flow 的完成时间被最慢 Rail 拖住。

---

# 11. TENT 新增了什么

TENT 可以抽象为新增一个：

> 面向数据搬运的运行时编排层 / Data Movement Orchestrator。

位置：

```text
LLM Serving Runtime
       │
       │ Transfer Intent
       ↓
┌─────────────────────────┐
│          TENT           │
│                         │
│ Topology Discovery      │
│ Transfer Planning       │
│ Slice Scheduling        │
│ Runtime Telemetry       │
│ Online Feedback         │
│ Failure Handling        │
└───────────┬─────────────┘
            ↓
 RDMA / TCP / NVLink / UB
            ↓
      Network Fabric
```

它不替代：

- 推理 Scheduler；
- RDMA；
- NIC；
- Switch；
- ECMP。

而是在这些机制上增加：

> 数据对象 → 传输资源的动态映射。

---

# 12. TENT 管什么请求

TENT 不管用户请求本身。

例如：

```text
User Request
"请生成一篇文章"
```

不会直接进入 TENT。

推理服务首先处理：

```text
Request
 ↓
Prefill
 ↓
KV Cache
```

当系统需要进行：

```text
P → D KV transfer
DDR → HBM
HBM → Remote HBM
Remote Prefix Fetch
```

时，上层框架生成：

```text
Transfer Request
```

TENT 管的是这种 Data Movement Request。

---

# 13. TENT 的输入

TENT 的业务输入可以抽象为：

```text
Source
Destination
Length
Priority / QoS
```

例如：

```text
src = Server A GPU/NPU Memory
dst = Server B GPU/NPU Memory
size = 200 MB
priority = high
```

---

# 14. 模型特征如何进入 TENT

TENT 本身并不直接理解：

- Qwen；
- DeepSeek；
- Attention Layer；
- TP；
- Prefix 长度；
- FLOPs。

模型与计算特征首先由推理框架转换成数据搬运量。

例如：

```text
模型结构
+
KV Cache Layout
+
Input Length
+
Prefix Cache Hit
+
TP / CP 配置
        ↓
推理框架
        ↓
确定需要哪些 KV Block
        ↓
转换成 byte ranges
        ↓
Transfer Intent
        ↓
TENT
```

例如：

```text
Input = 32K token
Prefix Hit = 24K

 ↓

推理框架确定：
需要从 Remote DDR 读取 24K 对应 KV

 ↓

最终形成：
src
dst
size = 1.2 GB
```

所以：

> 模型决定“产生多少、在哪里产生、需要搬什么”；TENT决定“这些数据如何在网络资源上搬”。

---

# 15. TENT 如何获得网络特征

TENT 的网络信息分为两类。

## 15.1 静态 / 慢变信息

包括：

- Source / Destination 拓扑；
- PCIe / NUMA affinity；
- NIC；
- Rail；
- Transport Backend；
- 可达性；
- 理论带宽；
- Local / Remote distance。

例如：

```text
Rail0：
Same NUMA
400G

Rail1：
Cross NUMA
400G
```

虽然理论 NIC 带宽一样，Rail0 可能具有更低的本地 I/O 成本。

---

## 15.2 动态信息

包括：

- 当前 queued bytes；
- in-flight bytes；
- 实际 completion latency；
- 当前有效 bandwidth；
- failure / timeout；
- 历史预测误差。

关键是：

> TENT 不一定需要直接知道“Spine2 Buffer 目前 83%”。

如果网络中间发生拥塞：

```text
NIC
 ↓
Leaf
 ↓
Spine ← congestion
 ↓
Leaf
```

最终会表现为：

```text
这个 Rail 的实际完成时间变长
```

TENT 就可以通过端到端 completion telemetry 感知：

```text
这个 Rail 当前实际变慢了。
```

---

# 16. TENT 是否有“记忆”

有，但主要是运行时短期状态，而不是长期业务模型。

例如过去几个 Slice：

```text
Rail0：
预测 5 us
实际 5.3 us

Rail1：
预测 5 us
实际 15 us
```

系统会更新 Rail1 的性能估计。

因此下一次新的 200 MB Transfer 到来时：

```text
Rail1
```

即使当前静态配置仍然是 400G，也可能被降低使用优先级。

所以：

> TENT 不仅在同一个大 Transfer 内动态变化，其近期观测也会影响后续 Transfer。

但这种“记忆”主要是：

```text
Online Telemetry / EWMA / Runtime State
```

而不是永久学习：

```text
Rail1 永远不好
```

Rail1 恢复之后，状态估计也会重新变好。

---

# 17. TENT 如何决策

假设有一个 200 MB KV Transfer。

首先切成多个 Slice：

```text
200 MB
 ↓
Slice0
Slice1
Slice2
...
```

对于每个 Slice，TENT考察多个候选 Rail。

例如：

```text
Rail0
Rail1
Rail2
```

核心考虑：

```text
预计完成时间
≈
当前 Rail 已排队数据
+
本 Slice 数据量
───────────────
当前有效带宽

+
拓扑 / NUMA 成本
+
运行时校正
```

可以抽象为：

```text
Cost(Rail)
=
Queue Cost
+
Transfer Cost
+
Topology Cost
+
Runtime Penalty
```

选择：

```text
预计最快完成的 Rail
```

---

# 18. TENT 的 Late Binding

传统方式：

```text
200 MB 开始时

50 MB → Rail0
50 MB → Rail1
50 MB → Rail2
50 MB → Rail3
```

一开始就决定完。

TENT：

```text
Slice0 发之前
→ 看当前状态
→ Rail1

Slice1 发之前
→ 再看
→ Rail1

Slice2 发之前
→ Rail1 排队增加
→ Rail0

Slice3
→ Rail2
```

也就是：

> Slice 在真正发送时才与具体 Rail 绑定。

这就是 Late Binding。

---

# 19. TENT 与 ECMP 的边界

需要明确：

```text
TENT
```

主要决定：

- Transport Backend；
- Source / Destination Rail；
- Slice → Rail；
- Direct / Staging；
- Failure fallback。

网络内部：

```text
Leaf → Spine → Leaf
```

具体经过哪个 Spine，仍由：

- ECMP；
- Adaptive Routing；
- Network Controller；

负责。

因此：

```text
业务层
决定 Who talks to whom

      ↓

TENT
决定 How data maps to transport resources

      ↓

Network Fabric
决定 How packets traverse switches
```

---

# 20. TENT 的适用边界

TENT 的收益依赖于：

> 系统确实存在多个可以选择的数据搬运资源。

适合：

```text
多 NIC
多 Rail
异构 Interconnect
多种 Transport
存在运行时负载波动
存在链路性能不均
```

如果系统：

```text
Source / Destination 已确定
Transport 唯一
NIC 唯一
Rail 唯一
```

那么：

```text
TENT 可优化空间接近 0
```

例如单 Rail：

```text
NPU A
 ↓
NIC0
 ↓
Network
 ↓
NIC0
 ↓
NPU B
```

没有第二条可用路径，动态调度也无法创造新带宽。

---

# 21. TENT 最终优化效果的性能链

TENT直接优化的不是 TTFT，而是：

```text
Data Transfer Completion Time
```

传导关系：

```text
更合理的 Slice → Rail Mapping
          ↓
减少 Rail Straggler
          ↓
降低 HoL Blocking
          ↓
提升 Multi-Rail 有效利用率
          ↓
KV Transfer Latency ↓
          ↓
Decode 更早获得 KV
          ↓
TTFT ↓
Throughput ↑
P99 ↓
```

因此：

> TENT 是通过优化 Data Movement，间接改善推理服务性能。

---

# 22. TENT 的本质总结

一句话：

> TENT 并不是重新设计底层网络，而是在推理框架与传输系统之间增加一个业务数据移动编排层，将原来静态、状态无感知的 Multi-Rail 数据分配，变成基于拓扑和实时运行状态的 Slice 级动态调度。

更进一步：

```text
以前：
Flow → 固定映射 → Network

TENT：
Flow
 ↓
Slice
 ↓
Runtime Orchestration
 ↓
动态 Rail Mapping
 ↓
Network
```

其真正增加的是：

> “业务数据如何映射到网络资源”这一新的系统优化维度。

---

# 23. 算网存一体化仿真的整体建模框架

如果以网络为中心，可以将系统建模为：

```text
业务 / Agent / LLM
        │
        ↓
计算需求
Prefill / Decode / Tool / RAG
        │
        ↓
数据依赖
KV / Tensor / RAG Data / Memory
        │
        ↓
Data Movement
        │
        ↓
Network Fabric
        │
        ↓
计算 / 存储下一阶段
```

网络不是独立模块，而是串联计算和存储状态变化的核心资源。

---

# 24. 第一类寻优：网络感知的算力放置

传统做法：

```text
先决定 P / D 在哪里
      ↓
再计算网络代价
```

更好的方式：

```text
Network Cost
+
Compute Load
        ↓
联合决定 P / D Placement
```

优化变量包括：

- Prefill 实例位置；
- Decode 实例位置；
- P/D 配对；
- TP / DP 实例跨节点布局；
- Agent 服务节点布局；
- Tool / RAG 服务位置。

例如：

```text
P0 → D0
同 Rack
网络代价 1

P0 → D4
跨 Pod
网络代价 5
```

如果两台 D 算力负载相近：

```text
优先 D0
```

就可以直接减少 KV Transfer latency。

---

# 25. 第二类寻优：网络感知的存储放置

对象包括：

- KV Cache；
- Prefix Cache；
- DDR Cache；
- SSD Cache；
- RAG 数据；
- Memory 数据。

可优化：

```text
数据放在哪里
```

例如同一个 Prefix：

```text
HBM
DDR@Local
DDR@Remote
SSD
Global Pool
```

需要综合：

```text
Hit Probability
×
Compute Saving
-
Transfer Cost
```

而不是只追求最高 Cache Hit Rate。

例如：

```text
远端命中节省 Prefill 100 ms
网络搬运需要 10 ms

→ 值得复用
```

反之：

```text
节省 Prefill 5 ms
远端搬运 20 ms

→ 直接重算可能更优
```

---

# 26. 第三类寻优：业务数据流编排

这是 TENT 最直接启发的部分。

将：

```text
KV / Tensor / RAG Data
```

显式建模为 Flow。

优化变量：

### Slice Size

```text
64 KB
256 KB
1 MB
...
```

太大：

- 动态性差；
- 容易形成 Straggler。

太小：

- 调度开销增加；
- 描述符数量增加。

---

### Multi-Rail Degree

例如：

```text
1 Rail
2 Rails
4 Rails
8 Rails
```

需要权衡：

- 总带宽；
- Rail 数量；
- 调度开销；
- NUMA / PCIe 瓶颈。

---

### Slice → Rail Mapping

策略可以比较：

```text
Round Robin
Hash
Static NUMA Affinity
Least Queue
Shortest Completion Time
TENT-like Dynamic Scheduling
```

---

### Transfer Priority

例如：

```text
TTFT-critical KV
> background Cache Migration
```

避免后台迁移占满网络造成在线请求 Tail Latency 恶化。

---

# 27. 第四类寻优：网络内部路由

数据进入 Network Fabric 后，还可以优化：

- ECMP；
- Weighted ECMP；
- Adaptive Routing；
- Flowlet Routing；
- Flow Spraying；
- Packet Spraying；
- UB TP Channel；
- TPG；
- Congestion-aware Routing。

目标：

```text
降低热点
降低排队
降低 Tail Latency
提升 Fabric 利用率
```

这一层与 TENT 是互补关系。

---

# 28. 第五类寻优：拥塞控制与 QoS

可建模：

- Queue Size；
- Queue Scheduling；
- ECN Threshold；
- PFC Threshold；
- Watermark；
- Priority Queue；
- Rate Limit；
- Bandwidth Reservation；
- Admission Control。

例如：

```text
KV Critical Flow
Priority High

Checkpoint Migration
Priority Low
```

可以避免：

```text
大后台流
→ 阻塞小型 TTFT-critical flow
```

---

# 29. 第六类寻优：网络资源配置

这是偏规划期的寻优。

例如：

### NIC 数量

```text
2 × 400G
vs
4 × 200G
```

虽然总理论带宽相同：

```text
800G
```

但：

- Rail 数量不同；
- Multi-Rail 灵活性不同；
- 故障域不同；
- HoL Blocking 风险不同。

---

### Leaf / Spine 配置

可以优化：

- Spine 数量；
- Uplink 数量；
- Oversubscription Ratio；
- Rack Scale；
- Pod Scale；
- Cross-DC Bandwidth。

---

### UB / RoCE / Mixed Fabric

未来异构系统中还可以比较：

```text
RoCE Fabric
UB Fabric
Local HCCS
Cross-DC Ethernet
```

不同业务流选择不同 Transport。

---

# 30. 网络侧建议重点抽象的六个优化维度

如果不希望模型过于复杂，可以压缩成六类：

| 维度 | 典型决策变量 |
|---|---|
| 业务-网络映射 | Request / KV → NIC / Rail |
| 数据流编排 | Slice、并发度、Spraying、优先级 |
| 网络感知部署 | P/D、Tool、RAG、Cache Placement |
| 路由 | ECMP、Adaptive Routing、Multi-Path |
| 拥塞与 QoS | Queue、ECN/PFC、Watermark、带宽 |
| 资源规划 | NIC、Rail、Fabric、Cross-DC Bandwidth |

---

# 31. 对“网为中心”算网存仿真的核心变化

传统网络仿真：

```text
业务已经确定
      ↓
生成 Flow
      ↓
Network Simulation
      ↓
Latency / Throughput
```

网络只是被动承载。

网为中心的算网存一体仿真应该变成：

```text
业务
 ↓
计算 / 存储需求
 ↓
产生数据依赖
 ↓
网络状态参与决策
 ↓
Placement
Pairing
Cache Location
Slice
Rail
Routing
QoS
 ↓
网络执行
 ↓
影响计算 / 存储状态
 ↓
TTFT / TPOT / Throughput / P99
 ↓
反向寻优
```

也就是：

> 网络不仅是性能模型，而且成为调度和寻优的输入变量。

---

# 32. 推荐的仿真输入

## 业务输入

- 请求到达率；
- Input / Output Length；
- Prefix Hit；
- Agent 调用概率；
- Tool / RAG / Memory 数据量；
- P/D 关系。

## 计算输入

- 模型结构；
- 并行方式；
- Prefill / Decode 性能画像；
- NPU 利用率；
- HBM 状态。

## 存储输入

- KV Block 位置；
- HBM / DDR / SSD 容量；
- Cache Hit；
- 数据迁移量。

## 网络输入

### 静态拓扑

- NPU；
- PCIe；
- NUMA；
- NIC；
- Rail；
- Leaf / Spine；
- UB Link。

### 网络性能

- Link bandwidth；
- propagation latency；
- queue；
- switch buffer；
- effective bandwidth；
- congestion state。

---

# 33. 推荐的仿真状态

运行时至少维护：

```text
Compute State
NPU busy / idle
P/D queue
预计 finish time

Storage State
KV block location
HBM / DDR occupancy
Cache hit

Network State
Rail queued bytes
Link utilization
Switch queue
Flow in-flight bytes
```

---

# 34. 推荐的决策空间

可以定义：

```text
Decision =
{
  instance_placement,
  PD_pairing,
  cache_placement,
  transfer_backend,
  slice_size,
  rail_mapping,
  transfer_priority,
  network_route,
  qos_parameters
}
```

不同研究阶段可以逐步打开这些变量。

---

# 35. 推荐的输出指标

不要只输出网络指标。

最终需要回归到业务性能：

## 网络指标

- Link Utilization；
- Rail Utilization；
- Flow Completion Time；
- Queue Length；
- Congestion；
- Effective Bandwidth。

## 数据移动指标

- KV Transfer Latency；
- Transfer Volume；
- Migration Count；
- Cache Remote Hit Cost。

## 推理性能

- TTFT P50 / P95 / P99；
- TPOT P50 / P95 / P99；
- Throughput；
- Request Completion Time；
- SLO Violation Rate。

## 资源效率

- NPU Utilization；
- HBM Utilization；
- DDR Utilization；
- NIC Utilization；
- Cross-DC Traffic。

---

# 36. 三个最值得优先做的网络侧技术点

如果不希望网络侧一下子铺得太大，可以优先做三个。

## 1. Network-aware Placement

```text
P/D、KV、Tool、RAG
```

根据网络距离与拥塞动态选择位置。

解决：

> “谁和谁通信”。

---

## 2. TENT-like Data Movement Scheduling

```text
Flow
 ↓
Slice
 ↓
动态 Rail Mapping
```

解决：

> “数据如何进入网络”。

---

## 3. Congestion-aware Routing + QoS

```text
进入 Fabric
 ↓
Adaptive Routing
+
Priority / Queue
```

解决：

> “网络内部如何承载”。

---

这三层组合起来：

```text
业务调度层
Who talks to whom
        ↓
数据移动层
How data enters network
        ↓
网络控制层
How traffic traverses fabric
```

就形成比较完整的“网为中心”寻优体系。

---

# 37. 最终总结

TENT 最重要的启发并不是一种新的网络协议，而是：

> **将“业务数据到网络资源的映射”本身变成一个动态优化问题。**

传统算网存系统更多是：

```text
算决定计算
存决定数据位置
网负责搬
```

而新的算网存一体化仿真应该变成：

```text
算
 ↕
网
 ↕
存
```

网络状态反向参与：

- P/D Placement；
- Cache Placement；
- Data Movement；
- Rail Selection；
- Routing；
- QoS。

最终目标也不应该只是：

```text
网络吞吐最大
```

而应该是：

> 在算力、存储和网络联合约束下，使 TTFT、TPOT、P99、吞吐和资源利用率达到整体最优。

从建模角度，可以把整个方向概括为：

> **以业务数据流为载体，以网络拓扑与运行状态为约束，通过网络感知的算存放置、数据移动编排和网络内部调度，实现面向推理服务端到端性能的算网存联合仿真与寻优。**