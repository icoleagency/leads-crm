import { useState, useMemo } from 'react'
import { STAGES, STAGE, STALE_DAYS, stageOf, stageSince, daysSince, compResult, detailsOf, moveStage, patchLead, money } from './leadModel'
import { nextStepOf, urgency, negoOf, offerPlan, NEEDS_STEP, checklistOf, lostStats, reasonLabel } from './deals'
import { LockGate } from './DealSafety'
import { getCaller } from './activity'
import { Modal, NextStepEditor, NegotiationEditor, NextStepChip, FollowUpPlan, ClosingChecklist, LostForm } from './DealTools'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const DEAL_STAGES = ['contract','assigned','closed']
const DEFAULT_FEE = 15000
const BOARD = [...STAGES.filter(([k])=>!['dead','new','nurture'].includes(k)), STAGES.find(([k])=>k==='nurture')]
const NEW_CAP = 60
const countyOf = l => { const c = l.details && l.details.county; return c ? String(c).replace(/\s*county$/i,'').trim() : '' }

function dealOf(l){ return (l.details && l.details.deal) || {} }
function feeOf(l){
  const d = dealOf(l)
  if(Number(d.fee)) return { v:Number(d.fee), est:false }
  return { v:DEFAULT_FEE, est:true }
}
function closingIn(l){
  const c = dealOf(l).closing_date
  if(!c) return null
  const d = new Date(c+'T12:00:00'); if(isNaN(d)) return null
  return Math.ceil((d.getTime()-Date.now())/86400000)
}
const fmtDate = s => { if(!s) return ''; const d=new Date(s+'T12:00:00'); return isNaN(d)?s:d.toLocaleDateString([], {month:'short',day:'numeric'}) }

export default function Pipeline({leads,activity,reload,openLead,analyze,isMobile}){
  const [local,setLocal] = useState({})        // optimistic stage moves
  const [over,setOver] = useState(null)
  const [showDead,setShowDead] = useState(false)
  const [showNew,setShowNew] = useState(false)
  const [dealFor,setDeal] = useState(null)     // lead id for the deal modal
  const [lostFor,setLostFor] = useState(null)  // {id, stage} when moving to dead / nurture
  const [lockFor,setLockFor] = useState(null)  // lead id for the lock check before Under contract
  const [stepFor,setStepFor] = useState(null)  // lead id for the next-step modal
  const [negoFor,setNegoFor] = useState(null)  // lead id for the negotiation modal
  const [err,setErr] = useState('')
  const [q,setQ] = useState('')
  const [type,setType] = useState('')
  const [county,setCounty] = useState('')
  const [attention,setAttention] = useState(false)

  // Stage, next step and flags for every lead, worked out once per render of new data.
  const rows = useMemo(()=>leads.map(l=>{
    const s = local[l.id] || stageOf(l, activity)
    const since = stageSince(l, activity)
    const days = daysSince(since)
    const ns = nextStepOf(l, activity, s)
    const stale = !!(STALE_DAYS[s] && days!==null && days>STALE_DAYS[s])
    const noStep = NEEDS_STEP.includes(s) && !ns
    const due = ns && (ns.state==='overdue' || ns.state==='today')
    return { l, s, since, days, ns, stale, noStep, due, attention: stale || noStep || due }
  }),[leads,activity,local])

  const types = useMemo(()=>[...new Set(rows.filter(r=>r.s!=='new').map(r=>r.l.lead_type).filter(Boolean))].sort(),[rows])
  const counties = useMemo(()=>[...new Set(rows.filter(r=>r.s!=='new').map(r=>countyOf(r.l)).filter(Boolean))].sort(),[rows])
  const ql = q.trim().toLowerCase(), qd = q.replace(/\D/g,'')
  const match = r => {
    const l = r.l
    if(type && l.lead_type!==type) return false
    if(county && countyOf(l)!==county) return false
    if(attention && !r.attention) return false
    if(ql){
      const hay = [l.name,l.address,l.city,l.lead_type].join(' ').toLowerCase()
      const ph = [l.phone,...((l.details&&l.details.phones)||[])].join(' ').replace(/\D/g,'')
      if(!hay.includes(ql) && !(qd.length>=4 && ph.includes(qd))) return false
    }
    return true
  }
  const shown = rows.filter(match)
  const inStage = k => shown.filter(r=>r.s===k)
    .sort((a,b)=>urgency(a.ns)-urgency(b.ns) || String(a.ns&&a.ns.due||'9').localeCompare(String(b.ns&&b.ns.due||'9')) || new Date(a.since||0)-new Date(b.since||0))

  async function move(lead, stage, opts={}){
    const was = local[lead.id]||stageOf(lead,activity)
    if(was===stage) return
    // Going under contract? Run the lock check first (price vs. max, comps, rehab, investor prices, stress).
    if(stage==='contract' && !opts.locked && !['assigned','closed'].includes(was)){ setLockFor(lead.id); return }
    if(stage==='dead' || stage==='nurture'){ setLostFor({ id:lead.id, stage, from:was }); return }
    setLocal(m=>({...m,[lead.id]:stage})); setErr('')
    let ok = true
    try{
      await moveStage(lead, stage, opts.extra||{})
      await reload()
    }catch(e){ ok = false; setErr(/fetch/i.test(e.message)?"Couldn't save that move — the database isn't reachable. Try again in a minute.":e.message) }
    setLocal(m=>{ const n={...m}; delete n[lead.id]; return n })
    if(!ok) return
    // Ask for what happens next, right when it's fresh.
    if(stage==='contract') setDeal(lead.id)
    else if(stage==='offer' && !negoOf(lead,activity).lastYou) setNegoFor(lead.id)
    else if(['contacted','appointment','contract','assigned'].includes(stage) && !(lead.details&&lead.details.next)) setStepFor(lead.id)
  }

  const working = rows.filter(r=>!['new','closed','dead'].includes(r.s))
  const live = working.filter(r=>r.s!=='nurture')
  const nurturing = working.length-live.length
  const underContract = rows.filter(r=>['contract','assigned'].includes(r.s)).map(r=>r.l)
  const projected = underContract.reduce((s,l)=>s+feeOf(l).v,0)
  const anyEst = underContract.some(l=>feeOf(l).est)
  const closed = rows.filter(r=>r.s==='closed').map(r=>r.l)
  const closedFees = closed.reduce((s,l)=>s+(Number(dealOf(l).fee)||0),0)
  const overdue = working.filter(r=>r.ns && r.ns.state==='overdue').length
  const today = working.filter(r=>r.ns && r.ns.state==='today').length
  const noStep = live.filter(r=>r.noStep).length
  const staleCount = live.filter(r=>r.stale).length
  const attnCount = working.filter(r=>r.attention).length
  const newCount = rows.filter(r=>r.s==='new').length
  const filtering = !!(ql||type||county||attention)

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const tile = {background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'13px 15px',minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}
  const pill = on => ({background:on?C.orange:'transparent',border:'1px solid '+(on?C.orange:C.line),color:on?C.ink:C.muted,borderRadius:20,padding:'6px 13px',fontSize:12.5,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'})
  const sel = {background:C.ink,border:'1px solid '+C.line,borderRadius:20,padding:'6px 12px',color:C.cream,fontSize:12.5,maxWidth:170}

  const byId = id => leads.find(x=>x.id===id)
  const stepLead = stepFor!==null && byId(stepFor), negoLead = negoFor!==null && byId(negoFor), dealLead = dealFor!==null && byId(dealFor), lostLead = lostFor && byId(lostFor.id)
  const deadLeads = rows.filter(r=>r.s==='dead'||r.s==='nurture').map(r=>r.l)
  const why = showDead ? lostStats(deadLeads) : []

  const column = ([k,label,color]) => {
    const all = inStage(k)
    const items = k==='new' ? all.slice(0,NEW_CAP) : all
    const fees = ['contract','assigned','closed'].includes(k) ? all.reduce((s,r)=>s+(k==='closed'?(Number(dealOf(r.l).fee)||0):feeOf(r.l).v),0) : 0
    const late = all.filter(r=>r.ns && r.ns.state==='overdue').length
    return (
      <div key={k}
        onDragOver={e=>{ e.preventDefault(); setOver(k) }}
        onDragLeave={()=>setOver(o=>o===k?null:o)}
        onDrop={e=>{ e.preventDefault(); setOver(null); const id=e.dataTransfer.getData('text/plain'); const l=leads.find(x=>String(x.id)===id); if(l) move(l,k) }}
        style={{flex:'0 0 '+(isMobile?'82vw':'240px'),background:over===k?C.panel2:C.ink,border:'1px solid '+(over===k?color:C.line),borderRadius:14,padding:10,display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 330px)',minHeight:220,scrollSnapAlign:'start'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 4px 10px',borderBottom:'2px solid '+color,marginBottom:8,gap:6}}>
          <span style={{fontWeight:700,fontSize:13}}>{label}</span>
          <span style={{color:C.muted,fontSize:12,whiteSpace:'nowrap'}}>{late>0 && <b style={{color:C.red}} title={late+' overdue'}>{late}! · </b>}{all.length}{fees?' · '+money(fees):''}</span>
        </div>
        <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:8,paddingRight:2}}>
          {items.length===0 && <div style={{color:C.muted,fontSize:12,padding:'10px 4px',textAlign:'center'}}>{over===k?'Drop here':'—'}</div>}
          {items.map(r=><Card key={r.l.id} r={r} activity={activity} onMove={s=>move(r.l,s)} onOpen={()=>openLead(r.l.id)} onDeal={()=>setDeal(r.l.id)} onStep={()=>setStepFor(r.l.id)} onNego={()=>setNegoFor(r.l.id)} onAnalyze={()=>analyze(r.l.id)} pending={!!local[r.l.id]}/>)}
          {all.length>items.length && <div style={{color:C.muted,fontSize:11.5,textAlign:'center',padding:6}}>+ {all.length-items.length} more — search to find one, or work them from the VA Workspace</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>Pipeline</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Sellers you've talked to, sorted by what's due first. Drag deals between stages{isMobile?' (or use Move to)':''}; logging a call moves them automatically.</p>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginTop:16}}>
        <div style={tile}><div style={cap}>Active deals</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{live.length}</div><div style={{color:staleCount?C.amber:C.muted,fontSize:11,marginTop:2}}>{staleCount?staleCount+' stale':'nothing stale'}{noStep?' · '+noStep+' without a next step':''}{nurturing?' · '+nurturing+' nurturing':''}</div></div>
        <div onClick={()=>setAttention(true)} style={{...tile,cursor:'pointer',borderColor:overdue?C.red+'77':C.line}}><div style={cap}>Next steps due</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4,color:overdue?C.red:today?C.amber:C.cream}}>{overdue+today}</div><div style={{color:overdue?C.red:C.muted,fontSize:11,marginTop:2}}>{overdue?overdue+' overdue · ':''}{today} due today</div></div>
        <div style={tile}><div style={cap}>Projected fees</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4,color:C.orange}}>{money(projected)}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{underContract.length} under contract{anyEst?' · incl. $15k estimates':''}</div></div>
        <div style={tile}><div style={cap}>Closed fees</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4,color:C.green}}>{money(closedFees)}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{closed.length} closed deal{closed.length===1?'':'s'}</div></div>
      </div>

      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:14}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, address or phone" style={{...sel,borderRadius:20,maxWidth:'none',width:isMobile?'100%':230,padding:'7px 13px',outline:'none',boxSizing:'border-box'}}/>
        <button onClick={()=>setAttention(!attention)} style={pill(attention)}>Needs attention{attnCount?' ('+attnCount+')':''}</button>
        {types.length>1 && <select value={type} onChange={e=>setType(e.target.value)} style={sel}><option value="">All list types</option>{types.map(t=><option key={t}>{t}</option>)}</select>}
        {counties.length>1 && <select value={county} onChange={e=>setCounty(e.target.value)} style={sel}><option value="">All counties</option>{counties.map(t=><option key={t}>{t}</option>)}</select>}
        {filtering && <button onClick={()=>{ setQ(''); setType(''); setCounty(''); setAttention(false) }} style={{...pill(false),border:'none'}}>Clear</button>}
        <span style={{flex:1}}/>
        <button onClick={()=>setShowNew(!showNew)} style={pill(showNew)}>{showNew?'Hide':'Show'} new leads ({newCount.toLocaleString()})</button>
        <button onClick={()=>setShowDead(!showDead)} style={pill(showDead)}>{showDead?'Hide':'Show'} dead ({rows.filter(r=>r.s==='dead').length})</button>
      </div>

      {showDead && <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'12px 15px',marginTop:12}}>
        <div style={{fontWeight:700,fontSize:13.5,marginBottom:8}}>Why deals die <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— dead and nurture, by the reason you picked</span></div>
        {why.length===0 ? <div style={{color:C.muted,fontSize:12.5}}>No reasons recorded yet. From now on, moving a deal to Dead or Nurture asks why.</div> :
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'4px 24px'}}>
          {why.map(w=>{ const max = why[0].n; return (
            <div key={w.k} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
              <span style={{width:isMobile?130:170,color:C.cream}}>{w.l}</span>
              <div style={{flex:1,height:8,background:C.ink,borderRadius:6}}><div style={{width:(w.n/max*100)+'%',height:'100%',background:C.red,borderRadius:6,opacity:0.8}}/></div>
              <b style={{width:24,textAlign:'right'}}>{w.n}</b>
            </div>) })}
        </div>}
      </div>}

      {err && <div style={{marginTop:12,fontSize:12.5,color:C.red,background:C.red+'14',border:'1px solid '+C.red+'44',borderRadius:8,padding:'9px 12px'}}>{err}</div>}

      {leads.length===0 ?
      <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:30,marginTop:16,color:C.muted,textAlign:'center'}}>No leads yet — add some on the Leads page and they'll show up here.</div> :
      live.length===0 && !showNew && !showDead && closed.length===0 ?
      <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:30,marginTop:16,textAlign:'center'}}>
        <div style={{fontWeight:700,fontSize:15}}>No deals in motion yet</div>
        <div style={{color:C.muted,fontSize:13,marginTop:6,lineHeight:1.5}}>When you log a call where you talked to the seller, the lead moves onto this board. Your {newCount.toLocaleString()} uncontacted leads are in Leads and the VA Workspace.</div>
        <button onClick={()=>setShowNew(true)} style={{...pill(false),marginTop:12}}>Show new leads anyway</button>
      </div> :
      <div style={{display:'flex',gap:12,overflowX:'auto',marginTop:14,paddingBottom:10,scrollSnapType:isMobile?'x mandatory':'none'}}>
        {showNew && column(STAGES.find(s=>s[0]==='new'))}
        {BOARD.map(column)}
        {showDead && column(STAGES.find(s=>s[0]==='dead'))}
      </div>}
      {filtering && <div style={{color:C.muted,fontSize:12,marginTop:4}}>Showing {shown.filter(r=>showNew||r.s!=='new').filter(r=>showDead||r.s!=='dead').length} matching</div>}

      {dealLead && <DealModal lead={dealLead} onClose={()=>setDeal(null)} onSaved={async()=>{ setDeal(null); await reload() }} onChecklist={reload}/>}
      {lockFor!==null && byId(lockFor) && <LockGate lead={byId(lockFor)} onCancel={()=>setLockFor(null)} onAnalyze={()=>{ const id = lockFor; setLockFor(null); analyze(id) }}
        onConfirm={async (price, why, res)=>{ const l = byId(lockFor); setLockFor(null)
          const deal = { ...dealOf(l), contract_price:price, contract_date:dealOf(l).contract_date||new Date().toISOString().slice(0,10),
            lock:{ status:res.overall, walk:(l.details&&l.details.comp&&l.details.comp.result&&l.details.comp.result.walk)||null, override:why, by:getCaller()||null, at:new Date().toISOString() } }
          await move(l, 'contract', { locked:true, extra:{ deal } }) }}/>}
      {lostLead && <Modal title={lostFor.stage==='nurture'?'Move to Nurture':'Mark dead'} sub={lostLead.name+' · was '+STAGE[lostFor.from].l} onClose={()=>setLostFor(null)}>
        <LostForm lead={lostLead} stage={lostFor.from} target={lostFor.stage} onCancel={()=>setLostFor(null)} onDone={async()=>{ setLostFor(null); await reload() }}/>
      </Modal>}
      {stepLead && <Modal title="Next step" sub={stepLead.name+' · '+STAGE[rows.find(r=>r.l.id===stepLead.id)?.s||'new'].l} onClose={()=>setStepFor(null)}>
        <NextStepEditor lead={stepLead} stage={rows.find(r=>r.l.id===stepLead.id)?.s||'new'} activity={activity} onSaved={reload} onClose={()=>setStepFor(null)}/>
      </Modal>}
      {negoLead && <Modal title="Offer & negotiation" sub={negoLead.name+' · '+[negoLead.address,negoLead.city].filter(Boolean).join(', ')} onClose={()=>setNegoFor(null)}>
        <NegotiationEditor lead={negoLead} stage={rows.find(r=>r.l.id===negoLead.id)?.s||'offer'} activity={activity} onSaved={reload}/>
      </Modal>}
    </div>
  )
}

function Card({r,activity,onMove,onOpen,onDeal,onStep,onNego,onAnalyze,pending}){
  const { l:lead, s:stage, days, ns, stale } = r
  const cr = compResult(lead)
  const d = detailsOf(lead)
  const dl = dealOf(lead)
  const ci = closingIn(lead)
  const isDeal = DEAL_STAGES.includes(stage)
  const small = {color:C.muted,fontSize:11}
  const n = ['offer','contract'].includes(stage) || stage==='appointment' ? negoOf(lead, activity) : null
  const plan = stage==='offer' ? offerPlan(lead, activity) : null
  const border = ns && ns.state==='overdue' ? C.red+'88' : stale ? C.amber+'88' : C.line
  const btn = c => ({background:'transparent',border:'1px solid '+c,color:c,borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'})
  return (
    <div draggable onDragStart={e=>{ e.dataTransfer.setData('text/plain',String(lead.id)); e.dataTransfer.effectAllowed='move' }}
      style={{background:C.panel,border:'1px solid '+border,borderRadius:10,padding:11,cursor:'grab',opacity:pending?0.6:1}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:6,alignItems:'flex-start'}}>
        <span onClick={onOpen} style={{fontWeight:700,fontSize:13.5,cursor:'pointer',lineHeight:1.3}}>{lead.name}</span>
        {days!==null && <span title={days+' days in this stage'} style={{...small,whiteSpace:'nowrap',color:stale?C.amber:C.muted}}>{days}d</span>}
      </div>
      <div style={{...small,marginTop:2}}>{[lead.address,lead.city].filter(Boolean).join(', ')||lead.state}</div>
      <div style={{...small,marginTop:1}}>{[lead.lead_type, d.sell_reason!=='Unknown'&&d.sell_reason, d.timeline!=='Unsure'&&d.timeline&&'timeline '+d.timeline.toLowerCase()].filter(Boolean).join(' · ')}</div>

      {n && (n.lastYou || n.lastSeller) && <div style={{fontSize:11.5,marginTop:6,display:'flex',gap:6,flexWrap:'wrap'}}>
        {n.lastYou && <span>You <b style={{color:C.orange}}>{money(n.lastYou.amount)}</b></span>}
        {n.lastSeller && <span>· Seller <b>{money(n.lastSeller.amount)}</b></span>}
        {n.gap!==null && <span style={{color:n.gap<=0?C.green:C.amber}}>· {n.gap<=0?'agreed':'gap '+money(n.gap)}</span>}
      </div>}
      {cr && !isDeal && stage!=='offer' && <div style={{fontSize:11.5,marginTop:6}}>ARV {money(cr.arv)} · <span style={{color:C.orange}}>offer {money(cr.open)}–{money(cr.walk)}</span></div>}
      {cr && stage==='offer' && <div style={{...small,marginTop:3}}>Walk-away {money(cr.walk)} · ARV {money(cr.arv)}</div>}
      {!cr && ['appointment','offer'].includes(stage) && <div onClick={onAnalyze} style={{fontSize:11.5,marginTop:6,color:C.orange,cursor:'pointer'}}>Run comps →</div>}

      {isDeal &&
      <div style={{background:C.ink,borderRadius:8,padding:'7px 9px',marginTop:7,fontSize:11.5,lineHeight:1.55}}>
        {dl.contract_price ? <div>Contract {money(dl.contract_price)}{dl.fee?<span style={{color:C.green}}> · fee {money(dl.fee)}</span>:''}</div> : <div style={{color:C.amber}}>No contract details yet</div>}
        {(()=>{ const w = d.comp && d.comp.result && d.comp.result.walk; const over = dl.contract_price && w && dl.contract_price>w
          return over ? <div style={{color:C.red,fontWeight:600}} title={dl.lock&&dl.lock.override?'Reason: '+dl.lock.override:''}>⚠ {money(dl.contract_price-w)} over your max{dl.lock&&dl.lock.override?' (overridden)':''}</div> : null })()}
        {dl.buyer && <div style={{color:C.muted}}>Buyer: {dl.buyer}</div>}
        {stage!=='closed' && ci!==null && <div style={{color:ci<0?C.red:ci<=7?C.amber:C.cream,fontWeight:600}}>{ci<0?'Closing overdue by '+(-ci)+'d':ci===0?'Closes today':'Closes '+fmtDate(dl.closing_date)+' ('+ci+'d)'}</div>}
        {stage==='closed' && dl.closing_date && <div style={{color:C.muted}}>Closed {fmtDate(dl.closing_date)}</div>}
      </div>}

      {(stage==='contract'||stage==='assigned') && (()=>{ const c = checklistOf(lead); const dl = c.inspDays; return (
        <div onClick={onDeal} style={{marginTop:7,cursor:'pointer'}} title="Open the close checklist">
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{flex:1,height:5,background:C.ink,borderRadius:5,overflow:'hidden'}}><div style={{width:(c.done/c.total*100)+'%',height:'100%',background:c.done===c.total?C.green:C.orange}}/></div>
            <span style={{fontSize:10.5,color:C.muted}}>{c.done}/{c.total}</span>
          </div>
          {dl!==null && dl>=-3 && stage==='contract' && <div style={{fontSize:11,marginTop:4,fontWeight:600,color:!c.hasBuyer&&dl<=2?C.red:dl<=5?C.amber:C.muted}}>Inspection {dl<0?'ended '+(-dl)+'d ago':dl===0?'ends today':'ends in '+dl+'d'}{!c.hasBuyer?' · no buyer':''}</div>}
        </div>) })()}
      {(stage==='dead'||stage==='nurture') && d.lost && <div style={{...small,marginTop:5}}>{reasonLabel(d.lost.reason)}{d.lost.note?' — '+d.lost.note:''}</div>}
      {plan && !(ns && ns.kind==='offer_fu') && <FollowUpPlan plan={plan} small/>}
      {!['closed','dead'].includes(stage) && <NextStepChip ns={ns} onClick={stage==='nurture'?onOpen:onStep}/>}
      {stale && !ns && <div style={{color:C.amber,fontSize:11,marginTop:6}}>Stale — {days} days in {STAGE[stage].l.toLowerCase()}</div>}

      <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center'}}>
        <select value={stage} onChange={e=>onMove(e.target.value)} onClick={e=>e.stopPropagation()} style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:6,padding:'4px 6px',color:C.muted,fontSize:11}}>
          {STAGES.map(([k,l])=><option key={k} value={k}>{k===stage?l:'Move to: '+l}</option>)}
        </select>
        {['appointment','offer'].includes(stage) && <button onClick={onNego} style={btn(C.orange)}>Offer</button>}
        {isDeal && <button onClick={onDeal} style={btn(C.orange)}>Deal</button>}
      </div>
    </div>
  )
}

const DEAL_FIELDS = [
  ['contract_price','Contract price (what you pay the seller)','number'],
  ['contract_date','Contract signed','date'],
  ['closing_date','Closing date','date'],
  ['emd','Earnest money deposit','number'],
  ['title_company','Title company','text'],
  ['buyer','Cash buyer','text'],
  ['fee','Assignment fee','number'],
]

function DealModal({lead,onClose,onSaved,onChecklist}){
  const cr = compResult(lead)
  const [f,setF] = useState(()=>({ ...Object.fromEntries(DEAL_FIELDS.map(([k])=>[k,''])), notes:'', ...dealOf(lead) }))
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  const num = v => v===''||v===null||v===undefined ? null : (Number(String(v).replace(/[$,]/g,''))||null)

  async function save(){
    setBusy(true); setErr('')
    try{
      const deal = {...f, inspection_end:dealOf(lead).inspection_end||null, contract_price:num(f.contract_price), emd:num(f.emd), fee:num(f.fee)}
      await patchLead(lead, { deal }) // checklist + inspection date are saved on their own, so keep the fresh copy
      await onSaved()
    }catch(e){ setErr(/fetch/i.test(e.message)?"Can't reach the database — try again in a minute.":e.message); setBusy(false) }
  }
  const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 11px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginTop:4,colorScheme:'dark'}
  const spread = num(f.contract_price) && cr ? cr.walk - num(f.contract_price) : null

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Deal details</div>
            <div style={{color:C.muted,fontSize:12.5,marginTop:2}}>{lead.name} · {[lead.address,lead.city].filter(Boolean).join(', ')}</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:C.muted,fontSize:18,cursor:'pointer'}}>✕</button>
        </div>
        {cr && <div style={{background:C.ink,borderRadius:10,padding:'9px 12px',marginTop:12,fontSize:12.5,color:C.muted}}>Comped ARV {money(cr.arv)} · walk-away <span style={{color:C.orange}}>{money(cr.walk)}</span>{spread!==null && <span style={{color:spread>=0?C.green:C.red}}> · contract is {money(Math.abs(spread))} {spread>=0?'under':'over'} your walk-away</span>}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}>
          {DEAL_FIELDS.map(([k,l,t])=>(
            <label key={k} style={{color:C.muted,fontSize:11.5,gridColumn:k==='contract_price'?'1/-1':'auto'}}>{l}
              <input type={t} value={f[k]??''} onChange={e=>setF({...f,[k]:e.target.value})} style={inp}/>
            </label>
          ))}
        </div>
        <div style={{fontWeight:700,fontSize:14,marginTop:18,marginBottom:8}}>Contract to close</div>
        <ClosingChecklist lead={lead} onSaved={onChecklist} compact/>
        <label style={{color:C.muted,fontSize:11.5,display:'block',marginTop:12}}>Notes
          <textarea value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})} rows={2} placeholder="Inspection period, contingencies, access instructions..." style={{...inp,resize:'vertical',fontFamily:'inherit'}}/>
        </label>
        {err && <div style={{marginTop:12,fontSize:12.5,color:C.red}}>{err}</div>}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button onClick={save} disabled={busy} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 22px',fontWeight:800,fontSize:13,cursor:'pointer',opacity:busy?0.7:1}}>{busy?'Saving...':'Save deal'}</button>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:10,padding:'11px 18px',fontSize:13,cursor:'pointer'}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
