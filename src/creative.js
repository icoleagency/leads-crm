// Debt / liens and creative-finance math (subject-to and seller finance).

const n = v => { const x = Number(String(v??'').replace(/[$,%\s]/g,'')); return isFinite(x) ? x : 0 }
export const pmt = (ratePct, years, principal) => {
  const r = n(ratePct)/1200, k = Math.round(n(years)*12), P = n(principal)
  if(!P || !k) return 0
  return r ? P*r/(1-Math.pow(1+r,-k)) : P/k
}
// Loan balance left after `months` payments.
export const balanceAfter = (ratePct, years, principal, months) => {
  const r = n(ratePct)/1200, P = n(principal), pay = pmt(ratePct, years, principal)
  if(!r) return Math.max(0, P - pay*months)
  return Math.max(0, P*Math.pow(1+r,months) - pay*(Math.pow(1+r,months)-1)/r)
}

export const BLANK_DEBT = { free:false, loan:'', rate:'', payment:'', behind:'', arrears:'', taxes:'', liens:'', hoa:'', cash_need:'', verified:false, notes:'' }
// Everything that must be paid off for a clean cash closing.
export function payoff(debt){
  const d = { ...BLANK_DEBT, ...(debt||{}) }
  const loan = d.free ? 0 : n(d.loan)
  const items = [['Mortgage payoff', loan], ['Missed payments / arrears', d.free?0:n(d.arrears)], ['Back taxes', n(d.taxes)], ['Other liens & judgments', n(d.liens)], ['HOA owed', n(d.hoa)]]
  return { items, total:items.reduce((s,x)=>s+x[1],0), loan, arrears:d.free?0:n(d.arrears) }
}
// Can a cash offer close? Seller's net at a given price.
export function cashNet(price, debt){
  const po = payoff(debt)
  const sellerCosts = n(price)*0.015                       // title, deed prep, prorations (rough)
  const net = n(price) - po.total - sellerCosts
  return { net, payoff:po.total, sellerCosts, works: net >= n((debt||{}).cash_need) }
}

export const BLANK_CREATIVE = { kind:'subto', rent:'', expPct:25, cashToSeller:5000, closing:3000, fee:15000, includeRehab:true,
  sfPrice:'', sfDown:'', sfRate:4, sfYears:30, sfBalloon:7, taxIns:'' }

// Creative buyer's view of the deal (the person you assign the creative deal to).
export function creative(c0, { arv, rehab, debt }){
  const c = { ...BLANK_CREATIVE, ...(c0||{}) }
  const rent = n(c.rent), exp = rent*n(c.expPct)/100, rehabIn = c.includeRehab ? n(rehab) : 0
  const po = payoff(debt)
  if(c.kind==='subto'){
    const payment = n((debt||{}).payment)
    const price = po.loan + po.arrears + n((debt||{}).taxes) + n((debt||{}).liens) + n((debt||{}).hoa) + n(c.cashToSeller)
    const entry = po.arrears + n((debt||{}).taxes) + n((debt||{}).liens) + n((debt||{}).hoa) + n(c.cashToSeller) + n(c.closing) + n(c.fee) + rehabIn
    const cashflow = rent - payment - exp
    const equity = n(arv) - n(rehab) - po.loan - (entry - rehabIn)
    return { kind:'subto', price, entry, payment, cashflow, coc: entry>0 ? cashflow*12/entry : 0, equity, rent, exp,
      missing:[!payment&&'the monthly payment (PITI)', !po.loan&&!(debt&&debt.free)&&'the loan balance', !rent&&'market rent'].filter(Boolean) }
  }
  const price = n(c.sfPrice), down = n(c.sfDown)
  const payment = pmt(c.sfRate, c.sfYears, Math.max(0, price-down))
  const taxIns = n(c.taxIns)
  const entry = down + n(c.closing) + n(c.fee) + rehabIn
  const cashflow = rent - payment - taxIns - exp
  const balloon = n(c.sfBalloon) ? balanceAfter(c.sfRate, c.sfYears, Math.max(0, price-down), n(c.sfBalloon)*12) : 0
  const equity = n(arv) - n(rehab) - price - n(c.fee) - n(c.closing)
  return { kind:'sellerfi', price, down, entry, payment, cashflow, coc: entry>0 ? cashflow*12/entry : 0, equity, balloon, rent, exp, taxIns,
    missing:[!price&&'the purchase price', !rent&&'market rent', !taxIns&&'monthly taxes + insurance'].filter(Boolean),
    // seller still owes money: the down payment has to pay it off (or the note wraps the existing loan)
    owedAtClose: po.total, downShort: po.total>0 && down<po.total ? po.total-down : 0 }
}
// Creative buyers usually want: $250+/mo cash flow, 12%+ cash-on-cash, and equity on day one.
export function creativeVerdict(m){
  if(!m || m.missing.length) return { s:'amber', t:'Fill in '+(m?m.missing.join(', '):'the numbers') }
  if(m.cashflow>=250 && m.coc>=0.12 && m.equity>=0) return { s:'green', t:'Creative buyers will want this' }
  if(m.cashflow>=100 && m.equity>=-5000) return { s:'amber', t:'Thin — works for some creative buyers' }
  return { s:'red', t:'Won\'t sell as a creative deal at these terms' }
}

// Underwriting steps and decisions (shared by the analyzer and the step components).
export const STEPS = [['property','Property'],['arv','Comps & ARV'],['rehab','Rehab'],['debt','Debt & liens'],['exit','Exit strategy'],['decide','Offer & sign-off']]
export const DECISIONS = [['approved','Approve — make the offer','#3fd08a'],['info','Need more info','#f5b942'],['pass','Pass on this deal','#e5573f']]
