import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { tally, inLastDays } from './activity'
import { openHandoff } from './team'
import { patchLead } from './leadModel'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

function eqOf(l){ return l.arv>0 ? Math.min(100, Math.round((1 - l.owed/l.arv)*100)) : 0 }
function scoreOf(l){
  const fresh = l.freshness
  const contact = Math.max(0, 100 - l.times_contacted*28)
  const mot = l.motivation
  const eq = eqOf(l)
  const skip = l.skiptraced ? 100 : 40
  return Math.round(fresh*0.25 + contact*0.25 + mot*0.2 + eq*0.15 + skip*0.15)
}
function gradeLetter(s){ if(s>=80) return 'A'; if(s>=65) return 'B'; if(s>=50) return 'C'; return 'D' }
const money = n => '$'+Number(n||0).toLocaleString()

const ACADEMY_TOTAL = 20
const ASSIGN_FEE = 15000

export default function CommandCenter({leads,activity=[],reload,openLead,isMobile,goTo}){
  const [busyId,setBusyId] = useState(null)
  const [replyFor,setReplyFor] = useState(null)
  const [replyText,setReplyText] = useState('')
  const handoffs = leads.filter(l=>openHandoff(l)).sort((a,b)=>new Date(a.details.handoff.at)-new Date(b.details.handoff.at))
  async function handled(l){
    setBusyId(l.id)
    try{ await patchLead(l,{handoff:{...l.details.handoff,status:'done',done_at:new Date().toISOString(),reply:replyText.trim()||null}}); if(reload) await reload() }catch{ /* shown as still open */ }
    setBusyId(null); setReplyFor(null); setReplyText('')
  }
  const [academyPct,setAcademyPct] = useState(0)
  const today = tally(inLastDays(activity,1))

  useEffect(()=>{ loadAcademy() },[])
  async function loadAcademy(){
    const { data } = await supabase.from('academy_progress').select('*').eq('id','default').maybeSingle()
    const done = (data && data.completed) ? Object.values(data.completed).filter(Boolean).length : 0
    setAcademyPct(Math.round((done/ACADEMY_TOTAL)*100))
  }

  const scored = leads.map(l=>({...l, _s:scoreOf(l)}))
  const hot = scored.filter(l=>l._s>=65)
  const pipelineValue = leads.reduce((sum,l)=>sum + (Number(l.arv)||0), 0)
  const workable = scored.filter(l=>l._s>=50).length
  const projectedRev = workable * ASSIGN_FEE
  const avgScore = leads.length ? Math.round(scored.reduce((a,l)=>a+l._s,0)/leads.length) : 0
  const topHot = [...hot].sort((a,b)=>b._s-a._s).slice(0,4)

  const stats = [
    { label:'Hot Leads', value:hot.length, sub:'A & B grade', accent:C.red, go:'leads' },
    { label:'Pipeline Value', value:money(pipelineValue), sub:leads.length+' active leads', accent:C.orange, go:'pipeline' },
    { label:'Projected Fees', value:money(projectedRev), sub:workable+' workable x $15k', accent:C.green, go:'comping' },
    { label:'Avg Lead Quality', value:avgScore+'/100', sub:'across all leads', accent:C.blue, go:'leads' },
  ]

  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Command Center</h1>
      <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Everything moving in your business, right now.</p>

      {handoffs.length>0 &&
      <div style={{background:C.panel,border:'1px solid '+C.amber+'88',borderRadius:16,padding:20,marginTop:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontWeight:700,fontSize:14}}>Hot lead hand-offs <span style={{color:C.amber}}>({handoffs.length})</span></span>
          <span style={{color:C.muted,fontSize:11.5}}>From your VAs — oldest first</span>
        </div>
        {handoffs.map(l=>{ const h=l.details.handoff; const hrs=Math.floor((Date.now()-new Date(h.at).getTime())/3600000); return (
          <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 0',borderTop:'1px solid '+C.line,flexWrap:'wrap'}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{l.name} <span style={{color:C.muted,fontWeight:400,fontSize:12}}>· {l.city}, {l.state} · from {h.by} · {hrs<1?'just now':hrs<24?hrs+'h ago':Math.floor(hrs/24)+'d ago'}</span></div>
              {h.note && <div style={{color:C.cream,fontSize:13,marginTop:3,lineHeight:1.45}}>{h.note}</div>}
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>openLead&&openLead(l.id)} style={{background:C.orange,color:C.ink,border:'none',borderRadius:8,padding:'7px 13px',fontSize:12,fontWeight:800,cursor:'pointer'}}>Open lead</button>
              <button onClick={()=>{ setReplyFor(replyFor===l.id?null:l.id); setReplyText('') }} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>Handled</button>
            </div>
            {replyFor===l.id &&
            <div style={{flexBasis:'100%',display:'flex',gap:6,marginTop:4}}>
              <input autoFocus value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handled(l)} placeholder={'Reply to '+h.by+' (optional) — what happened?'} style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 11px',color:C.cream,fontSize:12.5,outline:'none'}}/>
              <button disabled={busyId===l.id} onClick={()=>handled(l)} style={{background:C.green,color:C.ink,border:'none',borderRadius:8,padding:'0 14px',fontSize:12,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>Save & close</button>
            </div>}
          </div>
        )})}
      </div>}

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:14,marginTop:20}}>
        {stats.map((s,i)=>(
          <div key={i} onClick={()=>goTo(s.go)} style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:'18px 18px',cursor:'pointer'}}>
            <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:'uppercase'}}>{s.label}</div>
            <div style={{color:s.accent,fontSize:isMobile?24:28,fontFamily:'Georgia,serif',marginTop:6,fontWeight:700}}>{s.value}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.3fr 1fr',gap:16,marginTop:16,alignItems:'start'}}>
        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontWeight:700,fontSize:14}}>Hot Leads Needing You</span>
            <button onClick={()=>goTo('leads')} style={{background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Open Leads</button>
          </div>
          {topHot.length===0 ? <div style={{color:C.muted,fontSize:13,padding:'10px 0'}}>No hot leads yet. Add leads or raise motivation/freshness to surface A & B grades.</div> :
          topHot.map(l=>{
            const gl = gradeLetter(l._s)
            const gc = gl==='A'?C.green:C.amber
            return (
              <div key={l.id} onClick={()=>goTo('leads')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid '+C.line,cursor:'pointer'}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{l.name}</div>
                  <div style={{color:C.muted,fontSize:11}}>{l.city}, {l.state} - {l.lead_type}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                  <span style={{color:C.green,fontSize:12,fontWeight:700}}>{eqOf(l)}% eq</span>
                  <span style={{width:26,height:26,borderRadius:7,background:gc+'22',color:gc,border:'1px solid '+gc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13}}>{gl}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Team Today</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <VaStat label="Dials made" val={today.dials}/>
              <VaStat label="Contacts reached" val={today.contacts}/>
              <VaStat label="Appointments set" val={today.appointment} green/>
              <VaStat label="Offers made" val={today.offer} green/>
            </div>
            <button onClick={()=>goTo('kpis')} style={{marginTop:14,width:'100%',background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'9px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Open KPIs</button>
          </div>

          <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:14}}>Academy Progress</span>
              <span style={{color:C.orange,fontWeight:800}}>{academyPct}%</span>
            </div>
            <div style={{height:10,background:C.ink,borderRadius:20,overflow:'hidden'}}>
              <div style={{width:academyPct+'%',height:'100%',background:'linear-gradient(90deg,'+C.orange+','+C.orangeSoft+')'}}/>
            </div>
            <button onClick={()=>goTo('academy')} style={{marginTop:14,width:'100%',background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'9px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Resume training</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VaStat({label,val,green}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
    <span style={{color:C.muted,fontSize:13}}>{label}</span>
    <span style={{color:green?C.green:C.cream,fontSize:15,fontWeight:700}}>{val}</span>
  </div>
}
