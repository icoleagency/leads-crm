import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './Login.jsx'
import BuyerSignup from './BuyerSignup.jsx'

// /join is the public buyer sign-up page; everything else is the CRM, behind a login.
const isJoin = /^\/join\/?$/.test(window.location.pathname)
if(isJoin) document.title = 'Join our cash buyers list'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isJoin ? <BuyerSignup /> : <AuthGate />}
  </StrictMode>,
)
