// 全局AudioContext实例（避免重复创建）
let audioContext = null

/**
 * 获取或创建AudioContext
 */
function getAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (error) {
      console.warn('无法创建AudioContext:', error)
      return null
    }
  }
  
  // 如果AudioContext被暂停（浏览器自动播放策略），尝试恢复
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('无法恢复AudioContext:', err)
    })
  }
  
  return audioContext
}

/**
 * 播放完成提示音
 * 使用Web Audio API生成铃声（类似"叮"的声音）
 */
export function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) {
    return
  }
  
  try {
    // 创建一个铃声效果
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    // 连接节点
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    const now = ctx.currentTime
    
    // 设置频率（铃声效果：800Hz -> 1000Hz -> 800Hz）
    oscillator.frequency.setValueAtTime(800, now)
    oscillator.frequency.setValueAtTime(1000, now + 0.1)
    oscillator.frequency.setValueAtTime(800, now + 0.2)
    
    // 设置音量包络（淡入淡出，避免突然的声音）
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.2)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3)
    
    // 设置波形类型（正弦波，声音更柔和）
    oscillator.type = 'sine'
    
    // 播放（持续0.3秒）
    oscillator.start(now)
    oscillator.stop(now + 0.3)
    
    // 清理（可选，AudioContext会保持打开状态以便下次使用）
    oscillator.onended = () => {
      // 不关闭AudioContext，以便快速响应下次播放
    }
  } catch (error) {
    console.warn('无法播放提示音:', error)
  }
}

/**
 * 播放简单的"叮"声（备用方案）
 */
export function playSimpleBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
    
    oscillator.onended = () => {
      audioContext.close()
    }
  } catch (error) {
    console.warn('无法播放提示音:', error)
  }
}

