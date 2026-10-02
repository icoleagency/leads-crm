import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import AcademyPage from './AcademyPage'
import TodayPage from './TodayPage'
import KpiPage from './KpiPage'
import { REPAIRS, BLANK_DETAILS, detailsOf, money, callbackOf, callbackState, eqOf, scoreOf, stageOf, STAGE } from './leadModel'
import Pipeline from './Pipeline'
import { CallCard, ScriptPanel, LogCall, HandoffPanel, PeoplePanel } from './LeadPanels'
import VaWorkspace from './VaWorkspace'
import ListStacking from './ListStacking'
import { TYPE_NAMES } from './stacking'
import { fetchTeam, teamErr as teamErrMsg, campaignOf, campaignName, getMe, setMe } from './team'
import DealAnalyzer from './DealAnalyzer'
import { fetchActivity, activityErr, tally, inLastDays } from './activity'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

function useIsMobile(){
  const [m,setM] = useState(typeof window!=='undefined' && window.innerWidth<860)
  useEffect(()=>{
    const on=()=>setM(window.innerWidth<860)
    window.addEventListener('resize',on); return ()=>window.removeEventListener('resize',on)
  },[])
  return m
}

function grade(s){
  if(s>=80) return {g:'A',c:C.green,label:'Prime lead'}
  if(s>=65) return {g:'B',c:C.amber,label:'Solid lead'}
  if(s>=50) return {g:'C',c:C.orange,label:'Workable'}
  return {g:'D',c:C.red,label:'Low priority'}
}
function freshLabel(f){ if(f>=90) return 'New · fresh'; if(f>=60) return 'Recent'; if(f>=30) return 'Aging'; return 'Stale' }

const BLANK = { name:'', address:'', city:'', state:'NJ', lead_type:'Lis Pendens',
  arv:'', owed:'', phone:'', freshness:100, times_contacted:0, motivation:50, skiptraced:false,
  details: BLANK_DETAILS }

function friendlyErr(msg){
  const m = String(msg||'')
  if(/failed to fetch|network|fetch/i.test(m)) return "Can't reach the database right now. It may still be waking up — give it a minute, then hit Retry."
  if(/details.*column|column.*details|schema cache/i.test(m)) return "The database is missing the new 'details' column. Run supabase/add-details-column.sql (in your repo) in the Supabase SQL Editor, then retry."
  return m
}

const NAV = [
  ['today','T','Today'],
  ['leads','L','Leads'],
  ['lists','S','List Stacking'],
  ['va','V','VA Workspace'],
  ['kpis','K','KPIs'],
  ['pipeline','P','Pipeline'],
  ['comping','D','Deal Analyzer'],
  ['academy','A','Academy'],
]

export default function App(){
  const isMobile = useIsMobile()
  const [page,setPage] = useState(()=>{ const m=getMe(); return m && m!=='owner' ? 'va' : 'today' })
  const [meId,setMeId] = useState(getMe())
  const onMe = id => { setMe(id); setMeId(id) }
  const [menuOpen,setMenuOpen] = useState(false)
  const [leads,setLeads] = useState([])
  const [loading,setLoading] = useState(true)
  const [err,setErr] = useState('')
  const [activity,setActivity] = useState([])
  const [actErr,setActErr] = useState('')
  const [analyzeId,setAnalyzeId] = useState('')
  const [focusId,setFocusId] = useState('')
  const [campaigns,setCampaigns] = useState([])
  const [team,setTeam] = useState([])
  const [tErr,setTErr] = useState('')
  const reloadQuiet = ()=>load(true)
  const reloadAll = useCallback(()=>{ load(true); loadActivity() },[])  // eslint-disable-line

  useEffect(()=>{ load(); loadActivity(); loadTeam() },[])
  async function loadTeam(){
    try{ const r = await fetchTeam(); setCampaigns(r.campaigns); setTeam(r.team); setTErr('') }
    catch(e){ setTErr(teamErrMsg(e.message)) }
  }
  async function load(silent){
    if(silent!==true) setLoading(true)
    try{
      const { data, error } = await supabase.from('leads').select('*')
      if(error) throw error
      setLeads(data||[]); setErr('')
    }catch(e){ setErr(friendlyErr(e.message)) }
    setLoading(false)
  }
  async function loadActivity(){
    try{ setActivity(await fetchActivity(90)); setActErr('') }
    catch(e){ setActErr(activityErr(e.message)) }
  }
  const go = (p)=>{ if(p==='comping') setAnalyzeId(''); setPage(p); setMenuOpen(false) }
  const openLead = (id)=>{ setFocusId(String(id)); setPage('leads'); window.scrollTo({top:0}) }
  const analyzeLead = (id)=>{ setAnalyzeId(String(id)); setPage('comping'); window.scrollTo({top:0}) }
  const today = tally(inLastDays(activity,1))
  const meMember = team.find(m=>String(m.id)===meId)
  const vaMode = !!meMember && meId!=='owner'
  const VA_PAGES = ['va','academy']
  const navItems = vaMode ? NAV.filter(([id])=>VA_PAGES.includes(id)) : NAV
  const view = vaMode && !VA_PAGES.includes(page) ? 'va' : page

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.navy,fontFamily:'Helvetica Neue,Arial',color:C.cream}}>
      {!isMobile &&
      <div style={{width:210,background:C.ink,borderRight:'1px solid '+C.line,padding:'22px 14px',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 6px 20px',borderBottom:'1px solid '+C.line,marginBottom:14}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:800,lineHeight:1}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
          <div style={{color:C.muted,fontSize:9,letterSpacing:2,textTransform:'uppercase',marginTop:4}}>by Icole Agency</div>
        </div>
        {vaMode && <div onClick={()=>go('va')} style={{background:C.panel,borderRadius:10,padding:'9px 12px',marginBottom:12,fontSize:12,cursor:'pointer'}}><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Working as</div><div style={{fontWeight:700,marginTop:2}}>{meMember.name}</div></div>}
        {navItems.map(([id,i,l])=>(
          <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:11,background:view===id?C.orange:'transparent',color:view===id?C.ink:C.muted,borderRadius:9,padding:'11px 13px',fontSize:13,fontWeight:600,marginBottom:3,cursor:'pointer'}}>
            <span style={{fontSize:12,fontWeight:800,width:16}}>{i}</span>{l}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div onClick={()=>go('kpis')} style={{background:C.panel,borderRadius:12,padding:13,cursor:'pointer'}}>
          <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Team today</div>
          <div style={{fontSize:12,marginTop:5}}>{today.dials} dials, {today.contacts} contacts</div>
          <div style={{color:C.green,fontSize:12}}>{today.appointment} appts · {today.offer} offers</div>
        </div>
      </div>}

      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        {isMobile &&
        <div style={{background:C.ink,borderBottom:'1px solid '+C.line,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:800}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
          <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:'transparent',border:'1px solid '+C.line,color:C.cream,borderRadius:8,padding:'6px 12px',fontSize:18,cursor:'pointer'}}>=</button>
        </div>}
        {isMobile && menuOpen &&
        <div style={{background:C.ink,borderBottom:'1px solid '+C.line,padding:'8px 12px'}}>
          {navItems.map(([id,i,l])=>(
            <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:10,background:view===id?C.orange:'transparent',color:view===id?C.ink:C.muted,borderRadius:8,padding:'10px 12px',fontSize:13,fontWeight:600,marginBottom:3}}>
              <span style={{fontWeight:800,width:16}}>{i}</span>{l}
            </div>
          ))}
        </div>}

        <div style={{padding:isMobile?'18px 16px':'26px 30px',width:'100%',maxWidth:1240,margin:0,boxSizing:'border-box'}}>
          {err && <ErrorBanner msg={err} onRetry={load} onClose={()=>setErr('')}/>}
          {view==='va' && <VaWorkspace leads={leads} activity={activity} campaigns={campaigns} team={team} teamErr={tErr} reloadTeam={loadTeam} reloadLeads={reloadQuiet} reloadActivity={loadActivity} meId={meId} onMe={onMe} isMobile={isMobile}/>}
          {view==='leads' && <LeadsPage key={focusId||'all'} initialSel={focusId} campaigns={campaigns} leads={leads} loading={loading} reload={load} reloadQuiet={reloadQuiet} loadErr={err} activity={activity} reloadActivity={loadActivity} onAnalyze={analyzeLead} isMobile={isMobile}/>}
          {view==='lists' && <ListStacking leads={leads} campaigns={campaigns} reloadLeads={reloadQuiet} openLead={openLead} isMobile={isMobile}/>}
          {view==='comping' && <DealAnalyzer key={analyzeId||'blank'} leads={leads} initialLeadId={analyzeId} reload={load} isMobile={isMobile}/>}
          {view==='academy' && <AcademyPage isMobile={isMobile}/>}
          {view==='today' && <TodayPage leads={leads} activity={activity} team={team} campaigns={campaigns} reload={reloadAll} openLead={openLead} goTo={go} isMobile={isMobile}/>}
          {view==='kpis' && <KpiPage leads={leads} campaigns={campaigns} activity={activity} actErr={actErr} reload={loadActivity} isMobile={isMobile} goTo={go}/>}
          {view==='pipeline' && <Pipeline leads={leads} activity={activity} reload={reloadQuiet} openLead={openLead} analyze={analyzeLead} isMobile={isMobile}/>}
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({msg,onRetry,onClose}){
  return (
    <div style={{background:C.red+'1e',border:'1px solid '+C.red+'66',borderRadius:12,padding:'13px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <span style={{color:C.red,fontSize:13,flex:1,minWidth:200,lineHeight:1.45}}>{msg}</span>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <button onClick={onRetry} style={{background:C.red,color:C.cream,border:'none',borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Retry</button>
        <button onClick={onClose} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>Dismiss</button>
      </div>
    </div>
  )
}

function LeadsPage({leads,campaigns=[],loading,reload,reloadQuiet,loadErr,activity,reloadActivity,onAnalyze,initialSel,isMobile}){
  const [campFilter,setCampFilter] = useState('')
  const [selId,setSelId] = useState(()=>{ const l=leads.find(x=>String(x.id)===String(initialSel)); return l?l.id:null })
  const [showAdd,setShowAdd] = useState(false)
  const [form,setForm] = useState(BLANK)
  const [filter,setFilter] = useState('All')
  const [formErr,setFormErr] = useState('')
  const [saving,setSaving] = useState(false)
  const [editId,setEditId] = useState(null)

  const ranked = [...leads].sort((a,b)=>scoreOf(b)-scoreOf(a))
  const shown = ranked.filter(l=> (filter==='All' || l.state===filter) && (!campFilter || (campFilter==='none' ? !campaignOf(l) : campaignOf(l)===campFilter)))
  const sel = leads.find(l=>l.id===selId) || shown[0] || null
  const set = (k,v)=> setForm({...form,[k]:v})
  const setD = (k,v)=> setForm({...form, details:{...form.details,[k]:v}})

  function openAdd(){
    if(showAdd && !editId){ setShowAdd(false); return }
    setForm({...BLANK, details:{...BLANK_DETAILS, repairs:{}}})
    setEditId(null); setFormErr(''); setShowAdd(true)
  }
  function openEdit(l){
    setForm({
      name:l.name||'', address:l.address||'', city:l.city||'', state:l.state||'NJ',
      lead_type:l.lead_type||'Lis Pendens', arv:l.arv||'', owed:l.owed||'', phone:l.phone||'',
      freshness:l.freshness??100, times_contacted:l.times_contacted??0, motivation:l.motivation??50,
      skiptraced:!!l.skiptraced, details: detailsOf(l)
    })
    setEditId(l.id); setFormErr(''); setShowAdd(true)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function save(){
    if(!form.name.trim()){ setFormErr('Add an owner name before saving.'); return }
    setSaving(true); setFormErr('')
    try{
      const numOr = v => v===''||v===null||v===undefined ? null : (Number(v)||null)
      const d = form.details
      const payload = {...form, arv:Number(form.arv)||0, owed:Number(form.owed)||0,
        details:{...d, beds:numOr(d.beds), baths:numOr(d.baths), sqft:numOr(d.sqft),
          year_built:numOr(d.year_built), asking_price:numOr(d.asking_price)}}
      const { error } = editId
        ? await supabase.from('leads').update(payload).eq('id',editId)
        : await supabase.from('leads').insert([payload])
      if(error) throw error
      setForm({...BLANK, details:{...BLANK_DETAILS, repairs:{}}})
      setShowAdd(false); setEditId(null); reload()
    }catch(e){ setFormErr(friendlyErr(e.message)) }
    setSaving(false)
  }
  async function remove(id){
    if(!confirm('Delete this lead? This cannot be undone.')) return
    try{
      const { error } = await supabase.from('leads').delete().eq('id',id)
      if(error) throw error
      setSelId(null); reload()
    }catch(e){ setFormErr(friendlyErr(e.message)) }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Leads + Your VA</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Ranked by lead quality - freshness, contact history, motivation, equity and skip-trace.</p>
        </div>
        <button onClick={openAdd} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 20px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>{showAdd&&!editId?'Close':'+ Add Lead'}</button>
      </div>

      {showAdd &&
      <div style={{background:C.panel,border:'1px solid '+(editId?C.orange:C.line),borderRadius:14,padding:20,marginBottom:18}}>
        {editId && <div style={{color:C.orange,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Editing: {form.name||'lead'}</div>}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10}}>
          <In ph="Owner name" v={form.name} on={v=>set('name',v)}/>
          <In ph="Phone" v={form.phone} on={v=>set('phone',v)}/>
          <In ph="Address" v={form.address} on={v=>set('address',v)}/>
          <In ph="City" v={form.city} on={v=>set('city',v)}/>
          <Sel v={form.state} on={v=>set('state',v)} opts={['NJ','FL','DE','PA','Other']}/>
          <Sel v={form.lead_type} on={v=>set('lead_type',v)} opts={[...new Set(['Lis Pendens','Pre-Foreclosure','Tax Delinquent','Vacant','Inherited','Divorce',...TYPE_NAMES, form.lead_type].filter(Boolean))]}/>
          {campaigns.length>0 &&
          <select value={form.details.campaign||''} onChange={e=>setD('campaign',e.target.value)} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:form.details.campaign?C.cream:C.muted,fontSize:13,width:'100%',boxSizing:'border-box'}}>
            <option value="">Campaign (county)...</option>
            {campaigns.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>}
          <In ph="ARV" v={form.arv} on={v=>set('arv',v)} type="number"/>
          <In ph="Owed" v={form.owed} on={v=>set('owed',v)} type="number"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:14,marginTop:14}}>
          <Slider label={'Freshness: '+form.freshness} v={form.freshness} mn={0} mx={100} on={v=>set('freshness',v)}/>
          <Slider label={'Motivation: '+form.motivation} v={form.motivation} mn={0} mx={100} on={v=>set('motivation',v)}/>
          <Slider label={'Times called before: '+form.times_contacted} v={form.times_contacted} mn={0} mx={6} on={v=>set('times_contacted',v)}/>
        </div>
        <label style={{display:'flex',gap:8,alignItems:'center',marginTop:14,fontSize:13,color:C.muted}}>
          <input type="checkbox" checked={form.skiptraced} onChange={e=>set('skiptraced',e.target.checked)}/> Skip-trace confirmed
        </label>

        <div style={{borderTop:'1px solid '+C.line,marginTop:18,paddingTop:16}}>
          <div style={{color:C.orange,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Property & Seller Intel</div>
          <div style={{color:C.muted,fontSize:12,marginBottom:12}}>This becomes the Call Card your caller sees while negotiating.</div>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:10}}>
            <In ph="Beds" v={form.details.beds} on={v=>setD('beds',v)} type="number"/>
            <In ph="Baths" v={form.details.baths} on={v=>setD('baths',v)} type="number"/>
            <In ph="Sqft" v={form.details.sqft} on={v=>setD('sqft',v)} type="number"/>
            <In ph="Year built" v={form.details.year_built} on={v=>setD('year_built',v)} type="number"/>
            <Sel v={form.details.occupancy} on={v=>setD('occupancy',v)} opts={['Unknown','Owner occupied','Tenant','Vacant']}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10,marginTop:10}}>
            <In ph="Seller asking price" v={form.details.asking_price} on={v=>setD('asking_price',v)} type="number"/>
            <Sel v={form.details.timeline} on={v=>setD('timeline',v)} opts={['Unsure','ASAP','30 days','60 days','90+ days','Just testing market']}/>
            <Sel v={form.details.sell_reason} on={v=>setD('sell_reason',v)} opts={['Unknown','Foreclosure','Tax delinquent','Inherited / probate','Divorce','Tired landlord','Relocation','Vacant / repairs','Other']}/>
          </div>
          <div style={{color:C.muted,fontSize:12,margin:'14px 0 8px'}}>Repairs needed — check everything the seller mentions:</div>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:8}}>
            {REPAIRS.map(([k,label])=>(
              <label key={k} style={{display:'flex',gap:7,alignItems:'center',background:C.ink,border:'1px solid '+(form.details.repairs[k]?C.orange:C.line),borderRadius:8,padding:'9px 10px',fontSize:12,color:form.details.repairs[k]?C.cream:C.muted,cursor:'pointer'}}>
                <input type="checkbox" checked={!!form.details.repairs[k]} onChange={e=>setD('repairs',{...form.details.repairs,[k]:e.target.checked})}/>{label}
              </label>
            ))}
          </div>
          <textarea placeholder="Repair notes — what the seller said about condition (age of roof, leaks, last HVAC service...)" value={form.details.repair_notes} onChange={e=>setD('repair_notes',e.target.value)} rows={2} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginTop:12,resize:'vertical',fontFamily:'inherit'}}/>
          <textarea placeholder="Seller notes — situation, family, urgency, anything useful on the next call..." value={form.details.seller_notes} onChange={e=>setD('seller_notes',e.target.value)} rows={2} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',marginTop:10,resize:'vertical',fontFamily:'inherit'}}/>
        </div>

        {formErr && <div style={{background:C.red+'1e',border:'1px solid '+C.red+'55',color:C.red,borderRadius:8,padding:'10px 12px',fontSize:12.5,marginTop:14,lineHeight:1.45}}>{formErr}</div>}
        <button onClick={save} disabled={saving} style={{marginTop:16,background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 22px',fontWeight:800,cursor:saving?'default':'pointer',opacity:saving?0.7:1}}>{saving?'Saving...':editId?'Update Lead':'Save Lead'}</button>
      </div>}

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['All','NJ','FL','DE','PA'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{border:'1px solid '+(filter===s?C.orange:C.line),background:filter===s?C.orange:'transparent',color:filter===s?C.ink:C.muted,borderRadius:20,padding:'6px 14px',fontWeight:600,cursor:'pointer',fontSize:13}}>{s}</button>
        ))}
        {campaigns.length>0 &&
        <select value={campFilter} onChange={e=>setCampFilter(e.target.value)} style={{background:C.ink,border:'1px solid '+(campFilter?C.orange:C.line),borderRadius:20,padding:'6px 12px',color:campFilter?C.cream:C.muted,fontSize:13}}>
          <option value="">All campaigns</option>
          {campaigns.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}
          <option value="none">No campaign</option>
        </select>}
      </div>

      {loading ? <p style={{color:C.muted}}>Loading...</p> :
       loadErr && shown.length===0 ? <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:30,color:C.muted}}>Couldn't load your leads — see the message above, then hit Retry.</div> :
       shown.length===0 ? <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:14,padding:30,color:C.muted}}>No leads yet - tap "+ Add Lead" to start.</div> :
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'280px 1fr',gap:16,alignItems:'start'}}>
        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:14}}>
          <div style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1,padding:'4px 6px 10px'}}>Work Queue - best first</div>
          <div style={{display:isMobile?'grid':'block',gridTemplateColumns:isMobile?'1fr 1fr':'none',gap:isMobile?8:0}}>
            {shown.map(l=>{
              const s=scoreOf(l); const g=grade(s); const active=sel && l.id===sel.id
              return (
                <div key={l.id} onClick={()=>{ setSelId(l.id); if(isMobile){ window.scrollTo({top:0,behavior:'smooth'}) } }} style={{background:active?C.panel2:'transparent',border:'1px solid '+(active?C.orange:'transparent'),borderRadius:12,padding:13,marginBottom:isMobile?0:7,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <span style={{fontWeight:600,fontSize:14}}>{l.name}</span>
                    <span style={{width:26,height:26,borderRadius:7,background:g.c+'22',color:g.c,border:'1px solid '+g.c,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0}}>{g.g}</span>
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:3}}>{l.city}, {l.state} - {l.lead_type}</div>
                  <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                    {(()=>{ const st=stageOf(l,activity); return st!=='new' ? <Tag c={STAGE[st].c}>{STAGE[st].l}</Tag> : null })()}
                    {(()=>{ const cs=callbackState(callbackOf(l)); return cs && cs!=='later' ? <Tag c={cs==='overdue'?C.red:C.amber}>{cs==='overdue'?'Callback overdue':'Callback today'}</Tag> : null })()}
                    {(l.details&&l.details.stack>1) && <Tag c={l.details.stack>=4?C.red:l.details.stack===3?C.orange:C.amber}>On {l.details.stack} lists</Tag>}
                    {campaignOf(l) && campaignName(campaigns,campaignOf(l)) && <Tag c={C.muted}>{campaignName(campaigns,campaignOf(l))}</Tag>}
                    <Tag c={C.blue}>{freshLabel(l.freshness)}</Tag>
                    {l.times_contacted===0? <Tag c={C.green}>Never called</Tag> : <Tag c={l.times_contacted<=1?C.amber:C.red}>{l.times_contacted}x called</Tag>}
                    {l.skiptraced && <Tag c={C.green}>traced</Tag>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {sel && <LeadDetail key={sel.id} lead={sel} onDelete={()=>remove(sel.id)} onEdit={()=>openEdit(sel)} activity={activity} reloadActivity={reloadActivity} reloadLeads={reloadQuiet} onAnalyze={()=>onAnalyze(sel.id)} isMobile={isMobile}/>}
      </div>}
    </div>
  )
}

function LeadDetail({lead,onDelete,onEdit,activity,reloadActivity,reloadLeads,onAnalyze,isMobile}){
  const s=scoreOf(lead); const g=grade(s); const eq=eqOf(lead)

  return (
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16}}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:22,fontFamily:'Georgia,serif',fontWeight:600}}>{lead.name}</div>
              <div style={{color:C.muted,fontSize:13,marginTop:3}}>{lead.address}{lead.address?', ':''}{lead.city} {lead.state}</div>
              <div style={{color:C.muted,fontSize:13}}>{lead.lead_type} - {lead.phone||'no phone'}</div>
            </div>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{width:88,height:88,borderRadius:'50%',background:'conic-gradient('+g.c+' '+(s*3.6)+'deg, '+C.ink+' 0deg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:68,height:68,borderRadius:'50%',background:C.panel,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{color:g.c,fontSize:24,fontWeight:800,fontFamily:'Georgia,serif'}}>{g.g}</div>
                  <div style={{color:C.muted,fontSize:10}}>{s}/100</div>
                </div>
              </div>
              <div style={{color:g.c,fontSize:11,fontWeight:700,marginTop:6,whiteSpace:'nowrap'}}>{g.label}</div>
            </div>
          </div>
        </div>

        <CallCard lead={lead} onEdit={onEdit} onAnalyze={onAnalyze}/>
        <PeoplePanel lead={lead} reloadLeads={reloadLeads}/>

        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
          <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Lead Quality Signals</div>
          <Signal label="Freshness" value={lead.freshness} display={freshLabel(lead.freshness)} color={C.blue}/>
          <Signal label="Contact history" value={Math.max(0,100-lead.times_contacted*28)} display={lead.times_contacted===0?'Never called':lead.times_contacted+'x called'} color={lead.times_contacted===0?C.green:lead.times_contacted<=1?C.amber:C.red}/>
          <Signal label="Motivation" value={lead.motivation} display={lead.motivation+'/100'} color={C.orange}/>
          <Signal label="Equity" value={eq} display={eq+'% - '+money(lead.arv-lead.owed)} color={C.green}/>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16,padding:'12px 14px',background:C.ink,borderRadius:10}}>
            <span style={{fontSize:18}}>{lead.skiptraced?'[OK]':'[!]'}</span>
            <span style={{color:lead.skiptraced?C.green:C.amber,fontSize:13,fontWeight:600}}>{lead.skiptraced?'Skip-trace confirmed - verified contact':'Skip-trace incomplete - number unverified'}</span>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}>
            <button onClick={onEdit} style={{background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Edit lead</button>
            <button onClick={onDelete} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer'}}>Delete lead</button>
          </div>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <ScriptPanel lead={lead}/>
        <LogCall lead={lead} activity={activity} reloadActivity={reloadActivity} reloadLeads={reloadLeads}/>
        <HandoffPanel lead={lead} reloadLeads={reloadLeads}/>
      </div>
    </div>
  )
}

function Signal({label,value,display,color}){
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,gap:8}}>
        <span style={{color:C.muted,fontSize:12}}>{label}</span>
        <span style={{fontSize:12,fontWeight:600,textAlign:'right'}}>{display}</span>
      </div>
      <div style={{height:6,background:C.ink,borderRadius:6,overflow:'hidden'}}>
        <div style={{width:value+'%',height:'100%',background:color,borderRadius:6,transition:'width .4s'}}/>
      </div>
    </div>
  )
}
function Tag({children,c}){return <span style={{background:c+'1e',color:c,border:'1px solid '+c+'55',borderRadius:6,padding:'2px 7px',fontSize:10,fontWeight:700}}>{children}</span>}
function In({ph,v,on,type='text'}){return <input type={type} placeholder={ph} value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}}/>}
function Sel({v,on,opts}){return <select value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,width:'100%',boxSizing:'border-box'}}>{opts.map(o=><option key={o}>{o}</option>)}</select>}
function Slider({label,v,mn,mx,on}){return <div><label style={{fontSize:12,color:C.muted}}>{label}</label><input type="range" min={mn} max={mx} value={v} onChange={e=>on(+e.target.value)} style={{width:'100%',accentColor:C.orange}}/></div>}
