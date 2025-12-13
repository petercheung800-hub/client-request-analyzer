import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientName TEXT NOT NULL,
      country TEXT,
      message TEXT NOT NULL,
      analysis TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
  
  // 创建机会表
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunityId TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      clientName TEXT,
      country TEXT,
      description TEXT,
      status TEXT,
      priority TEXT,
      postedDate TEXT,
      lastUpdated TEXT NOT NULL,
      sourceUrl TEXT,
      isProcessed INTEGER DEFAULT 0,
      analysisId INTEGER,
      createdAt TEXT NOT NULL,
      processedAt TEXT,
      FOREIGN KEY (analysisId) REFERENCES analyses(id)
    )
  `);
  
  // 检查并添加列（如果不存在）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(analyses)").all();
    const hasCountryColumn = tableInfo.some(col => col.name === 'country');
    const hasFollowUpColumn = tableInfo.some(col => col.name === 'isFollowUp');
    const hasReasonColumn = tableInfo.some(col => col.name === 'notFollowUpReason');
    const hasQAsColumn = tableInfo.some(col => col.name === 'savedQAs');
    
    if (!hasCountryColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN country TEXT DEFAULT ''`);
      console.log('已添加 country 列到数据库');
    }
    
    if (!hasFollowUpColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN isFollowUp INTEGER DEFAULT 1`);
      console.log('已添加 isFollowUp 列到数据库');
    }
    
    if (!hasReasonColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN notFollowUpReason TEXT DEFAULT ''`);
      console.log('已添加 notFollowUpReason 列到数据库');
    }
    
    if (!hasQAsColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN savedQAs TEXT DEFAULT '[]'`);
      console.log('已添加 savedQAs 列到数据库');
    }
    
    const hasNotesColumn = tableInfo.some(col => col.name === 'notes');
    if (!hasNotesColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN notes TEXT DEFAULT ''`);
      console.log('已添加 notes 列到数据库');
    }
  } catch (error) {
    console.error('检查/添加列时出错:', error);
  }
  
  console.log('数据库初始化完成');
}

export function saveAnalysis(data) {
  // 根据可行性分析自动设置初始跟进状态
  let isFollowUp = 1
  if (data.analysis?.feasibility?.overall) {
    const overall = data.analysis.feasibility.overall
    isFollowUp = (overall.includes('可行') && !overall.includes('不可行')) ? 1 : 0
  }
  
  const stmt = db.prepare(`
    INSERT INTO analyses (clientName, country, message, analysis, isFollowUp, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    data.clientName,
    data.country || '',
    data.message,
    JSON.stringify(data.analysis),
    isFollowUp,
    data.createdAt
  );
  
  return result.lastInsertRowid;
}

export function getAnalyses() {
  const stmt = db.prepare('SELECT * FROM analyses ORDER BY createdAt DESC');
  const rows = stmt.all();
  
  return rows.map(row => ({
    id: row.id,
    clientName: row.clientName,
    country: row.country || '',
    message: row.message,
    analysis: JSON.parse(row.analysis),
    isFollowUp: row.isFollowUp === 1,
    notFollowUpReason: row.notFollowUpReason || '',
    savedQAs: row.savedQAs ? JSON.parse(row.savedQAs) : [],
    notes: row.notes || '',
    createdAt: row.createdAt
  }));
}

export function updateFollowUpStatus(id, isFollowUp, notFollowUpReason = '') {
  const stmt = db.prepare('UPDATE analyses SET isFollowUp = ?, notFollowUpReason = ? WHERE id = ?');
  const result = stmt.run(isFollowUp ? 1 : 0, notFollowUpReason || '', id);
  return result.changes > 0;
}

export function updateSavedQAs(id, savedQAs) {
  const stmt = db.prepare('UPDATE analyses SET savedQAs = ? WHERE id = ?');
  const result = stmt.run(JSON.stringify(savedQAs), id);
  return result.changes > 0;
}

export function updateNotes(id, notes) {
  const stmt = db.prepare('UPDATE analyses SET notes = ? WHERE id = ?');
  const result = stmt.run(notes, id);
  return result.changes > 0;
}

export function getAnalysisById(id) {
  const stmt = db.prepare('SELECT * FROM analyses WHERE id = ?');
  const row = stmt.get(id);
  
  if (!row) return null;
  
  return {
    id: row.id,
    clientName: row.clientName,
    country: row.country || '',
    message: row.message,
    analysis: JSON.parse(row.analysis),
    isFollowUp: row.isFollowUp === 1,
    notFollowUpReason: row.notFollowUpReason || '',
    savedQAs: row.savedQAs ? JSON.parse(row.savedQAs) : [],
    notes: row.notes || '',
    createdAt: row.createdAt
  };
}

export function deleteAnalysis(id) {
  const stmt = db.prepare('DELETE FROM analyses WHERE id = ?');
  const result = stmt.run(id);
  
  return result.changes > 0;
}

export function getAnalysisByClientName(clientName) {
  const stmt = db.prepare('SELECT * FROM analyses WHERE clientName = ? ORDER BY createdAt DESC LIMIT 1');
  const row = stmt.get(clientName);
  
  if (!row) return null;
  
  return {
    id: row.id,
    clientName: row.clientName,
    country: row.country || '',
    message: row.message,
    analysis: JSON.parse(row.analysis),
    isFollowUp: row.isFollowUp === 1,
    notFollowUpReason: row.notFollowUpReason || '',
    savedQAs: row.savedQAs ? JSON.parse(row.savedQAs) : [],
    notes: row.notes || '',
    createdAt: row.createdAt
  };
}

export function deleteAnalysesByClientName(clientName) {
  const stmt = db.prepare('DELETE FROM analyses WHERE clientName = ?');
  const result = stmt.run(clientName);
  
  return result.changes;
}

// 机会相关数据库操作函数
export function saveOpportunity(opportunity) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO opportunities (
      opportunityId, title, clientName, country, description,
      status, priority, postedDate, lastUpdated, sourceUrl,
      isProcessed, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    opportunity.opportunityId,
    opportunity.title,
    opportunity.clientName || '',
    opportunity.country || '',
    opportunity.description || '',
    opportunity.status || '',
    opportunity.priority || '',
    opportunity.postedDate || '',
    opportunity.lastUpdated,
    opportunity.sourceUrl || '',
    opportunity.isProcessed || 0,
    opportunity.createdAt || new Date().toISOString()
  );
  
  return result.lastInsertRowid;
}

export function getOpportunities(limit = 50) {
  const stmt = db.prepare(`
    SELECT o.*, a.clientName as analysisClientName, a.country as analysisCountry
    FROM opportunities o
    LEFT JOIN analyses a ON o.analysisId = a.id
    ORDER BY o.lastUpdated DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit);
  
  return rows.map(row => ({
    ...row,
    isProcessed: row.isProcessed === 1
  }));
}

export function getUnprocessedOpportunities() {
  const stmt = db.prepare(`
    SELECT * FROM opportunities WHERE isProcessed = 0
    ORDER BY lastUpdated DESC
  `);
  const rows = stmt.all();
  
  return rows.map(row => ({
    ...row,
    isProcessed: row.isProcessed === 1
  }));
}

export function markOpportunityProcessed(opportunityId, analysisId) {
  const stmt = db.prepare(`
    UPDATE opportunities SET
      isProcessed = 1,
      analysisId = ?,
      processedAt = ?
    WHERE id = ?
  `);
  const result = stmt.run(analysisId, new Date().toISOString(), opportunityId);
  return result.changes > 0;
}

export function getOpportunityById(id) {
  const stmt = db.prepare('SELECT * FROM opportunities WHERE id = ?');
  const row = stmt.get(id);
  
  if (!row) return null;
  
  return {
    ...row,
    isProcessed: row.isProcessed === 1
  };
}

export function deleteOpportunity(id) {
  const stmt = db.prepare('DELETE FROM opportunities WHERE id = ?');
  const result = stmt.run(id);
  
  return result.changes > 0;
}

