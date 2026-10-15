import { supabase } from './supabaseClient'

// Who is signed in and what they're allowed to do.
// state: 'ok' (in crm_access) | 'none' (signed in but not given access) | 'setup' (lock-down SQL not run yet)
export async function fetchAccess(user){
  const { data, error } = await supabase.from('crm_access').select('role,member_id,email').eq('user_id', user.id).maybeSingle()
  if(error){
    if(/crm_access|schema cache|does not exist|relation/i.test(error.message)) return { state:'setup', role:'owner', member_id:null }
    throw error
  }
  if(!data) return { state:'none' }
  return { state:'ok', role:data.role, member_id:data.member_id }
}

export const signIn = (email, password) => supabase.auth.signInWithPassword({ email:email.trim(), password })
export const signOut = () => supabase.auth.signOut()
export const sendReset = email => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo:window.location.origin })
export const setPassword = password => supabase.auth.updateUser({ password })

export function authErr(e){
  const m = String((e && e.message) || e || '')
  if(/invalid login|invalid credentials/i.test(m)) return 'That email and password don\'t match. Check for typos, or reset your password.'
  if(/email not confirmed/i.test(m)) return 'This login hasn\'t been confirmed yet. In Supabase → Authentication → Users, confirm the user (or re-create it with "Auto Confirm User").'
  if(/rate limit|too many/i.test(m)) return 'Too many tries — wait a minute and try again.'
  if(/failed to fetch|network/i.test(m)) return 'Can\'t reach the server — check your connection and try again.'
  if(/password should be|at least/i.test(m)) return 'Use a longer password — at least 8 characters.'
  return m || 'Something went wrong.'
}

// Owner-only: create / reset / remove team logins through the team-access server function.
export async function teamAccess(action, payload={}){
  const { data:{ session } } = await supabase.auth.getSession()
  if(!session) throw new Error('Please sign in again.')
  const r = await fetch('/.netlify/functions/team-access', { method:'POST',
    headers:{ 'content-type':'application/json', authorization:'Bearer '+session.access_token },
    body:JSON.stringify({ action, ...payload }) })
  const j = await r.json().catch(()=>({ ok:false, error:'The server returned an unexpected answer.' }))
  if(!j.ok) throw new Error(j.error||'Something went wrong')
  return j
}
export async function listAccess(){
  const { data, error } = await supabase.from('crm_access').select('*').order('role').order('email')
  if(error) throw error
  return data||[]
}
export function tempPassword(){
  const words = ['Maple','River','Stone','Cedar','Harbor','Falcon','Summit','Copper','Willow','Ember']
  const a = new Uint32Array(3); crypto.getRandomValues(a)
  return words[a[0]%words.length]+'-'+words[a[1]%words.length]+'-'+(1000+a[2]%9000)
}
