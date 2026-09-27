import { supabase } from './supabaseClient'

// ---------- load ----------
export async function fetchTeam(){
  const [c, t] = await Promise.all([
    supabase.from('campaigns').select('*').order('name'),
    supabase.from('team_members').select('*').order('name'),
  ])
  if(c.error) throw c.error
  if(t.error) throw t.error
  return { campaigns: c.data||[], team: t.data||[] }
}

export function teamErr(msg){
  const m = String(msg||'')
  if(/campaigns|team_members/i.test(m) || /relation .* does not exist/i.test(m) || /schema cache/i.test(m))
    return "The VA Workspace needs two new tables (campaigns and team members). Run the SQL from supabase/add-team-campaigns.sql in the Supabase SQL Editor, then retry."
  if(/failed to fetch|network/i.test(m)) return "Can't reach the database right now — give it a minute, then retry."
  return m
}

// ---------- write ----------
async function run(q){ const { error } = await q; if(error) throw error }

export function saveCampaign(c){
  const row = { name:c.name.trim(), state:c.state||null, notes:c.notes||null, active:c.active!==false }
  return run(c.id ? supabase.from('campaigns').update(row).eq('id',c.id) : supabase.from('campaigns').insert([row]))
}
export function deleteCampaign(id){ return run(supabase.from('campaigns').delete().eq('id',id)) }

export function saveMember(m){
  const row = { name:m.name.trim(), role:m.role||'VA', campaigns:(m.campaigns||[]).map(String),
    dial_goal:Number(m.dial_goal)||60, offer_goal:Number(m.offer_goal)||3, active:m.active!==false }
  return run(m.id ? supabase.from('team_members').update(row).eq('id',m.id) : supabase.from('team_members').insert([row]))
}
export function deleteMember(id){ return run(supabase.from('team_members').delete().eq('id',id)) }

// ---------- helpers ----------
export const campaignOf = lead => (lead && lead.details && lead.details.campaign) ? String(lead.details.campaign) : ''
export function campaignName(campaigns, id){
  const c = campaigns.find(x=>String(x.id)===String(id))
  return c ? c.name : ''
}

// Which VA this device is "working as" (per-device, not shared).
export function getMe(){ try{ return localStorage.getItem('wos_va')||'' }catch{ return '' } }
export function setMe(id){ try{ localStorage.setItem('wos_va', String(id||'')) }catch{ /* storage unavailable */ } }

// Open hand-offs waiting on the closer.
export const openHandoff = lead => {
  const h = lead && lead.details && lead.details.handoff
  return h && h.status==='open' ? h : null
}
