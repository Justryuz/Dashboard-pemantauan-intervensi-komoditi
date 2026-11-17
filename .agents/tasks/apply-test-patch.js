const fs=require('fs');
const F=__dirname+'/intervensi-test.js';
let L=fs.readFileSync(F,'utf8').replace(/\r\n/g,'\n').split('\n');
const die=m=>{console.error('GAGAL',m);process.exit(1)};
const chk=(n,s)=>{if(!L[n-1].includes(s))die('baris '+n+' tidak mengandungi '+s+' :: '+L[n-1].slice(0,80))};
const ins=(after,text)=>{L.splice(after,0,...text.split('\n'))};            // selepas baris 'after' (1-indeks)
const rep=(a,b,text)=>{L.splice(a-1,b-a+1,...text.split('\n'))};

/* ---- 15 tema: pop-up (edit paling bawah dahulu) ---- */
chk(513,"tiada ralat halaman semasa kitaran");
ins(513,String.raw`     {
      await pg.evaluate(()=>window.scrollTo(0,0));
      const vp=await pg.evaluate(()=>({w:innerWidth,h:innerHeight}));
      const arg=await openCase1(pg);
      ok('15 '+theme+' '+w+' pop-up dibuka daripada Tindakan',!!arg&&await pg.evaluate(()=>!document.getElementById('ivMd').hidden),arg);
      await kon('pop-up Mobilisasi');await ovf('pop-up Mobilisasi');
      if(theme!=='base')await pg.screenshot({path:path.join(T,'intervensi-popup-'+theme+'-'+w+'-mobilisasi.png'),clip:{x:0,y:0,width:vp.w,height:vp.h}});
      await pg.click('#ivMdTabMar');await sleep(500);
      await kon('pop-up Margin');await ovf('pop-up Margin');
      if(theme!=='base')await pg.screenshot({path:path.join(T,'intervensi-popup-'+theme+'-'+w+'-margin.png'),clip:{x:0,y:0,width:vp.w,height:vp.h}});
      await pg.keyboard.press('Escape');await sleep(400);
      await pg.evaluate(()=>window.scrollTo(0,0));
      if(theme!=='base')await pg.screenshot({path:path.join(T,'intervensi-popup-'+theme+'-'+w+'-tutup.png'),clip:{x:0,y:0,width:vp.w,height:vp.h}});
     }`);

/* ---- 12 reka letak: gantikan blok Mob/Mar sebelah menyebelah ---- */
chk(388,"const a=R('ivMobPanel'),b=R('ivMarPanel');");
chk(403,"gridmid.png");
rep(388,403,String.raw`   {const arg=await openCase1(pr);
    ok('M '+w+' Tindakan Case 1 membuka pop-up',!!arg&&await pr.evaluate(()=>!document.getElementById('ivMd').hidden),arg);
    const g=await pr.evaluate(()=>{const b=document.getElementById('ivMd'),d=document.getElementById('ivMdDlg'),body=document.getElementById('ivMdBody'),r=d.getBoundingClientRect();
     const A=document.getElementById('ivListDalam'),B=document.getElementById('ivListLuar');const a=A?A.getBoundingClientRect():null,c=B?B.getBoundingClientRect():null;
     const ovf=[];document.getElementById('ivMobPanel').querySelectorAll('.iv-card,.iv-calc,.iv-cand,.iv-ctl,.iv-ai,.iv-kv,.iv-stat').forEach(e=>{if(e.scrollWidth>e.clientWidth+1)ovf.push(e.className+' '+e.scrollWidth+'>'+e.clientWidth)});
     return {open:!b.hidden,l:r.left,r:r.right,t:r.top,bt:r.bottom,w:r.width,iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,dsw:d.scrollWidth,dcw:d.clientWidth,bsw:body.scrollWidth,bcw:body.clientWidth,ovf,a:a&&{l:a.left,r:a.right,t:a.top,b:a.bottom},c:c&&{l:c.left,r:c.right,t:c.top}}});
    ok('M '+w+' pop-up muat dalam paparan',g.open&&g.l>=-.5&&g.r<=g.iw+.5&&g.t>=-.5&&g.bt<=g.ih+.5,g);
    ok('M '+w+' tiada limpahan mendatar (halaman, dialog, badan)',g.sw<=g.iw+1&&g.dsw<=g.dcw+1&&g.bsw<=g.bcw+1,g);
    ok('M '+w+' tiada limpahan anak (tab Mobilisasi)',g.ovf.length===0,g.ovf);
    if(w>=1100)ok('M '+w+' Top 5 Dalam/Luar Negeri sebelah menyebelah',!!g.a&&!!g.c&&Math.abs(g.a.t-g.c.t)<=3&&g.a.r<=g.c.l+2,g);
    else if(w<900)ok('M '+w+' Top 5 disusun menegak',!!g.a&&!!g.c&&g.c.t>=g.a.b-2,g);
    await pr.click('#ivMdTabMar');await sleep(500);
    const m=await pr.evaluate(()=>{const R=id=>{const e=document.getElementById(id);return e?e.getBoundingClientRect():null};const d=document.getElementById('ivMdDlg'),body=document.getElementById('ivMdBody');
     const st=[...document.querySelectorAll('#ivMarSummary .iv-stat')].map(e=>Math.round(e.getBoundingClientRect().top));const f=R('ivCardFarm'),s=R('ivCardSell');
     const ovf=[];document.getElementById('ivMarPanel').querySelectorAll('.iv-card,.iv-res-g,.iv-res-c,.iv-ctl,.iv-ai,.iv-kv,.iv-stat,.iv-in').forEach(e=>{if(e.scrollWidth>e.clientWidth+1)ovf.push(e.className+' '+e.scrollWidth+'>'+e.clientWidth)});
     return {sw:document.documentElement.scrollWidth,iw:innerWidth,dsw:d.scrollWidth,dcw:d.clientWidth,bsw:body.scrollWidth,bcw:body.clientWidth,st,f:f&&{l:f.left,r:f.right,t:f.top,b:f.bottom},s:s&&{l:s.left,r:s.right,t:s.top},ovf}});
    ok('M '+w+' tab Margin tiada limpahan mendatar',m.sw<=m.iw+1&&m.dsw<=m.dcw+1&&m.bsw<=m.bcw+1&&m.ovf.length===0,m);
    if(w>=1100){ok('M '+w+' Margin: KPI 4 lajur satu baris',m.st.length===4&&new Set(m.st).size===1,m);ok('M '+w+' Margin: dua kad hasil sebelah menyebelah',!!m.f&&!!m.s&&Math.abs(m.f.t-m.s.t)<=3&&m.f.r<=m.s.l+2,m)}
    else if(w<900)ok('M '+w+' Margin: kad hasil menegak',!!m.f&&!!m.s&&m.s.t>=m.f.b-2,m);
    await pr.keyboard.press('Escape');await sleep(400);}
   {const L=await pr.evaluate(()=>{const g=document.querySelector('.iv-grid-top').getBoundingClientRect(),c=document.getElementById('ivMusePanel').getBoundingClientRect(),v=document.getElementById('viewIntervensi').getBoundingClientRect();
     const ovf=[];document.getElementById('ivMusePanel').querySelectorAll('.iv-pbody,.iv-card,.iv-muse-card,.iv-mu-bar,.iv-kv,.iv-stat').forEach(e=>{if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowY!=='auto')ovf.push(e.className)});
     return {gap:c.top-g.bottom,cw:c.width,vw:v.width,sw:document.documentElement.scrollWidth,iw:innerWidth,ovf,old:!!document.querySelector('.iv-grid-mid')}});
    ok('L '+w+' tiada limpahan mendatar halaman',L.sw<=L.iw+1,L);
    ok('L '+w+' AI Muse lebar penuh dan tepat di bawah grid atas (tiada jurang besar)',Math.abs(L.cw-L.vw)<=4&&L.gap>=0&&L.gap<=30&&!L.old,L);
    ok('L '+w+' anak Muse tidak melimpah',L.ovf.length===0,L.ovf);}`);

/* ---- 9 Muse: hantar konteks membuka pop-up ---- */
chk(300,"9 pindah konteks M02");
ins(300,String.raw`  ok('9 hantar konteks membuka pop-up pada tab Mobilisasi',await ev(()=>!document.getElementById('ivMd').hidden&&document.getElementById('ivMdTabMob').getAttribute('aria-selected')==='true'&&/Simpang Renggam/.test(document.getElementById('ivMdCtx').innerText)));
  await closeMd();`);

/* ---- 8 margin: jalankan dalam pop-up (tab Margin) ---- */
chk(283,"// 9 muse");
ins(282,"  await closeMd();");
chk(254,"// 8 margin");
ins(255,String.raw`  await openCase1();await pg.click('#ivMdTabMar');await sleep(500);
  ok('8 tab Margin dalam pop-up: kawalan dan hasil kelihatan',await ev(()=>{const v=id=>{const e=document.getElementById(id);return !!e&&e.offsetParent!==null};return v('ivMJual')&&v('ivMBeli')&&v('ivMLadang')&&v('ivMKos')&&v('ivMTarget')&&v('ivMarSummary')&&v('ivCardFarm')&&v('ivCardSell')}));`);

/* ---- 7c: Tindakan membuka pop-up; tutup ---- */
chk(247,"pasir-mas:bawang-merah-kecil");
ins(247,"  ok('7c Tindakan Pasir Mas membuka pop-up',await ev(()=>!document.getElementById('ivMd').hidden&&/Bawang Merah Kecil/.test(document.getElementById('ivMdCtx').innerText)&&/Pengguna/.test(document.getElementById('ivMdCtx').innerText)));\n  await closeMd();");

/* ---- 6 Tindakan + blok pop-up ---- */
chk(186,"6 Tindakan baris kuning");
ins(186,String.raw`  await closeMd();
  // ===== Pop-up Mobilisasi & Margin =====
  {
   const arg=await openCase1();
   ok('P2 baris Tindakan Simpang Renggam / Cili Merah / pengeluar wujud',!!arg,arg);
   const S=await ev(()=>{const b=document.getElementById('ivMd'),d=document.getElementById('ivMdDlg'),cs=getComputedStyle(b),br=b.getBoundingClientRect(),vis=e=>!!e&&e.offsetParent!==null;
    const pts=[[innerWidth/2,innerHeight/2],[40,40],[innerWidth-30,innerHeight-30],[innerWidth/2,8],[60,innerHeight/2]];
    return {hidden:b.hidden,vis:cs.visibility,op:cs.opacity,role:d.getAttribute('role'),am:d.getAttribute('aria-modal'),lt:(document.getElementById(d.getAttribute('aria-labelledby'))||{}).textContent,
     tabMob:document.getElementById('ivMdTabMob').getAttribute('aria-selected'),mobVis:vis(document.getElementById('ivMobPanel')),marHidden:document.getElementById('ivMarPanel').hidden,
     dal:document.querySelectorAll('#ivListDalam .iv-cand').length,luar:document.querySelectorAll('#ivListLuar .iv-cand').length,listVis:vis(document.getElementById('ivListDalam'))&&vis(document.getElementById('ivListLuar')),
     ctx:document.getElementById('ivMdCtx').innerText,bf:cs.backdropFilter||cs.webkitBackdropFilter,bg:cs.backgroundColor,pos:cs.position,z:cs.zIndex,br:{x:br.x,y:br.y,w:br.width,h:br.height},iw:innerWidth,ih:innerHeight,
     bodyOv:getComputedStyle(document.body).overflow,cover:pts.every(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&b.contains(e)}),actIn:d.contains(document.activeElement),act:document.activeElement.id,
     dlgW:d.getBoundingClientRect().width}});
   ok('P2 Tindakan membuka pop-up (role=dialog, aria-modal, aria-labelledby, kelihatan)',!S.hidden&&S.vis==='visible'&&+S.op===1&&S.role==='dialog'&&S.am==='true'&&/Mobilisasi/.test(S.lt||'')&&S.dlgW>300,S);
   ok('P2 tab Mobilisasi aktif secara lalai dengan Top 5 (1 dalam, 2 luar) kelihatan',S.tabMob==='true'&&S.mobVis&&S.marHidden&&S.dal===1&&S.luar===2&&S.listVis,S);
   ok('P2 konteks pada pengepala (PO, komoditi, mod)',/Simpang Renggam/.test(S.ctx)&&/Cili Merah/.test(S.ctx)&&/Pengeluar/.test(S.ctx),S.ctx);
   ok('P2 latar belakang kabur: backdrop-filter blur dan lapisan malap',/blur\((6|7|8)px\)/.test(S.bf)&&S.bg==='rgba(5, 12, 28, 0.55)',[S.bf,S.bg]);
   ok('P2 latar menutup seluruh viewport dan berada di atas peta/pengepala',S.pos==='fixed'&&S.br.x===0&&S.br.y===0&&Math.abs(S.br.w-S.iw)<=1&&Math.abs(S.br.h-S.ih)<=1&&S.cover&&+S.z>=1000,S);
   ok('P2 skrol halaman dikunci semasa pop-up dibuka',S.bodyOv==='hidden',S.bodyOv);
   ok('P2 fokus dipindahkan ke dalam dialog',S.actIn,S.act);
   let trap=true,tbad=null;
   for(let i=0;i<40;i++){await pg.keyboard.press('Tab');const o=await ev(()=>({i:document.getElementById('ivMdDlg').contains(document.activeElement),t:document.activeElement.tagName+'#'+document.activeElement.id}));if(!o.i){trap=false;tbad=o.t}}
   for(let i=0;i<8;i++){await pg.keyboard.down('Shift');await pg.keyboard.press('Tab');await pg.keyboard.up('Shift');const o=await ev(()=>({i:document.getElementById('ivMdDlg').contains(document.activeElement),t:document.activeElement.tagName+'#'+document.activeElement.id}));if(!o.i){trap=false;tbad=o.t}}
   ok('P2 perangkap fokus (Tab / Shift+Tab kekal dalam dialog)',trap,tbad);
   // tab Margin
   await pg.click('#ivMdTabMar');await sleep(500);
   const M=await ev(()=>{const v=id=>{const e=document.getElementById(id);return !!e&&e.offsetParent!==null};return {sel:document.getElementById('ivMdTabMar').getAttribute('aria-selected'),selMob:document.getElementById('ivMdTabMob').getAttribute('aria-selected'),ctl:v('ivMJual')&&v('ivMBeli')&&v('ivMLadang')&&v('ivMKos')&&v('ivMTarget'),res:v('ivMarSummary')&&v('ivCardFarm')&&v('ivCardSell'),mobHidden:document.getElementById('ivMobPanel').hidden,txt:document.getElementById('ivMarRes').innerText,pr:document.getElementById('ivMdTabMar').getAttribute('role')}});
   ok('P3 tab Margin: kawalan dan hasil kelihatan, Mobilisasi tersembunyi',M.sel==='true'&&M.selMob==='false'&&M.ctl&&M.res&&M.mobHidden&&/Margin Operasi/.test(M.txt)&&M.pr==='tab',M);
   ok('P3 tab dalam tablist/tabpanel dengan aria-controls',await ev(()=>{const t=document.querySelector('#ivMd [role=tablist]');return !!t&&t.querySelectorAll('[role=tab]').length===2&&document.getElementById('ivMdTabMar').getAttribute('aria-controls')==='ivMarPanel'&&document.getElementById('ivMarPanel').getAttribute('role')==='tabpanel'&&document.getElementById('ivMarPanel').getAttribute('aria-labelledby')==='ivMdTabMar'}));
   await pg.focus('#ivMdTabMar');await pg.keyboard.press('ArrowLeft');await sleep(150);
   const k1=await ev(()=>({m:document.getElementById('ivMdTabMob').getAttribute('aria-selected'),f:document.activeElement.id}));
   await pg.keyboard.press('ArrowRight');await sleep(150);
   const k2=await ev(()=>({m:document.getElementById('ivMdTabMar').getAttribute('aria-selected'),f:document.activeElement.id}));
   ok('P3 navigasi anak panah antara tab',k1.m==='true'&&k1.f==='ivMdTabMob'&&k2.m==='true'&&k2.f==='ivMdTabMar',[k1,k2]);
   // Esc
   await pg.keyboard.press('Escape');await sleep(400);
   const sel=CASE1;
   const E1=await ev(sel=>({hidden:document.getElementById('ivMd').hidden,bo:getComputedStyle(document.body).overflow,onBtn:document.activeElement.matches('#ivPriList '+sel)||document.activeElement.matches(sel)}),sel);
   ok('P4 Esc menutup pop-up, skrol dipulihkan, fokus kembali ke butang Tindakan',E1.hidden&&E1.bo!=='hidden'&&E1.onBtn,E1);
   // butang banner
   await pg.click('#ivPriBanner [data-iv-act=openMob]');await sleep(500);
   ok('P5 butang banner "Buka Mobilisasi Stok" membuka pop-up',await ev(()=>!document.getElementById('ivMd').hidden&&document.getElementById('ivMdTabMob').getAttribute('aria-selected')==='true'));
   await pg.keyboard.press('Escape');await sleep(400);
   ok('P5 label banner tanpa "Paparan N"',await ev(()=>/Buka Mobilisasi Stok/.test(document.getElementById('ivPriBanner').innerText)&&!/Paparan \d|Lompat/.test(document.getElementById('ivPriBanner').innerText)));
   ok('P5 tiada rujukan "Paparan N" dalam tab Intervensi',await ev(()=>{const c=document.getElementById('viewIntervensi').cloneNode(true);const f=c.querySelector('footer');if(f)f.remove();return !/Paparan \d/.test(c.textContent)}));
   // klik latar
   await openCase1();await pg.mouse.click(6,6);await sleep(400);
   const E2=await ev(()=>({hidden:document.getElementById('ivMd').hidden,bo:getComputedStyle(document.body).overflow,act:document.activeElement.dataset.ivAct}));
   ok('P6 klik latar menutup pop-up dan fokus kembali ke Tindakan',E2.hidden&&E2.bo!=='hidden'&&E2.act==='tindakan',E2);
   // klik dalam dialog tidak menutup
   await openCase1();await pg.click('#ivMdDlg .iv-md-hd h2');await sleep(300);
   ok('P6 klik di dalam dialog tidak menutup',await ev(()=>!document.getElementById('ivMd').hidden));
   // butang X
   ok('P7 butang tutup aria-label="Tutup"',await ev(()=>document.getElementById('ivMdClose').getAttribute('aria-label')==='Tutup'));
   await pg.click('#ivMdClose');await sleep(400);
   const E3=await ev(()=>({hidden:document.getElementById('ivMd').hidden,bo:getComputedStyle(document.body).overflow,act:document.activeElement.dataset.ivAct}));
   ok('P7 butang X menutup pop-up dan fokus kembali ke Tindakan',E3.hidden&&E3.bo!=='hidden'&&E3.act==='tindakan',E3);
   // pilih PO pada peta / penapis tidak membuka pop-up
   await ev(()=>{const m=document.querySelector('#ivMap .po-marker');if(m)m.click();IV_TEST.dispatch('selectPO','kedah');IV_TEST.dispatch('setFilter',['komoditi','cili-hijau'])});await sleep(600);
   ok('P8 memilih PO pada peta / penapis tidak membuka pop-up',await ev(()=>document.getElementById('ivMd').hidden&&getComputedStyle(document.body).overflow!=='hidden'));
   // kekal dalam DOM, tiada ID pendua
   ok('P9 tiada ID pendua dan panel Mobilisasi/Margin berada dalam pop-up',await ev(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size&&!!document.getElementById('ivMobPanel').closest('#ivMd')&&!!document.getElementById('ivMarPanel').closest('#ivMd')&&!document.querySelector('.iv-grid-mid')}));
  }
  await ev(()=>IV_TEST.dispatch('resetFilters'));await sleep(300);`);

/* ---- keadaan awal sebelum Tindakan pertama ---- */
chk(181,"window.scrollTo(0,0)");
ins(181,String.raw`  ok('P1 pop-up tersembunyi pada mulanya',await ev(()=>{const b=document.getElementById('ivMd');return b.hidden&&getComputedStyle(b).display==='none'&&getComputedStyle(document.body).overflow!=='hidden'}));
  ok('P1 AI Muse tepat di bawah grid atas, tanpa jurang besar',await ev(()=>{const g=document.querySelector('.iv-grid-top').getBoundingClientRect(),m=document.getElementById('ivMusePanel').getBoundingClientRect();const gap=m.top-g.bottom;return gap>=0&&gap<=30}));`);
/* ---- pembantu ---- */
chk(42,"const shot=");
ins(42,String.raw`  const closeMd=async(p)=>{p=p||pg;await p.keyboard.press('Escape');await sleep(400)};
  const CASE1='[data-iv-act=tindakan][data-iv-arg^="pengeluar:simpangrenggam:"][data-iv-arg$=":cili-merah"]';
  async function openCase1(p){
   p=p||pg;
   await p.evaluate(()=>{IV_TEST.dispatch('resetFilters')});await sleep(400);
   await p.evaluate(sel=>{if(!document.querySelector('#ivPriList '+sel)){const b=document.querySelector('[data-iv-act=showAll]');if(b)b.click()}},CASE1);await sleep(300);
   const h=await p.$('#ivPriList '+CASE1);if(!h)return null;
   const arg=await h.evaluate(e=>e.dataset.ivArg);
   await h.evaluate(e=>e.scrollIntoView({block:'center'}));await sleep(200);
   await h.click();await sleep(1000);return arg;
  }`);
fs.writeFileSync(F,L.join('\n'));
console.log('OK');

