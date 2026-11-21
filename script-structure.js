(() => {
'use strict';
const $=id=>document.getElementById(id), storageKey='joon_actor_structure_v023';
let analysis=null;
function normalize(x){return x.normalize('NFC').trim()}
function isScene(s){return /^(?:S\s*[#＃]\s*\d+|SCENE\s*\d+|씬\s*\d+)(?:\b|[\s.·\/\-]|$)/i.test(s)}
function suspicious(s){return /(?:\b(?:BARA|BARD|BANE|BAB|FAW|doz|QUE)\b|9\s*#\s*\d+|[가-힣]\s+(?:of|WOW)\b)/i.test(s)}
function speakerValid(s){
 const t=normalize(s).replace(/\s*\([oe0-9]+\)$/i,'');
 return (t.length<=13&&/^[가-힣]{2,10}(?:[A-Z가-힣0-9])?$/.test(t)) || /^(?:MC|PD|홍PD|송PD|장PD)(?:\s*\([a-z]\))?$/i.test(t);
}
function classify(raw){
 const rows=raw.split(/\r?\n/), blocks=[], people=new Map(), issues=[];
 let currentScene='장면 미지정', last=null;
 const add=(type,data,line)=>{
   const block={type,line:line+1,scene:currentScene,confidence:type==='dialogue'?'candidate':'review',...data};
   blocks.push(block);last=block;
   if(type==='dialogue')people.set(block.speaker,(people.get(block.speaker)||0)+1);
   if(suspicious(data.text||'')||suspicious(data.speaker||''))issues.push({line:line+1,reason:'OCR 오인식 의심',original:rows[line]});
   return block;
 };
 for(let i=0;i<rows.length;i++){
   const s=normalize(rows[i]);if(!s)continue;
   if(/^===\s*\d+\s*페이지\s*===/.test(s)){add('page',{text:s},i);continue}
   if(isScene(s)){currentScene=s;add('scene',{text:s},i);continue}
   if(/^\[문자 없음/.test(s)){add('unreadable',{text:s},i);issues.push({line:i+1,reason:'문자 미추출',original:s});continue}
   // A colon or tab is a stronger sign of explicit speaker attribution than spacing.
   let m=s.match(/^([^:：\t]{2,15})\s*[:：\t]\s*(.+)$/);
   if(m&&speakerValid(m[1])){add('dialogue',{speaker:normalize(m[1]),text:m[2]},i);continue}
   // Script layout where role is in a left column and dialogue starts at a larger gap.
   m=rows[i].match(/^\s*([가-힣A-Za-z0-9() ]{2,15})\s{3,}(.+)$/);
   if(m&&speakerValid(m[1])){add('dialogue',{speaker:normalize(m[1]),text:normalize(m[2])},i);continue}
   // A standalone role name followed by an utterance is still only a candidate.
   if(speakerValid(s)&&i+1<rows.length&&normalize(rows[i+1])){
     const next=normalize(rows[i+1]);if(!isScene(next)&&next.length>2){add('dialogue',{speaker:s,text:next},i);i++;continue}
   }
   // Wrapped dialogue: only when previous line is a dialogue and not a distinct action sentence.
   if(last?.type==='dialogue'&&s.length>1&&!/^[-•]/.test(s)&&!/(?:들어온다|나간다|바라본다|화면|카메라|스튜디오|걸어간다)\.$/.test(s)){
     last.text+='\n'+s;
     if(suspicious(s))issues.push({line:i+1,reason:'OCR 오인식 의심',original:s});
     continue;
   }
   add('action',{text:s},i);
 }
 return {version:1,source:'user-reviewed import',generatedAt:new Date().toISOString(),blocks,
   people:[...people].sort((a,b)=>b[1]-a[1]).map(([name,lines])=>({name,lines})),issues,
   stats:{scenes:blocks.filter(b=>b.type==='scene').length,dialogue:blocks.filter(b=>b.type==='dialogue').length,action:blocks.filter(b=>b.type==='action').length,uncertain:issues.length}};
}
function display(){
 const status=$('structureStatus'),list=$('structurePreview');if(!analysis)return;
 const n=analysis.stats;
 status.textContent='장면 '+n.scenes+'개 · 대사 후보 '+n.dialogue+'개 · 기타/지문 후보 '+n.action+'개 · 확인 필요 '+n.uncertain+'건';
 list.replaceChildren();
 for(const b of analysis.blocks.slice(0,60)){
   const line=document.createElement('div');line.style.cssText='padding:9px 0;border-bottom:1px solid #e7ebf2;white-space:pre-wrap;word-break:break-word';
   const type={scene:'장면',dialogue:'대사 후보',action:'지문/기타',page:'페이지',unreadable:'미판독'}[b.type]||'확인';
   line.textContent='['+type+' · '+b.line+'행] '+(b.speaker?b.speaker+' : ':'')+b.text;list.appendChild(line);
 }
 if(analysis.blocks.length>60){const n=document.createElement('p');n.textContent='화면에는 앞의 60개만 표시돼. 전체 분석 결과는 JSON으로 저장할 수 있어.';list.append(n)}
}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(analysis));$('structureStatus').textContent+=' · 분석 임시 저장 완료'}catch(e){$('structureStatus').textContent='저장 실패: '+e.message}}
$('structureRun').onclick=()=>{
 const raw=$('script').value;
 if(!raw.trim()){$('structureStatus').textContent='먼저 HWPX/PDF에서 글자를 추출하거나 대본을 입력해 줘.';return}
 analysis=classify(raw);display();save();
};
$('structureExport').onclick=()=>{
 if(!analysis){$('structureStatus').textContent='분석부터 실행해 줘.';return}
 const b=new Blob([JSON.stringify(analysis,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='JOON_ACTOR_대본구조_검토용.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
try{const old=JSON.parse(localStorage.getItem(storageKey)||'null');if(old&&old.blocks){analysis=old;display()}}catch(e){}
})();