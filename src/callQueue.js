import { OUTCOME } from './activity'
import { stageOf, scoreOf, callbackOf, callbackState } from './leadModel'
import { campaignOf, openHandoff } from './team'
import { goodPhones, leadPhones } from './phones'

// ---- the rules (change here to change everyone's call list) ----
export const RETRY_GAPS = [1, 1, 2, 3, 7]   // days between no-answer tries → tries on day 0, 1, 2, 4, 7, 14
export const MAX_TRIES = 6                  // no contact after this many tries → parked
export const FOLLOW_UP_DAYS = 7             // talked to them, no callback set → back on the list after a week
const CLOSED = ['contract','assigned','closed','dead']
const DAY = 86400000
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() }

// Smart score from List Stacking when the lead came from there, otherwise the lead grade.
export const rankScore = l => { const s = l.details && l.details.score; return Number.isFinite(Number(s)) && s!==null && s!=='' ? Number(s) : scoreOf(l) }

// Every lead in the VA's counties, sorted into: due now, scheduled later, done today, parked.
export function buildQueue(leads, activity, campaignIds){
  const camps = (campaignIds||[]).map(String)
  const byLead = {}
  for(const a of activity||[]) (byLead[a.lead_id] ||= []).push(a)      // newest first
  const today0 = startOfToday(), now = Date.now()
  const out = { due:[], scheduled:[], doneToday:[], parked:[], noPhone:[] }
  for(const l of leads||[]){
    if(!camps.includes(campaignOf(l))) continue
    const d = l.details || {}
    if(d.dnc || openHandoff(l)) continue
    const st = stageOf(l, activity)
    if(CLOSED.includes(st)) continue
    const resetAt = d.queue_reset_at ? new Date(d.queue_reset_at).getTime() : 0
    const calls = (byLead[String(l.id)]||[]).filter(a=>{ const o = OUTCOME[a.outcome]; return o && o.dial && new Date(a.created_at).getTime()>resetAt })
    const tries = calls.length, last = calls[0] || null
    const lastAt = last ? new Date(last.created_at).getTime() : 0
    const reached = calls.some(a=>OUTCOME[a.outcome].contact && a.outcome!=='dead')
    const cb = callbackOf(l), cs = callbackState(cb)
    const item = { l, st, tries, last, reached, cb, cs, score:rankScore(l) }

    if(!goodPhones(l).length){ out.noPhone.push({...item, kind:'nophone', label:leadPhones(l).length?'All numbers bad':'No phone number'}); continue }
    if(cs==='overdue' || cs==='today'){ out.due.push({...item, kind:'callback', label:cs==='overdue'?'Callback overdue':'Callback today'}); continue }
    if(cs==='later'){ out.scheduled.push({...item, kind:'callback', next:new Date(cb.at).getTime(), label:'Callback set'}); continue }
    if(lastAt>=today0){ out.doneToday.push({...item, kind:'done'}); continue }
    if(st==='nurture'){
      // Nurtured sellers come back on their check-back date, then follow the normal retry rules from there.
      const until = d.nurture && d.nurture.until ? new Date(d.nurture.until+'T00:00:00').getTime() : 0
      if(until>now) { out.scheduled.push({...item, kind:'nurture', next:until, label:'Nurture check-back'}); continue }
      if(!calls.some(a=>new Date(a.created_at).getTime()>=until)){ out.due.push({...item, kind:'nurture', label:'Nurture check-back'}); continue }
    }
    if(!tries){ out.due.push({...item, kind:'new', label:'New'}); continue }
    if(reached){
      const next = lastAt + FOLLOW_UP_DAYS*DAY
      if(next<=now) out.due.push({...item, kind:'followup', label:'Follow-up'}); else out.scheduled.push({...item, kind:'followup', next, label:'Follow-up'})
      continue
    }
    if(tries>=MAX_TRIES){ out.parked.push({...item, kind:'parked', label:'No contact after '+tries+' tries'}); continue }
    const next = lastAt + RETRY_GAPS[Math.min(tries-1, RETRY_GAPS.length-1)]*DAY
    // due from the start of that day, so a VA can work it any time on its day
    const nextDay = new Date(next); nextDay.setHours(0,0,0,0)
    if(nextDay.getTime()<=now) out.due.push({...item, kind:'retry', label:'Try '+(tries+1)+' of '+MAX_TRIES})
    else out.scheduled.push({...item, kind:'retry', next:nextDay.getTime(), label:'Try '+(tries+1)+' of '+MAX_TRIES})
  }
  // callbacks by time → people you've talked to → everyone else by score (fewer tries first on ties)
  const order = { callback:0, followup:1, nurture:1, new:2, retry:2 }
  out.due.sort((a,b)=> order[a.kind]-order[b.kind]
    || (a.kind==='callback' ? new Date(a.cb.at)-new Date(b.cb.at) : 0)
    || (b.score - a.tries*3) - (a.score - b.tries*3))
  out.scheduled.sort((a,b)=>a.next-b.next)
  out.parked.sort((a,b)=>b.score-a.score)
  out.noPhone.sort((a,b)=>b.score-a.score)
  return out
}
export const whenText = t => { const d = new Date(t), days = Math.round((new Date(d).setHours(0,0,0,0)-startOfToday())/DAY)
  return days<=0 ? 'today' : days===1 ? 'tomorrow' : d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'}) }
