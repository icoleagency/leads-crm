import Papa from 'papaparse'
import { supabase } from './supabaseClient'
import { fetchAllRows } from './fetchAll'
import { BLANK_DETAILS, patchLead } from './leadModel'

// ---------- list types (order = priority when a property becomes a lead) ----------
export const LIST_TYPES = [
  ['Pre-foreclosure',   /pre.?foreclos|nod|default|auction|trustee/],
  ['Lis pendens',       /lis.?pend/],
  ['Tax delinquent',    /tax|delinq/],
  ['Probate / inherited',/probate|inherit|estate|deceased|heir/],
  ['Code violation',    /code|violation/],
  ['Vacant',            /vacant/],
  ['Divorce',           /divorc/],
  ['Eviction',          /evict/],
  ['Bankruptcy',        /bankrupt|bk/],
  ['Liens',             /lien|judg/],
  ['Tired landlord',    /landlord|rental/],
  ['Expired listing',   /expired|withdrawn|mls/],
  ['Absentee owner',    /absentee|out.?of.?state|non.?owner/],
  ['High equity',       /equity/],
  ['Free & clear',      /free.?(and|&)?.?clear|f&c/],
  ['Other',             /$^/],
].map(([label,re])=>({label,re}))
export const TYPE_NAMES = LIST_TYPES.map(t=>t.label)
export function guessType(name){
  const n = String(name||'').toLowerCase().replace(/[_-]+/g,' ')
  const t = LIST_TYPES.find(x=>x.re.test(n))
  return t ? t.label : 'Other'
}
export const STACK_COLOR = n => n>=4 ? '#e5573f' : n===3 ? '#ff6b1a' : n===2 ? '#f5b942' : '#88a0b4'

// ---------- normalizing ----------
const WORD = { STREET:'ST', STR:'ST', AVENUE:'AVE', AV:'AVE', ROAD:'RD', DRIVE:'DR', LANE:'LN', COURT:'CT',
  BOULEVARD:'BLVD', PLACE:'PL', TERRACE:'TER', CIRCLE:'CIR', PARKWAY:'PKWY', HIGHWAY:'HWY', TRAIL:'TRL',
  SQUARE:'SQ', NORTH:'N', SOUTH:'S', EAST:'E', WEST:'W', MOUNT:'MT', SAINT:'ST',
  APARTMENT:'UNIT', APT:'UNIT', SUITE:'UNIT', STE:'UNIT', LOT:'UNIT' }
export function normAddr(a){
  return String(a||'').toUpperCase().replace(/#/g,' UNIT ').replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(Boolean).map(w=>WORD[w]||w).join(' ').replace(/\bUNIT( UNIT)+\b/g,'UNIT')
}
export function addrKey(address, zip, city){
  const a = normAddr(address); if(!a) return ''
  const z = String(zip||'').match(/\d{5}/)
  return a+'|'+(z ? z[0] : normAddr(city))
}
// Leads have no zip, so they match on street + city.
export const leadKey = (address, city) => { const a=normAddr(address); return a ? a+'|'+normAddr(city) : '' }

const STATE_NAMES = { 'NEW JERSEY':'NJ', FLORIDA:'FL', DELAWARE:'DE', PENNSYLVANIA:'PA', 'NEW YORK':'NY', MARYLAND:'MD' }
const normState = s => { const u=String(s||'').trim().toUpperCase(); return STATE_NAMES[u] || u.slice(0,2) }
export function normPhone(p){
  let d = String(p||'').replace(/\D/g,'')
  if(d.length===11 && d[0]==='1') d = d.slice(1)
  return d.length===10 ? d : ''
}
export const fmtPhone = d => d && d.length===10 ? '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6) : d
const num = v => { const n = Number(String(v??'').replace(/[$,\s%]/g,'')); return isFinite(n) && String(v??'').trim()!=='' ? n : null }
const clean = v => String(v??'').trim()

// ---------- column mapping ----------
const P = '(property |site |situs )?'
export const FIELDS = [
  ['address','Property address',[new RegExp('^'+P+'(street )?address( line)?( 1)?$'), /^street( address)?$/, /^(parcel|location|situs|subject|full) (property )?address$/, /^(property )?location$/, /^property street$/]],
  ['unit','Unit',[new RegExp('^'+P+'unit( number)?$')]],
  ['city','City',[new RegExp('^'+P+'city$')]],
  ['state','State',[new RegExp('^'+P+'state$')]],
  ['zip','Zip',[new RegExp('^'+P+'zip( code)?( 5)?$'), /^postal code$/]],
  ['county','County',[new RegExp('^'+P+'county$')]],
  ['owner','Owner full name',[/^owner( 1)?( full)? names?$/, /^owners?$/, /^(primary|current|record) owner( name)?$/, /^owner s$/, /^defendants?( names?)?$/, /^(borrower|grantor|decedent)s?( name)?$/, /^full name$/, /^name$/]],
  ['owner_first','Owner first name',[/^owner( 1)? first( name)?$/, /^first name$/]],
  ['owner_last','Owner last name',[/^owner( 1)? last( name)?$/, /^last name$/]],
  ['mail_address','Mailing address',[/^(owner )?mail(ing)? (street )?address( 1)?$/, /^owner address$/]],
  ['mail_city','Mailing city',[/^(owner )?mail(ing)? city$/]],
  ['mail_state','Mailing state',[/^(owner )?mail(ing)? state$/]],
  ['mail_zip','Mailing zip',[/^(owner )?mail(ing)? zip( code)?$/]],
  ['beds','Beds',[/^(bedrooms?|beds?)$/]],
  ['baths','Baths',[/^(total )?(bathrooms?|baths?)$/]],
  ['sqft','Sq ft',[/^(building |living )?(sqft|sq ft|square feet|square footage)$/]],
  ['year_built','Year built',[/^(effective )?year built$/]],
  ['value','Est. value',[/^(est |estimated )?(market )?value$/, /^avm$/]],
  ['equity','Est. equity',[/^(est |estimated )?equity( amount)?$/]],
  ['loan','Loan balance',[/remaining balance/, /^(open |total )?(mortgage|loan) balance$/, /^(est |estimated )?(mortgage|loan) balance$/]],
  ['last_sale_date','Last sale date',[/^last sale( recording)? date$/]],
  ['last_sale_amount','Last sale amount',[/^last sale (amount|price)$/]],
  ['property_type','Property type',[/^property type$/]],
  ['record_date','Filing / record date',[/^(record|recording|recorded|filing|filed|file|lis pendens|lp|document) date$/, /^date (filed|recorded)$/]],
  ['case_number','Case / instrument #',[/^instrument( number| no)?$/, /^case( number| no)?$/, /^(document|doc) (number|no)$/, /^book page$/]],
  ['occupancy','Occupancy',[/^occupancy$/, /^owner occupied$/]],
  ['owner_type','Owner type',[/^(owner|lead|party) type$/]],
  ['owner2','Second owner full name',[/^(owner 2|co ?owner|second owner|spouse)( full)? name$/]],
  ['owner2_first','Second owner first name',[/^(owner 2|co ?owner|second owner|optional|spouse) first( name)?$/]],
  ['owner2_last','Second owner last name',[/^(owner 2|co ?owner|second owner|optional|spouse) last( name)?$/]],
]
export const MAIN_FIELDS = ['address','city','state','zip','owner','owner_first','owner_last','mail_address','value','loan']
const normHeader = h => String(h||'').toLowerCase().replace(/\./g,'').replace(/#/g,' ').replace(/[^a-z0-9]+/g,' ').trim()
const PHONE_RE = /^(owner |contact |skip |primary |alt |alternate |other |home |work |cell |mobile |landline |wireless )*(phone|mobile|cell|landline|wireless)( ?\d+)?( number)?$/
const EMAIL_RE = /^(owner |contact |primary )?e ?mail( ?\d+)?( address)?$/

export function autoMap(headers){
  const map = {}, used = new Set()
  for(const [k,,res] of FIELDS){
    const h = headers.find(h=>!used.has(h) && res.some(r=>r.test(normHeader(h))))
    if(h){ map[k]=h; used.add(h) }
  }
  map.phones = headers.filter(h=>PHONE_RE.test(normHeader(h)))
  map.emails = headers.filter(h=>EMAIL_RE.test(normHeader(h)))
  return map
}

// Finds the real header row even when the file starts with a title/notes line
// (common with Google Sheets / Excel exports), then returns rows as objects.
export function parseCsv(file){
  return new Promise((resolve,reject)=>{
    Papa.parse(file,{ header:false, skipEmptyLines:'greedy',
      complete:r=>{ try{ resolve(tableFrom(r.data)) }catch(e){ reject(e) } },
      error:reject })
  })
}
const isKnown = h => { const n = normHeader(h); return !!n && (FIELDS.some(([,,res])=>res.some(re=>re.test(n))) || PHONE_RE.test(n) || EMAIL_RE.test(n)) }
export function tableFrom(grid){
  const rows = (grid||[]).map(r=>(r||[]).map(c=>String(c??'').trim())).filter(r=>r.some(Boolean))
  if(!rows.length) return { headers:[], rows:[] }
  let best = 0, bestScore = -1
  for(let i=0; i<Math.min(25, rows.length); i++){
    const filled = rows[i].filter(Boolean)
    const score = filled.filter(isKnown).length*10 + (filled.length>=3 ? filled.length : 0)
    if(score > bestScore){ best = i; bestScore = score }
  }
  const seen = {}
  const headers = rows[best].map((h,i)=>{ let n = h || 'Column '+(i+1); if(seen[n]){ seen[n]++; n = n+' ('+seen[n]+')' } else seen[n]=1; return n })
  const body = rows.slice(best+1)
    .filter(r=>r.join('|')!==rows[best].join('|'))
    .map(r=>Object.fromEntries(headers.map((h,i)=>[h, r[i]??''])))
  return { headers, rows:body, skippedTop:best }
}

// CSV rows -> deduped property records (same address twice in one file = one record).
export function buildRecords(rows, map){
  const out = new Map()
  let skipped = 0
  for(const row of rows){
    const g = k => map[k] ? clean(row[map[k]]) : ''
    const unit = g('unit').replace(/^#\s*/,'')
    let street = g('address'), city = g('city'), st = g('state'), zip = g('zip')
    // whole address in one cell: "123 Main St, Mount Holly, NJ 08060"
    const full = street.match(/^(.+?),\s*([^,]+?),?\s+([A-Za-z]{2}|New Jersey|Florida|Delaware|Pennsylvania)\.?\s*(\d{5}(?:-\d{4})?)?$/)
    if(full && (!city || !zip)){ street = full[1]; city = city || full[2]; st = st || full[3]; zip = zip || full[4] || '' }
    else if(!zip){ const z = street.match(/\s(\d{5})(?:-\d{4})?$/); if(z){ zip = z[1]; street = street.slice(0, z.index).replace(/,\s*$/,'') } }
    street = street + (unit ? (/^(apt|unit|ste|suite|lot)\b/i.test(unit) ? ' '+unit : ' #'+unit) : '')
    const key = addrKey(street, zip, city)
    if(!key){ skipped++; continue }
    const owner = g('owner') || [g('owner_first'), g('owner_last')].filter(Boolean).join(' ')
    const mailing = [g('mail_address'), g('mail_city'), [g('mail_state'), g('mail_zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const phones = (map.phones||[]).map(h=>normPhone(row[h])).filter(Boolean)
    const emails = (map.emails||[]).map(h=>clean(row[h]).toLowerCase()).filter(e=>e.includes('@'))
    const data = {}
    for(const k of ['beds','baths','sqft','year_built','value','equity','loan','last_sale_amount']){ const n=num(g(k)); if(n!==null) data[k]=n }
    for(const k of ['last_sale_date','property_type','record_date','case_number','owner_type']){ if(g(k)) data[k]=g(k) }
    if(g('occupancy')){ const o=g('occupancy').toLowerCase(); data.occupancy = /absentee|non.?owner|no$|^n$|false/.test(o) ? 'Absentee' : /owner|yes|^y$|true/.test(o) ? 'Owner occupied' : g('occupancy') }
    const owner2 = g('owner2') || [g('owner2_first'), g('owner2_last')].filter(Boolean).join(' ')
    if(owner2 && owner2.toLowerCase()!==owner.toLowerCase()) data.co_owner = owner2
    if(data.value && data.equity!==undefined && data.loan===undefined) data.loan = Math.max(0, data.value - data.equity)
    const rec = { addr_key:key, address:street.replace(/\s+/g,' ').trim(), city, state:normState(st),
      zip:(zip.match(/\d{5}/)||[''])[0], county:g('county'), owner_name:owner, mailing, phones, emails, data }
    const prev = out.get(key)
    out.set(key, prev ? mergeFields(prev, rec) : rec)
  }
  return { records:[...out.values()], skipped }
}

const uniq = a => [...new Set(a.filter(Boolean))]
function mergeFields(a, b){
  return { ...a,
    city:a.city||b.city, state:a.state||b.state, zip:a.zip||b.zip, county:a.county||b.county,
    owner_name:b.owner_name||a.owner_name, mailing:b.mailing||a.mailing,
    phones:uniq([...(a.phones||[]), ...(b.phones||[])]), emails:uniq([...(a.emails||[]), ...(b.emails||[])]),
    data:{...(a.data||{}), ...(b.data||{})} }
}

// ---------- errors ----------
export function stackErr(msg){
  const m = String(msg||'')
  if(/\b(score|equity_pct|est_value|owner_type|years_owned|out_of_state|absentee|filed_on)\b/i.test(m) && /column|schema cache|does not exist|find/i.test(m))
    return 'upgrade'
  if(/propert(y_lists|ies)|remove_property_list|schema cache|relation .* does not exist/i.test(m))
    return 'setup'
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
}

// ---------- smart score ----------
// How much each list type says "this owner may need to sell".
export const TYPE_WEIGHT = { 'Pre-foreclosure':30, 'Lis pendens':30, 'Probate / inherited':25, 'Tax delinquent':22, 'Divorce':20,
  'Code violation':18, 'Vacant':18, 'Eviction':15, 'Bankruptcy':15, 'Liens':15, 'Tired landlord':12, 'Expired listing':12,
  'Free & clear':12, 'Absentee owner':10, 'High equity':10, 'Other':8 }
export function parseDate(s){
  const t = String(s||'').trim(); if(!t) return null
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if(m){ const y = m[3].length===2 ? (Number(m[3])>50?'19':'20')+m[3] : m[3]; return y+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0') }
  return null
}
export function ownerCategory(t){
  const s = String(t||'').toLowerCase(); if(!s) return null
  if(/deceased|estate|probate|personal rep|heir/.test(s)) return 'estate'
  if(/gov|hoa|lien|bank|lender/.test(s)) return 'check'
  if(/trust/.test(s)) return 'trust'
  if(/llc|company|corp|inc|business/.test(s)) return 'company'
  return 'individual'
}
// Facts read straight off a property record.
export function analyzeProperty(p){
  const d = p.data||{}
  const mailStreet = String(p.mailing||'').split(',')[0]
  const mailState = (String(p.mailing||'').match(/,\s*([A-Za-z]{2})\s*\d{0,5}(-\d{4})?\s*$/)||[])[1]
  const out_of_state = !!(mailState && p.state && mailState.toUpperCase()!==String(p.state).toUpperCase())
  const absentee = out_of_state || d.occupancy==='Absentee' || !!(mailStreet && normAddr(mailStreet)!==normAddr(p.address) && !/^p\.?\s*o\.?\s*box/i.test(mailStreet))
  const value = Number(d.value)||null
  const loan = d.loan!==undefined && d.loan!==null ? Number(d.loan) : (value && d.equity!==undefined ? value-Number(d.equity) : null)
  const equity_pct = value && loan!==null ? Math.max(-100, Math.min(100, Math.round((value-loan)/value*100))) : null
  const yr = (String(d.last_sale_date||'').match(/(19|20)\d\d/)||[])[0]
  const years_owned = yr ? Math.max(0, new Date().getFullYear()-Number(yr)) : null
  const filed_on = parseDate(d.record_date)
  return { out_of_state, absentee, est_value:value, loan, equity_pct, years_owned, filed_on, owner_type:ownerCategory(d.owner_type), mailState }
}
// 0–100: list types (weighted) + what the record tells us. Returns the reasons too.
export function scoreProperty(p){
  const a = analyzeProperty(p), why = []
  const add = (pts, label) => { if(pts) why.push([pts, label]) }
  const types = p.list_types||[]
  for(const t of types) add(TYPE_WEIGHT[t]??8, t)
  if(types.length>=2) add((types.length-1)*5, 'On '+types.length+' lists')
  if(a.equity_pct!==null){
    if(a.equity_pct>=100) add(12,'Free & clear')
    else if(a.equity_pct>=50) add(8,a.equity_pct+'% equity')
    else if(a.equity_pct>=30) add(3,a.equity_pct+'% equity')
    else if(a.equity_pct<10) add(-12,'Low equity ('+a.equity_pct+'%) — hard to wholesale')
  }
  if(a.out_of_state) add(8,'Out-of-state owner'); else if(a.absentee) add(5,'Absentee owner')
  if(a.years_owned!==null && a.years_owned>=15) add(5,'Owned '+a.years_owned+' years')
  if(a.owner_type==='estate') add(10,'Estate / probate')
  if(a.owner_type==='company') add(-3,'Company owned')
  if(a.owner_type==='check') add(-6,'Name may be a lender/HOA')
  if(a.filed_on){ const days = Math.floor((Date.now()-new Date(a.filed_on+'T12:00').getTime())/86400000)
    if(days>=0 && days<=30) add(10,'Filed '+days+' days ago'); else if(days>30 && days<=90) add(5,'Filed in the last 90 days') }
  const score = Math.max(0, Math.min(100, why.reduce((s,[n])=>s+n,0)))
  return { score, why:why.sort((x,y)=>y[0]-x[0]), facts:a }
}
export const scoreLabel = s => s>=70 ? ['Hot','#e5573f'] : s>=50 ? ['Warm','#ff6b1a'] : s>=30 ? ['Mild','#f5b942'] : ['Cold','#88a0b4']
// Columns stored on each property so the database can sort and filter.
export function derivedColumns(p){
  const { score, facts:a } = scoreProperty(p)
  return { score, equity_pct:a.equity_pct, est_value:a.est_value, owner_type:a.owner_type, years_owned:a.years_owned,
    out_of_state:a.out_of_state, absentee:a.absentee, filed_on:a.filed_on }
}
// Recalculate stored scores (all rows, or only ones never scored).
export async function rescore({onlyMissing=true, onProgress=()=>{}}={}){
  const rows = await fetchAllRows(()=>{ let q = supabase.from('properties').select('*').order('id'); return onlyMissing ? q.is('score', null) : q })
  const out = rows.map(p=>({ addr_key:p.addr_key, address:p.address, ...derivedColumns(p) }))
  for(let i=0;i<out.length;i+=500){
    const { error } = await supabase.from('properties').upsert(out.slice(i,i+500), { onConflict:'addr_key' })
    if(error) throw error
    onProgress('Scoring… '+Math.min(i+500,out.length).toLocaleString()+' / '+out.length.toLocaleString())
  }
  return out.length
}

// ---------- skip trace ----------
function splitMailing(m){
  const parts = String(m||'').split(',').map(x=>x.trim()).filter(Boolean)
  const last = parts.length>1 ? parts[parts.length-1] : ''
  const sz = last.match(/^([A-Za-z]{2})\s*(\d{5})?/)
  if(sz) return { street:parts.slice(0, parts.length>2?parts.length-2:1).join(', '), city:parts.length>2?parts[parts.length-2]:'', state:sz[1], zip:sz[2]||'' }
  return { street:parts[0]||'', city:parts[1]||'', state:'', zip:'' }
}
export function skipTraceCsv(props){
  const rows = props.map(p=>{
    const company = /\b(llc|inc|corp|trust|estate|bank|association|hoa|company|ltd|lp)\b/i.test(p.owner_name||'')
    const nm = String(p.owner_name||'').trim().split(/\s+/)
    const m = splitMailing(p.mailing)
    return { 'First Name': company?'':(nm.length>1?nm.slice(0,-1).join(' '):''), 'Last Name': company?p.owner_name:(nm.length?nm[nm.length-1]:''),
      'Property Address':p.address, 'Property City':p.city||'', 'Property State':p.state||'', 'Property Zip':p.zip||'',
      'Mailing Address':m.street||p.address, 'Mailing City':m.city||p.city||'', 'Mailing State':m.state||p.state||'', 'Mailing Zip':m.zip||p.zip||'' }
  })
  return Papa.unparse(rows)
}
// Skip-trace results: add phones/emails onto properties you already have. Never creates properties or lists.
export async function appendContacts(records, leads, onProgress=()=>{}){
  const existing = new Map()
  for(const part of chunks(records.map(r=>r.addr_key), 100)){
    const { data, error } = await supabase.from('properties').select('*').in('addr_key', part)
    if(error) throw error
    for(const p of data||[]) existing.set(p.addr_key, p)
  }
  let phonesAdded = 0, matched = 0
  const rows = []
  for(const r of records){
    const e = existing.get(r.addr_key); if(!e) continue
    matched++
    const phones = uniq([...(e.phones||[]), ...(r.phones||[])]), emails = uniq([...(e.emails||[]), ...(r.emails||[])])
    phonesAdded += phones.length-(e.phones||[]).length
    if(phones.length===(e.phones||[]).length && emails.length===(e.emails||[]).length && (e.owner_name || !r.owner_name)) continue
    rows.push({ addr_key:e.addr_key, address:e.address, phones, emails, owner_name:e.owner_name||r.owner_name||null, mailing:e.mailing||r.mailing||null, updated_at:new Date().toISOString(), _lead:e.lead_id })
  }
  for(let i=0;i<rows.length;i+=500){
    const { error } = await supabase.from('properties').upsert(rows.slice(i,i+500).map(({_lead,...x})=>x), { onConflict:'addr_key' }) // eslint-disable-line no-unused-vars
    if(error) throw error
    onProgress('Adding numbers… '+Math.min(i+500,rows.length)+' / '+rows.length)
  }
  // push new numbers onto linked leads
  const leadById = new Map((leads||[]).map(l=>[String(l.id), l]))
  const linked = rows.filter(r=>r._lead && leadById.has(String(r._lead)))
  for(const part of chunks(linked, 10)){
    await Promise.all(part.map(r=>{ const l = leadById.get(String(r._lead))
      return patchLead(l, { phones:uniq([...((l.details||{}).phones||[]), ...r.phones]) }, { ...(l.phone?{}:{phone:r.phones[0]||''}), skiptraced:r.phones.length>0 }) }))
  }
  return { matched, unmatched:records.length-matched, phonesAdded, updated:rows.length, leadsUpdated:linked.length }
}
export async function matchShare(records){
  const keys = records.slice(0,300).map(r=>r.addr_key); if(!keys.length) return 0
  let hit = 0
  for(const part of chunks(keys, 100)){
    const { data, error } = await supabase.from('properties').select('addr_key').in('addr_key', part)
    if(error) return 0
    hit += (data||[]).length
  }
  return hit/keys.length
}

// ---------- import ----------
const chunks = (a,n) => Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,i*n+n))

export async function importList({records, name, type, campaign, leads, onProgress=()=>{}}){
  const { data:list, error:le } = await supabase.from('property_lists')
    .insert([{ name:name.trim(), type, campaign:campaign||null, rows_in_file:records.length }]).select().single()
  if(le) throw le
  const listId = String(list.id)
  const entry = { list_id:listId, name:list.name, type, at:list.created_at }

  // pull any existing records for these addresses
  onProgress('Checking for matches…')
  const existing = new Map()
  for(const part of chunks(records.map(r=>r.addr_key), 100)){
    const { data, error } = await supabase.from('properties').select('*').in('addr_key', part)
    if(error) throw error
    for(const p of data||[]) existing.set(p.addr_key, p)
  }

  const byLeadKey = new Map((leads||[]).map(l=>[leadKey(l.address,l.city), l]).filter(([k])=>k))
  const now = new Date().toISOString()
  let fresh = 0, stacked = 0
  const rows = records.map(r=>{
    const e = existing.get(r.addr_key)
    const base = e ? mergeFields(e, r) : r
    if(e) stacked++; else fresh++
    const lists = [...((e && e.lists)||[]).filter(x=>x.list_id!==listId), entry]
    const match = !(e && e.lead_id) ? byLeadKey.get(leadKey(base.address, base.city)) : null
    return {
      addr_key:r.addr_key, address:(e && e.address)||r.address, city:base.city||null, state:base.state||null, zip:base.zip||null,
      county:base.county||null, owner_name:base.owner_name||null, mailing:base.mailing||null,
      phones:base.phones||[], emails:base.emails||[], lists,
      list_ids:uniq(lists.map(x=>x.list_id)), list_types:uniq(lists.map(x=>x.type)),
      campaign:(e && e.campaign) || campaign || null, data:base.data||{},
      lead_id:(e && e.lead_id) || (match ? String(match.id) : null), updated_at:now,
    }
  }).map(row=>({ ...row, ...derivedColumns(row) }))

  const saved = []
  let done = 0
  for(const part of chunks(rows, 500)){
    const { data, error } = await supabase.from('properties').upsert(part, { onConflict:'addr_key' }).select('id,lead_id,list_types')
    if(error) throw error
    saved.push(...(data||[]))
    done += part.length; onProgress('Stacking… '+done.toLocaleString()+' / '+rows.length.toLocaleString())
  }
  await supabase.from('property_lists').update({ new_count:fresh, stacked_count:stacked }).eq('id', list.id)

  // keep matching Leads in sync so callers see the stack
  const leadById = new Map((leads||[]).map(l=>[String(l.id), l]))
  const toPatch = saved.filter(p=>p.lead_id && leadById.has(String(p.lead_id)))
  let i = 0
  for(const part of chunks(toPatch, 10)){
    await Promise.all(part.map(p=>patchLead(leadById.get(String(p.lead_id)), { lists:p.list_types, stack:p.list_types.length, property_id:String(p.id) })))
    i += part.length; onProgress('Updating matching leads… '+i+' / '+toPatch.length)
  }
  return { total:rows.length, fresh, stacked, leadsUpdated:toPatch.length }
}

// ---------- browse ----------
export function queryProps(f, from, to){
  let q = supabase.from('properties').select('*',{count:'exact'})
  const desc = (c)=>{ q = q.order(c,{ascending:false, nullsFirst:false}) }
  const sort = f.sort||'score'
  if(sort==='stack'){ desc('stack'); desc('score') }
  else if(sort==='filed'){ desc('filed_on'); desc('score') }
  else if(sort==='added'){ desc('created_at') }
  else if(sort==='equity'){ desc('equity_pct'); desc('score') }
  else { desc('score'); desc('stack') }
  q = q.order('id',{ascending:true}).range(from,to)
  if(f.minScore) q = q.gte('score', f.minScore)
  if(f.equity==='fc') q = q.gte('equity_pct', 100); else if(f.equity) q = q.gte('equity_pct', Number(f.equity))
  if(f.minValue) q = q.gte('est_value', Number(f.minValue))
  if(f.maxValue) q = q.lte('est_value', Number(f.maxValue))
  if(f.ownerType) q = q.eq('owner_type', f.ownerType)
  if(f.minYears) q = q.gte('years_owned', Number(f.minYears))
  if(f.outOfState) q = q.eq('out_of_state', true)
  else if(f.absentee) q = q.eq('absentee', true)
  const ago = n => new Date(Date.now()-Number(n)*86400000)
  if(f.filedWithin) q = q.gte('filed_on', ago(f.filedWithin).toISOString().slice(0,10))
  if(f.addedWithin) q = q.gte('created_at', ago(f.addedWithin).toISOString())
  if(f.noPhone) q = q.eq('has_phone', false)
  if(f.min>1) q = q.gte('stack', f.min)
  if(f.type) q = q.contains('list_types', [f.type])
  if(f.state) q = q.eq('state', f.state)
  if(f.campaign) q = f.campaign==='none' ? q.is('campaign', null) : q.eq('campaign', f.campaign)
  if(f.phone) q = q.eq('has_phone', true)
  if(f.hideLeads) q = q.is('lead_id', null)
  const s = String(f.q||'').replace(/[,()*%\\"]/g,' ').trim()
  if(s) q = q.or('address.ilike.*'+s+'*,owner_name.ilike.*'+s+'*,city.ilike.*'+s+'*')
  return q
}
export async function fetchAllMatching(f, cap=5000){
  const all = []
  for(let from=0; from<cap; from+=1000){
    const { data, error } = await queryProps(f, from, Math.min(from+999, cap-1))
    if(error) throw error
    all.push(...(data||[]))
    if(!data || data.length<1000) break
  }
  return all
}
export async function fetchStackStats(){
  const head = () => supabase.from('properties').select('id',{count:'exact',head:true})
  const rs = await Promise.all([head(), head().gte('stack',2), head().gte('stack',3), head().gte('stack',4), head().eq('has_phone',true), head().gte('score',70), head().eq('has_phone',false), head().is('score',null)])
  const bad = rs.find(r=>r.error); if(bad) throw bad.error
  const [total,s2,s3,s4,phones,hot,noPhone,unscored] = rs.map(r=>r.count||0)
  return { total, s2, s3, s4, phones, hot, noPhone, unscored }
}
export async function fetchLists(){
  const { data, error } = await supabase.from('property_lists').select('*').order('created_at',{ascending:false})
  if(error) throw error
  return data||[]
}
export async function removeList(id){
  const { error } = await supabase.rpc('remove_property_list', { p_list:String(id) })
  if(error) throw error
}

// After a list is removed, bring each linked lead's "On N lists" back in line.
export async function syncLeadStacks(leads){
  const data = await fetchAllRows(()=>supabase.from('properties').select('id,lead_id,list_types').not('lead_id','is',null).order('id'))
  const byId = new Map((leads||[]).map(l=>[String(l.id), l]))
  const stale = (data||[]).filter(p=>{ const l=byId.get(String(p.lead_id)); return l && JSON.stringify((l.details||{}).lists||[])!==JSON.stringify(p.list_types) })
  for(const part of chunks(stale, 10))
    await Promise.all(part.map(p=>patchLead(byId.get(String(p.lead_id)), { lists:p.list_types, stack:p.list_types.length })))
  return stale.length
}

// ---------- send to Leads ----------
export function topType(types){ return TYPE_NAMES.find(t=>(types||[]).includes(t)) || (types||[])[0] || 'Other' }

export async function sendToLeads(props, {leads, campaign, onProgress=()=>{}}){
  const byLeadKey = new Map((leads||[]).map(l=>[leadKey(l.address,l.city), l]).filter(([k])=>k))
  const leadIds = new Set((leads||[]).map(l=>String(l.id)))
  const links = []     // [property, leadId]
  const create = []
  for(const p of props){
    if(p.lead_id && leadIds.has(String(p.lead_id))) continue
    const m = byLeadKey.get(leadKey(p.address, p.city))
    if(m) links.push([p, String(m.id)]); else create.push(p)
  }
  let made = 0
  for(const part of chunks(create, 200)){
    const rows = part.map(p=>{
      const d = p.data||{}, stack = (p.list_types||[]).length
      return {
        name:p.owner_name||'Unknown owner', address:p.address, city:p.city||'', state:p.state||'NJ',
        lead_type:topType(p.list_types), arv:d.value||0, owed:d.loan||0, phone:(p.phones||[])[0]||'',
        freshness:100, times_contacted:0, motivation:Math.max(30, Math.min(95, p.score ?? (35+stack*15))), skiptraced:(p.phones||[]).length>0,
        details:{ ...BLANK_DETAILS, repairs:{}, beds:d.beds||'', baths:d.baths||'', sqft:d.sqft||'', year_built:d.year_built||'',
          campaign:campaign||p.campaign||'', lists:p.list_types||[], stack, property_id:String(p.id),
          phones:p.phones||[], emails:p.emails||[], mailing:p.mailing||'', zip:p.zip||'', county:p.county||'',
          ...(d.occupancy==='Owner occupied'?{occupancy:'Owner occupied'}:{}),
          ...(d.record_date?{record_date:d.record_date}:{}), ...(d.case_number?{case_number:d.case_number}:{}),
          ...(d.owner_type?{owner_type:d.owner_type}:{}), ...(d.occupancy==='Absentee'?{absentee:true}:{}),
          ...(d.co_owner?{people:[{ name:d.co_owner, role:'Co-owner', phone:'', decides:false, note:'From list' }]}:{}) },
      }
    })
    const { data, error } = await supabase.from('leads').insert(rows).select('id')
    if(error) throw error
    ;(data||[]).forEach((l,i)=>links.push([part[i], String(l.id)]))
    made += part.length; onProgress('Creating leads… '+made+' / '+create.length)
  }
  let n = 0
  for(const part of chunks(links, 20)){
    await Promise.all(part.map(([p,id])=>supabase.from('properties').update({ lead_id:id, ...(campaign?{campaign}:{}) }).eq('id', p.id)
      .then(({error})=>{ if(error) throw error })))
    n += part.length; onProgress('Linking… '+n+' / '+links.length)
  }
  return { created:create.length, linked:links.length-create.length, skipped:props.length-links.length }
}

// ---------- export ----------
export function downloadCsv(props, filename){
  const rows = props.map(p=>{
    const d = p.data||{}, ph = p.phones||[]
    return { 'Owner Name':p.owner_name||'', 'Property Address':p.address, 'City':p.city||'', 'State':p.state||'', 'Zip':p.zip||'',
      'Mailing Address':p.mailing||'', 'Phone 1':ph[0]||'', 'Phone 2':ph[1]||'', 'Phone 3':ph[2]||'', 'Email':(p.emails||[])[0]||'',
      'Stack':(p.list_types||[]).length, 'Lists':(p.list_types||[]).join('; '), 'Est Value':d.value??'', 'Loan Balance':d.loan??'' }
  })
  const blob = new Blob([Papa.unparse(rows)], {type:'text/csv'})
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000)
}

// ---------- one property ----------
export async function updateProperty(id, patch){
  const { error } = await supabase.from('properties').update({ ...patch, updated_at:new Date().toISOString() }).eq('id', id)
  if(error) throw error
}
// Signals we can read straight off the record (no extra data needed).
export function propertySignals(p){
  const a = analyzeProperty(p), out = []
  if(a.out_of_state) out.push(['Out-of-state owner','#4aa8ff','Mails to '+String(a.mailState||'').toUpperCase()])
  else if(a.absentee) out.push(['Absentee owner','#4aa8ff','Mailing address is different from the property'])
  if(a.equity_pct!==null){ if(a.equity_pct>=100) out.push(['Free & clear','#3fd08a','No open loans on record'])
    else if(a.equity_pct>=50) out.push(['High equity','#3fd08a',a.equity_pct+'% equity'])
    else if(a.equity_pct<10) out.push(['Low equity','#e5573f',a.equity_pct+'% equity — little room for a discount']) }
  if(a.years_owned!==null && a.years_owned>=15) out.push(['Owned '+a.years_owned+' years','#f5b942','Long ownership usually means big equity'])
  if(a.owner_type==='estate') out.push(['Estate / probate','#e5573f','Talk to the executor or heirs'])
  else if(a.owner_type==='company') out.push(['Company owned','#88a0b4','Ask for the decision maker'])
  else if(a.owner_type==='trust') out.push(['Trust','#88a0b4','Ask for the trustee'])
  else if(a.owner_type==='check') out.push(['Check owner','#f5b942','Name on file may be a lender or HOA'])
  if(!(p.phones||[]).length) out.push(['Needs skip trace','#f5b942','No phone numbers yet'])
  return out
}
