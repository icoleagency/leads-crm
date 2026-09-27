import { useState } from 'react'
import { OUTCOME, TARGETS, inLastDays, tally, pct, startOfDay } from './activity'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const money = n => '$'+Math.round(Number(n||0)).toLocaleString()
const PERIODS = [[1,'Today'],[7,'7 days'],[30,'30 days'],[90,'90 days']]

function groupBy(rows, key){
  const m = {}
  for(const r of rows){ const k = r[key]||'Unknown'; (m[k] ||= []).push(r) }
  return Object.entries(m).map(([k,v])=>({k, t:tally(v)})).sort((a,b)=>b.t.dials-a.t.dials)
}

export default function KpiPage({leads=[],campaigns=[],activity,actErr,reload,isMobile,goTo}){
  const [days,setDays] = useState(7)
  const [caller,setCaller] = useState('All')

  const callers = [...new Set(activity.map(a=>a.caller||'Unassigned'))].sort()
  const scoped = caller==='All' ? activity : activity.filter(a=>(a.caller||'Unassigned')===caller)
  const rows = inLastDays(scoped, days)
  const t = tally(rows)
  const today = tally(inLastDays(scoped,1))

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}

  if(actErr) return (
    <div>
      <h1 style={h1}>KPIs</h1>
      <div style={{...card,marginTop:20,borderColor:C.amber+'66'}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:14,marginBottom:8}}>One-time setup needed</div>
        <div style={{color:C.cream,fontSize:13.5,lineHeight:1.55}}>{actErr}</div>
        <button onClick={reload} style={{marginTop:14,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Retry</button>
      </div>
    </div>
  )

  const tiles = [
    ['Dials', t.dials, null],
    ['Contacts', t.contacts, pct(t.contacts,t.dials)+'% contact rate'],
    ['Appointments', t.appointment, pct(t.appointment,t.contacts)+'% of contacts'],
    ['Offers', t.offer, t.offerCount?'avg '+money(t.offerSum/t.offerCount):null],
    ['Contracts', t.contract, pct(t.contract,t.offer)+'% of offers'],
    ['Fees closed', money(t.fees), t.closed+' deal'+(t.closed===1?'':'s')],
  ]
  // [label, value, base for the conversion %] — offers are measured against contacts,
  // since in virtual wholesaling most offers are made by phone without an appointment.
  const funnel = [
    ['Dials',t.dials,null],['Contacts',t.contacts,t.dials],['Appointments',t.appointment,t.contacts],
    ['Offers',t.offer,t.contacts],['Contracts',t.contract,t.offer],['Closed',t.closed,t.contract],
  ]
  const fmax = Math.max(1, t.dials)

  const nDays = 14
  const dayStart = startOfDay().getTime()
  const series = Array.from({length:nDays},(_,i)=>{
    const s = dayStart - (nDays-1-i)*86400000, e = s+86400000
    const r = scoped.filter(a=>{ const x=new Date(a.created_at).getTime(); return x>=s && x<e })
    const tt = tally(r)
    return { d:new Date(s), dials:tt.dials, contacts:tt.contacts, offers:tt.offer }
  })
  const smax = Math.max(4, ...series.map(s=>s.dials))

  const byCaller = groupBy(inLastDays(activity,days),'caller')
  const byType = groupBy(rows,'lead_type')
  const campOfLead = {}
  for(const l of leads){ const id=l.details&&l.details.campaign; if(id){ const c=campaigns.find(x=>String(x.id)===String(id)); if(c) campOfLead[String(l.id)]=c.name } }
  const byCampaign = groupBy(rows.map(a=>({...a, campaign:campOfLead[a.lead_id]||'No campaign'})),'campaign')

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>KPIs</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5}}>Every number here comes from calls logged on your leads.</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {PERIODS.map(([n,l])=>(
            <button key={n} onClick={()=>setDays(n)} style={{border:'1px solid '+(days===n?C.orange:C.line),background:days===n?C.orange:'transparent',color:days===n?C.ink:C.muted,borderRadius:20,padding:'6px 13px',fontWeight:600,cursor:'pointer',fontSize:12.5}}>{l}</button>
          ))}
          <select value={caller} onChange={e=>setCaller(e.target.value)} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:20,padding:'6px 12px',color:C.cream,fontSize:12.5}}>
            <option value="All">All callers</option>
            {callers.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {activity.length===0 &&
      <div style={{...card,marginTop:18,textAlign:'center'}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>No calls logged yet</div>
        <div style={{color:C.muted,fontSize:13,lineHeight:1.5,maxWidth:460,margin:'0 auto'}}>Open any lead and use <b style={{color:C.cream}}>Log this call</b> after each dial. Your KPIs build themselves from there.</div>
        <button onClick={()=>goTo('leads')} style={{marginTop:14,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Go to Leads</button>
      </div>}

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(6,1fr)',gap:10,marginTop:18}}>
        {tiles.map(([l,v,sub])=>(
          <div key={l} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'14px 15px'}}>
            <div style={cap}>{l}</div>
            <div style={{fontSize:26,fontFamily:'Georgia,serif',fontWeight:700,marginTop:5,color:C.cream}}>{v}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2,minHeight:14}}>{sub||''}</div>
          </div>
        ))}
      </div>

      <div style={{...card,marginTop:14,display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:18}}>
        {[['Dials today',today.dials,TARGETS.dials],['Offers today',today.offer,TARGETS.offers]].map(([l,v,goal])=>{
          const p = Math.min(100, pct(v,goal))
          return (
            <div key={l}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                <span style={{color:C.cream,fontWeight:600}}>{l}</span>
                <span style={{color:v>=goal?C.green:C.muted}}><b style={{color:v>=goal?C.green:C.cream}}>{v}</b> / {goal} target</span>
              </div>
              <div style={{height:8,background:C.ink,borderRadius:8,overflow:'hidden'}}>
                <div style={{width:p+'%',height:'100%',background:v>=goal?C.green:C.orange,borderRadius:8}}/>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1.15fr',gap:14,marginTop:14,alignItems:'start'}}>
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Funnel <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {PERIODS.find(p=>p[0]===days)[1].toLowerCase()}</span></div>
          {funnel.map(([l,v,base])=>{
            return (
              <div key={l} style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
                <div style={{width:92,color:C.muted,fontSize:12}}>{l}</div>
                <div style={{flex:1,height:22,background:C.ink,borderRadius:4,position:'relative'}}>
                  <div title={l+': '+v} style={{width:Math.max(v?2:0,(v/fmax)*100)+'%',height:'100%',background:C.orange,borderRadius:4}}/>
                </div>
                <div style={{width:34,textAlign:'right',fontSize:13,fontWeight:700}}>{v}</div>
                <div style={{width:44,textAlign:'right',fontSize:11,color:C.muted}}>{base!==null?pct(v,base)+'%':''}</div>
              </div>
            )
          })}
          <div style={{color:C.muted,fontSize:11,marginTop:8}}>% = conversion rate · appointments and offers are measured against contacts</div>
        </div>

        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Dials per day <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— last 14 days</span></div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Hover a bar for contacts and offers · dashed line = {TARGETS.dials}-dial target</div>
          <DailyBars series={series} max={Math.max(smax,TARGETS.dials*1.1)}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Caller scoreboard</div>
          <Table cols={['Caller','Dials','Contact %','Appts','Offers','Contracts']} rows={byCaller.map(({k,t})=>[k,t.dials,pct(t.contacts,t.dials)+'%',t.appointment,t.offer,t.contract])} empty="No calls in this period."/>
        </div>
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>By lead type <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— which lists convert</span></div>
          <Table cols={['Lead type','Dials','Contact %','Offers','Contracts']} rows={byType.map(({k,t})=>[k,t.dials,pct(t.contacts,t.dials)+'%',t.offer,t.contract])} empty="No calls in this period."/>
        </div>
        {campaigns.length>0 &&
        <div style={{...card,gridColumn:'1/-1'}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>By campaign <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— which counties are working</span></div>
          <Table cols={['Campaign','Dials','Contact %','Appts','Offers','Contracts','Closed']} rows={byCampaign.map(({k,t})=>[k,t.dials,pct(t.contacts,t.dials)+'%',t.appointment,t.offer,t.contract,t.closed])} empty="No calls in this period."/>
        </div>}
      </div>

      <div style={{...card,marginTop:14}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Recent activity</div>
        {rows.length===0 ? <div style={{color:C.muted,fontSize:13}}>Nothing logged in this period.</div> :
        rows.slice(0,12).map(a=>(
          <div key={a.id} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12.5,padding:'7px 0',borderBottom:'1px solid '+C.line}}>
            <span style={{minWidth:0}}><b style={{color:C.cream}}>{a.lead_name||'Lead'}</b> <span style={{color:C.muted}}>· {OUTCOME[a.outcome]?.short||a.outcome}{a.amount?' · '+money(a.amount):''}{a.note?' — '+a.note:''}</span></span>
            <span style={{color:C.muted,whiteSpace:'nowrap'}}>{a.caller} · {new Date(a.created_at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyBars({series,max}){
  const W=560, H=170, pl=26, pb=22, pt=6
  const iw=W-pl, ih=H-pb-pt
  const bw = iw/series.length
  const y = v => pt + ih - (v/max)*ih
  const ticks = [0, Math.round(max/2), Math.round(max)]
  const tgtY = y(TARGETS.dials)
  return (
    <svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',height:'auto',display:'block'}} role="img" aria-label="Dials per day, last 14 days">
      {ticks.map(v=>(
        <g key={v}>
          <line x1={pl} x2={W} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="1"/>
          <text x={pl-6} y={y(v)+3} textAnchor="end" fontSize="10" fill={C.muted}>{v}</text>
        </g>
      ))}
      <line x1={pl} x2={W} y1={tgtY} y2={tgtY} stroke={C.muted} strokeWidth="1" strokeDasharray="4 4"/>
      {series.map((s,i)=>{
        const x = pl + i*bw + 2, w = Math.max(2, bw-4)
        const top = y(s.dials), h = pt+ih-top
        const r = Math.min(4, w/2, h)
        const path = h>0 ? `M${x},${pt+ih} L${x},${top+r} Q${x},${top} ${x+r},${top} L${x+w-r},${top} Q${x+w},${top} ${x+w},${top+r} L${x+w},${pt+ih} Z` : ''
        const label = s.d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})
        const isToday = i===series.length-1
        return (
          <g key={i}>
            <rect x={pl+i*bw} y={pt} width={bw} height={ih} fill="transparent">
              <title>{label}: {s.dials} dials · {s.contacts} contacts · {s.offers} offers</title>
            </rect>
            {path && <path d={path} fill={C.orange} opacity={isToday?1:0.8} pointerEvents="none"/>}
            {(i%2===1 || isToday) && <text x={pl+i*bw+bw/2} y={H-6} textAnchor="middle" fontSize="10" fill={isToday?C.cream:C.muted}>{isToday?'Today':s.d.getDate()}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Table({cols,rows,empty}){
  if(rows.length===0) return <div style={{color:C.muted,fontSize:13}}>{empty}</div>
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
        <thead><tr>{cols.map((c,i)=><th key={c} style={{textAlign:i?'right':'left',color:C.muted,fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:0.5,padding:'6px 6px',borderBottom:'1px solid '+C.line}}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r,ri)=><tr key={ri}>{r.map((v,i)=><td key={i} style={{textAlign:i?'right':'left',padding:'8px 6px',borderBottom:'1px solid '+C.line,color:C.cream,fontWeight:i?400:600}}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
