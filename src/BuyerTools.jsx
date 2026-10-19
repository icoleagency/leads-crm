import { useState } from 'react'
import { parseCsv } from './stacking'
import { money } from './leadModel'
import { mapBuyerFile, buyersFromPurchases, landlordsFromLists, saveFound, buyerSkipCsv } from './buyerFinder'
import { dispoErr, GRADE_COLOR } from './dispo'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}
const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',color:C.cream,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',minWidth:0,fontFamily:'inherit'}
const btn = (p,dis) => ({background:p?C.orange:'transparent',color:p?C.ink:C.muted,border:'1px solid '+(p?C.orange:C.line),borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:dis?'default':'pointer',opacity:dis?0.5:1,whiteSpace:'nowrap'})
const chip = (on,col=C.orange) => ({background:on?col:'transparent',color:on?C.ink:C.muted,border:'1px solid '+(on?col:C.line),borderRadius:14,padding:'4px 10px',fontSize:11.5,fontWeight:600,cursor:'pointer'})
const errText = e => { const m = dispoErr(e.message); return m==='upgrade' ? 'Buyer profiles need a one-time database update — run the SQL from supabase/add-buyer-tools.sql in Supabase, then try again.' : m==='setup' ? 'Buyers need a one-time database update — run supabase/add-dispo.sql in Supabase.' : m }
function download(name, text){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type:'text/csv'})); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
}
const ago = d => { if(!d) return ''; const m = Math.round((Date.now()-new Date(d))/(30.4*86400000)); return m<=0?'this month':m===1?'1 mo ago':m<24?m+' mo ago':Math.round(m/12)+' yr ago' }

export function GradeBadge({g,small}){
  const c = GRADE_COLOR[g.grade]
  return <span title={g.why.map(([n,t])=>(n>0?'+':'')+n+' '+t).join('\n')||'No track record yet'} style={{background:c+'22',color:c,border:'1px solid '+c+'66',borderRadius:6,padding:small?'0 6px':'1px 8px',fontSize:small?10.5:11.5,fontWeight:800,whiteSpace:'nowrap'}}>{g.grade==='Cold'?'Cold':g.grade}{g.vip?' ★':''}</span>
}

// ---------------- Cash Buyer Finder ----------------
export function FindBuyers({buyers,reload,onDone,isMobile}){
  const [mode,setMode] = useState('file')
  const [file,setFile] = useState(null)        // {name, rows, map}
  const [months,setMonths] = useState(24)
  const [minBuys,setMinBuys] = useState(1)
  const [minOwned,setMinOwned] = useState(3)
  const [companies,setCompanies] = useState(false)
  const [found,setFound] = useState(null)      // {list, purchases, skipped}
  const [pick,setPick] = useState(new Set())
  const [msg,setMsg] = useState(null)
  const [busy,setBusy] = useState(false)
  const [limit,setLimit] = useState(60)

  function analyze(f=file, m=months, mb=minBuys){
    if(!f) return
    const r = buyersFromPurchases(f.rows, f.map, { months:m, minBuys:mb })
    setFound({ list:r.buyers, purchases:r.purchases, skipped:r.skipped, kind:'cash' }); setPick(new Set(r.buyers.map(b=>b.key))); setLimit(60)
  }
  async function pickFile(e){
    const fl = e.target.files && e.target.files[0]; if(!fl) return
    setMsg(null); setFound(null)
    try{
      const t = await parseCsv(fl); if(!t.rows.length) throw new Error('That file has no rows.')
      const map = mapBuyerFile(t.headers)
      if(!map.address) throw new Error("Couldn't find a property address column.")
      if(!map.owner && !map.owner_first) throw new Error("Couldn't find an owner / buyer name column.")
      const f = { name:fl.name, rows:t.rows, map }
      setFile(f); analyze(f)
    }catch(er){ setMsg({ok:false,t:"Couldn't read that file: "+er.message}) }
    e.target.value = ''
  }
  async function scanLists(){
    setBusy(true); setMsg(null); setFound(null)
    try{ const list = await landlordsFromLists({ minOwned, companiesOnly:companies }); setFound({ list, kind:'landlord' }); setPick(new Set(list.map(b=>b.key))); setLimit(60)
      if(!list.length) setMsg({ok:true,t:'No owner shows up on '+minOwned+'+ properties in your List Stacking data yet. Try 2+, or upload more lists.'}) }
    catch(e){ setMsg({ok:false,t:/properties/.test(e.message)?'List Stacking isn\'t set up yet — upload a list there first.':errText(e)}) }
    setBusy(false)
  }
  async function save(){
    const chosen = found.list.filter(b=>pick.has(b.key)); if(!chosen.length) return
    setBusy(true); setMsg({ok:true,t:'Saving…'})
    try{ const r = await saveFound(chosen, buyers, found.kind, t=>setMsg({ok:true,t})); await reload()
      setMsg({ok:true,t:'Added '+r.added+' new buyer'+(r.added===1?'':'s')+(r.updated?' · updated '+r.updated+' already on your list':'')+'.'+(chosen.filter(b=>!b.phone).length?' Download the no-phone list below to skip trace them.':'')}) }
    catch(e){ setMsg({ok:false,t:errText(e)}) }
    setBusy(false)
  }
  const list = found ? found.list : []
  const noPhone = list.filter(b=>pick.has(b.key) && !b.phone)
  const all = list.length>0 && list.every(b=>pick.has(b.key))
  const toggle = key => setPick(p=>{ const n = new Set(p); if(n.has(key)) n.delete(key); else n.add(key); return n })

  return (
    <div style={{...card,marginTop:12,borderColor:C.green+'55'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:700,fontSize:15}}>Cash Buyer Finder</div>
          <div style={{color:C.muted,fontSize:12.5,marginTop:3,lineHeight:1.5,maxWidth:620}}>The best buyers are people who already bought. Build buyer profiles from real purchase records — their areas, price range and how often they buy come from what they actually bought.</div>
        </div>
        <button onClick={onDone} style={btn(false)}>Close</button>
      </div>
      <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
        <button onClick={()=>{ setMode('file'); setFound(null); setMsg(null) }} style={chip(mode==='file',C.green)}>From a cash-buyer / sales file</button>
        <button onClick={()=>{ setMode('lists'); setFound(null); setMsg(null) }} style={chip(mode==='lists',C.green)}>Landlords in your lists</button>
      </div>

      {mode==='file' && <div style={{marginTop:12}}>
        <div style={{color:C.muted,fontSize:12.5,lineHeight:1.55}}>In <b style={{color:C.cream}}>PropStream</b>: search your county → filter <i>Cash Buyers</i> (or Last Sale within 12 months + no mortgage) → export. <b style={{color:C.cream}}>PropWire</b> cash buyer lists and county deed/sales exports work too. One row per property bought.</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:10}}>
          <label style={{...btn(!file),cursor:'pointer',display:'inline-block'}}>{file?'Choose a different file':'Choose CSV file'}<input type="file" accept=".csv,text/csv" onChange={pickFile} style={{display:'none'}}/></label>
          {file && <span style={{color:C.muted,fontSize:12}}>{file.name} · {file.rows.length.toLocaleString()} rows</span>}
        </div>
        {file && <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:12,alignItems:'center',fontSize:12,color:C.muted}}>
          <span>Bought within</span>
          {[[12,'12 mo'],[24,'24 mo'],[0,'any time']].map(([v,l])=><button key={v} onClick={()=>{ setMonths(v); analyze(file,v,minBuys) }} style={chip(months===v)}>{l}</button>)}
          <span style={{marginLeft:6}}>At least</span>
          {[[1,'1 buy'],[2,'2+'],[3,'3+']].map(([v,l])=><button key={v} onClick={()=>{ setMinBuys(v); analyze(file,months,v) }} style={chip(minBuys===v)}>{l}</button>)}
        </div>}
      </div>}

      {mode==='lists' && <div style={{marginTop:12}}>
        <div style={{color:C.muted,fontSize:12.5,lineHeight:1.55}}>Owners who show up on several properties in your List Stacking data are portfolio landlords — and landlords buy. Scans every property you've uploaded.</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:10,alignItems:'center',fontSize:12,color:C.muted}}>
          <span>Owns at least</span>
          {[2,3,5].map(v=><button key={v} onClick={()=>setMinOwned(v)} style={chip(minOwned===v)}>{v}+</button>)}
          <label style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={companies} onChange={e=>setCompanies(e.target.checked)}/>LLCs / companies only</label>
          <button disabled={busy} onClick={scanLists} style={btn(true,busy)}>{busy&&!found?'Scanning…':'Find landlords'}</button>
        </div>
      </div>}

      {found && list.length>0 && <div style={{marginTop:14}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{fontSize:13}}>
            <b style={{color:C.green}}>{list.length.toLocaleString()} {found.kind==='landlord'?'landlords':'cash buyers'}</b>
            {found.kind==='cash' && <span style={{color:C.muted}}> from {found.purchases.toLocaleString()} purchases{found.skipped?' · skipped '+found.skipped+' (banks, government, older sales)':''}</span>}
          </div>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12,color:C.muted,cursor:'pointer'}}><input type="checkbox" checked={all} onChange={()=>setPick(all?new Set():new Set(list.map(b=>b.key)))}/>Select all</label>
        </div>
        <div style={{marginTop:8,border:'1px solid '+C.line,borderRadius:10,maxHeight:420,overflowY:'auto'}}>
          {list.slice(0,limit).map(b=>(
            <label key={b.key} style={{display:'grid',gridTemplateColumns:isMobile?'22px 1fr':'22px 1.4fr 1.3fr 1fr',gap:10,padding:'9px 12px',borderBottom:'1px solid '+C.line,cursor:'pointer',alignItems:'start',background:pick.has(b.key)?C.panel2:'transparent'}}>
              <input type="checkbox" checked={pick.has(b.key)} onChange={()=>toggle(b.key)} style={{marginTop:3}}/>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13}}>{b.name}</div>
                <div style={{fontSize:11.5,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.mailing||'No mailing address'}</div>
                {isMobile && <div style={{fontSize:11.5,color:C.cream,marginTop:2}}>{found.kind==='landlord'?'Owns '+b.owned:b.buys+' buys · last '+ago(b.last_buy)} · {b.markets.slice(0,3).join(', ')}</div>}
              </div>
              {!isMobile && <div style={{fontSize:12,minWidth:0}}>
                <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.markets.join(', ')||'—'}</div>
                <div style={{color:C.muted}}>{found.kind==='landlord' ? (b.zips||[]).slice(0,4).join(', ') : (b.min_price||b.max_price ? money(b.min_price||0)+'–'+money(b.max_price||0) : 'price unknown')+(b.property_types.length?' · '+b.property_types.join(', ').toLowerCase():'')}</div>
              </div>}
              {!isMobile && <div style={{fontSize:12,textAlign:'right'}}>
                <div style={{color:C.green,fontWeight:700}}>{found.kind==='landlord' ? 'Owns '+b.owned : b.buys+' buy'+(b.buys===1?'':'s')+(b.buys_12mo?' · '+b.buys_12mo+' in 12 mo':'')}</div>
                <div style={{color:b.phone?C.cream:C.amber}}>{b.phone ? '☎ '+b.phone.replace(/(\d{3})(\d{3})(\d{4})/,'($1) $2-$3') : 'needs skip trace'}{found.kind==='cash' && b.last_buy ? <span style={{color:C.muted}}> · last {ago(b.last_buy)}</span> : null}</div>
              </div>}
            </label>
          ))}
          {list.length>limit && <div style={{padding:10,textAlign:'center'}}><button onClick={()=>setLimit(limit+200)} style={btn(false)}>Show more ({(list.length-limit).toLocaleString()})</button></div>}
        </div>
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap',alignItems:'center'}}>
          <button disabled={busy||!pick.size} onClick={save} style={btn(true,busy||!pick.size)}>{busy?'Saving…':'Add '+pick.size.toLocaleString()+' to my buyers'}</button>
          {noPhone.length>0 && <button onClick={()=>download('buyers-to-skip-trace.csv', buyerSkipCsv(noPhone))} style={btn(false)}>Download {noPhone.length} with no phone (for skip trace)</button>}
          <span style={{color:C.muted,fontSize:11.5}}>Already on your list (same phone, email or name)? Their profile gets updated instead of a duplicate.</span>
        </div>
        {noPhone.length>0 && <div style={{color:C.muted,fontSize:11.5,marginTop:6}}>After skip tracing, bring the file back with <b style={{color:C.cream}}>Import CSV</b> — phones get filled in on the matching buyers (by name).</div>}
      </div>}
      {msg && <div style={{marginTop:10,fontSize:12.5,color:msg.ok?C.green:C.red}}>{msg.t}</div>}
    </div>
  )
}

// ---------------- Sign-up link ----------------
const SOURCES = ['Facebook groups','REIA / meetups','BiggerPockets','Email signature','Text / DM','Website']
export function SignupLink({buyers,leads,onDone,isMobile}){
  const saved = (()=>{ try{ return JSON.parse(localStorage.getItem('wos_signup')||'{}') }catch{ return {} } })()
  const counties = [...new Set(leads.map(l=>l.details&&l.details.county).filter(Boolean).map(c=>String(c).replace(/\s*county$/i,'').trim()))].slice(0,8)
  const [brand,setBrand] = useState(saved.brand||'')
  const [markets,setMarkets] = useState(saved.markets||counties.join(', '))
  const [copied,setCopied] = useState('')
  const persist = (b,m) => { try{ localStorage.setItem('wos_signup', JSON.stringify({brand:b,markets:m})) }catch{ /* storage off */ } }
  const base = window.location.origin+'/join'
  const link = src => { const p = new URLSearchParams(); if(brand.trim()) p.set('by',brand.trim()); const m = markets.split(',').map(s=>s.trim()).filter(Boolean).join(','); if(m) p.set('m',m); if(src) p.set('src',src); const q = p.toString(); return base+(q?'?'+q:'') }
  async function copy(src){ try{ await navigator.clipboard.writeText(link(src)); setCopied(src||'main'); setTimeout(()=>setCopied(''),2000) }catch{ setCopied('fail') } }
  const week = Date.now()-7*86400000
  const recent = buyers.filter(b=>b.profile && b.profile.signup_at && new Date(b.profile.signup_at).getTime()>=week).length
  const bySource = buyers.filter(b=>b.profile && b.profile.signup).reduce((m,b)=>{ const s = b.profile.signup_source||'Direct link'; m[s]=(m[s]||0)+1; return m },{})
  return (
    <div style={{...card,marginTop:12,borderColor:C.blue+'55'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:700,fontSize:15}}>Buyer sign-up link</div>
          <div style={{color:C.muted,fontSize:12.5,marginTop:3,lineHeight:1.5,maxWidth:620}}>A public page where buyers fill in their own buy box. Every sign-up lands in your Buyers list, tagged <b style={{color:C.cream}}>signed up</b>. Post it everywhere buyers hang out.</div>
        </div>
        <button onClick={onDone} style={btn(false)}>Close</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1.4fr',gap:10,marginTop:12}}>
        <label style={{color:C.muted,fontSize:11.5}}>Business name shown on the page<input value={brand} onChange={e=>{ setBrand(e.target.value); persist(e.target.value,markets) }} placeholder="e.g. Coleman Home Buyers" style={{...inp,marginTop:3}}/></label>
        <label style={{color:C.muted,fontSize:11.5}}>Areas buyers can tap (comma separated)<input value={markets} onChange={e=>{ setMarkets(e.target.value); persist(brand,e.target.value) }} placeholder="e.g. Duval, Clay, St Johns" style={{...inp,marginTop:3}}/></label>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:12,flexWrap:'wrap'}}>
        <code style={{flex:1,minWidth:0,background:C.ink,border:'1px solid '+C.line,borderRadius:8,padding:'8px 10px',fontSize:12,color:C.cream,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link('')}</code>
        <button onClick={()=>copy('')} style={btn(true)}>{copied==='main'?'Copied ✓':'Copy link'}</button>
        <a href={link('')} target="_blank" rel="noreferrer" style={{...btn(false),textDecoration:'none'}}>Preview</a>
      </div>
      <div style={{color:C.muted,fontSize:12,marginTop:12}}>Track where buyers come from — copy a link for each place you post:</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
        {SOURCES.map(s=><button key={s} onClick={()=>copy(s)} style={chip(copied===s,C.blue)}>{copied===s?'Copied ✓':s}{bySource[s]?' · '+bySource[s]:''}</button>)}
      </div>
      {copied==='fail' && <div style={{color:C.amber,fontSize:12,marginTop:6}}>Copy was blocked — select the link above and copy it.</div>}
      <div style={{background:C.ink,borderRadius:10,padding:'10px 12px',marginTop:12,fontSize:12.5,color:C.muted,lineHeight:1.55}}>
        <b style={{color:C.cream}}>{recent}</b> sign-up{recent===1?'':'s'} this week{Object.keys(bySource).length?' · all time: '+Object.entries(bySource).map(([k,v])=>k+' '+v).join(', '):''}.
        <div style={{marginTop:4}}>Post idea: <i>"Buying in {markets.split(',')[0]||'your area'}? I send off-market deals to my buyers list first. Get on it here 👉 [link]"</i></div>
      </div>
    </div>
  )
}
