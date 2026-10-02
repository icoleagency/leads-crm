import { useState, useEffect } from 'react'
import { STAGE, STALE_DAYS, stageOf, stageSince, daysSince, patchLead, money, callbackOf, callbackState, fmtWhen } from './leadModel'
import { campaignOf, openHandoff } from './team'
import { fetchReports, localDate, liveStatus, dayStats, agoText } from './vaTools'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}
const btn = p => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'})
const dealOf = l => (l.details && l.details.deal) || {}
const daysUntil = s => { if(!s) return null; const d = new Date(s+'T12:00:00'); return isNaN(d) ? null : Math.ceil((d.getTime()-Date.now())/86400000) }
const fmtDay = s => { const d=new Date(s+'T12:00:00'); return isNaN(d)?s:d.toLocaleDateString([], {month:'short',day:'numeric'}) }
const hoursAgo = iso => Math.floor((Date.now()-new Date(iso).getTime())/3600000)
const waited = iso => { const h=hoursAgo(iso); return h<1?'just now':h<24?h+'h':Math.floor(h/24)+'d '+(h%24)+'h' }

export default function TodayPage({leads,activity,team,campaigns,reload,openLead,openDispo,goTo,isMobile}){
  const [reports,setReports] = useState([])
  const [replyFor,setReplyFor] = useState(null)
  const [replyText,setReplyText] = useState('')
  const [busy,setBusy] = useState(null)
  useEffect(()=>{ fetchReports(3).then(r=>setReports(r||[])).catch(()=>setReports([])) },[])
  useEffect(()=>{ const t = setInterval(()=>reload(), 60000); return ()=>clearInterval(t) },[reload])

  const lastTouch = {}
  for(const a of activity){ if(!lastTouch[a.lead_id]) lastTouch[a.lead_id] = a.created_at }
  const withStage = leads.map(l=>({ l, st:stageOf(l,activity) }))

  // ---------- 1. needs you now ----------
  const handoffs = leads.filter(l=>openHandoff(l)).sort((a,b)=>new Date(a.details.handoff.at)-new Date(b.details.handoff.at))
  const callbacks = withStage.map(({l,st})=>({ l, st, cb:callbackOf(l) })).filter(x=>{ const s=callbackState(x.cb); return (s==='overdue'||s==='today') && !['closed','dead'].includes(x.st) })
    .sort((a,b)=>new Date(a.cb.at)-new Date(b.cb.at))

  async function handled(l){
    setBusy(l.id)
    try{ await patchLead(l,{handoff:{...l.details.handoff,status:'done',done_at:new Date().toISOString(),reply:replyText.trim()||null}}); await reload() }catch{ /* stays open */ }
    setBusy(null); setReplyFor(null); setReplyText('')
  }

  // ---------- 2. deals slipping ----------
  const slipping = []
  for(const {l,st} of withStage){
    const d = dealOf(l)
    if(st==='offer'){
      const quiet = daysSince(lastTouch[String(l.id)] || stageSince(l,activity))
      if(quiet!==null && quiet>=3) slipping.push({ l, rank:1, tag:'Offer going cold', c:C.amber, text:(d.last_offer?money(d.last_offer)+' offer':'Offer')+' out with no contact for '+quiet+' days — follow up or it dies.' })
    }
    if(st==='contract' || st==='assigned'){
      const ci = daysUntil(d.closing_date)
      if(ci!==null && ci<0) slipping.push({ l, rank:0, tag:'Closing overdue', c:C.red, text:'Was set to close '+fmtDay(d.closing_date)+' ('+(-ci)+'d ago). Update the date or check with title.' })
      else if(st==='contract' && !d.buyer) slipping.push({ l, rank:ci!==null&&ci<=14?0:2, tag:'No buyer yet', c:ci!==null&&ci<=14?C.red:C.amber, text:ci!==null ? 'Under contract, closes '+fmtDay(d.closing_date)+' (in '+ci+'d) and no buyer is lined up.' : 'Under contract with no buyer and no closing date entered.' })
      else if(ci!==null && ci<=7) slipping.push({ l, rank:1, tag:'Closing soon', c:C.blue, text:'Closes '+fmtDay(d.closing_date)+' (in '+ci+'d)'+(d.buyer?' · buyer: '+d.buyer:'')+(d.title_company?' · '+d.title_company:'')+'.' })
    }
    if(['contacted','appointment'].includes(st)){
      const days = daysSince(stageSince(l,activity)), lim = STALE_DAYS[st]
      if(lim && days!==null && days>lim && !callbackOf(l)) slipping.push({ l, rank:3, tag:'Stuck in '+STAGE[st].l.toLowerCase(), c:C.muted, text:days+' days with no next step and no callback set.' })
    }
  }
  slipping.sort((a,b)=>a.rank-b.rank)
  const slipShown = slipping.slice(0,8)

  // ---------- 3. money ----------
  const monthKey = localDate().slice(0,7)
  const closedThisMonth = withStage.filter(({l,st})=>st==='closed' && ((dealOf(l).closing_date||'').slice(0,7)===monthKey || (!dealOf(l).closing_date && localDate(new Date(l.details?.stage_at||0)).slice(0,7)===monthKey)))
  const closedFees = closedThisMonth.reduce((s,{l})=>s+(Number(dealOf(l).fee)||0),0)
  const inContract = withStage.filter(({st})=>st==='contract'||st==='assigned')
  const contractFees = inContract.reduce((s,{l})=>s+(Number(dealOf(l).fee)||0),0)
  const noFee = inContract.filter(({l})=>!Number(dealOf(l).fee)).length
  const offers = withStage.filter(({st})=>st==='offer')
  const offerSum = offers.reduce((s,{l})=>s+(Number(dealOf(l).last_offer)||0),0)
  const nextClose = inContract.map(({l})=>({l, ci:daysUntil(dealOf(l).closing_date)})).filter(x=>x.ci!==null && x.ci>=0).sort((a,b)=>a.ci-b.ci)[0]

  // ---------- 4. team ----------
  const active = team.filter(m=>m.active!==false)
  const yday = (()=>{ const d=new Date(); d.setDate(d.getDate()-1); return localDate(d) })()
  const today = localDate()
  const teamRows = active.map(m=>{
    const s = dayStats(m, activity, leads)
    const repToday = reports.some(r=>String(r.member_id)===String(m.id) && r.report_date===today)
    const workedYday = activity.some(a=>a.caller===m.name && localDate(new Date(a.created_at))===yday)
    const repYday = reports.some(r=>String(r.member_id)===String(m.id) && r.report_date===yday)
    return { m, s, st:liveStatus(s.rows, repToday), missedEod: workedYday && !repYday }
  })

  // ---------- 5. list health ----------
  const firstCall = {}
  for(let i=activity.length-1;i>=0;i--){ const a=activity[i]; if(!firstCall[a.lead_id]) firstCall[a.lead_id]=a.created_at }
  const weekAgo = Date.now()-7*86400000
  const lists = campaigns.map(c=>{
    const mine = withStage.filter(({l})=>campaignOf(l)===String(c.id))
    const fresh = mine.filter(({l,st})=>st==='new' && !lastTouch[String(l.id)]).length
    const firstsThisWeek = mine.filter(({l})=>{ const f=firstCall[String(l.id)]; return f && new Date(f).getTime()>=weekAgo })
    const daysWorked = new Set(firstsThisWeek.map(({l})=>localDate(new Date(firstCall[String(l.id)])))).size
    const pace = daysWorked ? Math.round(firstsThisWeek.length/daysWorked) : 0
    const left = pace ? Math.floor(fresh/pace) : null
    return { c, total:mine.length, fresh, pace, left }
  }).filter(x=>x.total>0 || x.c.active!==false)

  const needCount = handoffs.length + callbacks.length + slipping.filter(s=>s.rank<=1).length
  const hr = new Date().getHours()
  const greet = hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'
  const Item = ({tag,c,title,text,sub,children,onOpen}) => (
    <div style={{padding:'11px 0',borderTop:'1px solid '+C.line}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:isMobile?'wrap':'nowrap'}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{background:c+'1e',color:c,border:'1px solid '+c+'55',borderRadius:6,padding:'1px 7px',fontSize:10.5,fontWeight:800,whiteSpace:'nowrap'}}>{tag}</span>
            <b style={{fontSize:14,cursor:onOpen?'pointer':'default'}} onClick={onOpen}>{title}</b>
            {sub && <span style={{color:C.muted,fontSize:12}}>{sub}</span>}
          </div>
          {text && <div style={{color:C.cream,fontSize:13,marginTop:4,lineHeight:1.45}}>{text}</div>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>{children}</div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{color:C.muted,fontSize:12.5}}>{new Date().toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'})}</div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:'2px 0 0',fontWeight:600}}>{greet}</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5}}>{needCount ? <><b style={{color:C.orange}}>{needCount} thing{needCount===1?'':'s'}</b> need you today — most urgent first.</> : 'Nothing urgent right now. Your team and deals are on track.'}</p>
        </div>
      </div>

      {/* money */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginTop:16}}>
        {[
          ['Closed this month', money(closedFees), closedThisMonth.length+' deal'+(closedThisMonth.length===1?'':'s'), C.green, 'pipeline'],
          ['Under contract', money(contractFees), inContract.length+' deal'+(inContract.length===1?'':'s')+(noFee?' · '+noFee+' without a fee entered':''), C.orange, 'pipeline'],
          ['Offers out', offers.length, offerSum?money(offerSum)+' offered':'waiting on sellers', C.amber, 'pipeline'],
          ['Next closing', nextClose?fmtDay(dealOf(nextClose.l).closing_date):'—', nextClose?nextClose.l.name+' · in '+nextClose.ci+'d':'nothing scheduled', C.blue, 'pipeline'],
        ].map(([l,v,s,c,g])=>(
          <div key={l} onClick={()=>goTo(g)} style={{...card,padding:'14px 16px',cursor:'pointer'}}>
            <div style={cap}>{l}</div>
            <div style={{fontSize:isMobile?21:25,fontFamily:'Georgia,serif',fontWeight:700,color:c,marginTop:4}}>{v}</div>
            <div style={{color:C.muted,fontSize:11.5,marginTop:2}}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.5fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:14,minWidth:0}}>
          {/* needs you now */}
          <div style={{...card,borderColor:handoffs.length||callbacks.some(x=>callbackState(x.cb)==='overdue')?C.orange+'77':C.line}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Needs you now</div>
            {handoffs.length===0 && callbacks.length===0 && <div style={{color:C.muted,fontSize:13,padding:'6px 0'}}>No hand-offs waiting and no callbacks due today.</div>}
            {handoffs.map(l=>{ const h=l.details.handoff; const old=hoursAgo(h.at)>=2
              return <Item key={'h'+l.id} tag="Hand-off" c={old?C.red:C.amber} title={l.name} sub={'from '+h.by+' · waiting '+waited(h.at)} text={h.note} onOpen={()=>openLead(l.id)}>
                <button onClick={()=>openLead(l.id)} style={btn(true)}>Open lead</button>
                <button onClick={()=>{ setReplyFor(replyFor===l.id?null:l.id); setReplyText('') }} style={btn(false)}>Handled</button>
              </Item> })}
            {replyFor && handoffs.some(l=>l.id===replyFor) && (()=>{ const l=handoffs.find(x=>x.id===replyFor); return (
              <div style={{display:'flex',gap:6,margin:'0 0 8px'}}>
                <input autoFocus value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handled(l)} placeholder={'Reply to '+l.details.handoff.by+' about '+l.name+' (optional) — what happened?'} style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 11px',color:C.cream,fontSize:12.5,outline:'none'}}/>
                <button disabled={busy===l.id} onClick={()=>handled(l)} style={{background:C.green,color:C.ink,border:'none',borderRadius:8,padding:'0 14px',fontSize:12,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>Save & close</button>
              </div>) })()}
            {callbacks.map(({l,st,cb})=>{ const s=callbackState(cb); const appt = st==='appointment'
              return <Item key={'c'+l.id} tag={appt?'Appointment':s==='overdue'?'Callback overdue':'Callback today'} c={s==='overdue'?C.red:appt?C.green:C.amber} title={l.name}
                sub={fmtWhen(cb.at)+(cb.by?' · set by '+cb.by:'')} text={cb.note||[l.address,l.city].filter(Boolean).join(', ')} onOpen={()=>openLead(l.id)}>
                {l.phone && <a href={'tel:'+String(l.phone).replace(/[^\d+]/g,'')} style={{...btn(false),textDecoration:'none',color:C.green,borderColor:C.green+'66'}}>Call</a>}
                <button onClick={()=>openLead(l.id)} style={btn(true)}>Open lead</button>
              </Item> })}
          </div>

          {/* deals slipping */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Deals slipping</div>
              <span onClick={()=>goTo('pipeline')} style={{color:C.orange,fontSize:12,cursor:'pointer'}}>Open Pipeline →</span>
            </div>
            {slipShown.length===0 ? <div style={{color:C.muted,fontSize:13,padding:'6px 0'}}>Nothing slipping — every offer and contract has recent movement.</div> :
              slipShown.map((x,i)=><Item key={i} tag={x.tag} c={x.c} title={x.l.name} sub={[x.l.city,x.l.state].filter(Boolean).join(', ')} text={x.text} onOpen={()=>openLead(x.l.id)}>
                {x.tag==='No buyer yet' && openDispo && <button onClick={()=>openDispo(x.l.id)} style={btn(true)}>Find buyers</button>}
                <button onClick={()=>openLead(x.l.id)} style={btn(false)}>Open</button>
              </Item>)}
            {slipping.length>slipShown.length && <div style={{color:C.muted,fontSize:12,paddingTop:8}}>+ {slipping.length-slipShown.length} more on the Pipeline page</div>}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14,minWidth:0}}>
          {/* team */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:15}}>Team check</div>
              <span onClick={()=>goTo('va')} style={{color:C.orange,fontSize:12,cursor:'pointer'}}>VA Workspace →</span>
            </div>
            {teamRows.length===0 ? <div style={{color:C.muted,fontSize:13}}>No VAs set up yet. Add them in VA Workspace → Manage team & campaigns.</div> :
            teamRows.map(({m,s,st,missedEod})=>{ const p = Math.min(100, Math.round(s.dials/(m.dial_goal||60)*100))
              return <div key={m.id} style={{padding:'9px 0',borderTop:'1px solid '+C.line}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
                  <b style={{fontSize:13.5}}>{m.name}</b>
                  <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:700,color:st.c,whiteSpace:'nowrap'}}><span style={{width:7,height:7,borderRadius:'50%',background:st.c}}/>{st.label}</span>
                </div>
                <div style={{height:5,background:C.ink,borderRadius:5,overflow:'hidden',marginTop:6}}><div style={{width:p+'%',height:'100%',background:p>=100?C.green:C.orange}}/></div>
                <div style={{color:C.muted,fontSize:11.5,marginTop:4}}>{s.dials}/{m.dial_goal} dials · {s.contacts} contacts · {s.appointments} appts{s.last?' · last call '+agoText(s.last):''}</div>
                {missedEod && <div style={{color:C.amber,fontSize:11.5,marginTop:2}}>No end-of-day report yesterday</div>}
              </div> })}
          </div>

          {/* lists */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:15}}>List health</div>
              <span onClick={()=>goTo('lists')} style={{color:C.orange,fontSize:12,cursor:'pointer'}}>List Stacking →</span>
            </div>
            {lists.length===0 ? <div style={{color:C.muted,fontSize:13}}>Set up campaigns (counties) in VA Workspace to track how much list each one has left.</div> :
            lists.map(({c,total,fresh,pace,left})=>{ const col = left===null ? C.muted : left<=2 ? C.red : left<=5 ? C.amber : C.green
              return <div key={c.id} style={{padding:'9px 0',borderTop:'1px solid '+C.line}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <b style={{fontSize:13.5}}>{c.name}</b>
                  <span style={{color:col,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>{fresh===0 ? 'Out of new leads' : left===null ? fresh+' never called' : left<1 ? 'Runs out today' : '~'+left+' day'+(left===1?'':'s')+' left'}</span>
                </div>
                <div style={{color:C.muted,fontSize:11.5,marginTop:2}}>{fresh.toLocaleString()} never-called of {total.toLocaleString()} leads{pace?' · calling ~'+pace+' new/day':''}</div>
                {(fresh===0 || (left!==null && left<=3)) && <button onClick={()=>goTo('lists')} style={{...btn(true),marginTop:6,padding:'5px 10px',fontSize:11.5}}>Stack a new list</button>}
              </div> })}
          </div>
        </div>
      </div>
    </div>
  )
}
