import { fmtPhone } from './stacking'
import { useState } from 'react'
import { REPAIRS, detailsOf, money, compResult, stageOf, stageIdx, STAGE, OUTCOME_STAGE, moveStage, patchLead, callbackOf, callbackState, fmtWhen } from './leadModel'
import { OUTCOMES, OUTCOME, logActivity, activityErr, getCaller, saveCaller } from './activity'

// Shared lead panels used on both the Leads page and the VA Workspace.

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

export function HandoffPanel({lead,reloadLeads}){
  const h = (lead.details && lead.details.handoff) || null
  const [note,setNote] = useState('')
  const [reply,setReply] = useState('')
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  async function save(patch){
    setBusy(true); setErr('')
    try{ await patchLead(lead, { handoff:patch }); setNote(''); if(reloadLeads) await reloadLeads() }
    catch(e){ setErr(/fetch/i.test(e.message)?"Can't reach the database — try again in a minute.":e.message) }
    setBusy(false)
  }
  const when = iso => iso ? new Date(iso).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''
  const open = h && h.status==='open'
  return (
    <div style={{background:C.panel,border:'1px solid '+(open?C.amber+'88':C.line),borderRadius:16,padding:22}}>
      <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Hot lead hand-off</div>
      {open ?
      <div>
        <div style={{background:C.amber+'14',border:'1px solid '+C.amber+'55',borderRadius:10,padding:'11px 13px'}}>
          <div style={{color:C.amber,fontSize:12,fontWeight:700}}>Waiting on the closer · handed off by {h.by} · {when(h.at)}</div>
          {h.note && <div style={{color:C.cream,fontSize:13.5,lineHeight:1.5,marginTop:6}}>{h.note}</div>}
        </div>
        <textarea value={reply} onChange={e=>setReply(e.target.value)} rows={2} placeholder={'Reply to '+(h.by||'the VA')+' (optional) — e.g. Offered $140k, she is thinking it over'} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 11px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',resize:'vertical',fontFamily:'inherit',marginTop:10}}/>
        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button disabled={busy} onClick={()=>save({...h,status:'done',done_at:new Date().toISOString(),reply:reply.trim()||null})} style={{background:C.green,color:C.ink,border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:800,cursor:'pointer'}}>Mark handled</button>
          <button disabled={busy} onClick={()=>save(null)} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer'}}>Cancel hand-off</button>
        </div>
      </div> :
      <div>
        {h && h.status==='done' && <div style={{background:C.green+'12',border:'1px solid '+C.green+'44',borderRadius:10,padding:'9px 12px',marginBottom:12,fontSize:12.5,lineHeight:1.45}}>
          <div style={{color:C.green,fontWeight:700}}>Last hand-off from {h.by} was handled {when(h.done_at)}</div>
          {h.reply && <div style={{color:C.cream,marginTop:3}}>Closer: {h.reply}</div>}
        </div>}
        <div style={{color:C.muted,fontSize:12.5,lineHeight:1.5,marginBottom:10}}>Seller is motivated or an appointment is set? Send it to the closer with what they need to know.</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="e.g. Wants out in 30 days, roof leaks, open to $140k. Call her after 5pm." style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
        <button disabled={busy||!note.trim()} onClick={()=>save({status:'open',by:getCaller()||'VA',note:note.trim(),at:new Date().toISOString()})} style={{marginTop:10,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 16px',fontSize:12.5,fontWeight:800,cursor:(busy||!note.trim())?'default':'pointer',opacity:(busy||!note.trim())?0.5:1}}>Hand off to closer</button>
      </div>}
      {err && <div style={{color:C.red,fontSize:12.5,marginTop:10}}>{err}</div>}
    </div>
  )
}

export function CallCard({lead,onEdit,onAnalyze}){
  const cr = compResult(lead)
  const d = detailsOf(lead)
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const lo = flagged.reduce((s,r)=>s+r[2],0)
  const hi = flagged.reduce((s,r)=>s+r[3],0)
  const ask = Number(d.asking_price)||0
  const arv = Number(lead.arv)||0
  const ceiling = cr ? cr.walk : arv ? Math.max(0, Math.round(arv*0.70 - hi - 15000)) : 0
  const facts = []
  if(d.occupancy!=='Unknown') facts.push(d.occupancy)
  if(d.beds) facts.push(d.beds+'bd')
  if(d.baths) facts.push(d.baths+'ba')
  if(d.sqft) facts.push(Number(d.sqft).toLocaleString()+' sqft')
  if(d.year_built) facts.push('built '+d.year_built)
  const empty = facts.length===0 && flagged.length===0 && !ask && d.sell_reason==='Unknown' && d.timeline==='Unsure' && !d.seller_notes && !d.repair_notes

  return (
    <div style={{background:C.panel,border:'1px solid '+C.orange+'66',borderRadius:16,padding:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,color:C.orange}}>Call Card — negotiation facts</div>
        <div style={{display:'flex',gap:6}}>
          {onAnalyze && <button onClick={onAnalyze} style={{background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'5px 11px',fontSize:11,fontWeight:700,cursor:'pointer'}}>{cr?'Re-run comps':'Run comps'}</button>}
          <button onClick={onEdit} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'5px 11px',fontSize:11,cursor:'pointer'}}>Update</button>
        </div>
      </div>

      {(()=>{ const cbk=callbackOf(lead), st=callbackState(cbk); if(!st) return null
        const col = st==='overdue'?C.red:st==='today'?C.amber:C.blue
        return <div style={{background:col+'14',border:'1px solid '+col+'55',borderRadius:10,padding:'9px 12px',marginBottom:12,fontSize:12.5,lineHeight:1.45}}>
          <b style={{color:col}}>{st==='overdue'?'Callback overdue':st==='today'?'Callback today':'Callback scheduled'}</b> <span style={{color:C.cream}}>· {fmtWhen(cbk.at)}{cbk.by?' · set by '+cbk.by:''}</span>
          {cbk.note && <div style={{color:C.muted,marginTop:2}}>{cbk.note}</div>}
        </div> })()}
      {(lead.details&&(lead.details.lists||[]).length>0) &&
      <div style={{background:C.ink,borderRadius:10,padding:'9px 12px',marginBottom:12,fontSize:12.5,lineHeight:1.5}}>
        <b style={{color:lead.details.lists.length>=3?C.orange:C.amber}}>On {lead.details.lists.length} list{lead.details.lists.length===1?'':'s'}:</b> <span style={{color:C.cream}}>{lead.details.lists.join(' · ')}</span>
        {lead.details.lists.length>=2 && <div style={{color:C.muted,marginTop:2}}>Multiple distress signals — ask about each one ("I saw the taxes are behind — is that part of why you'd sell?").</div>}
        {(lead.details.phones||[]).length>1 && <div style={{color:C.muted,marginTop:2}}>Other numbers: {lead.details.phones.slice(1).map(fmtPhone).join(', ')}</div>}
      </div>}
      {cr &&
      <div style={{background:C.ink,borderRadius:10,padding:'11px 14px',marginBottom:12,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        <div><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>ARV{cr.confidence?' · '+cr.confidence:''}</div><div style={{color:C.cream,fontSize:14,fontWeight:700,marginTop:3}}>{money(cr.arv)}</div></div>
        <div><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Rehab</div><div style={{color:C.cream,fontSize:14,fontWeight:700,marginTop:3}}>{money(cr.rehab)}</div></div>
        <div><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Offer range</div><div style={{color:C.orange,fontSize:14,fontWeight:700,marginTop:3}}>{money(cr.open)}–{money(cr.walk)}</div></div>
      </div>}

      {empty && !cr ?
      <div style={{color:C.muted,fontSize:13,lineHeight:1.55}}>No intel on this property yet. Hit <span style={{color:C.orange,fontWeight:700}}>Update</span> and fill in the condition, asking price and seller situation before the next call — that's your leverage.</div>
      :
      <div>
        {facts.length>0 && <div style={{color:C.cream,fontSize:13,marginBottom:12}}>{facts.join(' · ')}</div>}

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          <div style={{background:C.ink,borderRadius:10,padding:'10px 12px'}}>
            <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Why selling</div>
            <div style={{color:d.sell_reason==='Unknown'?C.muted:C.cream,fontSize:13,fontWeight:600,marginTop:3}}>{d.sell_reason}</div>
          </div>
          <div style={{background:C.ink,borderRadius:10,padding:'10px 12px'}}>
            <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Timeline</div>
            <div style={{color:d.timeline==='ASAP'?C.green:C.cream,fontSize:13,fontWeight:600,marginTop:3}}>{d.timeline}</div>
          </div>
          <div style={{background:C.ink,borderRadius:10,padding:'10px 12px'}}>
            <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Asking</div>
            <div style={{color:ask?C.cream:C.muted,fontSize:13,fontWeight:600,marginTop:3}}>{ask?money(ask):'—'}</div>
          </div>
        </div>

        {flagged.length>0 &&
        <div style={{background:C.ink,borderRadius:10,padding:'12px 14px',marginBottom:12}}>
          <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Repair ammo — use these on the call</div>
          {flagged.map(([k,label,l2,h2])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:13}}>
              <span style={{color:C.cream}}>{label}</span>
              <span style={{color:C.amber,fontWeight:600}}>{money(l2)}–{money(h2)}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid '+C.line,marginTop:8,paddingTop:8,fontSize:13}}>
            <span style={{color:C.cream,fontWeight:700}}>Total to justify your discount</span>
            <span style={{color:C.orange,fontWeight:800}}>{money(lo)}–{money(hi)}</span>
          </div>
        </div>}

        {ask>0 && arv>0 &&
        <div style={{background:C.orange+'14',border:'1px solid '+C.orange+'44',borderRadius:10,padding:'11px 14px',marginBottom:12,fontSize:12.5,color:C.cream,lineHeight:1.5}}>
          Seller wants <b>{money(ask)}</b>. {cr?'Your comped walk-away is':<>With {flagged.length>0?'the repairs above':'repairs'} + your fee, your 70%-rule ceiling is about</>} <b style={{color:C.orange}}>{money(ceiling)}</b>{ask>ceiling?' — that gap is the conversation.':' — asking is already inside your number.'}
        </div>}

        {d.repair_notes && <div style={{marginBottom:8}}><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Condition notes</div><div style={{color:C.cream,fontSize:13,lineHeight:1.5}}>{d.repair_notes}</div></div>}
        {d.seller_notes && <div><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Seller notes</div><div style={{color:C.cream,fontSize:13,lineHeight:1.5}}>{d.seller_notes}</div></div>}
      </div>}
    </div>
  )
}

export function ScriptPanel({lead}){
  const [stage,setStage] = useState(0)
  const [obj,setObj] = useState(null)
  const d = detailsOf(lead)
  const first = (lead.name||'there').split(' ')[0]
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const lo = flagged.reduce((s,r)=>s+r[2],0)
  const hi = flagged.reduce((s,r)=>s+r[3],0)
  const repairsTxt = flagged.length ? flagged.map(r=>r[1].toLowerCase()).join(', ') : 'the repairs we talked about'
  const ammoTxt = flagged.length ? money(lo)+'–'+money(hi) : 'serious money'
  const arv = Number(lead.arv)||0
  const cr = compResult(lead)
  const ceiling = cr ? cr.open : arv ? Math.max(0, Math.round(arv*0.70 - (flagged.length?hi:20000) - 15000)) : 0
  const offerTxt = ceiling ? (cr?money(ceiling):'about '+money(ceiling)) : '[your offer]'
  const ask = Number(d.asking_price)||0
  const tl = d.timeline!=='Unsure' ? d.timeline : '30 days'
  const reason = d.sell_reason!=='Unknown' ? d.sell_reason.toLowerCase() : 'your situation'
  const addr = (lead.address||'your property')+(lead.city?(' in '+lead.city):'')

  const stages = [
    {t:'1 · Intro — own the frame', goal:'First 60 seconds. You are qualifying THEM.', lines:[
      '"Hey, is this '+first+'? ... '+first+', this is ___ with Icole Agency. I\'m reaching out about '+addr+' — we buy houses '+(lead.city?('in '+lead.city):'in your area')+' for cash, and yours came across my desk. Got two minutes?"',
      '"Now, I can\'t promise we\'re a fit — first I need to see whether the property even QUALIFIES for our program. Mind if I ask a few quick questions?"',
    ]},
    {t:'2 · Fact-find — the 4 pillars', goal:'Condition → motivation → timeline → price. Check the repair boxes on the Call Card while they talk.', lines:[
      '"Tell me about the house — if I walked in the front door today, what would I see?"',
      '"When\'s the last time the roof was done? HVAC? Hot water tank?"',
      '"And what\'s got you potentially thinking about selling? ... How long has that been going on?"',
      '"If everything lined up, when would you want this done — 30 days, 60, or just exploring?"',
      '"Last one: if I could close on your timeline and you didn\'t fix a thing — what number works for you?"',
    ]},
    {t:'3 · Pitch — sell the situation', goal:'Mirror their pillars back. You\'re selling certainty, not buying a house.', lines:[
      '"Here\'s what I\'m hearing: '+reason+', the house needs '+repairsTxt+', and you want this handled '+(tl==='ASAP'?'as soon as possible':'within '+tl)+'."',
      '"That\'s exactly what we\'re built for — cash, as-is, no repairs, no agents, no fees, and YOU pick the closing date."',
    ]},
    {t:'4 · Offer — anchor with repair math', goal:'The repairs justify the number. Then make the money feel real.', lines:[
      flagged.length
        ? '"A retail buyer would need '+ammoTxt+' of work before a bank touches this — '+repairsTxt+'. That\'s why cash matters here."'
        : '"A retail buyer would need serious repair money before a bank touches a house like this — that\'s why cash matters here."',
      '"Based on all that, I\'m at '+offerTxt+(ask?(' — I know you mentioned '+money(ask)+', so let\'s talk about the gap'):'')+'."',
      '"Let me ask you something: when\'s the last time you had access to that kind of money in one wire?"',
    ]},
    {t:'5 · Close — assume it, calendar it', goal:'Never "so what do you think?" Go straight to logistics.', lines:[
      '"Here\'s what happens next: I send the agreement tonight, you sign it right from your phone, and title gets started tomorrow."',
      '"What\'s the best email for you?"',
    ]},
  ]

  const objections = [
    ['price','"Price is too low"', ask&&flagged.length
      ? '"I hear you. You mentioned '+money(ask)+' — but walk through it with me: '+repairsTxt+' runs '+ammoTxt+'. Take that off '+money(ask)+' and we\'re not far apart — except my number is cash, certain, and done on your timeline."'
      : '"I hear you. Walk through it with me though — once you subtract what the repairs cost and what waiting costs you, our numbers are closer than they look. And mine is cash and certain."'],
    ['think','"I need to think about it"',
      '"Totally fair, '+first+'. Just so I\'m helping the right way — is it the price, the timing, or something else? ... Okay. If we solved that one piece, would we have a deal?"'],
    ['landlord','Tired landlord',
      '"Run the math with me: after vacancies, repairs and the 2am phone calls, what did the place actually NET you last year? ... Now compare that to a lump sum this month and never thinking about it again. Which one buys back your time?"'],
    ['agent','"I might list it"',
      '"You could — and for a turn-key house I\'d tell you to. But listed, you\'re looking at 6% commission, '+(flagged.length?(repairsTxt+' fixed first'):'repairs done first')+', and 60–90 days of showings. My offer is net, as-is, two weeks. What matters more — the top number, or the certain one?"'],
  ]
  const activeObj = objections.find(o=>o[0]===obj)
  const st = stages[stage]

  return (
    <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1}}>Live Call Script</div>
        <div style={{display:'flex',gap:5}}>
          {stages.map((_,i)=>(
            <span key={i} onClick={()=>{setStage(i);setObj(null)}} style={{width:9,height:9,borderRadius:9,background:i===stage?C.orange:i<stage?C.orange+'66':C.line,cursor:'pointer'}}/>
          ))}
        </div>
      </div>
      <div style={{color:C.muted,fontSize:11,marginBottom:14}}>Auto-filled from this lead's Call Card</div>

      <div style={{color:C.orange,fontWeight:700,fontSize:14,marginBottom:3}}>{st.t}</div>
      <div style={{color:C.muted,fontSize:12,marginBottom:12,lineHeight:1.4}}>{st.goal}</div>
      {st.lines.map((ln,i)=>(
        <div key={i} style={{background:C.ink,borderLeft:'3px solid '+C.orange,borderRadius:'0 8px 8px 0',padding:'11px 13px',marginBottom:8,fontSize:13.5,lineHeight:1.55,color:C.cream}}>{ln}</div>
      ))}

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={()=>{setStage(Math.max(0,stage-1));setObj(null)}} disabled={stage===0} style={{background:'transparent',border:'1px solid '+C.line,color:stage===0?C.line:C.muted,borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:stage===0?'default':'pointer'}}>← Back</button>
        {stage<stages.length-1
          ? <button onClick={()=>{setStage(stage+1);setObj(null)}} style={{flex:1,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:800,cursor:'pointer'}}>Next stage →</button>
          : <button onClick={()=>{setStage(0);setObj(null)}} style={{flex:1,background:C.green,color:C.ink,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:800,cursor:'pointer'}}>Deal talk done — restart</button>}
      </div>

      <div style={{borderTop:'1px solid '+C.line,marginTop:16,paddingTop:12}}>
        <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>They pushed back? Tap it:</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {objections.map(([k,label])=>(
            <button key={k} onClick={()=>setObj(obj===k?null:k)} style={{background:obj===k?C.amber:'transparent',border:'1px solid '+(obj===k?C.amber:C.line),color:obj===k?C.ink:C.muted,borderRadius:14,padding:'5px 11px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{label}</button>
          ))}
        </div>
        {activeObj &&
        <div style={{background:C.amber+'14',border:'1px solid '+C.amber+'55',borderRadius:10,padding:'12px 14px',marginTop:10,fontSize:13.5,lineHeight:1.55,color:C.cream}}>{activeObj[2]}</div>}
      </div>
    </div>
  )
}

export function LogCall({lead,activity,reloadActivity,reloadLeads,onNext}){
  const [caller,setCaller] = useState(getCaller())
  const [note,setNote] = useState('')
  const [pending,setPending] = useState(null)
  const [amount,setAmount] = useState('')
  const [busy,setBusy] = useState(false)
  const [msg,setMsg] = useState(null)
  const [cb,setCb] = useState('')          // ISO time for a new callback, '' = none
  const [cbPick,setCbPick] = useState(false)
  const history = activity.filter(a=>a.lead_id===String(lead.id)).slice(0,6)
  const existingCb = callbackOf(lead)
  const at = (days,h) => { const d=new Date(); d.setDate(d.getDate()+days); d.setHours(h,0,0,0); return d.toISOString() }
  const PRESETS = [['Tomorrow 10am',()=>at(1,10)],['Tomorrow 5pm',()=>at(1,17)],['In 3 days',()=>at(3,10)],['Next week',()=>at(7,10)]]
  const toLocalInput = iso => { const d=new Date(iso); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes()) }

  async function submit(outcome){
    const o = OUTCOME[outcome]
    if(o.amount && pending!==outcome){ setPending(outcome); setAmount(''); return }
    setBusy(true); setMsg(null)
    try{
      await logActivity(lead, outcome, {amount, note, caller})
      saveCaller(caller)
      let moved = ''
      try{
        const cur = stageOf(lead, activity), target = OUTCOME_STAGE[outcome]
        const extra = {}
        const prevDeal = (lead.details && lead.details.deal) || {}
        if(outcome==='closed' && Number(amount)) extra.deal = {...prevDeal, fee:Number(amount), closing_date:prevDeal.closing_date||new Date().toISOString().slice(0,10)}
        if(outcome==='offer' && Number(amount)) extra.deal = {...prevDeal, last_offer:Number(amount)}
        // A new callback replaces the old one; logging any call without one completes the old one.
        if(cb && outcome!=='dead') extra.callback = { at:cb, by:caller||'VA', note:note.trim()||null, set_at:new Date().toISOString() }
        else if(existingCb) extra.callback = null
        const forward = target && (target==='dead' ? cur!=='dead' : stageIdx(target)>stageIdx(cur))
        if(forward){ await moveStage(lead, target, extra); moved = ' · moved to '+STAGE[target].l+' in Pipeline' }
        else if(Object.keys(extra).length){ await patchLead(lead, extra) }
        if(extra.callback) moved += ' · callback set for '+fmtWhen(extra.callback.at)
        if((forward || Object.keys(extra).length) && reloadLeads) reloadLeads()
      }catch{ moved = ' · (pipeline stage not updated — try moving it on the Pipeline page)' }
      setMsg({ok:true,t:'Logged: '+o.label+moved}); setNote(''); setPending(null); setAmount(''); setCb(''); setCbPick(false)
      reloadActivity()
    }catch(e){ setMsg({ok:false,t:activityErr(e.message)}) }
    setBusy(false)
  }
  const when = iso => { const d=new Date(iso); const t=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}); return d.toDateString()===new Date().toDateString() ? 'Today '+t : d.toLocaleDateString([], {month:'short',day:'numeric'})+' '+t }

  return (
    <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1}}>Log this call</div>
        <label style={{display:'flex',alignItems:'center',gap:6,color:C.muted,fontSize:11}}>Caller
          <input value={caller} onChange={e=>setCaller(e.target.value)} onBlur={()=>saveCaller(caller)} placeholder="your name" style={{background:C.ink,border:'1px solid '+C.line,borderRadius:6,padding:'5px 8px',color:C.cream,fontSize:12,outline:'none',width:110}}/>
        </label>
      </div>
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Quick note (optional) — e.g. wife decides, call after 5" style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginBottom:10}}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:10}}>
        <span style={{color:C.muted,fontSize:11.5,marginRight:2}}>Callback:</span>
        {PRESETS.map(([l,f])=>{ const v=f(); const on=cb===v; return (
          <button key={l} onClick={()=>{ setCb(on?'':v); setCbPick(false) }} style={{background:on?C.blue:'transparent',color:on?C.ink:C.muted,border:'1px solid '+(on?C.blue:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{l}</button>
        )})}
        <button onClick={()=>{ setCbPick(!cbPick); if(!cbPick && !cb) setCb(at(1,10)) }} style={{background:cbPick?C.blue:'transparent',color:cbPick?C.ink:C.muted,border:'1px solid '+(cbPick?C.blue:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>Pick…</button>
        {cbPick && <input type="datetime-local" value={cb?toLocalInput(cb):''} onChange={e=>setCb(e.target.value?new Date(e.target.value).toISOString():'')} style={{background:C.ink,border:'1px solid '+C.blue,borderRadius:8,padding:'5px 8px',color:C.cream,fontSize:12,colorScheme:'dark'}}/>}
      </div>
      {cb && <div style={{color:C.blue,fontSize:12,marginBottom:10}}>Callback will be set for <b>{fmtWhen(cb)}</b> when you log the outcome below.</div>}
      {!cb && existingCb && <div style={{color:C.muted,fontSize:11.5,marginBottom:10}}>Logging this call completes the callback that was set for {fmtWhen(existingCb.at)}.</div>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {OUTCOMES.map(o=>(
          <button key={o.key} disabled={busy} onClick={()=>submit(o.key)} style={{background:pending===o.key?C.orange:C.ink,color:pending===o.key?C.ink:(o.key==='dead'?C.muted:C.cream),border:'1px solid '+(pending===o.key?C.orange:C.line),borderRadius:8,padding:'8px 11px',fontSize:12,fontWeight:600,cursor:busy?'default':'pointer'}}>{o.label}</button>
        ))}
      </div>
      {pending &&
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <input autoFocus type="number" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit(pending)} placeholder={OUTCOME[pending].amount+' ($)'} style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.orange,borderRadius:8,padding:'9px 12px',color:C.cream,fontSize:13,outline:'none'}}/>
        <button onClick={()=>submit(pending)} disabled={busy} style={{background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'0 16px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Save</button>
        <button onClick={()=>setPending(null)} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'0 12px',fontSize:12,cursor:'pointer'}}>Cancel</button>
      </div>}
      {msg && <div style={{marginTop:10,fontSize:12.5,lineHeight:1.45,color:msg.ok?C.green:C.red,background:(msg.ok?C.green:C.red)+'14',border:'1px solid '+(msg.ok?C.green:C.red)+'44',borderRadius:8,padding:'8px 11px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span>{msg.t}</span>
        {msg.ok && onNext && <button onClick={onNext} style={{background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>Next lead →</button>}
      </div>}
      {history.length>0 &&
      <div style={{borderTop:'1px solid '+C.line,marginTop:14,paddingTop:10}}>
        <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Call history</div>
        {history.map(a=>(
          <div key={a.id} style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:12,padding:'4px 0',borderBottom:'1px solid '+C.line+'88'}}>
            <span style={{color:C.cream}}>{OUTCOME[a.outcome]?.short||a.outcome}{a.amount?' · '+money(a.amount):''}{a.note?<span style={{color:C.muted}}> — {a.note}</span>:null}</span>
            <span style={{color:C.muted,whiteSpace:'nowrap'}}>{when(a.created_at)} · {a.caller}</span>
          </div>
        ))}
      </div>}
    </div>
  )
}


const INTEL_REPAIRS = REPAIRS
const OCC = ['Unknown','Owner occupied','Tenant','Vacant']
const TIMELINES = ['Unsure','ASAP','30 days','60 days','90+ days','Just testing market']
const REASONS = ['Unknown','Foreclosure','Tax delinquent','Inherited / probate','Divorce','Tired landlord','Relocation','Vacant / repairs','Other']

// Compact editor for the Call Card facts (for VAs, who don't get the full lead form).
export function IntelEditor({lead,onDone,reloadLeads}){
  const d0 = detailsOf(lead)
  const [d,setD] = useState({...d0, repairs:{...d0.repairs}})
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  const set = (k,v) => setD(x=>({...x,[k]:v}))
  const num = v => v===''||v===null||v===undefined ? null : (Number(String(v).replace(/[$,]/g,''))||null)
  async function save(){
    setBusy(true); setErr('')
    try{
      await patchLead(lead, { beds:num(d.beds), baths:num(d.baths), sqft:num(d.sqft), year_built:num(d.year_built),
        occupancy:d.occupancy, asking_price:num(d.asking_price), timeline:d.timeline, sell_reason:d.sell_reason,
        repairs:d.repairs, repair_notes:d.repair_notes||'', seller_notes:d.seller_notes||'' })
      if(reloadLeads) await reloadLeads()
      onDone()
    }catch(e){ setErr(/fetch/i.test(e.message)?"Can't reach the database — try again in a minute.":e.message); setBusy(false) }
  }
  const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',minWidth:0,boxSizing:'border-box'}
  const lab = {color:C.muted,fontSize:11}
  return (
    <div style={{background:C.panel,border:'1px solid '+C.orange+'88',borderRadius:16,padding:20}}>
      <div style={{color:C.orange,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Update property & seller intel</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>
        {[['beds','Beds'],['baths','Baths'],['sqft','Sqft'],['year_built','Year built']].map(([k,l])=>(
          <label key={k} style={lab}>{l}<input type="number" value={d[k]??''} onChange={e=>set(k,e.target.value)} style={{...inp,marginTop:3}}/></label>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:8}}>
        <label style={lab}>Asking price<input type="number" value={d.asking_price??''} onChange={e=>set('asking_price',e.target.value)} style={{...inp,marginTop:3}}/></label>
        <label style={lab}>Occupancy<select value={d.occupancy} onChange={e=>set('occupancy',e.target.value)} style={{...inp,marginTop:3}}>{OCC.map(o=><option key={o}>{o}</option>)}</select></label>
        <label style={lab}>Timeline<select value={d.timeline} onChange={e=>set('timeline',e.target.value)} style={{...inp,marginTop:3}}>{TIMELINES.map(o=><option key={o}>{o}</option>)}</select></label>
        <label style={lab}>Why selling<select value={d.sell_reason} onChange={e=>set('sell_reason',e.target.value)} style={{...inp,marginTop:3}}>{REASONS.map(o=><option key={o}>{o}</option>)}</select></label>
      </div>
      <div style={{...lab,margin:'12px 0 6px'}}>Repairs the seller mentioned</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:6}}>
        {INTEL_REPAIRS.map(([k,l])=>(
          <label key={k} style={{display:'flex',gap:7,alignItems:'center',background:C.ink,border:'1px solid '+(d.repairs[k]?C.orange:C.line),borderRadius:8,padding:'7px 9px',fontSize:12,color:d.repairs[k]?C.cream:C.muted,cursor:'pointer'}}>
            <input type="checkbox" checked={!!d.repairs[k]} onChange={e=>set('repairs',{...d.repairs,[k]:e.target.checked})}/>{l}
          </label>
        ))}
      </div>
      <textarea value={d.repair_notes||''} onChange={e=>set('repair_notes',e.target.value)} rows={2} placeholder="Condition notes (roof age, leaks, last HVAC service...)" style={{...inp,marginTop:10,resize:'vertical',fontFamily:'inherit'}}/>
      <textarea value={d.seller_notes||''} onChange={e=>set('seller_notes',e.target.value)} rows={2} placeholder="Seller notes (situation, urgency, best time to call...)" style={{...inp,marginTop:8,resize:'vertical',fontFamily:'inherit'}}/>
      {err && <div style={{color:C.red,fontSize:12.5,marginTop:8}}>{err}</div>}
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={save} disabled={busy} style={{background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 18px',fontWeight:800,fontSize:12.5,cursor:'pointer',opacity:busy?0.7:1}}>{busy?'Saving...':'Save intel'}</button>
        <button onClick={onDone} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'9px 14px',fontSize:12.5,cursor:'pointer'}}>Cancel</button>
      </div>
    </div>
  )
}
