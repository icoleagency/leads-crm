import { useState, useEffect, useCallback } from 'react'
import { money } from './leadModel'
import { campaignName } from './team'
import { TYPE_NAMES, guessType, STACK_COLOR, FIELDS, MAIN_FIELDS, autoMap, parseCsv, buildRecords, importList,
  queryProps, fetchAllMatching, fetchStackStats, fetchLists, removeList, syncLeadStacks, sendToLeads, downloadCsv, stackErr, fmtPhone } from './stacking'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const PAGE = 100
const errText = e => { const m = stackErr(e.message); return m==='setup' ? 'List Stacking tables are missing — run supabase/add-list-stacking.sql in Supabase first.' : m }
const STATES = ['NJ','FL','DE','PA']
const BLANK_F = { min:1, type:'', state:'', campaign:'', phone:false, hideLeads:false, q:'' }

export default function ListStacking({leads,campaigns,reloadLeads,openLead,isMobile}){
  const [f,setF] = useState(BLANK_F)
  const [rows,setRows] = useState([])
  const [count,setCount] = useState(0)
  const [stats,setStats] = useState(null)
  const [lists,setLists] = useState([])
  const [err,setErr] = useState('')
  const [loading,setLoading] = useState(true)
  const [showUpload,setShowUpload] = useState(false)
  const [picked,setPicked] = useState(new Set())
  const [allMatching,setAllMatching] = useState(false)
  const [open,setOpen] = useState(null)
  const [sendCamp,setSendCamp] = useState('')
  const [busy,setBusy] = useState('')
  const [msg,setMsg] = useState(null)

  const load = useCallback(async (filters, append, offset=0)=>{
    setLoading(true)
    try{
      const { data, count:n, error } = await queryProps(filters, offset, offset+PAGE-1)
      if(error) throw error
      setRows(r=>append ? [...r, ...(data||[])] : (data||[])); setCount(n||0); setErr('')
    }catch(e){ setErr(stackErr(e.message)) }
    setLoading(false)
  },[])
  const loadMeta = useCallback(async ()=>{
    try{ const [s,l] = await Promise.all([fetchStackStats(), fetchLists()]); setStats(s); setLists(l) }
    catch(e){ setErr(stackErr(e.message)) }
  },[])
  useEffect(()=>{ loadMeta() },[loadMeta])
  useEffect(()=>{
    const t = setTimeout(()=>{ load(f); setPicked(new Set()); setAllMatching(false) }, f.q ? 300 : 0)
    return ()=>clearTimeout(t)
  },[f,load])
  const refresh = ()=>{ load(f); loadMeta(); setPicked(new Set()); setAllMatching(false) }
  const setFf = (k,v)=>setF(x=>({...x,[k]:v}))

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:isMobile?16:20,minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}
  const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',boxSizing:'border-box',minWidth:0}
  const btn = p => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'8px 13px',fontSize:12,fontWeight:700,cursor:busy?'default':'pointer',opacity:busy?0.6:1,whiteSpace:'nowrap'})

  if(err==='setup') return (
    <div>
      <h1 style={h1}>List Stacking</h1>
      <div style={{...card,marginTop:20,borderColor:C.amber+'66'}}>
        <div style={{color:C.amber,fontWeight:700,fontSize:14,marginBottom:8}}>One-time setup needed</div>
        <div style={{color:C.cream,fontSize:13.5,lineHeight:1.6}}>List Stacking needs two new tables. In Supabase open <b>SQL Editor → + New query</b>, paste the SQL from <b>supabase/add-list-stacking.sql</b>, and hit <b>Run</b>. Then come back and press Retry.</div>
        <button onClick={()=>{ setErr(''); refresh() }} style={{...btn(true),marginTop:14}}>Retry</button>
      </div>
    </div>
  )

  const pickedRows = rows.filter(r=>picked.has(r.id))
  const nPicked = allMatching ? count : picked.size
  const allShownPicked = rows.length>0 && rows.every(r=>picked.has(r.id))
  const toggle = id => { setAllMatching(false); setPicked(s=>{ const n=new Set(s); if(n.has(id)) n.delete(id); else n.add(id); return n }) }

  async function doSend(){
    setBusy('send'); setMsg(null)
    try{
      const props = allMatching ? await fetchAllMatching(f) : pickedRows
      const r = await sendToLeads(props, { leads, campaign:sendCamp, onProgress:t=>setMsg({ok:true,t}) })
      setMsg({ok:true,t:'Sent to Leads: '+r.created+' new lead'+(r.created===1?'':'s')+(r.linked?' · '+r.linked+' matched existing leads':'')+(r.skipped?' · '+r.skipped+' already in Leads':'')+'.'})
      await reloadLeads(); refresh()
    }catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy('')
  }
  async function doExport(){
    setBusy('export'); setMsg(null)
    try{
      const props = nPicked ? (allMatching ? await fetchAllMatching(f) : pickedRows) : await fetchAllMatching(f)
      downloadCsv(props, 'stacked-list-'+new Date().toISOString().slice(0,10)+'.csv')
      setMsg({ok:true,t:'Exported '+props.length.toLocaleString()+' properties.'})
    }catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy('')
  }
  async function doRemove(l){
    if(!confirm('Remove the list "'+l.name+'"? Properties only on this list are deleted (unless already sent to Leads); everything else drops one from its stack.')) return
    setBusy('remove'); setMsg(null)
    try{ await removeList(l.id); const n = await syncLeadStacks(leads); if(n) await reloadLeads(); setMsg({ok:true,t:'Removed "'+l.name+'".'}); refresh() }
    catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy('')
  }

  const tiles = stats ? [
    ['Properties', stats.total, 1, C.cream],
    ['On 2+ lists', stats.s2, 2, C.amber],
    ['On 3+ lists', stats.s3, 3, C.orange],
    ['On 4+ lists', stats.s4, 4, C.red],
  ] : []

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>List Stacking</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Upload every list you pull. Duplicates merge by address, and properties on more than one list rise to the top — those owners have more reasons to sell.</p>
        </div>
        <button onClick={()=>setShowUpload(!showUpload)} style={btn(true)}>{showUpload?'Close':'+ Upload list'}</button>
      </div>

      {err && <div style={{...card,borderColor:C.red+'66',color:C.red,fontSize:13,marginBottom:14}}>{err} <button onClick={refresh} style={{...btn(false),marginLeft:8,padding:'4px 10px'}}>Retry</button></div>}
      {showUpload && <Upload leads={leads} campaigns={campaigns} isMobile={isMobile} onDone={()=>{ refresh(); reloadLeads() }} card={card} inp={inp} btn={btn} cap={cap}/>}

      {stats &&
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10,marginBottom:14}}>
        {tiles.map(([l,n,min,c])=>(
          <div key={l} onClick={()=>setFf('min',min)} style={{...card,padding:14,cursor:'pointer',borderColor:f.min===min?c:C.line}}>
            <div style={cap}>{l}</div>
            <div style={{fontSize:24,fontWeight:800,color:c,marginTop:4}}>{n.toLocaleString()}</div>
            {min>1 && stats.total>0 && <div style={{color:C.muted,fontSize:11.5}}>{Math.round(n/stats.total*100)}% of all</div>}
            {min===1 && <div style={{color:C.muted,fontSize:11.5}}>{stats.phones.toLocaleString()} with phones</div>}
          </div>
        ))}
      </div>}

      {stats && stats.total===0 && !showUpload ?
      <div style={{...card,textAlign:'center',padding:36}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>No lists yet</div>
        <div style={{color:C.muted,fontSize:13.5,lineHeight:1.6,maxWidth:520,margin:'0 auto 16px'}}>Export a list from PropStream, PropWire or your county (tax delinquent, pre-foreclosure, absentee, vacant…) as a CSV and upload it. Upload a second list for the same county and you'll see the overlap stack up.</div>
        <button onClick={()=>setShowUpload(true)} style={btn(true)}>+ Upload your first list</button>
      </div> :
      <>
      <div style={{...card,padding:14,marginBottom:12}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{...cap,marginRight:4}}>Stack</span>
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>setFf('min',n)} style={{background:f.min===n?STACK_COLOR(n):'transparent',color:f.min===n?C.ink:C.muted,border:'1px solid '+(f.min===n?STACK_COLOR(n):C.line),borderRadius:20,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{n===1?'All':n+'+'}</button>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'1.4fr 1fr .7fr 1fr',gap:8,marginTop:10}}>
          <input value={f.q} onChange={e=>setFf('q',e.target.value)} placeholder="Search address, owner, city" style={{...inp,gridColumn:isMobile?'1/-1':'auto'}}/>
          <select value={f.type} onChange={e=>setFf('type',e.target.value)} style={inp}><option value="">All list types</option>{TYPE_NAMES.map(t=><option key={t}>{t}</option>)}</select>
          <select value={f.state} onChange={e=>setFf('state',e.target.value)} style={inp}><option value="">All states</option>{STATES.map(s=><option key={s}>{s}</option>)}</select>
          <select value={f.campaign} onChange={e=>setFf('campaign',e.target.value)} style={inp}><option value="">All campaigns</option>{campaigns.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}<option value="none">No campaign</option></select>
        </div>
        <div style={{display:'flex',gap:16,marginTop:10,flexWrap:'wrap',fontSize:12.5,color:C.muted}}>
          <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={f.phone} onChange={e=>setFf('phone',e.target.checked)}/>Has phone number</label>
          <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={f.hideLeads} onChange={e=>setFf('hideLeads',e.target.checked)}/>Hide ones already in Leads</label>
          {JSON.stringify(f)!==JSON.stringify(BLANK_F) && <span onClick={()=>setF(BLANK_F)} style={{color:C.orange,cursor:'pointer'}}>Clear filters</span>}
        </div>
      </div>

      {msg && <div style={{fontSize:12.5,color:msg.ok?C.green:C.red,background:(msg.ok?C.green:C.red)+'14',border:'1px solid '+(msg.ok?C.green:C.red)+'44',borderRadius:8,padding:'9px 12px',marginBottom:10}}>{msg.t}</div>}

      <div style={{...card,padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid '+C.line,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={allShownPicked} onChange={e=>{ setAllMatching(false); setPicked(e.target.checked?new Set(rows.map(r=>r.id)):new Set()) }}/>
              <b>{count.toLocaleString()}</b><span style={{color:C.muted}}>propert{count===1?'y':'ies'}</span>
            </label>
            {allShownPicked && count>rows.length && !allMatching && <span onClick={()=>setAllMatching(true)} style={{color:C.orange,fontSize:12.5,cursor:'pointer'}}>Select all {count.toLocaleString()} matching</span>}
            {nPicked>0 && <span style={{color:C.cream,fontSize:12.5}}>{nPicked.toLocaleString()} selected</span>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            {nPicked>0 && <>
              <select value={sendCamp} onChange={e=>setSendCamp(e.target.value)} style={{...inp,padding:'7px 8px',fontSize:12}}><option value="">Keep campaign</option>{campaigns.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}</select>
              <button disabled={!!busy} onClick={doSend} style={btn(true)}>{busy==='send'?'Sending…':'Send '+nPicked.toLocaleString()+' to Leads'}</button>
            </>}
            <button disabled={!!busy||!count} onClick={doExport} style={btn(false)}>{busy==='export'?'Exporting…':nPicked?'Export selected':'Export CSV'}</button>
          </div>
        </div>

        {rows.length===0 && !loading && <div style={{padding:24,color:C.muted,fontSize:13}}>No properties match these filters.</div>}
        {rows.map(p=>(
          <PropRow key={p.id} p={p} picked={allMatching||picked.has(p.id)} onPick={()=>toggle(p.id)} open={open===p.id} onOpen={()=>setOpen(open===p.id?null:p.id)}
            campaigns={campaigns} leads={leads} openLead={openLead} isMobile={isMobile}/>
        ))}
        {rows.length<count && <div style={{padding:12,textAlign:'center'}}><button disabled={loading} onClick={()=>load(f,true,rows.length)} style={btn(false)}>{loading?'Loading…':'Show more ('+(count-rows.length).toLocaleString()+' left)'}</button></div>}
      </div>

      {lists.length>0 &&
      <div style={{...card,marginTop:14}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Uploaded lists</div>
        {lists.map(l=>(
          <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'9px 0',borderTop:'1px solid '+C.line,flexWrap:isMobile?'wrap':'nowrap'}}>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13}}>{l.name} <TypeChip t={l.type}/></div>
              <div style={{color:C.muted,fontSize:11.5,marginTop:2}}>{new Date(l.created_at).toLocaleDateString()} · {l.rows_in_file.toLocaleString()} properties · <span style={{color:C.green}}>{l.new_count.toLocaleString()} new</span> · <span style={{color:C.amber}}>{l.stacked_count.toLocaleString()} stacked on existing</span>{l.campaign && campaignName(campaigns,l.campaign)?' · '+campaignName(campaigns,l.campaign):''}</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setF({...BLANK_F,type:l.type})} style={{...btn(false),padding:'5px 10px'}}>View</button>
              <button disabled={!!busy} onClick={()=>doRemove(l)} style={{...btn(false),padding:'5px 10px'}}>Remove</button>
            </div>
          </div>
        ))}
      </div>}
      </>}
    </div>
  )
}

function TypeChip({t}){
  return <span style={{display:'inline-block',background:C.blue+'1a',color:C.blue,border:'1px solid '+C.blue+'44',borderRadius:6,padding:'1px 7px',fontSize:11,fontWeight:600,marginRight:4,marginTop:3,whiteSpace:'nowrap'}}>{t}</span>
}
function StackBadge({n,big}){
  const c = STACK_COLOR(n)
  return <div title={'On '+n+' list type'+(n===1?'':'s')} style={{width:big?44:34,height:big?44:34,borderRadius:9,background:c+'22',border:'1px solid '+c,color:c,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}}>
    <span style={{fontWeight:800,fontSize:big?18:15}}>{n}</span><span style={{fontSize:8,letterSpacing:.5,marginTop:1}}>LISTS</span>
  </div>
}

function PropRow({p,picked,onPick,open,onOpen,campaigns,leads,openLead,isMobile}){
  const d = p.data||{}
  const lead = p.lead_id && leads.find(l=>String(l.id)===String(p.lead_id))
  const equity = d.value ? (d.loan!==undefined ? Math.max(0,d.value-d.loan) : d.equity!==undefined ? Math.min(d.equity,d.value) : null) : null
  return (
    <div style={{borderTop:'1px solid '+C.line,background:open?C.panel2:'transparent'}}>
      <div style={{display:'flex',gap:12,alignItems:'center',padding:'11px 16px'}}>
        <input type="checkbox" checked={picked} onChange={onPick} style={{flexShrink:0}}/>
        <StackBadge n={p.stack}/>
        <div onClick={onOpen} style={{flex:1,minWidth:0,cursor:'pointer',display:isMobile?'block':'grid',gridTemplateColumns:'1.3fr 1fr 1.4fr .8fr',gap:12,alignItems:'center'}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600,fontSize:13.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.address}</div>
            <div style={{color:C.muted,fontSize:11.5}}>{[p.city,p.state].filter(Boolean).join(', ')} {p.zip||''}</div>
          </div>
          <div style={{minWidth:0,fontSize:12.5,marginTop:isMobile?3:0}}>
            <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.owner_name||<span style={{color:C.muted}}>No owner name</span>}</div>
            <div style={{color:(p.phones||[]).length?C.green:C.muted,fontSize:11.5}}>{(p.phones||[]).length ? (p.phones.length+' phone'+(p.phones.length===1?'':'s')) : 'No phone — needs skip trace'}</div>
          </div>
          <div style={{minWidth:0,marginTop:isMobile?4:0}}>{(p.list_types||[]).map(t=><TypeChip key={t} t={t}/>)}</div>
          <div style={{fontSize:12,textAlign:isMobile?'left':'right',marginTop:isMobile?4:0}}>
            {d.value ? <div>{money(d.value)}</div> : null}
            {equity!==null && equity!==undefined ? <div style={{color:C.muted,fontSize:11.5}}>{d.value?Math.round(equity/d.value*100)+'% equity':''}</div> : null}
            {lead && <div style={{color:C.orange,fontSize:11.5,fontWeight:700}}>In Leads</div>}
          </div>
        </div>
      </div>
      {open &&
      <div style={{padding:'4px 16px 16px',display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:14,fontSize:12.5}}>
        <div>
          <div style={{color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Lists it's on</div>
          {(p.lists||[]).map(x=><div key={x.list_id} style={{marginBottom:3}}><TypeChip t={x.type}/> {x.name} <span style={{color:C.muted}}>· {new Date(x.at).toLocaleDateString()}</span></div>)}
        </div>
        <div>
          <div style={{color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Owner</div>
          <div>{p.owner_name||'—'}</div>
          {p.mailing && <div style={{color:C.muted}}>Mails to: {p.mailing}</div>}
          {(p.phones||[]).map(ph=><div key={ph}><a href={'tel:'+ph} style={{color:C.green,textDecoration:'none'}}>{fmtPhone(ph)}</a></div>)}
          {(p.emails||[]).map(e=><div key={e} style={{color:C.muted}}>{e}</div>)}
        </div>
        <div>
          <div style={{color:C.muted,fontSize:10.5,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>Property</div>
          <div>{[d.beds&&d.beds+'bd', d.baths&&d.baths+'ba', d.sqft&&Number(d.sqft).toLocaleString()+' sqft', d.year_built&&'built '+d.year_built].filter(Boolean).join(' · ')||'—'}</div>
          {d.value ? <div>Est. value {money(d.value)}{d.loan!==undefined?' · owes '+money(d.loan):''}</div> : null}
          {d.last_sale_date && <div style={{color:C.muted}}>Last sold {d.last_sale_date}{d.last_sale_amount?' for '+money(d.last_sale_amount):''}</div>}
          {p.county && <div style={{color:C.muted}}>{p.county} County</div>}
          {p.campaign && campaignName(campaigns,p.campaign) && <div style={{color:C.muted}}>Campaign: {campaignName(campaigns,p.campaign)}</div>}
          {lead && <button onClick={()=>openLead(lead.id)} style={{marginTop:8,background:'transparent',border:'1px solid '+C.orange,color:C.orange,borderRadius:8,padding:'5px 11px',fontSize:11.5,fontWeight:700,cursor:'pointer'}}>Open lead →</button>}
        </div>
      </div>}
    </div>
  )
}

function Upload({leads,campaigns,isMobile,onDone,card,inp,btn,cap}){
  const [file,setFile] = useState(null)
  const [parsed,setParsed] = useState(null)   // { headers, rows }
  const [map,setMap] = useState({})
  const [name,setName] = useState('')
  const [type,setType] = useState('Other')
  const [campaign,setCampaign] = useState('')
  const [showMap,setShowMap] = useState(false)
  const [status,setStatus] = useState(null)
  const [busy,setBusy] = useState(false)

  async function pick(e){
    const fl = e.target.files && e.target.files[0]; if(!fl) return
    setStatus(null); setFile(fl)
    try{
      const r = await parseCsv(fl)
      if(!r.rows.length) throw new Error('That file has no rows.')
      const m = autoMap(r.headers)
      setParsed(r); setMap(m); setShowMap(!m.address)
      const base = fl.name.replace(/\.csv$/i,'').replace(/[_-]+/g,' ')
      setName(base); setType(guessType(base))
    }catch(er){ setParsed(null); setStatus({ok:false,t:"Couldn't read that file: "+er.message}) }
  }
  const built = parsed && map.address ? buildRecords(parsed.rows, map) : null

  async function go(){
    if(!built || !built.records.length || !name.trim()) return
    setBusy(true); setStatus({ok:true,t:'Starting…'})
    try{
      const r = await importList({ records:built.records, name, type, campaign, leads, onProgress:t=>setStatus({ok:true,t}) })
      setStatus({ok:true,done:true,t:'Stacked "'+name.trim()+'": '+r.total.toLocaleString()+' properties — '+r.fresh.toLocaleString()+' new, '+r.stacked.toLocaleString()+' were already on another list'+(r.leadsUpdated?' ('+r.leadsUpdated+' matching leads updated)':'')+'.'})
      setParsed(null); setFile(null)
      onDone()
    }catch(er){ const m=stackErr(er.message); setStatus({ok:false,t:m==='setup'?'List Stacking tables are missing — run supabase/add-list-stacking.sql in Supabase first.':m}) }
    setBusy(false)
  }

  const fieldLabel = Object.fromEntries(FIELDS.map(([k,l])=>[k,l]))
  const sample = built && built.records.slice(0,3)

  return (
    <div style={{...card,borderColor:C.orange+'66',marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Upload a list</div>
      <div style={{color:C.muted,fontSize:12.5,lineHeight:1.5,marginBottom:12}}>CSV export from PropStream, PropWire, county records, etc. Columns are matched automatically. Upload one list type at a time (e.g. "Burlington tax delinquent"), so the stack count means something.</div>
      <label style={{display:'inline-block',...btn(!parsed),cursor:'pointer'}}>
        {file ? 'Choose a different file' : 'Choose CSV file'}
        <input type="file" accept=".csv,text/csv" onChange={pick} style={{display:'none'}}/>
      </label>
      {file && <span style={{color:C.muted,fontSize:12.5,marginLeft:10}}>{file.name}</span>}

      {parsed &&
      <div style={{marginTop:14}}>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.4fr 1fr 1fr',gap:8}}>
          <div><div style={{...cap,marginBottom:4}}>List name</div><input value={name} onChange={e=>setName(e.target.value)} style={{...inp,width:'100%'}}/></div>
          <div><div style={{...cap,marginBottom:4}}>List type</div><select value={type} onChange={e=>setType(e.target.value)} style={{...inp,width:'100%'}}>{TYPE_NAMES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><div style={{...cap,marginBottom:4}}>Campaign (county)</div><select value={campaign} onChange={e=>setCampaign(e.target.value)} style={{...inp,width:'100%'}}><option value="">None</option>{campaigns.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}</select></div>
        </div>

        <div style={{marginTop:12,fontSize:12.5,color:C.cream,lineHeight:1.6}}>
          {parsed.rows.length.toLocaleString()} rows found.{' '}
          {map.address ? <>Matched <b>{MAIN_FIELDS.filter(k=>map[k]).length}</b> key columns{map.phones.length?<>, <b>{map.phones.length}</b> phone column{map.phones.length===1?'':'s'}</>:<span style={{color:C.amber}}>, no phone columns (skip trace later)</span>}.</> : <span style={{color:C.amber}}>Couldn't find the property address column — pick it below.</span>}
          {built && built.skipped>0 && <span style={{color:C.amber}}> {built.skipped} rows have no address and will be skipped.</span>}
          {built && built.records.length<parsed.rows.length-built.skipped && <span style={{color:C.muted}}> {parsed.rows.length-built.skipped-built.records.length} duplicate rows merged.</span>}
          {' '}<span onClick={()=>setShowMap(!showMap)} style={{color:C.orange,cursor:'pointer'}}>{showMap?'Hide columns':'Check columns'}</span>
        </div>

        {showMap &&
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:8,marginTop:10,background:C.ink,borderRadius:10,padding:12}}>
          {MAIN_FIELDS.map(k=>(
            <div key={k} style={{minWidth:0}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:3}}>{fieldLabel[k]}</div>
              <select value={map[k]||''} onChange={e=>setMap({...map,[k]:e.target.value||undefined})} style={{...inp,width:'100%',padding:'6px 8px',fontSize:12,background:C.panel}}>
                <option value="">— none —</option>{parsed.headers.map(h=><option key={h}>{h}</option>)}
              </select>
            </div>
          ))}
          <div style={{gridColumn:'1/-1',color:C.muted,fontSize:11.5}}>Phones: {map.phones.length?map.phones.join(', '):'none found'} · Emails: {map.emails.length?map.emails.join(', '):'none found'}</div>
        </div>}

        {sample && sample.length>0 &&
        <div style={{marginTop:10,background:C.ink,borderRadius:10,padding:'8px 12px',fontSize:12}}>
          <div style={{...cap,fontSize:10,marginBottom:4}}>Preview</div>
          {sample.map(r=><div key={r.addr_key} style={{padding:'3px 0',color:C.cream,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.address}, {r.city} {r.state} {r.zip} <span style={{color:C.muted}}>· {r.owner_name||'no owner'}{r.phones.length?' · '+fmtPhone(r.phones[0]):''}{r.data.value?' · '+money(r.data.value):''}</span></div>)}
        </div>}

        <button disabled={busy||!built||!built.records.length||!name.trim()} onClick={go} style={{...btn(true),marginTop:12,opacity:(busy||!built||!built.records.length)?0.5:1}}>
          {busy?'Stacking…':'Stack '+(built?built.records.length.toLocaleString():0)+' properties'}
        </button>
      </div>}
      {status && <div style={{marginTop:12,fontSize:12.5,color:status.ok?C.green:C.red}}>{status.t}</div>}
    </div>
  )
}
