import './HistoryPanel.css'

function HistoryPanel({ history, onLoad, onDelete }) {
  if (history.length === 0) {
    return (
      <aside className="history-panel">
        <h3>历史记录</h3>
        <p className="empty-message">暂无历史记录</p>
      </aside>
    )
  }

  return (
    <aside className="history-panel">
      <h3>历史记录 ({history.length})</h3>
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-item-header">
              <span className="history-client">{item.clientName}</span>
              <span className="history-date">
                {new Date(item.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <p className="history-message">
              {item.message.length > 100
                ? item.message.substring(0, 100) + '...'
                : item.message}
            </p>
            <div className="history-actions">
              <button
                className="load-button"
                onClick={() => onLoad(item)}
              >
                查看
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
    </aside>
  )
}

export default HistoryPanel

