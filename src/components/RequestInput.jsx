import { useState, useEffect, useRef } from 'react'
import './RequestInput.css'
import AnalysisResult from './AnalysisResult'

function RequestInput({ onAnalyze, isAnalyzing, currentAnalysis }) {
  const [message, setMessage] = useState('')
  const [clientName, setClientName] = useState('')
  const resultRef = useRef(null)
  const lastAnalysisIdRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim()) {
      onAnalyze(message, clientName)
      // 保留客户留言内容，不清空
    }
  }

  // 当从历史记录加载分析结果时，填充客户名称和留言内容
  useEffect(() => {
    if (currentAnalysis && currentAnalysis.id) {
      // 只有当分析ID变化时（即加载了新的历史记录或新分析完成），才填充内容
      if (lastAnalysisIdRef.current !== currentAnalysis.id) {
        lastAnalysisIdRef.current = currentAnalysis.id
        
        // 填充历史记录的内容（如果是从历史记录加载，会覆盖当前输入）
        // 如果是刚完成的分析，内容应该已经匹配，所以填充也不会有问题
        if (currentAnalysis.clientName) {
          setClientName(currentAnalysis.clientName)
        }
        if (currentAnalysis.message) {
          setMessage(currentAnalysis.message)
        }
      }
    } else if (!currentAnalysis) {
      // 当currentAnalysis被清空时，重置ref
      lastAnalysisIdRef.current = null
    }
  }, [currentAnalysis])

  // 当分析结果出现时，自动滚动到结果位置
  useEffect(() => {
    if (currentAnalysis && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [currentAnalysis])

  return (
    <div className="request-input-container">
      <form onSubmit={handleSubmit} className="request-form">
        <div className="form-group">
          <label htmlFor="clientName">客户名称（可选）</label>
          <input
            id="clientName"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="输入客户名称..."
            className="input-field"
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">客户留言</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="请输入客户的留言内容，系统将自动分析项目需求、可行性、技术栈、开发周期、风险和报价..."
            rows="8"
            className="textarea-field"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isAnalyzing || !message.trim()}
          className="analyze-button"
        >
          {isAnalyzing ? (
            <>
              <span className="spinner"></span>
              分析中...
            </>
          ) : (
            '开始分析'
          )}
        </button>
      </form>

      {/* 分析结果直接显示在按钮下方 */}
      {currentAnalysis && (
        <div ref={resultRef} className="analysis-result-wrapper">
          <AnalysisResult analysis={currentAnalysis} />
        </div>
      )}
    </div>
  )
}

export default RequestInput

