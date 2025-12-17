import { useState, useEffect, useRef } from 'react'
import './AnalysisResult.css'
import { playNotificationSound } from '../utils/sound'

function AnalysisResult({ analysis, onFollowUpChange }) {
  const [activeTab, setActiveTab] = useState('analysis') // 'analysis' or 'notes'
  const [notes, setNotes] = useState('')
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [questionInput, setQuestionInput] = useState('')
  const [questionAnswer, setQuestionAnswer] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savedQAs, setSavedQAs] = useState([])
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [followUpIndex, setFollowUpIndex] = useState(null)
  const [notFollowUpReason, setNotFollowUpReason] = useState('')
  const notesTextareaRef = useRef(null)
  const [activeFormats, setActiveFormats] = useState({})
  const originalNotesRef = useRef('')
  const [rates, setRates] = useState({});
  const [days, setDays] = useState({});
  const [totalCost, setTotalCost] = useState(null);
  const [strategyDescription, setStrategyDescription] = useState(analysis?.strategyDescription || '');
  const [showStrategyInput, setShowStrategyInput] = useState(false);
  const strategyTextareaRef = useRef(null);
  
  // 处理单价变化
  const handleRateChange = (index, value) => {
    setRates(prev => ({
      ...prev,
      [index]: value
    }));
  };
  
  // 处理工作天数变化
  const handleDaysChange = (index, value) => {
    setDays(prev => ({
      ...prev,
      [index]: value
    }));
  };
  
  // 保存总报价到数据库
  const saveTotalCostToDatabase = async (totalCost) => {
    try {
      // 准备定价详情数据
      const pricingDetails = {
        days: days,
        rates: rates,
        costTable: data.pricing.costTable.map((item, idx) => {
          const durationMatch = item.duration.match(/(\d+)/);
          const defaultDays = durationMatch ? parseInt(durationMatch[1]) : 0;
          const workDays = parseFloat(days[idx] !== undefined ? days[idx] : defaultDays);
          const hourlyRate = parseFloat(rates[idx]);
          return {
            role: item.role,
            duration: workDays,
            hourlyRate: hourlyRate,
            tasks: item.tasks
          };
        })
      };
      
      // 发送请求保存总报价
      const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/total-cost`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totalCost: totalCost,
          pricingDetails: pricingDetails
        })
      });
      
      if (response.ok) {
        console.log('总报价保存成功');
      } else {
        console.error('保存总报价失败:', await response.text());
      }
    } catch (error) {
      console.error('保存总报价失败:', error);
    }
  };
  
  // 保存策略描述到数据库
  const saveStrategyDescriptionToDatabase = async (description) => {
    try {
      // 发送请求保存策略描述
      const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/strategy-description`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategyDescription: description
        })
      });
      
      if (response.ok) {
        console.log('策略描述保存成功');
      } else {
        console.error('保存策略描述失败:', await response.text());
      }
    } catch (error) {
      console.error('保存策略描述失败:', error);
    }
  };
  
  // 处理策略描述变化
  const handleStrategyDescriptionChange = (e) => {
    setStrategyDescription(e.target.value);
  };
  
  // 自动调整文本框高度
  const autoAdjustHeight = (textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };
  
  // 格式化策略描述（去除首尾空格）
  const formatStrategyDescription = () => {
    const formatted = strategyDescription.trim();
    setStrategyDescription(formatted);
    if (analysis.id) {
      saveStrategyDescriptionToDatabase(formatted);
    }
  };
  
  // 计算总成本
  const calculateTotalCost = () => {
    let total = 0;
    data.pricing.costTable.forEach((item, idx) => {
      // 从工作时长中提取天数作为默认值（如果未输入）
      const durationMatch = item.duration.match(/(\d+)/);
      const defaultDays = durationMatch ? parseInt(durationMatch[1]) : 0;
      
      // 获取工作天数：优先使用用户输入，否则使用默认值
      const workDays = parseFloat(days[idx] !== undefined ? days[idx] : defaultDays);
      
      // 获取单价：使用用户输入，如果未输入则跳过
      const hourlyRate = parseFloat(rates[idx]);
      
      // 只有当单价有效时才计算该角色的成本
      if (!isNaN(hourlyRate)) {
        // 将天数转换为小时数（假设每天工作8小时）
        const hours = workDays * 8;
        total += hours * hourlyRate;
      }
    });
    
    setTotalCost(total);
    
    // 显示策略描述输入框
    setShowStrategyInput(true);
    
    // 保存总报价到数据库
    if (analysis.id) {
      saveTotalCostToDatabase(total);
    }
  };
    
    // 初始状态设置为true，后续会在useEffect中更新
  const [isFollowUp, setIsFollowUp] = useState(true)
  
  // 使用数据库中的 isFollowUp 值，如果没有则根据可行性分析判断
  const getInitialFollowUpStatus = (analysisData) => {
    // 确保传入了analysisData
    if (!analysisData) return true
    
    // 优先使用数据库中的值
    if (analysisData.isFollowUp !== undefined) {
      return analysisData.isFollowUp
    }
    // 如果数据库中没有，则根据可行性分析判断
    if (!analysisData.analysis?.feasibility?.overall) return true
    const overall = analysisData.analysis.feasibility.overall
    return overall.includes('可行') && !overall.includes('不可行')
  }

  // 当 analysis 改变时，重置并同步所有相关状态
  useEffect(() => {
    // 重置所有状态
    setActiveTab('analysis')
    setNotes('')
    setActiveQuestion(null)
    setQuestionInput('')
    setQuestionAnswer(null)
    setIsLoading(false)
    setSavedQAs([])
    setShowSavedToast(false)
    setEditingIndex(null)
    setFollowUpIndex(null)
    setNotFollowUpReason('')
    setActiveFormats({})
    setRates({})
    setDays({})
    setTotalCost(null)
    setStrategyDescription('')
    setShowStrategyInput(false)
    
    // 如果没有analysis对象，直接返回
    if (!analysis) return
    
    console.log('📝 AnalysisResult - 加载新的分析记录:', {
      analysisId: analysis.id,
      clientName: analysis.clientName
    })
    
    // 同步跟进状态
    setIsFollowUp(analysis.isFollowUp !== undefined ? analysis.isFollowUp : getInitialFollowUpStatus(analysis))
    
    // 同步不跟进原因
    setNotFollowUpReason(analysis.notFollowUpReason || '')
    
    // 从数据库加载问答数据
    if (analysis.savedQAs) {
      setSavedQAs(analysis.savedQAs)
      console.log('已加载问答数据:', analysis.savedQAs.length, '条')
    } else {
      setSavedQAs([])
    }
    
    // 加载笔记
    if (analysis.notes) {
      console.log('✅ 设置笔记内容')
      setNotes(analysis.notes)
      originalNotesRef.current = analysis.notes
      // 设置富文本编辑器的内容
      if (notesTextareaRef.current) {
        notesTextareaRef.current.innerHTML = analysis.notes
      }
    } else {
      console.log('⚠️ 没有笔记，清空编辑器')
      setNotes('')
      originalNotesRef.current = ''
      if (notesTextareaRef.current) {
        notesTextareaRef.current.innerHTML = ''
      }
    }
    
    // 从数据库加载定价详情
    if (analysis.pricingDetails && typeof analysis.pricingDetails === 'object') {
      console.log('已加载定价详情:', analysis.pricingDetails)
      // 恢复工作天数
      setDays(analysis.pricingDetails.days || {})
      // 恢复单价
      setRates(analysis.pricingDetails.rates || {})
      // 恢复总报价
      setTotalCost(analysis.totalCost !== null ? analysis.totalCost : null)
    } else {
      // 没有定价详情，重置为空对象
      setDays({})
      setRates({})
      setTotalCost(null)
    }
    
    // 从数据库加载策略描述
    if (analysis.strategyDescription) {
      console.log('已加载策略描述:', analysis.strategyDescription)
      setStrategyDescription(analysis.strategyDescription)
    } else {
      setStrategyDescription('')
    }
    
    // 设置策略描述输入框显示状态
    setShowStrategyInput(analysis.totalCost !== null)
    
  }, [analysis])

  // 当切换到笔记标签时，确保编辑器内容正确显示
  useEffect(() => {
    if (activeTab === 'notes' && notesTextareaRef.current && notes) {
      // 只在编辑器内容与 state 不一致时更新
      if (notesTextareaRef.current.innerHTML !== notes) {
        console.log('🔄 更新编辑器内容:', notes)
        notesTextareaRef.current.innerHTML = notes
      }
    }
  }, [activeTab, notes])

  // 检测当前格式状态
  const updateFormatState = () => {
    const formats = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    }
    
    // 检测高亮（mark 标签或背景色）
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      let node = selection.anchorNode
      formats.highlight = false
      
      // 向上查找父节点，检查是否在 mark 标签内
      while (node && node !== notesTextareaRef.current) {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'MARK' || 
              (node.style && node.style.backgroundColor && 
               node.style.backgroundColor !== 'transparent' &&
               node.style.backgroundColor !== 'rgba(0, 0, 0, 0)')) {
            formats.highlight = true
            break
          }
        }
        node = node.parentNode
      }
    }
    
    setActiveFormats(formats)
  }

  // 切换高亮
  const toggleHighlight = () => {
    const selection = window.getSelection()
    if (!selection.rangeCount) return

    const range = selection.getRangeAt(0)
    
    // 如果没有选中文字，不执行操作
    if (range.collapsed) {
      notesTextareaRef.current?.focus()
      return
    }

    // 检查选中区域的父节点是否是 mark 标签
    let parentNode = range.commonAncestorContainer
    let markElement = null
    
    // 向上查找 mark 标签
    while (parentNode && parentNode !== notesTextareaRef.current) {
      if (parentNode.nodeType === 1 && parentNode.tagName === 'MARK') {
        markElement = parentNode
        break
      }
      parentNode = parentNode.parentNode
    }
    
    if (markElement) {
      // 如果在 mark 标签内，移除高亮
      const parent = markElement.parentNode
      while (markElement.firstChild) {
        parent.insertBefore(markElement.firstChild, markElement)
      }
      parent.removeChild(markElement)
      
      // 合并相邻的文本节点
      parent.normalize()
    } else {
      // 如果不在 mark 标签内，添加高亮
      const mark = document.createElement('mark')
      
      try {
        // 尝试直接包裹选中内容
        range.surroundContents(mark)
      } catch (e) {
        // 如果失败（比如选中了部分元素），使用备用方法
        const fragment = range.extractContents()
        mark.appendChild(fragment)
        range.insertNode(mark)
      }
    }
    
    // 清除选择
    selection.removeAllRanges()
    
    // 更新 notes 状态
    if (notesTextareaRef.current) {
      setNotes(notesTextareaRef.current.innerHTML)
    }
    
    // 延迟更新格式状态和聚焦
    setTimeout(() => {
      updateFormatState()
      notesTextareaRef.current?.focus()
    }, 0)
  }

  // 应用富文本格式
  const applyFormat = (command, value = null) => {
    // 阻止默认行为，防止触发 blur
    document.execCommand(command, false, value)
    // 更新格式状态
    updateFormatState()
    // 立即重新聚焦到编辑器，防止触发 onBlur
    notesTextareaRef.current?.focus()
  }

  // 清除格式
  const clearFormat = () => {
    const selection = window.getSelection()
    if (!selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()

    if (selectedText) {
      // 如果有选中文字，只清除选中部分的格式
      const textNode = document.createTextNode(selectedText)
      range.deleteContents()
      range.insertNode(textNode)
      
      // 保持选中状态
      range.selectNode(textNode)
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      // 如果没有选中文字，清除所有格式
      const plainText = notesTextareaRef.current?.innerText || ''
      if (notesTextareaRef.current) {
        notesTextareaRef.current.innerHTML = plainText
      }
      setNotes(plainText)
    }
    
    notesTextareaRef.current?.focus()
  }



  // 保存笔记到数据库
  const saveNotes = async () => {
    if (!analysis?.id) {
      return
    }
    
    // 获取当前笔记内容（HTML格式）
    const currentNotes = notes
    const originalNotes = originalNotesRef.current
    
    // 检查内容是否有变化
    if (currentNotes === originalNotes) {
      console.log('📝 笔记内容未变化，跳过保存')
      return
    }
    
    // 检查是否为空内容（只有空白字符或空标签）
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = currentNotes
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    const shouldShowToast = textContent.trim().length > 0
    
    try {
      const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: currentNotes })
      })
      
      if (response.ok) {
        console.log('✅ 笔记已保存到数据库')
        // 更新原始内容引用
        originalNotesRef.current = currentNotes
        
        if (shouldShowToast) {
          setShowSavedToast(true)
          setTimeout(() => setShowSavedToast(false), 2000)
        }
      }
    } catch (error) {
      console.error('❌ 保存笔记失败:', error)
    }
  }

  if (!analysis || !analysis.analysis) {
    return null
  }

  const data = analysis.analysis

  const handleAskQuestion = async (sectionTitle, sectionData) => {
    if (!questionInput.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/ask-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionTitle,
          sectionData,
          question: questionInput,
          fullAnalysis: data
        })
      })

      if (!response.ok) {
        throw new Error('提问失败')
      }

      const result = await response.json()
      setQuestionAnswer(result.answer)
      // 播放完成提示音
      playNotificationSound()
    } catch (error) {
      console.error('提问错误:', error)
      alert('提问失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const openQuestionDialog = (sectionTitle) => {
    setActiveQuestion(sectionTitle)
    setQuestionInput('')
    setQuestionAnswer(null)
  }

  const closeQuestionDialog = () => {
    setActiveQuestion(null)
    setQuestionInput('')
    setQuestionAnswer(null)
    setEditingIndex(null)
    setFollowUpIndex(null)
  }

  const saveQAsToDatabase = async (qas) => {
    if (analysis.id) {
      try {
        const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/qas`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ savedQAs: qas })
        })
        
        if (response.ok) {
          console.log('✅ 问答数据已保存到数据库')
        } else {
          console.error('❌ 保存问答数据失败')
        }
      } catch (error) {
        console.error('❌ 保存问答数据失败:', error)
      }
    }
  }

  const saveAnswer = () => {
    if (questionAnswer && questionInput) {
      let newQAs
      if (editingIndex !== null) {
        // 如果是编辑模式，替换原来的问答
        newQAs = [...savedQAs]
        newQAs[editingIndex] = {
          section: activeQuestion,
          question: questionInput,
          answer: questionAnswer,
          timestamp: new Date().toLocaleString('zh-CN'),
          followUps: newQAs[editingIndex].followUps || [] // 保留追问历史
        }
        setEditingIndex(null)
      } else {
        // 新增问答
        newQAs = [...savedQAs, {
          section: activeQuestion,
          question: questionInput,
          answer: questionAnswer,
          timestamp: new Date().toLocaleString('zh-CN'),
          followUps: [] // 初始化追问数组
        }]
      }
      setSavedQAs(newQAs)
      saveQAsToDatabase(newQAs) // 保存到数据库
      
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 3000)
      
      // 自动关闭对话框
      closeQuestionDialog()
    }
  }

  const deleteQA = (index) => {
    const newQAs = savedQAs.filter((_, i) => i !== index)
    setSavedQAs(newQAs)
    saveQAsToDatabase(newQAs) // 保存到数据库
  }

  const editQA = (index) => {
    const qa = savedQAs[index]
    setActiveQuestion(qa.section)
    setQuestionInput(qa.question)
    setQuestionAnswer(qa.answer)
    setEditingIndex(index)
  }

  const followUpQuestion = (index) => {
    const qa = savedQAs[index]
    setActiveQuestion(qa.section)
    setQuestionInput('')
    setQuestionAnswer(null)
    setFollowUpIndex(index) // 记录是对哪个问答的追问
  }

  const saveFollowUp = () => {
    if (followUpIndex !== null && questionAnswer && questionInput) {
      const newQAs = [...savedQAs]
      if (!newQAs[followUpIndex].followUps) {
        newQAs[followUpIndex].followUps = []
      }
      newQAs[followUpIndex].followUps.push({
        question: questionInput,
        answer: questionAnswer,
        timestamp: new Date().toLocaleString('zh-CN')
      })
      setSavedQAs(newQAs)
      saveQAsToDatabase(newQAs) // 保存到数据库
      
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 3000)
      closeQuestionDialog()
    }
  }

  const handleFollowUpToggle = async () => {
    const newStatus = !isFollowUp
    setIsFollowUp(newStatus)
    
    // 如果切换到"可跟进"，清空原因
    const reasonToSave = newStatus ? '' : notFollowUpReason
    if (newStatus) {
      setNotFollowUpReason('')
    }
    
    // 如果有回调函数，通知父组件状态变化
    if (onFollowUpChange && analysis.id) {
      try {
        const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/follow-up`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            isFollowUp: newStatus,
            notFollowUpReason: reasonToSave
          })
        })
        
        if (response.ok) {
          onFollowUpChange(analysis.id, newStatus)
          console.log('✅ 跟进状态已更新:', analysis.id, newStatus ? '可跟进' : '不跟进')
        }
      } catch (error) {
        console.error('❌ 更新跟进状态失败:', error)
        // 如果更新失败，回滚状态
        setIsFollowUp(!newStatus)
      }
    }
  }
  
  const handleReasonChange = (e) => {
    const newReason = e.target.value
    setNotFollowUpReason(newReason)
  }
  
  const saveNotFollowUpReason = async () => {
    if (analysis.id && !isFollowUp) {
      try {
        console.log('保存不跟进原因:', notFollowUpReason)
        const response = await fetch(`http://localhost:3001/api/analyses/${analysis.id}/follow-up`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            isFollowUp: false,
            notFollowUpReason: notFollowUpReason
          })
        })
        
        if (response.ok) {
          console.log('✅ 不跟进原因已保存')
          // 通知父组件更新（这样历史记录也会同步）
          if (onFollowUpChange) {
            onFollowUpChange(analysis.id, false)
          }
        } else {
          console.error('❌ 保存失败:', await response.text())
        }
      } catch (error) {
        console.error('❌ 保存不跟进原因失败:', error)
      }
    }
  }
  
  const handleReasonBlur = () => {
    // 失去焦点时保存
    saveNotFollowUpReason()
  }

  return (
    <div className="analysis-result">
      <div className="result-header">
        <div className="result-header-left">
          <div className="header-title-row">
            <h2>分析结果</h2>
            {analysis.clientName && (
              <span className="client-badge">{analysis.clientName}</span>
            )}
            {analysis.createdAt && (
              <span className="date-badge">
                {new Date(analysis.createdAt).toLocaleString('zh-CN')}
              </span>
            )}
          </div>
          <div className="tab-switcher">
            <button 
              className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              <span className="tab-icon">🤖</span>
              AI分析
            </button>
            <button 
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <span className="tab-icon">📝</span>
              我的笔记
            </button>
          </div>
        </div>
        <div className="follow-up-section">
          <span className="toggle-label">
            {isFollowUp ? '可跟进' : '不跟进'}
          </span>
          <label className={`follow-up-toggle ${!isFollowUp ? 'not-following' : ''}`}>
            <input
              type="checkbox"
              checked={isFollowUp}
              onChange={handleFollowUpToggle}
            />
            <span className="toggle-slider"></span>
          </label>
          {!isFollowUp && (
            <div className="not-follow-up-reason">
              <textarea
                placeholder="请输入不跟进的原因（选填）..."
                value={notFollowUpReason}
                onChange={handleReasonChange}
                onBlur={handleReasonBlur}
                rows="3"
              />
              <div className="reason-hint">
                💡 输入完成后点击其他地方自动保存
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'notes' ? (
        <div className="notes-container">
          <div className="notes-editor">
            <div className="notes-toolbar">
              <button
                className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
                title="加粗 (Ctrl+B)"
              >
                <strong>B</strong>
              </button>
              <button
                className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
                title="斜体 (Ctrl+I)"
              >
                <em>I</em>
              </button>
              <button
                className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
                title="下划线 (Ctrl+U)"
              >
                <u>U</u>
              </button>
              <button
                className={`toolbar-btn ${activeFormats.strikeThrough ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('strikeThrough'); }}
                title="删除线"
              >
                <s>S</s>
              </button>
              <div className="toolbar-divider"></div>
              <button
                className="toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('formatBlock', 'h2'); }}
                title="标题"
              >
                H1
              </button>
              <button
                className="toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('formatBlock', 'h3'); }}
                title="小标题"
              >
                H2
              </button>
              <button
                className={`toolbar-btn ${activeFormats.insertUnorderedList ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('insertUnorderedList'); }}
                title="无序列表"
              >
                ≡
              </button>
              <button
                className={`toolbar-btn ${activeFormats.insertOrderedList ? 'active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); applyFormat('insertOrderedList'); }}
                title="有序列表"
              >
                1.
              </button>
              <div className="toolbar-divider"></div>
              <button
                className="toolbar-btn color-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#ef4444'); }}
                title="红色"
                style={{ color: '#ef4444' }}
              >
                ●
              </button>
              <button
                className="toolbar-btn color-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#f59e0b'); }}
                title="橙色"
                style={{ color: '#f59e0b' }}
              >
                ●
              </button>
              <button
                className="toolbar-btn color-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#10b981'); }}
                title="绿色"
                style={{ color: '#10b981' }}
              >
                ●
              </button>
              <button
                className="toolbar-btn color-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#3b82f6'); }}
                title="蓝色"
                style={{ color: '#3b82f6' }}
              >
                ●
              </button>
              <button
                className="toolbar-btn color-btn"
                onMouseDown={(e) => { e.preventDefault(); applyFormat('foreColor', '#8b5cf6'); }}
                title="紫色"
                style={{ color: '#8b5cf6' }}
              >
                ●
              </button>
              <div className="toolbar-divider"></div>
              <button
                className={`toolbar-btn ${activeFormats.highlight ? 'active-highlight' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); toggleHighlight(); }}
                title="高亮（再次点击取消）"
              >
                H
              </button>
              <button
                className="toolbar-btn"
                onMouseDown={(e) => { e.preventDefault(); clearFormat(); }}
                title="清除格式"
              >
                ✕
              </button>
            </div>
            <div
              ref={notesTextareaRef}
              className="notes-textarea rich-text"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setNotes(e.currentTarget.innerHTML)}
              onKeyUp={updateFormatState}
              onMouseUp={updateFormatState}
              onFocus={updateFormatState}
              onPaste={(e) => {
                // 阻止默认粘贴行为
                e.preventDefault()
                
                // 获取纯文本
                const text = e.clipboardData.getData('text/plain')
                
                // 插入纯文本
                document.execCommand('insertText', false, text)
              }}
              data-placeholder="在这里记录你的想法、补充信息、待办事项等..."
            />
            <div className="notes-actions">
              <button 
                className="save-notes-btn"
                onClick={saveNotes}
              >
                💾 保存笔记
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {data.summary && (
            <Section 
              title="项目概述" 
              onAskQuestion={() => openQuestionDialog('项目概述')}
            >
              <p className="summary-text">{data.summary}</p>
            </Section>
          )}
        </>
      )}

      {activeTab === 'analysis' && (
        <>
          {data.requirements && (
            <Section 
              title="项目需求"
              onAskQuestion={() => openQuestionDialog('项目需求')}
            >
          <div className="requirements-grid">
            {data.requirements.functional && data.requirements.functional.length > 0 && (
              <div className="requirement-group">
                <h4>功能需求</h4>
                <ul>
                  {data.requirements.functional.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.requirements.nonFunctional && data.requirements.nonFunctional.length > 0 && (
              <div className="requirement-group">
                <h4>非功能需求</h4>
                <ul>
                  {data.requirements.nonFunctional.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.feasibility && (
        <Section 
          title="可行性分析"
          onAskQuestion={() => openQuestionDialog('可行性分析')}
        >
          <div className="feasibility-content">
            {data.feasibility.technical && (
              <div className="feasibility-item">
                <h4>技术可行性</h4>
                <p>{data.feasibility.technical}</p>
              </div>
            )}
            {data.feasibility.time && (
              <div className="feasibility-item">
                <h4>时间可行性</h4>
                <p>{data.feasibility.time}</p>
              </div>
            )}
            {data.feasibility.resource && (
              <div className="feasibility-item">
                <h4>资源可行性</h4>
                <p>{data.feasibility.resource}</p>
              </div>
            )}
            {data.feasibility.overall && (
              <div className="feasibility-overall">
                <strong>总体评估：</strong>
                <span className={`overall-badge ${getFeasibilityClass(data.feasibility.overall)}`}>
                  {data.feasibility.overall}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.techStack && (
        <Section 
          title="技术栈建议"
          onAskQuestion={() => openQuestionDialog('技术栈建议')}
        >
          <div className="tech-stack-content">
            {data.techStack.frontend && data.techStack.frontend.length > 0 && (
              <div className="tech-group">
                <h4>前端技术</h4>
                <div className="tech-tags">
                  {data.techStack.frontend.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.backend && data.techStack.backend.length > 0 && (
              <div className="tech-group">
                <h4>后端技术</h4>
                <div className="tech-tags">
                  {data.techStack.backend.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.database && data.techStack.database.length > 0 && (
              <div className="tech-group">
                <h4>数据库</h4>
                <div className="tech-tags">
                  {data.techStack.database.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.server && data.techStack.server.length > 0 && (
              <div className="tech-group">
                <h4>服务器</h4>
                <div className="tech-tags">
                  {data.techStack.server.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.other && data.techStack.other.length > 0 && (
              <div className="tech-group">
                <h4>其他技术</h4>
                <div className="tech-tags">
                  {data.techStack.other.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.reasoning && (
              <div className="tech-reasoning">
                <h4>选型理由</h4>
                <p>{data.techStack.reasoning}</p>
              </div>
            )}
            {data.techStack.serverReasoning && (
              <div className="tech-reasoning">
                <h4>服务器选型理由</h4>
                <p>{data.techStack.serverReasoning}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      

      {data.risks && data.risks.length > 0 && (
        <Section 
          title="风险分析"
          onAskQuestion={() => openQuestionDialog('风险分析')}
        >
          <div className="risks-content">
            {data.risks.map((risk, idx) => (
              <div key={idx} className="risk-item">
                <div className="risk-header">
                  <span className={`risk-type ${risk.type}`}>{risk.type}</span>
                  <span className={`risk-impact ${getRiskClass(risk.impact)}`}>
                    {risk.impact}风险
                  </span>
                </div>
                <div className="risk-description">
                  <p>{risk.description}</p>
                </div>
                <div className="risk-mitigation">
                  <strong>应对措施：</strong>
                  <p>{risk.mitigation}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.teamMembers && (
        <Section 
          title="团队成员配置"
          onAskQuestion={() => openQuestionDialog('团队成员配置')}
        >
          <div className="team-content">
            {data.teamMembers.roles && data.teamMembers.roles.map((role, idx) => (
              <div key={idx} className="role-item">
                <div className="role-header">
                  <h4>{role.role}</h4>
                  <span className="role-count">{role.count}</span>
                  <span className={`role-level ${getLevelClass(role.level)}`}>
                    {role.level}
                  </span>
                </div>
                <div className="role-skills">
                  <strong>所需技能：</strong>
                  {role.skills && role.skills.join('、')}
                </div>
                <div className="role-responsibilities">
                  <strong>职责描述：</strong>
                  <ul>
                    {role.responsibilities && role.responsibilities.map((resp, respIdx) => (
                      <li key={respIdx}>{resp}</li>
                    ))}
                  </ul>
                </div>
                <div className="role-workload">
                  <strong>工作量：</strong>
                  {role.workload}
                </div>
                <div className="role-deliverables">
                  <strong>关键交付物：</strong>
                  {role.keyDeliverables && role.keyDeliverables.join('、')}
                </div>
              </div>
            ))}
            {data.teamMembers.totalCount && (
              <div className="team-summary">
                <strong>团队总人数：</strong>
                <span className="team-count">{data.teamMembers.totalCount}</span>
              </div>
            )}
            {data.teamMembers.teamStructure && (
              <div className="team-structure">
                <strong>团队结构：</strong>
                <p>{data.teamMembers.teamStructure}</p>
              </div>
            )}
            {data.teamMembers.keyRequirements && (
              <div className="team-requirements">
                <strong>关键要求：</strong>
                <ul>
                  {data.teamMembers.keyRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.pricing && (
        <Section 
          title="报价分析"
          onAskQuestion={() => openQuestionDialog('报价分析')}
        >
          <div className="pricing-content">
            {data.timeline && data.timeline.totalDuration && (
              <div className="pricing-timeline">
                <h4>总开发周期</h4>
                <div className="duration-badge">{data.timeline.totalDuration}</div>
              </div>
            )}
            {data.pricing.costTable && data.pricing.costTable.length > 0 && (
              <div className="pricing-breakdown">
                <h4>人力成本明细</h4>
                <div className="cost-table-container">
                  <table className="cost-table">
                    <thead>
                      <tr>
                        <th>项目角色</th>
                        <th>工作天数</th>
                        <th>单价 ($/小时)</th>
                        <th>工作内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pricing.costTable.map((item, idx) => {
                        // 从工作时长中提取天数作为默认值
                        const durationMatch = item.duration.match(/(\d+)/);
                        const defaultDays = durationMatch ? parseInt(durationMatch[1]) : 0;
                        return (
                          <tr key={idx}>
                            <td>{item.role}</td>
                            <td>
                              <input
                                type="number"
                                className="rate-input"
                                value={days[idx] || defaultDays}
                                onChange={(e) => handleDaysChange(idx, e.target.value)}
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="rate-input"
                                value={rates[idx] || ''}
                                onChange={(e) => handleRateChange(idx, e.target.value)}
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>{item.tasks}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="cost-calculation">
                    <button 
                      className="calculate-btn"
                      onClick={calculateTotalCost}
                      disabled={Object.keys(rates).length === 0}
                    >
                      计算总报价
                    </button>
                    {totalCost !== null && (
                      <div className="total-cost-display">
                        <strong>总报价: ${totalCost.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                  
                  {/* 策略描述输入框 */}
                  {showStrategyInput && (
                    <div className="strategy-description-section">
                      <h4>报价策略说明</h4>
                      <textarea
                        ref={strategyTextareaRef}
                        className="strategy-description-input"
                        placeholder="请输入本次报价的策略说明（如定价依据、优惠条件、服务范围等）"
                        value={strategyDescription}
                        onChange={(e) => {
                          handleStrategyDescriptionChange(e);
                          autoAdjustHeight(e.target);
                        }}
                        onBlur={formatStrategyDescription}
                        onFocus={() => {
                          if (strategyTextareaRef.current) {
                            autoAdjustHeight(strategyTextareaRef.current);
                          }
                        }}
                        rows="4"
                        maxLength="2000"
                      />
                      <div className="input-info">
                        <span className="char-count">{strategyDescription.length}/2000</span>
                        <span className="input-hint">提示：输入完成后点击其他区域自动保存</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 显示已保存的策略描述 */}
                  {totalCost !== null && strategyDescription && !showStrategyInput && (
                    <div className="strategy-description-display">
                      <h4>报价策略说明</h4>
                      <div className="strategy-content">
                        {strategyDescription.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {data.pricing.breakdown && data.pricing.breakdown.server && (
              <div className="pricing-breakdown">
                <h4>服务器成本明细</h4>
                <div className="cost-table-container">
                  {/* 解析服务器成本数据 */}
                  {(() => {
                    let services = [];
                    let firstYearEstimate = '';
                    let note = '';
                    
                    if (typeof data.pricing.breakdown.server === 'string') {
                      // 字符串格式，解析成本信息
                      const costString = data.pricing.breakdown.server;
                      const parts = costString.split('，');
                      
                      // 提取各项服务成本
                      parts.forEach(part => {
                        if (part.includes('AWS EC2')) {
                          services.push({
                            name: 'AWS EC2',
                            cost: part.replace(/^服务器成本：?/, '').trim()
                          });
                        } else if (part.includes('RDS')) {
                          services.push({
                            name: 'RDS',
                            cost: part.trim()
                          });
                        } else if (part.includes('S3')) {
                          services.push({
                            name: 'S3',
                            cost: part.trim()
                          });
                        } else if (part.includes('CDN流量费')) {
                          services.push({
                            name: 'CDN流量费',
                            cost: part.trim()
                          });
                        } else if (part.includes('首年预估')) {
                          firstYearEstimate = part.replace(/^服务器成本：?/, '').trim();
                        } else if (part.includes('基于初始流量')) {
                          note = part.trim();
                        }
                      });
                    } else if (typeof data.pricing.breakdown.server === 'object') {
                      // 结构化数据，转换为简化格式
                      services = Object.entries(data.pricing.breakdown.server).map(([name, cost]) => ({
                        name,
                        cost: typeof cost === 'object' ? 
                          `${cost.amount} ${cost.billingCycle || ''}` : 
                          cost
                      }));
                    }
                    
                    return (
                      <>
                        {/* 简化的服务器成本表格 */}
                        <table className="cost-table server-cost-simple">
                          <thead>
                            <tr>
                              <th>服务器项目名称</th>
                              <th>费用信息</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* 默认服务列表 */}
                            {services.length === 0 && (
                              <>
                                <tr>
                                  <td>AWS EC2</td>
                                  <td className="amount-right">t3.medium $50-80/月</td>
                                </tr>
                                <tr>
                                  <td>RDS</td>
                                  <td className="amount-right">$100-150/月</td>
                                </tr>
                                <tr>
                                  <td>S3</td>
                                  <td className="amount-right">$20-50/月</td>
                                </tr>
                                <tr>
                                  <td>CDN流量费</td>
                                  <td className="amount-right">$0.15-0.25/GB</td>
                                </tr>
                              </>
                            )}
                            {/* 实际服务列表 */}
                            {services.map((service, idx) => (
                              <tr key={idx}>
                                <td>{service.name}</td>
                                <td className="amount-right">{service.cost}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {/* 首年预估费用和说明 */}
                        <div className="first-year-estimate">
                          <div className="estimate-amount">
                            <strong>首年预估费用：</strong>
                            {firstYearEstimate || '$2,000 - $3,000'}
                          </div>
                          <div className="estimate-note">
                            {note || '基于初始流量和扩展需求'}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            {data.pricing.factors && data.pricing.factors.length > 0 && (
              <div className="pricing-factors">
                <h4>影响报价的因素</h4>
                <ul>
                  {data.pricing.factors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}
        </>
      )}

      {/* 问答记录 */}
      {activeTab === 'analysis' && savedQAs.length > 0 && (
        <Section title="问答记录">
          <div className="saved-qa-list">
            {savedQAs.map((qa, index) => (
              <div key={index} className="saved-qa-item">
                <div className="saved-qa-header">
                  <span className="saved-qa-section">[{qa.section}]</span>
                  <span className="saved-qa-timestamp">{qa.timestamp}</span>
                  <div className="saved-qa-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => editQA(index)}
                    >
                      编辑
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => {
                        if (confirm('确定要删除这条问答记录吗？')) {
                          deleteQA(index)
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="saved-qa-question">
                  <strong>问：</strong>{qa.question}
                </div>
                <div className="saved-qa-answer">
                  <strong>答：</strong>{qa.answer}
                </div>
                
                {/* 追问历史 */}
                {qa.followUps && qa.followUps.length > 0 && (
                  <div className="follow-up-history">
                    <div className="follow-up-title">📝 追问记录：</div>
                    {qa.followUps.map((followUp, fIndex) => (
                      <div key={fIndex} className="follow-up-item">
                        <div className="follow-up-question">
                          <strong>追问：</strong>{followUp.question}
                        </div>
                        <div className="follow-up-answer">
                          <strong>回答：</strong>{followUp.answer}
                        </div>
                        <div className="follow-up-timestamp">{followUp.timestamp}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 继续提问按钮 */}
                <div className="qa-follow-up-action">
                  <button 
                    className="follow-up-btn"
                    onClick={() => followUpQuestion(index)}
                  >
                    💬 基于此回答继续提问
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 提问对话框 */}
      {activeQuestion && (
        <div className="question-dialog-overlay">
          <div className="question-dialog">
            <div className="question-dialog-header">
              <h3>关于「{activeQuestion}」的提问</h3>
              <button className="close-btn" onClick={closeQuestionDialog}>×</button>
            </div>
            <div className="question-dialog-body">
              <textarea
                className="question-input"
                placeholder="请输入您的问题..."
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                disabled={isLoading}
              />
              <button
                className="ask-btn"
                onClick={() => handleAskQuestion(activeQuestion, data[activeQuestion.toLowerCase()])}
                disabled={isLoading || !questionInput.trim()}
              >
                {isLoading ? '正在思考...' : '提问'}
              </button>
              
              {questionAnswer && (
                <div className="question-answer">
                  <h4>回答</h4>
                  <div className="answer-content">{questionAnswer}</div>
                  <button
                    className="save-answer-btn"
                    onClick={followUpIndex !== null ? saveFollowUp : saveAnswer}
                  >
                    💾 {followUpIndex !== null ? '保存追问' : editingIndex !== null ? '更新回答' : '保存回答'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 成功提示 */}
      {showSavedToast && (
        <div className="toast-notification">
          <span className="toast-icon">✓</span>
          回答已保留
        </div>
      )}
    </div>
  )
}

function Section({ title, children, onAskQuestion }) {
  return (
    <div className="result-section">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        {onAskQuestion && (
          <button className="ask-question-btn" onClick={onAskQuestion}>
            💬 提问
          </button>
        )}
      </div>
      <div className="section-content">{children}</div>
    </div>
  )
}

function getFeasibilityClass(overall) {
  if (overall.includes('可行')) return 'feasible'
  if (overall.includes('不可行')) return 'infeasible'
  return 'evaluate'
}

function getRiskClass(impact) {
  if (impact === '高') return 'high'
  if (impact === '中') return 'medium'
  return 'low'
}

function getLevelClass(level) {
  if (level.includes('高级') || level.includes('Senior')) return 'senior'
  if (level.includes('中级') || level.includes('Middle')) return 'middle'
  return 'junior'
}

export default AnalysisResult