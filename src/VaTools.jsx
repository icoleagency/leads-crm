import { useState } from 'react'
import { inLastDays, OUTCOME } from './activity'
import { money } from './leadModel'
import { dayStats, localDate, agoText, saveReport, sendNote, deleteNote, setPinned, markRead, notesFor, isRead, liveStatus, vaToolsErr } from './vaTools'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 11px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit',minWidth:0}
const btn = (p,dis) => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:dis?'default':'pointer',opacity:dis?0.5:1,whiteSpace:'nowrap'})
const errText = e => { const m = vaToolsErr(e.message); return m==='setup' ? 'Reports and coaching notes need a one-time database update — run supabase/add-va-tools.sql in Supabase.' : m }
const fmtT = iso => new Date(iso).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})

export function SetupNotice(){
  return <div style={{...card,marginTop:14,borderColor:C.amber+'66'}}>
    <div style={{color:C.amber,fontWeight:700,fontSize:13.5,marginBottom:6}}>One-time setup for reports & coaching notes</div>
    <div style={{color:C.cream,fontSize:13,lineHeight:1.55}}>In Supabase open <b>SQL Editor → + New query</b>, paste the SQL from <b>supabase/add-va-tools.sql</b>, and hit <b>Run</b>. Then refresh this page.</div>
  </div>
}

// ---------- VA: coaching notes inbox ----------
export function CoachingInbox({me, notes, reload}){
  const [showOld,setShowOld] = useState(false)
  const [busy,setBusy] = useState(null)
  const mine = notesFor(notes, me.id)
  const pinned = mine.filter(n=>n.pinned)
  const unread = mine.filter(n=>!n.pinned && !isRead(n, me.id))
  const old = mine.filter(n=>!n.pinned && isRead(n, me.id))
  if(!mine.length) return null
  async function gotIt(n){ setBusy(n.id); try{ await markRead(n, me.id); await reload() }catch{ /* retry next time */ } setBusy(null) }
  const Note = ({n}) => {
    const read = isRead(n, me.id)
    return <div style={{background:n.pinned?C.orange+'12':read?C.ink:C.blue+'12',border:'1px solid '+(n.pinned?C.orange+'55':read?C.line:C.blue+'55'),borderRadius:10,padding:'10px 12px',marginTop:8,display:'flex',gap:10,alignItems:'flex-start',justifyContent:'space-between'}}>
      <div style={{minWidth:0}}>
        <div style={{fontSize:11,fontWeight:700,color:n.pinned?C.orange:read?C.muted:C.blue}}>{n.pinned?'Pinned · ':''}{n.member_id?'From your manager':'To the whole team'} · {new Date(n.created_at).toLocaleDateString([], {month:'short',day:'numeric'})}</div>
        <div style={{color:C.cream,fontSize:13.5,lineHeight:1.5,marginTop:3,whiteSpace:'pre-wrap'}}>{n.body}</div>
      </div>
      {!read && <button disabled={busy===n.id} onClick={()=>gotIt(n)} style={{...btn(true,busy===n.id),padding:'6px 11px'}}>Got it</button>}
    </div>
  }
  return (
    <div style={{...card,marginTop:14,borderColor:(unread.length?C.blue:C.orange)+'66'}}>
      <div style={{fontWeight:700,fontSize:14}}>Coaching notes {unread.length>0 && <span style={{color:C.blue,fontSize:12}}>· {unread.length} new</span>}</div>
      {[...pinned, ...unread].map(n=><Note key={n.id} n={n}/>)}
      {!pinned.length && !unread.length && <div style={{color:C.muted,fontSize:12.5,marginTop:6}}>You're all caught up.</div>}
      {old.length>0 && <div style={{marginTop:8}}>
        <span onClick={()=>setShowOld(!showOld)} style={{color:C.muted,fontSize:12,cursor:'pointer'}}>{showOld?'Hide':'Show'} past notes ({old.length})</span>
        {showOld && old.map(n=><Note key={n.id} n={n}/>)}
      </div>}
    </div>
  )
}

// ---------- VA: end-of-day report ----------
export function EodReport({me, activity, leads, reports, reload, isMobile}){
  const today = localDate()
  const existing = reports.find(r=>String(r.member_id)===String(me.id) && r.report_date===today)
  const [open,setOpen] = useState(false)
  const [f,setF] = useState({ wins:existing?.wins||'', blockers:existing?.blockers||'', tomorrow:existing?.tomorrow||'' })
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState(null)
  const s = dayStats(me, activity, leads)
  const stats = { dials:s.dials, contacts:s.contacts, appointments:s.appointments, offers:s.offers, contracts:s.contracts, handoffs:s.handoffs, first:s.first, last:s.last, hours:s.hours, per_hour:s.per_hour }
  async function submit(){
    setBusy(true); setMsg(null)
    try{
      await saveReport({ member_id:String(me.id), member_name:me.name, report_date:today, stats, wins:f.wins.trim()||null, blockers:f.blockers.trim()||null, tomorrow:f.tomorrow.trim()||null })
      await reload(); setOpen(false); setMsg({ok:true,t:existing?'Report updated.':'Report sent — nice work today.'})
    }catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy(false)
  }
  const nums = [['Dials',s.dials],['Contacts',s.contacts],['Appts',s.appointments],['Offers',s.offers],['Hand-offs',s.handoffs],['Dials / hr',s.per_hour??'—']]
  return (
    <div style={{...card,marginTop:14,borderColor:existing?C.green+'55':C.line}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>End-of-day report</div>
          <div style={{color:existing?C.green:C.muted,fontSize:12,marginTop:2}}>{existing ? 'Sent at '+fmtT(existing.updated_at)+' — you can update it until midnight' : s.first ? 'Calling since '+fmtT(s.first)+' · send this when you wrap up' : 'Your numbers fill in automatically as you log calls'}</div>
        </div>
        {!open && <button onClick={()=>{ setF({ wins:existing?.wins||'', blockers:existing?.blockers||'', tomorrow:existing?.tomorrow||'' }); setOpen(true) }} style={btn(!existing)}>{existing?'Edit report':'Write today\'s report'}</button>}
      </div>
      {(open || existing) &&
      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(3,1fr)':'repeat(6,1fr)',gap:6,marginTop:12}}>
        {nums.map(([l,v])=><div key={l} style={{background:C.ink,borderRadius:8,padding:'8px 10px'}}><div style={{color:C.muted,fontSize:10.5}}>{l}</div><div style={{fontWeight:700,fontSize:16,marginTop:2}}>{v}</div></div>)}
      </div>}
      {open &&
      <div style={{marginTop:12,display:'grid',gap:8}}>
        <label style={{color:C.muted,fontSize:11.5}}>Wins — best conversations, appointments, motivated sellers
          <textarea rows={2} value={f.wins} onChange={e=>setF({...f,wins:e.target.value})} placeholder="e.g. Mrs. Lee on Pine Ct wants out in 30 days — handed off" style={{...inp,marginTop:4,resize:'vertical'}}/></label>
        <label style={{color:C.muted,fontSize:11.5}}>Problems — bad numbers, list issues, anything slowing you down
          <textarea rows={2} value={f.blockers} onChange={e=>setF({...f,blockers:e.target.value})} placeholder="e.g. Lots of disconnected numbers on the tax list" style={{...inp,marginTop:4,resize:'vertical'}}/></label>
        <label style={{color:C.muted,fontSize:11.5}}>Plan for tomorrow
          <textarea rows={2} value={f.tomorrow} onChange={e=>setF({...f,tomorrow:e.target.value})} placeholder="e.g. 4 callbacks in the morning, then finish Willingboro" style={{...inp,marginTop:4,resize:'vertical'}}/></label>
        <div style={{display:'flex',gap:8}}>
          <button disabled={busy} onClick={submit} style={btn(true,busy)}>{busy?'Sending…':existing?'Update report':'Send report'}</button>
          <button onClick={()=>setOpen(false)} style={btn(false)}>Cancel</button>
        </div>
      </div>}
      {!open && existing && (existing.wins||existing.blockers||existing.tomorrow) &&
      <div style={{marginTop:10,fontSize:12.5,lineHeight:1.5,color:C.cream}}>
        {existing.wins && <div><span style={{color:C.green,fontWeight:700}}>Wins:</span> {existing.wins}</div>}
        {existing.blockers && <div><span style={{color:C.amber,fontWeight:700}}>Problems:</span> {existing.blockers}</div>}
        {existing.tomorrow && <div><span style={{color:C.blue,fontWeight:700}}>Tomorrow:</span> {existing.tomorrow}</div>}
      </div>}
      {msg && <div style={{marginTop:10,fontSize:12.5,color:msg.ok?C.green:C.red}}>{msg.t}</div>}
    </div>
  )
}

// ---------- owner: live team ----------
export function LiveTeam({team, activity, leads, reports, isMobile}){
  const today = localDate()
  const active = team.filter(m=>m.active!==false)
  const rowsToday = inLastDays(activity,1)
  const people = active.map(m=>{
    const s = dayStats(m, activity, leads)
    const rep = reports.find(r=>String(r.member_id)===String(m.id) && r.report_date===today)
    return { m, s, st:liveStatus(s.rows, !!rep), rep }
  })
  const idle = people.filter(p=>p.st.key==='idle')
  const feed = rowsToday.slice(0,30)
  const nameOk = name => active.some(m=>m.name===name)
  return (
    <div style={{...card,marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:14}}>Live team <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— updates every minute</span></div>
        {idle.length>0 && <span style={{color:C.red,fontSize:12.5,fontWeight:700}}>{idle.map(p=>p.m.name).join(', ')} {idle.length===1?'has':'have'} gone quiet 30+ min</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(220px,1fr))',gap:8,marginTop:12}}>
        {people.map(({m,s,st,rep})=>(
          <div key={m.id} style={{background:C.ink,border:'1px solid '+(st.key==='idle'?C.red+'77':C.line),borderRadius:10,padding:'10px 12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
              <b style={{fontSize:13.5}}>{m.name}</b>
              <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:700,color:st.c,whiteSpace:'nowrap'}}><span style={{width:8,height:8,borderRadius:'50%',background:st.c}}/>{st.label}</span>
            </div>
            <div style={{color:C.cream,fontSize:12.5,marginTop:5}}>{s.dials} / {m.dial_goal} dials · {s.contacts} contacts · {s.appointments} appts</div>
            <div style={{color:C.muted,fontSize:11.5,marginTop:2}}>{s.first ? fmtT(s.first)+' – '+fmtT(s.last)+(s.per_hour?' · '+s.per_hour+' dials/hr':'')+' · last call '+agoText(s.last) : 'No calls logged today'}{rep?' · EOD sent':''}</div>
          </div>
        ))}
      </div>
      <div style={{color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:1,margin:'16px 0 4px'}}>Today's calls as they're logged</div>
      {feed.length===0 ? <div style={{color:C.muted,fontSize:12.5}}>Nothing logged yet today.</div> :
      <div style={{maxHeight:300,overflowY:'auto'}}>
        {feed.map(a=>{ const o = OUTCOME[a.outcome]; const good = o && o.contact && a.outcome!=='dead'
          return <div key={a.id} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:12.5,padding:'6px 0',borderBottom:'1px solid '+C.line}}>
            <span style={{minWidth:0}}><b style={{color:nameOk(a.caller)?C.cream:C.muted}}>{a.caller}</b> <span style={{color:good?C.green:C.muted}}>· {o?o.short:a.outcome}{a.amount?' '+money(a.amount):''}</span> <span style={{color:C.cream}}>· {a.lead_name||'Lead'}</span>{a.note?<span style={{color:C.muted}}> — {a.note}</span>:null}</span>
            <span style={{color:C.muted,whiteSpace:'nowrap'}}>{agoText(a.created_at)}</span>
          </div> })}
      </div>}
    </div>
  )
}

// ---------- owner: EOD reports ----------
export function EodReview({team, reports, isMobile}){
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return localDate(d) })
  const [day,setDay] = useState(days[0])
  const active = team.filter(m=>m.active!==false)
  const label = d => d===days[0]?'Today':d===days[1]?'Yesterday':new Date(d+'T12:00').toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})
  const sent = active.filter(m=>reports.some(r=>String(r.member_id)===String(m.id) && r.report_date===day)).length
  return (
    <div style={{...card,marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:14}}>End-of-day reports <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {sent} of {active.length} sent</span></div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {days.map(d=><button key={d} onClick={()=>setDay(d)} style={{background:day===d?C.orange:'transparent',color:day===d?C.ink:C.muted,border:'1px solid '+(day===d?C.orange:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{label(d)}</button>)}
        </div>
      </div>
      {active.map(m=>{ const r = reports.find(x=>String(x.member_id)===String(m.id) && x.report_date===day); const s = (r&&r.stats)||{}
        return (
          <div key={m.id} style={{borderTop:'1px solid '+C.line,marginTop:10,paddingTop:10}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
              <b style={{fontSize:13.5}}>{m.name}</b>
              {r ? <span style={{color:C.green,fontSize:12}}>Sent {fmtT(r.updated_at)}</span> : <span style={{color:day===days[0]?C.muted:C.amber,fontSize:12}}>{day===days[0]?'Not sent yet':'No report'}</span>}
            </div>
            {r && <>
              <div style={{color:C.cream,fontSize:12.5,marginTop:4}}>{s.dials??0} dials · {s.contacts??0} contacts · {s.appointments??0} appts · {s.offers??0} offers · {s.handoffs??0} hand-offs{s.per_hour?' · '+s.per_hour+' dials/hr':''}{s.first?<span style={{color:C.muted}}> · {fmtT(s.first)}–{fmtT(s.last)}</span>:null}</div>
              <div style={{fontSize:12.5,lineHeight:1.5,marginTop:4,display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:8}}>
                <div><span style={{color:C.green,fontWeight:700}}>Wins</span><div style={{color:r.wins?C.cream:C.muted}}>{r.wins||'—'}</div></div>
                <div><span style={{color:C.amber,fontWeight:700}}>Problems</span><div style={{color:r.blockers?C.cream:C.muted}}>{r.blockers||'—'}</div></div>
                <div><span style={{color:C.blue,fontWeight:700}}>Tomorrow</span><div style={{color:r.tomorrow?C.cream:C.muted}}>{r.tomorrow||'—'}</div></div>
              </div>
            </>}
          </div>
        ) })}
    </div>
  )
}

// ---------- owner: coaching notes ----------
export function CoachPanel({team, notes, reload}){
  const active = team.filter(m=>m.active!==false)
  const [to,setTo] = useState('')
  const [body,setBody] = useState('')
  const [pin,setPin] = useState(false)
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState(null)
  const [showAll,setShowAll] = useState(false)
  async function act(fn, ok){
    setBusy(true); setMsg(null)
    try{ await fn(); await reload(); if(ok) setMsg({ok:true,t:ok}) }catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy(false)
  }
  const nameOf = id => (active.find(m=>String(m.id)===String(id))||team.find(m=>String(m.id)===String(id))||{}).name
  const seenText = n => {
    const targets = n.member_id ? [String(n.member_id)] : active.map(m=>String(m.id))
    const seen = targets.filter(id=>(n.read_by||[]).includes(id))
    if(n.member_id) return seen.length ? 'Seen' : 'Not seen yet'
    return seen.length===targets.length ? 'Seen by everyone' : seen.length ? 'Seen by '+seen.map(nameOf).filter(Boolean).join(', ') : 'Not seen yet'
  }
  const list = showAll ? notes : notes.slice(0,6)
  return (
    <div style={{...card,marginTop:16}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Coaching notes <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— shows at the top of the VA's workspace</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <select value={to} onChange={e=>setTo(e.target.value)} style={{...inp,width:'auto'}}>
          <option value="">To: all VAs</option>
          {active.map(m=><option key={m.id} value={String(m.id)}>To: {m.name}</option>)}
        </select>
        <label style={{display:'flex',gap:6,alignItems:'center',color:C.muted,fontSize:12,cursor:'pointer'}}><input type="checkbox" checked={pin} onChange={e=>setPin(e.target.checked)}/>Pin it (stays at the top)</label>
      </div>
      <textarea rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="e.g. Great energy today. On price objections, use the repair math before you give a number." style={{...inp,marginTop:8,resize:'vertical'}}/>
      <button disabled={busy||!body.trim()} onClick={()=>act(async()=>{ await sendNote({member_id:to, body, pinned:pin}); setBody(''); setPin(false) },'Sent.')} style={{...btn(true,busy||!body.trim()),marginTop:8}}>Send note</button>
      {msg && <span style={{marginLeft:10,fontSize:12.5,color:msg.ok?C.green:C.red}}>{msg.t}</span>}
      {notes.length>0 && <div style={{marginTop:14}}>
        {list.map(n=>(
          <div key={n.id} style={{borderTop:'1px solid '+C.line,padding:'8px 0',display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11,color:C.muted}}>{n.member_id?'To '+(nameOf(n.member_id)||'VA'):'To all VAs'} · {new Date(n.created_at).toLocaleDateString([], {month:'short',day:'numeric'})} · <span style={{color:/^Seen/.test(seenText(n))?C.green:C.amber}}>{seenText(n)}</span>{n.pinned?<span style={{color:C.orange}}> · Pinned</span>:null}</div>
              <div style={{fontSize:13,color:C.cream,marginTop:2,whiteSpace:'pre-wrap'}}>{n.body}</div>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <button disabled={busy} onClick={()=>act(()=>setPinned(n.id,!n.pinned))} style={{...btn(false,busy),padding:'4px 9px'}}>{n.pinned?'Unpin':'Pin'}</button>
              <button disabled={busy} onClick={()=>{ if(confirm('Delete this note?')) act(()=>deleteNote(n.id)) }} style={{...btn(false,busy),padding:'4px 9px'}}>Delete</button>
            </div>
          </div>
        ))}
        {notes.length>6 && <span onClick={()=>setShowAll(!showAll)} style={{color:C.muted,fontSize:12,cursor:'pointer'}}>{showAll?'Show fewer':'Show all '+notes.length}</span>}
      </div>}
    </div>
  )
}
