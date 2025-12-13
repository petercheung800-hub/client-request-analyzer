import os
import logging
import time
import datetime
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import re

# 加载环境变量
load_dotenv()

class OpportunityScraper:
    """机会信息抓取器"""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.driver = None
        self.logger = logging.getLogger(__name__)
        
        # 从环境变量获取配置
        self.base_url = os.environ.get('SCRAPER_BASE_URL', 'https://beacon.shinetechchina.com.cn/Opportunity')
        self.username = os.environ.get('SCRAPER_USERNAME', 'your_username')
        self.password = os.environ.get('SCRAPER_PASSWORD', 'your_password')
        self.headless = os.environ.get('SCRAPER_HEADLESS', 'true').lower() == 'true'
    
    def __enter__(self):
        """上下文管理器入口"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口，确保资源被正确释放"""
        self.close()
        # 返回False表示不抑制异常，让异常正常传播
        return False
        
    def init_driver(self):
        """初始化浏览器驱动"""
        try:
            chrome_options = Options()
            
            if self.headless:
                chrome_options.add_argument('--headless')
            
            # 添加其他常用选项
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            # 注意：不禁用JavaScript，因为网站使用Angular动态加载数据
            # chrome_options.add_argument('--disable-javascript')  # 注释掉这行
            
            # 禁用图片加载以提高速度，但保持JavaScript运行
            prefs = {
                "profile.managed_default_content_settings.images": 2,
                "profile.default_content_setting_values.notifications": 2,
                "profile.managed_default_content_settings.cookies": 1,  # 启用cookies以保持登录状态
                "profile.managed_default_content_settings.plugins": 2
            }
            chrome_options.add_experimental_option("prefs", prefs)
            
            # 设置页面加载策略为'eager'，等待DOM加载完成但不等待所有资源
            chrome_options.page_load_strategy = 'eager'
            
            self.logger.info("正在初始化Chrome浏览器驱动...")
            
            # 直接使用系统默认的ChromeDriver，避免架构不匹配问题
            try:
                self.driver = webdriver.Chrome(options=chrome_options)
                self.logger.info("使用系统默认ChromeDriver成功")
            except Exception as e:
                self.logger.warning(f"使用系统默认ChromeDriver失败: {str(e)}")
                # 最后尝试使用ChromeDriverManager
                try:
                    service = Service(ChromeDriverManager().install())
                    self.driver = webdriver.Chrome(service=service, options=chrome_options)
                    self.logger.info("使用ChromeDriverManager成功")
                except Exception as e2:
                    self.logger.error(f"使用ChromeDriverManager也失败: {str(e2)}")
                    raise e2
            
            # 设置隐式等待时间
            self.driver.implicitly_wait(10)
            
            # 设置页面加载超时
            self.driver.set_page_load_timeout(30)
            
            self.logger.info("浏览器驱动初始化成功")
            return True
            
        except Exception as e:
            self.logger.error(f"初始化浏览器驱动失败: {str(e)}")
            self.logger.exception("详细错误信息:")
            return False
    
    def login(self, username=None, password=None, retries=3):
        """登录系统"""
        for attempt in range(retries):
            try:
                username = username or self.username
                password = password or self.password
                
                if not self.driver:
                    self.logger.info("正在初始化浏览器驱动...")
                    if not self.init_driver():
                        self.logger.error("浏览器驱动初始化失败")
                        return False
                
                # 访问登录页面 - 构造正确的登录URL
                login_url = "https://beacon.shinetechchina.com.cn/User/Login?ReturnUrl=%2FOpportunity"
                self.logger.info(f"正在访问登录页面: {login_url}")
                
                # 增加重试机制以应对网络不稳定的情况
                page_loaded = False
                for page_attempt in range(3):
                    try:
                        self.driver.get(login_url)
                        # 等待页面加载
                        self.logger.info("等待登录页面加载...")
                        WebDriverWait(self.driver, 15).until(
                            EC.presence_of_element_located((By.NAME, "DomainUserName"))
                        )
                        self.logger.info("登录页面加载完成")
                        page_loaded = True
                        break
                    except Exception as page_error:
                        self.logger.warning(f"第{page_attempt + 1}次尝试加载登录页面失败: {str(page_error)}")
                        if page_attempt < 2:
                            time.sleep(2 ** page_attempt)  # 指数退避
                            continue
                        else:
                            raise page_error
                
                if not page_loaded:
                    raise Exception("无法加载登录页面")
                
                # 输入用户名 - 使用多种方法确保值被正确设置
                self.logger.info(f"正在输入用户名: {username}")
                username_field = self.driver.find_element(By.NAME, "DomainUserName")
                
                # 方法1: 使用常规的send_keys方法
                username_field.clear()
                username_field.send_keys(username)
                
                # 方法2: 使用JavaScript设置值和Angular模型
                self.driver.execute_script(f"""
                    var element = arguments[0];
                    element.value = '{username}';
                    // 触发Angular模型更新
                    var scope = angular.element(element).scope();
                    if (scope) {{
                        scope.DomainUserNameCookie = '{username}';
                        scope.$apply();
                    }}
                    // 触发事件
                    var event = new Event('input', {{ bubbles: true }});
                    element.dispatchEvent(event);
                    var changeEvent = new Event('change', {{ bubbles: true }});
                    element.dispatchEvent(changeEvent);
                """, username_field)
                
                # 输入密码 - 使用多种方法确保值被正确设置
                self.logger.info("正在输入密码")
                password_field = self.driver.find_element(By.NAME, "Password")
                
                # 方法1: 使用常规的send_keys方法
                password_field.clear()
                password_field.send_keys(password)
                
                # 方法2: 使用JavaScript设置值和Angular模型
                self.driver.execute_script("""
                    var element = arguments[0];
                    var password = arguments[1];
                    element.value = password;
                    // 触发Angular模型更新
                    var scope = angular.element(element).scope();
                    if (scope) {
                        scope.PasswordCookie = password;
                        scope.$apply();
                    }
                    // 触发事件
                    var event = new Event('input', { bubbles: true });
                    element.dispatchEvent(event);
                    var changeEvent = new Event('change', { bubbles: true });
                    element.dispatchEvent(changeEvent);
                """, password_field, password)
                
                # 等待一小段时间，确保表单完全初始化
                time.sleep(1)
                
                # 检查并处理CSRF令牌
                try:
                    csrf_token = self.driver.find_element(By.NAME, "__RequestVerificationToken").get_attribute("value")
                    self.logger.debug(f"获取到CSRF令牌: {csrf_token[:20]}...")
                except Exception as csrf_error:
                    self.logger.warning(f"无法获取CSRF令牌: {str(csrf_error)}")
                
                # 尝试直接提交表单，绕过Angular验证
                self.logger.info("正在尝试直接提交表单...")
                self.driver.execute_script("""
                    var form = document.getElementById('login_form');
                    if (form) {
                        // 确保表单字段有值
                        document.getElementById('DomainUserName').value = arguments[0];
                        document.getElementById('Password').value = arguments[1];
                        
                        // 提交表单
                        form.submit();
                    } else {
                        throw new Error('找不到登录表单');
                    }
                """, username, password)
                
                # 等待登录完成，检查是否跳转到机会列表页面
                self.logger.info("等待登录完成...")
                
                # 等待页面URL变化或页面内容变化
                login_success = False
                for wait_attempt in range(10):  # 最多等待10次，每次2秒
                    time.sleep(2)
                    current_url = self.driver.current_url
                    
                    # 检查URL是否已经改变（不再是登录页面）
                    if "login" not in current_url.lower():
                        self.logger.info(f"页面已跳转到: {current_url}")
                        login_success = True
                        break
                    
                    # 检查是否有错误消息
                    try:
                        error_elements = self.driver.find_elements(By.CSS_SELECTOR, ".field-validation-error, .alert-danger, .text-danger")
                        if error_elements:
                            for error in error_elements:
                                error_text = error.text.strip()
                                if error_text:
                                    self.logger.error(f"登录错误信息: {error_text}")
                                    break
                    except Exception as e:
                        self.logger.debug(f"检查错误消息时出错: {str(e)}")
                    
                    self.logger.debug(f"等待登录完成... (尝试 {wait_attempt + 1}/10)")
                
                if not login_success:
                    self.logger.error("登录后未能成功跳转")
                    # 保存当前页面截图用于调试
                    try:
                        screenshot_path = f"login_stuck_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                        self.driver.save_screenshot(screenshot_path)
                        self.logger.info(f"登录卡住截图已保存: {screenshot_path}")
                        
                        # 保存当前页面HTML用于调试
                        html_path = f"login_stuck_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                        with open(html_path, 'w', encoding='utf-8') as f:
                            f.write(self.driver.page_source)
                        self.logger.info(f"登录卡住页面HTML已保存: {html_path}")
                    except Exception as debug_error:
                        self.logger.warning(f"保存调试信息时出错: {str(debug_error)}")
                    
                    if attempt < retries - 1:
                        continue
                    else:
                        return False
                
                # 等待页面主要内容加载完成
                try:
                    self.logger.info("等待机会列表页面加载...")
                    WebDriverWait(self.driver, 15).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".opportunity-list, .table, tbody, .grid, .container"))
                    )
                    self.logger.info("机会列表页面加载完成")
                except Exception as wait_error:
                    self.logger.warning(f"等待页面内容加载时出错: {str(wait_error)}")
                    # 即使等待失败，也继续检查是否登录成功
                
                # 验证确实已经登录成功（检查页面上是否有机会相关的元素）
                current_url = self.driver.current_url
                page_source = self.driver.page_source.lower()
                
                # 检查URL是否正确并且页面包含机会相关的内容
                if "opportunity" in current_url.lower() and ("机会" in page_source or "opportunity" in page_source):
                    self.logger.info("登录成功")
                    return True
                else:
                    self.logger.error(f"登录似乎失败，当前URL: {current_url}")
                    # 保存当前页面截图用于调试
                    try:
                        screenshot_path = f"login_failed_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_attempt{attempt+1}.png"
                        self.driver.save_screenshot(screenshot_path)
                        self.logger.info(f"登录失败截图已保存: {screenshot_path}")
                    except Exception as screenshot_error:
                        self.logger.warning(f"保存登录失败截图时出错: {str(screenshot_error)}")
                    
                    # 如果不是最后一次尝试，等待一段时间再重试
                    if attempt < retries - 1:
                        wait_time = 5 * (attempt + 1)
                        self.logger.info(f"登录失败，{wait_time}秒后进行第{attempt + 2}次尝试")
                        time.sleep(wait_time)
                        continue
                    else:
                        self.logger.error("达到最大重试次数，登录失败")
                        return False
                
            except Exception as e:
                self.logger.error(f"登录失败 (尝试 {attempt + 1}/{retries}): {str(e)}")
                self.logger.exception("详细错误信息:")
                # 保存当前页面截图用于调试
                try:
                    screenshot_path = f"login_error_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_attempt{attempt+1}.png"
                    self.driver.save_screenshot(screenshot_path)
                    self.logger.info(f"登录错误截图已保存: {screenshot_path}")
                except Exception as screenshot_error:
                    self.logger.warning(f"保存登录错误截图时出错: {str(screenshot_error)}")
                
                # 如果不是最后一次尝试，等待一段时间再重试
                if attempt < retries - 1:
                    wait_time = 5 * (attempt + 1)
                    self.logger.info(f"登录失败，{wait_time}秒后进行第{attempt + 2}次尝试")
                    time.sleep(wait_time)
                    continue
                else:
                    self.logger.error("达到最大重试次数，登录失败")
                    return False
        
        return False
    
    def scrape_recent_opportunities(self, hours=24):
        """抓取最近指定小时数内更新的机会"""
        try:
            self.logger.info(f"正在抓取最近{hours}小时内更新的机会...")
            
            if not self.driver:
                self.logger.info("正在初始化浏览器驱动...")
                if not self.init_driver():
                    self.logger.error("浏览器驱动初始化失败")
                    return []
            
            # 确保已登录 - 增加重试机制
            login_attempts = 0
            max_login_attempts = 3
            while login_attempts < max_login_attempts:
                current_url = self.driver.current_url
                self.logger.info(f"当前页面URL: {current_url}")
                if "login" in current_url.lower() or not current_url:
                    self.logger.info("检测到未登录状态，正在进行登录...")
                    if not self.login():
                        login_attempts += 1
                        self.logger.warning(f"登录失败，尝试次数: {login_attempts}/{max_login_attempts}")
                        if login_attempts >= max_login_attempts:
                            self.logger.error("达到最大登录尝试次数，无法抓取机会")
                            return []
                        time.sleep(5)  # 等待5秒后重试
                        continue
                    else:
                        self.logger.info("登录成功")
                        break
                else:
                    self.logger.info("已处于登录状态")
                    break
            
            # 访问机会列表页面 - 增加重试机制
            self.logger.info(f"正在访问机会列表页面: {self.base_url}")
            page_loaded = False
            for attempt in range(3):
                try:
                    self.driver.get(self.base_url)
                    
                    # 保存当前URL用于调试
                    current_url_after_get = self.driver.current_url
                    self.logger.info(f"GET请求后当前URL: {current_url_after_get}")
                    
                    # 首先检查是否需要重新登录
                    if "login" in current_url_after_get.lower():
                        self.logger.info("检测到需要重新登录，正在执行登录...")
                        if not self.login():
                            self.logger.error("重新登录失败")
                            if attempt < 2:
                                continue
                            else:
                                raise Exception("无法重新登录")
                    
                    # 等待机会列表加载 - 先等待表格结构，使用更宽松的条件
                    self.logger.info("等待机会列表表格结构加载...")
                    try:
                        WebDriverWait(self.driver, 10).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "#oppListTable, table, .table, .table-responsive"))
                        )
                        self.logger.info("找到表格容器元素")
                    except TimeoutException:
                        # 保存页面截图和HTML用于调试
                        screenshot_path = f"no_table_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                        self.driver.save_screenshot(screenshot_path)
                        self.logger.info(f"无表格截图已保存: {screenshot_path}")
                        
                        html_path = f"no_table_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                        with open(html_path, 'w', encoding='utf-8') as f:
                            f.write(self.driver.page_source)
                        self.logger.info(f"无表格页面HTML已保存: {html_path}")
                        
                        # 尝试查找任何可能包含数据的元素
                        all_elements = self.driver.find_elements(By.TAG_NAME, "div")
                        self.logger.info(f"页面上共有 {len(all_elements)} 个div元素")
                        
                        # 尝试查找任何表格元素
                        all_tables = self.driver.find_elements(By.TAG_NAME, "table")
                        self.logger.info(f"页面上共有 {len(all_tables)} 个table元素")
                        
                        if len(all_tables) == 0:
                            raise Exception("页面上没有找到任何表格元素")
                    
                    # 额外等待Angular应用加载数据
                    self.logger.info("等待Angular应用加载数据...")
                    time.sleep(5)  # 增加等待时间给Angular渲染数据
                    
                    # 检查是否有数据行加载 - 使用更灵活的条件
                    self.logger.info("检查数据行是否加载...")
                    try:
                        # 首先尝试查找具体的数据行
                        WebDriverWait(self.driver, 20).until(
                            lambda driver: len(driver.find_elements(By.CSS_SELECTOR, "#oppListTable tbody tr[ng-repeat], table tbody tr, .table tbody tr")) > 0
                        )
                    except TimeoutException:
                        # 如果超时，检查是否有任何行元素
                        rows = self.driver.find_elements(By.CSS_SELECTOR, "tbody tr, tr")
                        if len(rows) > 1:  # 至少有表头和一行数据
                            self.logger.info(f"找到 {len(rows)} 行元素（可能包含表头）")
                        else:
                            # 保存页面截图和HTML用于调试
                            screenshot_path = f"no_data_found_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                            self.driver.save_screenshot(screenshot_path)
                            self.logger.info(f"无数据截图已保存: {screenshot_path}")
                            
                            html_path = f"no_data_found_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                            with open(html_path, 'w', encoding='utf-8') as f:
                                f.write(self.driver.page_source)
                            self.logger.info(f"无数据页面HTML已保存: {html_path}")
                            
                            raise Exception("页面加载完成但未找到数据行")
                    
                    self.logger.info("机会列表加载完成")
                    page_loaded = True
                    break
                except Exception as e:
                    self.logger.warning(f"第{attempt + 1}次尝试加载机会列表页面失败: {str(e)}")
                    if attempt < 2:
                        time.sleep(2 ** attempt)  # 指数退避
                        continue
                    else:
                        raise e
            
            if not page_loaded:
                raise Exception("无法加载机会列表页面")
            
            # 计算时间阈值
            now = datetime.datetime.now()
            time_threshold = now - datetime.timedelta(hours=hours)
            self.logger.info(f"时间阈值: {time_threshold.isoformat()}")
            
            opportunities = []
            skipped_count = 0
            
            # 解析机会列表 - 使用更精确的选择器匹配实际HTML结构
            self.logger.info("正在解析机会列表...")
            # 使用实际表格ID和更精确的选择器
            rows = self.driver.find_elements(By.CSS_SELECTOR, "#oppListTable tbody tr[ng-repeat], table tbody tr[ng-repeat], .table tbody tr[ng-repeat]")
            self.logger.info(f"找到 {len(rows)} 行数据 (使用ng-repeat选择器)")
            
            # 如果没有找到数据行，尝试其他可能的选择器
            if len(rows) == 0:
                self.logger.warning("使用ng-repeat选择器未找到数据行，尝试备用选择器1...")
                rows = self.driver.find_elements(By.CSS_SELECTOR, "#oppListTable tbody tr, table tbody tr, .table tbody tr")
                self.logger.info(f"备用选择器1找到 {len(rows)} 行数据")
                
                # 过滤掉表头行
                if len(rows) > 0:
                    filtered_rows = []
                    for row in rows:
                        # 检查是否包含数据单元格（不仅仅是表头）
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if len(cells) > 5:  # 假设数据行有超过5个单元格
                            filtered_rows.append(row)
                    rows = filtered_rows
                    self.logger.info(f"过滤后找到 {len(rows)} 行数据")
            
            # 如果仍然没有找到，尝试更广泛的选择器
            if len(rows) == 0:
                self.logger.warning("使用表格选择器未找到数据行，尝试备用选择器2...")
                rows = self.driver.find_elements(By.CSS_SELECTOR, "tr[ng-repeat], tr.ng-scope")
                self.logger.info(f"备用选择器2找到 {len(rows)} 行数据")
            
            # 保存列表页面HTML用于调试
            try:
                html_path = f"opportunity_list_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                self.logger.info(f"机会列表页面HTML已保存: {html_path}")
            except Exception as debug_error:
                self.logger.warning(f"保存列表页面HTML时出错: {str(debug_error)}")
            
            # 记录当前处理到的行索引
            current_row_index = 0
            while current_row_index < len(rows):
                row = rows[current_row_index]
                try:
                    self.logger.debug(f"正在解析第 {current_row_index+1} 行数据...")
                    # 提取机会基本信息
                    opportunity_data = self.extract_opportunity_data(row)
                    
                    if not opportunity_data:
                        self.logger.debug(f"第 {current_row_index+1} 行数据提取失败，跳过")
                        current_row_index += 1
                        continue
                    
                    # 检查Account Owner字段 - 如果不为空则跳过
                    account_owner = opportunity_data.get('accountOwner', '').strip()
                    if account_owner:
                        self.logger.debug(f"跳过已分配机会: {opportunity_data.get('opportunityId')} (Account Owner: {account_owner})")
                        skipped_count += 1
                        current_row_index += 1
                        continue
                    
                    # 检查最后更新时间是否在指定时间范围内
                    last_updated = self.parse_datetime(opportunity_data.get('lastUpdated', ''))
                    
                    if not last_updated or last_updated < time_threshold:
                        self.logger.debug(f"机会 {opportunity_data.get('opportunityId')} 不在时间范围内，跳过")
                        current_row_index += 1
                        continue
                    
                    # 获取机会详情
                    self.logger.info(f"正在抓取机会详情: {opportunity_data.get('opportunityId')}")
                    
                    # 获取当前行中的链接元素
                    link_element = row.find_element(By.CSS_SELECTOR, "td.item-opportunitylist-name a")
                    
                    # 点击链接进入详情页
                    try:
                        # 使用JavaScript点击链接，避免元素被覆盖的问题
                        self.driver.execute_script("arguments[0].click();", link_element)
                        self.logger.info(f"已点击机会链接: {opportunity_data.get('opportunityId')}")
                        
                        # 等待页面加载
                        time.sleep(3)
                        
                        # 抓取机会详情
                        details = self.extract_opportunity_details(None)  # 不需要URL，因为我们已经在详情页了
                        
                    except Exception as click_error:
                        self.logger.error(f"点击机会链接失败: {str(click_error)}")
                        details = {
                            'description': '',
                            'customerMessages': [],
                            'notes': []
                        }
                    
                    # 返回机会列表页面并重新获取表格元素
                    try:
                        self.driver.get(self.base_url)
                        WebDriverWait(self.driver, 15).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "#oppListTable tbody tr[ng-repeat]"))
                        )
                        # 重新获取表格行，因为之前的元素已经失效
                        rows = self.driver.find_elements(By.CSS_SELECTOR, "#oppListTable tbody tr[ng-repeat]")
                        self.logger.info(f"返回列表页面，重新获取到 {len(rows)} 行数据")
                    except Exception as return_error:
                        self.logger.error(f"返回列表页面失败: {str(return_error)}")
                        # 如果返回失败，跳过剩余的机会
                        break
                    
                    # 构建机会对象
                    opportunity = {
                        'opportunityId': opportunity_data.get('opportunityId', ''),
                        'title': opportunity_data.get('title', ''),
                        'clientName': opportunity_data.get('clientName', ''),
                        'country': opportunity_data.get('country', ''),
                        'description': details.get('description', ''),
                        'status': opportunity_data.get('status', ''),
                        'priority': details.get('priority', opportunity_data.get('priority', '')),
                        'postedDate': opportunity_data.get('postedDate', ''),
                        'lastUpdated': opportunity_data.get('lastUpdated', ''),
                        'sourceUrl': opportunity_data.get('sourceUrl', ''),
                        'leadSource': opportunity_data.get('leadSource', ''),
                        'territoryManager': opportunity_data.get('territoryManager', ''),
                        'salesManager': opportunity_data.get('salesManager', ''),
                        'accountOwner': opportunity_data.get('accountOwner', ''),
                        'customerMessages': details.get('customerMessages', []),
                        'notes': details.get('notes', [])
                    }
                    
                    opportunities.append(opportunity)
                    self.logger.info(f"发现未分配机会: {opportunity['opportunityId']} - {opportunity['title']}")
                    
                except Exception as e:
                    self.logger.warning(f"解析第 {current_row_index+1} 行机会数据失败: {str(e)}")
                    self.logger.exception("详细错误信息:")
                    current_row_index += 1
                    continue
                
                # 成功处理当前行，移动到下一行
                current_row_index += 1
            
            self.logger.info(f"共找到{len(opportunities)}个未分配且最近更新的机会，跳过{skipped_count}个已分配机会")
            return opportunities
            
        except Exception as e:
            self.logger.error(f"抓取机会失败: {str(e)}")
            self.logger.exception("详细错误信息:")
            return []
    
    def extract_opportunity_details(self, opportunity_url=None):
        """抓取机会详情，包括客户留言和Notes"""
        try:
            self.logger.info("正在抓取机会详情...")
            
            # 不再需要访问URL，因为我们已经在详情页了
            # 等待页面加载
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # 额外等待Angular应用加载
            time.sleep(3)
            
            # 保存页面截图用于调试
            try:
                screenshot_path = f"opportunity_detail_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                self.driver.save_screenshot(screenshot_path)
                self.logger.info(f"机会详情页截图已保存: {screenshot_path}")
                
                # 保存页面HTML用于调试
                html_path = f"opportunity_detail_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                self.logger.info(f"机会详情页HTML已保存: {html_path}")
            except Exception as debug_error:
                self.logger.warning(f"保存调试信息时出错: {str(debug_error)}")
            
            # 初始化详情数据
            details = {
                'description': '',
                'customerMessages': [],
                'notes': []
            }
            
            # 1. 抓取机会描述
            try:
                # 尝试多种可能的选择器
                description_selectors = [
                    "textarea#Description",
                    "textarea[name='Description']",
                    "textarea[ng-model='editItem.Description']",
                    "div.description",
                    "div.opportunity-description",
                    ".description-field",
                    "#description"
                ]
                
                description = ''
                for selector in description_selectors:
                    try:
                        desc_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        description = desc_element.get_attribute("value") or desc_element.text.strip()
                        if description:
                            self.logger.debug(f"使用选择器 {selector} 找到描述: {description[:50]}...")
                            break
                    except:
                        continue
                
                details['description'] = description
                self.logger.info(f"提取到机会描述: {description[:100] if description else '无'}")
                
            except Exception as e:
                self.logger.warning(f"提取机会描述失败: {str(e)}")
            
            # 2. 抓取客户留言
            try:
                # 查找客户留言区域 - 尝试更广泛的选择器
                message_selectors = [
                    "p[ng-bind-html='note.Desc']",
                    "div.customer-messages",
                    "div.messages",
                    "div.comment-section",
                    ".customer-feedback",
                    ".message-list",
                    "div[ng-if*='Message']",
                    "div[ng-if*='Comment']",
                    "div[contains(@class, 'message')]",
                    "div[contains(@class, 'comment')]",
                    "div[contains(@class, 'feedback')]",
                    "table tr td:contains('Message')",
                    "table tr td:contains('Comment')",
                    "table tr td:contains('客户留言')",
                    "table tr td:contains('留言')",
                    "*[contains(text(), 'Message')]",
                    "*[contains(text(), 'Comment')]",
                    "*[contains(text(), '客户留言')]",
                    "*[contains(text(), '留言')]"
                ]
                
                messages = []
                for selector in message_selectors:
                    try:
                        # 使用XPath查找包含特定文本的元素
                        if ":contains(" in selector or "contains(" in selector:
                            # 对于XPath选择器，使用find_elements_by_xpath
                            if selector.startswith("*"):
                                xpath_selector = selector.replace("*", "//")
                                message_elements = self.driver.find_elements(By.XPATH, xpath_selector)
                            else:
                                message_elements = self.driver.find_elements(By.XPATH, selector)
                        else:
                            # 对于CSS选择器，使用find_elements
                            message_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        if message_elements:
                            self.logger.debug(f"使用选择器 {selector} 找到 {len(message_elements)} 个潜在消息元素")
                            
                            # 尝试从这些元素中提取消息
                            for element in message_elements:
                                try:
                                    content = element.text.strip()
                                    
                                    if content and len(content) > 5:  # 过滤掉太短的内容
                                        messages.append({
                                            'content': content,
                                            'timestamp': '',
                                            'sender': ''
                                        })
                                except:
                                    continue
                            
                            if messages:
                                self.logger.debug(f"使用选择器 {selector} 提取到 {len(messages)} 条客户留言")
                                break
                    except Exception as selector_error:
                        self.logger.debug(f"选择器 {selector} 失败: {str(selector_error)}")
                        continue
                
                # 如果仍然没有找到消息，尝试更通用的方法
                if not messages:
                    self.logger.info("尝试使用通用方法查找客户留言...")
                    # 查找页面中所有可能包含消息的文本块
                    all_text_elements = self.driver.find_elements(By.XPATH, "//div[contains(text())][string-length(text()) > 20]")
                    
                    for element in all_text_elements:
                        try:
                            text = element.text.strip()
                            # 过滤掉明显不是消息的文本
                            if (text and len(text) > 20 and 
                                not text.lower().startswith('save') and 
                                not text.lower().startswith('cancel') and
                                not text.lower().startswith('submit') and
                                not text.lower().startswith('delete') and
                                not 'email' in text.lower() and
                                not 'phone' in text.lower() and
                                not 'address' in text.lower()):
                                messages.append({
                                    'content': text,
                                    'timestamp': '',
                                    'sender': ''
                                })
                        except:
                            continue
                
                details['customerMessages'] = messages[:5]  # 最多保存5条消息
                self.logger.info(f"提取到 {len(messages)} 条客户留言")
                
            except Exception as e:
                self.logger.warning(f"提取客户留言失败: {str(e)}")
            
            # 3. 抓取Notes
            try:
                # 查找Notes区域 - 尝试更广泛的选择器
                notes_selectors = [
                    "div.smart-timeline-content",
                    "div.notes-section",
                    "div.opportunity-notes",
                    "div.notes-list",
                    ".notes-container",
                    "#notes",
                    "div[ng-if*='Note']",
                    "div[ng-if*='Notes']",
                    "div[contains(@class, 'note')]",
                    "table tr td:contains('Note')",
                    "table tr td:contains('Notes')",
                    "table tr td:contains('备注')",
                    "table tr td:contains('笔记')",
                    "*[contains(text(), 'Note')]",
                    "*[contains(text(), 'Notes')]",
                    "*[contains(text(), '备注')]",
                    "*[contains(text(), '笔记')]"
                ]
                
                notes = []
                for selector in notes_selectors:
                    try:
                        # 使用XPath查找包含特定文本的元素
                        if ":contains(" in selector or "contains(" in selector:
                            # 对于XPath选择器，使用find_elements_by_xpath
                            if selector.startswith("*"):
                                xpath_selector = selector.replace("*", "//")
                                notes_elements = self.driver.find_elements(By.XPATH, xpath_selector)
                            else:
                                notes_elements = self.driver.find_elements(By.XPATH, selector)
                        else:
                            # 对于CSS选择器，使用find_elements
                            notes_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        if notes_elements:
                            self.logger.debug(f"使用选择器 {selector} 找到 {len(notes_elements)} 个潜在Notes元素")
                            
                            # 尝试从这些元素中提取Notes
                            for element in notes_elements:
                                try:
                                    # 查找Note内容和作者
                                    content_element = element.find_element(By.CSS_SELECTOR, "p[ng-bind-html='note.Desc']")
                                    author_element = element.find_element(By.CSS_SELECTOR, "span[ng-bind='note.CreateUser']")
                                    
                                    content = content_element.text.strip()
                                    author = author_element.text.strip()
                                    
                                    if content and len(content) > 5:  # 过滤掉太短的内容
                                        notes.append({
                                            'content': content,
                                            'timestamp': '',
                                            'author': author
                                        })
                                except:
                                    # 如果找不到特定的子元素，尝试获取整个元素的文本
                                    try:
                                        content = element.text.strip()
                                        if content and len(content) > 5:
                                            notes.append({
                                                'content': content,
                                                'timestamp': '',
                                                'author': ''
                                            })
                                    except:
                                        continue
                            
                            if notes:
                                self.logger.debug(f"使用选择器 {selector} 提取到 {len(notes)} 条Notes")
                                break
                    except Exception as selector_error:
                        self.logger.debug(f"选择器 {selector} 失败: {str(selector_error)}")
                        continue
                
                # 如果仍然没有找到Notes，尝试更通用的方法
                if not notes:
                    self.logger.info("尝试使用通用方法查找Notes...")
                    # 查找页面中所有可能包含Notes的文本块
                    all_text_elements = self.driver.find_elements(By.XPATH, "//div[contains(text())][string-length(text()) > 20]")
                    
                    for element in all_text_elements:
                        try:
                            text = element.text.strip()
                            # 过滤掉明显不是Notes的文本
                            if (text and len(text) > 20 and 
                                not text.lower().startswith('save') and 
                                not text.lower().startswith('cancel') and
                                not text.lower().startswith('submit') and
                                not text.lower().startswith('delete') and
                                not 'email' in text.lower() and
                                not 'phone' in text.lower() and
                                not 'address' in text.lower()):
                                notes.append({
                                    'content': text,
                                    'timestamp': '',
                                    'author': ''
                                })
                        except:
                            continue
                
                details['notes'] = notes[:5]  # 最多保存5条Notes
                self.logger.info(f"提取到 {len(notes)} 条Notes")
                
            except Exception as e:
                self.logger.warning(f"提取Notes失败: {str(e)}")
            
            # 4. 尝试抓取其他可能的详情信息
            try:
                # 查找可能包含详情信息的其他区域
                other_details = {}
                
                # 尝试获取优先级
                priority_selectors = [
                    "select[ng-model='opportunity.Priority']",
                    "select[name='Priority']",
                    ".priority-field",
                    "#priority"
                ]
                
                for selector in priority_selectors:
                    try:
                        priority_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        priority = priority_element.get_attribute("value") or priority_element.text.strip()
                        if priority:
                            other_details['priority'] = priority
                            break
                    except:
                        continue
                
                details.update(other_details)
                
            except Exception as e:
                self.logger.warning(f"提取其他详情信息失败: {str(e)}")
            
            self.logger.info(f"机会详情抓取完成: 描述={len(details['description'])}字符, 客户留言={len(details['customerMessages'])}条, Notes={len(details['notes'])}条")
            return details
            
        except Exception as e:
            self.logger.error(f"抓取机会详情失败: {str(e)}")
            self.logger.exception("详细错误信息:")
            return {
                'description': '',
                'customerMessages': [],
                'notes': []
            }

    def extract_opportunity_data(self, row_element):
        """从行元素中提取机会数据 - 处理Selenium元素"""
        try:
            # 根据实际页面结构调整选择器
            # 从HTML分析得知，表格的列顺序为：
            # ['', 'QR', 'Opportunity Name', 'Tags', 'Account Name', 'Primary Contact', 'Sales Stage', 'Country-City', 'Lead Source', 'Territory Manager', 'Sales/Engagement Manager', 'Account Owner', 'Create Date', 'Update Date']
            
            # 获取所有td元素
            cells = row_element.find_elements(By.TAG_NAME, "td")
            
            if len(cells) < 14:
                self.logger.debug(f"单元格数量不足: {len(cells)} < 14")
                return None
            
            self.logger.debug(f"正在提取机会数据，共有 {len(cells)} 列")
            
            # 从HTML分析得到的列索引：
            # 0: Checkbox (空)
            # 1: QR (评级)
            # 2: Opportunity Name (标题)
            # 3: Tags
            # 4: Account Name (客户名称)
            # 5: Primary Contact
            # 6: Sales Stage (状态)
            # 7: Country-City (国家城市)
            # 8: Lead Source
            # 9: Territory Manager
            # 10: Sales/Engagement Manager
            # 11: Account Owner (关键字段)
            # 12: Create Date (创建日期)
            # 13: Update Date (最后更新时间)
            
            # 获取机会ID (从Opportunity Name中提取或使用其他标识)
            title_element = cells[2].find_element(By.CSS_SELECTOR, "a span, span")
            title = title_element.text if title_element else cells[2].text
            self.logger.debug(f"提取到标题: {title}")
            
            # 获取客户名称
            client_element = cells[4].find_element(By.CSS_SELECTOR, "a span, span")
            client_name = client_element.text if client_element else cells[4].text
            self.logger.debug(f"提取到客户名称: {client_name}")
            
            # 获取国家城市
            country_element = cells[7].find_element(By.CSS_SELECTOR, "span")
            country = country_element.text if country_element else cells[7].text
            self.logger.debug(f"提取到国家城市: {country}")
            
            # 获取状态
            status_element = cells[6].find_element(By.CSS_SELECTOR, "span")
            status = status_element.text if status_element else cells[6].text
            self.logger.debug(f"提取到状态: {status}")
            
            # 获取Lead Source
            lead_source_element = cells[8].find_element(By.CSS_SELECTOR, "span")
            lead_source = lead_source_element.text if lead_source_element else cells[8].text
            self.logger.debug(f"提取到Lead Source: {lead_source}")
            
            # 获取Territory Manager
            territory_manager_element = cells[9].find_element(By.CSS_SELECTOR, "span")
            territory_manager = territory_manager_element.text if territory_manager_element else cells[9].text
            self.logger.debug(f"提取到Territory Manager: {territory_manager}")
            
            # 获取Sales Manager
            sales_manager_element = cells[10].find_element(By.CSS_SELECTOR, "span")
            sales_manager = sales_manager_element.text if sales_manager_element else cells[10].text
            self.logger.debug(f"提取到Sales Manager: {sales_manager}")
            
            # 获取Account Owner - 这是关键字段，用于过滤已分配的机会
            account_owner_element = cells[11].find_element(By.CSS_SELECTOR, "span")
            account_owner = account_owner_element.text if account_owner_element else cells[11].text
            self.logger.debug(f"提取到Account Owner: {account_owner}")
            
            # 获取创建日期
            create_date_element = cells[12].find_element(By.CSS_SELECTOR, "span")
            create_date = create_date_element.text if create_date_element else cells[12].text
            self.logger.debug(f"提取到创建日期: {create_date}")
            
            # 获取最后更新时间
            last_updated_element = cells[13].find_element(By.CSS_SELECTOR, "span")
            last_updated = last_updated_element.text if last_updated_element else cells[13].text
            self.logger.debug(f"提取到最后更新时间: {last_updated}")
            
            # 获取源URL (从Opportunity Name的链接中提取)
            link_element = cells[2].find_element(By.TAG_NAME, "a")
            source_url = ''
            if link_element:
                # 记录所有可能的属性用于调试
                href = link_element.get_attribute("href")
                ng_click = link_element.get_attribute("ng-click")
                ng_href = link_element.get_attribute("ng-href")
                ui_sref = link_element.get_attribute("ui-sref")
                onclick = link_element.get_attribute("onclick")
                guid = link_element.get_attribute("guid")
                
                self.logger.debug(f"链接属性: href={href}, ng-click={ng_click}, ng-href={ng_href}, ui_sref={ui_sref}, onclick={onclick}, guid={guid}")
                
                # 优先使用guid属性构造URL
                if guid:
                    # 使用实际的网站域名和路径
                    source_url = f"https://beacon.shinetechchina.com.cn/Opportunity/Edit/{guid}"
                    self.logger.debug(f"使用guid属性构造URL: {source_url}")
                # 如果没有guid，尝试从ng-click属性中提取GUID
                elif ng_click:
                    # 匹配 edit(item.OpportunityGuid) 格式
                    if "edit(item.OpportunityGuid)" in ng_click:
                        # 这种情况下，我们需要从其他地方获取GUID
                        self.logger.warning(f"找到edit(item.OpportunityGuid)但无法直接获取GUID")
                        source_url = f"https://beacon.shinetechchina.com.cn/Opportunity/Edit/{title}"
                        self.logger.debug(f"使用标题构造URL: {source_url}")
                    else:
                        # 尝试匹配其他格式
                        guid_match = re.search(r"(?:edit|openOpportunity)\(['\"]([^'\"]+)['\"]\)", ng_click)
                        if guid_match:
                            guid = guid_match.group(1)
                            source_url = f"https://beacon.shinetechchina.com.cn/Opportunity/Edit/{guid}"
                            self.logger.debug(f"从ng-click属性提取到URL: {source_url}")
                        else:
                            # 如果无法提取GUID，使用标题作为标识
                            source_url = f"https://beacon.shinetechchina.com.cn/Opportunity/Edit/{title}"
                            self.logger.debug(f"使用标题构造URL: {source_url}")
                elif href:
                    # 如果有href属性，直接使用
                    source_url = href
                    self.logger.debug(f"使用href属性: {source_url}")
                else:
                    # 如果没有其他属性，使用标题作为标识
                    source_url = f"https://beacon.shinetechchina.com.cn/Opportunity/Edit/{title}"
                    self.logger.debug(f"使用标题构造URL: {source_url}")
            
            # 构建机会数据对象
            opportunity_data = {
                'opportunityId': title,  # 使用标题作为ID，实际可能需要从链接或其他地方获取真实ID
                'title': title,
                'clientName': client_name,
                'country': country,
                'description': '',  # 可能需要点击进入详情页获取
                'status': status,
                'priority': '',  # 可能需要从QR字段或其他地方获取
                'postedDate': create_date,
                'lastUpdated': last_updated,
                'sourceUrl': source_url,
                'leadSource': lead_source,
                'territoryManager': territory_manager,
                'salesManager': sales_manager,
                'accountOwner': account_owner
            }
            
            return opportunity_data
            
        except Exception as e:
            self.logger.error(f"提取机会数据失败: {str(e)}")
            self.logger.exception("详细错误信息:")
            return None
    
    def parse_datetime(self, date_str):
        """解析日期时间字符串"""
        try:
            # 这里需要根据实际日期格式进行调整
            # 常见格式: "2023-12-01", "2023/12/01 14:30", "Dec 1, 2023", etc.
            
            if not date_str:
                return None
                
            # 尝试常见格式
            formats = [
                '%Y-%m-%d',
                '%Y-%m-%d %H:%M',
                '%Y/%m/%d',
                '%Y/%m/%d %H:%M',
                '%d/%m/%Y',
                '%d/%m/%Y %H:%M',
                '%b %d, %Y',
                '%b %d, %Y %H:%M',
                '%m/%d/%Y',  # 美式日期格式
                '%m/%d/%Y %H:%M',  # 美式日期时间格式
                '%d-%m-%Y',  # 欧洲日期格式
                '%d-%m-%Y %H:%M'  # 欧洲日期时间格式
            ]
            
            for fmt in formats:
                try:
                    return datetime.datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
                    
            # 如果都不匹配，尝试使用dateutil解析
            from dateutil import parser
            return parser.parse(date_str)
            
        except Exception as e:
            self.logger.warning(f"解析日期失败: {date_str} - {str(e)}")
            return None
    
    def test_scraping(self):
        """测试抓取功能，返回详细结果"""
        self.logger.info("开始测试抓取功能...")
        
        # 登录
        login_success = self.login()
        if not login_success:
            self.logger.error("登录失败")
            return False
        
        # 抓取所有机会（不进行时间过滤）
        all_opportunities = self.scrape_recent_opportunities()  # 抓取24小时内的所有机会
        
        # 统计已分配和未分配机会
        assigned = [opp for opp in all_opportunities if opp.get('accountOwner', '').strip()]
        unassigned = [opp for opp in all_opportunities if not opp.get('accountOwner', '').strip()]
        
        self.logger.info(f"测试结果: 总共{len(all_opportunities)}个机会, 已分配{len(assigned)}个, 未分配{len(unassigned)}个")
        
        # 保存测试结果
        debug_file = f"debug_opportunities_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(debug_file, 'w', encoding='utf-8') as f:
            json.dump({
                'total': all_opportunities,
                'assigned': assigned,
                'unassigned': unassigned
            }, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"调试信息已保存到: {debug_file}")
        return True
    
    def debug_login_page(self):
        """调试登录页面，保存页面结构和截图"""
        try:
            if not self.driver:
                if not self.init_driver():
                    return False
            
            # 访问登录页面
            self.driver.get(self.base_url)
            
            # 等待页面加载完成
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "form, .login-form, .container"))
            )
            
            # 保存页面截图
            screenshot_path = f"login_page_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            self.driver.save_screenshot(screenshot_path)
            self.logger.info(f"登录页面截图已保存: {screenshot_path}")
            
            # 保存页面HTML
            html_path = f"login_page_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.logger.info(f"登录页面HTML已保存: {html_path}")
            
            # 查找所有表单元素
            forms = self.driver.find_elements(By.TAG_NAME, "form")
            self.logger.info(f"找到 {len(forms)} 个表单")
            
            for i, form in enumerate(forms):
                self.logger.info(f"表单 {i+1}:")
                
                # 查找所有输入字段
                inputs = form.find_elements(By.TAG_NAME, "input")
                for input in inputs:
                    input_type = input.get_attribute("type")
                    input_name = input.get_attribute("name")
                    input_id = input.get_attribute("id")
                    input_placeholder = input.get_attribute("placeholder")
                    self.logger.info(f"  输入字段: type={input_type}, name={input_name}, id={input_id}, placeholder={input_placeholder}")
                
                # 查找所有按钮
                buttons = form.find_elements(By.TAG_NAME, "button")
                for button in buttons:
                    button_type = button.get_attribute("type")
                    button_text = button.text
                    button_class = button.get_attribute("class")
                    self.logger.info(f"  按钮: type={button_type}, text={button_text}, class={button_class}")
                
                # 查找提交按钮
                submit_inputs = form.find_elements(By.CSS_SELECTOR, "input[type='submit']")
                for submit in submit_inputs:
                    submit_value = submit.get_attribute("value")
                    submit_class = submit.get_attribute("class")
                    self.logger.info(f"  提交按钮: value={submit_value}, class={submit_class}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"调试登录页面失败: {str(e)}")
            return False
    
    def debug_opportunity_page(self):
        """调试机会列表页面，保存页面结构和截图"""
        try:
            # 登录
            login_success = self.login()
            if not login_success:
                self.logger.error("登录失败")
                return False
            
            # 显式导航到机会列表页面
            self.driver.get(self.base_url)
            
            # 等待页面主要内容加载完成
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".opportunity-list, .table, tbody, .grid, .container"))
            )
            
            # 保存页面截图
            screenshot_path = f"opportunity_page_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            self.driver.save_screenshot(screenshot_path)
            self.logger.info(f"机会列表页面截图已保存: {screenshot_path}")
            
            # 保存页面HTML
            html_path = f"opportunity_page_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.logger.info(f"机会列表页面HTML已保存: {html_path}")
            
            # 检查当前URL
            current_url = self.driver.current_url
            self.logger.info(f"当前页面URL: {current_url}")
            
            # 检查页面标题
            page_title = self.driver.title
            self.logger.info(f"页面标题: {page_title}")
            
            # 查找所有表格和列表元素
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            self.logger.info(f"找到 {len(tables)} 个表格")
            
            for i, table in enumerate(tables):
                self.logger.info(f"表格 {i+1}:")
                
                # 查找表头
                headers = table.find_elements(By.TAG_NAME, "th")
                if headers:
                    header_texts = [h.text for h in headers]
                    self.logger.info(f"  表头: {header_texts}")
                
                # 查找数据行
                rows = table.find_elements(By.TAG_NAME, "tr")
                self.logger.info(f"  找到 {len(rows)} 行")
                
                # 分析前几行的结构
                for j, row in enumerate(rows[:3]):  # 只分析前3行
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if cells:
                        cell_texts = [c.text for c in cells]
                        self.logger.info(f"    行 {j+1}: {cell_texts}")
            
            # 查找其他可能的列表结构
            div_lists = self.driver.find_elements(By.CSS_SELECTOR, ".list, .grid, .card, .item, [ng-repeat], [data-ng-repeat], [ng-click], .clickable")
            self.logger.info(f"找到 {len(div_lists)} 个列表/网格/卡片元素或Angular指令")
            
            # 查找所有包含特定文本的元素
            opportunity_elements = self.driver.find_elements(By.XPATH, "//*[contains(text(), '机会') or contains(text(), 'Opportunity') or contains(@class, 'opportunity') or contains(@id, 'opportunity')]")
            self.logger.info(f"找到 {len(opportunity_elements)} 个与机会相关的元素")
            
            # 查找所有按钮和链接
            buttons = self.driver.find_elements(By.TAG_NAME, "button")
            links = self.driver.find_elements(By.TAG_NAME, "a")
            self.logger.info(f"找到 {len(buttons)} 个按钮和 {len(links)} 个链接")
            
            # 查找Angular应用的主要容器
            angular_containers = self.driver.find_elements(By.CSS_SELECTOR, "[ng-app], [data-ng-app], .ng-scope")
            self.logger.info(f"找到 {len(angular_containers)} 个Angular容器")
            
            return True
            
        except Exception as e:
            self.logger.error(f"调试机会列表页面失败: {str(e)}")
            return False
    
    def close(self):
        """关闭浏览器驱动"""
        try:
            if self.driver:
                driver_pid = None
                try:
                    # 获取浏览器进程ID用于日志记录
                    driver_pid = self.driver.service.process.pid if hasattr(self.driver.service, 'process') else None
                except:
                    pass
                
                self.logger.info(f"正在关闭浏览器驱动 (PID: {driver_pid})...")
                
                # 先关闭所有窗口
                try:
                    self.driver.close()
                except:
                    pass  # 忽略关闭窗口时的错误
                
                # 退出浏览器驱动
                try:
                    self.driver.quit()
                except Exception as e:
                    self.logger.warning(f"浏览器驱动退出时出现异常: {str(e)}")
                
                # 清空引用
                self.driver = None
                self.logger.info("浏览器驱动已关闭")
        except Exception as e:
            self.logger.error(f"关闭浏览器驱动时出现错误: {str(e)}")
            self.logger.exception("详细错误信息:")
            # 即使出现错误也清空引用
            self.driver = None
    
    def cleanup_debug_files(self, days_to_keep=7):
        """清理过期的调试文件"""
        import glob
        import time
        
        # 定义需要清理的文件模式
        debug_patterns = [
            "debug_opportunities_*.json",
            "opportunity_page_*.html", 
            "login_page_*.html",
            "opportunity_page_*.png",
            "login_page_*.png",
            "login_failed_*.png",
            "login_error_*.png"
        ]
        
        # 计算截止时间
        cutoff_time = time.time() - (days_to_keep * 24 * 60 * 60)
        cleaned_count = 0
        
        # 清理每个模式匹配的文件
        for pattern in debug_patterns:
            files = glob.glob(pattern)
            for file_path in files:
                try:
                    # 检查文件创建时间
                    if os.path.getctime(file_path) < cutoff_time:
                        os.remove(file_path)
                        self.logger.info(f"已删除过期调试文件: {file_path}")
                        cleaned_count += 1
                except Exception as e:
                    self.logger.warning(f"删除文件失败 {file_path}: {str(e)}")
        
        self.logger.info(f"共清理了 {cleaned_count} 个过期调试文件")
        return cleaned_count