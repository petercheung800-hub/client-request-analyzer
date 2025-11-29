import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// 修复所有记录的 isFollowUp 状态
const stmt = db.prepare('SELECT id, analysis FROM analyses');
const rows = stmt.all();

let updated = 0;
rows.forEach(row => {
  try {
    const analysis = JSON.parse(row.analysis);
    let isFollowUp = 1;
    
    if (analysis?.feasibility?.overall) {
      const overall = analysis.feasibility.overall;
      isFollowUp = (overall.includes('可行') && !overall.includes('不可行')) ? 1 : 0;
    }
    
    const updateStmt = db.prepare('UPDATE analyses SET isFollowUp = ? WHERE id = ?');
    updateStmt.run(isFollowUp, row.id);
    updated++;
  } catch (error) {
    console.error(`处理记录 ${row.id} 时出错:`, error);
  }
});

console.log(`已更新 ${updated} 条记录的跟进状态`);
db.close();
