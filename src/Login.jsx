import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { fetchAccess, signIn, signOut, sendReset, setPassword, authErr } from './auth'
import App from './App.jsx'

const C = { ink:'#081019', navy:'#0b1826', panel:'#102434', line:'#1d3a4a', cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', red:'#e5573f', amber:'#f5b942' }
const page = { minHeight:'100vh', background:C.navy, color:C.cream, fontFamily:'Helvetica Neue,Arial,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', padding:16, boxSizing:'border-box' }
const box = { width:'100%', maxWidth:380, background:C.panel, border:'1px solid '+C.line, borderRadius:18, padding:'28px 24px' }
const inp = { display:'block', width:'100%', boxSizing:'border-box', background:C.ink, border:'1px solid '+C.line, borderRadius:10, padding:'11px 12px', color:C.cream, fontSize:15, outline:'none', marginTop:5, fontFamily:'inherit' }
const lab = { display:'block', color:C.muted, fontSize:12.5, marginTop:12 }
const btn = { width:'100%', marginTop:18, background:C.orange, color:C.ink, border:'none', borderRadius:10, padding:'12px', fontSize:15, fontWeight:800, cursor:'pointer' }
const link = { background:'none', border:'none', color:C.muted, fontSize:12.5, cursor:'pointer', marginTop:14, padding:0, textDecoration:'underline' }
const Logo = () => (
  <div style={{textAlign:'center',marginBottom:18}}>
    <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:800}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
    <div style={{color:C.muted,fontSize:9.5,letterSpacing:2,textTransform:'uppercase',marginTop:4}}>by Icole Agency</div>
  </div>
)

// Wraps the whole CRM: nothing loads until someone with access signs in.
export default function AuthGate(){
  const [session,setSession] = useState(undefined)   // undefined = still checking
  const [access,setAccess] = useState(null)
  const [recovery,setRecovery] = useState(false)
  const [err,setErr] = useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({ data })=>setSession(data.session||null))
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event, s)=>{
      if(event==='PASSWORD_RECOVERY') setRecovery(true)
      setSession(s||null)
    })
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{
    if(!session){ setAccess(null); return }
    let live = true
    setAccess(null); setErr('')
    fetchAccess(session.user).then(a=>{ if(live) setAccess(a) }).catch(e=>{ if(live) setErr(authErr(e)) })
    return ()=>{ live = false }
  },[session && session.user && session.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if(session===undefined) return <div style={page}><div style={{color:C.muted}}>Loading…</div></div>
  if(recovery && session) return <NewPassword onDone={()=>setRecovery(false)}/>
  if(!session) return <SignIn/>
  if(err) return (
    <div style={page}><div style={box}><Logo/>
      <div style={{color:C.red,fontSize:14,lineHeight:1.5}}>{err}</div>
      <button onClick={()=>window.location.reload()} style={btn}>Try again</button>
      <button onClick={signOut} style={link}>Sign out</button>
    </div></div>
  )
  if(!access) return <div style={page}><div style={{color:C.muted}}>Checking your access…</div></div>
  if(access.state==='none') return (
    <div style={page}><div style={box}><Logo/>
      <div style={{fontSize:16,fontWeight:700}}>No access yet</div>
      <div style={{color:C.muted,fontSize:13.5,lineHeight:1.55,marginTop:8}}>You're signed in as <b style={{color:C.cream}}>{session.user.email}</b>, but this login hasn't been given access to WholesaleOS. Ask the owner to add you under VA Workspace → Manage team → Logins.</div>
      <button onClick={signOut} style={btn}>Sign out</button>
    </div></div>
  )
  return <App access={{ ...access, email:session.user.email }} onSignOut={signOut}/>
}

function SignIn(){
  const [mode,setMode] = useState('in')              // 'in' | 'reset'
  const [email,setEmail] = useState('')
  const [pw,setPw] = useState('')
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState(null)
  async function submit(e){
    e.preventDefault(); setMsg(null)
    if(!email.trim()) return setMsg({ok:false,t:'Enter your email.'})
    setBusy(true)
    try{
      if(mode==='in'){ const { error } = await signIn(email, pw); if(error) throw error }
      else { const { error } = await sendReset(email); if(error) throw error; setMsg({ok:true,t:'If that email has a login, a reset link is on its way. Open it on this device.'}) }
    }catch(er){ setMsg({ok:false,t:authErr(er)}) }
    setBusy(false)
  }
  return (
    <div style={page}>
      <form onSubmit={submit} style={box}>
        <Logo/>
        <div style={{fontSize:16,fontWeight:700}}>{mode==='in'?'Sign in':'Reset your password'}</div>
        <label style={lab}>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={inp} autoFocus/></label>
        {mode==='in' && <label style={lab}>Password<input type="password" autoComplete="current-password" value={pw} onChange={e=>setPw(e.target.value)} style={inp}/></label>}
        {msg && <div style={{color:msg.ok?C.green:C.red,fontSize:13,marginTop:12,lineHeight:1.45}}>{msg.t}</div>}
        <button type="submit" disabled={busy} style={{...btn,opacity:busy?0.7:1}}>{busy?'One moment…':mode==='in'?'Sign in':'Send reset link'}</button>
        <div style={{textAlign:'center'}}>
          <button type="button" onClick={()=>{ setMode(mode==='in'?'reset':'in'); setMsg(null) }} style={link}>{mode==='in'?'Forgot your password?':'Back to sign in'}</button>
        </div>
      </form>
    </div>
  )
}

function NewPassword({onDone}){
  const [pw,setPw] = useState(''), [pw2,setPw2] = useState('')
  const [busy,setBusy] = useState(false), [msg,setMsg] = useState(null)
  async function submit(e){
    e.preventDefault(); setMsg(null)
    if(pw.length<8) return setMsg({ok:false,t:'Use at least 8 characters.'})
    if(pw!==pw2) return setMsg({ok:false,t:'The two passwords don\'t match.'})
    setBusy(true)
    const { error } = await setPassword(pw)
    setBusy(false)
    if(error) return setMsg({ok:false,t:authErr(error)})
    onDone()
  }
  return (
    <div style={page}>
      <form onSubmit={submit} style={box}>
        <Logo/>
        <div style={{fontSize:16,fontWeight:700}}>Choose a new password</div>
        <label style={lab}>New password<input type="password" autoComplete="new-password" value={pw} onChange={e=>setPw(e.target.value)} style={inp} autoFocus/></label>
        <label style={lab}>Type it again<input type="password" autoComplete="new-password" value={pw2} onChange={e=>setPw2(e.target.value)} style={inp}/></label>
        {msg && <div style={{color:msg.ok?C.green:C.red,fontSize:13,marginTop:12}}>{msg.t}</div>}
        <button type="submit" disabled={busy} style={{...btn,opacity:busy?0.7:1}}>{busy?'Saving…':'Save password'}</button>
      </form>
    </div>
  )
}
