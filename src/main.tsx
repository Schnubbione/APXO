import React from 'react'
import ReactDOM from 'react-dom/client'
import { GameProvider } from './contexts/GameContext'
import { MultiUserApp } from './components/MultiUserApp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameProvider>
      <MultiUserApp />
    </GameProvider>
  </React.StrictMode>,
)
