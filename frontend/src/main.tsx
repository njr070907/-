import React from 'react'
import ReactDOM from 'react-dom/client'
import PersonalizedApp from './PersonalizedApp'
import './style.css'
import './personalization.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><PersonalizedApp /></React.StrictMode>,
)
