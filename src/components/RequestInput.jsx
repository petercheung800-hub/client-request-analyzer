import { useState, useEffect, useRef } from 'react'
import './RequestInput.css'
import AnalysisResult from './AnalysisResult'
import Toast from './Toast'
import { extractTextFromFile } from '../utils/pdfParser'

// 文件大小和文本长度限制
const MAX_FILE_SIZE = 500 * 1024 // 500KB（单个文件）
const MAX_TOTAL_TEXT_LENGTH = 120000 // 120K 字符（总文本长度）
const WARNING_TEXT_LENGTH = 100000 // 100K 字符（警告阈值）

function RequestInput({ onAnalyze, isAnalyzing, currentAnalysis, onFollowUpChange }) {
  const [message, setMessage] = useState('')
  const [clientName, setClientName] = useState('')
  const [country, setCountry] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [hasChanged, setHasChanged] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [textLengthWarning, setTextLengthWarning] = useState('')
  const [toast, setToast] = useState(null)
  const resultRef = useRef(null)
  const lastAnalysisIdRef = useRef(null)
  const initialMessageRef = useRef('')
  const fileInputRef = useRef(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
  }

  const closeToast = () => {
    setToast(null)
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    
    // 检查每个文件的大小
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      const fileList = oversizedFiles.map(f => 
        `• ${f.name} (${(f.size / 1024).toFixed(0)} KB)`
      ).join('\n')
      
      showToast(
        `以下文件超过大小限制（${(MAX_FILE_SIZE / 1024).toFixed(0)} KB）：\n\n${fileList}\n\n` +
        `💡 建议：\n` +
        `1. 提取文件中的关键信息后重新提交\n` +
        `2. 将大文件拆分成多个小文件\n` +
        `3. 如果是 PDF，只保留关键页面`,
        'warning'
      )
      
      // 只添加符合大小要求的文件
      const validFiles = files.filter(file => file.size <= MAX_FILE_SIZE)
      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles])
        setHasChanged(true)
      }
      
      // 清空 input，避免重复添加
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    
    setUploadedFiles(prev => [...prev, ...files])
    setHasChanged(true)
  }

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (message.trim()) {
      // 读取文件内容
      let filesContent = ''
      if (uploadedFiles.length > 0) {
        setIsProcessingFiles(true)
        try {
          for (const file of uploadedFiles) {
            try {
              console.log(`📄 正在处理文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
              const text = await extractTextFromFile(file)
              filesContent += `\n\n--- 文件: ${file.name} ---\n${text}\n`
              console.log(`✅ 文件处理完成: ${file.name}, 提取了 ${text.length} 个字符`)
            } catch (error) {
              console.error(`❌ 读取文件失败 (${file.name}):`, error)
              console.error('错误详情:', error.message)
              console.error('错误堆栈:', error.stack)
              showToast(
                `文件 "${file.name}" 处理失败\n\n${error.message}\n\n请尝试：\n1. 确保文件未损坏\n2. 如果是 PDF，尝试重新保存\n3. 或将内容复制为文本后粘贴`,
                'error'
              )
              setIsProcessingFiles(false)
              return // 停止提交
            }
          }
        } finally {
          setIsProcessingFiles(false)
        }
      }
      
      const fullMessage = message + filesContent
      
      // 检查总文本长度
      if (fullMessage.length > MAX_TOTAL_TEXT_LENGTH) {
        const overLimit = fullMessage.length - MAX_TOTAL_TEXT_LENGTH
        const overLimitPercent = ((overLimit / MAX_TOTAL_TEXT_LENGTH) * 100).toFixed(1)
        
        showToast(
          `内容过长，无法分析\n\n` +
          `当前内容：${(fullMessage.length / 1000).toFixed(1)}K 字符\n` +
          `系统限制：${(MAX_TOTAL_TEXT_LENGTH / 1000).toFixed(0)}K 字符\n` +
          `超出限制：${(overLimit / 1000).toFixed(1)}K 字符 (${overLimitPercent}%)\n\n` +
          `💡 建议：\n` +
          `1. 提取关键信息（需求、功能描述等）后重新提交\n` +
          `2. 将内容拆分成多个部分分别分析\n` +
          `3. 删除不必要的附件或缩短文本内容`,
          'error'
        )
        return
      }
      
      onAnalyze(fullMessage, clientName, country)
      // 保留客户问询内容，不清空
      // 分析完成后，更新初始消息并重置变化状态
      initialMessageRef.current = message
      setHasChanged(false)
      setTextLengthWarning('') // 清空警告
      // 清空上传的文件
      setUploadedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 当从历史记录加载分析结果时，填充客户名称和问询内容
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
        if (currentAnalysis.country) {
          setCountry(currentAnalysis.country)
        }
        if (currentAnalysis.message) {
          setMessage(currentAnalysis.message)
          initialMessageRef.current = currentAnalysis.message
        }
        setHasChanged(false)
      }
    } else if (!currentAnalysis) {
      // 当currentAnalysis被清空时，重置ref
      lastAnalysisIdRef.current = null
    }
  }, [currentAnalysis])

  // 监听消息内容变化
  const handleMessageChange = (e) => {
    const newMessage = e.target.value
    setMessage(newMessage)
    setHasChanged(newMessage !== initialMessageRef.current)
    
    // 检查文本长度并显示警告
    const textLength = newMessage.length
    if (textLength > MAX_TOTAL_TEXT_LENGTH) {
      setTextLengthWarning(`❌ 超出限制 ${((textLength - MAX_TOTAL_TEXT_LENGTH) / 1000).toFixed(1)}K 字符`)
    } else if (textLength > WARNING_TEXT_LENGTH) {
      const percentage = ((textLength / MAX_TOTAL_TEXT_LENGTH) * 100).toFixed(0)
      setTextLengthWarning(`⚠️ 已使用 ${percentage}% (${(textLength / 1000).toFixed(1)}K/${(MAX_TOTAL_TEXT_LENGTH / 1000).toFixed(0)}K 字符)`)
    } else {
      setTextLengthWarning('')
    }
  }

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
        <div className="form-row">
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
            <label htmlFor="country">所在国家（可选）</label>
            <input
              id="country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="输入所在国家..."
              className="input-field"
            />
          </div>
        </div>

        <div className="form-group">
          <div className="label-with-counter">
            <label htmlFor="message">客户问询</label>
            {textLengthWarning && (
              <span className={`text-length-warning ${message.length > MAX_TOTAL_TEXT_LENGTH ? 'error' : 'warning'}`}>
                {textLengthWarning}
              </span>
            )}
          </div>
          <textarea
            id="message"
            value={message}
            onChange={handleMessageChange}
            placeholder="请输入客户的问询内容，系统将自动分析项目需求、可行性、技术栈、开发周期、风险和报价..."
            rows="8"
            className="textarea-field"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="fileUpload">上传需求文档（可选）</label>
          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              id="fileUpload"
              type="file"
              multiple
              accept=".txt,.md,.doc,.docx,.pdf"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="fileUpload" className="file-upload-label">
              <span className="upload-icon">📎</span>
              <span>点击上传或拖拽文件到此处</span>
              <span className="file-hint">支持 TXT, MD, DOC, DOCX, PDF 格式</span>
            </label>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">📄 {file.name}</span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeFile(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isAnalyzing || isProcessingFiles || !message.trim() || !hasChanged}
          className="analyze-button"
        >
          {isProcessingFiles ? (
            <>
              <span className="spinner"></span>
              处理文件中...
            </>
          ) : isAnalyzing ? (
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
          <AnalysisResult 
            analysis={currentAnalysis} 
            onFollowUpChange={onFollowUpChange}
          />
        </div>
      )}

      {/* Toast 通知 */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={closeToast}
        />
      )}
    </div>
  )
}

export default RequestInput

