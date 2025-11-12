import React from 'react'
import ReactDOM from 'react-dom/client'
import { GameProvider } from './contexts/GameContext'
import { MultiUserApp } from './components/MultiUserApp'
import { TimeframesEditor } from './components/TimeframesEditor'
import { SimpleRouter } from './components/SimpleRouter'
import { ToastProvider } from './components/ui/toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <GameProvider>
        <SimpleRouter
          routes={[
            { path: '/designtest/timeframes', component: TimeframesEditor }
          ]}
          fallback={MultiUserApp}
        />
      </GameProvider>
    </ToastProvider>
  </React.StrictMode>,
)
