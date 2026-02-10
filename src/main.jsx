import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles/tailwind.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <>
    <App />
  </>  
)
