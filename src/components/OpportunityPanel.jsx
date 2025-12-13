import React, { useState, useEffect } from 'react';
import './OpportunityPanel.css';

function OpportunityPanel() {
  const [opportunities, setOpportunities] = useState([]);
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapingMessage, setScrapingMessage] = useState('');
  const [activeTab, setActiveTab] = useState('opportunities');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchOpportunities();
    fetchUnprocessedCount();
  }, []);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/opportunities?limit=50');
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data);
      }
    } catch (error) {
      console.error('获取机会列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnprocessedCount = async () => {
    try {
      const response = await fetch('/api/opportunities/unprocessed');
      if (response.ok) {
        const data = await response.json();
        setUnprocessedCount(data.length);
      }
    } catch (error) {
      console.error('获取未处理机会数量失败:', error);
    }
  };

  const handleProcessOpportunity = async (opportunityId, autoAnalyze = true) => {
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoAnalyze }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        // 刷新机会列表
        fetchOpportunities();
        fetchUnprocessedCount();
      } else {
        const error = await response.json();
        alert(`处理失败: ${error.error}`);
      }
    } catch (error) {
      console.error('处理机会失败:', error);
      alert('处理机会失败');
    }
  };

  const handleDeleteOpportunity = async (opportunityId) => {
    if (!window.confirm('确定要删除这个机会吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('机会已删除');
        // 刷新机会列表
        fetchOpportunities();
        fetchUnprocessedCount();
        // 如果删除的是当前选中的机会，关闭详情
        if (selectedOpportunity && selectedOpportunity.id === opportunityId) {
          setSelectedOpportunity(null);
          setShowDetails(false);
        }
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.error}`);
      }
    } catch (error) {
      console.error('删除机会失败:', error);
      alert('删除机会失败');
    }
  };

  const showOpportunityDetails = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowDetails(true);
  };

  const handleManualScraping = async () => {
    // 防重复提交机制
    if (scraping) {
      // 如果已经在抓取中，显示更友好的提示而不是alert
      setScrapingMessage('数据抓取已在进行中，请稍候...');
      // 3秒后清除消息
      setTimeout(() => {
        setScrapingMessage('');
      }, 3000);
      return;
    }

    // 确认对话框
    if (!window.confirm('确定要立即抓取数据吗？这可能需要几分钟时间。')) {
      return;
    }

    // 设置加载状态
    setScraping(true);
    setScrapingMessage('正在启动数据抓取...');
    
    try {
      // 发送抓取请求
      const response = await fetch('/api/scrape/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 实时更新进度状态
      setScrapingMessage('正在执行数据抓取...');
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setScrapingMessage('数据抓取完成！正在刷新数据...');
        // 刷新机会列表
        await fetchOpportunities();
        await fetchUnprocessedCount();
        // 成功消息
        setScrapingMessage('数据抓取完成！');
        // 3秒后清除消息
        setTimeout(() => {
          setScrapingMessage('');
        }, 3000);
      } else {
        setScrapingMessage(`数据抓取失败: ${result.message || '未知错误'}`);
        console.error('抓取失败:', result);
        // 5秒后清除消息
        setTimeout(() => {
          setScrapingMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('手动抓取错误:', error);
      setScrapingMessage('数据抓取过程中发生网络错误');
      // 5秒后清除消息
      setTimeout(() => {
        setScrapingMessage('');
      }, 5000);
    } finally {
      // 确保状态被重置
      setScraping(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '未知';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  const getStatusBadge = (isProcessed) => {
    return isProcessed ? (
      <span className="badge processed">已处理</span>
    ) : (
      <span className="badge unprocessed">未处理</span>
    );
  };

  return (
    <div className="opportunity-panel">
      <div className="panel-header">
        <h2>机会管理</h2>
        <button 
          className={`scrape-button ${scraping ? 'scraping' : ''}`}
          onClick={handleManualScraping}
          disabled={scraping}
        >
          {scraping ? '抓取中...' : '抓取数据'}
        </button>
        {unprocessedCount > 0 && (
          <div className="unprocessed-indicator">
            有 {unprocessedCount} 个未处理机会
          </div>
        )}
      </div>
      {/* 显示抓取状态消息 */}
      {scrapingMessage && (
        <div className={`scraping-message ${scraping ? 'loading' : ''}`}>
          {scrapingMessage}
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setActiveTab('opportunities')}
        >
          机会列表
        </button>
        <button
          className={`tab-button ${activeTab === 'unprocessed' ? 'active' : ''}`}
          onClick={() => setActiveTab('unprocessed')}
        >
          未处理机会
        </button>
      </div>

      <div className="tab-content">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {activeTab === 'opportunities' && (
              <div className="opportunity-list">
                {opportunities.length === 0 ? (
                  <div className="empty-state">暂无机会数据</div>
                ) : (
                  <table className="opportunity-table">
                    <thead>
                      <tr>
                        <th>标题</th>
                        <th>客户名称</th>
                        <th>国家</th>
                        <th>状态</th>
                        <th>最后更新</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((opportunity) => (
                        <tr key={opportunity.id}>
                          <td>
                            <div className="title-cell">
                              {opportunity.title}
                              {getStatusBadge(opportunity.isProcessed)}
                            </div>
                          </td>
                          <td>{opportunity.clientName || '未知'}</td>
                          <td>{opportunity.country || '未知'}</td>
                          <td>{opportunity.status || '未知'}</td>
                          <td>{formatDate(opportunity.lastUpdated)}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => showOpportunityDetails(opportunity)}
                              >
                                详情
                              </button>
                              {!opportunity.isProcessed && (
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleProcessOpportunity(opportunity.id)}
                                >
                                  处理
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteOpportunity(opportunity.id)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'unprocessed' && (
              <div className="opportunity-list">
                {opportunities.filter(o => !o.isProcessed).length === 0 ? (
                  <div className="empty-state">暂无未处理机会</div>
                ) : (
                  <table className="opportunity-table">
                    <thead>
                      <tr>
                        <th>标题</th>
                        <th>客户名称</th>
                        <th>国家</th>
                        <th>优先级</th>
                        <th>最后更新</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.filter(o => !o.isProcessed).map((opportunity) => (
                        <tr key={opportunity.id}>
                          <td>
                            <div className="title-cell">
                              {opportunity.title}
                            </div>
                          </td>
                          <td>{opportunity.clientName || '未知'}</td>
                          <td>{opportunity.country || '未知'}</td>
                          <td>{opportunity.priority || '未知'}</td>
                          <td>{formatDate(opportunity.lastUpdated)}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => showOpportunityDetails(opportunity)}
                              >
                                详情
                              </button>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleProcessOpportunity(opportunity.id)}
                              >
                                处理
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteOpportunity(opportunity.id)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showDetails && selectedOpportunity && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>机会详情</h3>
              <button className="close-button" onClick={() => setShowDetails(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">机会ID:</span>
                <span className="detail-value">{selectedOpportunity.opportunityId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">标题:</span>
                <span className="detail-value">{selectedOpportunity.title}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">客户名称:</span>
                <span className="detail-value">{selectedOpportunity.clientName || '未知'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">国家:</span>
                <span className="detail-value">{selectedOpportunity.country || '未知'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">描述:</span>
                <span className="detail-value">{selectedOpportunity.description || '无'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">状态:</span>
                <span className="detail-value">{selectedOpportunity.status || '未知'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">优先级:</span>
                <span className="detail-value">{selectedOpportunity.priority || '未知'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">发布日期:</span>
                <span className="detail-value">{formatDate(selectedOpportunity.postedDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">最后更新:</span>
                <span className="detail-value">{formatDate(selectedOpportunity.lastUpdated)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">创建时间:</span>
                <span className="detail-value">{formatDate(selectedOpportunity.createdAt)}</span>
              </div>
              {selectedOpportunity.sourceUrl && (
                <div className="detail-row">
                  <span className="detail-label">源链接:</span>
                  <a 
                    href={selectedOpportunity.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="detail-value link"
                  >
                    查看原文
                  </a>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">处理状态:</span>
                <span className="detail-value">
                  {getStatusBadge(selectedOpportunity.isProcessed)}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              {!selectedOpportunity.isProcessed && (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    handleProcessOpportunity(selectedOpportunity.id);
                    setShowDetails(false);
                  }}
                >
                  处理机会
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetails(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpportunityPanel;