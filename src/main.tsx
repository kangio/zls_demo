import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './agent-demo.css'
import './agent-layout-v2.css'
import './agent-animation-v3.css'
import './agent-animation-v4.css'
import './agent-drawer-alignment.css'
import './concept-demo.css'
import './concept-demo-v2.css'
import './concept-demo-v3.css'
import './concept-demo-v4.css'
import './concept-demo-v5.css'
import './concept-demo-v6.css'
import './concept-demo-v7.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
