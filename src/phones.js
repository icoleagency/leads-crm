import { supabase } from './supabaseClient'
import { normPhone, fmtPhone } from './stacking'
import { patchLead } from './leadModel'

// Phone numbers on a lead, and which ones are bad. Statuses live in lead.details.phone_status
// keyed by the 10-digit number: { '6095551234': { s:'wrong'|'disconnected'|'dnc'|'good', by, at } }
export const BAD = ['wrong','disconnected','dnc']
export const PHONE_STATUS = {
  good:['Good number','#3fd08a'], wrong:['Wrong number','#e5573f'],
  disconnected:['Disconnected','#88a0b4'], dnc:['Do not call','#e5573f'],
}
const digits = p => normPhone(p) || String(p||'').replace(/\D/g,'')
export { fmtPhone }

export function leadPhones(l){
  const d = (l && l.details) || {}, st = d.phone_status || {}
  const seen = new Set(), out = []
  for(const raw of [l && l.phone, ...(d.phones||[])]){
    const n = digits(raw); if(!n || n.length<7 || seen.has(n)) continue
    seen.add(n); const s = st[n] || {}
    out.push({ n, status:s.s||null, by:s.by||null, at:s.at||null })
  }
  const rank = p => p.status==='good' ? 0 : !p.status ? 1 : 2
  return out.map((p,i)=>({...p,i})).sort((a,b)=>rank(a)-rank(b) || a.i-b.i)
}
export const goodPhones = l => leadPhones(l).filter(p=>!BAD.includes(p.status))
export const isDnc = l => !!(l && l.details && l.details.dnc)

// Mark one number (status=null clears it). Keeps lead.phone pointed at a working number and
// keeps the linked List Stacking property in step (bad numbers come off it so skip trace counts stay right).
export async function markPhone(lead, n, status, by){
  const d = lead.details || {}
  const st = { ...(d.phone_status||{}) }
  if(status) st[n] = { s:status, by:by||null, at:new Date().toISOString() }; else delete st[n]
  const after = leadPhones({ ...lead, details:{ ...d, phone_status:st } }).filter(p=>!BAD.includes(p.status))
  const primaryBad = BAD.includes((st[digits(lead.phone)]||{}).s)
  const cols = { skiptraced: after.length>0 }
  if(primaryBad || !digits(lead.phone)) cols.phone = after[0] ? after[0].n : ''
  await patchLead(lead, { phone_status:st }, cols)
  if(d.property_id){
    const { data:p } = await supabase.from('properties').select('id,phones,data').eq('id', d.property_id).maybeSingle()
    if(p){
      const bad = new Set((p.data && p.data.bad_phones) || [])
      let phones = [...(p.phones||[])]
      if(BAD.includes(status)){ bad.add(n); phones = phones.filter(x=>x!==n) }
      else if(bad.has(n)){ bad.delete(n); if(!phones.includes(n)) phones.push(n) }
      await supabase.from('properties').update({ phones, data:{ ...(p.data||{}), bad_phones:[...bad] }, updated_at:new Date().toISOString() }).eq('id', p.id)
    }
  }
}
// Owner asked not to be called at all: off every call list.
export function setLeadDnc(lead, on, by){
  return patchLead(lead, on ? { dnc:true, dnc_by:by||null, dnc_at:new Date().toISOString() } : { dnc:false })
}
