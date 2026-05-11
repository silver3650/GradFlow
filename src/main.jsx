import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ==========================================
// 🚀 PWA: 서비스 워커 등록 코드 추가
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ ServiceWorker 등록 성공 (Scope:', registration.scope, ')');
      })
      .catch((error) => {
        console.error('🚨 ServiceWorker 등록 실패:', error);
      });
  });
}