import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AcademyPage from './AcademyPage'
import CommandCenter from './CommandCenter'

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

function eqOf(l){ return l.arv>0 ? Math.min(100, Math.round((1 - l.owed/l.arv)*100)) : 0 }
function scoreOf(l){
  const fresh = l.freshness
  const contact = Math.max(0, 100 - l.times_contacted*28)
  const mot = l.motivation
  const eq = eqOf(l)
  const skip = l.skiptraced ? 100 : 40
  return Math.round(fresh*0.25 + contact*0.25 + mot*0.2 + eq*0.15 + skip*0.15)
}
function grade(s){
  if(s>=80) return {g:'A',c:C.green,label:'Prime lead'}
  if(s>=65) return {g:'B',c:C.amber,label:'Solid lead'}
  if(s>=50) return {g:'C',c:C.orange,label:'Workable'}
  return {g:'D',c:C.red,label:'Low priority'}
}
const money = n => '$'+Number(n||0).toLocaleString()
function freshLabel(f){ if(f>=90) return 'New · fresh'; if(f>=60) return 'Recent'; if(f>=30) return 'Aging'; return 'Stale' }

const REPAIRS = [
  ['roof','Roof',8000,15000],
  ['hvac','HVAC / furnace',5000,10000],
  ['water_heater','Hot water tank',1500,3000],
  ['foundation','Foundation',10000,30000],
  ['electrical','Electrical',4000,8000],
  ['plumbing','Plumbing',3000,8000],
  ['kitchen','Kitchen',10000,25000],
  ['bathrooms','Bathrooms',5000,15000],
  ['windows','Windows',5000,12000],
  ['flooring','Flooring',3000,10000],
]

const BLANK_DETAILS = { beds:'', baths:'', sqft:'', year_built:'', occupancy:'Unknown',
  asking_price:'', timeline:'Unsure', sell_reason:'Unknown', repairs:{}, repair_notes:'', seller_notes:'' }

const BLANK = { name:'', address:'', city:'', state:'NJ', lead_type:'Lis Pendens',
  arv:'', owed:'', phone:'', freshness:100, times_contacted:0, motivation:50, skiptraced:false,
  details: BLANK_DETAILS }

function detailsOf(l){
  const d = l.details || {}
  return {...BLANK_DETAILS, ...d, repairs: d.repairs || {}}
}

function friendlyErr(msg){
  const m = String(msg||'')
  if(/failed to fetch|network|fetch/i.test(m)) return "Can't reach the database right now. It may still be waking up — give it a minute, then hit Retry."
  if(/details.*column|column.*details|schema cache/i.test(m)) return "The database is missing the new 'details' column. Run supabase/add-details-column.sql (in your repo) in the Supabase SQL Editor, then retry."
  return m
}

const NAV = [
  ['leads','L','Leads + VA'],
  ['command','H','Command Center'],
  ['pipeline','P','Pipeline'],
  ['comping','C','Comping'],
  ['academy','A','Academy'],
]

export default function App(){
  const isMobile = useIsMobile()
  const [page,setPage] = useState('leads')
  const [menuOpen,setMenuOpen] = useState(false)
  const [leads,setLeads] = useState([])
  const [loading,setLoading] = useState(true)
  const [err,setErr] = useState('')

  useEffect(()=>{ load() },[])
  async function load(){
    setLoading(true)
    try{
      const { data, error } = await supabase.from('leads').select('*')
      if(error) throw error
      setLeads(data||[]); setErr('')
    }catch(e){ setErr(friendlyErr(e.message)) }
    setLoading(false)
  }
  const go = (p)=>{ setPage(p); setMenuOpen(false) }

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.navy,fontFamily:'Helvetica Neue,Arial',color:C.cream}}>
      {!isMobile &&
      <div style={{width:210,background:C.ink,borderRight:'1px solid '+C.line,padding:'22px 14px',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 6px 20px',borderBottom:'1px solid '+C.line,marginBottom:14}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:800,lineHeight:1}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
          <div style={{color:C.muted,fontSize:9,letterSpacing:2,textTransform:'uppercase',marginTop:4}}>by Icole Agency</div>
        </div>
        {NAV.map(([id,i,l])=>(
          <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:11,background:page===id?C.orange:'transparent',color:page===id?C.ink:C.muted,borderRadius:9,padding:'11px 13px',fontSize:13,fontWeight:600,marginBottom:3,cursor:'pointer'}}>
            <span style={{fontSize:12,fontWeight:800,width:16}}>{i}</span>{l}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{background:C.panel,borderRadius:12,padding:13}}>
          <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Your VA today</div>
          <div style={{fontSize:12,marginTop:5}}>124 dials, 19 contacts</div>
          <div style={{color:C.green,fontSize:12}}>4 appointments set</div>
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
          {NAV.map(([id,i,l])=>(
            <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:10,background:page===id?C.orange:'transparent',color:page===id?C.ink:C.muted,borderRadius:8,padding:'10px 12px',fontSize:13,fontWeight:600,marginBottom:3}}>
              <span style={{fontWeight:800,width:16}}>{i}</span>{l}
            </div>
          ))}
        </div>}

        <div style={{padding:isMobile?'18px 16px':'26px 30px',width:'100%',maxWidth:1240,margin:0,boxSizing:'border-box'}}>
          {err && <ErrorBanner msg={err} onRetry={load} onClose={()=>setErr('')}/>}
          {page==='leads' && <LeadsPage leads={leads} loading={loading} reload={load} loadErr={err} isMobile={isMobile}/>}
          {page==='comping' && <CompingPage leads={leads} isMobile={isMobile}/>}
          {page==='academy' && <AcademyPage isMobile={isMobile}/>}
          {page==='command' && <CommandCenter leads={leads} isMobile={isMobile} goTo={go}/>}
          {page==='pipeline' && <Placeholder title="Pipeline" desc="Your leads as a drag-and-drop deal board: New Lead to Contact Made to Under Contract to Closing. Coming soon."/>}
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

function Placeholder({title,desc}){
  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:27,margin:0,fontWeight:600}}>{title}</h1>
      <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:40,marginTop:20,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>[ ]</div>
        <div style={{color:C.cream,fontSize:16,fontWeight:600,marginBottom:8}}>Coming soon</div>
        <p style={{color:C.muted,fontSize:14,maxWidth:460,margin:'0 auto',lineHeight:1.5}}>{desc}</p>
      </div>
    </div>
  )
}

function LeadsPage({leads,loading,reload,loadErr,isMobile}){
  const [selId,setSelId] = useState(null)
  const [showAdd,setShowAdd] = useState(false)
  const [form,setForm] = useState(BLANK)
  const [filter,setFilter] = useState('All')
  const [formErr,setFormErr] = useState('')
  const [saving,setSaving] = useState(false)
  const [editId,setEditId] = useState(null)

  const ranked = [...leads].sort((a,b)=>scoreOf(b)-scoreOf(a))
  const shown = ranked.filter(l=> filter==='All' || l.state===filter)
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
          <Sel v={form.lead_type} on={v=>set('lead_type',v)} opts={['Lis Pendens','Pre-Foreclosure','Tax Delinquent','Vacant','Inherited','Divorce']}/>
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
                    <Tag c={C.blue}>{freshLabel(l.freshness)}</Tag>
                    {l.times_contacted===0? <Tag c={C.green}>Never called</Tag> : <Tag c={l.times_contacted<=1?C.amber:C.red}>{l.times_contacted}x called</Tag>}
                    {l.skiptraced && <Tag c={C.green}>traced</Tag>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {sel && <LeadDetail key={sel.id} lead={sel} onDelete={()=>remove(sel.id)} onEdit={()=>openEdit(sel)} isMobile={isMobile}/>}
      </div>}
    </div>
  )
}

function LeadDetail({lead,onDelete,onEdit,isMobile}){
  const s=scoreOf(lead); const g=grade(s); const eq=eqOf(lead)
  const [msgs,setMsgs]=useState([
    {f:'va',t:'now',m:'Working '+lead.name.split(' ')[0]+' now. '+(lead.times_contacted===0?'Never contacted by another investor - fresh.':'Prior contact logged ('+lead.times_contacted+'x).')+' I will report back after calls.'}
  ])
  const [draft,setDraft]=useState('')
  const send=()=>{ if(!draft.trim())return; setMsgs([...msgs,{f:'you',t:'now',m:draft.trim()}]); setDraft('') }

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

        <CallCard lead={lead} onEdit={onEdit}/>

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
        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22,display:'flex',flexDirection:'column',minHeight:isMobile?360:420}}>
        <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:14,borderBottom:'1px solid '+C.line,marginBottom:14}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,'+C.orange+','+C.orangeSoft+')',display:'flex',alignItems:'center',justifyContent:'center',color:C.ink,fontWeight:800,flexShrink:0}}>S</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14}}>Sofia - Your VA</div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:6,height:6,borderRadius:6,background:C.green}}/>
              <span style={{color:C.green,fontSize:11}}>working this lead now</span>
            </div>
          </div>
          <span style={{color:C.muted,fontSize:11,whiteSpace:'nowrap'}}>on {lead.name.split(' ')[0]}</span>
        </div>
        <div style={{flex:1,overflowY:'auto',paddingRight:4,minHeight:120}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.f==='you'?'flex-end':'flex-start',marginBottom:10}}>
              <div style={{maxWidth:'82%',background:m.f==='you'?C.orange:C.panel2,color:m.f==='you'?C.ink:C.cream,border:m.f==='you'?'none':'1px solid '+C.line,padding:'11px 14px',borderRadius:14,fontSize:13,lineHeight:1.45}}>
                {m.m}<div style={{fontSize:10,opacity:0.65,marginTop:5}}>{m.t}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message Sofia..." style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:10,padding:'11px 14px',color:C.cream,fontSize:13,outline:'none'}}/>
          <button onClick={send} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'0 20px',fontWeight:800,cursor:'pointer'}}>Send</button>
        </div>
        <div style={{color:C.muted,fontSize:10,marginTop:8,textAlign:'center'}}>Preview - live VA messaging connects in the next build.</div>
      </div>
      </div>
    </div>
  )
}

function CallCard({lead,onEdit}){
  const d = detailsOf(lead)
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const lo = flagged.reduce((s,r)=>s+r[2],0)
  const hi = flagged.reduce((s,r)=>s+r[3],0)
  const ask = Number(d.asking_price)||0
  const arv = Number(lead.arv)||0
  const ceiling = arv ? Math.max(0, Math.round(arv*0.70 - hi - 15000)) : 0
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
        <button onClick={onEdit} style={{background:'transparent',border:'1px solid '+C.line,color:C.muted,borderRadius:8,padding:'5px 11px',fontSize:11,cursor:'pointer'}}>Update</button>
      </div>

      {empty ?
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
          Seller wants <b>{money(ask)}</b>. With {flagged.length>0?'the repairs above':'repairs'} + your fee, your 70%-rule ceiling is about <b style={{color:C.orange}}>{money(ceiling)}</b>{ask>ceiling?' — that gap is the conversation.':' — asking is already inside your number.'}
        </div>}

        {d.repair_notes && <div style={{marginBottom:8}}><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Condition notes</div><div style={{color:C.cream,fontSize:13,lineHeight:1.5}}>{d.repair_notes}</div></div>}
        {d.seller_notes && <div><div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Seller notes</div><div style={{color:C.cream,fontSize:13,lineHeight:1.5}}>{d.seller_notes}</div></div>}
      </div>}
    </div>
  )
}

function ScriptPanel({lead}){
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
  const ceiling = arv ? Math.max(0, Math.round(arv*0.70 - (flagged.length?hi:20000) - 15000)) : 0
  const offerTxt = ceiling ? 'about '+money(ceiling) : '[your offer]'
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

function CompingPage({leads,isMobile}){
  const [arv,setArv] = useState('')
  const [repairs,setRepairs] = useState('')
  const [fee,setFee] = useState('15000')
  const [address,setAddress] = useState('')

  const arvN = Number(arv)||0
  const repairsN = Number(repairs)||0
  const feeN = Number(fee)||0
  const mao = Math.max(0, Math.round(arvN*0.70 - repairsN - feeN))

  function loadLead(l){
    setAddress((l.address||'')+' '+l.city+' '+l.state)
    setArv(String(l.arv||''))
  }

  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Comping and Offer</h1>
      <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Run the 70% rule: Max Offer = (ARV x 0.70) - repairs - your assignment fee.</p>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16,marginTop:20,alignItems:'start'}}>
        <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
          <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Property and Numbers</div>
          <Labeled label="Property address"><In ph="123 Main St, City ST" v={address} on={setAddress}/></Labeled>
          <Labeled label="After Repair Value (ARV)"><In ph="421000" v={arv} on={setArv} type="number"/></Labeled>
          <Labeled label="Estimated repairs"><In ph="35000" v={repairs} on={setRepairs} type="number"/></Labeled>
          <Labeled label="Your assignment fee"><In ph="15000" v={fee} on={setFee} type="number"/></Labeled>
          {leads.length>0 &&
          <div style={{marginTop:16}}>
            <div style={{color:C.muted,fontSize:12,marginBottom:8}}>Or pull from a lead:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {leads.slice(0,6).map(l=>(
                <button key={l.id} onClick={()=>loadLead(l)} style={{background:C.ink,border:'1px solid '+C.line,color:C.cream,borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>{l.name}</button>
              ))}
            </div>
          </div>}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'linear-gradient(135deg,'+C.orange+','+C.orangeSoft+')',borderRadius:16,padding:26,textAlign:'center'}}>
            <div style={{color:C.ink,fontSize:12,textTransform:'uppercase',letterSpacing:1,fontWeight:800}}>Your Max Allowable Offer</div>
            <div style={{color:C.ink,fontFamily:'Georgia,serif',fontSize:isMobile?38:46,fontWeight:800,margin:'6px 0 2px'}}>{money(mao)}</div>
            <div style={{color:'rgba(8,16,25,0.7)',fontSize:12}}>{address||'Enter a property above'}</div>
          </div>
          <div style={{background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:22}}>
            <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>The Math</div>
            <MathRow label="ARV" val={money(arvN)}/>
            <MathRow label="x 70%" val={money(Math.round(arvN*0.70))}/>
            <MathRow label="- Repairs" val={'-'+money(repairsN)}/>
            <MathRow label="- Your fee" val={'-'+money(feeN)}/>
            <div style={{height:1,background:C.line,margin:'12px 0'}}/>
            <MathRow label="= Max offer" val={money(mao)} bold/>
            <div style={{marginTop:16,padding:'12px 14px',background:C.ink,borderRadius:10,color:C.muted,fontSize:12,lineHeight:1.5}}>The 70% rule leaves room for your buyer profit and holding costs. Offer at or below this number to keep the deal attractive to cash buyers.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Labeled({label,children}){
  return <div style={{marginBottom:14}}><div style={{color:C.muted,fontSize:12,marginBottom:5}}>{label}</div>{children}</div>
}
function MathRow({label,val,bold}){
  return <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0'}}>
    <span style={{color:bold?C.cream:C.muted,fontSize:bold?15:13,fontWeight:bold?700:400}}>{label}</span>
    <span style={{color:bold?C.orange:C.cream,fontSize:bold?18:13,fontWeight:bold?800:600}}>{val}</span>
  </div>
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
