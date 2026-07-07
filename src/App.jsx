import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

const BLANK = { name:'', address:'', city:'', state:'NJ', lead_type:'Lis Pendens',
  arv:'', owed:'', phone:'', freshness:100, times_contacted:0, motivation:50, skiptraced:false }

const NAV = [
  ['leads','☺','Leads + VA'],
  ['command','◧','Command Center'],
  ['pipeline','≣','Pipeline'],
  ['comping','⊞','Comping'],
  ['academy','★','Academy'],
]

export default function App(){
  const isMobile = useIsMobile()
  const [page,setPage] = useState('leads')
  const [menuOpen,setMenuOpen] = useState(false)
  const [leads,setLeads] = useState([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{ load() },[])
  async function load(){
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*')
    if(error){ alert('Load error: '+error.message) }
    setLeads(data||[])
    setLoading(false)
  }

  const go = (p)=>{ setPage(p); setMenuOpen(false) }

  return (
    <div style={{display:'flex',minHeight:'100vh',background:C.navy,fontFamily:'Helvetica Neue,Arial',color:C.cream}}>
      {!isMobile &&
      <div style={{width:210,background:C.ink,borderRight:`1px solid ${C.line}`,padding:'22px 14px',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 6px 20px',borderBottom:`1px solid ${C.line}`,marginBottom:14}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:800,lineHeight:1}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
          <div style={{color:C.muted,fontSize:9,letterSpacing:2,textTransform:'uppercase',marginTop:4}}>by Icole Agency</div>
        </div>
        {NAV.map(([id,i,l])=>(
          <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:11,background:page===id?C.orange:'transparent',color:page===id?C.ink:C.muted,borderRadius:9,padding:'11px 13px',fontSize:13,fontWeight:600,marginBottom:3,cursor:'pointer'}}>
            <span style={{fontSize:15}}>{i}</span>{l}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{background:C.panel,borderRadius:12,padding:13}}>
          <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:1}}>Your VA today</div>
          <div style={{fontSize:12,marginTop:5}}>124 dials · 19 contacts</div>
          <div style={{color:C.green,fontSize:12}}>4 appointments set</div>
        </div>
      </div>}

      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        {isMobile &&
        <div style={{background:C.ink,borderBottom:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:800}}>WHOLESALE<span style={{color:C.orange}}>OS</span></div>
          <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:'transparent',border:`1px solid ${C.line}`,color:C.cream,borderRadius:8,padding:'6px 12px',fontSize:18,cursor:'pointer'}}>☰</button>
        </div>}
        {isMobile && menuOpen &&
        <div style={{background:C.ink,borderBottom:`1px solid ${C.line}`,padding:'8px 12px'}}>
          {NAV.map(([id,i,l])=>(
            <div key={id} onClick={()=>go(id)} style={{display:'flex',alignItems:'center',gap:10,background:page===id?C.orange:'transparent',color:page===id?C.ink:C.muted,borderRadius:8,padding:'10px 12px',fontSize:13,fontWeight:600,marginBottom:3}}>
              <span>{i}</span>{l}
            </div>
          ))}
        </div>}

        <div style={{padding:isMobile?'18px 16px':'26px 30px',width:'100%',maxWidth:1240,margin:'0 auto',boxSizing:'border-box'}}>
          {page==='leads' && <LeadsPage leads={leads} loading={loading} reload={load} isMobile={isMobile}/>}
          {page==='comping' && <CompingPage leads={leads} isMobile={isMobile}/>}
          {page==='command' && <Placeholder title="Command Center" desc="Your at-a-glance dashboard — hot leads, VA activity, pipeline value and revenue. Building next once Pipeline has data to summarize."/>}
          {page==='pipeline' && <Placeholder title="Pipeline" desc="Your leads as a drag-and-drop deal board: New Lead → Contact Made → Under Contract → Closing. Coming soon."/>}
          {page==='academy' && <Placeholder title="The Academy" desc="Your guided A-to-Z path from zero to your first assignment fee, with progress tracking. Coming soon."/>}
        </div>
      </div>
    </div>
  )
}

function Placeholder({title,desc}){
  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:27,margin:0,fontWeight:600}}>{title}</h1>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:40,marginTop:20,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🚧</div>
        <div style={{color:C.cream,fontSize:16,fontWeight:600,marginBottom:8}}>Coming soon</div>
        <p style={{color:C.muted,fontSize:14,maxWidth:460,margin:'0 auto',lineHeight:1.5}}>{desc}</p>
      </div>
    </div>
  )
}

/* ============ LEADS + VA PAGE ============ */
function LeadsPage({leads,loading,reload,isMobile}){
  const [selId,setSelId] = useState(null)
  const [showAdd,setShowAdd] = useState(false)
  const [form,setForm] = useState(BLANK)
  const [filter,setFilter] = useState('All')

  const ranked = [...leads].sort((a,b)=>scoreOf(b)-scoreOf(a))
  const shown = ranked.filter(l=> filter==='All' || l.state===filter)
  const sel = leads.find(l=>l.id===selId) || shown[0] || null
  const set = (k,v)=> setForm({...form,[k]:v})

  async function add(){
    if(!form.name.trim()){ alert('Add a name'); return }
    const payload = {...form, arv:Number(form.arv)||0, owed:Number(form.owed)||0}
    const { error } = await supabase.from('leads').insert([payload])
    if(error){ alert(error.message); return }
    setForm(BLANK); setShowAdd(false); reload()
  }
  async function remove(id){
    await supabase.from('leads').delete().eq('id',id)
    setSelId(null); reload()
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Leads + Your VA</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Ranked by lead quality — freshness, contact history, motivation, equity & skip-trace.</p>
        </div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 20px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>{showAdd?'Close':'+ Add Lead'}</button>
      </div>

      {showAdd &&
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:20,marginBottom:18}}>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:10}}>
          <In ph="Owner name" v={form.name} on={v=>set('name',v)}/>
          <In ph="Phone" v={form.phone} on={v=>set('phone',v)}/>
          <In ph="Address" v={form.address} on={v=>set('address',v)}/>
          <In ph="City" v={form.city} on={v=>set('city',v)}/>
          <Sel v={form.state} on={v=>set('state',v)} opts={['NJ','FL','DE','PA','Other']}/>
          <Sel v={form.lead_type} on={v=>set('lead_type',v)} opts={['Lis Pendens','Pre-Foreclosure','Tax Delinquent','Vacant','Inherited','Divorce']}/>
          <In ph="ARV ($)" v={form.arv} on={v=>set('arv',v)} type="number"/>
          <In ph="Owed ($)" v={form.owed} on={v=>set('owed',v)} type="number"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(3,1fr)',gap:14,marginTop:14}}>
          <Slider label={`Freshness: ${form.freshness}`} v={form.freshness} mn={0} mx={100} on={v=>set('freshness',v)}/>
          <Slider label={`Motivation: ${form.motivation}`} v={form.motivation} mn={0} mx={100} on={v=>set('motivation',v)}/>
          <Slider label={`Times called before: ${form.times_contacted}`} v={form.times_contacted} mn={0} mx={6} on={v=>set('times_contacted',v)}/>
        </div>
        <label style={{display:'flex',gap:8,alignItems:'center',marginTop:14,fontSize:13,color:C.muted}}>
          <input type="checkbox" checked={form.skiptraced} onChange={e=>set('skiptraced',e.target.checked)}/> Skip-trace confirmed
        </label>
        <button onClick={add} style={{marginTop:16,background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'11px 22px',fontWeight:800,cursor:'pointer'}}>Save Lead</button>
      </div>}

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['All','NJ','FL','DE','PA'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{border:`1px solid ${filter===s?C.orange:C.line}`,background:filter===s?C.orange:'transparent',color:filter===s?C.ink:C.muted,borderRadius:20,padding:'6px 14px',fontWeight:600,cursor:'pointer',fontSize:13}}>{s}</button>
        ))}
      </div>

      {loading ? <p style={{color:C.muted}}>Loading…</p> :
       shown.length===0 ? <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:14,padding:30,color:C.muted}}>No leads yet — tap "+ Add Lead" to start.</div> :
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'280px 1fr',gap:16,alignItems:'start'}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:14}}>
          <div style={{color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1,padding:'4px 6px 10px'}}>Work Queue · best first</div>
          <div style={{display:isMobile?'grid':'block',gridTemplateColumns:isMobile?'1fr 1fr':'none',gap:isMobile?8:0}}>
            {shown.map(l=>{
              const s=scoreOf(l); const g=grade(s); const active=sel && l.id===sel.id
              return (
                <div key={l.id} onClick={()=>{ setSelId(l.id); if(isMobile){ window.scrollTo({top:0,behavior:'smooth'}) } }} style={{background:active?C.panel2:'transparent',border:`1px solid ${active?C.orange:'transparent'}`,borderRadius:12,padding:13,marginBottom:isMobile?0:7,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <span style={{fontWeight:600,fontSize:14}}>{l.name}</span>
                    <span style={{width:26,height:26,borderRadius:7,background:g.c+'22',color:g.c,border:`1px solid ${g.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0}}>{g.g}</span>
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:3}}>{l.city}, {l.state} · {l.lead_type}</div>
                  <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                    <Tag c={C.blue}>{freshLabel(l.freshness)}</Tag>
                    {l.times_contacted===0? <Tag c={C.green}>Never called</Tag> : <Tag c={l.times_contacted<=1?C.amber:C.red}>{l.times_contacted}x called</Tag>}
                    {l.skiptraced && <Tag c={C.green}>✓ traced</Tag>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {sel && <LeadDetail key={sel.id} lead={sel} onDelete={()=>remove(sel.id)} isMobile={isMobile}/>}
      </div>}
    </div>
  )
}

function LeadDetail({lead,onDelete,isMobile}){
  const s=scoreOf(lead); const g=grade(s); const eq=eqOf(lead)
  const [msgs,setMsgs]=useState([
    {f:'va',t:'now',m:`Working ${lead.name.split(' ')[0]} now. ${lead.times_contacted===0?'Never contacted by another investor — fresh.':`Prior contact logged (${lead.times_contacted}x).`} I'll report back after calls.`}
  ])
  const [draft,setDraft]=useState('')
  const send=()=>{ if(!draft.trim())return; setMsgs([...msgs,{f:'you',t:'now',m:draft.trim()}]); setDraft('') }

  return (
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16}}>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:22}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:22,fontFamily:'Georgia,serif',fontWeight:600}}>{lead.name}</div>
              <div style={{color:C.muted,fontSize:13,marginTop:3}}>{lead.address}{lead.address?', ':''}{lead.city} {lead.state}</div>
              <div style={{color:C.muted,fontSize:13}}>{lead.lead_type} · {lead.phone||'no phone'}</div>
            </div>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{width:88,height:88,borderRadius:'50%',background:`conic-gradient(${g.c} ${s*3.6}deg, ${C.ink} 0deg)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:68,height:68,borderRadius:'50%',background:C.panel,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{color:g.c,fontSize:24,fontWeight:800,fontFamily:'Georgia,serif'}}>{g.g}</div>
                  <div style={{color:C.muted,fontSize:10}}>{s}/100</div>
                </div>
              </div>
              <div style={{color:g.c,fontSize:11,fontWeight:700,marginTop:6,whiteSpace:'nowrap'}}>{g.label}</div>
            </div>
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:22}}>
          <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Lead Quality Signals</div>
          <Signal label="Freshness" value={lead.freshness} display={freshLabel(lead.freshness)} color={C.blue}/>
          <Signal label="Contact history" value={Math.max(0,100-lead.times_contacted*28)} display={lead.times_contacted===0?'Never called':`${lead.times_contacted}x called`} color={lead.times_contacted===0?C.green:lead.times_contacted<=1?C.amber:C.red}/>
          <Signal label="Motivation" value={lead.motivation} display={`${lead.motivation}/100`} color={C.orange}/>
          <Signal label="Equity" value={eq} display={`${eq}% · ${money(lead.arv-lead.owed)}`} color={C.green}/>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16,padding:'12px 14px',background:C.ink,borderRadius:10}}>
            <span style={{fontSize:18}}>{lead.skiptraced?'✅':'⚠️'}</span>
            <span style={{color:lead.skiptraced?C.green:C.amber,fontSize:13,fontWeight:600}}>{lead.skiptraced?'Skip-trace confirmed — verified contact':'Skip-trace incomplete — number unverified'}</span>
          </div>
          <button onClick={onDelete} style={{marginTop:16,background:'transparent',border:`1px solid ${C.line}`,color:C.muted,borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer'}}>Delete lead</button>
        </div>
      </div>

      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:22,display:'flex',flexDirection:'column',minHeight:isMobile?360:420}}>
        <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:14,borderBottom:`1px solid ${C.line}`,marginBottom:14}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:`linear-gradient(135deg,${C.orange},${C.orangeSoft})`,display:'flex',alignItems:'center',justifyContent:'center',color:C.ink,fontWeight:800,flexShrink:0}}>S</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14}}>Sofia · Your VA</div>
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
              <div style={{maxWidth:'82%',background:m.f==='you'?C.orange:C.panel2,color:m.f==='you'?C.ink:C.cream,border:m.f==='you'?'none':`1px solid ${C.line}`,padding:'11px 14px',borderRadius:14,fontSize:13,lineHeight:1.45}}>
                {m.m}<div style={{fontSize:10,opacity:0.65,marginTop:5}}>{m.t}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message Sofia…" style={{flex:1,minWidth:0,background:C.ink,border:`1px solid ${C.line}`,borderRadius:10,padding:'11px 14px',color:C.cream,fontSize:13,outline:'none'}}/>
          <button onClick={send} style={{background:C.orange,color:C.ink,border:'none',borderRadius:10,padding:'0 20px',fontWeight:800,cursor:'pointer'}}>Send</button>
        </div>
        <div style={{color:C.muted,fontSize:10,marginTop:8,textAlign:'center'}}>Preview — live VA messaging connects in the next build.</div>
      </div>
    </div>
  )
}

/* ============ COMPING PAGE ============ */
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
    setAddress(`${l.address||''} ${l.city} ${l.state}`.trim())
    setArv(String(l.arv||''))
  }

  return (
    <div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}}>Comping & Offer</h1>
      <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Run the 70% rule: Max Offer = (ARV × 0.70) − repairs − your assignment fee.</p>

      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:16,marginTop:20,alignItems:'start'}}>
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:22}}>
          <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>Property & Numbers</div>
          <Labeled label="Property address">
            <In ph="123 Main St, City ST" v={address} on={setAddress}/>
          </Labeled>
          <Labeled label="After Repair Value (ARV)">
            <In ph="e.g. 421000" v={arv} on={setArv} type="number"/>
          </Labeled>
          <Labeled label="Estimated repairs">
            <In ph="e.g. 35000" v={repairs} on={setRepairs} type="number"/>
          </Labeled>
          <Labeled label="Your assignment fee">
            <In ph="e.g. 15000" v={fee} on={setFee} type="number"/>
          </Labeled>

          {leads.length>0 &&
          <div style={{marginTop:16}}>
            <div style={{color:C.muted,fontSize:12,marginBottom:8}}>Or pull from a lead:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {leads.slice(0,6).map(l=>(
                <button key={l.id} onClick={()=>loadLead(l)} style={{background:C.ink,border:`1px solid ${C.line}`,color:C.cream,borderRadius:8,padding:'7px 12px',fontSize:12,cursor:'pointer'}}>{l.name}</button>
              ))}
            </div>
          </div>}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:`linear-gradient(135deg,${C.orange},${C.orangeSoft})`,borderRadius:16,padding:26,textAlign:'center'}}>
            <div style={{color:C.ink,fontSize:12,textTransform:'uppercase',letterSpacing:1,fontWeight:800}}>Your Max Allowable Offer</div>
            <div style={{color:C.ink,fontFamily:'Georgia,serif',fontSize:isMobile?38:46,fontWeight:800,margin:'6px 0 2px'}}>{money(mao)}</div>
            <div style={{color:'rgba(8,16,25,0.7)',fontSize:12}}>{address||'Enter a property above'}</div>
          </div>

          <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:22}}>
            <div style={{fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>The Math</div>
            <MathRow label="ARV" val={money(arvN)}/>
            <MathRow label="× 70%" val={money(Math.round(arvN*0.70))}/>
            <MathRow label="− Repairs" val={'-'+money(repairsN)}/>
            <MathRow label="− Your fee" val={'-'+money(feeN)}/>
            <div style={{height:1,background:C.line,margin:'12px 0'}}/>
            <MathRow label="= Max offer" val={money(mao)} bold/>
            <div style={{marginTop:16,padding:'12px 14px',background:C.ink,borderRadius:10,color:C.muted,fontSize:12,lineHeight:1.5}}>
              The 70% rule leaves room for your buyer's profit and holding costs. Offer at or below this number to keep the deal attractive to cash buyers.
            </div>
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

/* ============ SHARED UI ============ */
function Signal({label,value,display,color}){
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,gap:8}}>
        <span style={{color:C.muted,fontSize:12}}>{label}</span>
        <span style={{fontSize:12,fontWeight:600,textAlign:'right'}}>{display}</span>
      </div>
      <div style={{height:6,background:C.ink,borderRadius:6,overflow:'hidden'}}>
        <div style={{width:`${value}%`,height:'100%',background:color,borderRadius:6,transition:'width .4s'}}/>
      </div>
    </div>
  )
}
function Tag({children,c}){return <span style={{background:c+'1e',color:c,border:`1px solid ${c}55`,borderRadius:6,padding:'2px 7px',fontSize:10,fontWeight:700}}>{children}</span>}
function In({ph,v,on,type='text'}){return <input type={type} placeholder={ph} value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:`1px solid ${C.line}`,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}}/>}
function Sel({v,on,opts}){return <select value={v} onChange={e=>on(e.target.value)} style={{background:C.ink,border:`1px solid ${C.line}`,borderRadius:8,padding:'10px 12px',color:C.cream,fontSize:13,width:'100%',boxSizing:'border-box'}}>{opts.map(o=><option key={o}>{o}</option>)}</select>}
function Slider({label,v,mn,mx,on}){return <div><label style={{fontSize:12,color:C.muted}}>{label}</label><input type="range" min={mn} max={mx} value={v} onChange={e=>on(+e.target.value)} style={{width:'100%',accentColor:C.orange}}/></div>}