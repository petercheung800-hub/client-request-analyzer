import sqlite3
import os
import logging
from contextlib import contextmanager
import datetime
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

@contextmanager
def get_db_connection(db_path):
    """获取数据库连接的上下文管理器"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

class OpportunityDB:
    """机会数据库操作类"""
    
    def __init__(self, db_path=None):
        self.db_path = db_path or os.environ.get('DATABASE_PATH', '../server/database.sqlite')
        self.logger = logging.getLogger(__name__)
        
    def init_tables(self):
        """初始化机会表"""
        try:
            with get_db_connection(self.db_path) as conn:
                # 创建机会表
                conn.execute('''
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
                        leadSource TEXT,
                        territoryManager TEXT,
                        salesManager TEXT,
                        isProcessed INTEGER DEFAULT 0,
                        analysisId INTEGER,
                        createdAt TEXT NOT NULL,
                        processedAt TEXT,
                        FOREIGN KEY (analysisId) REFERENCES analyses(id)
                    )
                ''')
                
                # 检查并添加新字段（为了向后兼容）
                try:
                    cursor = conn.execute("PRAGMA table_info(opportunities)")
                    columns = [column[1] for column in cursor.fetchall()]
                    
                    if 'leadSource' not in columns:
                        conn.execute("ALTER TABLE opportunities ADD COLUMN leadSource TEXT")
                        self.logger.info("已添加leadSource字段")
                    
                    if 'territoryManager' not in columns:
                        conn.execute("ALTER TABLE opportunities ADD COLUMN territoryManager TEXT")
                        self.logger.info("已添加territoryManager字段")
                    
                    if 'salesManager' not in columns:
                        conn.execute("ALTER TABLE opportunities ADD COLUMN salesManager TEXT")
                        self.logger.info("已添加salesManager字段")
                except Exception as e:
                    self.logger.warning(f"添加新字段时出错: {str(e)}")
                    self.logger.exception("详细错误信息:")
                
                conn.commit()
                self.logger.info("机会表初始化完成")
        except Exception as e:
            self.logger.error(f"初始化机会表失败: {str(e)}")
            self.logger.exception("详细错误信息:")
            raise
    
    def save_opportunity(self, opportunity):
        """保存单个机会信息"""
        try:
            # 验证必要字段
            if not opportunity.get('opportunityId'):
                raise ValueError("机会ID不能为空")
            
            if not opportunity.get('title'):
                raise ValueError("机会标题不能为空")
            
            with get_db_connection(self.db_path) as conn:
                # 检查是否已存在
                self.logger.debug(f"检查机会是否存在: {opportunity['opportunityId']}")
                cursor = conn.execute(
                    'SELECT id FROM opportunities WHERE opportunityId = ?',
                    (opportunity['opportunityId'],)
                )
                existing = cursor.fetchone()
                
                if existing:
                    # 更新现有记录
                    self.logger.info(f"更新现有机会: {opportunity['opportunityId']} - {opportunity['title']}")
                    try:
                        conn.execute('''
                            UPDATE opportunities SET
                                title = ?, clientName = ?, country = ?, description = ?,
                                status = ?, priority = ?, postedDate = ?, lastUpdated = ?,
                                sourceUrl = ?, leadSource = ?, territoryManager = ?, salesManager = ?,
                                isProcessed = 0
                            WHERE opportunityId = ?
                        ''', (
                            opportunity['title'],
                            opportunity['clientName'],
                            opportunity['country'],
                            opportunity['description'],
                            opportunity['status'],
                            opportunity['priority'],
                            opportunity['postedDate'],
                            opportunity['lastUpdated'],
                            opportunity['sourceUrl'],
                            opportunity.get('leadSource', ''),
                            opportunity.get('territoryManager', ''),
                            opportunity.get('salesManager', ''),
                            opportunity['opportunityId']
                        ))
                        self.logger.debug(f"更新完成: {opportunity['opportunityId']}")
                        return existing['id']
                    except Exception as update_error:
                        self.logger.error(f"更新机会失败 {opportunity['opportunityId']}: {str(update_error)}")
                        self.logger.exception("详细错误信息:")
                        raise update_error
                else:
                    # 插入新记录
                    self.logger.info(f"插入新机会: {opportunity['opportunityId']} - {opportunity['title']}")
                    now = datetime.datetime.now().isoformat()
                    try:
                        cursor = conn.execute('''
                            INSERT INTO opportunities (
                                opportunityId, title, clientName, country, description,
                                status, priority, postedDate, lastUpdated, sourceUrl,
                                leadSource, territoryManager, salesManager,
                                isProcessed, createdAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            opportunity['opportunityId'],
                            opportunity['title'],
                            opportunity['clientName'],
                            opportunity['country'],
                            opportunity['description'],
                            opportunity['status'],
                            opportunity['priority'],
                            opportunity['postedDate'],
                            opportunity['lastUpdated'],
                            opportunity['sourceUrl'],
                            opportunity.get('leadSource', ''),
                            opportunity.get('territoryManager', ''),
                            opportunity.get('salesManager', ''),
                            0,  # isProcessed
                            now
                        ))
                        self.logger.debug(f"插入完成: {opportunity['opportunityId']}")
                        return cursor.lastrowid
                    except Exception as insert_error:
                        self.logger.error(f"插入机会失败 {opportunity['opportunityId']}: {str(insert_error)}")
                        self.logger.exception("详细错误信息:")
                        raise insert_error
        except Exception as e:
            self.logger.error(f"保存机会失败 {opportunity.get('opportunityId', 'Unknown')}: {str(e)}")
            self.logger.exception("详细错误信息:")
            raise
    
    def save_opportunities_batch(self, opportunities):
        """批量保存机会信息"""
        if not opportunities:
            self.logger.info("没有机会需要保存")
            return 0
            
        self.logger.info(f"开始批量保存 {len(opportunities)} 个机会")
        try:
            with get_db_connection(self.db_path) as conn:
                added_count = 0
                updated_count = 0
                now = datetime.datetime.now().isoformat()
                
                for i, opportunity in enumerate(opportunities):
                    try:
                        self.logger.debug(f"正在处理第 {i+1}/{len(opportunities)} 个机会: {opportunity['opportunityId']}")
                        # 检查是否已存在
                        cursor = conn.execute(
                            'SELECT id FROM opportunities WHERE opportunityId = ?',
                            (opportunity['opportunityId'],)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            # 更新现有记录
                            self.logger.debug(f"更新现有机会: {opportunity['opportunityId']}")
                            conn.execute('''
                                UPDATE opportunities SET
                                    title = ?, clientName = ?, country = ?, description = ?,
                                    status = ?, priority = ?, postedDate = ?, lastUpdated = ?,
                                    sourceUrl = ?, leadSource = ?, territoryManager = ?, salesManager = ?,
                                    isProcessed = 0
                                WHERE opportunityId = ?
                            ''', (
                                opportunity['title'],
                                opportunity['clientName'],
                                opportunity['country'],
                                opportunity['description'],
                                opportunity['status'],
                                opportunity['priority'],
                                opportunity['postedDate'],
                                opportunity['lastUpdated'],
                                opportunity['sourceUrl'],
                                opportunity.get('leadSource', ''),
                                opportunity.get('territoryManager', ''),
                                opportunity.get('salesManager', ''),
                                opportunity['opportunityId']
                            ))
                            updated_count += 1
                            self.logger.info(f"更新机会: {opportunity['opportunityId']} - {opportunity['title']}")
                        else:
                            # 插入新记录
                            self.logger.debug(f"插入新机会: {opportunity['opportunityId']}")
                            conn.execute('''
                                INSERT INTO opportunities (
                                    opportunityId, title, clientName, country, description,
                                    status, priority, postedDate, lastUpdated, sourceUrl,
                                    leadSource, territoryManager, salesManager,
                                    isProcessed, createdAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                opportunity['opportunityId'],
                                opportunity['title'],
                                opportunity['clientName'],
                                opportunity['country'],
                                opportunity['description'],
                                opportunity['status'],
                                opportunity['priority'],
                                opportunity['postedDate'],
                                opportunity['lastUpdated'],
                                opportunity['sourceUrl'],
                                opportunity.get('leadSource', ''),
                                opportunity.get('territoryManager', ''),
                                opportunity.get('salesManager', ''),
                                0,  # isProcessed
                                now
                            ))
                            added_count += 1
                            self.logger.info(f"新增机会: {opportunity['opportunityId']} - {opportunity['title']}")
                    except Exception as e:
                        self.logger.error(f"保存机会失败 {opportunity['opportunityId']}: {str(e)}")
                        continue
                
                conn.commit()
                self.logger.info(f"批量保存完成: 新增{added_count}个, 更新{updated_count}个")
                return added_count + updated_count
        except Exception as e:
            self.logger.error(f"批量保存过程中发生错误: {str(e)}")
            raise
    
    def get_unprocessed_opportunities(self):
        """获取未处理的机会"""
        with get_db_connection(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT * FROM opportunities WHERE isProcessed = 0
                ORDER BY lastUpdated DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def mark_opportunity_processed(self, opportunity_id, analysis_id=None):
        """标记机会为已处理"""
        with get_db_connection(self.db_path) as conn:
            now = datetime.datetime.now().isoformat()
            conn.execute('''
                UPDATE opportunities SET
                    isProcessed = 1,
                    analysisId = ?,
                    processedAt = ?
                WHERE id = ?
            ''', (analysis_id, now, opportunity_id))
    
    def log_scraping_activity(self, scraped_count, skipped_count, duration, error=None):
        """记录抓取活动日志"""
        status = "成功" if error is None else "失败"
        message = f"抓取活动{status}: 抓取{scraped_count}个机会, 跳过{skipped_count}个已分配机会, 耗时{duration}秒"
        if error:
            message += f", 错误: {str(error)}"
        
        self.logger.info(message)
        
        # 这里可以考虑将日志保存到数据库或文件
        # 目前只记录到日志文件