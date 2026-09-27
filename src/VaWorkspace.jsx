import { useState } from 'react'
import { STAGE, stageOf, scoreOf, gradeLetter, patchLead } from './leadModel'
import { tally, inLastDays, pct, saveCaller } from './activity'
import { saveCampaign, deleteCampaign, saveMember, deleteMember, campaignOf, campaignName, openHandoff } from './team'
import { CallCard, ScriptPanel, LogCall, HandoffPanel, IntelEditor } from './LeadPanels'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const GRADE_C = { A:C.green, B:C.amber, C:C.orange, D:C.red }
const CLOSED_STAGES = ['contract','assigned','closed','dead']
const STATES = ['NJ','FL','DE','PA','Other']

export default function VaWorkspace({leads,activity,campaigns,team,teamErr,reloadTeam,reloadLeads,reloadActivity,meId,onMe,isMobile}){
  const [work,setWork] = useState(null)   // { ids:[lead ids in list order], i:index } while working leads
  const [showManage,setShowManage] = useState(false)
  const [showAll,setShowAll] = useState(false)
  const me = team.find(m=>String(m.id)===meId) || null
  const ownerView = meId==='owner' || !me

  function pickMe(id){
    onMe(id); setWork(null)
    const m = team.find(x=>String(x.id)===id)
    if(m) saveCaller(m.name)
  }

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}
  const sel = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'9px 10px',color:C.cream,fontSize:13}

  if(teamErr) return (
    <div>
      <h1 style={h1}>VA Workspace</h1>
      <div style={{...card,marginTop:20,borderColor:C.amber+'66'}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:14,marginBottom:8}}>One-time setup needed</div>
        <div style={{color:C.cream,fontSize:13.5,lineHeight:1.55}}>{teamErr}</div>
        <button onClick={reloadTeam} style={{marginTop:14,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 18px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Retry</button>
      </div>
    </div>
  )

  // ---- stats per member ----
  const byName = (rows,name) => rows.filter(a=>(a.caller||'')===name)
  const week = inLastDays(activity,7), today = inLastDays(activity,1)
  const board = team.filter(m=>m.active!==false).map(m=>({ m, t:tally(byName(today,m.name)), w:tally(byName(week,m.name)),
    handoffs: leads.filter(l=>{ const h=l.details&&l.details.handoff; return h && h.by===m.name }).length }))
    .sort((a,b)=>b.w.dials-a.w.dials)
  const mine = me ? board.find(b=>b.m.id===me.id) : null
  const rank = me ? board.findIndex(b=>b.m.id===me.id)+1 : 0

  // ---- my queue ----
  const myCamps = me ? (me.campaigns||[]).map(String) : []
  const lastCall = id => activity.find(a=>a.lead_id===String(id))
  const callCount = id => activity.filter(a=>a.lead_id===String(id)).length
  const queue = !me ? [] : leads
    .filter(l=>myCamps.includes(campaignOf(l)) && !CLOSED_STAGES.includes(stageOf(l,activity)) && !openHandoff(l))
    .map(l=>({ l, s:scoreOf(l), n:callCount(l.id), last:lastCall(l.id) }))
    .sort((a,b)=> (a.n===0)!==(b.n===0) ? (a.n===0?-1:1) : b.s-a.s)
  const shown = showAll ? queue : queue.slice(0,25)
  const myHandoffs = me ? leads.filter(l=>{ const h=l.details&&l.details.handoff; return h && h.by===me.name }) : []

  const Stat = ({label,v,goal,sub}) => {
    const p = goal ? Math.min(100,pct(v,goal)) : null
    return (
      <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'13px 15px',minWidth:0}}>
        <div style={cap}>{label}</div>
        <div style={{fontSize:26,fontFamily:'Georgia,serif',fontWeight:700,marginTop:4}}>{v}{goal?<span style={{fontSize:14,color:C.muted,fontFamily:'inherit',fontWeight:400}}> / {goal}</span>:null}</div>
        {p!==null && <div style={{height:6,background:C.ink,borderRadius:6,marginTop:6,overflow:'hidden'}}><div style={{width:p+'%',height:'100%',background:v>=goal?C.green:C.orange}}/></div>}
        {sub && <div style={{color:C.muted,fontSize:11,marginTop:5}}>{sub}</div>}
      </div>
    )
  }

  if(work && me){
    const id = work.ids[work.i]
    const go = i => { setWork({...work, i}); window.scrollTo({top:0}) }
    return <LeadWork key={id} lead={leads.find(l=>l.id===id)} idx={work.i} total={work.ids.length}
      onBack={()=>setWork(null)} onPrev={work.i>0?()=>go(work.i-1):null} onNext={work.i<work.ids.length-1?()=>go(work.i+1):null}
      activity={activity} reloadActivity={reloadActivity} reloadLeads={reloadLeads} campaigns={campaigns} isMobile={isMobile}/>
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>VA Workspace</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:600}}>{me ? 'Your numbers, your counties, and your call list.' : 'Pick who is working on this device, or view the whole team.'}</p>
        </div>
        <label style={{color:C.muted,fontSize:12,display:'flex',alignItems:'center',gap:8}}>Working as
          <select value={meId} onChange={e=>pickMe(e.target.value)} style={{...sel,minWidth:170}}>
            <option value="">— choose —</option>
            {team.filter(m=>m.active!==false).map(m=><option key={m.id} value={String(m.id)}>{m.name}</option>)}
            <option value="owner">Owner view (whole team)</option>
          </select>
        </label>
      </div>

      {team.length===0 &&
      <div style={{...card,marginTop:16,borderColor:C.orange+'66'}}>
        <div style={{fontWeight:700,fontSize:14}}>Set up your team</div>
        <div style={{color:C.muted,fontSize:13,marginTop:6,lineHeight:1.55}}>Add your counties as campaigns, add each VA, and assign them to their counties. Then each VA picks their name above on their own computer.</div>
        {!showManage && <button onClick={()=>setShowManage(true)} style={{marginTop:12,background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'9px 16px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Set up team & campaigns</button>}
      </div>}

      {me && mine &&
      <div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:10,marginTop:16}}>
          <Stat label="Dials today" v={mine.t.dials} goal={me.dial_goal}/>
          <Stat label="Contacts today" v={mine.t.contacts} sub={pct(mine.t.contacts,mine.t.dials)+'% contact rate'}/>
          <Stat label="Appointments today" v={mine.t.appointment}/>
          <Stat label="Offers today" v={mine.t.offer} goal={me.offer_goal}/>
          <Stat label="Team rank (7d)" v={'#'+rank} sub={'of '+board.length+' · '+mine.w.dials+' dials this week'}/>
        </div>
        <div style={{color:C.muted,fontSize:12,marginTop:10}}>This week: <b style={{color:C.cream}}>{mine.w.dials}</b> dials · <b style={{color:C.cream}}>{mine.w.contacts}</b> contacts · <b style={{color:C.cream}}>{mine.w.appointment}</b> appointments · <b style={{color:C.cream}}>{mine.w.offer}</b> offers · <b style={{color:C.cream}}>{myHandoffs.length}</b> hand-offs</div>

        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.6fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:14}}>My call list <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {queue.length} leads</span></div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {myCamps.length===0 ? <span style={{color:C.amber,fontSize:12}}>No counties assigned yet</span> :
                  myCamps.map(id=><span key={id} style={{background:C.blue+'1e',color:C.blue,border:'1px solid '+C.blue+'55',borderRadius:10,padding:'2px 8px',fontSize:11,fontWeight:700}}>{campaignName(campaigns,id)||'?'}</span>)}
              </div>
            </div>
            <div style={{color:C.muted,fontSize:11.5,marginBottom:10}}>Never-called leads first, then by lead grade. Tap a lead to open its Call Card and script.</div>
            {queue.length===0 ? <div style={{color:C.muted,fontSize:13,padding:'8px 0'}}>{myCamps.length?'Nothing to call in your counties right now. Ask for a new list, or check that leads have a campaign set.':'Ask your manager to assign you to a county.'}</div> :
            <div>
              <button onClick={()=>{ setWork({ ids:queue.map(x=>x.l.id), i:0 }); window.scrollTo({top:0}) }} style={{width:'100%',background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px',fontWeight:800,fontSize:13,cursor:'pointer',marginBottom:8}}>Start working my list →</button>
              {shown.map(({l,s,n,last})=>{
                const g = gradeLetter(s), st = stageOf(l,activity)
                return (
                  <div key={l.id} onClick={()=>{ setWork({ ids:queue.map(x=>x.l.id), i:queue.findIndex(x=>x.l.id===l.id) }); window.scrollTo({top:0}) }} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 6px',borderBottom:'1px solid '+C.line,cursor:'pointer'}}>
                    <span style={{width:26,height:26,borderRadius:7,background:GRADE_C[g]+'22',color:GRADE_C[g],border:'1px solid '+GRADE_C[g],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0}}>{g}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13.5}}>{l.name}</div>
                      <div style={{color:C.muted,fontSize:11.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[l.address,l.city].filter(Boolean).join(', ')} · {l.lead_type}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      {st!=='new' && <div style={{color:STAGE[st].c,fontSize:11,fontWeight:700}}>{STAGE[st].l}</div>}
                      <div style={{color:n?C.muted:C.green,fontSize:11}}>{n ? n+' call'+(n===1?'':'s')+(last?' · last '+new Date(last.created_at).toLocaleDateString([], {month:'short',day:'numeric'}):'') : 'never called'}</div>
                    </div>
                  </div>
                )
              })}
              {queue.length>25 && <button onClick={()=>setShowAll(!showAll)} style={{marginTop:10,background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>{showAll?'Show fewer':'Show all '+queue.length}</button>}
            </div>}
          </div>

          <div style={card}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>My hand-offs</div>
            {myHandoffs.length===0 ? <div style={{color:C.muted,fontSize:13,lineHeight:1.5}}>When you set an appointment or find a motivated seller, open the lead and tap <b style={{color:C.cream}}>Hand off to closer</b>.</div> :
            myHandoffs.map(l=>{ const h=l.details.handoff; return (
              <div key={l.id} onClick={()=>{ setWork({ ids:[l.id], i:0 }); window.scrollTo({top:0}) }} style={{padding:'8px 0',borderBottom:'1px solid '+C.line,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <span style={{fontWeight:600,fontSize:13}}>{l.name}</span>
                  <span style={{fontSize:11,fontWeight:700,color:h.status==='open'?C.amber:C.green}}>{h.status==='open'?'Waiting on closer':'Handled'}</span>
                </div>
                {h.note && <div style={{color:C.muted,fontSize:12,marginTop:2}}>{h.note}</div>}
              </div>
            )})}
          </div>
        </div>
      </div>}

      {ownerView && team.length>0 &&
      <div style={{...card,marginTop:16}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Team today <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— ranked by dials this week</span></div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:560}}>
            <thead><tr>{['VA','Counties','Dials today','Contact %','Appts','Offers','7-day dials','Hand-offs'].map((h,i)=><th key={h} style={{textAlign:i>1?'right':'left',color:C.muted,fontWeight:600,fontSize:10.5,textTransform:'uppercase',letterSpacing:0.5,padding:'6px',borderBottom:'1px solid '+C.line}}>{h}</th>)}</tr></thead>
            <tbody>{board.map(({m,t,w,handoffs})=>{
              const cell={padding:'8px 6px',borderBottom:'1px solid '+C.line}
              return (
                <tr key={m.id}>
                  <td style={{...cell,fontWeight:700}}>{m.name}</td>
                  <td style={{...cell,color:C.muted}}>{(m.campaigns||[]).map(id=>campaignName(campaigns,id)).filter(Boolean).join(', ')||'—'}</td>
                  <td style={{...cell,textAlign:'right',color:t.dials>=m.dial_goal?C.green:C.cream}}>{t.dials} / {m.dial_goal}</td>
                  <td style={{...cell,textAlign:'right'}}>{pct(t.contacts,t.dials)}%</td>
                  <td style={{...cell,textAlign:'right'}}>{t.appointment}</td>
                  <td style={{...cell,textAlign:'right',color:t.offer>=m.offer_goal?C.green:C.cream}}>{t.offer} / {m.offer_goal}</td>
                  <td style={{...cell,textAlign:'right'}}>{w.dials}</td>
                  <td style={{...cell,textAlign:'right'}}>{handoffs}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </div>}

      {ownerView && <div style={{marginTop:16}}>
        <button onClick={()=>setShowManage(!showManage)} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'8px 14px',fontSize:12.5,fontWeight:600,cursor:'pointer'}}>{showManage?'Hide':'Manage'} team & campaigns</button>
      </div>}
      {ownerView && showManage && <Manage leads={leads} campaigns={campaigns} team={team} reloadTeam={reloadTeam} reloadLeads={reloadLeads} isMobile={isMobile}/>}
    </div>
  )
}

function LeadWork({lead,idx,total,onBack,onPrev,onNext,activity,reloadActivity,reloadLeads,campaigns,isMobile}){
  const [editing,setEditing] = useState(false)
  const btn = (primary,disabled) => ({background:primary?C.orange:'transparent',color:primary?C.ink:C.muted,border:'1px solid '+(primary?C.orange:C.line),borderRadius:8,padding:'8px 14px',fontSize:12.5,fontWeight:700,cursor:disabled?'default':'pointer',opacity:disabled?0.4:1,whiteSpace:'nowrap'})
  const bar = (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:16}}>
      <button onClick={onBack} style={btn(false)}>← My call list</button>
      <span style={{color:C.muted,fontSize:12.5}}>Lead {idx+1} of {total}</span>
      <div style={{display:'flex',gap:6}}>
        <button onClick={onPrev||undefined} disabled={!onPrev} style={btn(false,!onPrev)}>‹ Previous</button>
        <button onClick={onNext||undefined} disabled={!onNext} style={btn(true,!onNext)}>{onNext?'Next lead →':'End of list'}</button>
      </div>
    </div>
  )
  if(!lead) return <div>{bar}<div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:24,color:C.muted}}>This lead isn't available anymore (it may have been deleted). Skip to the next one.</div></div>

  const g = gradeLetter(scoreOf(lead)), st = stageOf(lead, activity)
  const camp = campaignName(campaigns, campaignOf(lead))
  const phone = (lead.phone||'').trim()
  return (
    <div>
      {bar}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
          <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:22,fontFamily:'Georgia,serif',fontWeight:600}}>{lead.name}</div>
                <div style={{color:C.muted,fontSize:13,marginTop:3}}>{[lead.address,lead.city,lead.state].filter(Boolean).join(', ')}</div>
                <div style={{color:C.muted,fontSize:12.5,marginTop:2}}>{lead.lead_type}{camp?' · '+camp:''}{st!=='new'?<span style={{color:STAGE[st].c,fontWeight:700}}> · {STAGE[st].l}</span>:null}</div>
              </div>
              <span style={{width:40,height:40,borderRadius:10,background:GRADE_C[g]+'22',color:GRADE_C[g],border:'1px solid '+GRADE_C[g],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18,flexShrink:0,fontFamily:'Georgia,serif'}}>{g}</span>
            </div>
            {phone ?
              <a href={'tel:'+phone.replace(/[^\d+]/g,'')} style={{display:'block',textAlign:'center',marginTop:14,background:C.green,color:C.ink,borderRadius:10,padding:'12px',fontWeight:800,fontSize:15,textDecoration:'none'}}>Call {phone}</a> :
              <div style={{marginTop:14,color:C.amber,fontSize:12.5,background:C.amber+'14',border:'1px solid '+C.amber+'44',borderRadius:8,padding:'9px 11px'}}>No phone number on this lead — it needs skip tracing.</div>}
          </div>
          {editing
            ? <IntelEditor lead={lead} onDone={()=>setEditing(false)} reloadLeads={reloadLeads}/>
            : <CallCard lead={lead} onEdit={()=>setEditing(true)}/>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
          <ScriptPanel lead={lead}/>
          <LogCall lead={lead} activity={activity} reloadActivity={reloadActivity} reloadLeads={reloadLeads} onNext={onNext}/>
          <HandoffPanel lead={lead} reloadLeads={reloadLeads}/>
        </div>
      </div>
    </div>
  )
}

function Manage({leads,campaigns,team,reloadTeam,reloadLeads,isMobile}){
  const [newC,setNewC] = useState({name:'',state:'NJ'})
  const [newM,setNewM] = useState({name:'',dial_goal:60,offer_goal:3,campaigns:[]})
  const [edit,setEdit] = useState({})
  const [bulk,setBulk] = useState({state:'NJ',campaign:''})
  const [msg,setMsg] = useState(null)
  const [busy,setBusy] = useState(false)

  async function act(fn, ok){
    setBusy(true); setMsg(null)
    try{ await fn(); if(ok) setMsg({ok:true,t:ok}); await reloadTeam() }
    catch(e){ setMsg({ok:false,t:/fetch/i.test(e.message)?"Can't reach the database — try again in a minute.":e.message}) }
    setBusy(false)
  }
  const leadsIn = id => leads.filter(l=>campaignOf(l)===String(id)).length
  const unassigned = st => leads.filter(l=>!campaignOf(l) && (st==='all' || l.state===st))

  async function bulkAssign(){
    const list = unassigned(bulk.state)
    if(!bulk.campaign || !list.length) return
    setBusy(true); setMsg(null)
    try{
      for(const l of list) await patchLead(l, { campaign:String(bulk.campaign) })
      setMsg({ok:true,t:'Assigned '+list.length+' lead'+(list.length===1?'':'s')+' to '+(campaigns.find(c=>String(c.id)===String(bulk.campaign))||{}).name+'.'})
      await reloadLeads()
    }catch(e){ setMsg({ok:false,t:e.message}) }
    setBusy(false)
  }

  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
  const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',boxSizing:'border-box'}
  const cell = {...inp,width:'100%',minWidth:0}
  const btn = p => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'8px 13px',fontSize:12,fontWeight:700,cursor:busy?'default':'pointer',opacity:busy?0.6:1,whiteSpace:'nowrap'})
  const CampChecks = ({value,onChange}) => (
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      {campaigns.length===0 ? <span style={{color:C.muted,fontSize:12}}>Add a campaign first</span> :
      campaigns.map(c=>{ const on=value.map(String).includes(String(c.id)); return (
        <label key={c.id} style={{display:'flex',alignItems:'center',gap:5,background:C.ink,border:'1px solid '+(on?C.orange:C.line),borderRadius:8,padding:'5px 9px',fontSize:12,cursor:'pointer',color:on?C.cream:C.muted}}>
          <input type="checkbox" checked={on} onChange={e=>onChange(e.target.checked?[...value.map(String),String(c.id)]:value.map(String).filter(x=>x!==String(c.id)))}/>{c.name}
        </label>
      )})}
    </div>
  )

  return (
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1.3fr',gap:14,marginTop:12,alignItems:'start'}}>
      {msg && <div style={{gridColumn:'1/-1',fontSize:12.5,color:msg.ok?C.green:C.red,background:(msg.ok?C.green:C.red)+'14',border:'1px solid '+(msg.ok?C.green:C.red)+'44',borderRadius:8,padding:'9px 12px'}}>{msg.t}</div>}

      <div style={card}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Campaigns <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— your markets / counties</span></div>
        {campaigns.map(c=>(
          <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid '+C.line}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{c.name}</div><div style={{color:C.muted,fontSize:11.5}}>{c.state||''} · {leadsIn(c.id)} lead{leadsIn(c.id)===1?'':'s'} · {(n=>n+' VA'+(n===1?'':'s'))(team.filter(m=>(m.campaigns||[]).map(String).includes(String(c.id))).length)}</div></div>
            <button onClick={()=>{ if(confirm('Delete campaign "'+c.name+'"? Its leads become unassigned.')) act(()=>deleteCampaign(c.id)) }} style={{...btn(false),padding:'5px 9px'}}>Delete</button>
          </div>
        ))}
        <div style={{display:'flex',gap:6,marginTop:12}}>
          <input value={newC.name} onChange={e=>setNewC({...newC,name:e.target.value})} placeholder="e.g. Burlington NJ" style={{...inp,flex:1,minWidth:0}}/>
          <select value={newC.state} onChange={e=>setNewC({...newC,state:e.target.value})} style={inp}>{STATES.map(s=><option key={s}>{s}</option>)}</select>
          <button disabled={busy||!newC.name.trim()} onClick={()=>act(async()=>{ await saveCampaign(newC); setNewC({name:'',state:newC.state}) },'Campaign added.')} style={btn(true)}>Add</button>
        </div>

        {campaigns.length>0 &&
        <div style={{borderTop:'1px solid '+C.line,marginTop:16,paddingTop:12}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>Assign leads to a campaign</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',fontSize:12.5,color:C.muted}}>
            All unassigned leads in
            <select value={bulk.state} onChange={e=>setBulk({...bulk,state:e.target.value})} style={inp}><option value="all">any state</option>{STATES.map(s=><option key={s}>{s}</option>)}</select>
            ({unassigned(bulk.state).length}) →
            <select value={bulk.campaign} onChange={e=>setBulk({...bulk,campaign:e.target.value})} style={inp}><option value="">choose campaign</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button disabled={busy||!bulk.campaign||!unassigned(bulk.state).length} onClick={bulkAssign} style={btn(true)}>Assign</button>
          </div>
          <div style={{color:C.muted,fontSize:11.5,marginTop:6}}>You can also set a single lead's campaign when adding or editing it.</div>
        </div>}
      </div>

      <div style={card}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Team</div>
        {team.map(m=>{
          const e = edit[m.id]
          return (
            <div key={m.id} style={{padding:'10px 0',borderBottom:'1px solid '+C.line}}>
              {!e ?
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13}}>{m.name}</div>
                  <div style={{color:C.muted,fontSize:11.5}}>{m.dial_goal} dials · {m.offer_goal} offers a day · {(m.campaigns||[]).map(id=>(campaigns.find(c=>String(c.id)===String(id))||{}).name).filter(Boolean).join(', ')||'no counties'}</div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setEdit({...edit,[m.id]:{...m,campaigns:(m.campaigns||[]).map(String)}})} style={{...btn(false),padding:'5px 9px'}}>Edit</button>
                  <button onClick={()=>{ if(confirm('Remove '+m.name+' from the team? Their call history stays.')) act(()=>deleteMember(m.id)) }} style={{...btn(false),padding:'5px 9px'}}>Remove</button>
                </div>
              </div> :
              <div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:6,marginBottom:8}}>
                  <input value={e.name} onChange={x=>setEdit({...edit,[m.id]:{...e,name:x.target.value}})} style={cell}/>
                  <input type="number" value={e.dial_goal} onChange={x=>setEdit({...edit,[m.id]:{...e,dial_goal:x.target.value}})} title="Daily dial goal" style={cell}/>
                  <input type="number" value={e.offer_goal} onChange={x=>setEdit({...edit,[m.id]:{...e,offer_goal:x.target.value}})} title="Daily offer goal" style={cell}/>
                </div>
                <CampChecks value={e.campaigns} onChange={v=>setEdit({...edit,[m.id]:{...e,campaigns:v}})}/>
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <button disabled={busy||!e.name.trim()} onClick={()=>act(async()=>{ await saveMember(e); setEdit(x=>{ const n={...x}; delete n[m.id]; return n }) },'Saved '+e.name+'.')} style={btn(true)}>Save</button>
                  <button onClick={()=>setEdit(x=>{ const n={...x}; delete n[m.id]; return n })} style={btn(false)}>Cancel</button>
                </div>
              </div>}
            </div>
          )
        })}

        <div style={{marginTop:12,background:C.ink,borderRadius:10,padding:12}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Add a VA</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:6,marginBottom:4}}>
            <input value={newM.name} onChange={e=>setNewM({...newM,name:e.target.value})} placeholder="Name" style={cell}/>
            <input type="number" value={newM.dial_goal} onChange={e=>setNewM({...newM,dial_goal:e.target.value})} style={cell}/>
            <input type="number" value={newM.offer_goal} onChange={e=>setNewM({...newM,offer_goal:e.target.value})} style={cell}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:6,color:C.muted,fontSize:10.5,marginBottom:8}}><span></span><span>dials / day</span><span>offers / day</span></div>
          <CampChecks value={newM.campaigns} onChange={v=>setNewM({...newM,campaigns:v})}/>
          <button disabled={busy||!newM.name.trim()} onClick={()=>act(async()=>{ await saveMember(newM); setNewM({name:'',dial_goal:60,offer_goal:3,campaigns:[]}) },'VA added. They can now pick their name at the top of this page.')} style={{...btn(true),marginTop:10}}>Add VA</button>
        </div>
      </div>
      <div style={{gridColumn:'1/-1',color:C.muted,fontSize:11.5,lineHeight:1.5}}>Stats are matched by name: a VA's calls count when the Caller name on their calls matches their name here. Picking a name at the top sets it automatically.</div>
    </div>
  )
}
