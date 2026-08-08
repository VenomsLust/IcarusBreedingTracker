import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppDataProvider } from './context/AppDataContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </React.StrictMode>
)
