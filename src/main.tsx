import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-serif/600-italic.css'
import { App } from './App'
import './styles/app.css'

// ?theme=dark|light lets an embedding page pin the look; otherwise the system decides.
const theme = new URLSearchParams(location.search).get('theme')
if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
