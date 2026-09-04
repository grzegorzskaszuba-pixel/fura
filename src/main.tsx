import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { initializeDatabase } from '@/data/database/db'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
  await initializeDatabase()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
