import { supabase } from './supabaseClient'

// Shared lead shape + helpers used by Leads, Call Card, Script, and the Deal Analyzer.

export const REPAIRS = [
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

export const BLANK_DETAILS = { beds:'', baths:'', sqft:'', year_built:'', occupancy:'Unknown',
  asking_price:'', timeline:'Unsure', sell_reason:'Unknown', repairs:{}, repair_notes:'', seller_notes:'' }

export function detailsOf(l){
  const d = (l && l.details) || {}
  return {...BLANK_DETAILS, ...d, repairs: d.repairs || {}}
}

export const money = n => '$'+Math.round(Number(n||0)).toLocaleString()

// Saved Deal Analyzer result for a lead, or null.
export function compResult(l){
  const r = l && l.details && l.details.comp && l.details.comp.result
  return r && r.arv ? r : null
}

// ---------- Pipeline stages ----------
export const STAGES = [
  ['new','New lead','#88a0b4'],
  ['contacted','Contacted','#4aa8ff'],
  ['appointment','Appointment','#4aa8ff'],
  ['offer','Offer made','#f5b942'],
  ['contract','Under contract','#ff6b1a'],
  ['assigned','Assigned','#ff9052'],
  ['closed','Closed','#3fd08a'],
  ['dead','Dead','#e5573f'],
]
export const STAGE = Object.fromEntries(STAGES.map(([k,l,c])=>[k,{k,l,c}]))
export const stageIdx = k => STAGES.findIndex(s=>s[0]===k)
// Days a deal can sit in a stage before it's flagged stale.
export const STALE_DAYS = { new:7, contacted:10, appointment:7, offer:7, contract:30, assigned:21 }
// Logged call outcome -> the pipeline stage it proves the lead reached.
export const OUTCOME_STAGE = { contact:'contacted', appointment:'appointment', offer:'offer', contract:'contract', closed:'closed', dead:'dead' }

function leadActivity(lead, activity){ return (activity||[]).filter(a=>a.lead_id===String(lead.id)) }

// A stage set on the lead wins; otherwise it's derived from logged calls.
export function stageOf(lead, activity){
  const d = (lead && lead.details) || {}
  if(d.stage && STAGE[d.stage]) return d.stage
  const mine = leadActivity(lead, activity)
  if(!mine.length) return 'new'
  if(mine[0].outcome==='dead') return 'dead'
  let best = 'new'
  for(const a of mine){ const s = OUTCOME_STAGE[a.outcome]; if(s && s!=='dead' && stageIdx(s)>stageIdx(best)) best = s }
  return best
}

export function stageSince(lead, activity){
  const d = (lead && lead.details) || {}
  if(d.stage_at) return d.stage_at
  const mine = leadActivity(lead, activity)
  return (mine[0] && mine[0].created_at) || lead.created_at || null
}

export const daysSince = iso => iso ? Math.max(0, Math.floor((Date.now()-new Date(iso).getTime())/86400000)) : null

// Merge fields into a lead's details jsonb (and optionally top-level columns).
export async function patchLead(lead, detailsPatch, columns={}){
  const details = {...(lead.details||{}), ...detailsPatch}
  const { error } = await supabase.from('leads').update({...columns, details}).eq('id', lead.id)
  if(error) throw error
  return details
}

export function moveStage(lead, stage, extra={}){
  return patchLead(lead, { stage, stage_at:new Date().toISOString(), ...extra })
}

// ---------- Lead quality score (0-100) ----------
export function eqOf(l){ return l.arv>0 ? Math.min(100, Math.round((1 - l.owed/l.arv)*100)) : 0 }
export function scoreOf(l){
  const fresh = l.freshness
  const contact = Math.max(0, 100 - l.times_contacted*28)
  const mot = l.motivation
  const eq = eqOf(l)
  const skip = l.skiptraced ? 100 : 40
  return Math.round(fresh*0.25 + contact*0.25 + mot*0.2 + eq*0.15 + skip*0.15)
}
export const gradeLetter = s => s>=80?'A':s>=65?'B':s>=50?'C':'D'
