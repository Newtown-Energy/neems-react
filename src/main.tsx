import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function getInitialTheme() {
  // 1. Check browser or system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  // 2. Fallback to light
  return 'light';
}

// Set CSS variable or data attribute before app renders
const theme = getInitialTheme();
document.documentElement.setAttribute('data-theme', theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
