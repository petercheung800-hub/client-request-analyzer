import { useEffect } from 'react'
import './Toast.css'

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-icon">
          {type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </span>
        <div className="toast-message">{message}</div>
      </div>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  )
}

export default Toast
