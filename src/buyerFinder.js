import { supabase } from './supabaseClient'
import { fetchAllRows } from './fetchAll'
import { autoMap, buildRecords, normPhone } from './stacking'
import { nameKey, buyerRow, PROP_TYPES } from './dispo'

// ---------------------------------------------------------------
// Cash Buyer Finder: turn purchase records into buyer profiles.
// Each CSV row is one property someone bought (PropStream / PropWire
// cash-buyer export, or county deed sales). Rows are grouped by buyer;
// their real buy box comes from what they actually bought.
// ---------------------------------------------------------------

const nh = h => String(h||'').toLowerCase().replace(/\./g,'').replace(/[^a-z0-9]+/g,' ').trim()
// Extra columns deed / sales files use that a lead list doesn't.
const EXTRA = {
  buyer:[/^(grantee|buyer|purchaser)s?( 1)?( full)?( name)?s?$/, /^new owner( name)?$/],
  sale_date:[/^(sale|sold|transfer|deed|recording|purchase|closing) date$/, /^date (sold|of sale|recorded)$/, /^last (sale|transfer)( recording)? date$/],
  sale_price:[/^(sale|sold|transfer|deed|purchase) (price|amount)$/, /^(consideration|price)$/, /^last (sale|transfer) (price|amount)$/],
}
export function mapBuyerFile(headers){
  const m = autoMap(headers)
  for(const [k,res] of Object.entries(EXTRA)){
    const h = headers.find(h=>res.some(re=>re.test(nh(h))))
    if(h) m[k] = h
  }
  if(m.buyer){ m.owner = m.buyer; delete m.owner_first; delete m.owner_last }
  if(m.sale_date) m.last_sale_date = m.sale_date
  if(m.sale_price) m.last_sale_amount = m.sale_price
  return m
}

const NOT_BUYER = /\b(BANK|MORTGAGE|FEDERAL|NATIONAL ASSOCIATION|N A|FANNIE|FREDDIE|HUD|SECRETARY|HOUSING AUTHORITY|COUNTY|CITY OF|TOWNSHIP|STATE OF|UNITED STATES|USA|CREDIT UNION|SAVINGS|TRUSTEE SERVICES|SERVICING|LENDING|LOAN|ASSOCIATION|HOA|CONDOMINIUM|CHURCH|SCHOOL|DISTRICT|UNKNOWN|CURRENT OWNER)\b/
export const isCompany = n => /\b(LLC|L L C|INC|CORP|CORPORATION|COMPANY|CO|LP|LLP|LTD|HOLDINGS?|PROPERTIES|PROPERTY|INVEST(MENT)?S?|CAPITAL|VENTURES?|GROUP|PARTNERS|REALTY|HOMES|ENTERPRISES?|EQUITY|ACQUISITIONS?|DEVELOPMENT|ASSETS)\b/i.test(String(n||''))
const looksLikeBuyer = n => !!n && !NOT_BUYER.test(String(n).toUpperCase())
const num = v => { const n = Number(String(v??'').replace(/[$,\s]/g,'')); return Number.isFinite(n) && n>0 ? n : null }
const day = v => { if(!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0,10) }
const round5k = (n, up) => Math[up?'ceil':'floor'](n/5000)*5000
const top = (arr, k=4) => Object.entries(arr.reduce((m,x)=>{ if(x) m[x]=(m[x]||0)+1; return m },{})).sort((a,b)=>b[1]-a[1]).slice(0,k).map(x=>x[0])
const titleCase = s => String(s||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bLlc\b/g,'LLC').replace(/\bInc\b/g,'Inc')
export function propType(t){
  const s = String(t||'').toLowerCase()
  if(/multi|duplex|triplex|fourplex|quad|2-4|apartment/.test(s)) return 'Multi-family'
  if(/condo|town/.test(s)) return 'Condo / townhouse'
  if(/land|lot|vacant/.test(s)) return 'Land'
  if(/mobile|manufactured/.test(s)) return 'Mobile home'
  if(/single|sfr|residential|house/.test(s)) return 'Single family'
  return null
}

// Purchase records -> buyer profiles.
export function buyersFromPurchases(rows, map, { months=24, minBuys=1 }={}){
  const { records } = buildRecords(rows, map)
  const cutoff = months ? Date.now() - months*30.4*86400000 : 0
  const groups = new Map()
  let skipped = 0
  for(const r of records){
    const name = r.owner_name
    if(!looksLikeBuyer(name)){ skipped++; continue }
    const d = r.data||{}
    const date = day(d.last_sale_date)
    if(cutoff && date && new Date(date).getTime() < cutoff){ skipped++; continue }
    const key = nameKey(name)
    if(!key){ skipped++; continue }
    const g = groups.get(key) || { key, name, mailing:r.mailing, phones:new Set(), emails:new Set(), buys:[] }
    r.phones.forEach(p=>g.phones.add(p)); r.emails.forEach(e=>g.emails.add(e))
    if(!g.mailing && r.mailing) g.mailing = r.mailing
    g.buys.push({ address:r.address, city:r.city, zip:r.zip, county:r.county, price:num(d.last_sale_amount), date, type:d.property_type||null })
    groups.set(key, g)
  }
  const yearAgo = Date.now() - 365*86400000
  const out = []
  for(const g of groups.values()){
    if(g.buys.length < minBuys) continue
    const prices = g.buys.map(b=>b.price).filter(p=>p && p>=5000).sort((a,b)=>a-b)
    const lo = prices.length ? prices[Math.floor(prices.length*0.1)] : null, hi = prices.length ? prices[Math.ceil(prices.length*0.9)-1] : null
    const counties = top(g.buys.map(b=>b.county && String(b.county).replace(/\s*county$/i,'').trim()))
    const cities = top(g.buys.map(b=>b.city && titleCase(b.city)), 3)
    const types = [...new Set(g.buys.map(b=>propType(b.type)).filter(Boolean))].filter(t=>PROP_TYPES.includes(t))
    const dates = g.buys.map(b=>b.date).filter(Boolean).sort()
    const company = isCompany(g.name)
    out.push({
      key:g.key, name:titleCase(g.name), company: company ? titleCase(g.name) : null,
      phone:[...g.phones][0]||null, phones:[...g.phones], email:[...g.emails][0]||null,
      markets:[...counties, ...cities].filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i),
      min_price: lo ? round5k(lo*0.85) : null, max_price: hi ? round5k(hi*1.15, true) : null,
      property_types: types,
      buys:g.buys.length, buys_12mo:g.buys.filter(b=>b.date && new Date(b.date).getTime()>=yearAgo).length,
      last_buy: dates[dates.length-1] || null, zips:top(g.buys.map(b=>b.zip), 8), mailing:g.mailing||null,
      purchases: g.buys.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,25),
    })
  }
  out.sort((a,b)=>b.buys-a.buys || String(b.last_buy||'').localeCompare(String(a.last_buy||'')))
  return { buyers:out, purchases:records.length, skipped }
}

// Landlords already sitting in your List Stacking data: same owner on several properties.
export async function landlordsFromLists({ minOwned=3, companiesOnly=false }={}){
  const rows = await fetchAllRows(()=>supabase.from('properties').select('id,address,city,zip,county,owner_name,mailing,phones,emails').order('id'))
  const groups = new Map()
  for(const r of rows){
    const name = r.owner_name; if(!looksLikeBuyer(name)) continue
    if(companiesOnly && !isCompany(name)) continue
    const key = nameKey(name); if(!key || key.length<4) continue
    const g = groups.get(key) || { key, name, mailing:r.mailing, phones:new Set(), emails:new Set(), props:[] }
    ;(r.phones||[]).forEach(p=>g.phones.add(p)); (r.emails||[]).forEach(e=>g.emails.add(e))
    g.props.push({ address:r.address, city:r.city, zip:r.zip, county:r.county })
    groups.set(key, g)
  }
  const out = []
  for(const g of groups.values()){
    if(g.props.length < minOwned) continue
    const counties = top(g.props.map(b=>b.county && String(b.county).replace(/\s*county$/i,'').trim()))
    const cities = top(g.props.map(b=>b.city && titleCase(b.city)), 3)
    out.push({ key:g.key, name:titleCase(g.name), company:isCompany(g.name)?titleCase(g.name):null,
      phone:[...g.phones][0]||null, phones:[...g.phones], email:[...g.emails][0]||null,
      markets:[...counties, ...cities].filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i),
      owned:g.props.length, zips:top(g.props.map(b=>b.zip), 8), mailing:g.mailing||null, holdings:g.props.slice(0,25) })
  }
  return out.sort((a,b)=>b.owned-a.owned)
}

// Save found buyers: new ones are inserted, ones already on your list (same phone, email or name) get their profile updated.
export async function saveFound(found, existing, kind, onProgress=()=>{}){
  const byPhone = new Map(), byEmail = new Map(), byName = new Map()
  for(const b of existing){
    const p = normPhone(b.phone); if(p) byPhone.set(p, b)
    if(b.email) byEmail.set(b.email.toLowerCase(), b)
    byName.set(nameKey(b.name), b); if(b.company) byName.set(nameKey(b.company), b)
  }
  const now = new Date().toISOString()
  const fresh = [], updates = []
  for(const f of found){
    const prof = kind==='landlord'
      ? { landlord:true, owned:f.owned, zips:f.zips, mailing:f.mailing, holdings:f.holdings, found_at:now, phones:f.phones }
      : { verified:true, buys:f.buys, buys_12mo:f.buys_12mo, last_buy:f.last_buy, zips:f.zips, mailing:f.mailing, purchases:f.purchases, found_at:now, phones:f.phones }
    const match = (f.phone && byPhone.get(normPhone(f.phone))) || (f.email && byEmail.get(f.email.toLowerCase())) || byName.get(f.key)
    if(match){
      const p = { ...(match.profile||{}), ...prof }
      if(kind!=='landlord' && match.profile && match.profile.purchases){
        const seen = new Set(prof.purchases.map(x=>x.address))
        p.purchases = [...prof.purchases, ...match.profile.purchases.filter(x=>!seen.has(x.address))].slice(0,25)
      }
      const upd = { profile:p, updated_at:now }
      if(!match.phone && f.phone) upd.phone = f.phone
      if(!match.email && f.email) upd.email = f.email
      if(!(match.markets||[]).length && f.markets.length) upd.markets = f.markets
      if(!match.max_price && f.max_price){ upd.min_price = f.min_price; upd.max_price = f.max_price }
      updates.push([match.id, upd])
    } else {
      fresh.push({ ...buyerRow({ name:f.name, company:f.company, phone:f.phone, email:f.email, markets:f.markets,
        min_price:f.min_price, max_price:f.max_price, property_types:f.property_types||[], buyer_type: kind==='landlord' ? 'Landlord / BRRRR' : null,
        tags:[kind==='landlord'?'landlord':'cash buyer'], source: kind==='landlord' ? 'Landlord finder (your lists)' : 'Cash buyer finder',
        notes: kind==='landlord' ? 'Owns '+f.owned+' properties in your lists.' : 'Bought '+f.buys+' propert'+(f.buys===1?'y':'ies')+(f.last_buy?' · last '+f.last_buy:'')+'.' }), profile:prof })
    }
  }
  let done = 0
  for(const [id, upd] of updates){
    const { error } = await supabase.from('buyers').update(upd).eq('id', id); if(error) throw error
    if(++done % 25 === 0) onProgress('Updating… '+done+' / '+updates.length)
  }
  for(let i=0; i<fresh.length; i+=500){
    const { error } = await supabase.from('buyers').insert(fresh.slice(i,i+500)); if(error) throw error
    onProgress('Adding… '+Math.min(i+500,fresh.length)+' / '+fresh.length)
  }
  return { added:fresh.length, updated:updates.length }
}

// Names + mailing addresses of found buyers with no phone, for your skip-trace service.
export function buyerSkipCsv(list){
  const rows = [['Name','Company','Mailing Address','Markets','Purchases'], ...list.map(b=>[b.name, b.company||'', b.mailing||'', (b.markets||[]).join('; '), b.buys||b.owned||''])]
  return rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n')
}
