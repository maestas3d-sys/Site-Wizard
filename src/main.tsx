import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// HashRouter (not BrowserRouter): this is a static, backend-free PWA that
// installs to the home screen. Hash-based routes need no server rewrite
// rules to survive a refresh or a cold launch from the home screen icon.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
