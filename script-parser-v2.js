(function(){
'use strict';
function parse(text){
 const rows=String(text).split(/\r?\n/),out=[];let scene='',previous=null;
 const clean=s=>String(s).replace(/\u00a0/g,' ').trim();
 const sceneRe=/^(?:S\s*[#＃]\s*\d+|SCENE\s*#?\s*\d+|씬\s*#?\s*\d+)(?=\s|[.:·-]|$)/i;
 const roleRe=/^(?:[가-힣]{2,8}(?:[A-Z가-힣0-9])?|[A-Z]{2,6})(?:\s*\([a-zA-Z0-9가-힣]+\))?$/;
 const role=s=>roleRe.test(clean(s))&&!/[.!?"“”]/.test(s);
 function cue(raw){
  const t=clean(raw);let m=t.match(/^([^:：\t]{1,18})\s*[:：\t]\s*(.+)$/);
  if(m&&role(m[1]))return {name:clean(m[1]),text:clean(m[2])};
  m=raw.match(/^\s*([가-힣A-Z0-9() ]{2,18})[ \t]{3,}(\S.*)$/);
  if(m&&role(m[1]))return {name:clean(m[1]),text:clean(m[2])};
  m=t.match(/^[-•]\s*([가-힣]{2,8}[A-Z가-힣0-9]?|[A-Z]{2,6})\s*(?:[:：]|\s+)(["“].+)$/);
  if(m&&role(m[1]))return {name:clean(m[1]),text:clean(m[2])};
  return null;
 }
 function action(t){
  return /^[-•]\s*(?!출연자[A-Za-z가-힣0-9]+)/.test(t)&&!/^[-•]\s*[A-Z]{2,6}\s*["“]/.test(t)
    || /^(?:INT\.|EXT\.|지문\s*[:：]|장면\s*[:：])/i.test(t)
    || /^(?:\(|\[).*(?:\)|\])$/.test(t)&&t.length>3
    || /^(?:거만한|한편|그때|화면은|카메라는|천천히|배경은|스튜디오는|무대는)\b/.test(t)&&t.length>15;
 }
 function add(type,name,text,index,confidence){
  let direction='';
  if(type==='dialogue'){
   const m=text.match(/^\s*(\([^)]{2,90}\)|\[[^\]]{2,90}\])\s*(.+)$/s);
   if(m){direction=m[1];text=m[2]}
  }
  out.push({type,speaker:name,text,scene,checked:false,line:index+1,confidence,direction});
 }
 for(let i=0;i<rows.length;i++){
  const raw=rows[i],t=clean(raw);if(!t)continue;
  if(sceneRe.test(t)){scene=t;add('scene','',t,i,'high');previous=null;continue}
  const match=cue(raw);
  if(match){add('dialogue',match.name,match.text,i,'high');previous='dialogue';continue}
  if(role(t)){
   let j=i+1;while(j<rows.length&&!clean(rows[j]))j++;
   if(j<rows.length&&!sceneRe.test(clean(rows[j]))&&!action(clean(rows[j]))&&!role(rows[j])&&!cue(rows[j])){
    const lines=[clean(rows[j])];let end=j;
    for(let k=j+1;k<rows.length;k++){
     const v=clean(rows[k]);if(!v||sceneRe.test(v)||action(v)||role(v)||cue(rows[k]))break;
     lines.push(v);end=k;
    }
    add('dialogue',t,lines.join('\n'),i,'candidate');i=end;previous='dialogue';continue;
   }
   add('unknown','',t,i,'review');previous=null;continue;
  }
  if(action(t)){add('action','',t,i,'candidate');previous=null;continue}
  add('unknown','',t,i,'review');previous=null;
 }
 return out;
}
window.JoonScriptParser={parse};
})();