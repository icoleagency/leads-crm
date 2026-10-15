import { OUTCOME } from './activity'
import { callbackOf, patchLead, stageIdx, STAGE } from './leadModel'

// Pipeline helpers: next steps, offer follow-up plan, negotiation log.
// Everything lives in lead.details — next:{text,due,by,at}, nego:[{who,amount,note,by,at}], steps_done:[…]

const DAY = 86400000
export const localDay = (d=new Date()) => { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }
export const addDays = (n, from=new Date()) => localDay(new Date(new Date(from).getTime()+n*DAY))
export function dueState(day){
  if(!day) return null
  const t = localDay()
  return day<t ? 'overdue' : day===t ? 'today' : 'later'
}
export const fmtDay = day => {
  if(!day) return ''
  const t = localDay(), tm = addDays(1)
  if(day===t) return 'today'
  if(day===tm) return 'tomorrow'
  if(day===addDays(-1)) return 'yesterday'
  const d = new Date(day+'T12:00:00')
  const diff = Math.round((d.getTime()-new Date(t+'T12:00:00').getTime())/DAY)
  return d.toLocaleDateString([], diff>0 && diff<7 ? {weekday:'short'} : {month:'short',day:'numeric'})
}
export const daysLate = day => Math.round((new Date(localDay()+'T12:00:00')-new Date(day+'T12:00:00'))/DAY)

// Quick next-step ideas per stage.
export const STEP_IDEAS = {
  new:['Call owner','Skip trace for a number','Research the property'],
  contacted:['Call back','Get the 4 pillars','Set an appointment','Run comps'],
  appointment:['Walkthrough / video tour','Run comps','Make the offer','Confirm the appointment'],
  offer:['Follow up on offer','Send written offer','Get their counter','Talk to the other decision maker'],
  contract:['Open title','Collect EMD receipt','Send deal to buyers','Schedule inspection','Set closing date'],
  assigned:['Confirm buyer EMD','Send assignment to title','Confirm closing date','Collect fee'],
  closed:[], dead:['Check back in 90 days'],
}
// Default due date (days from today) when you pick an idea.
export const STEP_DUE = { contacted:1, appointment:1, offer:2, contract:2, assigned:3, new:1, dead:90 }

// ---------- negotiation ----------
const ts = x => new Date(x).getTime()
const mine = (lead, activity) => (activity||[]).filter(a=>String(a.lead_id)===String(lead.id))

// Your offers come from logged "Offer made" calls plus counters typed in here; seller asks from counters.
export function negoOf(lead, activity){
  const d = lead.details||{}
  const fromCalls = mine(lead,activity).filter(a=>a.outcome==='offer' && Number(a.amount))
    .map(a=>({ who:'you', amount:Number(a.amount), at:a.created_at, by:a.caller, note:a.note, src:'call' }))
  const typed = (d.nego||[]).map(e=>({...e, src:'log'}))
  const all = [...fromCalls, ...typed].sort((a,b)=>ts(a.at)-ts(b.at))
  const lastYou = [...all].reverse().find(e=>e.who==='you') || (Number(d.deal&&d.deal.last_offer) ? { who:'you', amount:Number(d.deal.last_offer) } : null)
  const lastSeller = [...all].reverse().find(e=>e.who==='seller') || (Number(d.asking_price) ? { who:'seller', amount:Number(d.asking_price), at:null, note:'asking price' } : null)
  const gap = lastYou && lastSeller ? lastSeller.amount - lastYou.amount : null
  return { all, lastYou, lastSeller, gap }
}

export async function addNego(lead, entry, stage){
  const d = lead.details||{}
  const e = { who:entry.who, amount:Number(entry.amount), note:(entry.note||'').trim()||null, by:entry.by||null, at:new Date().toISOString() }
  const patch = { nego:[...(d.nego||[]), e] }
  if(e.who==='you'){
    patch.deal = { ...(d.deal||{}), last_offer:e.amount }
    if(stageIdx(stage) < stageIdx('offer')){ patch.stage = 'offer'; patch.stage_at = e.at }
  } else patch.asking_price = e.amount
  return patchLead(lead, patch)
}
export function removeNego(lead, at){
  const d = lead.details||{}
  return patchLead(lead, { nego:(d.nego||[]).filter(e=>e.at!==at) })
}

// ---------- offer follow-up plan ----------
// After an offer: follow up on day 2, 5, 10, 20 and 30. Any logged dial after the offer counts as a follow-up.
// A new offer from you (call or counter) restarts the plan.
export const OFFER_FU = [2,5,10,20,30]
export function offerPlan(lead, activity){
  const d = lead.details||{}
  const rows = mine(lead, activity)
  const youTimes = [
    ...rows.filter(a=>a.outcome==='offer').map(a=>ts(a.created_at)),
    ...(d.nego||[]).filter(e=>e.who==='you').map(e=>ts(e.at)),
  ]
  if(d.stage==='offer' && d.stage_at) youTimes.push(ts(d.stage_at))
  const start = youTimes.length ? Math.max(...youTimes) : null
  if(!start) return null
  const done = rows.filter(a=>OUTCOME[a.outcome] && OUTCOME[a.outcome].dial && a.outcome!=='offer' && ts(a.created_at) > start + 30*60000).length
  const total = OFFER_FU.length
  if(done>=total) return { start, done:total, total, finished:true, due:null }
  return { start, done, total, finished:false, due:addDays(OFFER_FU[done], start), n:done+1 }
}

// ---------- the one next step shown on a deal ----------
// Your own next step wins; else a scheduled callback; else the offer follow-up plan.
export function nextStepOf(lead, activity, stage){
  const d = lead.details||{}
  if(d.next && d.next.text) return { kind:'manual', text:d.next.text, due:d.next.due||null, state:dueState(d.next.due) }
  const cb = callbackOf(lead)
  if(cb){ const day = localDay(new Date(cb.at)); return { kind:'callback', text:'Call back'+(cb.note?' — '+cb.note:''), due:day, state:dueState(day), at:cb.at } }
  if(stage==='offer'){
    const p = offerPlan(lead, activity)
    if(p && p.finished) return { kind:'offer_done', text:'Follow-ups done — make a final offer, nurture, or mark dead', due:null, state:'overdue', plan:p }
    if(p) return { kind:'offer_fu', text:'Offer follow-up '+p.n+' of '+p.total, due:p.due, state:dueState(p.due), plan:p }
  }
  return null
}
export const NEEDS_STEP = ['contacted','appointment','offer','contract','assigned']
export const urgency = ns => !ns ? 3 : ns.state==='overdue' ? 0 : ns.state==='today' ? 1 : 2

export async function setNext(lead, next){
  return patchLead(lead, { next: next && next.text ? { text:next.text.trim(), due:next.due||null, by:next.by||null, at:new Date().toISOString() } : null })
}
export async function completeNext(lead, by){
  const d = lead.details||{}
  if(!d.next) return
  const done = [{ ...d.next, done_at:new Date().toISOString(), done_by:by||null }, ...(d.steps_done||[])].slice(0,20)
  return patchLead(lead, { next:null, steps_done:done })
}
export const stageLabel = k => (STAGE[k]||{}).l || k
