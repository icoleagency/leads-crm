import { useState, useEffect, useCallback } from 'react'
import { listAccess, teamAccess, tempPassword } from './auth'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', muted:'#88a0b4', green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0,marginTop:16}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',minWidth:0,fontFamily:'inherit'}
const btn = (p,dis) => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:dis?'default':'pointer',opacity:dis?0.5:1,whiteSpace:'nowrap'})

// Owner-only: who can sign in to WholesaleOS.
export function AccessPanel({team,isMobile}){
  const [rows,setRows] = useState(null)
  const [setup,setSetup] = useState(false)
  const [f,setF] = useState({ email:'', role:'va', member_id:'', password:tempPassword() })
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState(null)
  const [share,setShare] = useState(null)       // {email,password,name} to hand to the VA
  const load = useCallback(async ()=>{
    try{ setRows(await listAccess()); setSetup(false) }
    catch(e){ if(/crm_access|schema cache|does not exist/i.test(e.message)) setSetup(true); else setMsg({ok:false,t:e.message}) }
  },[])
  useEffect(()=>{ load() },[load])

  const nameOf = id => (team.find(m=>String(m.id)===String(id))||{}).name
  const linked = new Set((rows||[]).map(r=>String(r.member_id)).filter(Boolean))
  async function run(fn, ok){
    setBusy(true); setMsg(null)
    try{ const r = await fn(); await load(); if(ok) setMsg({ok:true,t:typeof ok==='function'?ok(r):ok}) }catch(e){ setMsg({ok:false,t:e.message}) }
    setBusy(false)
  }
  async function create(){
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setMsg({ok:false,t:'Enter a valid email.'})
    if(f.role==='va' && !f.member_id) return setMsg({ok:false,t:'Pick which VA this login is for.'})
    if(f.password.length<8) return setMsg({ok:false,t:'Password needs at least 8 characters.'})
    await run(async()=>{
      const r = await teamAccess('create', { email:f.email.trim(), password:f.password, role:f.role, member_id:f.role==='va'?Number(f.member_id):null })
      setShare({ email:f.email.trim(), password:f.password, name:f.role==='va'?nameOf(f.member_id):'Owner', existed:r.existed })
      setF({ email:'', role:'va', member_id:'', password:tempPassword() })
      return r
    }, r=>r.existed?'That email already had a login — it now has access with the password below.':'Login created.')
  }
  async function reset(r){
    const pw = tempPassword()
    if(!confirm('Give '+r.email+' a new temporary password? Their old one stops working.')) return
    await run(async()=>{ await teamAccess('reset', { user_id:r.user_id, password:pw }); setShare({ email:r.email, password:pw, name:r.role==='va'?nameOf(r.member_id):'Owner', reset:true }) }, 'New password set.')
  }
  async function remove(r){
    if(!confirm('Remove '+r.email+'? They are signed out and can no longer open WholesaleOS. Their call history stays.')) return
    await run(()=>teamAccess('remove', { user_id:r.user_id }), 'Access removed.')
  }
  async function relink(r, member_id){ await run(()=>teamAccess('link', { user_id:r.user_id, member_id:member_id?Number(member_id):null }), 'Updated.') }
  const shareText = share ? 'WholesaleOS login'+(share.name?' for '+share.name:'')+'\n'+window.location.origin+'\nEmail: '+share.email+'\nPassword: '+share.password+'\n(You can change it any time with "Forgot your password?")' : ''

  if(setup) return (
    <div style={{...card,borderColor:C.amber+'66'}}>
      <div style={{fontWeight:700,fontSize:14,color:C.amber}}>Logins — finish the security setup first</div>
      <div style={{color:C.muted,fontSize:13,lineHeight:1.55,marginTop:6}}>Run the lock-down SQL (supabase/lock-down.sql) in Supabase. After that you can give each VA their own login here.</div>
    </div>
  )
  return (
    <div style={card}>
      <div style={{fontWeight:700,fontSize:14}}>Logins</div>
      <div style={{color:C.muted,fontSize:12.5,marginTop:3,lineHeight:1.5}}>Only people listed here can open WholesaleOS. VA logins only see the VA Workspace and Academy, and their calls are logged under their name automatically.</div>
      {rows===null ? <div style={{color:C.muted,fontSize:13,marginTop:10}}>Loading…</div> :
      <div style={{marginTop:10}}>
        {rows.map(r=>(
          <div key={r.user_id} style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',padding:'9px 0',borderTop:'1px solid '+C.line}}>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontWeight:600,fontSize:13}}>{r.email}</div>
              <div style={{fontSize:11.5,color:r.role==='owner'?C.orange:C.muted}}>{r.role==='owner'?'Owner — full access':'VA'+(r.member_id&&nameOf(r.member_id)?' · '+nameOf(r.member_id):' · not linked to a VA')}</div>
            </div>
            {r.role==='va' && <select value={r.member_id||''} disabled={busy} onChange={e=>relink(r,e.target.value)} style={{...inp,width:160,padding:'5px 8px',fontSize:12}}>
              <option value="">— link to VA —</option>
              {team.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>}
            <button disabled={busy} onClick={()=>reset(r)} style={{...btn(false,busy),padding:'5px 9px'}}>New password</button>
            {rows.filter(x=>x.role==='owner').length>1 || r.role!=='owner' ? <button disabled={busy} onClick={()=>remove(r)} style={{...btn(false,busy),padding:'5px 9px',color:C.red,borderColor:C.red+'55'}}>Remove</button> : null}
          </div>
        ))}
      </div>}
      <div style={{background:C.ink,borderRadius:10,padding:12,marginTop:12}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Give someone a login</div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.4fr .8fr 1fr 1fr',gap:8}}>
          <input value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="Their email" style={inp}/>
          <select value={f.role} onChange={e=>setF({...f,role:e.target.value})} style={inp}><option value="va">VA</option><option value="owner">Owner / partner</option></select>
          {f.role==='va' ? <select value={f.member_id} onChange={e=>setF({...f,member_id:e.target.value})} style={inp}>
            <option value="">Which VA?</option>
            {team.map(m=><option key={m.id} value={m.id}>{m.name}{linked.has(String(m.id))?' (has a login)':''}</option>)}
          </select> : <div style={{color:C.amber,fontSize:11.5,alignSelf:'center'}}>Owners see and can change everything.</div>}
          <input value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder="Temporary password" style={inp}/>
        </div>
        <button disabled={busy} onClick={create} style={{...btn(true,busy),marginTop:10}}>{busy?'Working…':'Create login'}</button>
        {team.length===0 && f.role==='va' && <div style={{color:C.muted,fontSize:11.5,marginTop:6}}>Add the VA to your team below first, then give them a login.</div>}
      </div>
      {msg && <div style={{marginTop:10,fontSize:12.5,color:msg.ok?C.green:C.red,lineHeight:1.5}}>{msg.t}</div>}
      {share && <div style={{marginTop:10,background:C.green+'12',border:'1px solid '+C.green+'55',borderRadius:10,padding:12}}>
        <div style={{fontSize:12.5,color:C.cream,fontWeight:700}}>Send this to {share.name||share.email} (only shown once):</div>
        <pre style={{whiteSpace:'pre-wrap',fontSize:12.5,color:C.cream,margin:'8px 0',fontFamily:'inherit'}}>{shareText}</pre>
        <div style={{display:'flex',gap:8}}>
          <button onClick={async()=>{ try{ await navigator.clipboard.writeText(shareText); setMsg({ok:true,t:'Copied — paste it into a text or email to them.'}) }catch{ setMsg({ok:false,t:'Copy blocked — select the text and copy it.'}) } }} style={btn(true)}>Copy</button>
          <button onClick={()=>setShare(null)} style={btn(false)}>Done</button>
        </div>
      </div>}
    </div>
  )
}
