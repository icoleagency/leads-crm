import { supabase } from './supabaseClient'
import { tally, inLastDays } from './activity'

// ---------- dates ----------
export const localDate = (d=new Date()) => d.toLocaleDateString('en-CA')   // YYYY-MM-DD in the viewer's time zone
export const minsAgo = iso => Math.max(0, Math.round((Date.now()-new Date(iso).getTime())/60000))
export function agoText(iso){
  const m = minsAgo(iso)
  if(m<1) return 'just now'
  if(m<60) return m+'m ago'
  const h = Math.floor(m/60)
  return h<24 ? h+'h '+(m%60)+'m ago' : Math.floor(h/24)+'d ago'
}

export function vaToolsErr(msg){
  const m = String(msg||'')
  if(/va_reports|va_notes|schema cache|relation .* does not exist/i.test(m)) return 'setup'
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
}
async function run(q){ const { data, error } = await q; if(error) throw error; return data }

// ---------- end-of-day reports ----------
export function fetchReports(days=14){
  const since = new Date(); since.setDate(since.getDate()-days)
  return run(supabase.from('va_reports').select('*').gte('report_date', localDate(since)).order('report_date',{ascending:false}))
}
export function saveReport(r){
  return run(supabase.from('va_reports').upsert([{ ...r, updated_at:new Date().toISOString() }], { onConflict:'member_id,report_date' }).select())
}

// ---------- coaching notes ----------
export function fetchNotes(){
  const since = new Date(); since.setDate(since.getDate()-60)
  return run(supabase.from('va_notes').select('*').or('pinned.eq.true,created_at.gte.'+since.toISOString()).order('created_at',{ascending:false}).limit(200))
}
export function sendNote({member_id, body, pinned}){
  return run(supabase.from('va_notes').insert([{ member_id:member_id||null, body:body.trim(), pinned:!!pinned }]))
}
export function deleteNote(id){ return run(supabase.from('va_notes').delete().eq('id', id)) }
export function setPinned(id, pinned){ return run(supabase.from('va_notes').update({ pinned }).eq('id', id)) }
export function markRead(note, memberId){
  const read_by = [...new Set([...(note.read_by||[]), String(memberId)])]
  return run(supabase.from('va_notes').update({ read_by }).eq('id', note.id))
}
export const notesFor = (notes, memberId) => notes.filter(n=>!n.member_id || String(n.member_id)===String(memberId))
export const isRead = (n, memberId) => (n.read_by||[]).includes(String(memberId))

// ---------- live status ----------
// How a VA's day looks right now, from their logged calls.
export function liveStatus(todayRows, reportedToday){
  if(reportedToday) return { key:'done', label:'Done for the day', c:'#88a0b4' }
  if(!todayRows.length) return { key:'off', label:'No calls yet today', c:'#88a0b4' }
  const m = minsAgo(todayRows[0].created_at)
  if(m<15) return { key:'live', label:'On the phones', c:'#3fd08a', m }
  if(m<30) return { key:'quiet', label:'Quiet '+m+' min', c:'#f5b942', m }
  return { key:'idle', label:'Idle '+(m<120?m+' min':Math.floor(m/60)+' hr'), c:'#e5573f', m }
}

// ---------- day numbers for one VA ----------
export function dayStats(member, activity, leads){
  const rows = inLastDays(activity,1).filter(a=>(a.caller||'')===member.name)
  const t = tally(rows)
  const today = localDate()
  const handoffs = leads.filter(l=>{ const h=l.details&&l.details.handoff; return h && h.by===member.name && h.at && localDate(new Date(h.at))===today }).length
  const first = rows.length ? rows[rows.length-1].created_at : null, last = rows.length ? rows[0].created_at : null
  const hours = first ? Math.max(0.25, (new Date(last)-new Date(first))/3600000) : 0
  return { rows, dials:t.dials, contacts:t.contacts, appointments:t.appointment, offers:t.offer, contracts:t.contract, handoffs,
    first, last, hours:Math.round(hours*10)/10, per_hour: hours>=0.5 ? Math.round(t.dials/hours) : null }
}

