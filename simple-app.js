(()=>{
'use strict';
const $=id=>document.getElementById(id),storeKey='joon_actor_simple_v030',legacyKey='joon_actor_local_v1';
let data={scripts:[],active:null},items=[],myRole='',mode='exact',stage='home',voiceRunning=false,voiceIndex=0;
function setStatus(s){$('simpleStatus').textContent=s}
function save(){try{localStorage.setItem(storeKey,JSON.stringify(data));return true}catch(e){setStatus('저장 공간 부족: 대본을 복사하여 백업해 줘.');return false}}
function load(){try{const x=JSON.parse(localStorage.getItem(storeKey)||'null');if(x?.scripts)data=x}catch(e){}}
function active(){return data.scripts.find(s=>s.id===data.active)||null}
const escapeHTML=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function scenesAndLines(text){
 const rows=text.split(/\r?\n/),out=[];let scene='';let last=null;
 for(const [index,raw] of rows.entries()){
  const t=raw.trim();if(!t)continue;
  if(/^(S\s*#\s*\d+|SCENE\s*\d+|씬\s*\d+)/i.test(t)){scene=t;out.push({type:'scene',speaker:'',text:t,scene,checked:false,line:index+1});last=null;continue}
  let m=t.match(/^([^:：]{1,20})\s*[:：]\s*(.+)$/);
  if(!m)m=raw.match(/^\s*([가-힣A-Za-z0-9() ]{2,18})\s{3,}(.+)$/);
  if(m&& /^[가-힣A-Za-z0-9()\s]{1,18}$/.test(m[1]) && m[1].trim().length<=18){
   last={type:'dialogue',speaker:m[1].trim(),text:m[2].trim(),scene,checked:false,line:index+1};
   out.push(last);continue;
  }
  if(last?.type==='dialogue'&&!/^[\-•]/.test(t)&&!/^(?:그때|한편|화면|카메라)/.test(t)){
   // 이어지는 줄로 볼 수 있으나 확신할 수 없으므로 자동 연결 대신 확인 대상
   out.push({type:'unknown',speaker:'',text:t,scene,checked:false,line:index+1});last=null;continue;
  }
  out.push({type:'action',speaker:'',text:t,scene,checked:false,line:index+1});last=null;
 }
 return out;
}
function view(to){
 stage=to;['home','editor','roles','practice','settings'].forEach(x=>{$('simple-'+x).hidden=x!==to});
 $('simpleBack').hidden=to==='home';$('simpleSettings').hidden=to==='settings';
 window.scrollTo({top:0,behavior:'instant'});
}
function renderLibrary(){
 const box=$('simpleLibrary');box.replaceChildren();
 if(!data.scripts.length){box.textContent='저장된 대본이 없어. 필요한 장면을 붙여넣어 시작해.';return}
 for(const s of data.scripts.slice().reverse()){
  const b=document.createElement('button');b.className='scriptTile';b.textContent=s.title+'  ·  '+s.text.length.toLocaleString()+'자';
  b.onclick=()=>{data.active=s.id;save();fillEditor();view('editor')};box.appendChild(b);
 }
}
function newScript(){
 const s={id:'s'+Date.now(),title:'새 대본',text:'',items:[],myRole:'',mode:'exact',updated:Date.now()};
 data.scripts.push(s);data.active=s.id;save();fillEditor();view('editor');
}
function fillEditor(){
 const s=active();if(!s)return; $('simpleTitle').value=s.title;$('simpleText').value=s.text;items=Array.isArray(s.items)?s.items.map(x=>({...x})):[];myRole=s.myRole||'';mode=s.mode||'exact';$('simpleMode').value=mode;
}
function persistEditor(){
 const s=active();if(!s)return false;
 s.title=$('simpleTitle').value.trim()||'새 대본';s.text=$('simpleText').value;s.items=items;s.myRole=myRole;s.mode=mode;s.updated=Date.now();
 const ok=save();
 // 이전 편집기에서 저장된 다른 작품이 지워지지 않게 별도 저장소를 사용한다.
 renderLibrary();return ok;
}
function drawItems(){
 const box=$('simpleLines');box.replaceChildren();
 items.forEach((o,i)=>{
  const wrap=document.createElement('div');wrap.className='lineCard';
  const head=document.createElement('div');head.className='lineHead';head.textContent=(i+1)+' · 원문 '+o.line+'행';
  const sel=document.createElement('select');[['dialogue','대사'],['action','지문'],['scene','장면'],['unknown','구분 안 됨']].forEach(([v,t])=>sel.add(new Option(t,v)));sel.value=o.type;
  const who=document.createElement('input');who.placeholder='배역 이름';who.value=o.speaker||'';who.hidden=o.type!=='dialogue';
  const txt=document.createElement('textarea');txt.value=o.text;txt.rows=2;
  const check=document.createElement('label');check.className='checkLabel';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!o.checked;check.append(cb,document.createTextNode(' 원문 확인 완료'));
  sel.onchange=()=>{o.type=sel.value;o.checked=false;who.hidden=o.type!=='dialogue';cb.checked=false;persistEditor();refreshRoles()};
  who.onchange=()=>{o.speaker=who.value.trim();o.checked=false;cb.checked=false;persistEditor();refreshRoles()};
  txt.onchange=()=>{o.text=txt.value;o.checked=false;cb.checked=false;persistEditor()};
  cb.onchange=()=>{if(cb.checked && (!o.text.trim()||(o.type==='dialogue'&&!o.speaker.trim()))){cb.checked=false;setStatus('대사와 배역 이름을 입력해야 검증할 수 있어.');return}o.checked=cb.checked;persistEditor();refreshRoles()};
  wrap.append(head,sel,who,txt,check);box.append(wrap);
 });
 refreshRoles();
}
function refreshRoles(){
 const roles=[...new Set(items.filter(x=>x.type==='dialogue'&&x.speaker).map(x=>x.speaker))];
 const sel=$('simpleRole');sel.replaceChildren(new Option('내 배역 선택',''));roles.forEach(r=>sel.add(new Option(r,r)));
 if(roles.includes(myRole))sel.value=myRole;
 const confirmed=items.filter(x=>x.type==='dialogue'&&x.checked&&x.speaker&&x.text.trim());
 $('simpleCount').textContent='대사 '+items.filter(x=>x.type==='dialogue').length+'개 · 확인된 대사 '+confirmed.length+'개';
 $('simpleRun').disabled=!(myRole&&confirmed.some(x=>x.speaker!==myRole));
}
function analyze(){
 if(!$('simpleText').value.trim()){setStatus('대본을 붙여넣어 줘.');return}
 items=scenesAndLines($('simpleText').value);persistEditor();drawItems();view('roles');
 setStatus('배역과 지문이 올바른지 확인하고 체크해 줘. 자동 분석은 확정 결과가 아니야.');
}
function stopVoice(){voiceRunning=false;if('speechSynthesis'in window)speechSynthesis.cancel();$('simpleStop').disabled=true}
function playPreview(){
 stopVoice();const verified=items.filter(x=>x.type==='dialogue'&&x.checked&&x.speaker&&x.text.trim());
 if(!myRole){setStatus('내 배역을 선택해 줘.');return}
 if(!verified.some(x=>x.speaker!==myRole)){setStatus('확인된 상대역 대사가 없어.');return}
 if(!('speechSynthesis'in window)){setStatus('음성 출력 미지원 브라우저야.');return}
 view('practice');voiceRunning=true;voiceIndex=0;$('simpleStop').disabled=false;
 const next=()=>{
  if(!voiceRunning)return;
  if(voiceIndex>=verified.length){stopVoice();$('simpleCurrent').textContent='미리듣기 종료';return}
  const line=verified[voiceIndex++];
  if(line.speaker===myRole){$('simpleCurrent').textContent='내 차례 · '+line.text;stopVoice();$('simpleContinue').hidden=false;return}
  $('simpleCurrent').textContent=line.speaker+' · '+line.text;
  const u=new SpeechSynthesisUtterance(line.text);u.lang='ko-KR';u.rate=1;
  u.onend=next;u.onerror=()=>{stopVoice();setStatus('음성 재생 실패')};
  speechSynthesis.speak(u);
 };
 $('simpleContinue').hidden=true;next();
}
$('simpleContinue').onclick=()=>{
 const verified=items.filter(x=>x.type==='dialogue'&&x.checked&&x.speaker&&x.text.trim());
 $('simpleContinue').hidden=true;
 if(voiceIndex>=verified.length){$('simpleCurrent').textContent='끝';return}
 // 다음 상대역 재생. 수동 진행이며 마이크 인식 기능은 아직 아니다.
 voiceRunning=true;$('simpleStop').disabled=false;
 const next=()=>{
  if(!voiceRunning)return;
  if(voiceIndex>=verified.length){stopVoice();$('simpleCurrent').textContent='미리듣기 종료';return}
  const line=verified[voiceIndex++];
  if(line.speaker===myRole){stopVoice();$('simpleCurrent').textContent='내 차례 · '+line.text;$('simpleContinue').hidden=false;return}
  $('simpleCurrent').textContent=line.speaker+' · '+line.text;
  const u=new SpeechSynthesisUtterance(line.text);u.lang='ko-KR';u.onend=next;u.onerror=()=>stopVoice();speechSynthesis.speak(u);
 };next();
};
$('simpleNew').onclick=newScript;
$('simpleSave').onclick=()=>{persistEditor();setStatus('이 기기에 저장했어.')};
$('simpleAnalyze').onclick=analyze;
$('simpleBack').onclick=()=>{stopVoice();if(stage==='practice')view('roles');else if(stage==='roles')view('editor');else{persistEditor();renderLibrary();view('home')}};
$('simpleSettings').onclick=()=>view('settings');
$('simpleSettingsBack').onclick=()=>view('home');
$('simpleAdvanced').onclick=()=>{document.body.classList.add('advanced');$('simpleApp').hidden=true;window.scrollTo(0,0)};
$('simpleReturn').onclick=()=>{document.body.classList.remove('advanced');$('simpleApp').hidden=false;view('home')};
$('simpleRole').onchange=e=>{myRole=e.target.value;persistEditor();refreshRoles()};
$('simpleMode').onchange=e=>{mode=e.target.value;persistEditor();setStatus(mode==='natural'?'자연스러운 연기는 실시간 AI 연결 전이라 사용할 수 없어. 대본 그대로 미리듣기만 가능해.':'대본 그대로 모드 선택됨')};
$('simpleRun').onclick=()=>{
 if(mode==='natural'){setStatus('자연스러운 연기 모드는 아직 구현되지 않았어.');return}
 persistEditor();playPreview();
};
$('simpleStop').onclick=stopVoice;
$('simpleRestoreLegacy').onclick=()=>{
 try{
 const old=JSON.parse(localStorage.getItem(legacyKey)||'null');
 if(!old?.text){setStatus('이전 버전에 저장된 대본이 없어.');return}
 if(!confirm('이전 버전의 대본을 새 작품으로 복사할까? 기존 데이터는 그대로 남아 있어.'))return;
 const s={id:'legacy-'+Date.now(),title:old.title||'이전 대본',text:old.text,items:[],myRole:'',mode:'exact',updated:Date.now()};
 data.scripts.push(s);data.active=s.id;save();fillEditor();view('editor');
 }catch(e){setStatus('이전 대본을 읽지 못했어: '+e.message)}
};
$('simpleDelete').onclick=()=>{
 const s=active();if(!s||!confirm('현재 대본을 삭제할까? 이 작업은 되돌릴 수 없어.'))return;
 data.scripts=data.scripts.filter(x=>x.id!==s.id);data.active=data.scripts[0]?.id||null;save();renderLibrary();view('home');
};
load();renderLibrary();view('home');setStatus('대본은 이 기기에 저장돼.');
})();