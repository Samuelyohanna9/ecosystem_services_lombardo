export function parseNum(v){
  if(v===undefined||v===null) return NaN;
  const s=(typeof v==='number')
    ? String(v)
    : String(v).replace(/\./g,'').replace(/,/g,'.');
  const m=s.match(/-?[0-9]*\.?[0-9]+/);
  return m?parseFloat(m[0]):NaN;
}

export function setKPI(id,v,unit="",decimals=0){
  const el=document.getElementById(id);
  if(!el) return;
  const n=parseNum(v);
  el.textContent = isFinite(n)
    ? n.toLocaleString(undefined,{maximumFractionDigits:decimals})+(unit?` ${unit}`:'')
    : "—";
}