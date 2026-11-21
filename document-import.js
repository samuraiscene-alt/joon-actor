(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const KEY='joon_actor_import_v022';
  const note=(value,warning=false)=>{
    const el=byId('importStatus'); if(!el)return;
    el.textContent=value;el.style.color=warning?'#aa3c32':'#566171';
  };
  const loadScript=url=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=url;s.onload=resolve;
    s.onerror=()=>reject(new Error('외부 파서 파일을 가져오지 못했어. 인터넷 연결을 확인해 줘.'));
    document.head.appendChild(s);
  });
  const decodeXml = str => {
    const doc = new DOMParser().parseFromString(str,'application/xml');
    if(doc.querySelector('parsererror')) throw Error('HWPX XML 구문을 해석하지 못했어.');
    return doc;
  };
  const localName=e=>(e.localName||'').toLowerCase();
  const extractParagraph = p => {
    let out='';
    // paragraph의 본문에서 표시 가능한 문자 노드만 모은다. p 자체의 후손 p는 중복 방지.
    const walk=n=>{
      if(n.nodeType===1){
        const l=localName(n);
        if(n!==p && l==='p')return;
        if(l==='t'){out+=n.textContent||'';return;}
        if(l==='tab'){out+='\t';return;}
        if(l==='linebreak'||l==='br'){out+='\n';return;}
        if(['tbl','pic','ole','drawtext','equation'].includes(l))return;
      }
      for(const c of n.childNodes||[]) walk(c);
    };
    walk(p);
    return out;
  };
  function sectionLines(xml){
    const d=decodeXml(xml),texts=[];
    const walk=n=>{
      if(n.nodeType!==1)return;
      if(localName(n)==='p'){const text=extractParagraph(n);if(text.trim())texts.push(text);return;}
      for(const c of n.children)walk(c);
    };
    walk(d.documentElement);
    return texts;
  }
  async function readHwpx(file){
    if(!window.JSZip)await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip=await JSZip.loadAsync(file);
    const paths=Object.keys(zip.files).filter(n=>/^Contents\/section\d+\.xml$/i.test(n))
      .sort((a,b)=>Number(a.match(/section(\d+)/i)[1])-Number(b.match(/section(\d+)/i)[1]));
    if(!paths.length)throw Error('HWPX 본문 section.xml을 찾지 못했어.');
    let count=0,all=[];
    for(const path of paths){
      const xml=await zip.file(path).async('string');
      const lines=sectionLines(xml);count+=lines.length;all.push(...lines);
    }
    if(!all.join('').trim())throw Error('HWPX 안에서 텍스트를 찾지 못했어. 이미지 문서일 수 있어.');
    return {text:all.join('\n'),method:'HWPX 원문 추출',paragraphs:count};
  }
  async function readPdfText(file){
    if(!window.pdfjsLib)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const pages=[],scanned=[];
    try{
      for(let n=1;n<=pdf.numPages;n++){
        note(n+' / '+pdf.numPages+'페이지 원문 텍스트 추출 중...');
        const page=await pdf.getPage(n);
        const items=(await page.getTextContent()).items.filter(v=>typeof v.str==='string'&&v.str.trim());
        if(!items.length){scanned.push(n);pages.push('');continue;}
        // PDF 문자들의 좌표 기반 줄 복원. 좌측 배역명과 대사 순서 보존 목표.
        const rows=[];
        const sorted=items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5],w:x.width||0})).sort((a,b)=>b.y-a.y||a.x-b.x);
        for(const item of sorted){
          let row=rows.find(r=>Math.abs(r.y-item.y)<Math.max(2,3.8));
          if(!row){row={y:item.y,items:[]};rows.push(row)}
          row.items.push(item);
        }
        rows.sort((a,b)=>b.y-a.y);
        const lines=rows.map(row=>{
          row.items.sort((a,b)=>a.x-b.x);
          let text='',end=null;
          for(const x of row.items){
            if(end!==null&&x.x-end>Math.max(9,Math.abs(x.w)*0.32))text+='\t';
            text+=x.str;end=x.x+x.w;
          }
          return text.trimEnd();
        });
        const text=lines.join('\n');
        if(text.replace(/\s/g,'').length<30)scanned.push(n);
        pages.push(text);
      }
      return {pages,scanned,method:'PDF 문자 직접 추출'};
    } finally {await pdf.destroy();}
  }
  function store(data){
    try {localStorage.setItem(KEY,JSON.stringify(data));return true;}
    catch(e){note('브라우저 저장 공간 부족: 백업 파일부터 내려받아 줘.',true);return false;}
  }
  function applyText(txt,fileName,kind){
    const textarea=byId('script');
    if(!textarea)return;
    if(textarea.value.trim() && !confirm('현재 편집창의 내용을 교체할까? 기존 내용을 먼저 TXT 백업할 것을 권장해.')) return;
    textarea.value=txt;
    byId('title').value=fileName;
    textarea.dispatchEvent(new Event('input'));
    store({title:fileName,text:txt,type:kind,savedAt:new Date().toISOString()});
    note(kind+' 완료 · '+txt.length.toLocaleString()+'자 · 원본과 대조해 줘.');
  }
  const fileInput=byId('structuredImport');
  fileInput?.addEventListener('change',async event=>{
    const f=event.target.files?.[0];if(!f)return;
    try{
      const ext=f.name.split('.').pop().toLowerCase();
      if(ext==='hwp'){
        note('구형 HWP는 이 버전에서 직접 읽지 못해. 한글에서 HWPX로 저장한 뒤 다시 불러와 줘.',true);return;
      }
      note('원문 파일을 읽고 있어...');
      if(ext==='hwpx'){
        const r=await readHwpx(f);
        applyText(r.text,f.name,r.method);
        note(r.method+': '+r.paragraphs+'개 문단 · '+r.text.length.toLocaleString()+'자 (원본 확인 필요)');
      }else if(ext==='pdf'){
        const r=await readPdfText(f);
        const text=r.pages.map((p,i)=>'=== '+(i+1)+'페이지 ===\n'+(p||'[문자 없음 · 스캔 OCR 필요]')).join('\n\n');
        if(!r.pages.some(p=>p.replace(/\s/g,'').length>30)){
          note('이 PDF는 이미지형 문서야. 기존 아래의 PDF 불러오기 및 OCR 기능을 사용하거나 AI 판독 연결이 필요해.',true);
          return;
        }
        applyText(text,f.name,r.method);
        note('PDF 총 '+r.pages.length+'페이지 중 스캔/문자 부족 '+r.scanned.length+'페이지. 원문이 없는 페이지: '+(r.scanned.join(', ')||'없음'));
      }else note('지원 파일은 HWPX 또는 PDF야.',true);
    }catch(e){note('불러오기 실패: '+e.message,true)}
    finally{event.target.value=''}
  });
  byId('structuredRestore')?.addEventListener('click',()=>{
    try{
      const d=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!d){note('보관된 원문 추출 데이터가 없어.');return}
      applyText(d.text,d.title,d.type);
    }catch(e){note('복원 실패: '+e.message,true)}
  });
})();