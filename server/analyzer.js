import dotenv from 'dotenv';

dotenv.config();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export async function analyzeRequest(message, clientName = '') {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('请配置DeepSeek API Key。请在.env文件中设置DEEPSEEK_API_KEY。');
  }

  const systemPrompt = `你是一位专业的软件外包项目分析师，擅长分析客户需求并提供详细的项目评估。请始终以JSON格式返回分析结果，确保所有字段都是中文。`;

  const userPrompt = `请对以下客户留言进行详细分析，并以JSON格式返回结果。

客户留言：
${message}

请提供以下分析内容（使用JSON格式，确保所有字段都是中文）：

{
  "summary": "项目概述（2-3句话）",
  "requirements": {
    "functional": ["功能需求1", "功能需求2", ...],
    "nonFunctional": ["非功能需求1", "非功能需求2", ...]
  },
  "feasibility": {
    "technical": "技术可行性分析（详细说明）",
    "time": "时间可行性分析",
    "resource": "资源可行性分析",
    "overall": "总体可行性评估（可行/需评估/不可行）"
  },
  "techStack": {
    "frontend": ["前端技术1", "前端技术2", ...],
    "backend": ["后端技术1", "后端技术2", ...],
    "database": ["数据库技术1", ...],
    "other": ["其他技术1", ...],
    "reasoning": "技术选型理由说明"
  },
  "timeline": {
    "phases": [
      {
        "name": "阶段名称",
        "duration": "预计时间（如：2周）",
        "tasks": ["任务1", "任务2", ...]
      }
    ],
    "totalDuration": "总开发周期（如：8-12周）"
  },
  "risks": [
    {
      "type": "风险类型（技术/时间/需求/其他）",
      "description": "风险描述",
      "impact": "影响程度（高/中/低）",
      "mitigation": "应对措施"
    }
  ],
  "teamMembers": {
    "roles": [
      {
        "role": "角色名称（如：前端开发工程师）",
        "count": "人数（如：2人）",
        "skills": ["所需技能1", "所需技能2", ...],
        "responsibilities": ["职责1", "职责2", ...],
        "level": "级别要求（初级/中级/高级）"
      }
    ],
    "totalCount": "总人数（如：5-7人）",
    "teamStructure": "团队结构说明（如：1个项目经理，2个前端，2个后端，1个测试，1个UI/UX）",
    "keyRequirements": ["关键要求1", "关键要求2", ...]
  },
  "pricing": {
    "estimation": "报价估算（如：$15,000 - $25,000）",
    "breakdown": {
      "development": "开发成本说明",
      "testing": "测试成本说明",
      "deployment": "部署成本说明",
      "maintenance": "维护成本说明（可选）"
    },
    "factors": ["影响报价的因素1", "因素2", ...]
  }
}

请确保返回的是有效的JSON格式，不要包含任何markdown代码块标记。`;

  try {
    // 调用DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      let errorMessage = '未知错误';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        try {
          errorMessage = await response.text();
        } catch {
          // 如果无法读取错误信息，使用默认消息
        }
      }
      throw new Error(`DeepSeek API错误: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    if (!responseText) {
      throw new Error('DeepSeek返回空响应');
    }

    // 尝试解析JSON
    let analysis;
    try {
      // 清理可能的markdown代码块
      let cleaned = responseText.trim();
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // 尝试提取JSON部分（如果响应包含其他文本）
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('原始响应:', responseText);
      throw new Error(`无法解析AI返回的JSON格式: ${parseError.message}`);
    }

    return analysis;
  } catch (error) {
    console.error('DeepSeek API错误:', error);
    
    // 检查是否是API Key错误
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      throw new Error('DeepSeek API Key无效或已过期。请检查.env文件中的DEEPSEEK_API_KEY配置。');
    }
    
    // 检查是否是余额不足
    if (error.message.includes('402') || error.message.includes('Insufficient Balance') || error.message.includes('余额不足')) {
      throw new Error('DeepSeek账户余额不足。请访问 https://platform.deepseek.com/ 进行充值后重试。');
    }
    
    if (error.message.includes('429')) {
      throw new Error('API调用频率过高，请稍后再试。');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      throw new Error('无法连接到DeepSeek API服务。请检查网络连接。');
    }
    
    throw new Error(`分析失败: ${error.message}`);
  }
}

