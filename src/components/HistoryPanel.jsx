import { useState } from 'react'
import './HistoryPanel.css'

function HistoryPanel({ history, onLoad, onDelete, currentAnalysisId }) {
  const [viewMode, setViewMode] = useState('list') // list, card, compact
  const [followUpExpanded, setFollowUpExpanded] = useState(true)
  const [notRecommendedExpanded, setNotRecommendedExpanded] = useState(true)

  // 根据 isFollowUp 字段分类
  const categorizeHistory = () => {
    const followUp = []
    const notRecommended = []

    history.forEach(item => {
      // 使用数据库中的 isFollowUp 字段
      if (item.isFollowUp) {
        followUp.push(item)
      } else {
        notRecommended.push(item)
      }
    })

    return { followUp, notRecommended }
  }

  const { followUp, notRecommended } = categorizeHistory()

  if (history.length === 0) {
    return (
      <aside className="history-panel">
        <div className="history-header">
          <h3>历史记录</h3>
        </div>
        <p className="empty-message">暂无历史记录</p>
      </aside>
    )
  }

  const renderTableView = (items) => (
    <div className="history-table">
      <div className="table-header">
        <div className="table-cell cell-client">客户名称</div>
        <div className="table-cell cell-country">所在国家</div>
        <div className="table-cell cell-date">记录时间</div>
      </div>
      <div className="table-body">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`table-row ${item.id === currentAnalysisId ? 'active' : ''}`}
            onClick={() => onLoad(item)}
          >
            <div className="table-cell cell-client">
              <span className="client-name" title={item.clientName}>{item.clientName}</span>
            </div>
            <div className="table-cell cell-country">
              {item.country || '-'}
            </div>
            <div className="table-cell cell-date">
              {new Date(item.createdAt).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit'
              }).replace(/\//g, '/')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderCardView = (items) => (
    <div className="history-list view-mode-card">
      {items.map((item) => (
        <div 
          key={item.id} 
          className={`history-item ${item.id === currentAnalysisId ? 'active' : ''}`}
        >
          <div className="history-item-header">
            <span className="history-client">{item.clientName}</span>
            <span className="history-date">
              {new Date(item.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
          <p className="history-message">
            {item.message.length > 100 ? item.message.substring(0, 100) + '...' : item.message}
          </p>
          <div className="history-actions">
            <button className="load-button" onClick={() => onLoad(item)}>
              查看详情
            </button>
            <button
              className="delete-button"
              onClick={() => {
                if (confirm('确定要删除这条记录吗？')) {
                  onDelete(item.id)
                }
              }}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderContent = (items) => {
    if (viewMode === 'list') return renderTableView(items)
    return renderCardView(items)
  }

  return (
    <aside className="history-panel">
      <div className="history-header">
        <h3>历史记录 ({history.length})</h3>
        <div className="view-mode-selector">
          <button
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            ☰
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title="卡片视图"
          >
            ▦
          </button>
        </div>
      </div>

      <div className="history-panel-content">
        {followUp.length > 0 && (
          <div className="history-section follow-up-section">
            <h4 
              className="section-title collapsible" 
              onClick={() => setFollowUpExpanded(!followUpExpanded)}
            >
              <span className={`collapse-icon ${followUpExpanded ? 'expanded' : ''}`}>▶</span>
              ✓ 可跟进机会 ({followUp.length})
            </h4>
            {followUpExpanded && renderContent(followUp)}
          </div>
        )}

        {notRecommended.length > 0 && (
          <div className="history-section not-recommended-section">
            <h4 
              className="section-title collapsible" 
              onClick={() => setNotRecommendedExpanded(!notRecommendedExpanded)}
            >
              <span className={`collapse-icon ${notRecommendedExpanded ? 'expanded' : ''}`}>▶</span>
              ✗ 不建议跟进 ({notRecommended.length})
            </h4>
            {notRecommendedExpanded && renderContent(notRecommended)}
          </div>
        )}
      </div>
    </aside>
  )
}

export default HistoryPanel
