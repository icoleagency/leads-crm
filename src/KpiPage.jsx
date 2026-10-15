import { useState } from 'react'
import { OUTCOME, TARGETS, inLastDays, tally, pct, startOfDay } from './activity'
import DailyBars from './DailyBars'
import { prevRows, byHour, bestWindow, hourName, hourShort, todayPace, byAttempt, listQuality, scoreBands, WORKDAY_END } from './kpiStats'

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

export default function KpiPage({leads=[],campaigns=[],team=[],activity,actErr,reload,isMobile,goTo}){
  const [days,setDays] = useState(7)
  const [caller,setCaller] = useState('All')
  const [qBy,setQBy] = useState('type')

  const callers = [...new Set(activity.map(a=>a.caller||'Unassigned'))].sort()
  const scoped = caller==='All' ? activity : activity.filter(a=>(a.caller||'Unassigned')===caller)
  const rows = inLastDays(scoped, days)
  const t = tally(rows)
  const todayRows = inLastDays(scoped,1)
  const today = tally(todayRows)
  const prev = prevRows(scoped, days)
  const pt = prev ? tally(prev) : null
  const prevName = days===1 ? 'yesterday by this time' : 'previous '+days+' days'

  // Goals: the selected VA's own goals; for everyone, the whole team's goals added up.
  const member = team.find(m=>m.name===caller)
  const goals = member ? { dials:Number(member.dial_goal)||TARGETS.dials, offers:Number(member.offer_goal)||TARGETS.offers }
    : caller==='All' && team.length ? { dials:team.reduce((s,m)=>s+(Number(m.dial_goal)||0),0)||TARGETS.dials, offers:team.reduce((s,m)=>s+(Number(m.offer_goal)||0),0)||TARGETS.offers }
    : TARGETS
  const pace = todayPace(todayRows)
  const todayHours = byHour(todayRows)
  const hrs30 = byHour(inLastDays(scoped,30))
  const best = bestWindow(hrs30)
  const attempts = byAttempt(scoped)
  const campName = id => { const c = campaigns.find(x=>String(x.id)===String(id)); return c ? c.name : null }
  const quality = listQuality(leads, inLastDays(scoped,90), qBy==='type' ? l=>l.lead_type : l=>{ const d=l.details||{}; return d.county ? String(d.county).replace(/\s*county$/i,'')+' County' : campName(d.campaign) })
  const bands = scoreBands(leads, rows)

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

  // [label, shown value, sub line, raw number now, raw number before]
  const tiles = [
    ['Dials', t.dials, null, t.dials, pt&&pt.dials],
    ['Contacts', t.contacts, pct(t.contacts,t.dials)+'% contact rate', t.contacts, pt&&pt.contacts],
    ['Appointments', t.appointment, pct(t.appointment,t.contacts)+'% of contacts', t.appointment, pt&&pt.appointment],
    ['Offers', t.offer, t.offerCount?'avg '+money(t.offerSum/t.offerCount):null, t.offer, pt&&pt.offer],
    ['Contracts', t.contract, pct(t.contract,t.offer)+'% of offers', t.contract, pt&&pt.contract],
    ['Fees closed', money(t.fees), t.closed+' deal'+(t.closed===1?'':'s'), t.fees, pt&&pt.fees],
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

      <TodayPanel style={{marginTop:18}} card={card} cap={cap} isMobile={isMobile} today={today} goals={goals} pace={pace} hours={todayHours} who={member?member.name:caller==='All'?(team.length?'Team':'You'):caller}/>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(6,1fr)',gap:10,marginTop:18}}>
        {tiles.map(([l,v,sub,now,before])=>(
          <div key={l} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'14px 15px'}}>
            <div style={cap}>{l}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:7,marginTop:5,flexWrap:'wrap'}}>
              <span style={{fontSize:26,fontFamily:'Georgia,serif',fontWeight:700,color:C.cream}}>{v}</span>
              <Delta now={now} before={before} money={l==='Fees closed'} label={prevName}/>
            </div>
            <div style={{color:C.muted,fontSize:11,marginTop:2,minHeight:14}}>{sub||''}</div>
          </div>
        ))}
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
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Hover a bar for contacts and offers · dashed line = {goals.dials}-dial goal</div>
          <DailyBars series={series} max={Math.max(smax,goals.dials*1.1)} goal={goals.dials}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
        <BestHours card={card} hours={hrs30} best={best}/>
        <Persistence card={card} attempts={attempts}/>
        <div style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
            <div style={{fontWeight:700,fontSize:14}}>List quality <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— are the numbers any good?</span></div>
            <div style={{display:'flex',gap:4}}>
              {[['type','List type'],['county','County']].map(([k,l])=>(
                <button key={k} onClick={()=>setQBy(k)} style={{border:'1px solid '+(qBy===k?C.orange:C.line),background:qBy===k?C.orange:'transparent',color:qBy===k?C.ink:C.muted,borderRadius:14,padding:'3px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Bad = marked wrong, disconnected or DNC · dials from the last 90 days</div>
          <Table cols={[qBy==='type'?'List type':'County','Leads','Numbers','Bad %','Dials','Contact %']}
            rows={quality.slice(0,10).map(q=>{ const b=pct(q.bad,q.numbers); return [q.k,q.leads,q.numbers,<span key="b" style={{color:b>=30?C.red:b>=15?C.amber:C.green,fontWeight:700}}>{b}%</span>,q.t.dials,q.t.dials?pct(q.t.contacts,q.t.dials)+'%':'—'] })}
            empty="No leads with phone numbers yet."/>
          {quality.some(q=>q.numbers>=10 && pct(q.bad,q.numbers)>=30) &&
            <div style={{color:C.amber,fontSize:11.5,marginTop:8}}>A list with 30%+ bad numbers is worth re-skip-tracing with a different provider.</div>}
        </div>
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Results by score <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— is the smart score right?</span></div>
          <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Calls in the selected period, grouped by the lead's score today</div>
          <Table cols={['Score','Leads','Called','Dials','Contact %','Offers','Offer / contact']}
            rows={bands.map(b=>[<span key="s" style={{color:b.color,fontWeight:700}}>{b.k}</span>,b.leads,b.leadsCalled,b.t.dials,b.t.dials?pct(b.t.contacts,b.t.dials)+'%':'—',b.t.offer,b.t.contacts?pct(b.t.offer,b.t.contacts)+'%':'—'])}
            empty="No leads yet."/>
          <ScoreVerdict bands={bands}/>
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

function Delta({now,before,money:isMoney,label}){
  if(before===null || before===undefined) return null
  if(!now && !before) return null
  const d = now-before
  if(d===0) return <span title={'Same as '+label} style={{color:C.muted,fontSize:11.5,fontWeight:600}}>= 0</span>
  const up = d>0
  const txt = isMoney ? '$'+Math.abs(Math.round(d)).toLocaleString() : Math.abs(d)
  return <span title={(up?'Up ':'Down ')+txt+' vs '+label+' ('+(isMoney?'$'+Math.round(before).toLocaleString():before)+')'} style={{color:up?C.green:C.red,fontSize:11.5,fontWeight:700,whiteSpace:'nowrap'}}>{up?'▲':'▼'} {txt}</span>
}

function HourBars({hours,from,to,value,max,label,highlight=()=>false,hiColor=C.green,height=90}){
  const span = []; for(let h=from; h<=to; h++) span.push(h)
  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-end',gap:3,height}}>
        {span.map(h=>{
          const v = value(hours[h]); const hi = highlight(h)
          return (
            <div key={h} title={label(h,hours[h])} style={{flex:1,height:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',alignItems:'center',minWidth:0}}>
              <div style={{fontSize:9.5,color:hi?hiColor:C.muted,marginBottom:2,whiteSpace:'nowrap'}}>{hours[h].dials?(typeof v==='number'&&max<=100&&value.pct?v+'%':v):''}</div>
              <div style={{width:'100%',height:Math.max(hours[h].dials?3:0,(v/max)*(height-16)),background:hi?hiColor:C.orange,opacity:hours[h].dials?1:0.25,borderRadius:'3px 3px 0 0'}}/>
            </div>
          )
        })}
      </div>
      <div style={{display:'flex',gap:3,marginTop:4}}>
        {span.map(h=><div key={h} style={{flex:1,textAlign:'center',fontSize:9.5,color:C.muted,minWidth:0}}>{(h-from)%2===0?hourShort(h):''}</div>)}
      </div>
    </div>
  )
}

function TodayPanel({style,card,cap,isMobile,today,goals,pace,hours,who}){
  const now = new Date(), nowH = now.getHours()
  const used = hours.map((x,h)=>x.dials?h:null).filter(h=>h!==null)
  const from = Math.min(8, ...used), to = Math.max(Math.min(20, Math.max(nowH, WORKDAY_END)), ...used)
  const hmax = Math.max(4, ...hours.map(x=>x.dials))
  const bar = (v,goal) => { const p=Math.min(100,pct(v,goal)); return <div style={{height:7,background:C.ink,borderRadius:7,overflow:'hidden',marginTop:6}}><div style={{width:p+'%',height:'100%',background:v>=goal?C.green:C.orange}}/></div> }
  const lastTxt = pace.lastMins===null ? 'No calls yet today' : pace.lastMins<1 ? 'Last call just now' : pace.lastMins<60 ? 'Last call '+pace.lastMins+' min ago' : 'Last call '+Math.floor(pace.lastMins/60)+'h '+(pace.lastMins%60)+'m ago'
  const lastColor = pace.lastMins===null ? C.muted : pace.lastMins>=30 && nowH<WORKDAY_END ? C.amber : C.muted
  const onPace = pace.projected!==null && pace.projected>=goals.dials
  const need = Math.max(0, goals.dials-today.dials)
  const hoursLeft = Math.max(0, WORKDAY_END - (nowH + now.getMinutes()/60))
  const needPerHour = need && hoursLeft>0.25 ? Math.ceil(need/hoursLeft) : null
  return (
    <div style={{...card,...style}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:15}}>Today <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {who}</span></div>
        <div style={{fontSize:12,color:lastColor,fontWeight:600}}>{lastTxt}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr) 1.7fr',gap:16,alignItems:'start'}}>
        <div>
          <div style={cap}>Dials</div>
          <div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{today.dials}<span style={{fontSize:13,color:C.muted,fontFamily:'inherit',fontWeight:400}}> / {goals.dials}</span></div>
          {bar(today.dials,goals.dials)}
        </div>
        <div>
          <div style={cap}>Contacts</div>
          <div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{today.contacts}</div>
          <div style={{color:C.muted,fontSize:11,marginTop:4}}>{today.dials?pct(today.contacts,today.dials)+'% of dials':'—'}</div>
        </div>
        <div>
          <div style={cap}>Offers</div>
          <div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{today.offer}<span style={{fontSize:13,color:C.muted,fontFamily:'inherit',fontWeight:400}}> / {goals.offers}</span></div>
          {bar(today.offer,goals.offers)}
        </div>
        <div>
          <div style={cap}>Pace</div>
          <div style={{fontSize:24,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{pace.perHour!==null?pace.perHour:'—'}<span style={{fontSize:13,color:C.muted,fontFamily:'inherit',fontWeight:400}}> /hr</span></div>
          <div style={{fontSize:11,marginTop:4,color:pace.projected===null?C.muted:onPace?C.green:C.amber,fontWeight:600}}>
            {today.dials>=goals.dials ? 'Dial goal hit ✓'
              : pace.projected!==null ? 'On pace for '+pace.projected+' by '+hourName(WORKDAY_END)
              : pace.dials ? 'Keep going — pace shows after 30 min' : 'Start dialing'}
          </div>
          {needPerHour && !onPace && pace.dials>0 && <div style={{fontSize:11,color:C.muted,marginTop:2}}>Need {needPerHour}/hr to hit {goals.dials}</div>}
        </div>
        <div style={{gridColumn:isMobile?'1/-1':'auto'}}>
          <div style={cap}>Calls by hour</div>
          <div style={{marginTop:6}}>
            <HourBars hours={hours} from={from} to={to} value={x=>x.dials} max={hmax} height={70}
              highlight={h=>h===nowH} hiColor={C.blue} label={(h,x)=>hourName(h)+': '+x.dials+' dials, '+x.contacts+' contacts'}/>
          </div>
        </div>
      </div>
    </div>
  )
}

function BestHours({card,hours,best}){
  const total = hours.reduce((s,x)=>s+x.dials,0)
  const used = hours.map((x,h)=>x.dials?h:null).filter(h=>h!==null)
  const rate = x => x.dials ? Math.round(x.contacts/x.dials*100) : 0
  rate.pct = true
  const from = used.length ? Math.min(8,...used) : 8, to = used.length ? Math.max(19,...used) : 19
  const max = Math.max(10, ...hours.map(rate))
  return (
    <div style={card}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Best hours to call <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— last 30 days</span></div>
      {total<20 ? <div style={{color:C.muted,fontSize:13,lineHeight:1.5}}>Needs about 20 logged dials to show a pattern — you have {total}. Keep logging and this fills in.</div> : <>
        <div style={{fontSize:13,marginBottom:12,color:C.cream}}>
          {best ? <>Owners pick up most <b style={{color:C.green}}>{hourName(best.start)}–{hourName(best.start+2)}</b> · {Math.round(best.rate*100)}% contact rate ({best.contacts} of {best.dials} dials)</>
            : <span style={{color:C.muted}}>Not enough dials in any one hour yet to call a winner.</span>}
        </div>
        <HourBars hours={hours} from={from} to={to} value={rate} max={max} height={100}
          highlight={h=>best && (h===best.start || h===best.start+1)}
          label={(h,x)=>hourName(h)+': '+rate(x)+'% contact rate ('+x.contacts+' of '+x.dials+' dials)'}/>
        <div style={{color:C.muted,fontSize:11,marginTop:8}}>Bar = % of dials that reached a person in that hour · hover for counts</div>
      </>}
    </div>
  )
}

function Persistence({card,attempts}){
  const total = attempts.reduce((s,a)=>s+a.contacts,0)
  const later = attempts.slice(2).reduce((s,a)=>s+a.contacts,0)
  const max = Math.max(10, ...attempts.map(a=>a.dials?a.contacts/a.dials*100:0))
  return (
    <div style={card}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Contacts by attempt <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— does calling back pay?</span></div>
      <div style={{color:C.muted,fontSize:11,marginBottom:12}}>Each lead's dials in order, counted until the owner was first reached · last 90 days</div>
      {attempts[0].dials===0 ? <div style={{color:C.muted,fontSize:13}}>No calls logged yet.</div> : <>
        {attempts.map(a=>{
          const r = a.dials ? Math.round(a.contacts/a.dials*100) : 0
          return (
            <div key={a.n} style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
              <div style={{width:70,color:C.muted,fontSize:12}}>{a.n===attempts.length?a.n+'+ calls':ordinal(a.n)+' call'}</div>
              <div style={{flex:1,height:20,background:C.ink,borderRadius:4}}>
                <div style={{width:Math.max(a.contacts?2:0,(r/max)*100)+'%',height:'100%',background:C.orange,borderRadius:4}}/>
              </div>
              <div style={{width:40,textAlign:'right',fontSize:13,fontWeight:700}}>{a.dials?r+'%':'—'}</div>
              <div style={{width:74,textAlign:'right',fontSize:11,color:C.muted}}>{a.contacts} of {a.dials}</div>
            </div>
          )
        })}
        {total>=5 && <div style={{fontSize:12.5,marginTop:10,color:later/total>=0.25?C.green:C.cream}}>
          <b>{pct(later,total)}%</b> of the owners you reached picked up on the 3rd call or later{later/total>=0.25?' — keep following up.':'.'}
        </div>}
      </>}
    </div>
  )
}
const ordinal = n => n+(n===1?'st':n===2?'nd':n===3?'rd':'th')

function ScoreVerdict({bands}){
  const hot = bands[0], cold = bands[3]
  const rate = b => b.t.dials ? b.t.contacts/b.t.dials : null
  if(hot.t.dials<15 || cold.t.dials<15) return <div style={{color:C.muted,fontSize:11.5,marginTop:8}}>Needs ~15 dials on both Hot and Cold leads to judge the score.</div>
  const h = rate(hot), c = rate(cold)
  const hOffer = hot.t.contacts ? hot.t.offer/hot.t.contacts : 0, cOffer = cold.t.contacts ? cold.t.offer/cold.t.contacts : 0
  const good = h>=c || hOffer>cOffer
  return <div style={{fontSize:12,marginTop:8,color:good?C.green:C.amber}}>
    {good ? 'Hot leads are out-performing Cold — the score is pointing you the right way.'
      : 'Cold leads are doing as well as Hot ones so far — worth watching before trusting the score.'}
  </div>
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
