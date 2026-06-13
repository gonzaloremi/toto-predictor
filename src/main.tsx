import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { hydrateFromSupabase } from './api/storage'

// Hydrate localStorage from Supabase on startup (new device / cleared storage)
hydrateFromSupabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
