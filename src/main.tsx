import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './agent-demo.css'
import './agent-layout-v2.css'
import './agent-animation-v3.css'
import './agent-animation-v4.css'
import './agent-drawer-alignment.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
