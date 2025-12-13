import os
import time
import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
from scraper import OpportunityScraper
from database import OpportunityDB

# 加载环境变量
load_dotenv()

class ScrapingScheduler:
    """抓取任务调度器"""
    
    def __init__(self):
        self.db = OpportunityDB()
        self.scheduler = BlockingScheduler()
        self.logger = logging.getLogger(__name__)
        
    def start(self):
        """启动定时任务"""
        # 从环境变量获取抓取间隔，默认为1小时
        interval_hours = int(os.environ.get('SCRAPING_INTERVAL_HOURS', '1'))
        
        # 添加定时任务
        self.scheduler.add_job(
            self.run_scraping_task,
            trigger=IntervalTrigger(hours=interval_hours),
            id='scraping_job',
            name='机会信息抓取任务'
        )
        
        self.logger.info(f"定时任务已启动，每{interval_hours}小时执行一次")
        
        try:
            self.scheduler.start()
        except KeyboardInterrupt:
            self.logger.info("定时任务已停止")
    
    def stop(self):
        """停止定时任务"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            self.logger.info("定时任务已停止")
    
    def run_scraping_task(self):
        """执行抓取任务"""
        self.logger.info("=== 开始执行抓取任务 ===")
        start_time = time.time()
        scraped_count = 0
        skipped_count = 0
        error = None
        
        # 使用上下文管理器确保浏览器资源被正确释放
        with OpportunityScraper() as scraper:
            try:
                # 检查是否启用抓取（通过环境变量控制）
                scraping_enabled = os.environ.get('SCRAPING_ENABLED', 'true').lower() == 'true'
                if not scraping_enabled:
                    self.logger.info("抓取功能已禁用，跳过本次执行")
                    return
                
                self.logger.info("开始执行抓取任务")
                
                # 初始化数据库表
                self.logger.info("正在初始化数据库表...")
                try:
                    self.db.init_tables()
                    self.logger.info("数据库表初始化完成")
                except Exception as e:
                    self.logger.error(f"数据库表初始化失败: {str(e)}")
                    self.logger.exception("详细错误信息:")
                    raise
                
                # 抓取机会（已过滤掉Account Owner不为空的机会）
                self.logger.info("正在抓取最近更新的机会...")
                opportunities = scraper.scrape_recent_opportunities()
                scraped_count = len(opportunities)
                
                self.logger.info(f"找到{scraped_count}个未分配且最近更新的机会")
                
                # 批量保存机会到数据库
                if opportunities:
                    self.logger.info("正在批量保存机会到数据库...")
                    try:
                        saved_count = self.db.save_opportunities_batch(opportunities)
                        self.logger.info(f"成功批量保存{saved_count}个机会")
                    except Exception as e:
                        self.logger.error(f"批量保存机会失败: {str(e)}")
                        self.logger.exception("详细错误信息:")
                        # 如果批量保存失败，回退到逐个保存
                        self.logger.info("回退到逐个保存模式...")
                        added_count = 0
                        failed_count = 0
                        for i, opp in enumerate(opportunities):
                            try:
                                self.logger.debug(f"正在保存第{i+1}/{len(opportunities)}个机会: {opp.get('opportunityId', 'Unknown')}")
                                self.db.save_opportunity(opp)
                                added_count += 1
                                self.logger.debug(f"成功保存机会: {opp.get('opportunityId', 'Unknown')}")
                            except Exception as save_error:
                                failed_count += 1
                                self.logger.error(f"保存机会失败 {opp.get('opportunityId', 'Unknown')}: {str(save_error)}")
                                self.logger.exception("详细错误信息:")
                        self.logger.info(f"回退模式下成功保存{added_count}个新机会，失败{failed_count}个")
                else:
                    self.logger.info("没有找到需要保存的机会")
                
            except Exception as e:
                error = str(e)
                self.logger.error(f"抓取任务执行失败: {error}")
                # 记录堆栈跟踪信息以便调试
                import traceback
                self.logger.error(f"详细错误信息:\n{traceback.format_exc()}")
            
            finally:
                # 计算执行时长
                duration = int(time.time() - start_time)
                self.logger.info(f"抓取任务执行完成，耗时: {duration} 秒")
                
                # 记录抓取活动
                try:
                    self.db.log_scraping_activity(scraped_count, skipped_count, duration, error)
                except Exception as log_error:
                    self.logger.error(f"记录抓取活动日志失败: {str(log_error)}")
                    self.logger.exception("详细错误信息:")
                
                # 清理过期的调试文件（保留7天内的文件）
                try:
                    self.logger.info("正在清理过期调试文件...")
                    cleaned_count = scraper.cleanup_debug_files(days_to_keep=7)
                    self.logger.info(f"清理了 {cleaned_count} 个过期调试文件")
                except Exception as e:
                    self.logger.warning(f"清理调试文件时出错: {str(e)}")
                    self.logger.exception("详细错误信息:")
                
                self.logger.info("=== 抓取任务结束 ===")
    
    def run_once(self):
        """执行一次抓取任务"""
        self.logger.info("开始执行一次性抓取任务")
        self.run_scraping_task()
        self.logger.info("一次性抓取任务执行完成")
    
    def debug(self):
        """调试登录页面"""
        self.logger.info("开始调试登录页面...")
        
        # 使用上下文管理器确保浏览器资源被正确释放
        with OpportunityScraper() as scraper:
            # 初始化数据库表
            self.db.init_tables()
            
            # 调试登录页面
            success = scraper.debug_login_page()
            
            if success:
                self.logger.info("登录页面调试成功")
            else:
                self.logger.error("登录页面调试失败")
            
            return success
    
    def debug_list(self):
        """调试机会列表页面"""
        self.logger.info("开始调试机会列表页面...")
        
        # 使用上下文管理器确保浏览器资源被正确释放
        with OpportunityScraper() as scraper:
            # 初始化数据库表
            self.db.init_tables()
            
            # 调试机会列表页面
            success = scraper.debug_opportunity_page()
            
            if success:
                self.logger.info("机会列表页面调试成功")
            else:
                self.logger.error("机会列表页面调试失败")
            
            return success
    
    def test(self):
        """测试抓取功能"""
        self.logger.info("开始测试抓取功能...")
        
        # 使用上下文管理器确保浏览器资源被正确释放
        with OpportunityScraper() as scraper:
            # 初始化数据库表
            self.db.init_tables()
            
            # 测试抓取
            success = scraper.test_scraping()
            
            if success:
                self.logger.info("抓取测试成功")
            else:
                self.logger.error("抓取测试失败")
            
            return success