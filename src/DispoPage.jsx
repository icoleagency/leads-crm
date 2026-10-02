import { useState, useEffect, useCallback } from 'react'
import { stageOf, STAGE, moveStage, patchLead, money } from './leadModel'
import { parseCsv } from './stacking'
import { BUYER_TYPES, PROP_TYPES, REHAB_LEVELS, RESPONSES, KIND, dispoErr, fetchBuyers, saveBuyer, deleteBuyer, importBuyers,
  fetchBuyerActivity, logBuyer, logBlast, dealStatus, buyerRecord, dispoOf, dealOf, dealNumbers, rehabLevel, matchesFor, blastText, phoneOut } from './dispo'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const cap = {color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:1}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',minWidth:0,fontFamily:'inherit'}
const btn = (p,dis) => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:dis?'default':'pointer',opacity:dis?0.5:1,whiteSpace:'nowrap'})
const chip = (on,col=C.orange) => ({background:on?col:'transparent',color:on?C.ink:C.muted,border:'1px solid '+(on?col:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'})
const Tag = ({c,children}) => <span style={{background:c+'1e',color:c,border:'1px solid '+c+'55',borderRadius:6,padding:'1px 7px',fontSize:10.5,fontWeight:700,whiteSpace:'nowrap'}}>{children}</span>
const errText = e => { const m = dispoErr(e.message); return m==='setup' ? 'Buyers need a one-time database update — run supabase/add-dispo.sql in Supabase.' : m }
const DEAL_STAGES = ['contract','assigned']
const daysUntil = s => { if(!s) return null; const d=new Date(s+'T12:00:00'); return isNaN(d)?null:Math.ceil((d.getTime()-Date.now())/86400000) }
const fmtDay = s => { const d=new Date(s+'T12:00:00'); return isNaN(d)?s:d.toLocaleDateString([], {month:'short',day:'numeric'}) }
async function copy(t){ try{ await navigator.clipboard.writeText(t); return true }catch{ return false } }

export default function DispoPage({leads,activity,reloadLeads,openLead,initialDeal,isMobile}){
  const [tab,setTab] = useState('deals')
  const [buyers,setBuyers] = useState([])
  const [bact,setBact] = useState([])
  const [err,setErr] = useState('')
  const [loaded,setLoaded] = useState(false)
  const load = useCallback(async ()=>{
    try{ const [b,a] = await Promise.all([fetchBuyers(), fetchBuyerActivity()]); setBuyers(b); setBact(a||[]); setErr('') }
    catch(e){ setErr(dispoErr(e.message)) }
    setLoaded(true)
  },[])
  useEffect(()=>{ load() },[load])

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  if(err==='setup') return (
    <div>
      <h1 style={h1}>Buyers & Dispo</h1>
      <div style={{...card,marginTop:20,borderColor:C.amber+'66'}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:14,marginBottom:8}}>One-time setup needed</div>
        <div style={{color:C.cream,fontSize:13.5,lineHeight:1.6}}>Buyers & Dispo needs two new tables. In Supabase open <b>SQL Editor → + New query</b>, paste the SQL from <b>supabase/add-dispo.sql</b>, and hit <b>Run</b>. Then press Retry.</div>
        <button onClick={()=>{ setErr(''); load() }} style={{...btn(true),marginTop:14}}>Retry</button>
      </div>
    </div>
  )
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>Buyers & Dispo</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Match every contract to the right cash buyers, send it out, track offers, and assign it.</p>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[['deals','Deals to sell'],['buyers','Buyers ('+buyers.length.toLocaleString()+')']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={chip(tab===k)}>{l}</button>)}
        </div>
      </div>
      {err && <div style={{...card,marginTop:14,borderColor:C.red+'66',color:C.red,fontSize:13}}>{err} <button onClick={load} style={{...btn(false),marginLeft:8}}>Retry</button></div>}
      {loaded && tab==='deals' && <Deals leads={leads} activity={activity} buyers={buyers} bact={bact} reload={load} reloadLeads={reloadLeads} openLead={openLead} initialDeal={initialDeal} goBuyers={()=>setTab('buyers')} isMobile={isMobile}/>}
      {loaded && tab==='buyers' && <Buyers buyers={buyers} bact={bact} leads={leads} reload={load} isMobile={isMobile}/>}
    </div>
  )
}

// =====================================================================
// DEALS
// =====================================================================
function Deals({leads,activity,buyers,bact,reload,reloadLeads,openLead,initialDeal,goBuyers,isMobile}){
  const [showClosed,setShowClosed] = useState(false)
  const deals = leads.map(l=>({l, st:stageOf(l,activity)})).filter(x=>DEAL_STAGES.includes(x.st) || (showClosed && x.st==='closed'))
    .sort((a,b)=>(daysUntil(dealOf(a.l).closing_date)??999)-(daysUntil(dealOf(b.l).closing_date)??999))
  const [selId,setSelId] = useState(()=>{ const f = deals.find(x=>String(x.l.id)===String(initialDeal)); return f ? f.l.id : (deals[0]&&deals[0].l.id) })
  const sel = deals.find(x=>x.l.id===selId) || deals[0]
  if(!deals.length) return (
    <div style={{...card,marginTop:16,textAlign:'center',padding:34}}>
      <div style={{fontWeight:700,fontSize:16}}>No deals under contract right now</div>
      <div style={{color:C.muted,fontSize:13.5,lineHeight:1.6,maxWidth:520,margin:'8px auto 0'}}>When a lead moves to <b style={{color:C.cream}}>Under contract</b> (on the Pipeline, or by logging "Under contract" on a call), it shows up here ready to market to your buyers.</div>
      <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:14}}>
        <button onClick={goBuyers} style={btn(true)}>Build your buyers list</button>
        <button onClick={()=>setShowClosed(true)} style={btn(false)}>Show closed deals</button>
      </div>
    </div>
  )
  return (
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'280px 1fr',gap:14,marginTop:16,alignItems:'start'}}>
      <div style={{...card,padding:12}}>
        <div style={{...cap,padding:'4px 6px 8px'}}>Under contract — closing soonest first</div>
        {deals.map(({l,st})=>{ const s = dealStatus(bact,l.id), vals = Object.values(s), ci = daysUntil(dealOf(l).closing_date)
          const offers = vals.filter(x=>x.kind==='offer'), best = Math.max(0,...offers.map(o=>o.amount||0)), sent = vals.length
          const on = sel && sel.l.id===l.id
          return (
            <div key={l.id} onClick={()=>setSelId(l.id)} style={{background:on?C.panel2:'transparent',border:'1px solid '+(on?C.orange:'transparent'),borderRadius:12,padding:11,marginBottom:6,cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8}}><b style={{fontSize:13.5}}>{l.address||l.name}</b><Tag c={STAGE[st].c}>{STAGE[st].l}</Tag></div>
              <div style={{color:C.muted,fontSize:11.5,marginTop:2}}>{[l.city,l.state].filter(Boolean).join(', ')}{ci!==null?' · closes in '+ci+'d':''}</div>
              <div style={{fontSize:11.5,marginTop:5,color:st==='assigned'?C.green:offers.length?C.green:sent?C.cream:C.amber}}>
                {st==='assigned' ? 'Assigned to '+(dealOf(l).buyer||'buyer') : offers.length ? offers.length+' offer'+(offers.length===1?'':'s')+(best?' · best '+money(best):'') : sent ? 'Sent to '+sent+' buyer'+(sent===1?'':'s') : 'Not marketed yet'}
              </div>
            </div>
          ) })}
        <label style={{display:'flex',gap:6,alignItems:'center',color:C.muted,fontSize:12,padding:'6px',cursor:'pointer'}}><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)}/>Show closed deals</label>
      </div>
      {sel && <DealDispo key={sel.l.id} lead={sel.l} st={sel.st} buyers={buyers} bact={bact} reload={reload} reloadLeads={reloadLeads} openLead={openLead} goBuyers={goBuyers} isMobile={isMobile}/>}
    </div>
  )
}

function DealDispo({lead,st,buyers,bact,reload,reloadLeads,openLead,goBuyers,isMobile}){
  const n = dealNumbers(lead), dp = dispoOf(lead), dl = dealOf(lead)
  const [editing,setEditing] = useState(!dp.asking && !dl.contract_price)
  const [msg,setMsg] = useState(null)
  const [busy,setBusy] = useState(false)
  const status = dealStatus(bact, lead.id)
  const matched = matchesFor(buyers, lead)
  const matchedIds = new Set(matched.map(x=>x.b.id))
  const extra = buyers.filter(b=>status[b.id] && !matchedIds.has(b.id)).map(b=>({b, m:null}))
  const offers = Object.entries(status).filter(([,s])=>s.kind==='offer'||s.kind==='assigned').map(([id,s])=>({b:buyers.find(x=>String(x.id)===String(id)), s})).filter(x=>x.b).sort((a,b)=>(b.s.amount||0)-(a.s.amount||0))
  const act = async (fn, ok) => { setBusy(true); setMsg(null); try{ await fn(); if(ok) setMsg({ok:true,t:ok}) }catch(e){ setMsg({ok:false,t:errText(e)}) } setBusy(false) }

  async function assign(b, amount){
    const fee = n.contract ? amount - n.contract : null
    if(!confirm('Assign this deal to '+b.name+' at '+money(amount)+'?'+(fee!==null?' Your fee: '+money(fee)+'.':' (Add the contract price to calculate your fee.)'))) return
    await act(async ()=>{
      const deal = {...dl, buyer:b.name+(b.company?' ('+b.company+')':''), buyer_id:b.id, assign_price:amount, ...(fee!==null?{fee}:{})}
      if(st==='assigned') await patchLead(lead, {deal}); else await moveStage(lead, 'assigned', {deal})
      await logBuyer(b.id, lead.id, 'assigned', {amount})
      await Promise.all([reload(), reloadLeads()])
    }, 'Assigned to '+b.name+(fee!==null?' — fee '+money(fee):'')+'. Moved to Assigned in Pipeline.')
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14,minWidth:0}}>
      {msg && <div style={{fontSize:12.5,color:msg.ok?C.green:C.red,background:(msg.ok?C.green:C.red)+'14',border:'1px solid '+(msg.ok?C.green:C.red)+'44',borderRadius:8,padding:'9px 12px'}}>{msg.t}</div>}
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:'Georgia,serif',fontSize:21,fontWeight:600}}>{lead.address||lead.name}</div>
            <div style={{color:C.muted,fontSize:12.5,marginTop:2}}>{[lead.city,lead.state].filter(Boolean).join(', ')} · seller {lead.name} · {rehabLevel(lead).toLowerCase()} rehab{n.closing?' · closes '+fmtDay(n.closing):''}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>openLead(lead.id)} style={btn(false)}>Open lead</button>
            <button onClick={()=>setEditing(!editing)} style={btn(!editing)}>{editing?'Close':'Edit deal sheet'}</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(6,1fr)',gap:8,marginTop:14}}>
          {[['Your contract',n.contract?money(n.contract):'—',C.cream],['Asking buyers',n.asking?money(n.asking):'—',C.orange],['Your spread',n.spread?money(n.spread):'—',n.spread>0?C.green:C.muted],
            ['ARV',n.arv?money(n.arv):'—',C.cream],['Repairs',n.rehab?money(n.rehab):'—',C.cream],['Buyer\'s margin',n.buyerMargin?money(n.buyerMargin):'—',n.buyerMargin>0?C.green:n.buyerMargin<0?C.red:C.muted]]
            .map(([l,v,c])=><div key={l} style={{background:C.ink,borderRadius:10,padding:'9px 11px'}}><div style={cap}>{l}</div><div style={{fontWeight:700,fontSize:15.5,marginTop:3,color:c}}>{v}</div></div>)}
        </div>
        {n.arv>0 && n.asking>0 && n.buyerMargin < n.arv*0.15 && <div style={{color:C.amber,fontSize:12,marginTop:8}}>Heads up: the buyer's margin is under 15% of ARV — flippers may pass at this price.</div>}
        {editing && <DealSheetForm lead={lead} n={n} onSaved={async ()=>{ setEditing(false); await reloadLeads() }}/>}
      </div>

      <Blast lead={lead} matched={matched} status={status} reload={reload} goBuyers={goBuyers} isMobile={isMobile}/>

      {offers.length>0 &&
      <div style={{...card,borderColor:C.green+'55'}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Offers <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— highest first</span></div>
        {offers.map(({b,s})=>{ const fee = n.contract && s.amount ? s.amount-n.contract : null; const done = s.kind==='assigned'
          return <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'8px 0',borderTop:'1px solid '+C.line,flexWrap:'wrap'}}>
            <div style={{minWidth:0}}><b>{b.name}</b>{b.company?<span style={{color:C.muted}}> · {b.company}</span>:null}{b.pof && <span style={{marginLeft:6}}><Tag c={C.green}>POF</Tag></span>}
              <div style={{color:C.muted,fontSize:12}}>{s.note||''}</div></div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{textAlign:'right'}}><div style={{fontWeight:800,fontSize:15,color:C.green}}>{s.amount?money(s.amount):'—'}</div>{fee!==null && <div style={{color:fee>0?C.green:C.red,fontSize:11.5}}>your fee {money(fee)}</div>}</div>
              {done ? <Tag c={C.orange}>Assigned</Tag> : <button disabled={busy||!s.amount} onClick={()=>assign(b, s.amount)} style={btn(true,busy||!s.amount)}>Assign</button>}
            </div>
          </div> })}
      </div>}

      <BuyerResponses lead={lead} list={[...matched, ...extra]} buyers={buyers} status={status} reload={reload} goBuyers={goBuyers} isMobile={isMobile}/>
    </div>
  )
}

function DealSheetForm({lead,n,onSaved}){
  const dp = dispoOf(lead), dl = dealOf(lead)
  const [f,setF] = useState({ contract_price:dl.contract_price||'', closing_date:dl.closing_date||'', asking:dp.asking||n.asking||'', arv:dp.arv||n.arv||'', rehab:dp.rehab||n.rehab||'', emd:dp.emd||'', photos:dp.photos||'', access:dp.access||'', description:dp.description||'' })
  const [busy,setBusy] = useState(false); const [err,setErr] = useState('')
  const num = v => v===''||v===null ? null : (Number(String(v).replace(/[$,\s]/g,''))||null)
  async function save(){
    setBusy(true); setErr('')
    try{
      await patchLead(lead, { deal:{...dl, contract_price:num(f.contract_price), closing_date:f.closing_date||null},
        dispo:{...dp, asking:num(f.asking), arv:num(f.arv), rehab:num(f.rehab), emd:num(f.emd), photos:f.photos.trim(), access:f.access.trim(), description:f.description.trim()} })
      await onSaved()
    }catch(e){ setErr(errText(e)); setBusy(false) }
  }
  const L = ({k,l,type='text',ph}) => <label style={{color:C.muted,fontSize:11.5}}>{l}<input type={type} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} placeholder={ph} style={{...inp,marginTop:3,colorScheme:'dark'}}/></label>
  return (
    <div style={{marginTop:14,background:C.ink,borderRadius:12,padding:14,display:'grid',gap:8}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
        {L({k:'contract_price',l:'Your contract price',type:'number'})}
        {L({k:'asking',l:'Asking price to buyers',type:'number'})}
        {L({k:'arv',l:'ARV',type:'number'})}
        {L({k:'rehab',l:'Repair estimate',type:'number'})}
        {L({k:'emd',l:'Buyer EMD',type:'number',ph:'e.g. 5000'})}
        {L({k:'closing_date',l:'Closing date',type:'date'})}
      </div>
      {L({k:'photos',l:'Photos link',ph:'Google Drive / Dropbox link'})}
      {L({k:'access',l:'Access / showings',ph:'e.g. Lockbox 1234, open house Sat 10–12'})}
      <label style={{color:C.muted,fontSize:11.5}}>Description for buyers<textarea rows={3} value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="e.g. Solid brick ranch, needs roof + kitchen. Comps at $260k on the same street." style={{...inp,marginTop:3,resize:'vertical'}}/></label>
      {err && <div style={{color:C.red,fontSize:12.5}}>{err}</div>}
      <div><button disabled={busy} onClick={save} style={btn(true,busy)}>{busy?'Saving…':'Save deal sheet'}</button></div>
    </div>
  )
}

function Blast({lead,matched,status,reload,goBuyers,isMobile}){
  const [withAddr,setWithAddr] = useState(true)
  const t = blastText(lead, {withAddress:withAddr})
  const [sms,setSms] = useState(t.sms); const [subject,setSubject] = useState(t.subject); const [email,setEmail] = useState(t.email)
  const [onlyNew,setOnlyNew] = useState(true)
  const [msg,setMsg] = useState(null); const [busy,setBusy] = useState(false)
  useEffect(()=>{ const x = blastText(lead,{withAddress:withAddr}); setSms(x.sms); setSubject(x.subject); setEmail(x.email) },[withAddr, lead])
  const targets = matched.filter(x=>!onlyNew || !status[x.b.id]).map(x=>x.b)
  const emails = targets.map(b=>b.email).filter(Boolean)
  const phones = targets.filter(b=>b.phone)
  const mailto = 'mailto:?bcc='+encodeURIComponent(emails.join(','))+'&subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(email)
  const flash = t2 => { setMsg(t2); setTimeout(()=>setMsg(null), 3000) }
  function downloadPhones(){
    const rows = [['Name','Company','Phone','Email'], ...phones.map(b=>[b.name,b.company||'',phoneOut(b.phone),b.email||''])]
    const csv = rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'buyers-'+(lead.address||'deal').replace(/\W+/g,'-')+'.csv'
    document.body.appendChild(a); a.click(); a.remove()
  }
  async function markSent(){
    if(!targets.length) return
    setBusy(true)
    try{ await logBlast(targets.map(b=>b.id), lead.id, 'Deal blast'); await patchLead(lead, { dispo:{...dispoOf(lead), blasted_at:new Date().toISOString(), blast_count:(dispoOf(lead).blast_count||0)+targets.length} }); await reload(); flash('Logged as sent to '+targets.length+' buyers.') }
    catch(e){ flash(errText(e)) }
    setBusy(false)
  }
  if(!matched.length) return (
    <div style={card}>
      <div style={{fontWeight:700,fontSize:14}}>Send it to buyers</div>
      <div style={{color:C.muted,fontSize:13,lineHeight:1.55,marginTop:6}}>No buyers match this deal yet. Add buyers who buy in <b style={{color:C.cream}}>{lead.city||'this area'}</b>{lead.details?.county?' / '+lead.details.county+' County':''} — or leave a buyer's markets blank if they buy anywhere.</div>
      <button onClick={goBuyers} style={{...btn(true),marginTop:10}}>Add buyers</button>
    </div>
  )
  return (
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
        <div style={{fontWeight:700,fontSize:14}}>Send it to buyers <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {targets.length} buyer{targets.length===1?'':'s'} · {emails.length} emails · {phones.length} phones</span></div>
        <div style={{display:'flex',gap:12,fontSize:12,color:C.muted,flexWrap:'wrap'}}>
          <label style={{display:'flex',gap:5,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={onlyNew} onChange={e=>setOnlyNew(e.target.checked)}/>Only buyers not sent yet</label>
          <label style={{display:'flex',gap:5,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={withAddr} onChange={e=>setWithAddr(e.target.checked)}/>Include street address</label>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1.3fr',gap:10,marginTop:10}}>
        <div>
          <div style={{...cap,marginBottom:4}}>Text message</div>
          <textarea rows={8} value={sms} onChange={e=>setSms(e.target.value)} style={{...inp,resize:'vertical',fontSize:12.5,lineHeight:1.45}}/>
          <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
            <button onClick={async()=>flash(await copy(sms)?'Text copied.':'Copy blocked — select the text and copy it.')} style={btn(false)}>Copy text</button>
            <button disabled={!phones.length} onClick={downloadPhones} style={btn(false,!phones.length)}>Download {phones.length} phones (CSV)</button>
          </div>
        </div>
        <div>
          <div style={{...cap,marginBottom:4}}>Email</div>
          <input value={subject} onChange={e=>setSubject(e.target.value)} style={{...inp,marginBottom:6,fontSize:12.5}}/>
          <textarea rows={6} value={email} onChange={e=>setEmail(e.target.value)} style={{...inp,resize:'vertical',fontSize:12.5,lineHeight:1.45}}/>
          <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
            {emails.length>0 && mailto.length<1900 ? <a href={mailto} style={{...btn(true),textDecoration:'none'}}>Email {emails.length} buyers (BCC)</a>
              : <button disabled={!emails.length} onClick={async()=>flash(await copy(emails.join(', '))?emails.length+' emails copied — paste into BCC.':'Copy blocked.')} style={btn(true,!emails.length)}>Copy {emails.length} emails for BCC</button>}
            <button onClick={async()=>flash(await copy(subject+'\n\n'+email)?'Email copied.':'Copy blocked.')} style={btn(false)}>Copy email</button>
          </div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:12,paddingTop:10,borderTop:'1px solid '+C.line,flexWrap:'wrap'}}>
        <span style={{color:C.muted,fontSize:12}}>{dispoOf(lead).blasted_at?'Last sent '+new Date(dispoOf(lead).blasted_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. ':''}After you send it, log it so you can track who's seen the deal.</span>
        <button disabled={busy||!targets.length} onClick={markSent} style={btn(true,busy||!targets.length)}>Mark sent to {targets.length}</button>
      </div>
      {msg && <div style={{color:C.green,fontSize:12.5,marginTop:8}}>{msg}</div>}
    </div>
  )
}

function BuyerResponses({lead,list,buyers,status,reload,goBuyers,isMobile}){
  const [offerFor,setOfferFor] = useState(null)
  const [amount,setAmount] = useState('')
  const [note,setNote] = useState('')
  const [busy,setBusy] = useState(false)
  const [q,setQ] = useState('')
  const [showAll,setShowAll] = useState(false)
  const shownIds = new Set(list.map(x=>x.b.id))
  const search = q.trim().toLowerCase()
  const found = search ? buyers.filter(b=>!shownIds.has(b.id) && [b.name,b.company,b.phone,b.email].some(v=>String(v||'').toLowerCase().includes(search))).slice(0,5).map(b=>({b,m:null})) : []
  const rows = [...found, ...list]
  const visible = showAll ? rows : rows.slice(0,25)
  async function mark(b, kind, amt){
    setBusy(true)
    try{ await logBuyer(b.id, lead.id, kind, {amount:amt, note}); setOfferFor(null); setAmount(''); setNote(''); await reload() }catch{ /* stays as is */ }
    setBusy(false)
  }
  return (
    <div style={card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
        <div style={{fontWeight:700,fontSize:14}}>Buyers for this deal <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— best match first</span></div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find any buyer who called in…" style={{...inp,width:isMobile?'100%':240,fontSize:12.5,padding:'6px 9px'}}/>
      </div>
      {rows.length===0 && <div style={{color:C.muted,fontSize:13}}>No matching buyers. <span onClick={goBuyers} style={{color:C.orange,cursor:'pointer'}}>Add buyers →</span></div>}
      {visible.map(({b,m})=>{ const s = status[b.id]; const k = s && KIND[s.kind]
        return (
          <div key={b.id} style={{padding:'9px 0',borderTop:'1px solid '+C.line}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:isMobile?'wrap':'nowrap'}}>
              <div style={{minWidth:0}}>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><b style={{fontSize:13.5}}>{b.name}</b>{b.company && <span style={{color:C.muted,fontSize:12}}>{b.company}</span>}{k && <Tag c={k[1]}>{k[0]}{s.amount?' '+money(s.amount):''}</Tag>}{!m && <Tag c={C.muted}>not a match</Tag>}</div>
                <div style={{fontSize:12,marginTop:2}}>{b.phone && <a href={'tel:'+String(b.phone).replace(/[^\d+]/g,'')} style={{color:C.green,textDecoration:'none',marginRight:8}}>{phoneOut(b.phone)}</a>}{b.email && <span style={{color:C.muted}}>{b.email}</span>}</div>
                {m && <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>{m.reasons.map(([key,t,ok])=><span key={key} style={{fontSize:10.5,color:ok?C.green:C.amber}}>{ok?'✓':'!'} {t}</span>)}</div>}
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>
                {RESPONSES.map(([kind,label,col])=><button key={kind} disabled={busy} onClick={()=> kind==='offer' ? setOfferFor(offerFor===b.id?null:b.id) : mark(b,kind)} style={{...chip(s&&s.kind===kind,col),padding:'3px 8px',fontSize:11}}>{label}</button>)}
              </div>
            </div>
            {offerFor===b.id &&
            <div style={{display:'flex',gap:6,marginTop:7,flexWrap:'wrap'}}>
              <input autoFocus type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Their price ($)" style={{...inp,width:150}}/>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optional) — e.g. closes in 10 days, cash" style={{...inp,flex:1,minWidth:160}}/>
              <button disabled={busy||!Number(amount)} onClick={()=>mark(b,'offer',amount)} style={btn(true,busy||!Number(amount))}>Save offer</button>
            </div>}
          </div>
        ) })}
      {rows.length>25 && <span onClick={()=>setShowAll(!showAll)} style={{color:C.muted,fontSize:12,cursor:'pointer'}}>{showAll?'Show fewer':'Show all '+rows.length}</span>}
    </div>
  )
}

// =====================================================================
// BUYERS
// =====================================================================
const BLANK_BUYER = { name:'', company:'', phone:'', email:'', buyer_type:'Flipper', markets:'', property_types:['Single family'], min_price:'', max_price:'', rehab:[], financing:'Cash', pof:false, pof_date:'', tags:'', notes:'', status:'active', source:'' }
const FINANCING = ['Cash','Hard money','Private money','Conventional']

function Buyers({buyers,bact,leads,reload,isMobile}){
  const [q,setQ] = useState('')
  const [mkt,setMkt] = useState('')
  const [type,setType] = useState('')
  const [pofOnly,setPofOnly] = useState(false)
  const [edit,setEdit] = useState(null)        // buyer object or BLANK
  const [showImport,setShowImport] = useState(false)
  const [limit,setLimit] = useState(100)
  const markets = [...new Set(buyers.flatMap(b=>b.markets||[]))].sort((a,b)=>a.localeCompare(b))
  const s = q.trim().toLowerCase()
  const list = buyers.filter(b=>(!s || [b.name,b.company,b.phone,b.email,(b.tags||[]).join(' ')].some(v=>String(v||'').toLowerCase().includes(s)))
    && (!mkt || (b.markets||[]).includes(mkt)) && (!type || b.buyer_type===type) && (!pofOnly || b.pof))
  const withPof = buyers.filter(b=>b.pof).length
  const leadName = id => (leads.find(l=>String(l.id)===String(id))||{}).address
  return (
    <div style={{marginTop:16}}>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10}}>
        {[['Buyers',buyers.length],['With proof of funds',withPof],['Active',buyers.filter(b=>b.status!=='dnc').length],['Bought from you',new Set(bact.filter(a=>a.kind==='assigned').map(a=>a.buyer_id)).size]]
          .map(([l,v])=><div key={l} style={{...card,padding:'12px 14px'}}><div style={cap}>{l}</div><div style={{fontSize:22,fontWeight:700,fontFamily:'Georgia,serif',marginTop:3}}>{v.toLocaleString()}</div></div>)}
      </div>
      <div style={{...card,marginTop:12,padding:14}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, company, phone, email, tag" style={{...inp,flex:2,minWidth:180}}/>
          <select value={mkt} onChange={e=>setMkt(e.target.value)} style={{...inp,flex:1,minWidth:130}}><option value="">All markets</option>{markets.map(m=><option key={m}>{m}</option>)}</select>
          <select value={type} onChange={e=>setType(e.target.value)} style={{...inp,flex:1,minWidth:130}}><option value="">All buyer types</option>{BUYER_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          <label style={{display:'flex',gap:6,alignItems:'center',color:C.muted,fontSize:12.5,cursor:'pointer'}}><input type="checkbox" checked={pofOnly} onChange={e=>setPofOnly(e.target.checked)}/>Proof of funds</label>
          <button onClick={()=>{ setEdit({...BLANK_BUYER}); setShowImport(false) }} style={btn(true)}>+ Add buyer</button>
          <button onClick={()=>{ setShowImport(!showImport); setEdit(null) }} style={btn(false)}>Import CSV</button>
        </div>
      </div>
      {showImport && <BuyerImport buyers={buyers} reload={reload} onDone={()=>setShowImport(false)} isMobile={isMobile}/>}
      {edit && !edit.id && <BuyerForm b={edit} reload={reload} onDone={()=>setEdit(null)} isMobile={isMobile}/>}
      <div style={{...card,marginTop:12,padding:0,overflow:'hidden'}}>
        {list.length===0 && <div style={{padding:22,color:C.muted,fontSize:13}}>{buyers.length ? 'No buyers match these filters.' : 'No buyers yet. Add your cash buyers one by one, or import a CSV (a PropStream cash-buyer export, your buyers spreadsheet, etc.).'}</div>}
        {list.slice(0,limit).map(b=>{ const r = buyerRecord(bact, b.id); const open = edit && edit.id===b.id
          return (
            <div key={b.id} style={{borderTop:'1px solid '+C.line,background:open?C.panel2:'transparent'}}>
              <div onClick={()=>setEdit(open?null:b)} style={{padding:'11px 16px',cursor:'pointer',display:isMobile?'block':'grid',gridTemplateColumns:'1.3fr 1.2fr 1fr .9fr',gap:12,alignItems:'center'}}>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><b style={{fontSize:13.5}}>{b.name}</b>{b.pof && <Tag c={C.green}>POF</Tag>}{b.status==='dnc' && <Tag c={C.red}>Do not contact</Tag>}{(b.tags||[]).map(t=><Tag key={t} c={C.blue}>{t}</Tag>)}</div>
                  <div style={{color:C.muted,fontSize:12}}>{[b.company,b.buyer_type].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{fontSize:12,minWidth:0,marginTop:isMobile?4:0}}>
                  <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(b.markets||[]).length?b.markets.join(', '):<span style={{color:C.muted}}>Buys anywhere</span>}</div>
                  <div style={{color:C.muted}}>{b.min_price||b.max_price?(b.min_price?money(b.min_price):'$0')+'–'+(b.max_price?money(b.max_price):'any'):'Any price'}{(b.rehab||[]).length?' · '+b.rehab.join('/').toLowerCase():''}</div>
                </div>
                <div style={{fontSize:12,marginTop:isMobile?4:0}}>{b.phone && <div style={{color:C.green}}>{phoneOut(b.phone)}</div>}{b.email && <div style={{color:C.muted,overflow:'hidden',textOverflow:'ellipsis'}}>{b.email}</div>}</div>
                <div style={{fontSize:12,textAlign:isMobile?'left':'right',color:C.muted,marginTop:isMobile?4:0}}>{r.deals?<>{r.deals} deal{r.deals===1?'':'s'} sent · {r.offers} offer{r.offers===1?'':'s'}{r.bought?<div style={{color:C.orange,fontWeight:700}}>Bought {r.bought}</div>:null}</>:'No deals sent yet'}</div>
              </div>
              {open && <div style={{padding:'0 16px 14px'}}>
                {r.deals>0 && <div style={{fontSize:12,color:C.muted,marginBottom:8}}>History: {[...new Set(bact.filter(a=>a.buyer_id===b.id).map(a=>a.lead_id))].map(id=>{ const last = bact.find(a=>a.buyer_id===b.id && a.lead_id===id); return (leadName(id)||'deal')+' — '+(KIND[last.kind]?.[0]||last.kind)+(last.amount?' '+money(last.amount):'') }).join(' · ')}</div>}
                <BuyerForm b={b} reload={reload} onDone={()=>setEdit(null)} isMobile={isMobile}/>
              </div>}
            </div>
          ) })}
        {list.length>limit && <div style={{padding:12,textAlign:'center'}}><button onClick={()=>setLimit(limit+200)} style={btn(false)}>Show more ({(list.length-limit).toLocaleString()} left)</button></div>}
      </div>
    </div>
  )
}

function BuyerForm({b,reload,onDone,isMobile}){
  const txt = v => Array.isArray(v) ? v.join(', ') : (v||'')
  const [f,setF] = useState({...BLANK_BUYER, ...b, markets:txt(b.markets), tags:txt(b.tags), rehab:Array.isArray(b.rehab)?b.rehab:[], property_types:Array.isArray(b.property_types)?b.property_types:[], min_price:b.min_price??'', max_price:b.max_price??'', pof_date:b.pof_date||''})
  const [busy,setBusy] = useState(false); const [err,setErr] = useState('')
  const set = (k,v) => setF(x=>({...x,[k]:v}))
  const toggle = (k,v) => set(k, (f[k]||[]).includes(v) ? f[k].filter(x=>x!==v) : [...(f[k]||[]), v])
  async function save(){
    if(!f.name.trim()){ setErr('Add a name.'); return }
    setBusy(true); setErr('')
    try{ await saveBuyer({...f, markets:f.markets.split(','), tags:f.tags.split(',')}); await reload(); onDone() }
    catch(e){ setErr(errText(e)); setBusy(false) }
  }
  async function remove(){
    if(!confirm('Delete '+b.name+'? Their deal history goes too.')) return
    setBusy(true); try{ await deleteBuyer(b.id); await reload(); onDone() }catch(e){ setErr(errText(e)); setBusy(false) }
  }
  const lab = {color:C.muted,fontSize:11.5}
  return (
    <div style={{...card,background:C.ink,marginTop:b.id?0:12,borderColor:C.orange+'55'}}>
      {!b.id && <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>New buyer</div>}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:8}}>
        <label style={lab}>Name<input value={f.name} onChange={e=>set('name',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Company<input value={f.company||''} onChange={e=>set('company',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Phone<input value={f.phone||''} onChange={e=>set('phone',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Email<input value={f.email||''} onChange={e=>set('email',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Buyer type<select value={f.buyer_type||''} onChange={e=>set('buyer_type',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}>{BUYER_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label style={lab}>Min price<input type="number" value={f.min_price} onChange={e=>set('min_price',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Max price<input type="number" value={f.max_price} onChange={e=>set('max_price',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Financing<select value={f.financing||'Cash'} onChange={e=>set('financing',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}>{FINANCING.map(t=><option key={t}>{t}</option>)}</select></label>
      </div>
      <label style={{...lab,display:'block',marginTop:8}}>Markets they buy in — counties, cities or zips, comma separated (leave blank = anywhere)
        <input value={f.markets} onChange={e=>set('markets',e.target.value)} placeholder="e.g. Burlington, Camden, Mount Holly, 08060" style={{...inp,marginTop:3,background:C.panel}}/></label>
      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:10}}>
        <div><div style={{...lab,marginBottom:4}}>Rehab they'll take on</div><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{REHAB_LEVELS.map(r=><button key={r} type="button" onClick={()=>toggle('rehab',r)} style={chip((f.rehab||[]).includes(r),C.amber)}>{r}</button>)}</div></div>
        <div><div style={{...lab,marginBottom:4}}>Property types</div><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{PROP_TYPES.map(r=><button key={r} type="button" onClick={()=>toggle('property_types',r)} style={chip((f.property_types||[]).includes(r),C.blue)}>{r}</button>)}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'auto 1fr 1fr',gap:10,marginTop:10,alignItems:'end'}}>
        <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12.5,color:C.cream,cursor:'pointer',paddingBottom:8}}><input type="checkbox" checked={!!f.pof} onChange={e=>set('pof',e.target.checked)}/>Proof of funds on file{f.pof && <input type="date" value={f.pof_date} onChange={e=>set('pof_date',e.target.value)} style={{...inp,width:150,padding:'5px 8px',background:C.panel,colorScheme:'dark'}}/>}</label>
        <label style={lab}>Tags (comma separated)<input value={f.tags} onChange={e=>set('tags',e.target.value)} placeholder="e.g. VIP, fast closer" style={{...inp,marginTop:3,background:C.panel}}/></label>
        <label style={lab}>Status<select value={f.status} onChange={e=>set('status',e.target.value)} style={{...inp,marginTop:3,background:C.panel}}><option value="active">Active</option><option value="dnc">Do not contact</option></select></label>
      </div>
      <label style={{...lab,display:'block',marginTop:8}}>Notes<textarea rows={2} value={f.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="What they like, how fast they close, who to talk to…" style={{...inp,marginTop:3,background:C.panel,resize:'vertical'}}/></label>
      {err && <div style={{color:C.red,fontSize:12.5,marginTop:8}}>{err}</div>}
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button disabled={busy} onClick={save} style={btn(true,busy)}>{busy?'Saving…':b.id?'Save changes':'Add buyer'}</button>
        <button onClick={onDone} style={btn(false)}>Cancel</button>
        {b.id && <button disabled={busy} onClick={remove} style={{...btn(false,busy),marginLeft:'auto',color:C.red,borderColor:C.red+'55'}}>Delete</button>}
      </div>
    </div>
  )
}

// CSV import with simple column matching
const nh = h => String(h||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const BCOLS = {
  name:[/^(full |buyer |contact |owner( 1)? )?(full )?name$/, /^buyer$/, /^contact$/],
  first:[/^(owner( 1)? |contact )?first( name)?$/], last:[/^(owner( 1)? |contact )?last( name)?$/],
  company:[/company|entity|llc|business|organization/],
  phone:[/^(primary |mobile |cell |contact )?(phone|mobile|cell)( ?1)?( number)?$/], email:[/^(primary |contact )?e ?mail( ?1)?( address)?$/],
  markets:[/^(markets?|areas?|counties|county|target (areas?|markets?)|buy box)$/],
  min:[/^min( price)?$/,/^price min$/], max:[/^max( price)?$/,/^price max$/,/^budget$/],
  type:[/^(buyer )?type$/,/^strategy$/], notes:[/^notes?$/,/^comments?$/],
}
function BuyerImport({buyers,reload,onDone,isMobile}){
  const [parsed,setParsed] = useState(null)
  const [map,setMap] = useState({})
  const [defMarkets,setDefMarkets] = useState('')
  const [defType,setDefType] = useState('Flipper')
  const [msg,setMsg] = useState(null)
  const [busy,setBusy] = useState(false)
  async function pick(e){
    const fl = e.target.files && e.target.files[0]; if(!fl) return
    setMsg(null)
    try{
      const r = await parseCsv(fl); if(!r.rows.length) throw new Error('That file has no rows.')
      const m = {}, used = new Set()
      for(const [k,res] of Object.entries(BCOLS)){ const h = r.headers.find(h=>!used.has(h) && res.some(re=>re.test(nh(h)))); if(h){ m[k]=h; used.add(h) } }
      setParsed(r); setMap(m)
    }catch(er){ setMsg({ok:false,t:"Couldn't read that file: "+er.message}) }
  }
  const rows = parsed ? parsed.rows.map(r=>{ const g = k => map[k] ? String(r[map[k]]??'').trim() : ''
    return { name:g('name')||[g('first'),g('last')].filter(Boolean).join(' ')||g('company'), company:g('company'), phone:g('phone'), email:g('email'),
      markets:(g('markets')||defMarkets).split(/[,;|]/), min_price:g('min'), max_price:g('max'), buyer_type:g('type')||defType, notes:g('notes'), source:'CSV import' } }).filter(r=>r.name) : []
  async function go(){
    setBusy(true); setMsg({ok:true,t:'Importing…'})
    try{ const r = await importBuyers(rows, buyers, t=>setMsg({ok:true,t})); await reload(); setMsg({ok:true,t:'Added '+r.added+' buyers'+(r.dupes?' · skipped '+r.dupes+' already on your list (same phone or email)':'')+'.'}); setParsed(null) }
    catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy(false)
  }
  const sel = k => <select value={map[k]||''} onChange={e=>setMap({...map,[k]:e.target.value||undefined})} style={{...inp,padding:'6px 8px',fontSize:12,background:C.panel}}><option value="">— none —</option>{parsed.headers.map(h=><option key={h}>{h}</option>)}</select>
  return (
    <div style={{...card,marginTop:12,borderColor:C.orange+'55'}}>
      <div style={{fontWeight:700,fontSize:14}}>Import buyers from a CSV</div>
      <div style={{color:C.muted,fontSize:12.5,marginTop:4,lineHeight:1.5}}>Your buyers spreadsheet, a PropStream cash-buyer export, etc. Duplicates (same phone or email) are skipped.</div>
      <label style={{display:'inline-block',...btn(!parsed),marginTop:10,cursor:'pointer'}}>{parsed?'Choose a different file':'Choose CSV file'}<input type="file" accept=".csv,text/csv" onChange={pick} style={{display:'none'}}/></label>
      {parsed && <div style={{marginTop:12}}>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:8}}>
          {[['name','Full name'],['first','First name'],['last','Last name'],['company','Company'],['phone','Phone'],['email','Email'],['markets','Markets'],['min','Min price'],['max','Max price'],['type','Buyer type']].map(([k,l])=><label key={k} style={{color:C.muted,fontSize:11}}>{l}{sel(k)}</label>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:8,marginTop:8}}>
          <label style={{color:C.muted,fontSize:11.5}}>Markets for everyone in this file (if no markets column)<input value={defMarkets} onChange={e=>setDefMarkets(e.target.value)} placeholder="e.g. Burlington, Camden" style={{...inp,marginTop:3}}/></label>
          <label style={{color:C.muted,fontSize:11.5}}>Buyer type (if no type column)<select value={defType} onChange={e=>setDefType(e.target.value)} style={{...inp,marginTop:3}}>{BUYER_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        </div>
        <div style={{marginTop:10,fontSize:12.5,color:C.cream}}>{rows.length.toLocaleString()} buyers ready. Preview:</div>
        {rows.slice(0,3).map((r,i)=><div key={i} style={{fontSize:12,color:C.muted,marginTop:2}}>{r.name}{r.company?' · '+r.company:''}{r.phone?' · '+r.phone:''}{r.email?' · '+r.email:''}{r.markets.filter(x=>x.trim()).length?' · '+r.markets.join(','):''}</div>)}
        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button disabled={busy||!rows.length} onClick={go} style={btn(true,busy||!rows.length)}>{busy?'Importing…':'Import '+rows.length.toLocaleString()+' buyers'}</button>
          <button onClick={onDone} style={btn(false)}>Close</button>
        </div>
      </div>}
      {msg && <div style={{marginTop:10,fontSize:12.5,color:msg.ok?C.green:C.red}}>{msg.t}</div>}
    </div>
  )
}
