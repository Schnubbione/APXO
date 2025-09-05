import React from 'react'
import ReactDOM from 'react-dom/client'
import { GameProvider } from './contexts/GameContext'
import { MultiUserApp } from './components/MultiUserApp'
import { ToastProvider } from './components/ui/toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <GameProvider>
        <MultiUserApp />
      </GameProvider>
    </ToastProvider>
  </React.StrictMode>,
)
