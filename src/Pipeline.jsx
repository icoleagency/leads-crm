import { useState } from 'react'
import { STAGES, STAGE, STALE_DAYS, stageOf, stageSince, daysSince, compResult, detailsOf, moveStage, patchLead, money } from './leadModel'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const DEAL_STAGES = ['contract','assigned','closed']
const DEFAULT_FEE = 15000
const BOARD = STAGES.filter(([k])=>k!=='dead')

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
  const [deal,setDeal] = useState(null)        // lead being edited in the deal modal
  const [err,setErr] = useState('')

  const withStage = leads.map(l=>({ l, s: local[l.id] || stageOf(l, activity) }))
  const inStage = k => withStage.filter(x=>x.s===k).map(x=>x.l)
    .sort((a,b)=>new Date(stageSince(a,activity)||0)-new Date(stageSince(b,activity)||0))

  async function move(lead, stage){
    if((local[lead.id]||stageOf(lead,activity))===stage) return
    setLocal(m=>({...m,[lead.id]:stage})); setErr('')
    try{
      await moveStage(lead, stage)
      await reload()
    }catch(e){ setErr(/fetch/i.test(e.message)?"Couldn't save that move — the database isn't reachable. Try again in a minute.":e.message) }
    setLocal(m=>{ const n={...m}; delete n[lead.id]; return n })
    if(DEAL_STAGES.includes(stage) && !dealOf(lead).contract_price && stage==='contract') setDeal(lead)
  }

  const active = withStage.filter(x=>!['closed','dead'].includes(x.s))
  const underContract = withStage.filter(x=>['contract','assigned'].includes(x.s)).map(x=>x.l)
  const projected = underContract.reduce((s,l)=>s+feeOf(l).v,0)
  const anyEst = underContract.some(l=>feeOf(l).est)
  const closed = inStage('closed')
  const closedFees = closed.reduce((s,l)=>s+(Number(dealOf(l).fee)||0),0)
  const staleCount = active.filter(x=>{ const t=STALE_DAYS[x.s]; const dd=daysSince(stageSince(x.l,activity)); return t && dd!==null && dd>t }).length

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const tile = {background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'13px 15px',minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}

  const column = ([k,label,color]) => {
    const items = inStage(k)
    const fees = ['contract','assigned','closed'].includes(k) ? items.reduce((s,l)=>s+(k==='closed'?(Number(dealOf(l).fee)||0):feeOf(l).v),0) : 0
    return (
      <div key={k}
        onDragOver={e=>{ e.preventDefault(); setOver(k) }}
        onDragLeave={()=>setOver(o=>o===k?null:o)}
        onDrop={e=>{ e.preventDefault(); setOver(null); const id=e.dataTransfer.getData('text/plain'); const l=leads.find(x=>String(x.id)===id); if(l) move(l,k) }}
        style={{flex:'0 0 '+(isMobile?'80vw':'228px'),background:over===k?C.panel2:C.ink,border:'1px solid '+(over===k?color:C.line),borderRadius:14,padding:10,display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 290px)',minHeight:220}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 4px 10px',borderBottom:'2px solid '+color,marginBottom:8}}>
          <span style={{fontWeight:700,fontSize:13}}>{label}</span>
          <span style={{color:C.muted,fontSize:12}}>{items.length}{fees?' · '+money(fees):''}</span>
        </div>
        <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:8,paddingRight:2}}>
          {items.length===0 && <div style={{color:C.muted,fontSize:12,padding:'10px 4px',textAlign:'center'}}>{over===k?'Drop here':'—'}</div>}
          {items.map(l=><Card key={l.id} lead={l} stage={k} activity={activity} onMove={s=>move(l,s)} onOpen={()=>openLead(l.id)} onDeal={()=>setDeal(l)} onAnalyze={()=>analyze(l.id)} pending={!!local[l.id]}/>)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>Pipeline</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Drag deals between stages{isMobile?' (or use Move to)':''}. Logging a call outcome on a lead moves it here automatically.</p>
        </div>
        <button onClick={()=>setShowDead(!showDead)} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:20,padding:'6px 13px',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>{showDead?'Hide':'Show'} dead ({inStage('dead').length})</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginTop:16}}>
        <div style={tile}><div style={cap}>Active deals</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{active.length}</div><div style={{color:staleCount?C.amber:C.muted,fontSize:11,marginTop:2}}>{staleCount?staleCount+' need attention':'nothing stale'}</div></div>
        <div style={tile}><div style={cap}>Under contract</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{underContract.length}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>contract + assigned</div></div>
        <div style={tile}><div style={cap}>Projected fees</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4,color:C.orange}}>{money(projected)}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{anyEst?'includes $15k estimates':'from entered fees'}</div></div>
        <div style={tile}><div style={cap}>Closed fees</div><div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4,color:C.green}}>{money(closedFees)}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{closed.length} closed deal{closed.length===1?'':'s'}</div></div>
      </div>

      {err && <div style={{marginTop:12,fontSize:12.5,color:C.red,background:C.red+'14',border:'1px solid '+C.red+'44',borderRadius:8,padding:'9px 12px'}}>{err}</div>}

      {leads.length===0 ?
      <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:30,marginTop:16,color:C.muted,textAlign:'center'}}>No leads yet — add some on the Leads page and they'll show up here.</div> :
      <div style={{display:'flex',gap:12,overflowX:'auto',marginTop:16,paddingBottom:10,scrollSnapType:isMobile?'x mandatory':'none'}}>
        {BOARD.map(column)}
        {showDead && column(STAGES.find(s=>s[0]==='dead'))}
      </div>}

      {deal && <DealModal lead={deal} onClose={()=>setDeal(null)} onSaved={async()=>{ setDeal(null); await reload() }}/>}
    </div>
  )
}

function Card({lead,stage,activity,onMove,onOpen,onDeal,onAnalyze,pending}){
  const cr = compResult(lead)
  const d = detailsOf(lead)
  const dl = dealOf(lead)
  const days = daysSince(stageSince(lead,activity))
  const stale = STALE_DAYS[stage] && days!==null && days>STALE_DAYS[stage]
  const ci = closingIn(lead)
  const isDeal = DEAL_STAGES.includes(stage)
  const small = {color:C.muted,fontSize:11}
  return (
    <div draggable onDragStart={e=>{ e.dataTransfer.setData('text/plain',String(lead.id)); e.dataTransfer.effectAllowed='move' }}
      style={{background:C.panel,border:'1px solid '+(stale?C.amber+'88':C.line),borderRadius:10,padding:11,cursor:'grab',opacity:pending?0.6:1}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:6,alignItems:'flex-start'}}>
        <span onClick={onOpen} style={{fontWeight:700,fontSize:13.5,cursor:'pointer',lineHeight:1.3}}>{lead.name}</span>
        {days!==null && <span style={{...small,whiteSpace:'nowrap',color:stale?C.amber:C.muted}}>{days}d</span>}
      </div>
      <div style={{...small,marginTop:2}}>{[lead.address,lead.city].filter(Boolean).join(', ')||lead.state}</div>
      <div style={{...small,marginTop:1}}>{lead.lead_type}{d.asking_price?' · asks '+money(d.asking_price):''}</div>

      {cr && !isDeal && <div style={{fontSize:11.5,marginTop:6}}>ARV {money(cr.arv)} · <span style={{color:C.orange}}>offer {money(cr.open)}–{money(cr.walk)}</span></div>}
      {!cr && ['appointment','offer'].includes(stage) && <div onClick={onAnalyze} style={{fontSize:11.5,marginTop:6,color:C.orange,cursor:'pointer'}}>Run comps →</div>}

      {isDeal &&
      <div style={{background:C.ink,borderRadius:8,padding:'7px 9px',marginTop:7,fontSize:11.5,lineHeight:1.55}}>
        {dl.contract_price ? <div>Contract {money(dl.contract_price)}{dl.fee?<span style={{color:C.green}}> · fee {money(dl.fee)}</span>:''}</div> : <div style={{color:C.amber}}>No contract details yet</div>}
        {dl.buyer && <div style={{color:C.muted}}>Buyer: {dl.buyer}</div>}
        {stage!=='closed' && ci!==null && <div style={{color:ci<0?C.red:ci<=7?C.amber:C.cream,fontWeight:600}}>{ci<0?'Closing overdue by '+(-ci)+'d':ci===0?'Closes today':'Closes '+fmtDate(dl.closing_date)+' ('+ci+'d)'}</div>}
        {stage==='closed' && dl.closing_date && <div style={{color:C.muted}}>Closed {fmtDate(dl.closing_date)}</div>}
      </div>}

      {stale && <div style={{color:C.amber,fontSize:11,marginTop:6}}>Stale — {days} days in {STAGE[stage].l.toLowerCase()}</div>}

      <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center'}}>
        <select value={stage} onChange={e=>onMove(e.target.value)} onClick={e=>e.stopPropagation()} style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:6,padding:'4px 6px',color:C.muted,fontSize:11}}>
          {STAGES.map(([k,l])=><option key={k} value={k}>{k===stage?l:'Move to: '+l}</option>)}
        </select>
        {isDeal && <button onClick={onDeal} style={{background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Deal</button>}
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

function DealModal({lead,onClose,onSaved}){
  const cr = compResult(lead)
  const [f,setF] = useState(()=>({ ...Object.fromEntries(DEAL_FIELDS.map(([k])=>[k,''])), notes:'', ...dealOf(lead) }))
  const [busy,setBusy] = useState(false)
  const [err,setErr] = useState('')
  const num = v => v===''||v===null||v===undefined ? null : (Number(String(v).replace(/[$,]/g,''))||null)

  async function save(){
    setBusy(true); setErr('')
    try{
      const deal = {...f, contract_price:num(f.contract_price), emd:num(f.emd), fee:num(f.fee)}
      await patchLead(lead, { deal })
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
