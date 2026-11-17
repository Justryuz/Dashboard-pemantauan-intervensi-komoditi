/* ===== Pop-up Mobilisasi Stok & Simulasi Margin ===== */
const MD={open:false,tab:'mob',opener:null,openerSel:null,timer:null,prevOv:'',prevPad:''};
const MD_TABS=['mob','mar'];
const mdTabEl=k=>$i(k==='mob'?'ivMdTabMob':'ivMdTabMar');
function mdSetTab(t,focus){
 if(!MD_TABS.includes(t))t='mob';MD.tab=t;
 try{sessionStorage.setItem('ivMdTab',t)}catch(e){}
 MD_TABS.forEach(k=>{const b=mdTabEl(k),on=k===t;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$i(k==='mob'?'ivMobPanel':'ivMarPanel').hidden=!on});
 $i('ivMdBody').scrollTop=0;
 if(focus)mdTabEl(t).focus();
}
function mdCtx(){
 const host=$i('ivMdCtx');if(!host)return;
 const po=effPO(),cm=effCommodity();
 host.innerHTML=chip(po?'PO terpilih: '+poName(po):'PO belum dipilih',po?'info':'grey')+chip('Komoditi: '+commName(cm.id),'info')+chip('Mod: '+modeLbl(ivState.selectedMode),'grey');
}
function mdOpen(tab,opener){
 const back=$i('ivMd');
 if(MD.open){mdSetTab(tab||MD.tab);mdCtx();return}
 clearTimeout(MD.timer);
 MD.opener=opener||null;MD.openerSel=null;
 if(opener&&opener.dataset&&opener.dataset.ivAct){const a=opener.dataset.ivAct,g=opener.dataset.ivArg;MD.openerSel=`[data-iv-act="${a}"]`+(g!=null?`[data-iv-arg="${String(g).replace(/["\\]/g,'\\$&')}"]`:'')}
 MD.open=true;
 mdCtx();mdSetTab(tab||MD.tab);
 const sbw=window.innerWidth-document.documentElement.clientWidth;
 MD.prevOv=document.body.style.overflow;MD.prevPad=document.body.style.paddingRight;
 document.body.style.overflow='hidden';if(sbw>0)document.body.style.paddingRight=sbw+'px';
 document.body.classList.add('iv-md-open');
 back.hidden=false;void back.offsetWidth;back.classList.add('open');
 mdTabEl(MD.tab).focus({preventScroll:true});
}
function mdClose(restore){
 if(!MD.open)return;MD.open=false;
 const back=$i('ivMd');back.classList.remove('open');
 document.body.style.overflow=MD.prevOv;document.body.style.paddingRight=MD.prevPad;
 document.body.classList.remove('iv-md-open');
 const fin=()=>{if(!MD.open)back.hidden=true};
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)fin();else MD.timer=setTimeout(fin,200);
 if(restore!==false){let o=MD.opener;if(!(o&&o.isConnected)&&MD.openerSel)o=document.querySelector('#viewIntervensi '+MD.openerSel);if(o&&o.focus)o.focus({preventScroll:true})}
}
(function(){
 let down=false;const back=$i('ivMd'),dlg=$i('ivMdDlg');
 try{const st=sessionStorage.getItem('ivMdTab');if(MD_TABS.includes(st))MD.tab=st}catch(e){}
 $i('ivMdClose').addEventListener('click',()=>mdClose());
 back.addEventListener('pointerdown',e=>{down=e.target===back});
 back.addEventListener('click',e=>{if(e.target===back&&(down||e.detail===0))mdClose();down=false});
 MD_TABS.forEach(k=>mdTabEl(k).addEventListener('click',()=>mdSetTab(k)));
 $i('ivMdTabMob').parentNode.addEventListener('keydown',e=>{
  const i=MD_TABS.indexOf(MD.tab);let n=null;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')n=(i+1)%MD_TABS.length;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')n=(i+MD_TABS.length-1)%MD_TABS.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=MD_TABS.length-1;
  if(n===null)return;e.preventDefault();mdSetTab(MD_TABS[n],true);
 });
 document.addEventListener('keydown',e=>{
  if(!MD.open)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();mdClose();return}
  if(e.key!=='Tab')return;
  const f=[...dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null&&getComputedStyle(x).visibility!=='hidden');
  if(!f.length){e.preventDefault();dlg.focus();return}
  const first=f[0],last=f[f.length-1],ac=document.activeElement,inside=dlg.contains(ac)&&ac!==dlg;
  if(e.shiftKey&&(!inside||ac===first)){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(!inside||ac===last)){e.preventDefault();first.focus()}
 },true);
})();
