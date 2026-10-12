import { useRef, useState, useEffect } from 'react'
// Dials-per-day bar chart (single series, optional dashed goal line).
// Drawn at the container's real width so text stays a normal size on wide screens.
const C = { line:'#1d3a4a', muted:'#88a0b4', cream:'#f4f1ea', orange:'#ff6b1a' }

export default function DailyBars({series,max,goal,height=170}){
  const box = useRef(null)
  const [W,setW] = useState(560)
  useEffect(()=>{
    const el = box.current; if(!el) return
    const measure = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)))
    measure()
    if(typeof ResizeObserver==='undefined') return
    const ro = new ResizeObserver(measure); ro.observe(el)
    return ()=>ro.disconnect()
  },[])
  const H=height, pl=28, pb=22, pt=6
  const iw=W-pl, ih=H-pb-pt
  const bw = iw/series.length
  const y = v => pt + ih - (v/max)*ih
  const ticks = [0, Math.round(max/2), Math.round(max)]
  const tgtY = goal ? y(goal) : null
  const every = bw>=26 ? 1 : bw>=14 ? 2 : 5
  return (
    <div ref={box} style={{width:'100%'}}>
      <svg width={W} height={H} viewBox={'0 0 '+W+' '+H} style={{display:'block',maxWidth:'100%'}} role="img" aria-label={"Dials per day, last "+series.length+" days"}>
        {ticks.map(v=>(
          <g key={v}>
            <line x1={pl} x2={W} y1={y(v)} y2={y(v)} stroke={C.line} strokeWidth="1"/>
            <text x={pl-6} y={y(v)+3} textAnchor="end" fontSize="10" fill={C.muted}>{v}</text>
          </g>
        ))}
        {tgtY!==null && <line x1={pl} x2={W} y1={tgtY} y2={tgtY} stroke={C.muted} strokeWidth="1" strokeDasharray="4 4"/>}
        {series.map((s,i)=>{
          const w = Math.max(2, Math.min(bw-4, 28)), x = pl + i*bw + (bw-w)/2
          const top = y(s.dials), h = pt+ih-top
          const r = Math.min(4, w/2, h)
          const path = h>0 ? `M${x},${pt+ih} L${x},${top+r} Q${x},${top} ${x+r},${top} L${x+w-r},${top} Q${x+w},${top} ${x+w},${top+r} L${x+w},${pt+ih} Z` : ''
          const label = s.d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})
          const isToday = i===series.length-1
          return (
            <g key={i}>
              <rect x={pl+i*bw} y={pt} width={bw} height={ih} fill="transparent">
                <title>{label}: {s.dials} dials · {s.contacts} contacts · {s.offers} offers</title>
              </rect>
              {path && <path d={path} fill={C.orange} opacity={isToday?1:0.8} pointerEvents="none"/>}
              {(isToday || (series.length-1-i)%every===0) && <text x={pl+i*bw+bw/2} y={H-6} textAnchor="middle" fontSize="10" fill={isToday?C.cream:C.muted}>{isToday?'Today':s.d.getDate()}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
