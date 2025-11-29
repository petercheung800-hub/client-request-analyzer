import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRequest } from './analyzer.js';
import { initDatabase, saveAnalysis, getAnalyses, getAnalysisById, deleteAnalysis, deleteAnalysesByClientName, getAnalysisByClientName, updateFollowUpStatus, updateSavedQAs, updateNotes } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// 增加请求体大小限制，支持上传较大的文件（50MB）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 初始化数据库
initDatabase();

// 分析客户问询
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, clientName, country } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: '问询内容不能为空' });
    }

    const analysis = await analyzeRequest(message, clientName, country);
    
    // 确定客户名称
    const finalClientName = clientName || '未命名客户';
    
    // 检查是否已存在该客户的记录，如果存在则保留原来的时间戳
    let timestamp = new Date().toISOString();
    let existingAnalysis = null;
    
    if (finalClientName && finalClientName !== '未命名客户') {
      existingAnalysis = getAnalysisByClientName(finalClientName);
      if (existingAnalysis) {
        // 保留第一次分析的时间
        timestamp = existingAnalysis.createdAt;
        console.log(`客户 "${finalClientName}" 已存在记录，保留原时间: ${timestamp}`);
      }
      
      // 删除该客户之前的分析记录（只保留最新的）
      const deletedCount = deleteAnalysesByClientName(finalClientName);
      if (deletedCount > 0) {
        console.log(`已删除客户 "${finalClientName}" 的 ${deletedCount} 条旧分析记录`);
      }
    }
    
    // 计算初始跟进状态
    let isFollowUp = true
    if (analysis?.feasibility?.overall) {
      const overall = analysis.feasibility.overall
      isFollowUp = overall.includes('可行') && !overall.includes('不可行')
    }
    
    // 保存到数据库
    const savedId = saveAnalysis({
      clientName: finalClientName,
      country: country || '',
      message,
      analysis,
      createdAt: timestamp
    });

    // 返回与数据库格式一致的数据结构
    res.json({
      id: savedId,
      clientName: finalClientName,
      country: country || '',
      message,
      analysis,
      isFollowUp,
      createdAt: timestamp
    });
  } catch (error) {
    console.error('分析错误:', error);
    res.status(500).json({ 
      error: '分析失败', 
      message: error.message 
    });
  }
});

// 获取所有分析记录
app.get('/api/analyses', (req, res) => {
  try {
    const analyses = getAnalyses();
    res.json(analyses);
  } catch (error) {
    console.error('获取记录错误:', error);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 获取单个分析记录
app.get('/api/analyses/:id', (req, res) => {
  try {
    const analysis = getAnalysisById(parseInt(req.params.id));
    if (!analysis) {
      return res.status(404).json({ error: '记录未找到' });
    }
    res.json(analysis);
  } catch (error) {
    console.error('获取记录错误:', error);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// 删除分析记录
app.delete('/api/analyses/:id', (req, res) => {
  try {
    const success = deleteAnalysis(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: '记录未找到' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('删除记录错误:', error);
    res.status(500).json({ error: '删除记录失败' });
  }
});

// 更新跟进状态
app.put('/api/analyses/:id/follow-up', (req, res) => {
  try {
    const { isFollowUp, notFollowUpReason } = req.body;
    console.log(`更新跟进状态 - ID: ${req.params.id}, isFollowUp: ${isFollowUp}, reason: ${notFollowUpReason}`);
    
    const success = updateFollowUpStatus(
      parseInt(req.params.id), 
      isFollowUp, 
      notFollowUpReason || ''
    );
    
    if (!success) {
      console.error('记录未找到:', req.params.id);
      return res.status(404).json({ error: '记录未找到' });
    }
    
    console.log('跟进状态更新成功');
    res.json({ success: true });
  } catch (error) {
    console.error('更新跟进状态错误:', error);
    res.status(500).json({ error: '更新失败', message: error.message });
  }
});

// 更新笔记
app.put('/api/analyses/:id/notes', (req, res) => {
  try {
    const { notes } = req.body;
    const success = updateNotes(parseInt(req.params.id), notes || '');
    
    if (!success) {
      return res.status(404).json({ error: '记录未找到' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新笔记错误:', error);
    res.status(500).json({ error: '更新失败', message: error.message });
  }
});

// 保存问答数据
app.put('/api/analyses/:id/qas', (req, res) => {
  try {
    const { savedQAs } = req.body;
    console.log(`保存问答数据 - ID: ${req.params.id}, 问答数量: ${savedQAs?.length || 0}`);
    
    const success = updateSavedQAs(parseInt(req.params.id), savedQAs || []);
    
    if (!success) {
      console.error('记录未找到:', req.params.id);
      return res.status(404).json({ error: '记录未找到' });
    }
    
    console.log('问答数据保存成功');
    res.json({ success: true });
  } catch (error) {
    console.error('保存问答数据错误:', error);
    res.status(500).json({ error: '保存失败', message: error.message });
  }
});

// 针对特定模块提问
app.post('/api/ask-question', async (req, res) => {
  try {
    const { sectionTitle, sectionData, question, fullAnalysis } = req.body;
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: '问题不能为空' });
    }

    // 构建上下文
    const contextPrompt = `你是一位专业的软件外包项目分析师。用户正在查看一个项目分析报告的「${sectionTitle}」部分，并提出了一个问题。

项目分析的完整内容：
${JSON.stringify(fullAnalysis, null, 2)}

用户的问题：
${question}

请基于项目分析的内容，特别是「${sectionTitle}」部分，给出专业、详细的回答。回答要：
1. 直接针对用户的问题
2. 基于已有的分析数据
3. 提供具体、可操作的建议
4. 语言简洁清晰，易于理解

请直接回答问题，不要使用JSON格式。`;

    const response = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的软件外包项目分析师，擅长回答关于项目需求、技术选型、开发周期、团队配置等方面的问题。'
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.7,
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
        } catch {}
      }
      throw new Error(`DeepSeek API错误: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '';

    if (!answer) {
      throw new Error('DeepSeek返回空响应');
    }

    res.json({ answer });
  } catch (error) {
    console.error('提问错误:', error);
    res.status(500).json({ 
      error: '提问失败', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

