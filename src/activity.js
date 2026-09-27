import { supabase } from './supabaseClient'

// One logged call = one row in lead_activity.
// key, button label, short label, counts as a dial?, reached a human?
export const OUTCOMES = [
  { key:'no_answer',   label:'No answer / VM',   short:'No answer',   dial:true,  contact:false },
  { key:'contact',     label:'Talked to seller', short:'Talked',      dial:true,  contact:true  },
  { key:'appointment', label:'Appointment set',  short:'Appointment', dial:true,  contact:true  },
  { key:'offer',       label:'Offer made',       short:'Offer',       dial:true,  contact:true, amount:'Offer amount' },
  { key:'contract',    label:'Under contract',   short:'Contract',    dial:true,  contact:true  },
  { key:'closed',      label:'Closed / assigned',short:'Closed',      dial:false, contact:false, amount:'Assignment fee' },
  { key:'dead',        label:'Not interested',   short:'Dead',        dial:true,  contact:true  },
]
export const OUTCOME = Object.fromEntries(OUTCOMES.map(o=>[o.key,o]))

export const TARGETS = { dials:60, offers:3 }

const DAY = 24*60*60*1000
export function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x }

export function inLastDays(activity, days){
  if(days===1){ const s=startOfDay().getTime(); return activity.filter(a=>new Date(a.created_at).getTime()>=s) }
  const s = startOfDay().getTime() - (days-1)*DAY
  return activity.filter(a=>new Date(a.created_at).getTime()>=s)
}

export function tally(rows){
  const t = { dials:0, contacts:0, appointment:0, offer:0, contract:0, closed:0, dead:0, fees:0, offerSum:0, offerCount:0 }
  for(const a of rows){
    const o = OUTCOME[a.outcome]; if(!o) continue
    if(o.dial) t.dials++
    if(o.contact) t.contacts++
    if(t[a.outcome]!==undefined && a.outcome!=='contact' && a.outcome!=='no_answer') t[a.outcome]++
    if(a.outcome==='closed') t.fees += Number(a.amount)||0
    if(a.outcome==='offer' && Number(a.amount)){ t.offerSum += Number(a.amount); t.offerCount++ }
  }
  return t
}

export const pct = (n,d) => d ? Math.round((n/d)*100) : 0

export function getCaller(){ try{ return localStorage.getItem('wos_caller')||'' }catch{ return '' } }
export function saveCaller(v){ try{ localStorage.setItem('wos_caller',v) }catch{ /* storage unavailable */ } }

export async function fetchActivity(days=90){
  const since = new Date(startOfDay().getTime() - (days-1)*DAY).toISOString()
  const { data, error } = await supabase.from('lead_activity').select('*').gte('created_at',since).order('created_at',{ascending:false})
  if(error) throw error
  return data||[]
}

export async function logActivity(lead, outcome, {amount, note, caller}={}){
  const row = {
    lead_id: String(lead.id), lead_name: lead.name||null, lead_state: lead.state||null, lead_type: lead.lead_type||null,
    outcome, caller: (caller||'').trim()||'Unassigned', note: (note||'').trim()||null,
    amount: Number(amount)||null,
  }
  const { error } = await supabase.from('lead_activity').insert([row])
  if(error) throw error
}

export function activityErr(msg){
  const m = String(msg||'')
  if(/lead_activity/i.test(m) || /relation .* does not exist/i.test(m))
    return "Call logging isn't set up yet — the database needs the new lead_activity table. Run the SQL from supabase/add-activity-table.sql in the Supabase SQL Editor, then retry."
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
}

// Per-day totals for the last n days (oldest first), for charts.
export function dailySeries(rows, n){
  const dayStart = startOfDay().getTime()
  return Array.from({length:n},(_,i)=>{
    const s = dayStart - (n-1-i)*DAY, e = s+DAY
    const t = tally(rows.filter(a=>{ const x=new Date(a.created_at).getTime(); return x>=s && x<e }))
    return { d:new Date(s), dials:t.dials, contacts:t.contacts, offers:t.offer }
  })
}
