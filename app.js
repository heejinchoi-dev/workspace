
/*═══════════ Firebase ═══════════*/
var firebaseConfig={apiKey:"AIzaSyCmeGcCHO5K-jKu4UApMo_CxLhhDuzVLlc",authDomain:"circularlabs-gw.firebaseapp.com",databaseURL:"https://circularlabs-gw-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"circularlabs-gw",storageBucket:"circularlabs-gw.firebasestorage.app",messagingSenderId:"995341939477",appId:"1:995341939477:web:543ebebe0a2af4ca14ef1c"};
firebase.initializeApp(firebaseConfig);var auth=firebase.auth(),db=firebase.database();
/*═══════════ Global ═══════════*/
var USER=null,CACHE={tasks:[],devProjects:[],sprints:[],crm:[],cs:[],schedules:[],approval:[],leaves:[],vault:[],comments:{},members:[],wiki:[],leaveInfo:{total:15,used:0,remain:15}};
var devView='board',confirmCb=null,chartCRM=null,chartTasks=null;
/*═══════════ Util ═══════════*/
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5);}
function nowFmt(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function pad(n){return String(n).padStart(2,'0');}
function fmtDT(ts){if(!ts)return'';var d=new Date(Number(ts));return pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function showToast(m){var t=document.getElementById('toast-msg');document.getElementById('toast-text').innerText=m;t.classList.add('toast-show');setTimeout(function(){t.classList.remove('toast-show');},3000);}
function openModal(id){var e=document.getElementById(id);if(e)e.classList.remove('hidden');}
function closeModal(id){var e=document.getElementById(id);if(e)e.classList.add('hidden');}
function statusBadge(s){if(['승인','1차 승인','최종 승인','계약성공(Won)','완료','배포완료'].indexOf(s)>-1)return'<span class="badge badge-approved">'+s+'</span>';if(s==='반려')return'<span class="badge badge-rejected">'+s+'</span>';if(['철회','취소','보류'].indexOf(s)>-1)return'<span class="badge badge-withdrawn">'+s+'</span>';return'<span class="badge badge-pending">'+s+'</span>';}
function getMemberName(e){if(!e)return'(미지정)';var m=CACHE.members.find(function(x){return x.email&&x.email.toLowerCase()===String(e).toLowerCase();});return m?m.name:String(e).split('@')[0];}
function parseNode(o){if(!o)return[];return Object.keys(o).map(function(k){return Object.assign({id:k},o[k]);});}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebar-overlay').classList.toggle('show');}
function getTeamLeader(dept){var l=CACHE.members.find(function(m){return m.dept===dept&&(m.position==='팀장'||m.role==='팀장');});if(!l)l=CACHE.members.find(function(m){return m.dept===dept&&m.role==='ADMIN';});return l?l.email:'';}
function getMemberPosition(m){if(m.position==='팀장'||m.role==='팀장')return'팀장';if(m.role==='센터장')return'센터장';if(m.role==='ADMIN')return'관리자';return m.position||m.role||'팀원';}
function isApprover(m){return m.role==='ADMIN'||m.role==='팀장'||m.role==='센터장'||m.position==='팀장';}
function openCustomConfirm(t,d,cb){document.getElementById('cc-title').innerText=t;document.getElementById('cc-desc').innerText=d;confirmCb=cb;document.getElementById('cc-ok').onclick=function(){if(confirmCb){confirmCb();closeModal('custom-confirm-modal');}};openModal('custom-confirm-modal');}

/*═══════════ Assignee Picker (팀별 분류 + 검색) ═══════════*/
function populateAssignees(cId,sel){
  var el=document.getElementById(cId);if(!el)return;
  var s=sel?sel.split(',').map(function(x){return x.trim().toLowerCase();}):[];
  var teams={};CACHE.members.forEach(function(m){var d=m.dept||'기타';if(!teams[d])teams[d]=[];teams[d].push(m);});
  var html='<input type="text" class="w-full border-b p-2 text-xs outline-none mb-1 sticky top-0 bg-white z-10" placeholder="이름 검색..." oninput="filterAssignees(\''+cId+'\',this.value)">';
  Object.keys(teams).sort().forEach(function(dept){
    html+='<div class="ap-group" data-dept="'+esc(dept)+'"><div class="ap-group-title">'+esc(dept)+'</div>';
    teams[dept].forEach(function(m){
      html+='<label class="ap-item" data-name="'+esc(m.name).toLowerCase()+'"><input type="checkbox" class="'+cId+'-cb" value="'+m.email+'" '+(s.indexOf(m.email.toLowerCase())>-1?'checked':'')+'><span class="text-sm font-bold text-gray-700">'+m.name+'</span><span class="text-[10px] text-gray-400">'+getMemberPosition(m)+'</span></label>';
    });
    html+='</div>';
  });
  el.innerHTML=html;
}
function filterAssignees(cId,q){
  q=q.toLowerCase();var el=document.getElementById(cId);if(!el)return;
  el.querySelectorAll('.ap-item').forEach(function(item){item.style.display=item.getAttribute('data-name').indexOf(q)>-1?'':'none';});
  el.querySelectorAll('.ap-group').forEach(function(g){var vis=g.querySelectorAll('.ap-item[style=""],.ap-item:not([style])');var anyVis=Array.from(g.querySelectorAll('.ap-item')).some(function(i){return i.style.display!=='none';});g.style.display=anyVis?'':'none';});
}
function getChecked(cId){return Array.from(document.querySelectorAll('.'+cId+'-cb:checked')).map(function(c){return c.value;}).join(',');}
/*═══════════ Visual helpers ═══════════*/
var DEV_STATUS_META={'기획중':{dot:'bg-yellow-400',badge:'bg-yellow-100 text-yellow-700'},'개발중':{dot:'bg-blue-500',badge:'bg-blue-100 text-blue-700'},'QA/테스트':{dot:'bg-purple-500',badge:'bg-purple-100 text-purple-700'},'배포완료':{dot:'bg-green-500',badge:'bg-green-100 text-green-700'},'보류':{dot:'bg-gray-300',badge:'bg-gray-100 text-gray-500'}};
var PRIORITY_META={P1:{bg:'bg-red-100',text:'text-red-600',icon:'ri-arrow-up-double-fill',tip:'긴급'},P2:{bg:'bg-orange-100',text:'text-orange-500',icon:'ri-arrow-up-fill',tip:'높음'},P3:{bg:'bg-blue-100',text:'text-blue-500',icon:'ri-arrow-right-fill',tip:'보통'},P4:{bg:'bg-gray-100',text:'text-gray-400',icon:'ri-arrow-down-fill',tip:'낮음'}};
var TAG_COLORS=['bg-pink-100 text-pink-700','bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-teal-100 text-teal-700','bg-lime-100 text-lime-700','bg-amber-100 text-amber-700'];
function tagColor(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))%TAG_COLORS.length;return TAG_COLORS[h];}
function tagHtml(tags){return(tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean).map(function(t){return'<span class="text-[10px] font-black px-2 py-0.5 r20 '+tagColor(t)+'">'+esc(t)+'</span>';}).join('');}

// 모바일 사이드바 토글
function toggleSidebar(){var sb=document.getElementById('sidebar'),ov=document.getElementById('sidebar-overlay');sb.classList.toggle('open');ov.classList.toggle('show');}

// 팀장 찾기 - role이 '팀장' 또는 position이 '팀장'인 멤버
function getTeamLeader(dept){
  var leader=CACHE.members.find(function(m){return m.dept===dept&&(m.position==='팀장'||m.role==='팀장');});
  if(!leader) leader=CACHE.members.find(function(m){return m.dept===dept&&m.role==='ADMIN';});
  return leader?leader.email:'';
}
// 멤버의 직급 판별 (role 또는 position 필드 활용)
function getMemberPosition(m){
  if(m.position==='팀장'||m.role==='팀장')return'팀장';
  if(m.role==='센터장')return'센터장';
  if(m.role==='ADMIN')return'관리자';
  return m.position||m.role||'팀원';
}
// ADMIN 판별 (role이 ADMIN이거나 팀장이거나 센터장)
function isApprover(m){return m.role==='ADMIN'||m.role==='팀장'||m.role==='센터장'||m.position==='팀장';}

// ═══════════════════════════════════════════════
//  Firebase DB 헬퍼
// ═══════════════════════════════════════════════
var FB={
  get:function(path,cb){db.ref(path).once('value',function(snap){cb(null,snap.val());},function(err){cb(err,null);});},
  set:function(path,data){db.ref(path).set(data);},
  patch:function(path,data){db.ref(path).update(data);},
  push:function(path,data,cb){var ref=db.ref(path).push(data);if(cb)cb(ref.key);},
  remove:function(path){db.ref(path).remove();},
  listen:function(path,cb){db.ref(path).on('value',function(snap){cb(snap.val());});},
  unlisten:function(path){db.ref(path).off();}
};

// ═══════════════════════════════════════════════
//  인증
// ═══════════════════════════════════════════════
auth.onAuthStateChanged(function(firebaseUser){
  if(firebaseUser){
    db.ref('members').once('value',function(snap){
      var members=snap.val();
      var memberList=members?Object.keys(members).map(function(k){return Object.assign({id:k},members[k]);}):[];
      var matched=memberList.find(function(m){return m.email&&m.email.toLowerCase()===firebaseUser.email.toLowerCase();});
      if(matched){
        USER={email:firebaseUser.email,name:matched.name||firebaseUser.displayName||firebaseUser.email.split('@')[0],dept:matched.dept||'',role:matched.role||'MEMBER',position:matched.position||'팀원',leaveTotal:Number(matched.leaveTotal)||15,phone:matched.phone||''};
        CACHE.members=memberList;
        document.getElementById('login-screen').classList.add('hidden');
        var appEl=document.getElementById('app');appEl.classList.remove('hidden');appEl.classList.add('flex','flex-col');
        document.getElementById('sidebar-name').innerText=USER.name;
        document.getElementById('sidebar-email').innerText=USER.email;
        if(isAdminUser) document.getElementById('admin-menu').classList.remove('hidden');
        initApp();
      }else{document.getElementById('login-error').classList.remove('hidden');setTimeout(function(){auth.signOut();},3000);}
    });
  }else{document.getElementById('app').classList.add('hidden');document.getElementById('app').classList.remove('flex','flex-col');document.getElementById('login-screen').classList.remove('hidden');}
});
document.getElementById('google-login-btn').onclick=function(){var provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({hd:'circularlabs.co.kr'});auth.signInWithPopup(provider).catch(function(err){if(err.code==='auth/unauthorized-domain'||err.code==='auth/popup-blocked'||err.code==='auth/cancelled-popup-request'){auth.signInWithRedirect(provider);}else{showToast('로그인 실패: '+err.message);}});};
function signOut(){openCustomConfirm('로그아웃','로그아웃 하시겠습니까?',function(){auth.signOut();});}

// ═══════════════════════════════════════════════
//  앱 초기화
// ═══════════════════════════════════════════════
function initApp(){
  showSkeleton();
  var nodes=['tasks','devProjects','sprints','crm','cs','schedules','approvals','leaves','vault','comments','wiki','notices'];
  var results={},idx=0;
  function next(){if(idx>=nodes.length){processData(results);return;}var node=nodes[idx++];FB.get(node,function(err,data){results[node]=data;next();});}
  next();
}
function showSkeleton(){document.getElementById('tab-home').innerHTML='<div class="mb-8"><div class="skeleton h-10 w-64 r24 mb-2"></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">'+Array(4).fill('<div class="skeleton h-32 r35"></div>').join('')+'</div><div class="grid grid-cols-1 md:grid-cols-2 gap-8">'+Array(2).fill('<div class="skeleton h-64 r35"></div>').join('')+'</div>';}

function processData(results){
  var now=Date.now();
  CACHE.tasks=parseNode(results.tasks).filter(function(t){return!(t.status==='Done'&&(now-(parseInt(t.timestamp)||now))>30*86400000);});
  CACHE.devProjects=parseNode(results.devProjects);CACHE.sprints=parseNode(results.sprints);CACHE.crm=parseNode(results.crm);CACHE.cs=parseNode(results.cs);CACHE.schedules=parseNode(results.schedules);CACHE.approval=parseNode(results.approvals);CACHE.leaves=parseNode(results.leaves);CACHE.comments=results.comments||{};CACHE.wiki=parseNode(results.wiki);
  CACHE.vault=parseNode(results.vault).filter(function(v){if(USER.role==='ADMIN'||v.creator===USER.email||v.visibility==='ALL')return true;if(v.visibility==='PRIVATE')return false;return(v.visibility||'').indexOf(USER.dept)>-1||(v.visibility||'').indexOf(USER.email)>-1;}).map(function(v){return Object.assign({},v,{password:'••••••••'});});
  var used=0;CACHE.leaves.filter(function(l){return l.applicant&&l.applicant.toLowerCase()===USER.email&&l.status==='승인';}).forEach(function(l){if(l.type==='연차')used+=1;else if(l.type==='반차')used+=0.5;});
  CACHE.leaveInfo={total:USER.leaveTotal,used:used,remain:USER.leaveTotal-used};
  var notices=parseNode(results.notices);if(notices.length>0){var latest=notices[notices.length-1];if(latest&&latest.content){activeNoticeId=latest.id;showNoticePopup(latest.content);}}
  updateBadges();initConfirmModal();showTab('home');showToast('✅ 로드 완료!');setupRealtimeListeners();
}
function setupRealtimeListeners(){
  FB.listen('approvals',function(data){CACHE.approval=parseNode(data);updateBadges();var el=document.getElementById('tab-approval');if(el&&!el.classList.contains('hidden'))renderApproval();});
  FB.listen('leaves',function(data){CACHE.leaves=parseNode(data);var used=0;CACHE.leaves.filter(function(l){return l.applicant&&l.applicant.toLowerCase()===USER.email&&l.status==='승인';}).forEach(function(l){if(l.type==='연차')used+=1;else if(l.type==='반차')used+=0.5;});CACHE.leaveInfo={total:USER.leaveTotal,used:used,remain:USER.leaveTotal-used};updateBadges();});
  FB.listen('tasks',function(data){CACHE.tasks=parseNode(data);var el=document.getElementById('tab-calendar');if(el&&!el.classList.contains('hidden'))renderCalendar();});
}

// ═══════════════════════════════════════════════
//  탭 전환
// ═══════════════════════════════════════════════
function showTab(name){
  // 모바일 사이드바 닫기
  var sb=document.getElementById('sidebar'),ov=document.getElementById('sidebar-overlay');
  if(sb)sb.classList.remove('open');if(ov)ov.classList.remove('show');
  document.querySelectorAll('[id^="tab-"]').forEach(function(s){s.classList.add('hidden');});
  document.querySelectorAll('.sidebar-item').forEach(function(i){i.classList.remove('active');});
  var sec=document.getElementById('tab-'+name);if(!sec)return;sec.classList.remove('hidden');
  var nav=document.querySelector('[data-tab="'+name+'"]');if(nav)nav.classList.add('active');
  var renders={home:renderDashboard,calendar:renderCalendar,dev:function(){setDevView(devView);},crm:filterCRM,cs:filterCS,approval:renderApproval,vault:renderVault,wiki:renderWiki,leaves:renderLeaves,directory:renderDirectory,admin:renderAdmin};
  if(renders[name])renders[name]();
}
function updateBadges(){
  var ac=CACHE.approval.filter(function(d){return((d.approver1||'').toLowerCase()===USER.email&&d.status==='대기')||((d.approver2||'').toLowerCase()===USER.email&&d.status==='1차 승인');}).length;
  var lc=CACHE.leaves.filter(function(d){return(d.approver1||'').toLowerCase()===USER.email&&d.status==='대기';}).length;
  var bA=document.getElementById('badge-appr'),bL=document.getElementById('badge-leave');
  if(bA){bA.innerText=ac;bA.classList.toggle('hidden',ac===0);}
  if(bL){bL.innerText=lc;bL.classList.toggle('hidden',lc===0);}
  refreshNotifBadge();
}
function renderModalRoot(id,html){var el=document.getElementById(id);if(!el){el=document.createElement('div');el.id=id;document.getElementById('modal-root').appendChild(el);}el.className='hidden fixed inset-0 modal-overlay p-4 z-50';el.innerHTML=html;}
function initConfirmModal(){renderModalRoot('custom-confirm-modal','<div class="bg-white r35 modal-content max-w-sm p-10 shadow-2xl fade-in text-center"><div class="text-red-500 text-6xl mb-6"><i class="ri-error-warning-fill"></i></div><h2 id="cc-title" class="text-2xl font-black mb-3 text-gray-800"></h2><p id="cc-desc" class="text-sm text-gray-500 mb-10 leading-relaxed"></p><div class="flex justify-center gap-3"><button onclick="closeModal(\'custom-confirm-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button id="cc-ok" class="px-8 py-3.5 bg-red-600 text-white r35 text-sm font-bold shadow-lg hover:bg-red-700 transition">확인</button></div></div>');}

// ═══════════════════════════════════════════════
//  알림
// ═══════════════════════════════════════════════
function buildNotifications(){
  var notes=[],today=new Date();today.setHours(0,0,0,0);var todayStr=new Date().toISOString().slice(0,10);
  CACHE.approval.filter(function(d){return((d.approver1||'').toLowerCase()===USER.email&&d.status==='대기')||((d.approver2||'').toLowerCase()===USER.email&&d.status==='1차 승인');}).forEach(function(d){notes.push({icon:'ri-bank-card-fill',color:'text-blue-500',bg:'bg-blue-50',msg:'결재 대기: <b>'+esc(d.reason)+'</b> ₩'+Number(d.amount).toLocaleString(),action:function(){closeModal('notif-modal');showTab('approval');}});});
  CACHE.leaves.filter(function(d){return(d.approver1||'').toLowerCase()===USER.email&&d.status==='대기';}).forEach(function(d){notes.push({icon:'ri-flight-takeoff-fill',color:'text-purple-500',bg:'bg-purple-50',msg:'휴가 결재 대기: <b>'+d.applicantName+'</b>',action:function(){closeModal('notif-modal');showTab('leaves');}});});
  // 팀 할일 알림: @로 나한테 할당된 것
  CACHE.tasks.filter(function(t){return t.taskType==='team'&&t.status!=='Done'&&(t.assignees||'').toLowerCase().indexOf(USER.email)>-1;}).forEach(function(t){
    if(t.notified&&t.notified[USER.email])return;
    notes.push({icon:'ri-at-line',color:'text-rose-500',bg:'bg-rose-50',msg:'업무 할당: <b>'+esc(t.title)+'</b>',action:function(){closeModal('notif-modal');showTab('calendar');}});
  });
  CACHE.tasks.filter(function(t){if(!t.deadline||t.status==='Done')return false;var diff=Math.ceil((new Date(t.deadline)-today)/86400000);return diff<=0&&(t.assignees||'').toLowerCase().indexOf(USER.email)>-1;}).forEach(function(t){notes.push({icon:'ri-alarm-warning-fill',color:'text-red-500',bg:'bg-red-50',msg:'오늘 마감: <b>'+esc(t.title)+'</b>',action:function(){closeModal('notif-modal');showTab('calendar');}});});
  CACHE.crm.filter(function(d){return d.nextActionDate&&d.nextActionDate<=todayStr&&d.status!=='계약성공(Won)';}).forEach(function(d){notes.push({icon:'ri-briefcase-4-fill',color:'text-emerald-500',bg:'bg-emerald-50',msg:'팔로업 필요: <b>'+esc(d.company)+'</b>',action:function(){closeModal('notif-modal');showTab('crm');}});});
  return notes;
}
function openNotifModal(){var notes=buildNotifications();renderModalRoot('notif-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in relative max-h-[85vh] flex flex-col"><button onclick="closeModal(\'notif-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-2xl font-black mb-6 text-gray-800"><i class="ri-notification-3-fill text-blue-500 mr-2"></i> 알림 센터</h2><div class="flex-1 overflow-y-auto hide-scrollbar">'+(notes.length===0?'<p class="text-sm text-gray-400 font-bold text-center py-10">새로운 알림이 없습니다 🎉</p>':notes.map(function(n,i){return'<div id="notif-'+i+'" class="flex items-start gap-4 p-4 '+n.bg+' r24 cursor-pointer hover:opacity-80 transition mb-3"><i class="'+n.icon+' '+n.color+' text-xl shrink-0 mt-0.5"></i><p class="text-sm text-gray-700">'+n.msg+'</p></div>';}).join(''))+'</div></div>');openModal('notif-modal');notes.forEach(function(n,i){var el=document.getElementById('notif-'+i);if(el)el.onclick=n.action;});}
function refreshNotifBadge(){var c=buildNotifications().length;['notif-badge','notif-badge-mobile'].forEach(function(id){var b=document.getElementById(id);if(b){b.innerText=c;b.classList.toggle('hidden',c===0);}});}

// ═══════════════════════════════════════════════
//  공지
// ═══════════════════════════════════════════════
function showNoticePopup(content){renderModalRoot('global-notice-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in text-center border-t-8 border-red-500"><div class="text-red-500 text-5xl mb-6"><i class="ri-megaphone-fill"></i></div><h2 class="text-2xl font-black mb-6 uppercase tracking-widest text-gray-800">사내 팝업 공지</h2><div class="bg-gray-50 p-6 md:p-8 r24 mb-8"><p id="gn-text" class="text-base text-gray-700 whitespace-pre-wrap leading-relaxed font-medium text-left"></p></div><button onclick="closeModal(\'global-notice-modal\')" class="bg-gray-900 text-white px-10 py-4 r35 font-bold text-sm hover:bg-black shadow-lg transition">확인</button></div>');var el=document.getElementById('gn-text');if(el)el.innerText=content;openModal('global-notice-modal');}

// ═══════════════════════════════════════════════
//  대시보드
// ═══════════════════════════════════════════════
function renderDashboard(){
  var li=CACHE.leaveInfo,today=new Date();today.setHours(0,0,0,0);
  var ac=CACHE.approval.filter(function(d){return((d.approver1||'').toLowerCase()===USER.email&&d.status==='대기')||((d.approver2||'').toLowerCase()===USER.email&&d.status==='1차 승인');}).length;
  var inP=CACHE.tasks.filter(function(t){return(t.assignees||'').toLowerCase().indexOf(USER.email)>-1&&t.status==='In Progress';}).length;
  var nc=buildNotifications().length;
  var urgentTasks=CACHE.tasks.filter(function(t){if(!t.deadline||t.status==='Done')return false;return Math.ceil((new Date(t.deadline)-today)/86400000)<=3;}).sort(function(a,b){return new Date(a.deadline)-new Date(b.deadline);});
  var ongoing=CACHE.devProjects.filter(function(p){return p.status!=='배포완료'&&p.status!=='보류';});
  var d=new Date(),dateStr=d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일 '+'일월화수목금토'[d.getDay()]+'요일';
  document.getElementById('tab-home').innerHTML=
    '<div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-2"><h1 class="text-2xl md:text-4xl font-black text-gray-800 tracking-tight">좋은 하루입니다, '+esc(USER.name)+'님! 👋</h1><p class="text-sm text-gray-400 font-bold">'+dateStr+'</p></div>'+
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">'+
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-purple-200 border border-transparent" onclick="showTab(\'leaves\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">남은 연차</h3><p class="text-3xl md:text-4xl font-black text-purple-600">'+li.remain+' 일</p></div>'+
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-green-200 border border-transparent" onclick="showTab(\'approval\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">대기 중 결재</h3><p class="text-3xl md:text-4xl font-black text-green-500">'+ac+'</p></div>'+
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-rose-200 border border-transparent" onclick="showTab(\'dev\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">진행 중 업무</h3><p class="text-3xl md:text-4xl font-black text-rose-500">'+inP+'</p></div>'+
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-blue-200 border border-transparent" onclick="openNotifModal()"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">미확인 알림</h3><p class="text-3xl md:text-4xl font-black text-blue-500">'+nc+'</p></div>'+
    '</div>'+
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">'+
    '<div class="bg-white p-6 md:p-8 r35 card-shadow"><h3 class="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2"><i class="ri-pie-chart-2-fill text-emerald-500"></i> 영업 파이프라인</h3><canvas id="chart-crm" height="160"></canvas><div id="chart-crm-legend" class="mt-3 space-y-1.5"></div></div>'+
    '<div class="bg-white p-6 md:p-8 r35 card-shadow"><h3 class="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2"><i class="ri-bar-chart-fill text-blue-500"></i> 이번 달 업무 완료율</h3><canvas id="chart-tasks" height="160"></canvas><div id="chart-tasks-legend" class="mt-3"></div></div>'+
    '<div class="bg-white p-6 md:p-8 r35 card-shadow flex flex-col"><h3 class="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="ri-alarm-warning-fill text-red-500"></i> D-day 마감 업무</h3><div class="flex-1 overflow-y-auto space-y-2 hide-scrollbar">'+(urgentTasks.length===0?'<p class="text-xs text-gray-400 font-bold text-center py-4">마감 임박 없음 🎉</p>':urgentTasks.map(function(t){var diff=Math.ceil((new Date(t.deadline)-today)/86400000);var badge=diff<0?'<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 r20 font-black shrink-0">D+'+Math.abs(diff)+'</span>':diff===0?'<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 r20 font-black shrink-0">D-day</span>':'<span class="text-[10px] bg-orange-400 text-white px-2 py-0.5 r20 font-black shrink-0">D-'+diff+'</span>';return'<div class="flex items-center gap-2 p-3 bg-gray-50 r20 hover:bg-gray-100 cursor-pointer transition" onclick="showTab(\'calendar\')">'+badge+'<span class="flex-1 text-xs font-bold text-gray-700 truncate">'+esc(t.title)+'</span></div>';}).join(''))+'</div></div></div>'+
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">'+
    '<div class="bg-gradient-to-br from-indigo-900 to-indigo-700 p-8 md:p-10 r35 card-shadow h-72 flex flex-col text-white"><h3 class="text-sm font-bold text-indigo-200 mb-4 flex items-center gap-2"><i class="ri-megaphone-fill text-red-400"></i> 사내 공지</h3><div id="dash-notice" class="flex-1 overflow-y-auto text-base font-medium leading-relaxed whitespace-pre-wrap hide-scrollbar text-indigo-100">공지 없음</div></div>'+
    '<div class="bg-white p-8 md:p-10 r35 card-shadow h-72 flex flex-col"><h3 class="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="ri-macbook-fill text-blue-500"></i> 진행 중인 개발 프로젝트</h3><div class="flex-1 overflow-y-auto space-y-3 hide-scrollbar">'+(ongoing.length===0?'<p class="text-xs text-gray-400 font-bold text-center mt-4">진행 중인 프로젝트 없음</p>':ongoing.map(function(p){return'<div class="p-4 bg-gray-50 r24 border border-gray-100 hover:border-blue-200 cursor-pointer transition" onclick="showTab(\'dev\')"><div class="flex justify-between items-center mb-2"><span class="font-black text-gray-800 text-sm truncate">'+esc(p.title)+'</span><span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 r20 font-bold shrink-0">'+p.status+'</span></div><div class="progress-bar"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div><p class="text-[10px] text-gray-400 mt-1 font-bold text-right">'+(p.progress||0)+'%</p></div>';}).join(''))+'</div></div></div>';
  renderDashCharts();
  FB.get('notices',function(err,data){var notices=parseNode(data);var el=document.getElementById('dash-notice');if(el&&notices.length>0)el.innerText=notices[notices.length-1].content||'공지 없음';});
}
function renderDashCharts(){
  var crmC={'잠재고객':CACHE.crm.filter(function(c){return(c.status||'').indexOf('Lead')>-1;}).length,'미팅/연락':CACHE.crm.filter(function(c){return(c.status||'').indexOf('Contact')>-1;}).length,'제안/견적':CACHE.crm.filter(function(c){return(c.status||'').indexOf('Proposal')>-1;}).length,'계약성공':CACHE.crm.filter(function(c){return(c.status||'').indexOf('Won')>-1;}).length};
  var cCtx=document.getElementById('chart-crm');if(cCtx){if(chartCRM)chartCRM.destroy();chartCRM=new Chart(cCtx,{type:'doughnut',data:{labels:Object.keys(crmC),datasets:[{data:Object.values(crmC),backgroundColor:['#6b7280','#3b82f6','#8b5cf6','#10b981'],borderWidth:0}]},options:{cutout:'68%',plugins:{legend:{display:false}},animation:{duration:400}}});}
  var leg=document.getElementById('chart-crm-legend');if(leg){var colors=['#6b7280','#3b82f6','#8b5cf6','#10b981'];leg.innerHTML=Object.entries(crmC).map(function(e,i){return'<div class="flex justify-between text-xs"><span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:'+colors[i]+'"></span><span class="text-gray-600 font-bold">'+e[0]+'</span></span><span class="font-black text-gray-800">'+e[1]+'건</span></div>';}).join('');}
  var mo=new Date().toISOString().slice(0,7);var mt=CACHE.tasks.filter(function(t){return(t.deadline||'').startsWith(mo);});var bS={Todo:mt.filter(function(t){return t.status==='Todo';}).length,'In Progress':mt.filter(function(t){return t.status==='In Progress';}).length,Done:mt.filter(function(t){return t.status==='Done';}).length};
  var tCtx=document.getElementById('chart-tasks');if(tCtx){if(chartTasks)chartTasks.destroy();chartTasks=new Chart(tCtx,{type:'bar',data:{labels:Object.keys(bS),datasets:[{data:Object.values(bS),backgroundColor:['#e5e7eb','#3b82f6','#10b981'],borderRadius:8,borderWidth:0}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}},animation:{duration:400}}});}
  var tleg=document.getElementById('chart-tasks-legend');if(tleg){var tot=Object.values(bS).reduce(function(a,b){return a+b;},0);tleg.innerHTML='<p class="text-xs text-gray-500 font-bold text-center">총 <b class="text-gray-800">'+tot+'건</b> · 완료율 <b class="text-green-600">'+(tot?Math.round(bS.Done/tot*100):0)+'%</b></p>';}
}

// ═══════════════════════════════════════════════
//  일정 및 할 일 (구글 캘린더 연동 제거, 나의 할일 + 팀 할일)
// ═══════════════════════════════════════════════
function renderCalendar(){
  var el=document.getElementById('tab-calendar');
  el.innerHTML=
    '<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-calendar-todo-fill text-rose-500 mr-2"></i> 일정 및 할 일</h1><div class="flex gap-2"><button onclick="openScheduleModal()" class="bg-rose-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-rose-600 transition">+ 일정 등록</button></div></div>'+
    '<div class="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">'+
    // 나의 할 일
    '<div class="w-full lg:w-1/3 bg-white p-6 md:p-8 r35 card-shadow flex flex-col min-h-[300px] lg:min-h-0"><h2 class="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2"><i class="ri-user-line text-blue-500 text-xl"></i> 나의 할 일</h2><div class="flex gap-2 mb-4"><input type="text" id="my-todo-input" placeholder="할 일 입력 후 Enter..." class="flex-1 border p-3 md:p-4 r24 text-sm outline-none focus:border-blue-500 bg-gray-50 transition" onkeypress="if(event.key===\'Enter\')addMyTodo()"><button onclick="addMyTodo()" class="bg-blue-600 text-white w-12 h-12 r24 font-bold text-xl hover:bg-blue-700 transition shrink-0">+</button></div><div id="my-todo-list" class="flex-1 overflow-y-auto space-y-2 hide-scrollbar"></div></div>'+
    // 프로젝트별 업무
    '<div class="w-full lg:w-2/3 bg-white p-6 md:p-8 r35 card-shadow flex flex-col min-h-[300px] lg:min-h-0"><div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3"><h2 class="font-bold text-gray-800 text-lg flex items-center gap-2"><i class="ri-folder-3-fill text-rose-500 text-xl"></i> 프로젝트별 업무</h2><button onclick="openTeamTaskModal()" class="bg-rose-500 text-white px-5 py-2.5 r35 text-sm font-bold hover:bg-rose-600 transition">+ 업무 등록</button></div><div id="team-todo-list" class="flex-1 overflow-y-auto space-y-2 hide-scrollbar"></div></div>'+
    '</div>';
  renderMyTodo();renderTeamTodo();
}

// 나의 할 일 (나만 보임)
function renderMyTodo(){
  var el=document.getElementById('my-todo-list');if(!el)return;
  var myTasks=CACHE.tasks.filter(function(t){return t.taskType==='personal'&&(t.creator||'').toLowerCase()===USER.email.toLowerCase();}).sort(function(a,b){return(a.status==='Done'?1:0)-(b.status==='Done'?1:0);});
  el.innerHTML=myTasks.length===0?'<p class="text-xs text-gray-400 font-bold text-center py-4">할 일이 없습니다.</p>':myTasks.map(function(t){return'<div class="flex items-center gap-3 p-3 bg-gray-50 r20 group hover:bg-gray-100 transition"><input type="checkbox" class="w-5 h-5 rounded accent-blue-600 cursor-pointer shrink-0" '+(t.status==='Done'?'checked':'')+' onchange="toggleTodo(\''+t.id+'\',this.checked)"><span class="flex-1 text-sm font-bold '+(t.status==='Done'?'line-through text-gray-400':'text-gray-700')+'">'+esc(t.title)+'</span><button onclick="deleteTodo(\''+t.id+'\')" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"><i class="ri-delete-bin-line"></i></button></div>';}).join('');
}
function addMyTodo(){
  var input=document.getElementById('my-todo-input');var title=input?input.value.trim():'';if(!title)return;input.value='';
  var id=genId();var obj={id:id,taskType:'personal',project:'일반',category:'할일',title:title,assignees:USER.email,priority:'Medium',deadline:'',content:'',status:'Todo',creator:USER.email,timestamp:Date.now()};
  CACHE.tasks.push(obj);renderMyTodo();FB.set('tasks/'+id,obj);
}
function toggleTodo(id,done){var ns=done?'Done':'Todo';var t=CACHE.tasks.find(function(x){return x.id===id;});if(t)t.status=ns;renderMyTodo();renderTeamTodo();FB.patch('tasks/'+id,{status:ns});}
function deleteTodo(id){CACHE.tasks=CACHE.tasks.filter(function(x){return x.id!==id;});renderMyTodo();renderTeamTodo();FB.remove('tasks/'+id);}

// 프로젝트별 업무
function renderTeamTodo(){
  var el=document.getElementById('team-todo-list');if(!el)return;
  var teamTasks=CACHE.tasks.filter(function(t){return t.taskType==='team';}).sort(function(a,b){return(b.timestamp||0)-(a.timestamp||0);});
  if(!teamTasks.length){el.innerHTML='<p class="text-xs text-gray-400 font-bold text-center py-4">등록된 업무가 없습니다.</p>';return;}
  // 프로젝트별 그룹핑
  var groups={};teamTasks.forEach(function(t){var pj=t.project||'미분류';if(!groups[pj])groups[pj]=[];groups[pj].push(t);});
  var html='';
  Object.keys(groups).forEach(function(pj){
    var tasks=groups[pj];
    var doneCount=tasks.filter(function(t){return t.status==='Done';}).length;
    html+='<div class="mb-4"><div class="flex items-center gap-2 mb-2 px-1"><i class="ri-folder-3-fill text-rose-400 text-sm"></i><span class="text-xs font-black text-gray-600 uppercase tracking-wider">'+esc(pj)+'</span><span class="text-[10px] text-gray-400 font-bold ml-auto">'+doneCount+'/'+tasks.length+' 완료</span></div>';
    tasks.forEach(function(t){
      var assigneeNames=(t.assignees||'').split(',').filter(Boolean).map(function(e){return'<span class="mention-tag">@'+getMemberName(e.trim())+'</span>';}).join(' ');
      var isMyTask=(t.assignees||'').toLowerCase().indexOf(USER.email)>-1;
      var subItems=t.checklist||[];
      var subDone=subItems.filter(function(x){return x.done;}).length;
      var hasChecklist=subItems.length>0;
      html+='<div class="'+(isMyTask?'bg-blue-50 border border-blue-100':'bg-gray-50 border border-gray-100')+' r20 overflow-hidden mb-2 hover:shadow-sm transition">'+
        '<div class="flex items-start gap-3 p-4 cursor-pointer" onclick="openTaskDetail(\''+t.id+'\')">'+
        '<input type="checkbox" class="w-5 h-5 rounded accent-blue-600 cursor-pointer shrink-0 mt-0.5" '+(t.status==='Done'?'checked':'')+' onclick="event.stopPropagation();toggleTodo(\''+t.id+'\',this.checked)">'+
        '<div class="flex-1 min-w-0">'+
        '<p class="text-sm font-bold '+(t.status==='Done'?'line-through text-gray-400':'text-gray-800')+'">'+esc(t.title)+'</p>'+
        '<div class="flex flex-wrap gap-1.5 mt-2">'+assigneeNames+(t.deadline?'<span class="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 r20 font-bold">'+t.deadline+'</span>':'')+(hasChecklist?'<span class="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 r20 font-bold"><i class="ri-checkbox-line"></i> '+subDone+'/'+subItems.length+'</span>':'')+'</div>'+
        '<p class="text-[10px] text-gray-400 mt-1">'+getMemberName(t.creator)+' · '+(t.timestamp?fmtDT(t.timestamp):'')+'</p>'+
        '</div>'+
        '<i class="ri-arrow-right-s-line text-gray-300 text-xl shrink-0 mt-1"></i>'+
        '</div></div>';
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

// 업무 상세 (체크리스트 관리)
function openTaskDetail(id){
  var t=CACHE.tasks.find(function(x){return x.id===id;});if(!t)return;
  var items=t.checklist||[];
  var assigneeNames=(t.assignees||'').split(',').filter(Boolean).map(function(e){return'<span class="mention-tag">@'+getMemberName(e.trim())+'</span>';}).join(' ');
  renderModalRoot('task-detail-modal',
    '<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in relative">'+
    '<button onclick="closeModal(\'task-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button>'+
    '<div class="flex items-center gap-3 mb-2"><span class="text-[10px] bg-rose-100 text-rose-600 px-3 py-1 r20 font-black">'+(t.project||'미분류')+'</span>'+statusBadge(t.status==='Done'?'완료':'진행중')+'</div>'+
    '<h2 class="text-xl md:text-2xl font-black text-gray-900 mb-3 pr-10">'+esc(t.title)+'</h2>'+
    '<div class="flex flex-wrap gap-1.5 mb-4">'+assigneeNames+(t.deadline?'<span class="text-xs bg-gray-100 text-gray-600 px-3 py-1 r20 font-bold">마감: '+t.deadline+'</span>':'')+'</div>'+
    '<p class="text-[10px] text-gray-400 mb-6">등록: '+getMemberName(t.creator)+' · '+(t.timestamp?fmtDT(t.timestamp):'')+'</p>'+
    // 체크리스트 영역
    '<div class="border-t border-gray-100 pt-5">'+
    '<div class="flex items-center justify-between mb-4"><h3 class="text-sm font-black text-gray-800 flex items-center gap-2"><i class="ri-checkbox-multiple-fill text-violet-500"></i> 세부 할 일</h3><span id="td-cl-progress" class="text-xs font-black text-violet-600"></span></div>'+
    '<div id="td-cl-bar" class="progress-bar mb-4"><div id="td-cl-fill" class="progress-fill" style="background:linear-gradient(90deg,#8b5cf6,#6366f1);width:0%"></div></div>'+
    '<div id="td-checklist-list" class="space-y-2 mb-4 max-h-[300px] overflow-y-auto hide-scrollbar"></div>'+
    '<div class="flex gap-2"><input type="text" id="td-new-item" placeholder="할 일 항목 추가..." class="flex-1 border p-3 r20 text-sm outline-none bg-gray-50 focus:border-violet-400 transition" onkeypress="if(event.key===\'Enter\')addTaskChecklistItem(\''+t.id+'\')"><button onclick="addTaskChecklistItem(\''+t.id+'\')" class="bg-violet-600 text-white px-5 py-3 r20 text-sm font-bold hover:bg-violet-700 transition shrink-0">추가</button></div>'+
    '</div></div>');
  openModal('task-detail-modal');
  renderTaskChecklist(t.id);
}

function renderTaskChecklist(taskId){
  var t=CACHE.tasks.find(function(x){return x.id===taskId;});if(!t)return;
  var items=t.checklist||[];
  var el=document.getElementById('td-checklist-list');if(!el)return;
  var doneCount=items.filter(function(x){return x.done;}).length;
  var pct=items.length?Math.round(doneCount/items.length*100):0;
  var progEl=document.getElementById('td-cl-progress');if(progEl)progEl.innerText=doneCount+'/'+items.length+' 완료';
  var fillEl=document.getElementById('td-cl-fill');if(fillEl)fillEl.style.width=pct+'%';
  if(!items.length){el.innerHTML='<p class="text-xs text-gray-400 font-bold text-center py-4">아직 세부 할 일이 없습니다. 아래에서 추가하세요.</p>';return;}
  el.innerHTML=items.map(function(item,i){
    return'<div class="flex items-start gap-3 p-3 '+(item.done?'bg-violet-50/50':'bg-gray-50')+' r20 group transition">'+
      '<input type="checkbox" class="w-4 h-4 rounded accent-violet-600 cursor-pointer shrink-0 mt-0.5" '+(item.done?'checked':'')+' onchange="toggleTaskChecklist(\''+taskId+'\','+i+',this.checked)">'+
      '<div class="flex-1 min-w-0"><span class="text-sm '+(item.done?'line-through text-gray-400 font-normal':'font-bold text-gray-700')+'">'+esc(item.text)+'</span>'+
      (item.doneAt?'<p class="text-[10px] text-gray-400 mt-0.5">완료: '+fmtDT(item.doneAt)+'</p>':'')+
      (item.createdAt?'<p class="text-[10px] text-gray-300 mt-0.5">등록: '+fmtDT(item.createdAt)+'</p>':'')+
      '</div></div>';
  }).join('');
}

function addTaskChecklistItem(taskId){
  var input=document.getElementById('td-new-item');if(!input||!input.value.trim())return;
  var t=CACHE.tasks.find(function(x){return x.id===taskId;});if(!t)return;
  if(!t.checklist)t.checklist=[];
  t.checklist.push({text:input.value.trim(),done:false,createdAt:Date.now(),createdBy:USER.email});
  input.value='';input.focus();
  renderTaskChecklist(taskId);renderTeamTodo();
  FB.patch('tasks/'+taskId,{checklist:t.checklist});
}

function toggleTaskChecklist(taskId,i,done){
  var t=CACHE.tasks.find(function(x){return x.id===taskId;});if(!t||!t.checklist)return;
  t.checklist[i].done=done;
  if(done)t.checklist[i].doneAt=Date.now();else delete t.checklist[i].doneAt;
  renderTaskChecklist(taskId);renderTeamTodo();
  FB.patch('tasks/'+taskId,{checklist:t.checklist});
}

function openTeamTaskModal(){
  // 기존 프로젝트명 추출
  var existingProjects={};CACHE.tasks.filter(function(t){return t.taskType==='team'&&t.project;}).forEach(function(t){existingProjects[t.project]=true;});
  // devProjects에서도 가져오기
  CACHE.devProjects.forEach(function(p){existingProjects[p.title]=true;});
  var projOpts=Object.keys(existingProjects).map(function(p){return'<option value="'+esc(p)+'">'+esc(p)+'</option>';}).join('');

  renderModalRoot('team-task-modal',
    '<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in">'+
    '<h2 class="text-xl md:text-2xl font-black text-rose-600 mb-6"><i class="ri-folder-3-fill"></i> 프로젝트 업무 등록</h2>'+
    '<div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">프로젝트 선택 / 새로 입력</label><div class="flex gap-2"><select id="team-task-project-select" class="flex-1 border p-3 r24 text-sm font-bold outline-none bg-gray-50" onchange="var v=this.value;document.getElementById(\'team-task-project-custom\').classList.toggle(\'hidden\',v!==\'__new__\');"><option value="">프로젝트 선택</option>'+projOpts+'<option value="__new__">+ 새 프로젝트 입력</option></select></div><input id="team-task-project-custom" type="text" placeholder="새 프로젝트명 입력" class="hidden w-full border p-3 r24 mt-2 text-sm outline-none bg-gray-50 focus:border-rose-400"></div>'+
    '<input id="team-task-title" type="text" placeholder="업무 제목 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50 focus:border-rose-400 transition">'+
    '<div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">담당자 지정 (@)</label><div id="team-task-assignees" class="w-full border p-4 r24 bg-white max-h-40 overflow-y-auto space-y-2 hide-scrollbar shadow-inner"></div></div>'+
    '<div class="mb-6"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">마감일</label><input id="team-task-deadline" type="date" class="w-full border p-4 r24 outline-none text-sm focus:border-rose-400"></div>'+
    '<div class="flex justify-end gap-3"><button onclick="closeModal(\'team-task-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button onclick="submitTeamTask()" class="px-8 py-3.5 bg-rose-600 text-white r35 text-sm font-bold shadow-lg hover:bg-rose-700 transition">등록</button></div></div>');
  openModal('team-task-modal');
  populateAssignees('team-task-assignees','');
}
function submitTeamTask(){
  var title=document.getElementById('team-task-title').value.trim();if(!title)return showToast("제목을 입력하세요.");
  var projSel=document.getElementById('team-task-project-select').value;
  var projCustom=document.getElementById('team-task-project-custom').value.trim();
  var project=projSel==='__new__'?projCustom:(projSel||'미분류');
  if(!project)return showToast("프로젝트를 선택하거나 입력하세요.");
  var assignees=getChecked('team-task-assignees'),deadline=document.getElementById('team-task-deadline').value;
  if(!assignees)return showToast("담당자를 지정하세요.");
  var id=genId();var obj={id:id,taskType:'team',project:project,category:'업무',title:title,assignees:assignees,priority:'Medium',deadline:deadline,content:'',status:'Todo',creator:USER.email,checklist:[],timestamp:Date.now()};
  CACHE.tasks.push(obj);closeModal('team-task-modal');renderTeamTodo();showToast("업무 등록 완료!");FB.set('tasks/'+id,obj);
}

// 일정 모달 (구글 연동 제거)
function openScheduleModal(data){
  renderModalRoot('schedule-modal',
    '<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in">'+
    '<h2 class="text-xl md:text-2xl font-black text-rose-600 mb-8"><i class="ri-calendar-event-fill"></i> '+(data?'일정 수정':'새 일정 등록')+'</h2>'+
    '<input id="sch-title" type="text" value="'+(data?esc(data.title):'')+'" placeholder="일정 제목 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50 focus:border-rose-400 transition">'+
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">시작일 *</label><input id="sch-start" type="date" value="'+(data?data.start:'')+'" class="w-full border p-4 r24 outline-none text-sm focus:border-rose-400"></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">종료일</label><input id="sch-end" type="date" value="'+(data?(data.end||''):'')+'" class="w-full border p-4 r24 outline-none text-sm focus:border-rose-400"></div></div>'+
    '<div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">구분</label><select id="sch-type" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50 focus:border-rose-400"><option '+(data&&data.type==='팀 회의'?'selected':'')+'>팀 회의</option><option '+(data&&data.type==='개인 외근'?'selected':'')+'>개인 외근</option><option '+(data&&data.type==='프로젝트 마감'?'selected':'')+'>프로젝트 마감</option><option '+(data&&data.type==='기타'?'selected':'')+'>기타</option></select></div>'+
    '<textarea id="sch-note" rows="2" placeholder="메모 및 장소" class="w-full border p-4 r24 mb-6 outline-none text-sm focus:border-rose-400">'+(data?esc(data.note||''):'')+'</textarea>'+
    '<input type="hidden" id="sch-edit-id" value="'+(data?data.id:'')+'">'+
    '<div class="flex justify-end gap-3">'+(data?'<button onclick="deleteScheduleAction(\''+data.id+'\')" class="px-6 py-3.5 bg-red-50 text-red-600 r35 text-sm font-bold hover:bg-red-100 transition">삭제</button>':'')+'<button onclick="closeModal(\'schedule-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button onclick="submitSchedule()" class="px-8 py-3.5 bg-rose-600 text-white r35 text-sm font-bold shadow-lg hover:bg-rose-700 transition">'+(data?'수정':'등록')+'</button></div></div>');
  openModal('schedule-modal');
}
function submitSchedule(){var id=document.getElementById('sch-edit-id').value;var title=document.getElementById('sch-title').value.trim();if(!title)return showToast("제목을 입력하세요.");var obj={title:title,start:document.getElementById('sch-start').value,end:document.getElementById('sch-end').value||document.getElementById('sch-start').value,type:document.getElementById('sch-type').value,note:document.getElementById('sch-note').value,creator:USER.email};if(id){obj.id=id;var idx=CACHE.schedules.findIndex(function(x){return x.id===id;});if(idx>-1)Object.assign(CACHE.schedules[idx],obj);FB.patch('schedules/'+id,obj);}else{obj.id=genId();CACHE.schedules.push(obj);FB.set('schedules/'+obj.id,obj);}closeModal('schedule-modal');showToast(id?"일정 수정 완료":"일정 등록 완료");}
function deleteScheduleAction(id){openCustomConfirm("일정 삭제","이 일정을 삭제할까요?",function(){CACHE.schedules=CACHE.schedules.filter(function(x){return x.id!==id;});FB.remove('schedules/'+id);closeModal('schedule-modal');showToast("삭제 완료");});}

// ═══════════════════════════════════════════════
//  개발 프로젝트 (축약 - 기존과 동일 구조)
// ═══════════════════════════════════════════════
var DEV_STATUS_META={'기획중':{dot:'bg-yellow-400',badge:'bg-yellow-100 text-yellow-700'},'개발중':{dot:'bg-blue-500',badge:'bg-blue-100 text-blue-700'},'QA/테스트':{dot:'bg-purple-500',badge:'bg-purple-100 text-purple-700'},'배포완료':{dot:'bg-green-500',badge:'bg-green-100 text-green-700'},'보류':{dot:'bg-gray-300',badge:'bg-gray-100 text-gray-500'}};
var PRIORITY_META={P1:{bg:'bg-red-100',text:'text-red-600',icon:'ri-arrow-up-double-fill',tip:'긴급'},P2:{bg:'bg-orange-100',text:'text-orange-500',icon:'ri-arrow-up-fill',tip:'높음'},P3:{bg:'bg-blue-100',text:'text-blue-500',icon:'ri-arrow-right-fill',tip:'보통'},P4:{bg:'bg-gray-100',text:'text-gray-400',icon:'ri-arrow-down-fill',tip:'낮음'}};
var TAG_COLORS=['bg-pink-100 text-pink-700','bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-teal-100 text-teal-700','bg-lime-100 text-lime-700','bg-amber-100 text-amber-700'];
function tagColor(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))%TAG_COLORS.length;return TAG_COLORS[h];}
function tagHtml(tags){return(tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean).map(function(t){return'<span class="text-[10px] font-black px-2 py-0.5 r20 '+tagColor(t)+'">'+esc(t)+'</span>';}).join('');}
function priorityHtml(p,size){var m=PRIORITY_META[p];if(!m)return'';var sz=size==='md'?'text-xs px-3 py-1':'text-[10px] px-2 py-0.5';return'<span title="'+m.tip+'" class="'+sz+' r20 font-black flex items-center gap-1 '+m.bg+' '+m.text+'"><i class="'+m.icon+'"></i>'+p+'</span>';}
function avatarHtml(emails,max){max=max||4;var colors=['bg-blue-500','bg-purple-500','bg-emerald-500','bg-rose-500','bg-amber-500'];var list=(emails||'').split(',').filter(Boolean);return list.slice(0,max).map(function(e,i){var n=getMemberName(e.trim());return'<div title="'+n+'" class="w-7 h-7 rounded-full '+colors[i%colors.length]+' flex items-center justify-center text-white text-[10px] font-black border-2 border-white -ml-1 first:ml-0 shadow-sm">'+(n[0]||'?')+'</div>';}).join('')+(list.length>max?'<div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-black border-2 border-white -ml-1">+'+(list.length-max)+'</div>':'');}

function initDevTab(){var el=document.getElementById('tab-dev');if(el.querySelector('#dev-board-view'))return;el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><div><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-macbook-fill text-blue-500 mr-2"></i> 개발 프로젝트</h1><p class="text-sm text-gray-400 mt-1 ml-8" id="dev-project-count"></p></div><div class="flex items-center gap-3 flex-wrap"><div class="flex bg-white border border-gray-200 p-1 r24 text-xs font-bold"><button id="dev-view-list" onclick="setDevView(\'list\')" class="px-4 py-2 r20 text-gray-400">리스트</button><button id="dev-view-board" onclick="setDevView(\'board\')" class="px-4 py-2 r20 bg-gray-100 text-gray-800">보드</button></div><select id="dev-status-filter" onchange="renderDevProjects()" class="border border-gray-200 bg-white p-2.5 r24 text-xs font-bold outline-none text-gray-600"><option value="all">전체 상태</option><option>기획중</option><option>개발중</option><option>QA/테스트</option><option>배포완료</option><option>보류</option></select><input type="text" id="dev-search" oninput="renderDevProjects()" placeholder="검색..." class="pl-4 pr-4 py-2.5 border border-gray-200 r24 text-xs outline-none w-36 bg-white"><button onclick="openDevModal()" class="bg-blue-600 text-white px-5 py-2.5 r24 text-sm font-bold shadow-md hover:bg-blue-700 transition">+ 새 프로젝트</button></div></div><div id="dev-list-view" class="flex-1 overflow-y-auto hide-scrollbar hidden"><div id="dev-list-body" class="space-y-1.5"></div></div><div id="dev-board-view" class="flex-1 overflow-x-auto hide-scrollbar" style="min-height:0"><div class="flex gap-4 h-full pb-4 min-w-max">'+['기획중','개발중','QA/테스트','배포완료','보류'].map(function(s){var m=DEV_STATUS_META[s];return'<div class="w-72 flex flex-col"><div class="flex items-center gap-2 mb-3 px-2"><span class="w-2.5 h-2.5 rounded-full '+m.dot+'"></span><span class="text-xs font-black text-gray-600 uppercase tracking-wider">'+s+'</span><span class="text-xs text-gray-400 font-bold ml-auto" id="dev-cnt-'+s+'"></span></div><div class="space-y-3 flex-1 overflow-y-auto hide-scrollbar" id="dev-board-'+s+'"></div></div>';}).join('')+'</div></div>';}
function setDevView(v){devView=v;var lv=document.getElementById('dev-list-view'),bv=document.getElementById('dev-board-view');if(lv)lv.classList.toggle('hidden',v!=='list');if(bv)bv.classList.toggle('hidden',v!=='board');['list','board'].forEach(function(x){var b=document.getElementById('dev-view-'+x);if(b)b.className='px-4 py-2 r20 transition text-xs font-bold '+(x===v?'bg-gray-100 text-gray-800':'text-gray-400');});renderDevProjects();}
function renderDevProjects(){initDevTab();var sf=(document.getElementById('dev-status-filter')||{value:'all'}).value;var kw=(document.getElementById('dev-search')||{value:''}).value.toLowerCase();var data=CACHE.devProjects.filter(function(p){return(sf==='all'||p.status===sf)&&(!kw||(p.title||'').toLowerCase().indexOf(kw)>-1||(p.tags||'').toLowerCase().indexOf(kw)>-1);});var cnt=document.getElementById('dev-project-count');if(cnt)cnt.innerText='총 '+data.length+'개';if(devView==='list')renderDevListView(data);else renderDevBoardView(data);}
function renderDevListView(data){var el=document.getElementById('dev-list-body');if(!el)return;if(!data.length){el.innerHTML='<div class="text-center py-16 text-gray-400 font-bold text-sm">프로젝트가 없습니다.</div>';return;}el.innerHTML=data.map(function(p){var m=DEV_STATUS_META[p.status]||DEV_STATUS_META['보류'];return'<div onclick="openDevDetail(\''+p.id+'\')" class="group flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 bg-white r24 border border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer transition mb-1.5"><div class="flex items-center gap-3 flex-1 min-w-0"><span class="w-2 h-2 rounded-full '+m.dot+' shrink-0"></span><p class="font-black text-gray-800 text-sm truncate group-hover:text-blue-600">'+esc(p.title)+'</p></div><div class="flex items-center gap-3 flex-wrap">'+priorityHtml(p.priority)+'<span class="text-xs px-3 py-1 r20 font-black '+m.badge+'">'+p.status+'</span><div class="flex items-center gap-2"><div class="w-20 progress-bar"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div><span class="text-xs font-black text-blue-600">'+(p.progress||0)+'%</span></div><div class="flex">'+avatarHtml(p.assignees)+'</div></div></div>';}).join('');}
function renderDevBoardView(data){['기획중','개발중','QA/테스트','배포완료','보류'].forEach(function(s){var colEl=document.getElementById('dev-board-'+s);var cntEl=document.getElementById('dev-cnt-'+s);if(!colEl)return;var items=data.filter(function(p){return p.status===s;});if(cntEl)cntEl.innerText=items.length+'건';if(!items.length){colEl.innerHTML='<div class="text-xs text-gray-300 font-bold text-center py-8 border-2 border-dashed border-gray-100 r24">없음</div>';return;}colEl.innerHTML=items.map(function(p){var pm=PRIORITY_META[p.priority];return'<div onclick="openDevDetail(\''+p.id+'\')" class="bg-white border border-gray-100 hover:border-blue-300 p-5 r24 cursor-pointer shadow-sm hover:shadow-md transition group"><div class="flex items-start justify-between mb-2 gap-2"><p class="font-black text-gray-800 text-sm leading-snug group-hover:text-blue-600 flex-1">'+esc(p.title)+'</p>'+(pm?'<span class="text-[10px] px-2 py-0.5 r20 font-black shrink-0 '+pm.bg+' '+pm.text+'"><i class="'+pm.icon+'"></i>'+p.priority+'</span>':'')+'</div><div class="flex gap-1 flex-wrap mb-3">'+tagHtml(p.tags)+'</div><div class="progress-bar mb-3"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div><div class="flex justify-between items-center"><div class="flex">'+avatarHtml(p.assignees,3)+'</div><span class="text-[10px] text-gray-400 font-bold">'+(p.end||'')+'</span></div></div>';}).join('');});}

function openDevDetail(id){var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d)return;
  renderModalRoot('dev-detail-modal','<div class="bg-white r35 modal-content max-w-2xl p-8 md:p-10 shadow-2xl fade-in relative"><button onclick="closeModal(\'dev-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-xl md:text-2xl font-black text-gray-900 mb-4 pr-10">'+priorityHtml(d.priority,'md')+' '+esc(d.title)+'</h2><div class="flex gap-2 flex-wrap mb-4">'+tagHtml(d.tags)+'<span class="text-xs px-3 py-1 r20 font-black '+(DEV_STATUS_META[d.status]||DEV_STATUS_META['보류']).badge+'">'+d.status+'</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-5 r24 text-sm"><div><span class="text-gray-400 text-xs font-bold">기간</span><p class="font-bold text-gray-700">'+(d.start||'-')+' ~ '+(d.end||'-')+'</p></div><div><span class="text-gray-400 text-xs font-bold">진행률</span><div class="flex items-center gap-2 mt-1"><div class="flex-1 progress-bar"><div class="progress-fill" style="width:'+(d.progress||0)+'%"></div></div><span class="text-sm font-black text-blue-600">'+(d.progress||0)+'%</span></div></div><div class="md:col-span-2"><span class="text-gray-400 text-xs font-bold">담당자</span><div class="flex gap-1 mt-1">'+avatarHtml(d.assignees,8)+'</div></div></div><div class="bg-gray-50 p-5 r24 mb-6"><p class="text-xs font-black text-gray-400 mb-2">설명</p><p class="text-sm text-gray-700 whitespace-pre-wrap">'+esc(d.note||'설명 없음')+'</p></div><div class="flex justify-end gap-3"><button onclick="closeModal(\'dev-detail-modal\');openDevModal(CACHE.devProjects.find(function(x){return x.id===\''+d.id+'\';}))" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">수정</button><button onclick="confirmDeleteDev2(\''+d.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold hover:bg-red-100 transition">삭제</button></div></div>');
  openModal('dev-detail-modal');
}
function confirmDeleteDev2(id){openCustomConfirm("프로젝트 삭제","정말 삭제하시겠습니까?",function(){CACHE.devProjects=CACHE.devProjects.filter(function(x){return x.id!==id;});closeModal('dev-detail-modal');renderDevProjects();FB.remove('devProjects/'+id);showToast("삭제 완료");});}

function openDevModal(data){
  renderModalRoot('dev-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black text-blue-600 mb-6"><i class="ri-macbook-fill"></i> '+(data?'프로젝트 수정':'프로젝트 생성')+'</h2><input id="dev-title" type="text" value="'+(data?esc(data.title):'')+'" placeholder="프로젝트명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50 focus:border-blue-500"><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">우선순위</label><select id="dev-priority-select" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50"><option value="P1" '+(data&&data.priority==='P1'?'selected':'')+'>P1 긴급</option><option value="P2" '+(data&&data.priority==='P2'?'selected':'')+'>P2 높음</option><option value="P3" '+((!data||data.priority==='P3')?'selected':'')+'>P3 보통</option><option value="P4" '+(data&&data.priority==='P4'?'selected':'')+'>P4 낮음</option></select></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">상태</label><select id="dev-status" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50">'+Object.keys(DEV_STATUS_META).map(function(s){return'<option value="'+s+'" '+(data&&data.status===s?'selected':'')+'>'+s+'</option>';}).join('')+'</select></div></div><div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">태그 (쉼표 구분)</label><input id="dev-tags-input" type="text" value="'+(data?esc(data.tags||''):'')+'" placeholder="iOS, API" class="w-full border p-4 r24 outline-none text-sm bg-gray-50"></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">시작일</label><input id="dev-start" type="date" value="'+(data?data.start||'':'')+'" class="w-full border p-4 r24 outline-none text-sm"></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">마감일</label><input id="dev-end" type="date" value="'+(data?data.end||'':'')+'" class="w-full border p-4 r24 outline-none text-sm"></div></div><div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">진행률 (%)</label><input id="dev-progress" type="number" min="0" max="100" value="'+(data?data.progress||0:0)+'" class="w-full border p-4 r24 outline-none text-base font-black text-blue-600 text-center"></div><div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">참여 인원</label><div id="dev-assignees-container" class="w-full border p-4 r24 bg-white max-h-32 overflow-y-auto space-y-2 hide-scrollbar shadow-inner"></div></div><textarea id="dev-note" rows="3" placeholder="프로젝트 설명" class="w-full border p-4 r24 mb-6 outline-none text-sm">'+(data?esc(data.note||''):'')+'</textarea><input type="hidden" id="dev-edit-id" value="'+(data?data.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'dev-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button onclick="submitDevProject()" class="px-8 py-3.5 bg-blue-600 text-white r35 text-sm font-bold shadow-lg hover:bg-blue-700 transition">'+(data?'수정':'생성')+'</button></div></div>');
  openModal('dev-modal');populateAssignees('dev-assignees-container',data?data.assignees:'');
}
function submitDevProject(){var id=document.getElementById('dev-edit-id').value;var title=document.getElementById('dev-title').value.trim();if(!title)return showToast("프로젝트명을 입력하세요.");var fields={title:title,status:document.getElementById('dev-status').value,progress:Number(document.getElementById('dev-progress').value)||0,start:document.getElementById('dev-start').value,end:document.getElementById('dev-end').value,assignees:getChecked('dev-assignees-container'),note:document.getElementById('dev-note').value,tags:document.getElementById('dev-tags-input').value,priority:document.getElementById('dev-priority-select').value};if(id){var idx=CACHE.devProjects.findIndex(function(x){return x.id===id;});if(idx>-1)Object.assign(CACHE.devProjects[idx],fields);closeModal('dev-modal');showToast("수정 완료!");renderDevProjects();FB.patch('devProjects/'+id,fields);}else{var newId=genId();var obj=Object.assign({id:newId},fields,{creator:USER.email,timestamp:Date.now()});CACHE.devProjects.push(obj);closeModal('dev-modal');showToast("생성 완료!");renderDevProjects();FB.set('devProjects/'+newId,obj);}}

// ═══════════════════════════════════════════════
//  CRM
// ═══════════════════════════════════════════════
var CRM_COLUMNS=[{label:'잠재고객(Lead)',key:'Lead',cls:'text-gray-500'},{label:'연락/미팅(Contact)',key:'Contact',cls:'text-blue-500'},{label:'제안/견적(Proposal)',key:'Proposal',cls:'text-purple-500'},{label:'계약성공(Won)',key:'Won',cls:'text-emerald-600'}];
function initCRMTab(){var el=document.getElementById('tab-crm');if(el.querySelector('#col-crm-Lead'))return;el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-briefcase-4-fill text-emerald-500 mr-2"></i> 영업 파이프라인</h1><div class="flex items-center gap-3 flex-wrap"><input type="text" id="crm-search" oninput="filterCRM()" placeholder="고객사명 검색..." class="px-4 py-3 border r35 text-sm outline-none w-48 bg-white card-shadow"><button onclick="openCRMModal()" class="bg-emerald-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-emerald-600 transition">+ 영업 리드 등록</button></div></div><div class="flex gap-4 flex-1 pb-6 overflow-x-auto hide-scrollbar">'+CRM_COLUMNS.map(function(col){return'<div class="flex-1 min-w-[260px] bg-white p-5 r35 card-shadow flex flex-col"><h2 class="font-black '+col.cls+' text-sm uppercase mb-4 px-2 tracking-wider">'+col.label+'</h2><div id="col-crm-'+col.key+'" class="flex-1 space-y-4 overflow-y-auto hide-scrollbar"></div></div>';}).join('')+'</div>';}
function filterCRM(){initCRMTab();var k=(document.getElementById('crm-search')||{value:''}).value.toLowerCase();renderCRMUI(CACHE.crm.filter(function(c){return(c.company||'').toLowerCase().indexOf(k)>-1||(c.contactName||'').toLowerCase().indexOf(k)>-1;}));}
function renderCRMUI(data){var colMap={'잠재고객(Lead)':'col-crm-Lead','연락/미팅(Contact)':'col-crm-Contact','제안/견적(Proposal)':'col-crm-Proposal','계약성공(Won)':'col-crm-Won'};Object.values(colMap).forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='';});data.forEach(function(d){var colId=colMap[d.status]||'col-crm-Lead';var el=document.getElementById(colId);if(!el)return;el.innerHTML+='<div onclick="openCRMDetail(\''+d.id+'\')" data-id="'+d.id+'" class="bg-white p-5 r24 card-shadow border-2 border-transparent hover:border-emerald-300 card-hover cursor-pointer"><h3 class="text-sm font-black text-gray-800 mb-2 truncate">'+esc(d.company)+'</h3><p class="text-xs text-gray-500 mb-2">'+esc(d.contactName||'-')+'</p><div class="flex gap-2 flex-wrap"><span class="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 r20 font-bold">'+(d.b2Type||'B2B')+'</span></div></div>';});Object.entries(colMap).forEach(function(e){var colId=e[1];var el=document.getElementById(colId);if(!el)return;new Sortable(el,{group:'crm',onEnd:function(ev){var statusMap={'col-crm-Lead':'잠재고객(Lead)','col-crm-Contact':'연락/미팅(Contact)','col-crm-Proposal':'제안/견적(Proposal)','col-crm-Won':'계약성공(Won)'};var ns=statusMap[ev.to.id];var cId=ev.item.getAttribute('data-id');var idx=CACHE.crm.findIndex(function(x){return x.id===cId;});if(idx>-1&&ns&&CACHE.crm[idx].status!==ns){CACHE.crm[idx].status=ns;FB.patch('crm/'+cId,{status:ns});if(ns==='계약성공(Won)')showToast('🎉 계약 성공!');}}});});}
function openCRMModal(data){renderModalRoot('crm-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black text-emerald-700 mb-6"><i class="ri-briefcase-4-fill"></i> '+(data?'고객사 수정':'고객사 등록')+'</h2><input id="crm-company" type="text" value="'+(data?esc(data.company):'')+'" placeholder="고객사명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50"><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><input id="crm-name" type="text" value="'+(data?esc(data.contactName||''):'')+'" placeholder="담당자 이름" class="w-full border p-4 r24 outline-none text-sm"></div><div><input id="crm-phone" type="text" value="'+(data?esc(data.phone||''):'')+'" placeholder="연락처" class="w-full border p-4 r24 outline-none text-sm"></div></div><select id="crm-status" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-gray-50"><option value="잠재고객(Lead)" '+((!data||data.status==='잠재고객(Lead)')?'selected':'')+'>잠재고객</option><option value="연락/미팅(Contact)" '+(data&&data.status==='연락/미팅(Contact)'?'selected':'')+'>연락/미팅</option><option value="제안/견적(Proposal)" '+(data&&data.status==='제안/견적(Proposal)'?'selected':'')+'>제안/견적</option><option value="계약성공(Won)" '+(data&&data.status==='계약성공(Won)'?'selected':'')+'>계약성공</option></select><textarea id="crm-note" rows="3" placeholder="비고" class="w-full border p-4 r24 mb-6 outline-none text-sm">'+(data?esc(data.note||''):'')+'</textarea><input type="hidden" id="crm-edit-id" value="'+(data?data.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'crm-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitCRM()" class="px-8 py-3.5 bg-emerald-600 text-white r35 text-sm font-bold shadow-lg">'+(data?'수정':'등록')+'</button></div></div>');openModal('crm-modal');}
function submitCRM(){var id=document.getElementById('crm-edit-id').value;var comp=document.getElementById('crm-company').value.trim();if(!comp)return showToast("고객사명을 입력하세요.");var fields={company:comp,contactName:document.getElementById('crm-name').value,phone:document.getElementById('crm-phone').value,status:document.getElementById('crm-status').value,note:document.getElementById('crm-note').value,manager:USER.email};if(id){var idx=CACHE.crm.findIndex(function(x){return x.id===id;});if(idx>-1)Object.assign(CACHE.crm[idx],fields);closeModal('crm-modal');showToast("수정 완료!");filterCRM();FB.patch('crm/'+id,fields);}else{var newId=genId();var obj=Object.assign({id:newId},fields,{timestamp:Date.now()});CACHE.crm.push(obj);closeModal('crm-modal');showToast("등록 완료!");filterCRM();FB.set('crm/'+newId,obj);}}
function openCRMDetail(id){var d=CACHE.crm.find(function(x){return String(x.id)===String(id);});if(!d)return;renderModalRoot('crm-detail-modal','<div class="bg-white r35 modal-content max-w-2xl p-8 md:p-10 shadow-2xl relative fade-in"><button onclick="closeModal(\'crm-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-2xl md:text-3xl font-black mb-4 text-gray-900 pr-10">'+esc(d.company)+'</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-5 r24 text-sm"><div><span class="text-gray-400 text-xs font-bold block mb-1">영업 단계</span><span class="font-black text-emerald-700">'+d.status+'</span></div><div><span class="text-gray-400 text-xs font-bold block mb-1">담당자</span><span class="font-bold">'+esc(d.contactName||'-')+' · '+esc(d.phone||'-')+'</span></div></div><div class="bg-gray-50 p-5 r24 mb-6 whitespace-pre-wrap text-sm text-gray-700">'+esc(d.note||'비고 없음')+'</div><div class="flex justify-end gap-3"><button onclick="closeModal(\'crm-detail-modal\');openCRMModal(CACHE.crm.find(function(x){return x.id===\''+d.id+'\';}))" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold">수정</button><button onclick="confirmDeleteCRM(\''+d.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold">삭제</button></div></div>');openModal('crm-detail-modal');}
function confirmDeleteCRM(id){openCustomConfirm("고객사 삭제","정말 삭제하시겠습니까?",function(){CACHE.crm=CACHE.crm.filter(function(x){return x.id!==id;});closeModal('crm-detail-modal');filterCRM();FB.remove('crm/'+id);showToast("삭제 완료");});}

// ═══════════════════════════════════════════════
//  CS
// ═══════════════════════════════════════════════
function initCSTab(){var el=document.getElementById('tab-cs');if(el.querySelector('#col-cs-대기'))return;el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-customer-service-2-fill text-orange-500 mr-2"></i> CS 고객지원</h1><div class="flex gap-3 flex-wrap"><input type="text" id="cs-search" oninput="filterCS()" placeholder="검색..." class="px-4 py-3 border r35 text-sm outline-none w-48 bg-white card-shadow"><button onclick="openCSModal()" class="bg-orange-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 티켓 생성</button></div></div><div class="flex gap-4 flex-1 pb-6 overflow-x-auto hide-scrollbar">'+[['대기','text-red-500','신규 접수'],['처리중','text-orange-500','처리 중'],['완료','text-gray-400','완료']].map(function(x){return'<div class="flex-1 min-w-[260px] bg-white p-5 r35 card-shadow flex flex-col"><h2 class="font-black '+x[1]+' text-sm uppercase mb-4 px-2 tracking-wider">'+x[2]+'</h2><div id="col-cs-'+x[0]+'" class="flex-1 space-y-4 overflow-y-auto hide-scrollbar"></div></div>';}).join('')+'</div>';}
function filterCS(){initCSTab();var k=(document.getElementById('cs-search')||{value:''}).value.toLowerCase();renderCSUI(CACHE.cs.filter(function(c){return(c.customer||'').toLowerCase().indexOf(k)>-1||(c.issue||'').toLowerCase().indexOf(k)>-1;}));}
function renderCSUI(data){['대기','처리중','완료'].forEach(function(s){var el=document.getElementById('col-cs-'+s);if(el)el.innerHTML='';});data.forEach(function(d){var pColor=d.priority==='긴급'?'bg-red-100 text-red-600':'bg-orange-100 text-orange-600';var el=document.getElementById('col-cs-'+(d.status||'대기'));if(!el)return;el.innerHTML+='<div data-id="'+d.id+'" class="bg-white p-5 r24 card-shadow border-2 border-transparent hover:border-orange-300 card-hover cursor-pointer"><span class="text-[10px] px-3 py-1 r20 font-black '+pColor+'">'+d.priority+'</span><h3 class="text-sm font-black text-gray-800 my-2 truncate">'+esc(d.customer)+'</h3><p class="text-xs text-gray-500 line-clamp-2">'+esc(d.issue)+'</p></div>';});['대기','처리중','완료'].forEach(function(s){var el=document.getElementById('col-cs-'+s);if(!el)return;new Sortable(el,{group:'cs',onEnd:function(ev){var ns=ev.to.id.replace('col-cs-','');var cId=ev.item.getAttribute('data-id');var idx=CACHE.cs.findIndex(function(x){return x.id===cId;});if(idx>-1&&CACHE.cs[idx].status!==ns){CACHE.cs[idx].status=ns;FB.patch('cs/'+cId,{status:ns});}}});});}
function openCSModal(){renderModalRoot('cs-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-orange-500"><i class="ri-customer-service-2-fill"></i> 신규 CS 티켓</h2><input id="cs-customer" type="text" placeholder="고객사명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50"><select id="cs-priority" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold"><option value="긴급">긴급</option><option value="보통" selected>보통</option><option value="낮음">낮음</option></select><textarea id="cs-issue" rows="4" placeholder="이슈 상세" class="w-full border p-4 r24 mb-6 outline-none text-sm"></textarea><div class="flex justify-end gap-3"><button onclick="closeModal(\'cs-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitCSTicket()" class="px-8 py-3.5 bg-orange-500 text-white r35 text-sm font-bold shadow-lg">생성</button></div></div>');openModal('cs-modal');}
function submitCSTicket(){var c=document.getElementById('cs-customer').value,i=document.getElementById('cs-issue').value,p=document.getElementById('cs-priority').value;if(!c||!i)return showToast("필수 입력");var id=genId();var obj={id:id,customer:c,issue:i,priority:p,status:'대기',creator:USER.email,timestamp:Date.now()};CACHE.cs.push(obj);closeModal('cs-modal');filterCS();showToast("접수 완료");FB.set('cs/'+id,obj);}

// ═══════════════════════════════════════════════
//  결재 (1차 결재권자 = 해당 팀장 자동 지정)
// ═══════════════════════════════════════════════
function initMonthFilters(){var now=new Date(),y=now.getFullYear(),m=now.getMonth();var os='<option value="all">전체</option>';for(var i=0;i<18;i++){var ty=y,tm=m-i;while(tm<0){tm+=12;ty--;}var v=ty+'-'+pad(tm+1);os+='<option value="'+v+'">'+ty+'년 '+(tm+1)+'월</option>';}['appr-month-filter','leave-month-filter','admin-export-month'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML=os;el.value=y+'-'+pad(m+1);}});}
function matchMonth(d,f){if(f==='all')return true;if(!d)return false;var s=String(d);if(!isNaN(s)&&s.length>10){var dt=new Date(Number(s));s=dt.getFullYear()+'-'+pad(dt.getMonth()+1);}return s.indexOf(f)===0;}

function renderApproval(){
  var el=document.getElementById('tab-approval');
  if(!el.querySelector('#appr-my-drafts')){
    el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-bank-card-fill text-gray-800 mr-2"></i> 지출 및 결재</h1><div class="flex items-center gap-4 flex-wrap"><select id="appr-month-filter" class="border p-3 r35 text-sm font-bold outline-none bg-white card-shadow px-6" onchange="renderApproval()"></select><button onclick="openApprovalModal()" class="bg-gray-900 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-black transition">+ 지출결의서 작성</button></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12"><div><h2 class="text-xl font-bold mb-6 text-gray-700">내가 올린 결재</h2><div id="appr-my-drafts" class="space-y-4"></div></div><div><h2 class="text-xl font-bold mb-6 text-blue-600">내게 온 결재</h2><div id="appr-to-me" class="space-y-4"></div></div></div>';
    initMonthFilters();
  }
  var f=document.getElementById('appr-month-filter')?document.getElementById('appr-month-filter').value:'all';
  var m2='',t2='';
  CACHE.approval.filter(function(d){return matchMonth(d.dateCreated,f);}).forEach(function(d){
    var c='<div class="p-6 md:p-7 border r35 bg-white card-shadow mb-5 card-hover cursor-pointer border-transparent hover:border-blue-300" onclick="openApprovalDetail(\''+d.id+'\')"><div class="flex justify-between items-center mb-3 gap-2"><h3 class="font-black text-base md:text-lg text-gray-800 truncate">'+esc(d.reason)+'</h3>'+statusBadge(d.status)+'</div><div class="flex items-end justify-between bg-gray-50 p-4 r24 mb-3"><div class="text-sm font-bold text-gray-600">'+esc(d.bank)+'</div><b class="text-green-600 text-xl md:text-2xl">₩'+Number(d.amount).toLocaleString()+'</b></div><p class="text-xs text-gray-400 font-bold">기안: '+d.drafterName+' · '+d.date+'</p></div>';
    if((d.drafter||'').toLowerCase()===USER.email)m2+=c;
    if((d.approver1||'').toLowerCase()===USER.email||(d.approver2||'').toLowerCase()===USER.email)t2+=c;
  });
  var md=document.getElementById('appr-my-drafts'),td=document.getElementById('appr-to-me');
  if(md)md.innerHTML=m2||'<p class="text-sm text-gray-400 py-10 text-center font-bold">내역 없음</p>';
  if(td)td.innerHTML=t2||'<p class="text-sm text-gray-400 py-10 text-center font-bold">내역 없음</p>';
}

function openApprovalModal(){
  var myLeader=getTeamLeader(USER.dept);
  var admins=CACHE.members.filter(function(m){return isApprover(m);});
  var opts=admins.map(function(x){var pos=getMemberPosition(x);return'<option value="'+x.email+'" '+(x.email===myLeader?'selected':'')+'>'+x.name+' ('+x.dept+' · '+pos+')</option>';}).join('');
  renderModalRoot('approval-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-10 shadow-2xl fade-in flex flex-col"><h2 class="text-xl md:text-2xl font-black mb-6 border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-gray-800"><span><i class="ri-bank-card-fill text-blue-500 mr-2"></i> 지출결의서 작성</span><button onclick="addApprItemRow()" class="bg-gray-900 text-white px-5 py-2.5 r35 text-sm font-bold">+ 항목 추가</button></h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-5 r35 border border-gray-100"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">1차 결재권자</label><select id="appr-approver1" class="w-full border p-3 r24 text-sm font-bold text-blue-700 bg-white outline-none">'+opts+'</select></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">2차 결재권자</label><select id="appr-approver2" class="w-full border p-3 r24 text-sm font-bold text-blue-700 bg-white outline-none"><option value="">지정안함</option>'+opts+'</select></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2 flex items-center justify-between"><span>입금 요청일 *</span><label class="flex items-center gap-1.5 cursor-pointer text-red-500"><input type="checkbox" id="appr-is-urgent" onchange="toggleApprUrgent()" class="w-4 h-4 accent-red-500"> <span class="text-xs font-bold">긴급</span></label></label><input id="appr-date" type="date" disabled class="w-full border p-3 r24 text-sm font-bold bg-gray-100 outline-none cursor-not-allowed text-gray-500"><div id="appr-urgent-warning" class="hidden mt-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold p-3 r20 flex items-start gap-2"><i class="ri-error-warning-fill text-base shrink-0"></i><span>긴급 지출은 결재권자의 일정에 따라 <b>반려될 수 있습니다.</b> 반드시 사전에 결재권자와 협의 후 신청해 주세요.</span></div></div></div><div id="appr-items-container" class="space-y-4 flex-1 overflow-y-auto pr-2 min-h-[200px] hide-scrollbar"></div><div class="flex justify-end gap-3 mt-6 pt-4 border-t"><button onclick="closeModal(\'approval-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button id="btn-submit-appr" onclick="submitApprovalBulk()" class="px-8 py-3.5 bg-blue-600 text-white r35 text-sm font-bold shadow-lg">결재 올리기</button></div></div>');
  openModal('approval-modal');addApprItemRow();
  // 기본 입금일 = 익월 10일
  var d2=new Date();var y2=d2.getFullYear(),mo=d2.getMonth()+2;if(mo>12){mo=1;y2++;}
  var dateEl=document.getElementById('appr-date');if(dateEl)dateEl.value=y2+'-'+pad(mo)+'-10';
}
function toggleApprUrgent(){
  var isUrgent=document.getElementById('appr-is-urgent').checked;
  var dateEl=document.getElementById('appr-date');
  var warn=document.getElementById('appr-urgent-warning');
  if(isUrgent){
    dateEl.disabled=false;dateEl.classList.remove('bg-gray-100','cursor-not-allowed','text-gray-500');dateEl.classList.add('bg-white','border-red-300','text-red-600');
    if(warn)warn.classList.remove('hidden');
  }else{
    // 다시 익월 10일로 복원
    var d2=new Date();var y2=d2.getFullYear(),mo=d2.getMonth()+2;if(mo>12){mo=1;y2++;}
    dateEl.value=y2+'-'+pad(mo)+'-10';
    dateEl.disabled=true;dateEl.classList.add('bg-gray-100','cursor-not-allowed','text-gray-500');dateEl.classList.remove('bg-white','border-red-300','text-red-600');
    if(warn)warn.classList.add('hidden');
  }
}
function addApprItemRow(){
  var bankOpts='<option value="">은행</option><option>국민은행</option><option>신한은행</option><option>우리은행</option><option>하나은행</option><option>농협은행</option><option>기업은행</option><option>카카오뱅크</option><option>토스뱅크</option><option>기타</option>';
  var html='<div class="appr-item-row bg-gray-50 border border-gray-100 p-5 r35 relative">'+
    '<button onclick="this.parentElement.remove()" class="absolute top-4 right-4 text-gray-300 hover:text-red-500"><i class="ri-close-circle-fill text-xl"></i></button>'+
    // 지출 사유
    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 pl-1">지출 사유</label>'+
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">'+
    '<select class="appr-reason-select border p-3 r24 text-sm font-bold outline-none bg-white" onchange="var row=this.closest(\'.appr-item-row\');row.querySelector(\'.appr-reason-custom\').classList.toggle(\'hidden\',this.value!==\'기타\');">'+
    '<option value="">분류 선택 *</option><option value="식대">식대</option><option value="교통/유류비">교통/유류비</option><option value="사무용품/비품">사무용품/비품</option><option value="소프트웨어/구독">소프트웨어/구독</option><option value="회의비">회의비</option><option value="접대비">접대비</option><option value="출장비">출장비</option><option value="기타">기타</option></select>'+
    '<input type="text" class="appr-reason-custom hidden border p-3 r24 text-sm outline-none bg-white" placeholder="기타 사유 입력"></div>'+
    // 상세 내역
    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 pl-1">상세 내역</label>'+
    '<input type="text" class="appr-detail w-full border p-3 r24 text-sm outline-none bg-white mb-3" placeholder="예: 4/3 점심 팀 회식 5명, 택시비 강남→판교, AWS 월 구독료 등">'+
    // 결제 수단
    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 pl-1">결제 수단</label>'+
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">'+
    '<select class="appr-pay-method border p-3 r24 text-sm font-bold outline-none bg-white">'+
    '<option value="법인카드">법인카드</option><option value="개인카드 (환급)">개인카드 (환급)</option><option value="현금 (환급)">현금 (환급)</option><option value="계좌이체">계좌이체</option></select>'+
    '<input type="text" class="appr-pay-detail border p-3 r24 text-sm outline-none bg-white" placeholder="카드번호 뒤 4자리 / 참고사항"></div>'+
    // 입금 계좌 & 금액
    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 pl-1">입금 정보</label>'+
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">'+
    '<select class="appr-bank border p-3 r24 text-sm font-bold outline-none bg-white">'+bankOpts+'</select>'+
    '<input type="text" class="appr-account border p-3 r24 text-sm font-bold bg-white" placeholder="계좌번호">'+
    '<input type="number" class="appr-amount border p-3 r24 text-base font-black text-green-600 bg-white" placeholder="금액(원)"></div>'+
    '</div>';
  var c2=document.getElementById('appr-items-container');if(c2)c2.insertAdjacentHTML('beforeend',html);
}
function submitApprovalBulk(){
  var a1=document.getElementById('appr-approver1')?document.getElementById('appr-approver1').value:'';
  var a2=document.getElementById('appr-approver2')?document.getElementById('appr-approver2').value:'';
  var date=document.getElementById('appr-date')?document.getElementById('appr-date').value:'';
  if(!a1||!date){showToast("1차 결재권자와 입금일 필수");return;}
  var rows=document.querySelectorAll('.appr-item-row');if(!rows.length){showToast("최소 1항목 필요");return;}
  var valid=true;
  rows.forEach(function(row){var rs=row.querySelector('.appr-reason-select').value,rc=row.querySelector('.appr-reason-custom').value;var reason=rs==='기타'?rc:rs;var bank=row.querySelector('.appr-bank').value,account=row.querySelector('.appr-account').value,amount=row.querySelector('.appr-amount').value;if(!reason||!bank||!account||!amount){showToast("사유, 은행, 계좌, 금액은 필수입니다");valid=false;}});
  if(!valid)return;
  var isUrgent=document.getElementById('appr-is-urgent').checked;
  rows.forEach(function(row){var rs=row.querySelector('.appr-reason-select').value,rc=row.querySelector('.appr-reason-custom').value;var reason=rs==='기타'?rc:rs;var detail=row.querySelector('.appr-detail')?row.querySelector('.appr-detail').value:'';var payMethod=row.querySelector('.appr-pay-method')?row.querySelector('.appr-pay-method').value:'';var payDetail=row.querySelector('.appr-pay-detail')?row.querySelector('.appr-pay-detail').value:'';var id=genId();var obj={id:id,reason:reason,detail:detail,payMethod:payMethod,payDetail:payDetail,bank:row.querySelector('.appr-bank').value,account:row.querySelector('.appr-account').value,amount:row.querySelector('.appr-amount').value,approver1:a1,approver2:a2||'',date:date,isUrgent:isUrgent,drafter:USER.email,drafterName:USER.name,status:'대기',dateCreated:Date.now()};CACHE.approval.push(obj);FB.set('approvals/'+id,obj);});
  closeModal('approval-modal');showToast("제출 완료!");updateBadges();renderApproval();
}
function openApprovalDetail(id){var d=CACHE.approval.find(function(x){return String(x.id)===String(id);});if(!d)return;var btns='';if((d.drafter||'').toLowerCase()===USER.email&&d.status==='대기')btns='<button onclick="withdrawApprovalAction(\''+d.id+'\')" class="px-6 py-3 bg-gray-200 text-gray-700 r35 text-sm font-bold">기안 철회</button>';else if(d.status==='대기'&&(d.approver1||'').toLowerCase()===USER.email){var ns=d.approver2?'1차 승인':'최종 승인';btns='<button onclick="openRejectModal(\''+d.id+'\',\'approval\')" class="px-6 py-3 border border-red-200 text-red-600 r35 text-sm font-bold">반려</button><button onclick="actionApproval(\''+d.id+'\',\''+ns+'\')" class="px-6 py-3 bg-black text-white r35 text-sm font-bold shadow-lg">'+ns+'</button>';}else if(d.status==='1차 승인'&&(d.approver2||'').toLowerCase()===USER.email)btns='<button onclick="openRejectModal(\''+d.id+'\',\'approval\')" class="px-6 py-3 border border-red-200 text-red-600 r35 text-sm font-bold">반려</button><button onclick="actionApproval(\''+d.id+'\',\'최종 승인\')" class="px-6 py-3 bg-blue-600 text-white r35 text-sm font-bold shadow-lg">최종 승인</button>';renderModalRoot('approval-detail-modal','<div class="bg-white r35 modal-content max-w-2xl p-8 md:p-10 shadow-2xl relative fade-in"><button onclick="closeModal(\'approval-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-xl md:text-2xl font-black mb-6 border-b pb-4 text-gray-800">지출 결재 상세'+(d.isUrgent?' <span class="text-sm bg-red-100 text-red-600 px-3 py-1 r20 font-bold ml-2">긴급</span>':'')+'</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-6 r35"><div><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">항목</span><span class="font-bold text-gray-800 text-lg">'+esc(d.reason)+'</span></div><div><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">금액</span><span class="font-black text-blue-600 text-xl">₩'+Number(d.amount).toLocaleString()+'</span></div><div><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">기안자</span><span class="font-bold">'+d.drafterName+'</span></div><div><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">상태</span>'+statusBadge(d.status)+'</div>'+(d.detail?'<div class="md:col-span-2"><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">상세 내역</span><span class="font-bold text-gray-700 bg-white p-3 r20 block border">'+esc(d.detail)+'</span></div>':'')+(d.payMethod?'<div><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">결제 수단</span><span class="font-bold text-gray-700">'+esc(d.payMethod)+(d.payDetail?' · '+esc(d.payDetail):'')+'</span></div>':'')+'<div'+(d.payMethod?'':' class="md:col-span-2"')+'><span class="text-gray-400 font-bold block mb-1 text-xs uppercase">은행/계좌</span><span class="font-bold text-gray-700">'+esc(d.bank)+' '+esc(d.account)+'</span></div>'+(d.rejectReason?'<div class="md:col-span-2"><span class="text-red-500 font-bold block mb-1 text-xs">반려 사유</span><span class="bg-red-50 text-red-600 p-3 r20 font-bold block">'+esc(d.rejectReason)+'</span></div>':'')+'</div><div class="flex justify-end gap-3 mt-6 border-t pt-4">'+btns+'</div></div>');openModal('approval-detail-modal');}
function withdrawApprovalAction(id){openCustomConfirm("기안 철회","철회하시겠습니까?",function(){var d=CACHE.approval.find(function(x){return x.id===id;});if(d)d.status='철회';FB.patch('approvals/'+id,{status:'철회'});closeModal('approval-detail-modal');showToast("철회 완료");updateBadges();renderApproval();});}
function actionApproval(id,s){var d=CACHE.approval.find(function(x){return x.id===id;});if(!d)return;openCustomConfirm("결재 승인","["+s+"] 처리하시겠습니까?",function(){d.status=s;FB.patch('approvals/'+id,{status:s});closeModal('approval-detail-modal');showToast("승인 완료");updateBadges();renderApproval();});}
function openRejectModal(id,type){renderModalRoot('reject-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in text-center"><div class="text-red-500 text-5xl mb-4"><i class="ri-close-circle-fill"></i></div><h2 class="text-xl font-black mb-3 text-red-600">반려 사유 입력</h2><textarea id="reject-reason-input" rows="4" placeholder="반려 사유" class="w-full border p-4 r24 outline-none text-sm mb-6 bg-gray-50"></textarea><div class="flex justify-center gap-3"><button onclick="closeModal(\'reject-modal\')" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="confirmReject(\''+id+'\',\''+type+'\')" class="px-6 py-3 bg-red-600 text-white r35 text-sm font-bold shadow-lg">반려 확정</button></div></div>');openModal('reject-modal');}
function confirmReject(id,type){var r=document.getElementById('reject-reason-input')?document.getElementById('reject-reason-input').value:'';if(type==='approval'){var d=CACHE.approval.find(function(x){return x.id===id;});if(d){d.status='반려';d.rejectReason=r;}FB.patch('approvals/'+id,{status:'반려',rejectReason:r});closeModal('reject-modal');closeModal('approval-detail-modal');showToast("반려 완료");updateBadges();renderApproval();}else{var d2=CACHE.leaves.find(function(x){return x.id===id;});if(d2)d2.status='반려';FB.patch('leaves/'+id,{status:'반려'});closeModal('reject-modal');closeModal('leave-detail-modal');showToast("반려 완료");updateBadges();renderLeaves();}}

// ═══════════════════════════════════════════════
//  Vault
// ═══════════════════════════════════════════════
function renderVault(){var el=document.getElementById('tab-vault');if(!el.querySelector('#vault-search-input')){el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><div><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-shield-keyhole-fill text-amber-500 mr-2"></i> 팀 보안 금고</h1></div><div class="flex items-center gap-3 flex-wrap"><input type="text" id="vault-search-input" oninput="filterVaultUI()" placeholder="검색..." class="px-4 py-3 border border-amber-200 r35 text-sm outline-none w-56 bg-amber-50/30"><button onclick="openVaultModal()" class="bg-amber-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 신규 등록</button></div></div><div id="vault-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>';}filterVaultUI();}
function filterVaultUI(){var k=(document.getElementById('vault-search-input')||{value:''}).value.toLowerCase().trim();renderVaultGrid(k?CACHE.vault.filter(function(v){return String(v.category||'').toLowerCase().indexOf(k)>-1||String(v.loginId||'').toLowerCase().indexOf(k)>-1;}):CACHE.vault);}
function renderVaultGrid(data){var el=document.getElementById('vault-grid');if(!el)return;el.innerHTML=!data.length?'<p class="col-span-3 text-sm text-gray-400 text-center py-10">등록된 계정이 없습니다.</p>':data.map(function(d){return'<div class="p-6 md:p-8 border border-amber-200 r35 bg-white card-shadow relative"><button onclick="event.stopPropagation();openVaultModal(\''+d.id+'\')" class="absolute top-5 right-14 text-gray-400 hover:text-amber-600"><i class="ri-edit-line text-xl"></i></button><button onclick="event.stopPropagation();confirmDeleteVault(\''+d.id+'\')" class="absolute top-5 right-5 text-red-300 hover:text-red-500"><i class="ri-delete-bin-line text-xl"></i></button><h3 class="font-black text-xl text-gray-800 mb-4 truncate pr-16"><i class="ri-key-2-fill text-amber-500 mr-2"></i>'+esc(d.category)+'</h3><div class="bg-amber-50/50 rounded-2xl p-4 text-sm mb-3 border border-amber-100"><div class="flex justify-between items-center mb-3"><span class="text-amber-700 text-xs font-bold">ID</span><span class="font-bold cursor-pointer bg-white px-3 py-1 r20 shadow-sm text-sm" onclick="navigator.clipboard.writeText(\''+esc(d.loginId)+'\').then(function(){showToast(\'복사!\');})">'+esc(d.loginId)+' <i class="ri-file-copy-line text-xs"></i></span></div><div class="flex justify-between items-center"><span class="text-amber-700 text-xs font-bold">PW</span><span class="font-bold cursor-pointer bg-white px-3 py-1 r20 shadow-sm text-sm" onclick="copyVaultPw(\''+d.id+'\')">•••••••• <i class="ri-file-copy-line text-xs"></i></span></div></div><p class="text-[10px] text-gray-400 font-bold">권한: '+d.visibility+'</p></div>';}).join('');}
function copyVaultPw(id){db.ref('vault/'+id).once('value',function(snap){var v=snap.val();if(!v){showToast("계정 없음");return;}var ok=USER.role==='ADMIN'||v.creator===USER.email||v.visibility==='ALL'||(v.visibility||'').indexOf(USER.dept)>-1||(v.visibility||'').indexOf(USER.email)>-1;if(ok){navigator.clipboard.writeText(v.password).then(function(){showToast("PW 복사 완료!");});}else showToast("권한 없음");});}
function openVaultModal(id){var v=id?CACHE.vault.find(function(x){return String(x.id)===String(id);}):null;renderModalRoot('vault-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-amber-600"><i class="ri-shield-keyhole-fill"></i> '+(v?'수정':'보안 계정 등록')+'</h2><input id="vault-category" type="text" value="'+(v?esc(v.category):'')+'" placeholder="서비스명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50"><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><input id="vault-loginid" type="text" value="'+(v?esc(v.loginId):'')+'" placeholder="ID" class="w-full border p-4 r24 outline-none text-sm"></div><div><input id="vault-password" type="password" placeholder="'+(v?'변경시만 입력':'PW')+'" class="w-full border p-4 r24 outline-none text-sm"></div></div><textarea id="vault-note" rows="2" placeholder="비고" class="w-full border p-4 r24 mb-4 outline-none text-sm">'+(v?esc(v.note||''):'')+'</textarea><select id="vault-visibility-select" class="w-full border p-4 r24 mb-6 outline-none text-sm font-bold bg-amber-50"><option value="PRIVATE" '+((!v||v.visibility==='PRIVATE')?'selected':'')+'>나만 보기</option><option value="ALL" '+(v&&v.visibility==='ALL'?'selected':'')+'>전체 공개</option></select><input type="hidden" id="vault-edit-id" value="'+(v?v.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'vault-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitVault()" class="px-8 py-3.5 bg-amber-500 text-white r35 text-sm font-bold shadow-lg">저장</button></div></div>');openModal('vault-modal');}
function submitVault(){var id=document.getElementById('vault-edit-id').value;var cat=document.getElementById('vault-category').value.trim(),lid=document.getElementById('vault-loginid').value,pw=document.getElementById('vault-password').value,note=document.getElementById('vault-note').value,vis=document.getElementById('vault-visibility-select').value;if(!cat||!lid||(id===''&&!pw))return showToast("필수 항목 입력");if(id){var updates={category:cat,loginId:lid,note:note,visibility:vis};if(pw)updates.password=pw;var idx=CACHE.vault.findIndex(function(x){return String(x.id)===String(id);});if(idx>-1)Object.assign(CACHE.vault[idx],updates);closeModal('vault-modal');showToast("수정 완료");renderVault();FB.patch('vault/'+id,updates);}else{if(!pw)return showToast("비밀번호 입력");var newId=genId();var obj={id:newId,category:cat,loginId:lid,password:pw,note:note,visibility:vis,creator:USER.email};CACHE.vault.push(Object.assign({},obj,{password:'••••••••'}));closeModal('vault-modal');showToast("등록 완료");renderVault();FB.set('vault/'+newId,obj);}}
function confirmDeleteVault(id){openCustomConfirm("계정 삭제","삭제할까요?",function(){CACHE.vault=CACHE.vault.filter(function(x){return x.id!==id;});showToast("삭제됨");renderVault();FB.remove('vault/'+id);});}

// ═══════════════════════════════════════════════
//  위키 (PDF 업로드 지원)
// ═══════════════════════════════════════════════
function renderWiki(){var el=document.getElementById('tab-wiki');if(!el.querySelector('#wiki-search-input')){el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-book-read-fill text-gray-800 mr-2"></i> 사내 위키</h1><div class="flex items-center gap-3 flex-wrap"><input type="text" id="wiki-search-input" oninput="filterWikiUI()" placeholder="검색..." class="px-4 py-3 border r35 text-sm outline-none w-56 bg-white card-shadow"><button onclick="openWikiModal()" class="bg-gray-800 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 새 문서</button></div></div><div id="wiki-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>';}filterWikiUI();}
function filterWikiUI(){var k=(document.getElementById('wiki-search-input')||{value:''}).value.toLowerCase();var data=CACHE.wiki.filter(function(w){return(w.title||'').toLowerCase().indexOf(k)>-1||(w.content||'').toLowerCase().indexOf(k)>-1;});var el=document.getElementById('wiki-grid');if(!el)return;el.innerHTML=!data.length?'<p class="col-span-2 text-sm text-gray-400 text-center py-10">문서가 없습니다.</p>':data.map(function(d){var isPdf=!!d.pdfData;return'<div onclick="openWikiDetail(\''+d.id+'\')" class="p-6 md:p-8 border r35 bg-white card-shadow hover:shadow-xl card-hover cursor-pointer transition"><div class="flex items-center gap-3 mb-3">'+(isPdf?'<i class="ri-file-pdf-2-fill text-red-500 text-2xl shrink-0"></i>':'<i class="ri-file-text-line text-gray-400 text-2xl shrink-0"></i>')+'<h3 class="font-black text-xl md:text-2xl text-gray-800 truncate">'+esc(d.title)+'</h3></div><p class="text-sm text-gray-500 line-clamp-3 leading-relaxed">'+(isPdf?'📄 PDF 문서':esc(d.content))+'</p><p class="text-[10px] text-gray-400 mt-3 font-bold">'+getMemberName(d.author)+'</p></div>';}).join('');}
function openWikiModal(){renderModalRoot('wiki-modal','<div class="bg-white r35 modal-content max-w-3xl p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-gray-800">새 문서 작성</h2><input id="wiki-title" type="text" placeholder="문서 제목" class="w-full text-2xl font-black border-b-2 mb-6 p-3 outline-none text-gray-800"><div class="flex gap-3 mb-4"><button onclick="showWikiTextForm()" id="wiki-tab-text" class="px-4 py-2 r24 text-sm font-bold bg-gray-100 text-gray-800">텍스트</button><button onclick="showWikiPdfForm()" id="wiki-tab-pdf" class="px-4 py-2 r24 text-sm font-bold text-gray-400">PDF 업로드</button></div><div id="wiki-text-form"><textarea id="wiki-content" rows="10" placeholder="내용을 입력하세요..." class="w-full border r24 p-5 mb-6 outline-none text-base leading-relaxed bg-gray-50"></textarea></div><div id="wiki-pdf-form" class="hidden"><label class="flex flex-col items-center justify-center w-full h-40 upload-zone r24 bg-white mb-6"><i class="ri-file-pdf-2-fill text-5xl text-red-400 mb-2"></i><span class="text-sm font-bold text-gray-400" id="wiki-pdf-name">클릭하여 PDF 업로드</span><input type="file" accept=".pdf" class="hidden" id="wiki-pdf-input" onchange="handleWikiPdf(this)"></label></div><div class="flex justify-end gap-3"><button onclick="closeModal(\'wiki-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitWiki()" class="px-8 py-3.5 bg-gray-900 text-white r35 text-sm font-bold shadow-lg">게시</button></div></div>');openModal('wiki-modal');}
function showWikiTextForm(){document.getElementById('wiki-text-form').classList.remove('hidden');document.getElementById('wiki-pdf-form').classList.add('hidden');document.getElementById('wiki-tab-text').className='px-4 py-2 r24 text-sm font-bold bg-gray-100 text-gray-800';document.getElementById('wiki-tab-pdf').className='px-4 py-2 r24 text-sm font-bold text-gray-400';}
function showWikiPdfForm(){document.getElementById('wiki-text-form').classList.add('hidden');document.getElementById('wiki-pdf-form').classList.remove('hidden');document.getElementById('wiki-tab-pdf').className='px-4 py-2 r24 text-sm font-bold bg-red-100 text-red-700';document.getElementById('wiki-tab-text').className='px-4 py-2 r24 text-sm font-bold text-gray-400';}
var wikiPdfBase64=null;
function handleWikiPdf(input){if(!input.files[0])return;var file=input.files[0];if(file.size>5*1024*1024){showToast("5MB 이하 파일만 가능합니다.");return;}document.getElementById('wiki-pdf-name').innerText=file.name;var reader=new FileReader();reader.onload=function(e){wikiPdfBase64=e.target.result;};reader.readAsDataURL(file);}
function submitWiki(){var t=document.getElementById('wiki-title').value;if(!t)return showToast("제목을 입력하세요.");var isPdfMode=!document.getElementById('wiki-pdf-form').classList.contains('hidden');var id=genId();if(isPdfMode&&wikiPdfBase64){var obj={id:id,title:t,author:USER.email,content:'[PDF 문서]',pdfData:wikiPdfBase64,visibility:'ALL',createdAt:Date.now()};CACHE.wiki.push(obj);closeModal('wiki-modal');wikiPdfBase64=null;showToast("PDF 문서 저장 완료");filterWikiUI();FB.set('wiki/'+id,obj);}else{var c=document.getElementById('wiki-content').value;var obj2={id:id,title:t,author:USER.email,content:c,visibility:'ALL',createdAt:Date.now()};CACHE.wiki.push(obj2);closeModal('wiki-modal');showToast("저장 완료");filterWikiUI();FB.set('wiki/'+id,obj2);}}
function openWikiDetail(id){var w=CACHE.wiki.find(function(x){return String(x.id)===String(id);});if(!w)return;var isPdf=!!w.pdfData;renderModalRoot('wiki-detail-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-12 shadow-2xl relative fade-in"><button onclick="closeModal(\'wiki-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-2xl md:text-3xl font-black mb-4 text-gray-900 pr-10">'+esc(w.title)+'</h2><p class="text-sm font-bold text-gray-400 mb-6 pb-4 border-b">작성자: '+getMemberName(w.author)+'</p>'+(isPdf?'<div class="text-center mb-6"><a href="'+w.pdfData+'" download="'+esc(w.title)+'.pdf" class="inline-flex items-center gap-3 bg-red-50 text-red-600 px-8 py-4 r35 font-bold text-base hover:bg-red-100 transition"><i class="ri-file-pdf-2-fill text-2xl"></i> PDF 다운로드</a></div>':'<div class="text-base md:text-lg text-gray-700 whitespace-pre-wrap leading-loose min-h-[150px] mb-6">'+esc(w.content)+'</div>')+(USER.role==='ADMIN'||w.author===USER.email?'<div class="flex justify-end gap-3 border-t pt-6"><button onclick="confirmDeleteWiki(\''+w.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold">삭제</button></div>':'')+'</div>');openModal('wiki-detail-modal');}
function confirmDeleteWiki(id){openCustomConfirm("문서 삭제","삭제하시겠습니까?",function(){CACHE.wiki=CACHE.wiki.filter(function(x){return x.id!==id;});closeModal('wiki-detail-modal');showToast("삭제 완료");filterWikiUI();FB.remove('wiki/'+id);});}

// ═══════════════════════════════════════════════
//  휴가
// ═══════════════════════════════════════════════
function renderLeaves(){
  var el=document.getElementById('tab-leaves');
  if(!el.querySelector('#leave-my-list')){
    el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-flight-takeoff-fill text-purple-500 mr-2"></i> 휴가 및 근태</h1><div class="flex items-center gap-3 flex-wrap"><select id="leave-month-filter" class="border p-3 r35 text-sm font-bold outline-none bg-white card-shadow px-6" onchange="renderLeaves()"></select><button onclick="openLeaveModal()" class="bg-purple-600 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 휴가 신청</button></div></div><div class="mb-8 p-8 md:p-10 bg-white border border-purple-100 r35 card-shadow flex flex-col md:flex-row justify-around items-center text-center gap-4"><div><p class="text-sm font-bold text-gray-500 mb-2">총 연차</p><p class="text-3xl md:text-4xl font-black text-gray-800">'+CACHE.leaveInfo.total+' 일</p></div><div class="hidden md:block w-px h-16 bg-gray-200"></div><div><p class="text-sm font-bold text-gray-500 mb-2">사용</p><p class="text-3xl md:text-4xl font-black text-pink-500">'+CACHE.leaveInfo.used+' 일</p></div><div class="hidden md:block w-px h-16 bg-gray-200"></div><div><p class="text-sm font-bold text-gray-500 mb-2">남은 연차</p><p class="text-3xl md:text-4xl font-black text-purple-600">'+CACHE.leaveInfo.remain+' 일</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12"><div><h2 class="text-xl font-bold mb-6 text-purple-700">내 휴가 신청 내역</h2><div id="leave-my-list" class="space-y-4"></div></div><div><h2 class="text-xl font-bold mb-6 text-gray-700">내게 온 결재 대기함</h2><div id="leave-to-me" class="space-y-4"></div></div></div>';
    initMonthFilters();
  }
  var f=document.getElementById('leave-month-filter')?document.getElementById('leave-month-filter').value:'all';
  var m2='',t2='';
  CACHE.leaves.filter(function(d){return matchMonth(d.startDate,f);}).forEach(function(d){
    var c='<div class="p-6 border r35 bg-white card-shadow mb-4 card-hover cursor-pointer border-transparent hover:border-purple-300" onclick="openLeaveDetail(\''+d.id+'\')"><div class="flex justify-between items-center mb-3 gap-2"><h3 class="font-black text-base text-gray-800">'+d.type+' <span class="text-xs font-normal text-gray-500 ml-2">'+d.applicantName+'</span></h3>'+statusBadge(d.status)+'</div><div class="text-sm font-bold text-purple-600 bg-purple-50 p-3 r20 mb-3 text-center">'+d.startDate+' ~ '+d.endDate+'</div><p class="text-xs text-gray-400 font-bold truncate">'+esc(d.reason)+'</p></div>';
    if((d.applicant||'').toLowerCase()===USER.email)m2+=c;if((d.approver1||'').toLowerCase()===USER.email)t2+=c;
  });
  var ml=document.getElementById('leave-my-list'),tl=document.getElementById('leave-to-me');
  if(ml)ml.innerHTML=m2||'<p class="text-sm py-10 text-center text-gray-400 font-bold">내역 없음</p>';
  if(tl)tl.innerHTML=t2||'<p class="text-sm py-10 text-center text-gray-400 font-bold">내역 없음</p>';
}
function openLeaveModal(){var admins=CACHE.members.filter(function(m){return isApprover(m);});var myLeader=getTeamLeader(USER.dept);renderModalRoot('leave-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-purple-700"><i class="ri-flight-takeoff-fill"></i> 휴가 신청</h2><select id="leave-type" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold text-purple-700 bg-purple-50"><option value="연차">연차</option><option value="반차">반차</option><option value="병가">병가</option><option value="공가">공가</option></select><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">시작일</label><input id="leave-start" type="date" class="w-full border p-4 r24 outline-none text-sm"></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">종료일</label><input id="leave-end" type="date" class="w-full border p-4 r24 outline-none text-sm"></div></div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">결재권자</label><select id="leave-approver" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-white">'+admins.map(function(m){var pos=getMemberPosition(m);return'<option value="'+m.email+'" '+(m.email===myLeader?'selected':'')+'>'+m.name+' ('+m.dept+' · '+pos+')</option>';}).join('')+'</select><textarea id="leave-reason" rows="3" placeholder="사유" class="w-full border p-4 r24 mb-6 outline-none text-sm bg-gray-50"></textarea><div class="flex justify-end gap-3"><button onclick="closeModal(\'leave-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitLeave()" class="px-8 py-3.5 bg-purple-600 text-white r35 text-sm font-bold shadow-lg">결재 올리기</button></div></div>');openModal('leave-modal');}
function submitLeave(){var s=document.getElementById('leave-start').value,e=document.getElementById('leave-end').value,t=document.getElementById('leave-type').value,r=document.getElementById('leave-reason').value,a=document.getElementById('leave-approver').value;if(!s||!a)return showToast("필수 입력");var id=genId();var obj={id:id,applicant:USER.email,applicantName:USER.name,startDate:s,endDate:e||s,type:t,reason:r,status:'대기',approver1:a};CACHE.leaves.push(obj);closeModal('leave-modal');showToast("신청 완료");updateBadges();renderLeaves();FB.set('leaves/'+id,obj);}
function openLeaveDetail(id){var d=CACHE.leaves.find(function(x){return String(x.id)===String(id);});if(!d)return;var btns='';if((d.applicant||'').toLowerCase()===USER.email&&d.status==='대기')btns='<button onclick="withdrawLeaveAction(\''+d.id+'\')" class="px-6 py-3 bg-gray-200 text-gray-700 r35 text-sm font-bold">철회</button>';else if(d.status==='대기'&&(d.approver1||'').toLowerCase()===USER.email)btns='<button onclick="openRejectModal(\''+d.id+'\',\'leave\')" class="px-6 py-3 border border-red-200 text-red-600 r35 text-sm font-bold">반려</button><button onclick="approveLeave(\''+d.id+'\')" class="px-6 py-3 bg-purple-600 text-white r35 text-sm font-bold shadow-lg">승인</button>';renderModalRoot('leave-detail-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl relative fade-in"><button onclick="closeModal(\'leave-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-xl md:text-2xl font-black mb-6 border-b pb-4 text-purple-700">휴가 상세</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-6 r24"><div><span class="text-gray-400 font-bold block mb-1 text-xs">신청자</span><span class="font-bold text-gray-800 text-lg">'+d.applicantName+'</span></div><div><span class="text-gray-400 font-bold block mb-1 text-xs">상태</span>'+statusBadge(d.status)+'</div><div class="md:col-span-2"><span class="text-gray-400 font-bold block mb-1 text-xs">일정</span><span class="font-bold text-purple-600 text-lg">'+d.startDate+' ~ '+d.endDate+' ('+d.type+')</span></div><div class="md:col-span-2"><span class="text-gray-400 font-bold block mb-1 text-xs">사유</span><span class="text-gray-700 bg-white border p-3 r20 block">'+esc(d.reason||'없음')+'</span></div></div><div class="flex justify-end gap-3 mt-6 border-t pt-4">'+btns+'</div></div>');openModal('leave-detail-modal');}
function withdrawLeaveAction(id){openCustomConfirm("휴가 철회","철회하시겠습니까?",function(){var d=CACHE.leaves.find(function(x){return x.id===id;});if(d)d.status='철회';FB.patch('leaves/'+id,{status:'철회'});closeModal('leave-detail-modal');showToast("철회 완료");updateBadges();renderLeaves();});}
function approveLeave(id){var d=CACHE.leaves.find(function(x){return x.id===id;});if(!d)return;openCustomConfirm("휴가 승인","승인할까요?",function(){d.status='승인';FB.patch('leaves/'+id,{status:'승인'});closeModal('leave-detail-modal');showToast("승인 완료");updateBadges();renderLeaves();CACHE.leaveInfo.used+=(d.type==='연차'?1:0.5);CACHE.leaveInfo.remain=CACHE.leaveInfo.total-CACHE.leaveInfo.used;});}

// ═══════════════════════════════════════════════
//  조직도 (개선)
// ═══════════════════════════════════════════════
function renderDirectory(){
  var el=document.getElementById('tab-directory');
  el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-group-fill text-teal-600 mr-2"></i> 사내 조직도</h1><input type="text" id="directory-search-input" oninput="filterDirectoryUI()" placeholder="이름, 부서 검색..." class="px-4 py-3 border border-teal-100 r35 text-sm outline-none w-60 bg-white card-shadow"></div>'+
  '<div class="flex flex-col items-center mb-8"><div class="bg-gray-900 text-white r35 px-10 md:px-16 py-6 md:py-8 card-shadow text-center"><p class="text-xs uppercase tracking-widest text-gray-400 mb-1 font-bold">CEO</p><p class="text-2xl md:text-3xl font-black">최희진</p></div><div class="w-px h-8 bg-gray-300"></div><div class="w-3/4 h-px bg-gray-300"></div></div>'+
  '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="org-grid"></div>';
  filterDirectoryUI();
}
function filterDirectoryUI(){
  var k=(document.getElementById('directory-search-input')||{value:''}).value.toLowerCase();
  var filtered=CACHE.members.filter(function(m){return(m.name||'').toLowerCase().indexOf(k)>-1||(m.dept||'').toLowerCase().indexOf(k)>-1;});
  var el=document.getElementById('org-grid');if(!el)return;
  // 실제 데이터에서 팀 목록 자동 추출
  var teamSet={};CACHE.members.forEach(function(m){if(m.dept&&m.dept!=='-')teamSet[m.dept]=true;});
  var teams=Object.keys(teamSet);
  var colorList=[{bg:'bg-blue-50',border:'border-blue-200',text:'text-blue-700',accent:'bg-blue-500'},{bg:'bg-amber-50',border:'border-amber-200',text:'text-amber-700',accent:'bg-amber-500'},{bg:'bg-emerald-50',border:'border-emerald-200',text:'text-emerald-700',accent:'bg-emerald-500'},{bg:'bg-purple-50',border:'border-purple-200',text:'text-purple-700',accent:'bg-purple-500'},{bg:'bg-rose-50',border:'border-rose-200',text:'text-rose-700',accent:'bg-rose-500'},{bg:'bg-teal-50',border:'border-teal-200',text:'text-teal-700',accent:'bg-teal-500'}];
  var colors={};teams.forEach(function(t,i){colors[t]=colorList[i%colorList.length];});
  el.innerHTML=teams.map(function(t){
    var c=colors[t]||{bg:'bg-gray-50',border:'border-gray-200',text:'text-gray-700',accent:'bg-gray-500'};
    var members=filtered.filter(function(m){return m.dept===t;});
    var leader=members.filter(function(m){return m.position==='팀장'||m.role==='팀장'||m.role==='센터장';});
    var staff=members.filter(function(m){return m.position!=='팀장'&&m.role!=='팀장'&&m.role!=='센터장'&&m.role!=='ADMIN';});
    // ADMIN도 팀 소속이면 표시
    var adminsInTeam=members.filter(function(m){return m.role==='ADMIN'&&m.position!=='팀장';});
    staff=staff.concat(adminsInTeam);
    return'<div class="'+c.bg+' '+c.border+' border-2 r35 p-5 md:p-6">'+
      '<h3 class="font-black text-lg '+c.text+' mb-4 text-center">'+t+'</h3>'+
      (leader.length?leader.map(function(m){var posLabel=m.role==='센터장'?'센터장':'팀장';return'<div class="mb-4 p-4 bg-white r24 shadow-sm border-2 '+c.border+'"><div class="flex items-center gap-3"><div class="w-10 h-10 '+c.accent+' rounded-full flex items-center justify-center text-white font-black text-sm">'+m.name[0]+'</div><div><p class="font-black text-gray-800">'+m.name+' <span class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 r20 font-bold ml-1">'+posLabel+'</span></p><p class="text-[10px] text-gray-400 mt-0.5">'+m.email+'</p>'+(m.phone?'<p class="text-[10px] text-teal-600 font-bold">'+m.phone+'</p>':'')+'</div></div></div>';}).join(''):'')+
      '<div class="space-y-2">'+staff.map(function(m){return'<div class="p-3 bg-white r20 flex items-center gap-3 shadow-sm"><div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 text-xs">'+m.name[0]+'</div><div><p class="font-bold text-sm text-gray-800">'+m.name+'</p><p class="text-[10px] text-gray-400">'+m.email+'</p>'+(m.phone?'<p class="text-[10px] text-teal-600 font-bold">'+m.phone+'</p>':'')+'</div></div>';}).join('')+
      (members.length===0?'<p class="text-xs text-gray-400 text-center py-4">인원 없음</p>':'')+'</div></div>';
  }).join('');
}

// ═══════════════════════════════════════════════
//  관리자 (멤버 position 관리 추가)
// ═══════════════════════════════════════════════
function renderAdmin(){
  var el=document.getElementById('tab-admin');
  el.innerHTML='<h1 class="text-2xl md:text-3xl font-black text-red-600 mb-8"><i class="ri-settings-3-fill mr-2"></i> 관리자 설정</h1>'+
  '<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">'+
  '<div class="bg-white border-2 border-red-50 p-8 md:p-10 r35 card-shadow"><h2 class="text-xl font-bold text-red-600 mb-5"><i class="ri-megaphone-fill"></i> 팝업 공지</h2><textarea id="admin-notice-content" rows="4" placeholder="공지 내용" class="w-full border p-4 r24 mb-4 outline-none text-sm bg-gray-50"></textarea><button onclick="submitNoticeAdmin()" class="bg-red-600 text-white px-6 py-3 r35 font-bold w-full shadow-lg">전사 팝업 띄우기</button></div>'+
  '<div class="bg-white border p-8 md:p-10 r35 card-shadow"><h2 class="text-xl font-bold text-gray-800 mb-5"><i class="ri-database-2-fill text-blue-600"></i> 데이터 다운로드</h2><select id="admin-export-month" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-gray-50"></select><div class="flex gap-3"><button onclick="downloadCSVAdmin(\'Approval\')" class="flex-1 bg-gray-800 text-white py-3 r35 text-sm font-bold shadow-md">지출내역</button><button onclick="downloadCSVAdmin(\'Leaves\')" class="flex-1 bg-gray-800 text-white py-3 r35 text-sm font-bold shadow-md">휴가내역</button></div></div>'+
  '</div>'+
  '<div class="bg-white border p-8 md:p-10 r35 card-shadow"><h2 class="text-xl font-bold text-gray-800 mb-5"><i class="ri-user-settings-fill text-teal-600"></i> 멤버 직급 관리 (팀장/팀원)</h2><p class="text-xs text-gray-500 mb-4">팀장으로 지정된 멤버는 해당 팀의 1차 결재권자로 자동 설정됩니다.</p><div id="admin-member-list" class="space-y-3 max-h-[400px] overflow-y-auto hide-scrollbar"></div></div>';
  initMonthFilters();
  renderAdminMemberList();
}
function renderAdminMemberList(){
  var el=document.getElementById('admin-member-list');if(!el)return;
  el.innerHTML=CACHE.members.map(function(m){
    var curPos=getMemberPosition(m);
    var isTL=curPos==='팀장'||curPos==='센터장';
    return'<div class="flex items-center justify-between p-4 bg-gray-50 r24 border border-gray-100"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">'+m.name[0]+'</div><div><p class="font-bold text-sm text-gray-800">'+m.name+' <span class="text-[10px] text-gray-400">('+m.dept+')</span></p><p class="text-[10px] text-gray-400">'+m.email+' · 현재 role: '+m.role+'</p></div></div><select onchange="updateMemberPosition(\''+m.id+'\',this.value)" class="border p-2 r20 text-xs font-bold outline-none '+(isTL?'bg-red-50 text-red-600 border-red-200':'bg-gray-100 text-gray-600 border-gray-200')+'"><option value="팀원" '+(m.position!=='팀장'&&m.role!=='팀장'&&m.role!=='센터장'?'selected':'')+'>팀원</option><option value="팀장" '+(m.position==='팀장'||m.role==='팀장'?'selected':'')+'>팀장</option><option value="센터장" '+(m.role==='센터장'?'selected':'')+'>센터장</option></select></div>';
  }).join('');
}
function updateMemberPosition(id,position){
  var m=CACHE.members.find(function(x){return x.id===id;});if(m){m.position=position;}
  FB.patch('members/'+id,{position:position});
  showToast(getMemberName(m?m.email:'')+' → '+position);
  renderAdminMemberList();
}
function submitNoticeAdmin(){var c=document.getElementById('admin-notice-content').value;if(!c)return showToast("내용 입력");var id=genId();FB.set('notices/'+id,{id:id,content:c,createdAt:Date.now(),createdBy:USER.email});showToast("공지 등록 완료!");}
function downloadCSVAdmin(type){var month=document.getElementById('admin-export-month')?document.getElementById('admin-export-month').value:'all';var csv='\uFEFF';if(type==='Approval'){csv+="입금요청일,기안자,항목명,은행,계좌번호,금액,상태\n";CACHE.approval.filter(function(a){return matchMonth(a.dateCreated,month);}).forEach(function(a){csv+='"'+(a.date||'')+'","'+(a.drafterName||'')+'","'+(a.reason||'')+'","'+(a.bank||'')+'","'+(a.account||'')+'","'+(a.amount||0)+'","'+(a.status||'')+'"\n';});}else{csv+="신청자,시작일,종료일,구분,사유,상태\n";CACHE.leaves.filter(function(l){return matchMonth(l.startDate,month);}).forEach(function(l){csv+='"'+(l.applicantName||'')+'","'+(l.startDate||'')+'","'+(l.endDate||'')+'","'+(l.type||'')+'","'+(l.reason||'')+'","'+(l.status||'')+'"\n';});}var b=new Blob([csv],{type:'text/csv;charset=utf-8;'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=type+'_'+(month==='all'?'All':month)+'.csv';a.click();}
