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
  
  // 检查并添加列（如果不存在）
  try {
    const tableInfo = db.prepare("PRAGMA table_info(analyses)").all();
    const hasCountryColumn = tableInfo.some(col => col.name === 'country');
    const hasFollowUpColumn = tableInfo.some(col => col.name === 'isFollowUp');
    const hasReasonColumn = tableInfo.some(col => col.name === 'notFollowUpReason');
    const hasQAsColumn = tableInfo.some(col => col.name === 'savedQAs');
    const hasTotalCostColumn = tableInfo.some(col => col.name === 'totalCost');
    const hasPricingDetailsColumn = tableInfo.some(col => col.name === 'pricingDetails');
    const hasStrategyDescriptionColumn = tableInfo.some(col => col.name === 'strategyDescription');
    
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
    
    // 添加总报价相关字段
    if (!hasTotalCostColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN totalCost REAL DEFAULT NULL`);
      console.log('已添加 totalCost 列到数据库');
    }
    
    if (!hasPricingDetailsColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN pricingDetails TEXT DEFAULT '{}'`);
      console.log('已添加 pricingDetails 列到数据库');
    }
    
    // 添加策略描述字段
    if (!hasStrategyDescriptionColumn) {
      db.exec(`ALTER TABLE analyses ADD COLUMN strategyDescription TEXT DEFAULT ''`);
      console.log('已添加 strategyDescription 列到数据库');
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
    totalCost: row.totalCost !== null ? row.totalCost : null,
    pricingDetails: row.pricingDetails ? JSON.parse(row.pricingDetails) : {},
    strategyDescription: row.strategyDescription || '',
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

export function updateTotalCost(id, totalCost, pricingDetails = {}) {
  const stmt = db.prepare('UPDATE analyses SET totalCost = ?, pricingDetails = ? WHERE id = ?');
  const result = stmt.run(totalCost, JSON.stringify(pricingDetails), id);
  return result.changes > 0;
}

export function updateStrategyDescription(id, strategyDescription) {
  const stmt = db.prepare('UPDATE analyses SET strategyDescription = ? WHERE id = ?');
  const result = stmt.run(strategyDescription, id);
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
    totalCost: row.totalCost !== null ? row.totalCost : null,
    pricingDetails: row.pricingDetails ? JSON.parse(row.pricingDetails) : {},
    strategyDescription: row.strategyDescription || '',
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

