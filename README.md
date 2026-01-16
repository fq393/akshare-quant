# A股超额收益分析系统 (AKShare Alpha)

这是一个基于 React + FastAPI + AKShare 的量化分析可视化系统，旨在帮助用户发现行业板块相对于大盘的超额收益（Alpha）机会。

## 项目结构

- `frontend/`: React 前端应用 (Vite + TypeScript + Recharts)
- `server/`: Python 后端 API (FastAPI + AKShare)

## 快速开始

### 1. 启动后端 (Server)

确保你已经安装了 Python 3.8+。

```bash
# 创建并激活虚拟环境 (可选)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# 安装依赖
pip install akshare fastapi uvicorn pandas scikit-learn requests

# 启动服务
uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

后端服务将在 `http://localhost:8000` 启动。
API 文档地址: `http://localhost:8000/docs`

### 2. 启动前端 (Frontend)

确保你已经安装了 Node.js 18+。

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端应用将在 `http://localhost:3000` 启动。

## 功能特性

- **真实数据接入**: 通过 AKShare 获取同花顺行业指数与上证指数的历史行情。
- **Alpha 分析**: 自动计算板块相对于大盘的超额收益（Spread）。
- **时间错位分析 (Lag)**: 支持设置观察滞后天数，探索板块轮动规律。
- **AI 智能投顾**: 集成 Google Gemini 模型，对当前图表形态进行深度解读（需配置 API Key）。
- **多因子可视化**: 支持切换查看超额收益(Alpha)、相对强弱(RS)、板块成交额、板块振幅、动态市盈率(PE)等多维指标图表。
- **高阶量化分析**: 内置 Fréchet 距离、DTW 动态时间规整、Beta 系数、相关性 (Correlation) 及 Lead-Lag 时差相关性分析。
- **安全访问**: 简单的页面访问口令保护 (Session 级别)。

## 核心量化因子说明

### 1. 相似度算法
- **Fréchet Distance**: 用于衡量两条曲线（大盘 vs 板块）的形态相似度，类似于“遛狗绳”的最小长度。
- **DTW (Dynamic Time Warping)**: 动态时间规整，能够识别即使在时间轴上有压缩或拉伸的相似形态。

### 2. 风险与动量
- **Relative Strength (RS)**: $RS = Price_{Sector} / Price_{Index}$。RS 曲线向上代表板块跑赢大盘。
- **Lead-Lag Correlation**: 通过滑动时间窗口计算最大相关性，识别板块是领先还是滞后于大盘。
- **Beta (β)**: 衡量板块相对于大盘的波动敏感度。

## 注意事项

- AKShare 数据接口依赖网络状况，部分接口可能会因为反爬策略偶尔失效。
- AI 分析功能需要用户自行提供 Google Gemini API Key。
