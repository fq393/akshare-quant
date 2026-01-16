import requests
import json
from typing import Generator
from .models import AnalysisRequest

API_URL = "https://aigateway.edgecloudapp.com/v1/7f043f6006bd4b537ef2f6943d5798d2/zjmedia/chat/completions"
API_TOKEN = "9fdff06716d642ab8ccf28435e4e4ce2"

def generate_market_analysis(request: AnalysisRequest) -> Generator[str, None, None]:
    # 1. Construct Prompt
    # Summarize recent data
    latest = request.recent_data[-1] if request.recent_data else None
    if not latest:
        yield "数据不足，无法分析。"
        return

    # Create a compact string of the last 10 days
    history_str = ""
    for day in request.recent_data[-10:]:
        history_str += (
            f"日期:{day.date}|"
            f"基准涨:{day.marketPct}%|"
            f"板块涨:{day.sectorPct}%|"
            f"超额:{day.spread}%|"
            f"资金:{day.netInflow}|"
            f"振幅:{day.amplitude}%\n"
        )

    similarity_text = f"形态相似度(Fréchet Distance Score): {request.similarity_score}" if request.similarity_score is not None else "形态相似度: 未计算"

    prompt = f"""
你是一位资深的量化交易策略师。请根据以下 A 股市场数据，生成一份深度的《量化交易研报》。

【分析对象】
- 基准指数：{request.market_name}
- 目标板块：{request.sector_name}
- 隔位时间差 (Lag)：{request.lag_days} 天 (分析板块 T-{request.lag_days} 与大盘 T 日的相关性)

【核心指标】
- 最新日期：{latest.date}
- {similarity_text}
- 最新超额收益 (Alpha)：{latest.spread}%
- 板块当日涨跌：{latest.sectorPct}% (基准：{latest.marketPct}%)
- 资金净流入：{latest.netInflow}
- 板块振幅：{latest.amplitude}%
- 市盈率 (PE)：{latest.peRatio}

【近期行情快照 (近10日)】
{history_str}

【研报要求】
1. **趋势研判**：基于 Alpha 和 Fréchet 相似度，判断当前板块是处于“独立行情”还是“跟随大盘”？(相似度高=跟随，Alpha高且相似度低=独立强势)。
2. **资金与情绪**：结合振幅和资金流向，分析当前市场是否存在过热或恐慌情绪。
3. **策略建议**：
   - 如果 Alpha > 0 且趋势向上 -> 建议“动量增强”
   - 如果 Alpha < 0 但超卖 -> 建议“均值回归”
   - 请给出明确的仓位建议 (轻仓/观望/加仓)。
4. **风险提示**：基于当前振幅和 PE 给出风险预警。

请使用专业、简洁的金融术语，输出格式清晰，包含 Markdown 标题。
"""

    # 2. Prepare API Request
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_TOKEN}" 
    }
    
    payload = {
        "model": "gemini-3-pro-preview",
        "stream": True,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    }

    try:
        # 3. Stream Response
        with requests.post(API_URL, headers=headers, json=payload, stream=True) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        json_str = decoded_line[6:] # Remove 'data: ' prefix
                        if json_str.strip() == '[DONE]':
                            break
                        try:
                            data = json.loads(json_str)
                            # Extract content delta
                            # Gemini response format might vary, usually choices[0].delta.content or choices[0].text
                            # Based on OpenAI format which is common for gateways
                            if 'choices' in data and len(data['choices']) > 0:
                                delta = data['choices'][0].get('delta', {})
                                content = delta.get('content', '')
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"\n\n[系统错误] AI 分析服务连接失败: {str(e)}"
