(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SOURCE_KEY='joon_actor_structure_v023',QUEUE_KEY='joon_actor_dialogue_queue_v024';
let queue=[],selection=0,playing=false,utter=null;
const el={
 status:$('queueStatus'),list:$('queueList'),role:$('queueMyRole'),dialogue:$('queueDialogue'),
 scene:$('queueScene'),kind:$('queueKind'),verified:$('queueVerified'),source:$('queueSource'),
 preview:$('queueCurrent'),play:$('queuePlay'),stop:$('queueStop')
};
const types={dialogue:'대사',action:'지문',scene:'장면',page:'페이지',unreadable:'미판독'};
function normalize(x){return String(x??'').trim();}
function save(){
 try{localStorage.setItem(QUEUE_KEY,JSON.stringify({version:1,queue,selected:selection,updatedAt:new Date().toISOString()}));return true}
 catch(e){say('저장 실패: '+e.message);return false}
}
function say(s){el.status.textContent=s}
function makeFromAnalysis(){
 let data;
 try{data=JSON.parse(localStorage.getItem(SOURCE_KEY)||'null')}catch(e){}
 if(!data?.blocks?.length){say('먼저 위에서 대본 구조 분석을 실행해 줘.');return}
 if(queue.length&&!confirm('현재 교정·검증된 대사 목록을 새 분석 결과로 교체할까? 먼저 JSON 백업을 권장해.'))return;
 queue=data.blocks.filter(b=>['dialogue','action','scene','unreadable'].includes(b.type)).map((b,i)=>({
  id:i+1,sourceLine:b.line||0,type:b.type,scene:normalize(b.scene),speaker:normalize(b.speaker),
  text:normalize(b.text),verified:false
 }));
 selection=0;save();render();say(queue.length+'개 항목을 불러왔어. 모든 항목은 검증 전 상태야.');
}
function persistEditor(){
 const q=queue[selection];if(!q)return;
 q.type=el.kind.value;q.speaker=normalize(el.role.value);q.scene=normalize(el.scene.value);
 q.text=el.dialogue.value;q.verified=el.verified.checked;
 save();
}
function render(){
 el.list.replaceChildren();
 const count=queue.length,valid=queue.filter(q=>q.verified).length,
 validDialogue=queue.filter(q=>q.verified&&q.type==='dialogue'&&q.speaker&&q.text.trim()).length;
 say('총 '+count+'개 · 검증 완료 '+valid+'개 · 리딩 가능 대사 '+validDialogue+'개');
 if(!count){el.preview.textContent='아직 분석 대사 목록이 없어.';return}
 selection=Math.max(0,Math.min(selection,count-1));
 for(const [i,q] of queue.entries()){
  const b=document.createElement('button');b.type='button';
  b.className='queueItem'+(i===selection?' selected':'');
  b.textContent=(i+1)+'. '+(q.verified?'✓ ':'미검증 · ')+(types[q.type]||q.type)+
    (q.speaker?' · '+q.speaker:'')+' — '+q.text.slice(0,46).replace(/\n/g,' ');
  b.onclick=()=>{persistEditor();selection=i;render()};
  el.list.appendChild(b);
 }
 const q=queue[selection];
 el.kind.value=q.type;el.role.value=q.speaker;el.scene.value=q.scene;
 el.dialogue.value=q.text;el.source.textContent='분석 원본 '+q.sourceLine+'행 · 순서 '+(selection+1)+' / '+count;
 el.verified.checked=q.verified;
 renderPreview();
}
function renderPreview(){
 const role=normalize($('queueActor').value);
 const valid=queue.filter(q=>q.verified&&q.type==='dialogue'&&q.speaker&&q.text.trim());
 const voices=[...new Set(valid.map(q=>q.speaker))];
 const previous=$('queueActor').value;
 $('queueActor').replaceChildren(new Option('내 배역 선택',''));
 for(const person of voices)$('queueActor').add(new Option(person,person));
 $('queueActor').value=voices.includes(role)?role:(voices.includes(previous)?previous:'');
 const current=valid[0];
 el.preview.textContent=valid.length?'검증된 대사 '+valid.length+'개. 내 배역을 선택한 다음 상대역 미리듣기를 실행할 수 있어.':'검증된 대사가 없어. 대사별로 원문을 확인하고 검증 표시해 줘.';
}
$('queueBuild').onclick=makeFromAnalysis;
$('queueSave').onclick=()=>{
 if(!queue.length){say('저장할 항목이 없어.');return}
 persistEditor();render();say('현재 항목 변경과 검증 상태 저장 완료');
};
$('queueNext').onclick=()=>{if(!queue.length)return;persistEditor();selection=Math.min(queue.length-1,selection+1);render()};
$('queuePrev').onclick=()=>{if(!queue.length)return;persistEditor();selection=Math.max(0,selection-1);render()};
$('queueExport').onclick=()=>{
 if(!queue.length){say('내보낼 항목이 없어.');return}
 persistEditor();
 const data={format:'joon-actor-dialogue-sequence',version:1,exportedAt:new Date().toISOString(),
  source:'locally reviewed text',queue,verifiedCount:queue.filter(q=>q.verified).length};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='JOON_ACTOR_검증대사_순서.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('queueImport').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=='joon-actor-dialogue-sequence'||!Array.isArray(data.queue))throw Error('대사 순서 백업 JSON이 아니야.');
  if(queue.length&&!confirm('현재 대사 목록을 백업 파일로 교체할까?'))return;
  if(data.queue.length>20000)throw Error('파일 항목 수가 너무 많아.');
  queue=data.queue.map((q,i)=>({id:i+1,sourceLine:Number(q.sourceLine)||0,
   type:['dialogue','action','scene','unreadable'].includes(q.type)?q.type:'action',
   scene:normalize(q.scene),speaker:normalize(q.speaker),text:String(q.text||''),verified:q.verified===true}));
  selection=0;save();render();
 }catch(err){say('백업 복원 실패: '+err.message)}finally{e.target.value=''}
};
function cancelSpeech(){playing=false;if('speechSynthesis'in window)speechSynthesis.cancel();el.stop.disabled=true;el.play.disabled=false;}
$('queueStop').onclick=cancelSpeech;
$('queuePlay').onclick=()=>{
 if(playing)return;
 persistEditor();
 const actor=$('queueActor').value;
 if(!actor){say('먼저 내 배역을 선택해 줘.');return}
 const dialogue=queue.filter(q=>q.verified&&q.type==='dialogue'&&q.speaker&&q.text.trim());
 if(!dialogue.length){say('검증된 대사가 없어.');return}
 if(!('speechSynthesis'in window)){say('이 기기에서는 음성 재생을 지원하지 않아.');return}
 cancelSpeech();playing=true;el.stop.disabled=false;el.play.disabled=true;
 let i=0;
 function advance(){
  if(!playing)return;
  while(i<dialogue.length&&dialogue[i].speaker===actor)i++;
  if(i>=dialogue.length){cancelSpeech();say('검증된 상대역 대사 미리듣기 종료');return}
  const q=dialogue[i++];
  el.preview.textContent='상대역 '+q.speaker+': '+q.text;
  const u=new SpeechSynthesisUtterance(q.text);u.lang='ko-KR';u.rate=1;
  u.onend=advance;u.onerror=()=>{cancelSpeech();say('음성 재생 오류. 다시 시도해 줘.')};
  utter=u;speechSynthesis.speak(u);
 }
 say('검증된 상대역 대사만 순서대로 읽어. 내 대사는 건너뛰고 지문은 음성으로 읽지 않아.');
 advance();
};
$('queueActor').onchange=renderPreview;
try{
 const data=JSON.parse(localStorage.getItem(QUEUE_KEY)||'null');
 if(data?.queue?.length){queue=data.queue;selection=data.selected||0;render()}
}catch(e){say('이전 데이터 복원 오류: '+e.message)}
})();