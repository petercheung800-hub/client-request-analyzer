import dotenv from 'dotenv';

dotenv.config();

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 估算文本的 token 数量（粗略估算：中文 1 token ≈ 1.5 字符，英文 1 token ≈ 4 字符）
function estimateTokens(text) {
  // 简单估算：假设平均每个字符约 0.5 token
  return Math.ceil(text.length * 0.5);
}

// 格式化 token 数量为易读格式
function formatTokenCount(tokens) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

// 验证 JSON 结构是否完整
function validateAnalysisStructure(analysis) {
  const required = ['summary', 'requirements', 'feasibility', 'techStack', 'timeline', 'teamMembers', 'pricing'];
  const missing = required.filter(field => !analysis[field]);
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  // 验证关键字段的结构
  if (!analysis.teamMembers?.roles || !Array.isArray(analysis.teamMembers.roles)) {
    return { valid: false, error: 'teamMembers.roles 必须是数组' };
  }
  
  // 验证每个角色的职责是否存在
  for (let i = 0; i < analysis.teamMembers.roles.length; i++) {
    const role = analysis.teamMembers.roles[i];
    if (!role.responsibilities || !Array.isArray(role.responsibilities)) {
      return { valid: false, error: `角色 ${i} 缺少 responsibilities 数组` };
    }
  }
  
  return { valid: true };
}

export async function analyzeRequest(message, clientName = '', country = '') {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('请配置DeepSeek API Key。请在.env文件中设置DEEPSEEK_API_KEY。');
  }
  
  const MAX_RETRIES = 3;
  let lastError = null;

  const systemPrompt = `你是一位资深的软件外包项目分析师，拥有10年以上的项目管理和技术评估经验。你擅长深度分析客户需求，提供详细、专业、可操作的项目评估报告。

【核心能力】：
1. 深度理解客户需求，挖掘隐藏的业务逻辑和技术需求
2. 提供详细的技术方案和实施细节，而不是泛泛而谈
3. 为每个项目角色提供具体的、可执行的工作职责描述（每条职责至少100字）
4. 考虑项目的技术难点、风险点、关键路径
5. 结合客户所在国家的文化、法律、技术环境提供本地化建议

【重要原则】：
- 绝不使用简短的、模糊的、套话式的描述
- 所有分析必须结合项目的具体情况，体现专业深度
- 角色职责描述是评估报告的核心，必须详细、具体、可操作

请始终以JSON格式返回分析结果，确保所有字段都是中文。`;

  const countryContext = country ? `\n客户所在国家：${country}\n请特别注意该国家的以下因素：\n- 当地的法律法规和合规要求\n- 文化习惯和用户偏好\n- 技术基础设施和网络环境\n- 支付方式和货币\n- 语言和本地化需求\n- 时区和工作时间\n- 服务器部署建议（考虑该国家的云服务商和数据合规）\n` : '';

  const userPrompt = `请对以下客户问询进行详细分析，并以JSON格式返回结果。

客户问询：
${message}${countryContext}

【重要】关于角色职责描述：
- 每条职责必须详细具体，至少100字
- 必须包含：功能模块、技术栈、工作任务、交付物、协作方式
- 结合项目实际需求，不要写泛泛的描述
- 【格式要求】职责描述中严禁使用双引号、单引号、反引号等引号符号，使用「」或【】代替
- 列举项目使用顿号（、）分隔，不要使用逗号
- 避免使用可能干扰JSON的特殊字符

请提供以下分析内容（JSON格式，所有字段用中文）：

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
    "server": ["服务器选型1", "服务器选型2", ...],
    "other": ["其他技术1", ...],
    "reasoning": "技术选型理由说明",
    "serverReasoning": "服务器选型理由（包括配置建议、预估流量、扩展性等）"
  },
  "timeline": {
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
        "responsibilities": [
          "负责XX功能模块的开发工作，使用[具体技术栈]实现[具体功能列表]。技术实现包括：[技术细节1]、[技术细节2]、[技术细节3]等。预计交付[具体数量]个[交付物类型]，开发周期[时间]。需要与[协作角色]进行[协作方式]，确保[质量标准]。（此条职责描述必须至少100字）",
          "在项目的[阶段名称]阶段，负责[具体工作内容]。使用[工具/技术]完成[任务1]、[任务2]、[任务3]。关键里程碑包括：[里程碑1]、[里程碑2]。与[其他角色]协作完成[协作内容]，确保[质量要求]。（此条职责描述必须至少100字）",
          "负责[另一个功能模块]的[具体工作]，包括[详细任务列表]。技术方案：[方案描述]。性能要求：[性能指标]。安全要求：[安全措施]。文档要求：[文档类型和内容]。（此条职责描述必须至少100字）"
        ],
        "level": "级别要求（初级/中级/高级）",
        "workload": "工作量说明（如：全职参与整个项目周期，或在特定阶段投入50%时间）",
        "keyDeliverables": ["关键交付物1", "关键交付物2", ...]
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
      "server": "服务器成本说明（包括服务器租赁/购买、带宽、存储等具体费用，如：AWS EC2 t3.medium $50-80/月，CDN流量费 $0.15-0.25/GB）",
      "maintenance": "维护成本说明（可选）"
    },
    "costTable": [
      {
        "role": "项目角色（如：前端开发工程师）",
        "duration": "工作时长（如：20天）",
        "tasks": "工作内容（详细描述）"
      }
    ],
    "factors": ["影响报价的因素1", "因素2", ...]
  }
}

请确保返回的是有效的JSON格式，不要包含任何markdown代码块标记。`;

  // 预检查：估算 token 数量
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userPrompt);
  const totalTokens = systemTokens + userTokens;
  const maxTokens = 128000; // DeepSeek 的实际限制约 131K，留一些余量
  
  console.log(`📊 Token 估算: 系统提示 ${formatTokenCount(systemTokens)} + 用户消息 ${formatTokenCount(userTokens)} = 总计 ${formatTokenCount(totalTokens)} tokens`);
  
  if (totalTokens > maxTokens) {
    const overLimit = totalTokens - maxTokens;
    const overLimitPercent = ((overLimit / maxTokens) * 100).toFixed(1);
    
    throw new Error(
      `📄 文件内容过大，无法分析\n\n` +
      `当前内容：约 ${formatTokenCount(totalTokens)} tokens\n` +
      `API 限制：${formatTokenCount(maxTokens)} tokens\n` +
      `超出限制：${formatTokenCount(overLimit)} tokens (${overLimitPercent}%)\n\n` +
      `💡 建议：\n` +
      `1. 提取文件中的关键信息（需求、功能描述等）后重新提交\n` +
      `2. 将大文件拆分成多个小文件分别分析\n` +
      `3. 如果是 PDF，尝试只复制关键页面的文本内容`
    );
  }
  
  if (totalTokens > maxTokens * 0.8) {
    console.warn(`⚠️ 警告: Token 数量接近限制 (${((totalTokens / maxTokens) * 100).toFixed(1)}%)，可能会影响分析质量`);
  }

  // 重试循环
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 尝试 ${attempt}/${MAX_RETRIES}...`);
      
      // 如果是重试，在提示词中添加错误信息
      let retryPrompt = userPrompt;
      if (attempt > 1 && lastError) {
        retryPrompt = `${userPrompt}\n\n【重要提示】上次生成失败，原因：${lastError}\n请特别注意JSON格式的正确性，确保所有引号、逗号、括号都正确配对。`;
      }
      
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
            content: retryPrompt
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
      
      // 修复常见的JSON格式问题
      // 1. 移除注释（如果有）
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/\/\/.*/g, '');
      
      // 2. 修复尾随逗号
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      // 3. 修复字符串中的换行符 - 简单粗暴的方法
      // 将所有字符串值中的实际换行符替换为空格
      let inString = false;
      let escaped = false;
      let result = '';
      
      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const prevChar = i > 0 ? cleaned[i - 1] : '';
        
        if (char === '"' && !escaped) {
          inString = !inString;
          result += char;
        } else if (inString) {
          // 在字符串内部
          if (char === '\\' && !escaped) {
            escaped = true;
            result += char;
          } else {
            if (char === '\n' || char === '\r') {
              // 将换行符替换为空格
              result += ' ';
            } else {
              result += char;
            }
            escaped = false;
          }
        } else {
          // 在字符串外部
          result += char;
          escaped = false;
        }
      }
      
      cleaned = result;
      
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      console.error('错误位置:', parseError.message);
      console.error('原始响应前1000字符:', responseText.substring(0, 1000));
      console.error('原始响应后1000字符:', responseText.substring(responseText.length - 1000));
      
      // 如果解析失败，尝试多种修复策略
      try {
        console.log('尝试修复策略 1: 查找完整的JSON对象');
        // 策略1: 找到最后一个完整的 }
        let lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > 0) {
          let truncated = cleaned.substring(0, lastBrace + 1);
          try {
            analysis = JSON.parse(truncated);
            console.log('✅ 策略1成功：使用截断的JSON');
            return analysis;
          } catch (e) {
            console.log('策略1失败，尝试策略2');
          }
        }
        
        // 策略2: 尝试修复未闭合的字符串和对象
        console.log('尝试修复策略 2: 修复未闭合的结构');
        let fixed = cleaned;
        
        // 统计括号
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        
        // 补全缺失的引号
        const quotes = (fixed.match(/(?<!\\)"/g) || []).length;
        if (quotes % 2 !== 0) {
          fixed += '"';
        }
        
        // 补全缺失的括号
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          fixed += ']';
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          fixed += '}';
        }
        
        try {
          analysis = JSON.parse(fixed);
          console.log('✅ 策略2成功：修复未闭合的结构');
          return analysis;
        } catch (e) {
          console.log('策略2失败');
        }
        
        // 如果所有策略都失败，抛出原始错误
        throw parseError;
      } catch (secondError) {
        // 保存错误的JSON到文件，方便调试
        console.error('所有修复策略都失败');
        throw new Error(`无法解析AI返回的JSON格式: ${parseError.message}`);
      }
    }

      // 验证 JSON 结构
      const validation = validateAnalysisStructure(analysis);
      if (!validation.valid) {
        const errorMsg = validation.missing 
          ? `缺少必需字段: ${validation.missing.join(', ')}`
          : validation.error;
        console.warn(`⚠️ 结构验证失败: ${errorMsg}`);
        lastError = errorMsg;
        
        if (attempt < MAX_RETRIES) {
          console.log(`🔄 将在下次尝试中修正...`);
          continue;
        } else {
          throw new Error(`JSON结构不完整: ${errorMsg}`);
        }
      }
      
      console.log('✅ 分析完成，JSON结构验证通过');
      return analysis;
      
    } catch (error) {
      lastError = error.message;
      console.error(`❌ 尝试 ${attempt} 失败:`, error.message);
      
      // 检查是否是不可重试的错误
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new Error('DeepSeek API Key无效或已过期。请检查.env文件中的DEEPSEEK_API_KEY配置。');
      }
      
      if (error.message.includes('402') || error.message.includes('Insufficient Balance') || error.message.includes('余额不足')) {
        throw new Error('DeepSeek账户余额不足。请访问 https://platform.deepseek.com/ 进行充值后重试。');
      }
      
      // 如果是最后一次尝试，抛出错误
      if (attempt === MAX_RETRIES) {
        if (error.message.includes('429')) {
          throw new Error('API调用频率过高，请稍后再试。');
        }
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          throw new Error('无法连接到DeepSeek API服务。请检查网络连接。');
        }
        throw error;
      }
      
      // 否则继续下一次尝试
      console.log(`⏳ 等待 ${attempt} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  // 如果所有重试都失败，抛出最后的错误
  throw new Error(`分析失败，已重试 ${MAX_RETRIES} 次: ${lastError}`);
}



