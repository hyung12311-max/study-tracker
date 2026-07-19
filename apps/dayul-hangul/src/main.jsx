import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { restoreDayulAuth } from './integration/authBridge.js'

function AccessDenied() {
  return <main className="access-denied"><div><span>🔒</span><h1>다율이 로그인이 필요해요</h1><p>학습 스티커 앱에서 다율이로 로그인한 뒤 다시 들어와 주세요.</p><a href="/?tab=today">학습 스티커로 돌아가기</a></div></main>
}

const root = createRoot(document.getElementById('root'))
root.render(<main className="access-denied"><div><span>🐰</span><h1>로그인 정보를 확인하고 있어요</h1></div></main>)
restoreDayulAuth().then(async (auth) => {
  if (auth) {
    const { default: App } = await import('./App.jsx')
    root.render(<StrictMode><App /></StrictMode>)
    return
  }
  root.render(<StrictMode><AccessDenied /></StrictMode>)
  window.setTimeout(() => window.location.replace('/?tab=today'), 1800)
})
