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

  const handleAnalyze = async (message, clientName, country) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, clientName, country }),
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

  const handleLoadFromHistory = async (analysis) => {
    // 从服务器重新获取最新数据，确保包含最新的 notFollowUpReason 和 notes
    try {
      console.log('🔄 正在从服务器加载分析 ID:', analysis.id)
      const response = await fetch(`/api/analyses/${analysis.id}`)
      if (response.ok) {
        const latestAnalysis = await response.json()
        console.log('✅ 服务器返回数据:', {
          id: latestAnalysis.id,
          hasNotes: 'notes' in latestAnalysis,
          notes: latestAnalysis.notes
        })
        setCurrentAnalysis(latestAnalysis)
      } else {
        console.warn('⚠️ 服务器响应失败，使用历史数据')
        setCurrentAnalysis(analysis)
      }
    } catch (error) {
      console.error('❌ 加载分析详情失败:', error)
      // 如果获取失败，使用传入的数据
      setCurrentAnalysis(analysis)
    }
  }

  const handleFollowUpChange = async (id, isFollowUp) => {
    console.log('App.handleFollowUpChange 被调用:', id, isFollowUp)
    
    // 从服务器获取最新数据（包括 notFollowUpReason）
    try {
      const response = await fetch(`/api/analyses/${id}`)
      if (response.ok) {
        const latestData = await response.json()
        
        // 更新历史记录中的状态
        setHistory(prevHistory => {
          const updated = prevHistory.map(item => 
            item.id === id ? { ...item, isFollowUp: latestData.isFollowUp, notFollowUpReason: latestData.notFollowUpReason } : item
          )
          console.log('历史记录已更新')
          return updated
        })
        
        // 如果当前显示的是这条记录，也更新它
        if (currentAnalysis?.id === id) {
          setCurrentAnalysis(prev => ({ 
            ...prev, 
            isFollowUp: latestData.isFollowUp,
            notFollowUpReason: latestData.notFollowUpReason
          }))
          console.log('当前分析已更新')
        }
      }
    } catch (error) {
      console.error('获取最新数据失败:', error)
      // 如果获取失败，至少更新 isFollowUp
      setHistory(prevHistory => {
        const updated = prevHistory.map(item => 
          item.id === id ? { ...item, isFollowUp } : item
        )
        return updated
      })
      if (currentAnalysis?.id === id) {
        setCurrentAnalysis(prev => ({ ...prev, isFollowUp }))
      }
    }
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
        <h1>客户问询快速分析系统</h1>
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
            currentAnalysisId={currentAnalysis?.id}
          />
        )}

        <main className="main-content">
          <RequestInput 
            key={resetKey}
            onAnalyze={handleAnalyze} 
            isAnalyzing={isAnalyzing}
            currentAnalysis={currentAnalysis}
            onFollowUpChange={handleFollowUpChange}
          />
        </main>
      </div>
    </div>
  )
}

export default App