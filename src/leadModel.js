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
