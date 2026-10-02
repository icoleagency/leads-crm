import { supabase } from './supabaseClient'
import { money, compResult, detailsOf, REPAIRS } from './leadModel'
import { normPhone, fmtPhone } from './stacking'

export const BUYER_TYPES = ['Flipper','Landlord / BRRRR','Builder','Wholetailer','Fund / institutional','Other']
export const PROP_TYPES = ['Single family','Multi-family','Condo / townhouse','Land','Mobile home']
export const REHAB_LEVELS = ['Light','Medium','Heavy','Teardown']
export const RESPONSES = [
  ['interested','Interested','#4aa8ff'],
  ['showing','Showing set','#f5b942'],
  ['offer','Offer','#3fd08a'],
  ['passed','Passed','#88a0b4'],
]
export const KIND = { sent:['Sent','#88a0b4'], interested:['Interested','#4aa8ff'], showing:['Showing set','#f5b942'], offer:['Offer','#3fd08a'], passed:['Passed','#88a0b4'], assigned:['Assigned','#ff6b1a'] }

export function dispoErr(msg){
  const m = String(msg||'')
  if(/buyers|buyer_activity|schema cache|relation .* does not exist/i.test(m)) return 'setup'
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
}
async function run(q){ const { data, error } = await q; if(error) throw error; return data }

// ---------- buyers ----------
export async function fetchBuyers(){
  const all = []
  for(let from=0; from<20000; from+=1000){
    const rows = await run(supabase.from('buyers').select('*').order('name').range(from, from+999))
    all.push(...(rows||[])); if(!rows || rows.length<1000) break
  }
  return all
}
const cleanList = a => [...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))]
export function buyerRow(b){
  const num = v => v===''||v===null||v===undefined ? null : (Number(String(v).replace(/[$,\s]/g,''))||null)
  return { name:String(b.name||'').trim(), company:b.company||null, phone:b.phone?normPhone(b.phone)||String(b.phone).trim():null, email:b.email?String(b.email).trim().toLowerCase():null,
    buyer_type:b.buyer_type||null, markets:cleanList(b.markets), property_types:cleanList(b.property_types), min_price:num(b.min_price), max_price:num(b.max_price),
    rehab:cleanList(b.rehab), financing:b.financing||null, pof:!!b.pof, pof_date:b.pof_date||null, tags:cleanList(b.tags), notes:b.notes||null,
    status:b.status||'active', source:b.source||null, updated_at:new Date().toISOString() }
}
export function saveBuyer(b){
  const row = buyerRow(b)
  return run(b.id ? supabase.from('buyers').update(row).eq('id', b.id).select() : supabase.from('buyers').insert([row]).select())
}
export function deleteBuyer(id){ return run(supabase.from('buyers').delete().eq('id', id)) }
export async function importBuyers(rows, existing, onProgress=()=>{}){
  const seenPhone = new Set(existing.map(b=>normPhone(b.phone)).filter(Boolean))
  const seenEmail = new Set(existing.map(b=>(b.email||'').toLowerCase()).filter(Boolean))
  const fresh = []; let dupes = 0
  for(const r of rows){
    const row = buyerRow(r); if(!row.name) continue
    const ph = normPhone(row.phone), em = row.email
    if((ph && seenPhone.has(ph)) || (em && seenEmail.has(em))){ dupes++; continue }
    if(ph) seenPhone.add(ph); if(em) seenEmail.add(em)
    fresh.push(row)
  }
  for(let i=0; i<fresh.length; i+=500){
    await run(supabase.from('buyers').insert(fresh.slice(i,i+500)))
    onProgress('Importing… '+Math.min(i+500,fresh.length)+' / '+fresh.length)
  }
  return { added:fresh.length, dupes }
}

// ---------- activity ----------
export async function fetchBuyerActivity(){
  const since = new Date(); since.setDate(since.getDate()-365)
  return run(supabase.from('buyer_activity').select('*').gte('created_at', since.toISOString()).order('created_at',{ascending:false}).limit(5000))
}
export function logBuyer(buyerId, leadId, kind, {amount, note}={}){
  return run(supabase.from('buyer_activity').insert([{ buyer_id:buyerId, lead_id:String(leadId), kind, amount:Number(amount)||null, note:(note||'').trim()||null }]))
}
export async function logBlast(buyerIds, leadId, note){
  const rows = buyerIds.map(id=>({ buyer_id:id, lead_id:String(leadId), kind:'sent', note:note||null }))
  for(let i=0;i<rows.length;i+=500) await run(supabase.from('buyer_activity').insert(rows.slice(i,i+500)))
}
// latest status per buyer on one deal: { [buyer_id]: {kind, amount, note, at, history:[]} }
export function dealStatus(activity, leadId){
  const out = {}
  for(const a of activity){            // newest first
    if(a.lead_id!==String(leadId)) continue
    const s = out[a.buyer_id] || (out[a.buyer_id] = { history:[] })
    s.history.push(a)
    if(!s.kind){ s.kind=a.kind; s.at=a.created_at; s.note=a.note }
    if(a.kind==='offer' && s.amount===undefined) s.amount = Number(a.amount)||null
  }
  return out
}
export function buyerRecord(activity, buyerId){
  const mine = activity.filter(a=>a.buyer_id===buyerId)
  const deals = new Set(mine.map(a=>a.lead_id))
  return { sent:mine.filter(a=>a.kind==='sent').length, replied:new Set(mine.filter(a=>a.kind!=='sent').map(a=>a.lead_id)).size,
    offers:mine.filter(a=>a.kind==='offer').length, bought:mine.filter(a=>a.kind==='assigned').length, deals:deals.size, last:mine[0]?.created_at||null }
}

// ---------- deal numbers ----------
export const dispoOf = l => (l.details && l.details.dispo) || {}
export const dealOf = l => (l.details && l.details.deal) || {}
export function dealNumbers(l){
  const dp = dispoOf(l), dl = dealOf(l), cr = compResult(l), d = detailsOf(l)
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const estRehab = flagged.length ? Math.round(flagged.reduce((s,r)=>s+(r[2]+r[3])/2,0)) : null
  const arv = Number(dp.arv) || (cr && cr.arv) || Number(l.arv) || 0
  const rehab = Number(dp.rehab) || (cr && cr.rehab) || estRehab || 0
  const contract = Number(dl.contract_price) || 0
  const asking = Number(dp.asking) || (contract ? contract + 15000 : 0)
  return { arv, rehab, contract, asking, spread: asking && contract ? asking-contract : 0,
    buyerMargin: arv && asking ? arv - asking - rehab : 0, closing: dl.closing_date||'', emd: Number(dp.emd)||0 }
}
export function rehabLevel(l){
  const { rehab } = dealNumbers(l), cond = detailsOf(l).condition
  if(cond==='Tear-down' || rehab>=120000) return 'Teardown'
  if(cond==='Major repairs' || rehab>=60000) return 'Heavy'
  if(cond==='Needs updates' || rehab>=25000) return 'Medium'
  return 'Light'
}

// ---------- matching ----------
const norm = s => String(s||'').toLowerCase().replace(/\s*county$/,'').trim()
export function matchBuyer(b, l){
  if(b.status && b.status!=='active') return null
  const d = (l.details||{}), n = dealNumbers(l)
  const places = [l.city, d.county, d.zip, l.state].map(norm).filter(Boolean)
  const mk = (b.markets||[]).map(norm)
  const reasons = []; let score = 0
  const hit = mk.find(m=>places.includes(m))
  if(mk.length){ if(!hit) return null; reasons.push(['area', hit.toUpperCase()===hit ? hit : hit.replace(/\b\w/g,c=>c.toUpperCase()), true]); score += hit===norm(l.state) ? 25 : 40 }
  else { reasons.push(['area','buys anywhere',true]); score += 15 }
  const price = n.asking || n.contract
  if(price && (b.min_price || b.max_price)){
    const okP = (!b.min_price || price>=b.min_price) && (!b.max_price || price<=b.max_price)
    reasons.push(['price', (b.min_price?money(b.min_price):'$0')+'–'+(b.max_price?money(b.max_price):'any'), okP])
    if(!okP && b.max_price && price>b.max_price*1.1) return null
    score += okP ? 25 : 5
  }
  const lvl = rehabLevel(l)
  if((b.rehab||[]).length){ const okR = b.rehab.includes(lvl); reasons.push(['rehab', lvl.toLowerCase()+' rehab', okR]); score += okR ? 15 : 0 }
  if(b.pof){ reasons.push(['pof','proof of funds',true]); score += 10 }
  return { score, reasons }
}
export function matchesFor(buyers, l){
  return buyers.map(b=>({ b, m:matchBuyer(b,l) })).filter(x=>x.m).sort((a,b)=>b.m.score-a.m.score)
}

// ---------- blast copy ----------
export function blastText(l, {withAddress=true}={}){
  const d = detailsOf(l), n = dealNumbers(l), dp = dispoOf(l)
  const where = withAddress ? [l.address, l.city].filter(Boolean).join(', ')+(l.state?', '+l.state:'')+(d.zip?' '+d.zip:'') : [l.city, l.state].filter(Boolean).join(', ')+(d.zip?' '+d.zip:'')
  const facts = [d.beds&&d.beds+' bed', d.baths&&d.baths+' bath', d.sqft&&Number(d.sqft).toLocaleString()+' sqft', d.year_built&&'built '+d.year_built].filter(Boolean).join(' · ')
  const close = n.closing ? new Date(n.closing+'T12:00').toLocaleDateString([], {month:'short',day:'numeric'}) : ''
  const sms = [
    'NEW OFF-MARKET DEAL — '+where,
    facts,
    'Price: '+(n.asking?money(n.asking):'call for price')+(n.arv?' · ARV '+money(n.arv):'')+(n.rehab?' · repairs ~'+money(n.rehab):''),
    d.condition ? 'Condition: '+d.condition.toLowerCase()+(d.occupancy&&d.occupancy!=='Unknown'?', '+d.occupancy.toLowerCase():'') : '',
    (close?'Close by '+close+'. ':'')+'Cash or hard money'+(n.emd?', '+money(n.emd)+' EMD':'')+'.',
    'Reply YES for photos and access.',
  ].filter(Boolean).join('\n')
  const subject = 'Off-market'+(d.beds&&d.baths?' '+d.beds+'/'+d.baths:'')+' in '+[l.city,l.state].filter(Boolean).join(', ')+(n.asking?' — '+money(n.asking):'')
  const email = [
    'New off-market deal: '+where, '',
    facts && 'Property: '+facts,
    d.condition && 'Condition: '+d.condition+(d.occupancy&&d.occupancy!=='Unknown'?' · '+d.occupancy:''),
    '', 'Price: '+(n.asking?money(n.asking):'call for price'),
    n.arv ? 'ARV: '+money(n.arv) : '',
    n.rehab ? 'Estimated repairs: '+money(n.rehab) : '',
    n.arv && n.asking && n.rehab ? 'Potential spread: '+money(n.arv-n.asking-n.rehab)+' before costs' : '',
    '', dp.description || '',
    dp.photos ? 'Photos: '+dp.photos : '',
    dp.access ? 'Access: '+dp.access : '',
    close ? 'Closing by '+close+' · cash or hard money'+(n.emd?' · '+money(n.emd)+' non-refundable EMD':'') : 'Cash or hard money only'+(n.emd?' · '+money(n.emd)+' non-refundable EMD':''),
    '', 'First to sign and send EMD gets it. Reply or call to lock it up.',
  ].filter(x=>x!==false && x!==null && x!==undefined).join('\n').replace(/\n{3,}/g,'\n\n')
  return { sms, subject, email }
}
export const phoneOut = p => fmtPhone(normPhone(p)) || p || ''
