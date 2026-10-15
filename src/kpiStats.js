import { OUTCOME, tally, startOfDay } from './activity'
import { leadPhones, BAD } from './phones'
import { rankScore } from './callQueue'
import { scoreLabel } from './stacking'

const DAY = 24*60*60*1000
const ts = a => new Date(a.created_at).getTime()
export const WORKDAY_END = 18   // 6 pm, for "on pace for…"

// The same-length window just before the selected one. Today compares with yesterday up to this
// same time of day, so a morning check isn't measured against a full day. Null when we don't
// have the older data loaded (activity is fetched for 90 days).
export function prevRows(activity, days, now=Date.now()){
  const s0 = startOfDay().getTime()
  if(days===1) return activity.filter(a=>{ const x=ts(a); return x>=s0-DAY && x<now-DAY })
  if(days*2>90) return null
  const end = s0-(days-1)*DAY, start = end-days*DAY
  return activity.filter(a=>{ const x=ts(a); return x>=start && x<end })
}

// 24 buckets of { dials, contacts } by local hour.
export function byHour(rows){
  const h = Array.from({length:24},()=>({ dials:0, contacts:0 }))
  for(const a of rows){
    const o = OUTCOME[a.outcome]; if(!o || !o.dial) continue
    const b = h[new Date(a.created_at).getHours()]
    b.dials++; if(o.contact) b.contacts++
  }
  return h
}
// Best 2-hour stretch by contact rate, ignoring hours with too few dials to mean anything.
export function bestWindow(hours, min=8){
  let best = null
  for(let i=0;i<23;i++){
    const d = hours[i].dials+hours[i+1].dials, c = hours[i].contacts+hours[i+1].contacts
    if(hours[i].dials<Math.ceil(min/2) || hours[i+1].dials<Math.ceil(min/2)) continue
    const r = c/d
    if(!best || r>best.rate) best = { start:i, rate:r, dials:d, contacts:c }
  }
  return best
}
export const hourName = h => (h%12||12)+(h<12?' am':' pm')
export const hourShort = h => (h%12||12)+(h<12?'a':'p')

// Pace for today: dials per hour since the first call, projected to the end of the workday.
export function todayPace(rows, now=new Date()){
  const dialRows = rows.filter(a=>OUTCOME[a.outcome]&&OUTCOME[a.outcome].dial)
  if(!dialRows.length) return { dials:0, perHour:null, projected:null, lastMins:null, first:null }
  const times = dialRows.map(ts).sort((a,b)=>a-b)
  const first = times[0], last = times[times.length-1]
  const hours = Math.max(0.25, (now.getTime()-first)/3600000)
  const perHour = hours>=0.5 ? dialRows.length/hours : null
  const end = new Date(now); end.setHours(WORKDAY_END,0,0,0)
  const left = Math.max(0, (end.getTime()-now.getTime())/3600000)
  const projected = perHour!==null && left>0 ? Math.round(dialRows.length + perHour*left) : null
  return { dials:dialRows.length, perHour: perHour===null?null:Math.round(perHour), projected,
    lastMins: Math.max(0, Math.round((now.getTime()-last)/60000)), first:new Date(first) }
}

// For every dial, which attempt it was on that lead (1st call, 2nd, …), and whether it reached someone.
export function byAttempt(activity, cap=6){
  const per = {}
  for(const a of activity){ const o=OUTCOME[a.outcome]; if(!o || !o.dial) continue; (per[a.lead_id] ||= []).push(a) }
  const out = Array.from({length:cap},(_,i)=>({ n:i+1, dials:0, contacts:0 }))
  for(const list of Object.values(per)){
    list.sort((a,b)=>ts(a)-ts(b))
    let reached = false
    list.forEach((a,i)=>{
      if(reached) return            // only count tries until we first reach the owner
      const b = out[Math.min(i,cap-1)]
      b.dials++
      if(OUTCOME[a.outcome].contact){ b.contacts++; reached = true }
    })
  }
  return out
}

// Phone quality + contact rate, grouped by whatever key (list type, county).
export function listQuality(leads, rows, keyOf){
  const g = {}, leadKey = {}
  const grp = k => g[k] ||= { k, leads:0, numbers:0, bad:0, rows:[] }
  for(const l of leads){
    const ph = leadPhones(l); if(!ph.length) continue
    const k = keyOf(l)||'Unknown'; leadKey[String(l.id)] = k
    const x = grp(k); x.leads++; x.numbers += ph.length; x.bad += ph.filter(p=>BAD.includes(p.status)).length
  }
  for(const a of rows){ const k = leadKey[String(a.lead_id)]; if(k) g[k].rows.push(a) }
  return Object.values(g).map(x=>({ ...x, t:tally(x.rows) })).sort((a,b)=>b.numbers-a.numbers)
}

// Contact / offer rates by the lead's score band (Hot / Warm / Mild / Cold).
export const BANDS = ['Hot','Warm','Mild','Cold']
export function scoreBands(leads, rows){
  const band = {}, out = Object.fromEntries(BANDS.map(b=>[b,{ k:b, leads:0, rows:[] }]))
  for(const l of leads){ const b = scoreLabel(rankScore(l))[0]; band[String(l.id)] = b; out[b].leads++ }
  for(const a of rows){ const b = band[String(a.lead_id)]; if(b) out[b].rows.push(a) }
  return BANDS.map(b=>({ ...out[b], color:scoreLabel(b==='Hot'?80:b==='Warm'?60:b==='Mild'?40:0)[1], t:tally(out[b].rows),
    leadsCalled:new Set(out[b].rows.map(a=>a.lead_id)).size }))
}
