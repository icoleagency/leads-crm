import Papa from 'papaparse'
import { supabase } from './supabaseClient'
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
  ['address','Property address',[new RegExp('^'+P+'(street )?address( line)?( 1)?$'), /^street( address)?$/]],
  ['unit','Unit',[new RegExp('^'+P+'unit( number)?$')]],
  ['city','City',[new RegExp('^'+P+'city$')]],
  ['state','State',[new RegExp('^'+P+'state$')]],
  ['zip','Zip',[new RegExp('^'+P+'zip( code)?( 5)?$'), /^postal code$/]],
  ['county','County',[new RegExp('^'+P+'county$')]],
  ['owner','Owner full name',[/^owner( 1)?( full)? names?$/, /^owner$/, /^full name$/, /^name$/]],
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
]
export const MAIN_FIELDS = ['address','city','state','zip','owner','owner_first','owner_last','mail_address','value','loan']
const normHeader = h => String(h||'').toLowerCase().replace(/\./g,'').replace(/#/g,' ').replace(/[^a-z0-9]+/g,' ').trim()
const PHONE_RE = /^(owner |contact |skip |primary )?(phone|mobile|cell|landline|wireless)( ?\d+)?( number)?$/
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

export function parseCsv(file){
  return new Promise((resolve,reject)=>{
    Papa.parse(file,{ header:true, skipEmptyLines:'greedy', transformHeader:h=>String(h).trim(),
      complete:r=>resolve({ headers:(r.meta.fields||[]).filter(Boolean), rows:r.data }),
      error:reject })
  })
}

// CSV rows -> deduped property records (same address twice in one file = one record).
export function buildRecords(rows, map){
  const out = new Map()
  let skipped = 0
  for(const row of rows){
    const g = k => map[k] ? clean(row[map[k]]) : ''
    const unit = g('unit').replace(/^#\s*/,'')
    const street = g('address') + (unit ? (/^(apt|unit|ste|suite|lot)\b/i.test(unit) ? ' '+unit : ' #'+unit) : '')
    const key = addrKey(street, g('zip'), g('city'))
    if(!key){ skipped++; continue }
    const owner = g('owner') || [g('owner_first'), g('owner_last')].filter(Boolean).join(' ')
    const mailing = [g('mail_address'), g('mail_city'), [g('mail_state'), g('mail_zip')].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    const phones = (map.phones||[]).map(h=>normPhone(row[h])).filter(Boolean)
    const emails = (map.emails||[]).map(h=>clean(row[h]).toLowerCase()).filter(e=>e.includes('@'))
    const data = {}
    for(const k of ['beds','baths','sqft','year_built','value','equity','loan','last_sale_amount']){ const n=num(g(k)); if(n!==null) data[k]=n }
    for(const k of ['last_sale_date','property_type']){ if(g(k)) data[k]=g(k) }
    if(data.value && data.equity!==undefined && data.loan===undefined) data.loan = Math.max(0, data.value - data.equity)
    const rec = { addr_key:key, address:street.replace(/\s+/g,' ').trim(), city:g('city'), state:normState(g('state')),
      zip:(g('zip').match(/\d{5}/)||[''])[0], county:g('county'), owner_name:owner, mailing, phones, emails, data }
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
  if(/propert(y_lists|ies)|remove_property_list|schema cache|relation .* does not exist/i.test(m))
    return 'setup'
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
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
  })

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
    .order('stack',{ascending:false}).order('updated_at',{ascending:false}).range(from,to)
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
  const rs = await Promise.all([head(), head().gte('stack',2), head().gte('stack',3), head().gte('stack',4), head().eq('has_phone',true)])
  const bad = rs.find(r=>r.error); if(bad) throw bad.error
  const [total,s2,s3,s4,phones] = rs.map(r=>r.count||0)
  return { total, s2, s3, s4, phones }
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
  const { data, error } = await supabase.from('properties').select('id,lead_id,list_types').not('lead_id','is',null).limit(5000)
  if(error) throw error
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
        freshness:100, times_contacted:0, motivation:Math.min(95, 35+stack*15), skiptraced:(p.phones||[]).length>0,
        details:{ ...BLANK_DETAILS, repairs:{}, beds:d.beds||'', baths:d.baths||'', sqft:d.sqft||'', year_built:d.year_built||'',
          campaign:campaign||p.campaign||'', lists:p.list_types||[], stack, property_id:String(p.id),
          phones:p.phones||[], emails:p.emails||[], mailing:p.mailing||'', zip:p.zip||'', county:p.county||'' },
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
