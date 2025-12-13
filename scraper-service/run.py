#!/usr/bin/env python3
"""
机会信息抓取服务主程序
"""

import os
import sys
import logging
import argparse
from scheduler import ScrapingScheduler

def setup_logging():
    """设置日志配置"""
    log_level = os.environ.get('LOG_LEVEL', 'INFO')
    log_file = os.environ.get('LOG_FILE', 'scraper.log')
    
    # 创建日志目录
    log_dir = os.path.dirname(log_file)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 配置日志
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )

def main():
    """主函数"""
    # 设置日志
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='机会信息抓取服务')
    parser.add_argument('--mode', choices=['schedule', 'once', 'test', 'debug', 'debug-list'], default='schedule',
                        help='运行模式: schedule(定时运行), once(运行一次), test(测试), debug(调试登录页面), debug-list(调试机会列表页面)')
    
    args = parser.parse_args()
    
    # 检查必要的环境变量
    username = os.environ.get('SCRAPER_USERNAME')
    password = os.environ.get('SCRAPER_PASSWORD')
    
    if not username or username == 'your_username':
        logger.warning("未设置SCRAPER_USERNAME环境变量，使用默认值")
        username = 'demo_user'
    
    if not password or password == 'your_password':
        logger.warning("未设置SCRAPER_PASSWORD环境变量，使用默认值")
        password = 'demo_password'
    
    # 设置环境变量供scraper使用
    os.environ['SCRAPER_USERNAME'] = username
    os.environ['SCRAPER_PASSWORD'] = password
    
    # 创建调度器
    scheduler = ScrapingScheduler()
    
    try:
        if args.mode == 'schedule':
            logger.info("启动定时抓取服务...")
            scheduler.start()
        elif args.mode == 'once':
            logger.info("执行一次抓取任务...")
            scheduler.run_once()
            logger.info("抓取任务完成")
        elif args.mode == 'test':
            logger.info("测试抓取功能...")
            success = scheduler.test()
            if success:
                logger.info("测试成功")
                sys.exit(0)
            else:
                logger.error("测试失败")
                sys.exit(1)
        elif args.mode == 'debug':
            logger.info("调试登录页面...")
            success = scheduler.debug()
            if success:
                logger.info("调试成功")
                sys.exit(0)
            else:
                logger.error("调试失败")
                sys.exit(1)
        elif args.mode == 'debug-list':
            logger.info("调试机会列表页面...")
            success = scheduler.debug_list()
            if success:
                logger.info("调试成功")
                sys.exit(0)
            else:
                logger.error("调试失败")
                sys.exit(1)
    except KeyboardInterrupt:
        logger.info("用户中断，正在停止服务...")
    except Exception as e:
        logger.error(f"服务运行出错: {str(e)}")
        sys.exit(1)
    finally:
        scheduler.stop()

if __name__ == '__main__':
    main()