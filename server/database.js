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
      message TEXT NOT NULL,
      analysis TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
  
  console.log('数据库初始化完成');
}

export function saveAnalysis(data) {
  const stmt = db.prepare(`
    INSERT INTO analyses (clientName, message, analysis, createdAt)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    data.clientName,
    data.message,
    JSON.stringify(data.analysis),
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
    message: row.message,
    analysis: JSON.parse(row.analysis),
    createdAt: row.createdAt
  }));
}

export function getAnalysisById(id) {
  const stmt = db.prepare('SELECT * FROM analyses WHERE id = ?');
  const row = stmt.get(id);
  
  if (!row) return null;
  
  return {
    id: row.id,
    clientName: row.clientName,
    message: row.message,
    analysis: JSON.parse(row.analysis),
    createdAt: row.createdAt
  };
}

export function deleteAnalysis(id) {
  const stmt = db.prepare('DELETE FROM analyses WHERE id = ?');
  const result = stmt.run(id);
  
  return result.changes > 0;
}

export function deleteAnalysesByClientName(clientName) {
  const stmt = db.prepare('DELETE FROM analyses WHERE clientName = ?');
  const result = stmt.run(clientName);
  
  return result.changes;
}

