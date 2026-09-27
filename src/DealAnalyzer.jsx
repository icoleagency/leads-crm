import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { REPAIRS, detailsOf, money } from './leadModel'

const C = {
  navy:'#0b1826', ink:'#081019', panel:'#102434', panel2:'#0d1f2e', line:'#1d3a4a',
  cream:'#f4f1ea', orange:'#ff6b1a', orangeSoft:'#ff9052', muted:'#88a0b4',
  green:'#3fd08a', amber:'#f5b942', red:'#e5573f', blue:'#4aa8ff'
}

// Condition of the comp at sale, vs. a fully renovated house (ARV = after-repair value).
const CONDS = [
  ['','Not set'],
  ['renovated','Renovated'],
  ['average','Average'],
  ['dated','Dated'],
  ['distressed','Distressed'],
]
const DEFAULT_SET = { sizePct:50, bed:5000, bath:5000, apprPct:4, average:5, dated:10, distressed:20 }
const DEFAULT_REHAB = { mode:'level', level:'moderate', rates:{ cosmetic:20, moderate:35, gut:60 }, point:'mid', contingency:10 }
const DEFAULT_OFFER = { pct:70, fee:15000, holdMonths:4, holdMonthly:1500 }
const LEVELS = [['cosmetic','Cosmetic','paint, floors, fixtures'],['moderate','Moderate','kitchen/bath refresh + systems'],['gut','Full gut','down to the studs']]

const num = v => { const n = Number(String(v??'').replace(/[$,\s]/g,'')); return isFinite(n) ? n : 0 }
const has = v => v!=='' && v!==null && v!==undefined && !isNaN(num(v))
const median = a => { if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 }
const round1k = n => Math.max(0, Math.round(n/1000)*1000)
let seq = 0
const newId = () => 'c'+Date.now().toString(36)+(seq++)

function monthsAgo(date){
  if(!date) return 0
  const d = new Date(date); if(isNaN(d)) return 0
  return Math.max(0, (Date.now()-d.getTime())/(30.44*86400000))
}
function toISODate(s){
  if(!s) return ''
  const t = String(s).trim().replace(/^([A-Za-z]+)-(\d{1,2})-(\d{4})$/,'$1 $2 $3')
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if(iso) return iso[0]
  const d = new Date(t)
  if(isNaN(d)) return ''
  const p = n => String(n).padStart(2,'0')
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())
}

// ---------- Redfin CSV import ----------
function parseCSV(text){
  const rows=[]; let row=[], f='', q=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){f+='"';i++} else q=false } else f+=ch }
    else if(ch==='"') q=true
    else if(ch===','){ row.push(f); f='' }
    else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&text[i+1]==='\n') i++; row.push(f); f=''; if(row.some(x=>x.trim()!=='')) rows.push(row); row=[] }
    else f+=ch
  }
  row.push(f); if(row.some(x=>x.trim()!=='')) rows.push(row)
  return rows
}
function importCSV(text){
  const rows = parseCSV(text)
  if(rows.length<2) return { comps:[], skipped:0, error:'That file has no rows.' }
  const H = rows[0].map(h=>h.trim().toLowerCase())
  const col = (...names) => H.findIndex(h=>names.some(n=>h===n || h.startsWith(n)))
  const ix = {
    addr:col('address'), city:col('city'), state:col('state'), zip:col('zip'),
    price:col('price','sale price','sold price'), beds:col('beds','bedrooms'), baths:col('baths','bathrooms'),
    sqft:col('square feet','sqft','living area'), year:col('year built'), sold:col('sold date','sale date','date sold'),
  }
  if(ix.addr<0 || ix.price<0) return { comps:[], skipped:0, error:"Couldn't find Address and Price columns. Use Redfin's \"Download All\" file for sold homes." }
  const out=[]; let skipped=0
  for(const r of rows.slice(1)){
    const g = i => i>=0 ? (r[i]||'').trim() : ''
    const price=num(g(ix.price)), sold=toISODate(g(ix.sold))
    if(!price || (ix.sold>=0 && !sold)){ skipped++; continue }
    const addr=[g(ix.addr), g(ix.city), [g(ix.state),g(ix.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    out.push({ id:newId(), address:addr, soldDate:sold, price, sqft:num(g(ix.sqft))||'', beds:g(ix.beds), baths:g(ix.baths), year:g(ix.year), cond:'', on:true })
  }
  return { comps:out, skipped }
}

// ---------- Zillow / Redfin listing text paste ----------
function parseListing(text){
  const t = text.replace(/\u00a0/g,' ')
  const m = re => { const x=t.match(re); return x ? x[1] : '' }
  let price = m(/(?:sold for|sold price|last sold (?:for|price)?|sale price)[:\s]*\$\s?([\d,]+)/i)
  if(!price){ const all=[...t.matchAll(/\$\s?([\d,]{5,})/g)].map(x=>num(x[1])).filter(n=>n>=20000); if(all.length) price=String(all[0]) }
  const sold = m(/sold(?: on)?[:\s]+([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)
  const addr = (t.match(/\d+[^,\n$]{2,60},\s*[A-Za-z .'-]{2,40},\s*[A-Z]{2}\s*\d{5}/)||[''])[0]
  return {
    id:newId(), address:addr.trim(), price:num(price)||'',
    beds:m(/(\d+(?:\.\d+)?)\s*(?:bd|bds|beds?|bedrooms?)\b/i),
    baths:m(/(\d+(?:\.\d+)?)\s*(?:ba|baths?|bathrooms?)\b/i),
    sqft:num(m(/([\d,]{3,6})\s*(?:sq\.?\s*ft|sqft|square feet)/i))||'',
    year:m(/(?:built in|year built:?)\s*(\d{4})/i),
    soldDate:toISODate(sold.replace(/\.$/,'')), cond:'', on:true,
  }
}

// ---------- the math ----------
function analyze(S, comps, set){
  const valid = comps.filter(c=>c.on && num(c.price)>0 && num(c.sqft)>0)
  const medPpsf = median(valid.map(c=>num(c.price)/num(c.sqft)))
  const rows = comps.map(c=>{
    const price=num(c.price), items=[], warn=[]
    if(!price) return { c, items, total:0, value:0, warn, ok:false }
    if(has(S.sqft) && num(c.sqft)>0 && medPpsf) items.push(['Size', (num(S.sqft)-num(c.sqft))*medPpsf*set.sizePct/100])
    if(has(S.beds) && has(c.beds) && c.beds!=='') items.push(['Beds', (num(S.beds)-num(c.beds))*set.bed])
    if(has(S.baths) && has(c.baths) && c.baths!=='') items.push(['Baths', (num(S.baths)-num(c.baths))*set.bath])
    if(c.cond && c.cond!=='renovated') items.push(['Condition', price*(set[c.cond]||0)/100])
    const mo = monthsAgo(c.soldDate)
    if(mo>0.5) items.push(['Market time', price*set.apprPct/100*mo/12])
    if(mo>12) warn.push('sold '+Math.round(mo)+' mo ago')
    if(has(S.sqft) && num(c.sqft)>0 && Math.abs(num(c.sqft)-num(S.sqft))/num(S.sqft)>0.25) warn.push('size off >25%')
    if(has(S.beds) && c.beds!=='' && Math.abs(num(c.beds)-num(S.beds))>=2) warn.push('bed count off')
    if(!c.cond) warn.push('set condition')
    const total = items.reduce((s,x)=>s+x[1],0)
    return { c, items, total, value:price+total, mo, warn, ok:true }
  })
  const used = rows.filter(r=>r.ok && r.c.on)
  const vals = used.map(r=>r.value)
  const arv = Math.round(median(vals)/1000)*1000
  const renoPpsf = median(valid.filter(c=>c.cond==='renovated').map(c=>num(c.price)/num(c.sqft)))
  const cross = has(S.sqft) ? Math.round((renoPpsf||medPpsf)*num(S.sqft)/1000)*1000 : 0

  let score=0; const why=[]
  const n=used.length
  score += n>=5?30 : n>=3?20 : n>=1?5 : 0
  if(n<3) why.push('fewer than 3 comps')
  const medMo = median(used.map(r=>r.mo||0))
  score += medMo<=6?25 : medMo<=12?15 : 5
  if(medMo>6) why.push('comps are aging')
  const similar = has(S.sqft) ? used.filter(r=>Math.abs(num(r.c.sqft)-num(S.sqft))/num(S.sqft)<=0.2).length : 0
  score += n ? Math.round(25*similar/n) : 0
  if(n && similar/n<0.6) why.push('sizes vary from subject')
  const mean = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
  const cv = mean ? Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)/mean : 1
  score += cv<=0.08?20 : cv<=0.15?12 : 4
  if(cv>0.15) why.push('comps disagree on value')
  const conf = n===0 ? null : score>=75 ? {l:'High',c:C.green} : score>=50 ? {l:'Medium',c:C.amber} : {l:'Low',c:C.red}

  return { rows, arv, low:vals.length?Math.min(...vals):0, high:vals.length?Math.max(...vals):0, medPpsf, renoPpsf, cross, conf, why, n }
}

// ---------- component ----------
export default function DealAnalyzer({leads,initialLeadId,reload,isMobile}){
  const [leadId,setLeadId] = useState(initialLeadId ? String(initialLeadId) : '')
  const lead = leads.find(l=>String(l.id)===leadId) || null
  const init = l => {
    const d = detailsOf(l||{}); const saved = l && l.details && l.details.comp
    return {
      S: saved?.subject || { beds:d.beds, baths:d.baths, sqft:d.sqft, year:d.year_built },
      comps: saved?.comps || [],
      set: {...DEFAULT_SET, ...(saved?.set||{})},
      rehab: {...DEFAULT_REHAB, ...(saved?.rehab||{}), rates:{...DEFAULT_REHAB.rates, ...(saved?.rehab?.rates||{})}},
      offer: {...DEFAULT_OFFER, ...(saved?.offer||{})},
    }
  }
  const [st,setSt] = useState(()=>init(lead))
  const { S, comps, set, rehab, offer } = st
  const up = (k,v) => setSt(s=>({...s,[k]:v}))
  const [showSet,setShowSet] = useState(false)
  const [paste,setPaste] = useState(null)
  const [msg,setMsg] = useState(null)
  const [saving,setSaving] = useState(false)
  const fileRef = useRef(null)

  function pickLead(id){ setLeadId(id); setSt(init(leads.find(l=>String(l.id)===id))); setMsg(null) }
  const setC = (id,k,v) => up('comps', comps.map(c=>c.id===id?{...c,[k]:v}:c))
  const addComps = list => up('comps', [...comps, ...list])

  async function onFile(e){
    const f = e.target.files?.[0]; e.target.value=''
    if(!f) return
    const r = importCSV(await f.text())
    if(r.error) setMsg({ok:false,t:r.error})
    else { addComps(r.comps); setMsg({ok:true,t:'Imported '+r.comps.length+' sold comp'+(r.comps.length===1?'':'s')+(r.skipped?' · skipped '+r.skipped+' rows with no sale date/price':'')+'. Now set each comp\'s condition.'}) }
  }
  function addPaste(){
    const c = parseListing(paste||'')
    addComps([c]); setPaste(null)
    const miss = [!c.address&&'address',!c.price&&'price',!c.sqft&&'sqft',!c.soldDate&&'sold date'].filter(Boolean)
    setMsg(miss.length ? {ok:false,t:'Added — but couldn\'t find '+miss.join(', ')+'. Fill those in on the new row.'} : {ok:true,t:'Comp added from pasted listing. Set its condition.'})
  }

  const A = analyze(S, comps, set)
  const d = detailsOf(lead||{})
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const pt = rehab.point==='low'?2 : rehab.point==='high'?3 : null
  const itemBase = flagged.reduce((s,r)=>s+(pt?r[pt]:(r[2]+r[3])/2),0)
  const levelBase = num(S.sqft)*(rehab.rates[rehab.level]||0)
  const rehabBase = rehab.mode==='items' ? itemBase : levelBase
  const rehabTotal = Math.round(rehabBase*(1+rehab.contingency/100)/500)*500

  const arv = A.arv
  const walk = round1k(arv*offer.pct/100 - rehabTotal - offer.fee)
  const target = round1k(walk - arv*0.03)
  const open = round1k(walk - arv*0.08)
  const buyerPrice = walk + num(offer.fee)
  const bClose = buyerPrice*0.02, bHold = offer.holdMonths*offer.holdMonthly, bSell = arv*0.08
  const bProfit = arv - buyerPrice - rehabTotal - bClose - bHold - bSell
  const bCash = buyerPrice + rehabTotal + bClose + bHold
  const bRoi = bCash>0 ? bProfit/bCash : 0
  const verdict = !arv ? null : bProfit>=Math.max(25000,arv*0.10) ? {t:'Buyer-friendly',c:C.green} : bProfit>=arv*0.05 ? {t:'Thin for a flipper',c:C.amber} : {t:"Won't sell to a flipper",c:C.red}
  const ask = num(d.asking_price)

  async function save(){
    if(!lead) return
    setSaving(true); setMsg(null)
    try{
      const result = { arv, arvLow:Math.round(A.low), arvHigh:Math.round(A.high), confidence:A.conf?.l||null, comps:A.n,
        rehab:rehabTotal, walk, target, open, updated_at:new Date().toISOString() }
      const details = {...(lead.details||{}),
        beds:has(S.beds)&&S.beds!==''?num(S.beds):(lead.details||{}).beds??null,
        baths:has(S.baths)&&S.baths!==''?num(S.baths):(lead.details||{}).baths??null,
        sqft:has(S.sqft)&&S.sqft!==''?num(S.sqft):(lead.details||{}).sqft??null,
        year_built:has(S.year)&&S.year!==''?num(S.year):(lead.details||{}).year_built??null,
        comp:{ subject:S, comps, set, rehab, offer, result } }
      const { error } = await supabase.from('leads').update({ arv, details }).eq('id',lead.id)
      if(error) throw error
      setMsg({ok:true,t:'Saved to '+lead.name+'. Their Call Card and script now use this ARV and offer range.'})
      reload()
    }catch(e){ setMsg({ok:false,t:/fetch/i.test(e.message)?"Can't reach the database — try again in a minute.":e.message}) }
    setSaving(false)
  }

  const h1 = {fontFamily:'Georgia,serif',fontSize:isMobile?22:27,margin:0,fontWeight:600}
  const card = {background:C.panel,border:'1px solid '+C.line,borderRadius:16,padding:20,minWidth:0}
  const cap = {color:C.muted,fontSize:11,textTransform:'uppercase',letterSpacing:1}
  const inp = {background:C.ink,border:'1px solid '+C.line,borderRadius:6,padding:'7px 8px',color:C.cream,fontSize:12.5,outline:'none',width:'100%',boxSizing:'border-box'}
  const btn = (primary)=>({background:primary?C.orange:'transparent',color:primary?C.ink:C.cream,border:'1px solid '+(primary?C.orange:C.line),borderRadius:8,padding:'8px 13px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'})

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
        <div>
          <h1 style={h1}>Deal Analyzer</h1>
          <p style={{color:C.muted,margin:'3px 0 0',fontSize:isMobile?12.5:13.5,maxWidth:640}}>Sold comps → adjusted ARV → rehab → offer ladder. Save it to the lead and your Call Card and script use the real numbers.</p>
        </div>
        <select value={leadId} onChange={e=>pickLead(e.target.value)} style={{...inp,width:isMobile?'100%':260,padding:'9px 10px',fontSize:13}}>
          <option value="">— Blank analysis (no lead) —</option>
          {leads.map(l=><option key={l.id} value={String(l.id)}>{l.name}{l.address?' · '+l.address:''}</option>)}
        </select>
      </div>

      {/* Subject */}
      <div style={{...card,marginTop:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14}}>Subject property <span style={{color:C.muted,fontWeight:400,fontSize:12}}>{lead ? '— '+[lead.address,lead.city,lead.state].filter(Boolean).join(', ') : '— enter the details'}</span></div>
          {lead && ask>0 && <span style={{color:C.muted,fontSize:12}}>Seller asking <b style={{color:C.cream}}>{money(ask)}</b></span>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:10}}>
          {[['beds','Beds'],['baths','Baths'],['sqft','Sqft'],['year','Year built']].map(([k,l])=>(
            <label key={k} style={{color:C.muted,fontSize:11}}>{l}<input type="number" value={S[k]??''} onChange={e=>up('S',{...S,[k]:e.target.value})} style={{...inp,marginTop:4,fontSize:14,padding:'9px 10px'}}/></label>
          ))}
        </div>
      </div>

      {/* Comps */}
      <div style={{...card,marginTop:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:14}}>Sold comps <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— {A.n} used{A.medPpsf?' · median $'+Math.round(A.medPpsf)+'/sqft':''}</span></div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()} style={btn(true)}>Upload Redfin CSV</button>
            <button onClick={()=>setPaste(paste===null?'':null)} style={btn(false)}>Paste Zillow/Redfin listing</button>
            <button onClick={()=>addComps([{id:newId(),address:'',soldDate:'',price:'',sqft:'',beds:'',baths:'',year:'',cond:'',on:true}])} style={btn(false)}>+ Add row</button>
          </div>
        </div>
        <div style={{color:C.muted,fontSize:11.5,lineHeight:1.5,marginBottom:10}}>
          Redfin: search the area → filter <b style={{color:C.cream}}>Sold, last 6 months</b> → list view → <b style={{color:C.cream}}>Download All</b> at the bottom. Zillow: open a sold home, select all the page text, copy, and paste it here.
        </div>

        {paste!==null &&
        <div style={{marginBottom:12}}>
          <textarea autoFocus value={paste} onChange={e=>setPaste(e.target.value)} rows={4} placeholder="Paste the text of a sold listing here..." style={{...inp,fontSize:13,resize:'vertical',fontFamily:'inherit'}}/>
          <div style={{display:'flex',gap:6,marginTop:6}}>
            <button onClick={addPaste} disabled={!paste.trim()} style={btn(true)}>Add comp</button>
            <button onClick={()=>setPaste(null)} style={btn(false)}>Cancel</button>
          </div>
        </div>}

        {msg && <div style={{marginBottom:10,fontSize:12.5,lineHeight:1.45,color:msg.ok?C.green:C.amber,background:(msg.ok?C.green:C.amber)+'14',border:'1px solid '+(msg.ok?C.green:C.amber)+'44',borderRadius:8,padding:'8px 11px'}}>{msg.t}</div>}

        {comps.length===0 ? <div style={{color:C.muted,fontSize:13,padding:'14px 0'}}>No comps yet. Aim for 3–6 sold homes within about a mile, sold in the last 6 months, similar size.</div> :
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5,minWidth:960}}>
            <thead><tr>
              {['Use','Address','Sold','Price','Sqft','Bd','Ba','Yr','Condition','$/sqft','Adjust','Adjusted',''].map((h,i)=>(
                <th key={i} style={{textAlign:i>=3&&i!==8&&i<12?'right':'left',color:C.muted,fontWeight:600,fontSize:10.5,textTransform:'uppercase',letterSpacing:0.5,padding:'6px 4px',borderBottom:'1px solid '+C.line}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{A.rows.map(r=>{
              const c=r.c, ppsf = num(c.price)&&num(c.sqft) ? Math.round(num(c.price)/num(c.sqft)) : null
              const cell = {padding:'5px 4px',borderBottom:'1px solid '+C.line,verticalAlign:'top'}
              return (
                <tr key={c.id} style={{opacity:c.on?1:0.45}}>
                  <td style={cell}><input type="checkbox" checked={c.on} onChange={e=>setC(c.id,'on',e.target.checked)}/></td>
                  <td style={{...cell,minWidth:200}}>
                    <input value={c.address} onChange={e=>setC(c.id,'address',e.target.value)} placeholder="Address" style={inp}/>
                    {r.warn.length>0 && <div style={{color:C.amber,fontSize:10.5,marginTop:3}}>{r.warn.join(' · ')}</div>}
                  </td>
                  <td style={{...cell,width:118}}><input type="date" value={c.soldDate} onChange={e=>setC(c.id,'soldDate',e.target.value)} style={inp}/></td>
                  <td style={{...cell,width:92}}><input value={c.price} onChange={e=>setC(c.id,'price',e.target.value)} placeholder="$" style={{...inp,textAlign:'right'}}/></td>
                  <td style={{...cell,width:64}}><input value={c.sqft} onChange={e=>setC(c.id,'sqft',e.target.value)} style={{...inp,textAlign:'right'}}/></td>
                  <td style={{...cell,width:40}}><input value={c.beds} onChange={e=>setC(c.id,'beds',e.target.value)} style={{...inp,textAlign:'right'}}/></td>
                  <td style={{...cell,width:44}}><input value={c.baths} onChange={e=>setC(c.id,'baths',e.target.value)} style={{...inp,textAlign:'right'}}/></td>
                  <td style={{...cell,width:54}}><input value={c.year} onChange={e=>setC(c.id,'year',e.target.value)} style={{...inp,textAlign:'right'}}/></td>
                  <td style={{...cell,width:108}}>
                    <select value={c.cond} onChange={e=>setC(c.id,'cond',e.target.value)} style={{...inp,borderColor:c.cond?C.line:C.amber+'88'}}>{CONDS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
                  </td>
                  <td style={{...cell,textAlign:'right',color:C.muted,paddingTop:11}}>{ppsf?'$'+ppsf:'—'}</td>
                  <td style={{...cell,textAlign:'right',paddingTop:11,color:r.total>0?C.green:r.total<0?C.red:C.muted}} title={r.items.map(([k,v])=>k+': '+(v>=0?'+':'-')+money(Math.abs(v))).join('\n')||'No adjustments'}>
                    {r.ok ? (r.total>=0?'+':'-')+money(Math.abs(r.total)) : '—'}
                    {r.items.length>0 && <div style={{color:C.muted,fontSize:10,marginTop:2}}>hover for detail</div>}
                  </td>
                  <td style={{...cell,textAlign:'right',paddingTop:11,fontWeight:700,color:C.cream}}>{r.ok?money(r.value):'—'}</td>
                  <td style={{...cell,paddingTop:9}}><button onClick={()=>up('comps',comps.filter(x=>x.id!==c.id))} title="Remove comp" style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:14}}>✕</button></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>}

        <button onClick={()=>setShowSet(!showSet)} style={{...btn(false),marginTop:12,fontWeight:600,color:C.muted}}>{showSet?'Hide':'Show'} adjustment settings</button>
        {showSet &&
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(7,1fr)',gap:10,marginTop:10}}>
          {[['sizePct','Size: % of $/sqft'],['bed','Per bedroom $'],['bath','Per bath $'],['apprPct','Market %/yr'],['average','Average cond. +%'],['dated','Dated cond. +%'],['distressed','Distressed +%']].map(([k,l])=>(
            <label key={k} style={{color:C.muted,fontSize:11}}>{l}<input type="number" value={set[k]} onChange={e=>up('set',{...set,[k]:num(e.target.value)})} style={{...inp,marginTop:4}}/></label>
          ))}
          <div style={{gridColumn:'1/-1',color:C.muted,fontSize:11.5,lineHeight:1.5}}>Each comp is adjusted <i>to your subject</i>: bigger subject = comp adjusted up. Comps sold in worse condition are adjusted up toward renovated, because ARV is the <i>after-repair</i> value. Older sales are trended forward at the market rate.</div>
        </div>}
      </div>

      {/* Results */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
        <div style={card}>
          <div style={cap}>After-repair value</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:34,fontWeight:800,color:arv?C.cream:C.muted,marginTop:4}}>{arv?money(arv):'—'}</div>
          {A.conf ?
          <div style={{marginTop:6}}>
            <span style={{background:A.conf.c+'22',color:A.conf.c,border:'1px solid '+A.conf.c+'66',borderRadius:12,padding:'2px 9px',fontSize:11.5,fontWeight:700}}>{A.conf.l} confidence</span>
            {A.why.length>0 && <div style={{color:C.muted,fontSize:11.5,marginTop:6,lineHeight:1.45}}>Why: {A.why.join(', ')}</div>}
          </div> : <div style={{color:C.muted,fontSize:12.5,marginTop:6}}>Add comps with a price and sqft.</div>}
          {arv>0 && <div style={{borderTop:'1px solid '+C.line,marginTop:12,paddingTop:10,fontSize:12.5,lineHeight:1.7}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted}}>Adjusted range</span><span>{money(A.low)} – {money(A.high)}</span></div>
            {A.cross>0 && <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted}}>{A.renoPpsf?'Renovated':'All-comp'} $/sqft check</span><span>{money(A.cross)}</span></div>}
            {A.cross>0 && Math.abs(A.cross-arv)/arv>0.1 && <div style={{color:C.amber,fontSize:11.5,lineHeight:1.4,marginTop:4}}>The $/sqft check is over 10% off the adjusted ARV — look at comp sizes and conditions.</div>}
          </div>}
        </div>

        <div style={card}>
          <div style={cap}>Rehab estimate</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:34,fontWeight:800,color:C.cream,marginTop:4}}>{money(rehabTotal)}</div>
          <div style={{display:'flex',gap:6,margin:'10px 0'}}>
            {[['level','By level'],['items','From Call Card']].map(([m,l])=>(
              <button key={m} onClick={()=>up('rehab',{...rehab,mode:m})} style={{...btn(rehab.mode===m),padding:'6px 11px',fontSize:11.5}}>{l}</button>
            ))}
          </div>
          {rehab.mode==='level' ?
          <div>
            {LEVELS.map(([k,l,sub])=>(
              <label key={k} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',fontSize:12.5,cursor:'pointer'}}>
                <input type="radio" checked={rehab.level===k} onChange={()=>up('rehab',{...rehab,level:k})}/>
                <span style={{flex:1}}>{l} <span style={{color:C.muted,fontSize:11}}>— {sub}</span></span>
                <span style={{color:C.muted,fontSize:11}}>$</span>
                <input type="number" value={rehab.rates[k]} onChange={e=>up('rehab',{...rehab,rates:{...rehab.rates,[k]:num(e.target.value)}})} style={{...inp,width:52,padding:'4px 6px'}}/>
                <span style={{color:C.muted,fontSize:11}}>/sqft</span>
              </label>
            ))}
            {!num(S.sqft) && <div style={{color:C.amber,fontSize:11.5,marginTop:4}}>Enter the subject's sqft to price by level.</div>}
          </div> :
          <div>
            {flagged.length===0 ? <div style={{color:C.muted,fontSize:12.5,lineHeight:1.5}}>{lead?'No repairs checked on this lead\'s Call Card yet.':'Pick a lead to use its Call Card repairs.'}</div> :
            <div>
              {flagged.map(r=>(
                <div key={r[0]} style={{display:'flex',justifyContent:'space-between',fontSize:12.5,padding:'2px 0'}}><span>{r[1]}</span><span style={{color:C.muted}}>{money(pt?r[pt]:(r[2]+r[3])/2)}</span></div>
              ))}
              <div style={{display:'flex',gap:6,marginTop:8}}>
                {[['low','Low'],['mid','Mid'],['high','High']].map(([k,l])=>(
                  <button key={k} onClick={()=>up('rehab',{...rehab,point:k})} style={{...btn(rehab.point===k),padding:'4px 10px',fontSize:11}}>{l}</button>
                ))}
              </div>
            </div>}
          </div>}
          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:12,color:C.muted}}>Contingency
            <input type="number" value={rehab.contingency} onChange={e=>up('rehab',{...rehab,contingency:num(e.target.value)})} style={{...inp,width:56,padding:'4px 6px'}}/>%
          </label>
        </div>

        <div style={{...card,borderColor:C.orange+'77'}}>
          <div style={cap}>Offer ladder</div>
          {arv>0 ? <div style={{marginTop:8}}>
            {[['Opening offer',open,'where you start',C.cream],['Target',target,'where you aim to land',C.cream],['Walk-away (MAO)',walk,'never go above this',C.orange]].map(([l,v,sub,col])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'6px 0',borderBottom:'1px solid '+C.line}}>
                <span style={{fontSize:13}}>{l}<span style={{display:'block',color:C.muted,fontSize:10.5}}>{sub}</span></span>
                <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:800,color:col}}>{money(v)}</span>
              </div>
            ))}
            {ask>0 && <div style={{marginTop:10,fontSize:12.5,lineHeight:1.5,color:ask>walk?C.amber:C.green}}>Seller wants {money(ask)} — {ask>walk?money(ask-walk)+' above your walk-away.':'inside your walk-away. Lock it up.'}</div>}
          </div> : <div style={{color:C.muted,fontSize:12.5,marginTop:8}}>Needs an ARV first.</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
            <label style={{color:C.muted,fontSize:11}}>% of ARV<input type="number" value={offer.pct} onChange={e=>up('offer',{...offer,pct:num(e.target.value)})} style={{...inp,marginTop:3}}/></label>
            <label style={{color:C.muted,fontSize:11}}>Your fee $<input type="number" value={offer.fee} onChange={e=>up('offer',{...offer,fee:num(e.target.value)})} style={{...inp,marginTop:3}}/></label>
          </div>
        </div>
      </div>

      {arv>0 &&
      <div style={{...card,marginTop:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:14}}>Your cash buyer's view <span style={{color:C.muted,fontWeight:400,fontSize:12}}>— if you contract at walk-away and assign</span></div>
          {verdict && <span style={{background:verdict.c+'22',color:verdict.c,border:'1px solid '+verdict.c+'66',borderRadius:12,padding:'3px 10px',fontSize:12,fontWeight:700}}>{verdict.t}</span>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(7,1fr)',gap:10,fontSize:12.5}}>
          {[['Buyer pays',buyerPrice],['Rehab',rehabTotal],['Buy closing (2%)',bClose],['Holding',bHold],['Sell costs (8%)',bSell],['Buyer profit',bProfit],['Cash-on-cash',null]].map(([l,v])=>(
            <div key={l} style={{background:C.ink,borderRadius:10,padding:'10px 11px'}}>
              <div style={{color:C.muted,fontSize:10.5}}>{l}</div>
              <div style={{fontWeight:700,marginTop:3,color:l==='Buyer profit'?(bProfit>0?C.green:C.red):C.cream}}>{v===null?Math.round(bRoi*100)+'%':(v<0?'-':'')+money(Math.abs(v))}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:14,marginTop:10,flexWrap:'wrap',color:C.muted,fontSize:11.5,alignItems:'center'}}>
          <label style={{display:'flex',alignItems:'center',gap:6}}>Hold months <input type="number" value={offer.holdMonths} onChange={e=>up('offer',{...offer,holdMonths:num(e.target.value)})} style={{...inp,width:52,padding:'4px 6px'}}/></label>
          <label style={{display:'flex',alignItems:'center',gap:6}}>Holding $/mo <input type="number" value={offer.holdMonthly} onChange={e=>up('offer',{...offer,holdMonthly:num(e.target.value)})} style={{...inp,width:72,padding:'4px 6px'}}/></label>
          <span>Flippers typically want $25k+ or 10%+ of ARV. If this says thin, your walk-away is too high for a flip buyer.</span>
        </div>
      </div>}

      <div style={{display:'flex',gap:10,alignItems:'center',marginTop:16,flexWrap:'wrap'}}>
        <button onClick={save} disabled={!lead||!arv||saving} style={{...btn(true),padding:'12px 22px',fontSize:13,opacity:(!lead||!arv||saving)?0.5:1,cursor:(!lead||!arv)?'default':'pointer'}}>{saving?'Saving...':'Save analysis to lead'}</button>
        <span style={{color:C.muted,fontSize:12}}>{!lead?'Pick a lead at the top to save this analysis.':!arv?'Add comps to get an ARV first.':'Updates the lead\'s ARV, Call Card, and script offer.'}</span>
      </div>
    </div>
  )
}
