import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRequest } from './analyzer.js';
import { initDatabase, saveAnalysis, getAnalyses, getAnalysisById, deleteAnalysis, deleteAnalysesByClientName } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 初始化数据库
initDatabase();

// 分析客户留言
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, clientName } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: '留言内容不能为空' });
    }

    const analysis = await analyzeRequest(message, clientName);
    
    // 确定客户名称
    const finalClientName = clientName || '未命名客户';
    
    // 如果客户名称不为空，删除该客户之前的分析记录（只保留最新的）
    if (finalClientName && finalClientName !== '未命名客户') {
      const deletedCount = deleteAnalysesByClientName(finalClientName);
      if (deletedCount > 0) {
        console.log(`已删除客户 "${finalClientName}" 的 ${deletedCount} 条旧分析记录`);
      }
    }
    
    // 保存到数据库
    const savedId = saveAnalysis({
      clientName: finalClientName,
      message,
      analysis,
      createdAt: new Date().toISOString()
    });

    // 返回与数据库格式一致的数据结构
    res.json({
      id: savedId,
      clientName: finalClientName,
      message,
      analysis,
      createdAt: new Date().toISOString()
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

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

