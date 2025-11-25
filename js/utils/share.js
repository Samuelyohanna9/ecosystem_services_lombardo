function currentUrlWithParams(params = {}){
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k,v])=>{
    if(v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

export function shareToFacebook({ title, url }){
  const fbUrl =
    "https://www.facebook.com/sharer/sharer.php?u=" +
    encodeURIComponent(url) +
    (title ? "&quote=" + encodeURIComponent(title) : "");
  window.open(fbUrl, "_blank", "noopener,noreferrer");
}

export function shareToX({ title, url }){
  const text = title ? `${title}` : "";
  const xUrl =
    "https://twitter.com/intent/tweet?url=" +
    encodeURIComponent(url) +
    (text ? "&text=" + encodeURIComponent(text) : "");
  window.open(xUrl, "_blank", "noopener,noreferrer");
}

export function setupShareButtons(getSharePayload){
  const btnFb = document.getElementById("btnShareFb");
  const btnX  = document.getElementById("btnShareX");

  btnFb.addEventListener("click", ()=>{
    const payload = getSharePayload();
    shareToFacebook(payload);
  });

  btnX.addEventListener("click", ()=>{
    const payload = getSharePayload();
    shareToX(payload);
  });
}

export { currentUrlWithParams };
