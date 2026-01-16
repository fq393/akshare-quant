
/**
 * 量化算法工具库
 */

// Min-Max 归一化：将序列缩放到 [0, 1] 区间
// 用于消除绝对涨幅大小的影响，只比较“形态”
export const minMaxNormalize = (data: number[]): number[] => {
  if (data.length === 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  if (range === 0) return data.map(() => 0.5); // 直线

  return data.map(v => (v - min) / range);
};

// 计算两点间的欧氏距离 (1D)
const dist = (p: number, q: number) => Math.abs(p - q);

/**
 * 计算离散弗雷歇距离 (Discrete Fréchet Distance)
 * 动态规划实现 O(n*m)
 */
export const calculateFrechetDistance = (curveP: number[], curveQ: number[]): number => {
  const n = curveP.length;
  const m = curveQ.length;
  
  if (n === 0 || m === 0) return 0;

  // 初始化 DP 矩阵
  // ca[i * m + j] 对应 matrix[i][j]
  const ca = new Float32Array(n * m);

  // 初始点
  ca[0] = dist(curveP[0], curveQ[0]);

  // 第一列 (只能从下方上来)
  for (let i = 1; i < n; i++) {
    ca[i * m + 0] = Math.max(dist(curveP[i], curveQ[0]), ca[(i - 1) * m + 0]);
  }

  // 第一行 (只能从左方过来)
  for (let j = 1; j < m; j++) {
    ca[0 * m + j] = Math.max(dist(curveP[0], curveQ[j]), ca[0 * m + (j - 1)]);
  }

  // 填充剩余矩阵
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const d = dist(curveP[i], curveQ[j]);
      
      const minPrev = Math.min(
        ca[(i - 1) * m + j],       // 上方
        ca[i * m + (j - 1)],       // 左方
        ca[(i - 1) * m + (j - 1)]  // 左上方
      );
      
      ca[i * m + j] = Math.max(d, minPrev);
    }
  }

  return ca[n * m - 1]; // 返回右下角的值
};

/**
 * 计算动态时间规整距离 (DTW)
 * 相比 Fréchet，DTW 是累积距离，对局部时间扭曲更敏感但更平滑
 */
export const calculateDTWDistance = (curveP: number[], curveQ: number[]): number => {
  const n = curveP.length;
  const m = curveQ.length;
  
  if (n === 0 || m === 0) return 0;

  const dtw = new Float32Array(n * m);
  dtw.fill(Infinity);

  dtw[0] = dist(curveP[0], curveQ[0]);

  for (let i = 1; i < n; i++) {
    dtw[i * m + 0] = dist(curveP[i], curveQ[0]) + dtw[(i - 1) * m + 0];
  }

  for (let j = 1; j < m; j++) {
    dtw[0 * m + j] = dist(curveP[0], curveQ[j]) + dtw[0 * m + (j - 1)];
  }

  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const cost = dist(curveP[i], curveQ[j]);
      dtw[i * m + j] = cost + Math.min(
        dtw[(i - 1) * m + j],      // 插入
        dtw[i * m + (j - 1)],      // 删除
        dtw[(i - 1) * m + (j - 1)] // 匹配
      );
    }
  }

  return dtw[n * m - 1];
};

/**
 * 计算相似度评分 (0-100)
 * @param marketCurve 大盘累计收益率序列
 * @param sectorCurve 板块累计收益率序列
 */
export const calculateSimilarityScore = (marketCurve: number[], sectorCurve: number[]): { frechet: number, dtw: number } => {
  if (marketCurve.length < 2 || sectorCurve.length < 2) return { frechet: 0, dtw: 0 };

  // 1. 归一化 (只看形态)
  const normMarket = minMaxNormalize(marketCurve);
  const normSector = minMaxNormalize(sectorCurve);

  // 2. 计算弗雷歇距离
  const frechetDist = calculateFrechetDistance(normMarket, normSector);
  
  // 3. 计算 DTW 距离 (归一化后再除以路径长度以获得平均距离)
  const dtwDistRaw = calculateDTWDistance(normMarket, normSector);
  // DTW 累积距离随长度增加，需要标准化
  const dtwDist = dtwDistRaw / Math.max(marketCurve.length, sectorCurve.length);

  // 4. 转换为 0-100 分数
  const frechetScore = 1 / (1 + frechetDist) * 100;
  const dtwScore = 1 / (1 + dtwDist * 2) * 100; // DTW 系数调整

  return {
    frechet: Math.round(frechetScore * 100) / 100,
    dtw: Math.round(dtwScore * 100) / 100
  };
};

/**
 * 计算 Beta 系数
 * Beta = Cov(Rm, Rs) / Var(Rm)
 */
export const calculateBeta = (marketPct: number[], sectorPct: number[]): number => {
  if (marketPct.length !== sectorPct.length || marketPct.length < 2) return 0;

  const n = marketPct.length;
  const meanM = marketPct.reduce((a, b) => a + b, 0) / n;
  const meanS = sectorPct.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varM = 0;

  for (let i = 0; i < n; i++) {
    cov += (marketPct[i] - meanM) * (sectorPct[i] - meanS);
    varM += (marketPct[i] - meanM) ** 2;
  }

  if (varM === 0) return 0;
  
  return Math.round((cov / varM) * 100) / 100;
};

/**
 * 计算相关系数 (Correlation)
 */
export const calculateCorrelation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return 0;
  
  return Math.round((num / Math.sqrt(denX * denY)) * 100) / 100;
};

/**
 * 计算移动平均线 (Simple Moving Average)
 */
export const calculateSMA = (data: number[], window: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(NaN); // Not enough data
      continue;
    }
    let sum = 0;
    for (let j = 0; j < window; j++) {
      sum += data[i - j];
    }
    result.push(sum / window);
  }
  return result;
};

/**
 * 计算最大相关性及其对应的滞后期 (Lead-Lag Analysis)
 * 寻找哪个 lag 能让相关性最大化
 * positive lag means x leads y (if we shift y back) or similar depending on convention.
 * Here we shift y: corr(x[t], y[t-lag])
 */
export const calculateMaxCorrelationLag = (x: number[], y: number[], maxLag: number = 10): { lag: number, correlation: number } => {
  if (x.length !== y.length || x.length < maxLag * 2) return { lag: 0, correlation: 0 };

  let maxCorr = -2; // Correlation is between -1 and 1
  let bestLag = 0;

  // Try lags from -maxLag to +maxLag
  // lag > 0: y is shifted right (delayed) -> x leads y
  // lag < 0: y is shifted left (advanced) -> y leads x
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xSegment: number[] = [];
    const ySegment: number[] = [];

    for (let i = 0; i < x.length; i++) {
      const j = i - lag;
      if (j >= 0 && j < y.length) {
        xSegment.push(x[i]);
        ySegment.push(y[j]);
      }
    }

    const corr = calculateCorrelation(xSegment, ySegment);
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  return { lag: bestLag, correlation: maxCorr };
};
