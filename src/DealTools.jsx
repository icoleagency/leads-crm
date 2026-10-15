import { useState } from 'react'
import { money, stageOf } from './leadModel'
import { getCaller } from './activity'
import { STEP_IDEAS, STEP_DUE, addDays, fmtDay, dueState, daysLate, negoOf, addNego, removeNego, offerPlan, nextStepOf, setNext, completeNext, OFFER_FU } from './deals'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 11px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',colorScheme:'dark',fontFamily:'inherit'}
const chip = on => ({border:'1px solid '+(on?C.orange:C.line),background:on?C.orange:'transparent',color:on?C.ink:C.muted,borderRadius:16,padding:'5px 11px',fontSize:12,fontWeight:600,cursor:'pointer'})
const btn = {background:C.orange,color:C.ink,border:'none',borderRadius:9,padding:'9px 18px',fontWeight:800,fontSize:12.5,cursor:'pointer'}
const ghost = {background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:9,padding:'9px 14px',fontSize:12.5,cursor:'pointer'}
const errText = e => /fetch|network/i.test(e && e.message) ? "Can't reach the database — try again in a minute." : (e && e.message) || 'Something went wrong'
const STATE_COLOR = { overdue:C.red, today:C.amber, later:C.muted }

export function Modal({title,sub,onClose,children,width=520}){
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:60}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22,width:'100%',maxWidth:width,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:14}}>
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>{title}</div>
            {sub && <div style={{color:C.muted,fontSize:12.5,marginTop:2}}>{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{background:'transparent',border:'none',color:C.muted,fontSize:18,cursor:'pointer'}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Text + due date for the one next step on a deal.
export function NextStepEditor({lead,stage,activity,onSaved,onClose,compact}){
  const cur = (lead.details||{}).next
  const [text,setText] = useState(cur?.text||'')
  const [due,setDue] = useState(cur?.due||'')
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState('')
  const [err,setErr] = useState('')
  const ideas = STEP_IDEAS[stage]||[]
  const auto = !cur && nextStepOf(lead, activity, stage)
  const quick = [['Today',0],['Tomorrow',1],['In 3 days',3],['Next week',7]]

  async function run(fn, after){
    setBusy(true); setErr('')
    let ok = true
    try{ await fn(); setMsg(after||''); await onSaved?.() }catch(e){ ok = false; setErr(errText(e)) }
    setBusy(false)
    return ok
  }
  const save = async () => { if(await run(()=>setNext(lead,{text,due,by:getCaller()}), 'Saved.')) onClose?.() }
  const done = () => run(async()=>{ await completeNext(lead,getCaller()); setText(''); setDue('') }, 'Done ✓ — what’s the next step?')
  const clear = () => run(async()=>{ await setNext(lead,null); setText(''); setDue('') }, 'Cleared.')

  return (
    <div>
      {auto && <div style={{background:C.ink,borderRadius:8,padding:'8px 11px',fontSize:12,color:C.muted,marginBottom:10}}>
        Right now: <b style={{color:C.cream}}>{auto.text}</b>{auto.due?' · due '+fmtDay(auto.due):''} <span>(automatic — set your own step to override it)</span>
      </div>}
      <input value={text} onChange={e=>{ setText(e.target.value); setMsg('') }} placeholder="What has to happen next? e.g. Call back after she talks to her brother" style={inp}/>
      {ideas.length>0 && <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
        {ideas.map(t=><button key={t} onClick={()=>{ setText(t); if(!due) setDue(addDays(STEP_DUE[stage]??1)); setMsg('') }} style={chip(text===t)}>{t}</button>)}
      </div>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:compact?8:12}}>
        <span style={{color:C.muted,fontSize:12,marginRight:2}}>Due</span>
        {quick.map(([l,n])=><button key={l} onClick={()=>{ setDue(addDays(n)); setMsg('') }} style={chip(due===addDays(n))}>{l}</button>)}
        <input type="date" value={due} onChange={e=>{ setDue(e.target.value); setMsg('') }} style={{...inp,width:150,padding:'5px 8px',fontSize:12}}/>
      </div>
      {err && <div style={{color:C.red,fontSize:12,marginTop:8}}>{err}</div>}
      {msg && !err && <div style={{color:C.green,fontSize:12,marginTop:8}}>{msg}</div>}
      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        <button onClick={save} disabled={busy||!text.trim()} style={{...btn,opacity:busy||!text.trim()?0.5:1}}>{busy?'Saving…':'Save next step'}</button>
        {cur && <button onClick={done} disabled={busy} style={{...ghost,borderColor:C.green,color:C.green,fontWeight:700}}>✓ Mark done</button>}
        {cur && <button onClick={clear} disabled={busy} style={ghost}>Clear</button>}
      </div>
    </div>
  )
}

// Offer / counter-offer log with the gap to the seller's number, plus the follow-up plan.
export function NegotiationEditor({lead,stage,activity,onSaved}){
  const n = negoOf(lead, activity)
  const plan = offerPlan(lead, activity)
  const [who,setWho] = useState('you')
  const [amount,setAmount] = useState('')
  const [note,setNote] = useState('')
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  const num = Number(String(amount).replace(/[$,\s]/g,''))

  async function add(){
    if(!num) return
    setBusy(true); setErr('')
    try{ await addNego(lead,{who,amount:num,note,by:getCaller()},stage); setAmount(''); setNote(''); await onSaved?.() }catch(e){ setErr(errText(e)) }
    setBusy(false)
  }
  async function remove(at){
    setBusy(true); setErr('')
    try{ await removeNego(lead,at); await onSaved?.() }catch(e){ setErr(errText(e)) }
    setBusy(false)
  }
  const tile = (label,v,c,sub) => (
    <div style={{background:C.ink,borderRadius:10,padding:'9px 12px',minWidth:0}}>
      <div style={{color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:0.8}}>{label}</div>
      <div style={{fontSize:19,fontFamily:'Georgia,serif',fontWeight:700,color:c,marginTop:2}}>{v}</div>
      {sub && <div style={{color:C.muted,fontSize:10.5}}>{sub}</div>}
    </div>
  )
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {tile('Your offer', n.lastYou?money(n.lastYou.amount):'—', C.orange)}
        {tile('Seller wants', n.lastSeller?money(n.lastSeller.amount):'—', C.cream, n.lastSeller&&n.lastSeller.note==='asking price'&&!n.all.some(e=>e.who==='seller')?'their asking price':null)}
        {tile('Gap', n.gap===null?'—':n.gap<=0?'Agreed':money(n.gap), n.gap===null?C.muted:n.gap<=0?C.green:C.amber)}
      </div>

      {plan && <FollowUpPlan plan={plan}/>}

      {n.all.length>0 && <div style={{marginTop:12}}>
        {n.all.map((e,i)=>(
          <div key={i} style={{display:'flex',gap:8,alignItems:'baseline',fontSize:12.5,padding:'6px 0',borderBottom:'1px solid '+C.line}}>
            <span style={{width:56,color:e.who==='you'?C.orange:C.cream,fontWeight:700}}>{e.who==='you'?'You':'Seller'}</span>
            <b style={{width:80}}>{money(e.amount)}</b>
            <span style={{flex:1,minWidth:0,color:C.muted,overflow:'hidden',textOverflow:'ellipsis'}}>{e.note||''}</span>
            <span style={{color:C.muted,fontSize:11,whiteSpace:'nowrap'}}>{e.at?new Date(e.at).toLocaleDateString([], {month:'short',day:'numeric'}):''}{e.src==='call'?' · call':''}</span>
            {e.src==='log' && <button onClick={()=>remove(e.at)} disabled={busy} title="Remove" style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:12}}>✕</button>}
          </div>
        ))}
      </div>}

      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:12}}>
        <button onClick={()=>setWho('you')} style={chip(who==='you')}>You offered</button>
        <button onClick={()=>setWho('seller')} style={chip(who==='seller')}>Seller countered</button>
        <input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric" placeholder="$ amount" style={{...inp,width:120,padding:'6px 9px'}}/>
      </div>
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optional) — e.g. would take less if we close in 2 weeks" style={{...inp,marginTop:8}}/>
      {err && <div style={{color:C.red,fontSize:12,marginTop:8}}>{err}</div>}
      <button onClick={add} disabled={busy||!num} style={{...btn,marginTop:10,opacity:busy||!num?0.5:1}}>{busy?'Saving…':'Add to negotiation'}</button>
      <div style={{color:C.muted,fontSize:11,marginTop:8,lineHeight:1.5}}>Offers you log on a call ("Offer made" with an amount) show up here automatically. A new offer from you restarts the follow-up plan.</div>
    </div>
  )
}

export function FollowUpPlan({plan,small}){
  const st = plan.finished ? null : dueState(plan.due)
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:small?6:12,flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:3}} title={'Follow up on day '+OFFER_FU.join(', ')+' after the offer'}>
        {OFFER_FU.map((_,i)=><span key={i} style={{width:small?8:10,height:small?8:10,borderRadius:'50%',background:i<plan.done?C.green:i===plan.done&&!plan.finished?(STATE_COLOR[st]===C.muted?C.line:STATE_COLOR[st]):C.line}}/>)}
      </div>
      <span style={{fontSize:small?11:12,color:plan.finished?C.amber:STATE_COLOR[st]===C.muted?C.muted:STATE_COLOR[st],fontWeight:small?500:600}}>
        {plan.finished ? 'All '+plan.total+' follow-ups done'
          : 'Follow-up '+plan.n+' of '+plan.total+' '+(st==='overdue'?'— '+daysLate(plan.due)+'d overdue':'due '+fmtDay(plan.due))}
      </span>
    </div>
  )
}

// The small next-step line on a card or lead header.
export function NextStepChip({ns,onClick}){
  if(!ns) return (
    <div onClick={onClick} style={{fontSize:11.5,marginTop:7,color:C.amber,cursor:'pointer',fontWeight:600}}>+ Add next step</div>
  )
  const c = STATE_COLOR[ns.state] || C.muted
  const late = ns.state==='overdue' && ns.due ? daysLate(ns.due) : 0
  return (
    <div onClick={onClick} title="Change next step" style={{fontSize:11.5,marginTop:7,cursor:'pointer',display:'flex',gap:6,alignItems:'baseline',background:ns.state==='overdue'?C.red+'14':ns.state==='today'?C.amber+'12':'transparent',border:'1px solid '+(ns.state==='overdue'?C.red+'55':ns.state==='today'?C.amber+'55':C.line),borderRadius:7,padding:'5px 8px'}}>
      <span style={{color:c}}>→</span>
      <span style={{flex:1,minWidth:0,color:C.cream,lineHeight:1.35}}>{ns.text}</span>
      {ns.due && <span style={{color:c,fontWeight:700,whiteSpace:'nowrap'}}>{ns.state==='overdue'?late+'d late':fmtDay(ns.due)}</span>}
    </div>
  )
}

// Panel on the lead page: next step + (from Contacted on) offer & negotiation.
export function DealPanel({lead,activity,reloadLeads}){
  const stage = stageOf(lead, activity)
  const [open,setOpen] = useState(false)
  const ns = nextStepOf(lead, activity, stage)
  const showNego = !['new','dead','closed'].includes(stage)
  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:18}
  return (
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <div style={{fontWeight:700,fontSize:14}}>Next step</div>
        <button onClick={()=>setOpen(!open)} style={{background:'transparent',border:'none',color:C.orange,fontSize:12,fontWeight:700,cursor:'pointer'}}>{open?'Close':ns&&ns.kind==='manual'?'Change':'Set'}</button>
      </div>
      {!open && <NextStepChip ns={ns} onClick={()=>setOpen(true)}/>}
      {open && <div style={{marginTop:10}}><NextStepEditor lead={lead} stage={stage} activity={activity} onSaved={reloadLeads} onClose={()=>setOpen(false)}/></div>}
      {showNego && <>
        <div style={{fontWeight:700,fontSize:14,marginTop:18,marginBottom:10}}>Offer &amp; negotiation</div>
        <NegotiationEditor lead={lead} stage={stage} activity={activity} onSaved={reloadLeads}/>
      </>}
    </div>
  )
}
