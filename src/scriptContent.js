// The seller call script — one source for the Scripts page and the script on each lead.
// {tokens} are filled from the lead you pick; anything unknown shows as a blank to fill in.
import { REPAIRS, detailsOf, money, compResult } from './leadModel'

export const COMPANY = 'Coleman Home Buyers'

export function scriptVars(lead, caller){
  if(!lead) return { company:COMPANY, caller:caller||'' }
  const d = detailsOf(lead)
  const flagged = REPAIRS.filter(([k])=>d.repairs[k])
  const lo = flagged.reduce((s,r)=>s+r[2],0), hi = flagged.reduce((s,r)=>s+r[3],0)
  const arv = Number(lead.arv)||0, cr = compResult(lead)
  const offer = cr ? cr.open : arv ? Math.max(0, Math.round((arv*0.70 - (flagged.length?hi:20000) - 15000)/1000)*1000) : 0
  return {
    company:COMPANY, caller:caller||'',
    first:(lead.name||'').split(' ')[0] || '',
    address:lead.address||'', city:lead.city||'',
    repairs: flagged.length ? flagged.map(r=>r[1].toLowerCase()).join(', ') : '',
    repaircost: flagged.length ? money(lo)+'–'+money(hi) : '',
    offer: offer ? money(offer) : '',
    asking: Number(d.asking_price) ? money(d.asking_price) : '',
    timeline: d.timeline && d.timeline!=='Unsure' ? d.timeline : '',
    reason: d.sell_reason && d.sell_reason!=='Unknown' ? d.sell_reason.toLowerCase() : '',
  }
}

const BLANK = { first:'[name]', address:'[address]', city:'your area', repairs:'[the repairs]', repaircost:'[repair cost]', offer:'[your offer]', asking:'[their number]', timeline:'[their timeline]', reason:'[their reason]', caller:'[your name]', company:COMPANY }
// Returns pieces: [{t:'text'}|{v:'filled value', blank:bool}] so the page can highlight what came from the lead.
export function fillParts(text, vars){
  const out = []; let last = 0
  for(const m of text.matchAll(/\{(\w+)\}/g)){
    if(m.index>last) out.push({ t:text.slice(last, m.index) })
    const v = vars && vars[m[1]]
    out.push(v ? { v } : { v:BLANK[m[1]]||'['+m[1]+']', blank:true })
    last = m.index + m[0].length
  }
  if(last<text.length) out.push({ t:text.slice(last) })
  return out
}
export const fillText = (text, vars) => fillParts(text, vars).map(p=>p.t!==undefined?p.t:p.v).join('')

// Each step: say = lines to read; if = [when they say…, you say…]; listen = what to capture; tip = coaching.
// who: 'va' (VA only), 'closer' (closer only), or both.
export const STEPS = [
  { key:'open', title:'Opener', goal:'Get permission to talk. First 30 seconds — friendly, calm, quick.',
    say:[ 'Hi, is this {first}?',
          '{first}, this is {caller} with {company}. I\'m calling about {address}. We buy houses in {city} for cash, as-is. Did I catch you at an okay time for two minutes?' ],
    if:[ ['They\'re busy', 'No problem at all. When\'s a better time — later today or tomorrow?  →  set a callback on the lead before you hang up.'],
         ['"Who is this? How\'d you get my number?"', 'It\'s from public property records — I\'m only reaching out to owners in the area. Is now a bad time?'],
         ['"Take me off your list"', 'Done — sorry to bother you.  →  tap DNC on the lead right away. Don\'t push.'] ],
    tip:'Smile while you dial — they hear it. Say the address early so they know it\'s real.' },
  { key:'frame', title:'Set the frame', goal:'You\'re qualifying them, not begging. This takes the pressure off both of you.',
    say:[ 'I can\'t promise we\'re a fit — first I just need to see if the property qualifies. Mind if I ask you a few quick questions?' ],
    tip:'Wait for the yes. Once they agree to questions, they\'re in the conversation.' },
  { key:'condition', title:'Condition', goal:'Walk the house with them. Check the repair boxes on the Call Card as they talk.',
    say:[ 'If I walked in the front door today, what would I see?',
          'When was the roof last done? The HVAC? The water heater?',
          'Any foundation, plumbing or electrical issues you know about?',
          'Is anyone living there right now — you, a tenant, or is it vacant?' ],
    listen:'Pillar 1 — Condition. Every repair they mention is ammo for the offer later.',
    tip:'Let them talk. "Tell me more about that" gets you twice the detail.' },
  { key:'motivation', title:'Motivation', goal:'Find the real reason. Dig three levels — the truth is usually the third answer.',
    say:[ 'What\'s got you thinking about selling?',
          'How long has that been going on?',
          'And what happens if nothing changes?' ],
    listen:'Pillar 2 — Reason. Pick it in the call log (inherited, behind on payments, tired landlord…).',
    tip:'Don\'t solve it yet. Just understand it. Repeat back what you heard: "So it sounds like…"' },
  { key:'timeline', title:'Timeline', goal:'How fast do they need this done?',
    say:[ 'If everything lined up, when would you want this done — 30 days, 60 days, or are you just exploring?' ],
    if:[ ['"No rush"', 'Got it. What would make it a priority — is there a date or event coming up?'] ],
    listen:'Pillar 3 — Timeline.',
    tip:'Fast timeline + real reason = hot lead. Hand it off the same day.' },
  { key:'price', title:'Price', goal:'Get them to say a number first. Whoever names a price first loses ground.',
    say:[ 'Last one — if I could close on your timeline and you didn\'t have to fix a thing, what number would work for you?' ],
    if:[ ['"Just make me an offer"', 'I will — I just don\'t want to insult you with a number that\'s way off. Ballpark — are we closer to 100 or 200?'],
         ['They give a number', 'Is that flexible, or is that the number you need?'],
         ['"I\'m going to list it with an agent"', 'Totally fair. Can I ask — have you looked at what you\'d actually net after the agent\'s 6%, the repairs they\'ll ask for, and a few months of payments while it sits? We\'re cash, as-is, no fees, and you pick the closing date. Worth hearing our number before you sign a listing?'] ],
    listen:'Pillar 4 — Asking price. Type it in the call log, and note if it\'s flexible.',
    tip:'After you ask, stop talking. Silence is fine.' },
  { key:'close-va', who:'va', title:'Hand-off', goal:'VAs stop here. Book the callback with the acquisitions manager — never quote a price.',
    say:[ 'This sounds like a great fit, {first}. My acquisitions manager is going to run the numbers on {address} and call you back with an offer.',
          'Is this the best number to reach you? And what time works best — today or tomorrow?' ],
    if:[ ['"What\'s the offer?"', 'I don\'t want to guess and give you a wrong number — my manager looks at the comps and the repairs you told me about, and calls you back with a real offer.'] ],
    listen:'Log the call → tap Hand off to closer, with the callback time and a one-line summary.',
    tip:'End warm: "Thanks {first}, talk soon." The closer\'s call goes better when the seller liked you.' },
  { key:'close-offer', who:'closer', title:'Offer & close', goal:'Mirror their situation, anchor on the repairs, then go straight to next steps.',
    say:[ 'Here\'s what I\'m hearing: {reason}, the house needs {repairs}, and you want this done within {timeline}.',
          'A retail buyer would need {repaircost} of work before a bank will lend on it — that\'s why cash matters here.',
          'Based on all that, I\'m at {offer}. Cash, as-is, no fees, and you pick the closing date.',
          'Here\'s what happens next: I send the agreement tonight, you sign right from your phone, and title starts tomorrow. What\'s the best email for you?' ],
    if:[ ['"That\'s too low"', 'I hear you. You mentioned {asking} — walk through it with me: {repairs} runs {repaircost}. Take that off and we\'re closer than it looks, and mine is cash and certain.'],
         ['"I\'ll list it with an agent"', 'You could. Listed, it\'s 6% commission, the repairs done first, and 60–90 days of showings and payments. Mine is net, as-is, in two weeks. What matters more to you — the top number or the certain one?'],
         ['"I need to think about it"', 'Totally fair. Just so I help the right way — is it the price, the timing, or something else? If we solved that one piece, would we have a deal?'] ],
    tip:'Never end with "so what do you think?" Assume the deal and ask for the email.' },
]
export const stepsFor = role => STEPS.filter(s=>!s.who || s.who===role)
