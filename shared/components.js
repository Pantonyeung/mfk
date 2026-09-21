export const money=value=>`$${Number(value||0).toFixed(0)}`;
export const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
export function imageBlock(src,alt,className=''){
  return `<span class="image-shell ${className}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"><span class="image-fallback" style="display:none">餐點圖片</span></span>`;
}
export function bindImageFallbacks(root=document){
  root.querySelectorAll('.image-shell img').forEach(img=>{
    const fallback=img.nextElementSibling;
    const fail=()=>{img.hidden=true;if(fallback)fallback.style.display='grid';};
    if(fallback)fallback.style.display='none';
    img.addEventListener('error',fail,{once:true});
    if(img.complete&&!img.naturalWidth)fail();
  });
}
export function toastHost(){return '<div id="toast" class="toast"></div>';}
export function showToast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>node.classList.remove('show'),1600);}
