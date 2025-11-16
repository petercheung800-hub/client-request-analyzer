import { useState, useEffect } from 'react'
import './App.css'
import RequestInput from './components/RequestInput'
import HistoryPanel from './components/HistoryPanel'
import { playNotificationSound } from './utils/sound'

function App() {
  const [currentAnalysis, setCurrentAnalysis] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/analyses')
      const data = await response.json()
      setHistory(data)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const handleAnalyze = async (message, clientName) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, clientName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '分析失败')
      }

      const analysis = await response.json()
      setCurrentAnalysis(analysis)
      loadHistory() // 重新加载历史记录
      
      // 播放完成提示音
      playNotificationSound()
    } catch (error) {
      alert('分析失败: ' + error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleLoadFromHistory = (analysis) => {
    setCurrentAnalysis(analysis)
    setShowHistory(false)
  }

  const handleDeleteHistory = async (id) => {
    try {
      const response = await fetch(`/api/analyses/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadHistory()
        if (currentAnalysis && currentAnalysis.id === id) {
          setCurrentAnalysis(null)
        }
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const handleNewAnalysis = () => {
    setCurrentAnalysis(null)
    setShowHistory(false)
    // 通过key变化来重置RequestInput组件
    setResetKey(prev => prev + 1)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>客户留言分析系统</h1>
        <div className="header-buttons">
          <button 
            className="new-analysis-button"
            onClick={handleNewAnalysis}
          >
            新客户分析
          </button>
          <button 
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '隐藏历史' : '查看历史'}
          </button>
        </div>
      </header>

      <div className="app-content">
        {showHistory && (
          <HistoryPanel
            history={history}
            onLoad={handleLoadFromHistory}
            onDelete={handleDeleteHistory}
          />
        )}

        <main className="main-content">
          <RequestInput 
            key={resetKey}
            onAnalyze={handleAnalyze} 
            isAnalyzing={isAnalyzing}
            currentAnalysis={currentAnalysis}
          />
        </main>
      </div>
    </div>
  )
}

export default App

