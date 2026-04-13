
/*═══════════ Firebase ═══════════*/
var firebaseConfig={apiKey:"AIzaSyCmeGcCHO5K-jKu4UApMo_CxLhhDuzVLlc",authDomain:"circularlabs-gw.firebaseapp.com",databaseURL:"https://circularlabs-gw-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"circularlabs-gw",storageBucket:"circularlabs-gw.firebasestorage.app",messagingSenderId:"995341939477",appId:"1:995341939477:web:543ebebe0a2af4ca14ef1c"};
firebase.initializeApp(firebaseConfig);var auth=firebase.auth(),db=firebase.database();
/*═══════════ Global ═══════════*/
// 기존 코드: var USER=null,CACHE={tasks:[], ... ,wiki:[],leaveInfo:{total:15,used:0,remain:15}};
// 아래처럼 변경 (products:[] 추가)
var USER=null,CACHE={tasks:[],devProjects:[],sprints:[],crm:[],cs:[],schedules:[],approval:[],leaves:[],vault:[],comments:{},members:[],wiki:[],products:[],leaveInfo:{total:15,used:0,remain:15}};
var devView='board',confirmCb=null,chartCRM=null,chartTasks=null,activeNoticeId=null;
var teamTaskViewMode = 'list';
var isInitialLoad = true;
/*═══════════ Util ═══════════*/
function esc(s) {
  if (!s) return '';
  // 기본 보안 변환
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 멘션 태그만 따로 처리하는 함수를 분리 (금고 충돌 방지)
function renderMentionText(txt) {
  if (!txt) return '';
  return esc(txt).replace(/@([가-힣a-zA-Z0-9]+)/g, '<span class="mention-tag">@$1</span>');
}
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
function canDelete() {
  return USER.role === 'ADMIN' || USER.role === '팀장' || USER.role === '센터장' || USER.position === '팀장';
}

/*═══════════ @멘션 (Mention) 시스템 ═══════════*/
function setupMention(elId) {
  var el = document.getElementById(elId);
  if(!el) return;
  el.addEventListener('input', function(e) {
    var val = e.target.value;
    var cursor = e.target.selectionStart;
    var lastAt = val.lastIndexOf('@', cursor - 1);
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ' || val[lastAt - 1] === '\n')) {
      var query = val.substring(lastAt + 1, cursor);
      if (!query.includes(' ')) { showMentionPopup(el, query, lastAt); } 
      else { hideMentionPopup(); }
    } else { hideMentionPopup(); }
  });
  el.addEventListener('click', hideMentionPopup);
  el.addEventListener('blur', function() { setTimeout(hideMentionPopup, 200); });
}

function showMentionPopup(el, query, atPos) {
  var matched = CACHE.members.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
  if (matched.length === 0) return hideMentionPopup();
  var pop = document.getElementById('mention-popup') || document.createElement('div');
  pop.id = 'mention-popup';
  pop.className = 'fixed bg-white border border-gray-200 shadow-2xl r20 w-48 z-[9999] overflow-hidden overflow-y-auto max-h-48';
  if(!document.getElementById('mention-popup')) document.body.appendChild(pop);
  
  var rect = el.getBoundingClientRect();
  pop.style.left = rect.left + 'px';
  pop.style.top = (rect.top > 300) ? (rect.top - pop.offsetHeight - 5) + 'px' : (rect.bottom + 5) + 'px';
  pop.innerHTML = matched.map(m => `
    <div onmousedown="insertMention('${el.id}', '${m.name}', ${atPos})" class="p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-2 border-b last:border-0 border-gray-50">
      <div class="w-6 h-6 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-black">${m.name[0]}</div>
      <div class="flex-1 min-w-0"><p class="text-xs font-bold text-gray-800 truncate">${m.name}</p><p class="text-[9px] text-gray-400 uppercase">${m.dept}</p></div>
    </div>`).join('');
  pop.classList.remove('hidden');
}

function insertMention(elId, name, atPos) {
  var el = document.getElementById(elId);
  var val = el.value;
  var before = val.substring(0, atPos);
  var after = val.substring(el.selectionStart);
  el.value = before + '@' + name + ' ' + (after.startsWith(' ') ? after.substring(1) : after);
  hideMentionPopup(); el.focus();
}

function hideMentionPopup() { var pop = document.getElementById('mention-popup'); if(pop) pop.classList.add('hidden'); }

/*═══════════ Assignee Picker (드롭다운 + 검색) ═══════════*/
function populateAssignees(cId,sel){
  var el=document.getElementById(cId);if(!el)return;
  // 부모 컨테이너의 스크롤 제약 클래스를 덮어써서 드롭다운이 잘리지 않게 설정
  el.className="w-full relative"; 
  var s=sel?sel.split(',').map(function(x){return x.trim().toLowerCase();}):[];
  var teams={};CACHE.members.forEach(function(m){var d=m.dept||'기타';if(!teams[d])teams[d]=[];teams[d].push(m);});
  
  var html='<details class="w-full bg-white group"><summary class="p-4 border r24 text-sm font-bold cursor-pointer outline-none bg-gray-50 flex justify-between items-center list-none"><span id="'+cId+'-summary">참여인원 선택 ('+s.length+'명)</span><i class="ri-arrow-down-s-line group-open:rotate-180 transition text-gray-400 text-lg"></i></summary><div class="absolute left-0 right-0 top-full mt-2 border border-gray-200 r24 shadow-2xl max-h-60 overflow-y-auto bg-white z-100"><div class="p-2 bg-gray-50 border-b sticky top-0 z-10"><input type="text" class="w-full border p-2 text-xs outline-none r20 focus:border-blue-400" placeholder="이름 검색..." oninput="filterAssignees(\''+cId+'\',this.value)"></div><div class="p-2">';
  
  Object.keys(teams).sort().forEach(function(dept){
    html+='<div class="ap-group" data-dept="'+esc(dept)+'"><div class="text-[10px] font-black text-gray-400 mt-2 mb-1 px-2 uppercase tracking-wider">'+esc(dept)+'</div>';
    teams[dept].forEach(function(m){
      var isChecked = s.indexOf(m.email.toLowerCase())>-1;
      html+='<label class="ap-item flex items-center gap-3 p-2 hover:bg-blue-50 cursor-pointer r20 transition" data-name="'+esc(m.name).toLowerCase()+'"><input type="checkbox" class="'+cId+'-cb w-4 h-4 rounded accent-blue-600" value="'+m.email+'" '+(isChecked?'checked':'')+' onchange="updateAssigneeSummary(\''+cId+'\')"><div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-black">'+m.name[0]+'</div><div class="flex-1"><p class="text-sm font-bold text-gray-700">'+m.name+'</p><p class="text-[10px] text-gray-400">'+getMemberPosition(m)+'</p></div></label>';
    });
    html+='</div>';
  });
  html+='</div></div></details>';
  el.innerHTML=html;
}

// (추가) 체크박스 클릭 시 드롭다운 제목에 선택된 인원수 업데이트
function updateAssigneeSummary(cId){
  var c=document.querySelectorAll('.'+cId+'-cb:checked').length;
  var span=document.getElementById(cId+'-summary');
  if(span) span.innerText = '참여인원 선택 ('+c+'명)';
}
function filterAssignees(cId,q){
  q=q.toLowerCase();var el=document.getElementById(cId);if(!el)return;
  el.querySelectorAll('.ap-item').forEach(function(item){item.style.display=item.getAttribute('data-name').indexOf(q)>-1?'flex':'none';});
  el.querySelectorAll('.ap-group').forEach(function(g){var anyVis=Array.from(g.querySelectorAll('.ap-item')).some(function(i){return i.style.display!=='none';});g.style.display=anyVis?'block':'none';});
}
function getChecked(cId){return Array.from(document.querySelectorAll('.'+cId+'-cb:checked')).map(function(c){return c.value;}).join(',');}
// ▲ 여기까지 복사 ▲
/*═══════════ Visual helpers (수정본) ═══════════*/
var DEV_STATUS_META={'기획중':{dot:'bg-yellow-400',badge:'bg-yellow-100 text-yellow-700'},'개발중':{dot:'bg-blue-500',badge:'bg-blue-100 text-blue-700'},'QA/테스트':{dot:'bg-purple-500',badge:'bg-purple-100 text-purple-700'},'배포완료':{dot:'bg-green-500',badge:'bg-green-100 text-green-700'},'보류':{dot:'bg-gray-300',badge:'bg-gray-100 text-gray-500'}};
var PRIORITY_META={P1:{bg:'bg-red-100',text:'text-red-600',icon:'ri-arrow-up-double-fill',tip:'긴급'},P2:{bg:'bg-orange-100',text:'text-orange-500',icon:'ri-arrow-up-fill',tip:'높음'},P3:{bg:'bg-blue-100',text:'text-blue-500',icon:'ri-arrow-right-fill',tip:'보통'},P4:{bg:'bg-gray-100',text:'text-gray-400',icon:'ri-arrow-down-fill',tip:'낮음'}};
var TAG_COLORS=['bg-pink-100 text-pink-700','bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-teal-100 text-teal-700','bg-lime-100 text-lime-700','bg-amber-100 text-amber-700'];

function tagColor(t){var h=0;for(var i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))%TAG_COLORS.length;return TAG_COLORS[h];}
function tagHtml(tags){return(tags||'').split(',').map(function(t){return t.trim();}).filter(Boolean).map(function(t){return'<span class="text-[10px] font-black px-2 py-0.5 r20 '+tagColor(t)+'">'+esc(t)+'</span>';}).join('');}
function priorityHtml(p,size){var m=PRIORITY_META[p];if(!m)return'';var sz=size==='md'?'text-xs px-3 py-1':'text-[10px] px-2 py-0.5';return'<span title="'+m.tip+'" class="'+sz+' r20 font-black flex items-center gap-1 '+m.bg+' '+m.text+'"><i class="'+m.icon+'"></i>'+p+'</span>';}
function avatarHtml(emails,max){max=max||4;var colors=['bg-blue-500','bg-purple-500','bg-emerald-500','bg-rose-500','bg-amber-500'];var list=(emails||'').split(',').filter(Boolean);return list.slice(0,max).map(function(e,i){var n=getMemberName(e.trim());return'<div title="'+n+'" class="w-7 h-7 rounded-full '+colors[i%colors.length]+' flex items-center justify-center text-white text-[10px] font-black border-2 border-white -ml-1 first:ml-0 shadow-sm">'+(n[0]||'?')+'</div>';}).join('')+(list.length>max?'<div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-black border-2 border-white -ml-1">+'+(list.length-max)+'</div>':'');}



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
        // 👇 이메일 대소문자 버그 해결: String(firebaseUser.email).toLowerCase() 로 수정됨
        USER={email:String(firebaseUser.email).toLowerCase(),name:matched.name||firebaseUser.displayName||firebaseUser.email.split('@')[0],dept:matched.dept||'',role:matched.role||'MEMBER',position:matched.position||'팀원',leaveTotal:Number(matched.leaveTotal)||15,phone:matched.phone||''};
        CACHE.members=memberList;
        document.getElementById('login-screen').classList.add('hidden');
        var appEl=document.getElementById('app');appEl.classList.remove('hidden');appEl.classList.add('flex','flex-col');
        document.getElementById('sidebar-name').innerText=USER.name;
        document.getElementById('sidebar-email').innerText=USER.email;
        if(USER.role==='ADMIN'||USER.role==='팀장'||USER.role==='센터장') document.getElementById('admin-menu').classList.remove('hidden');
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


function processData(results){
  var now=Date.now();
  CACHE.tasks=parseNode(results.tasks).filter(function(t){return !t.isDeleted && !(t.status==='Done'&&(now-(parseInt(t.timestamp)||now))>30*86400000);});
  CACHE.devProjects=parseNode(results.devProjects).filter(function(p){return !p.isDeleted;});
  CACHE.sprints=parseNode(results.sprints).filter(function(s){return !s.isDeleted;});
  CACHE.crm=parseNode(results.crm).filter(function(c){return !c.isDeleted;});
  CACHE.cs=parseNode(results.cs).filter(function(c){return !c.isDeleted;});
  CACHE.schedules=parseNode(results.schedules).filter(function(s){return !s.isDeleted;});
  CACHE.approval=parseNode(results.approvals).filter(function(a){return !a.isDeleted;});
  CACHE.leaves=parseNode(results.leaves).filter(function(l){return !l.isDeleted;});
  CACHE.wiki=parseNode(results.wiki).filter(function(w){return !w.isDeleted;});
  CACHE.products=parseNode(results.products).filter(function(p){return !p.isDeleted;});
  CACHE.quickLinks = parseNode(results.quickLinks); 
  CACHE.comments=results.comments||{};
  
  // 🌟 금고 비밀번호를 파괴하지 않고 원본 유지하도록 수정
  CACHE.vault=parseNode(results.vault).filter(function(v){
    if(v.isDeleted) return false;
    if(USER.role==='ADMIN'||v.creator===USER.email||v.visibility==='ALL')return true;
    if(v.visibility==='PRIVATE')return false;
    return(v.visibility||'').indexOf(USER.dept)>-1||(v.visibility||'').indexOf(USER.email)>-1;
  });
  
  var used=0;CACHE.leaves.filter(function(l){return l.applicant&&l.applicant.toLowerCase()===USER.email&&l.status==='승인';}).forEach(function(l){if(l.type==='연차')used+=1;else if(l.type==='반차')used+=0.5;});
  CACHE.leaveInfo={total:USER.leaveTotal,used:used,remain:USER.leaveTotal-used};
  var notices=parseNode(results.notices);if(notices.length>0){var latest=notices[notices.length-1];if(latest&&latest.content){activeNoticeId=latest.id;showNoticePopup(latest.content);}}
  updateBadges();initConfirmModal();showTab('home');showToast('✅ 로드 완료!');
  if(typeof setupRealtimeListeners === 'function') setupRealtimeListeners(); 
}

// ═══════════════════════════════════════════════
//  탭 전환
// ═══════════════════════════════════════════════

function showTab(name){
  // 모바일 사이드바 닫기
  var sb=document.getElementById('sidebar'),ov=document.getElementById('sidebar-overlay');
  if(sb)sb.classList.remove('open');if(ov)ov.classList.remove('show');

  // 모든 탭 숨기기
  document.querySelectorAll('[id^="tab-"]').forEach(function(s){s.classList.add('hidden');});
  // 사이드바 활성 상태 초기화
  document.querySelectorAll('.sidebar-item').forEach(function(i){i.classList.remove('active');});

  // 🌟 [수정] 정확한 ID 매칭 (tab-teamcal, tab-home 등)
  var targetId = 'tab-' + name;
  var sec = document.getElementById(targetId);
  if(sec) sec.classList.remove('hidden');

  // 클릭한 메뉴 활성화 표시
  var nav=document.querySelector('[data-tab="'+name+'"]');
  if(nav)nav.classList.add('active');

  // 각 탭에 맞는 화면 그리기 함수 실행
  var renders={
    home:renderDashboard,
    calendar:renderCalendar,
    teamcal:renderTeamCalendar, // 전사 캘린더
    products:renderProducts,
    dev:function(){setDevView(devView);},
    crm:filterCRM,
    cs:filterCS,
    approval:renderApproval,
    vault:renderVault,
    wiki:renderWiki,
    leaves:renderLeaves,
    directory:renderDirectory,
    admin:renderAdmin
  };
  
  if(renders[name]) renders[name]();
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
function initConfirmModal(){renderModalRoot('custom-confirm-modal','<div class="bg-white r35 modal-content max-w-sm p-10 shadow-2xl fade-in text-center"><div class="text-red-500 text-6xl mb-6"><i class="ri-error-warning-fill"></i></div><h2 id="cc-title" class="text-2xl font-black mb-3 text-gray-800"></h2><p id="cc-desc" class="text-sm text-gray-500 mb-10 leading-relaxed"></p><div class="flex justify-center gap-3"><button onclick="closeModal(\'custom-confirm-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button id="cc-ok" class="px-8 py-3.5 bg-red-600 text-white r35 text-sm font-bold shadow-lg hover:bg-red-700 transition">확인</button></div></div>');document.getElementById('custom-confirm-modal').className = 'hidden fixed inset-0 modal-overlay p-4 z-[100]';
}

// ═══════════════════════════════════════════════
//  알림
// ═══════════════════════════════════════════════

function buildNotifications(){
  var notes=[], today=new Date(); today.setHours(0,0,0,0);
  var todayStr = new Date().toISOString().slice(0,10);
  
  // 🌟 [추가] 로컬 스토리지에서 읽은 알림 목록 가져오기 (임시 처리 방식)
  var readNotifs = JSON.parse(localStorage.getItem('read_notifs_' + USER.email)) || [];

  // 1. 결재 알림
  CACHE.approval.filter(function(d){
    var isTarget = ((d.approver1||'').toLowerCase()===USER.email && d.status==='대기') || ((d.approver2||'').toLowerCase()===USER.email && d.status==='1차 승인');
    return isTarget && !readNotifs.includes('appr_' + d.id); // 읽지 않은 것만
  }).forEach(function(d){
    notes.push({ id: 'appr_' + d.id, icon:'ri-bank-card-fill', color:'text-blue-500', bg:'bg-blue-50', msg:'결재 대기: <b>'+esc(d.reason)+'</b>', action:function(){ showTab('approval'); }});
  });

  // 2. 휴가 알림
  CACHE.leaves.filter(function(d){
    var isTarget = (d.approver1||'').toLowerCase()===USER.email && d.status==='대기';
    return isTarget && !readNotifs.includes('leave_' + d.id);
  }).forEach(function(d){
    notes.push({ id: 'leave_' + d.id, icon:'ri-flight-takeoff-fill', color:'text-purple-500', bg:'bg-purple-50', msg:'휴가 결재 대기: <b>'+d.applicantName+'</b>', action:function(){ showTab('leaves'); }});
  });

  // 3. 업무 할당 알림
  CACHE.tasks.filter(function(t){
    var isTarget = t.taskType==='team' && t.status!=='Done' && (t.assignees||'').toLowerCase().indexOf(USER.email)>-1;
    return isTarget && !readNotifs.includes('task_' + t.id);
  }).forEach(function(t){
    notes.push({ id: 'task_' + t.id, icon:'ri-at-line', color:'text-rose-500', bg:'bg-rose-50', msg:'업무 할당: <b>'+esc(t.title)+'</b>', action:function(){ showTab('calendar'); setTimeout(()=>openTaskDetail(t.id), 200); }});
  });

  // 4. CRM 팔로업
  CACHE.crm.filter(function(d){
    var isTarget = d.nextActionDate && d.nextActionDate <= todayStr && d.status!=='계약성공(Won)';
    return isTarget && !readNotifs.includes('crm_' + d.id);
  }).forEach(function(d){
    notes.push({ id: 'crm_' + d.id, icon:'ri-briefcase-4-fill', color:'text-emerald-500', bg:'bg-emerald-50', msg:'팔로업 필요: <b>'+esc(d.company)+'</b>', action:function(){ showTab('crm'); }});
  });

  return notes;
}
function openNotifModal(){
  var notes = buildNotifications();
  renderModalRoot('notif-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in relative max-h-[85vh] flex flex-col"><button onclick="closeModal(\'notif-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-2xl font-black mb-6 text-gray-800"><i class="ri-notification-3-fill text-blue-500 mr-2"></i> 알림 센터</h2><div class="flex-1 overflow-y-auto hide-scrollbar">'+(notes.length===0?'<p class="text-sm text-gray-400 font-bold text-center py-10">새로운 알림이 없습니다 🎉</p>':notes.map(function(n, i){
    return '<div id="notif-item-'+i+'" class="flex items-start gap-4 p-4 '+n.bg+' r24 cursor-pointer hover:opacity-80 transition mb-3 group relative">'+
             '<i class="'+n.icon+' '+n.color+' text-xl shrink-0 mt-0.5"></i>'+
             '<div class="flex-1 min-w-0"><p class="text-sm text-gray-700">'+n.msg+'</p></div>'+
             '<i class="ri-check-line text-gray-300 group-hover:text-green-500 text-lg"></i>'+
           '</div>';
  }).join(''))+'</div></div>');
  
  openModal('notif-modal');
  
  // 클릭 이벤트 바인딩
  notes.forEach(function(n, i){
    var el = document.getElementById('notif-item-' + i);
    if(el) {
      el.onclick = function() {
        markNotifAsRead(n.id, n.action);
      };
    }
  });
}
function refreshNotifBadge(){var c=buildNotifications().length;['notif-badge','notif-badge-mobile'].forEach(function(id){var b=document.getElementById(id);if(b){b.innerText=c;b.classList.toggle('hidden',c===0);}});}

// ═══════════════════════════════════════════════
//  공지
// ═══════════════════════════════════════════════
function showNoticePopup(content){renderModalRoot('global-notice-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in text-center border-t-8 border-red-500"><div class="text-red-500 text-5xl mb-6"><i class="ri-megaphone-fill"></i></div><h2 class="text-2xl font-black mb-6 uppercase tracking-widest text-gray-800">사내 팝업 공지</h2><div class="bg-gray-50 p-6 md:p-8 r24 mb-8"><p id="gn-text" class="text-base text-gray-700 whitespace-pre-wrap leading-relaxed font-medium text-left"></p></div><button onclick="closeModal(\'global-notice-modal\')" class="bg-gray-900 text-white px-10 py-4 r35 font-bold text-sm hover:bg-black shadow-lg transition">확인</button></div>');var el=document.getElementById('gn-text');if(el)el.innerText=content;openModal('global-notice-modal');}

// ═══════════════════════════════════════════════
//  대시보드
// ═══════════════════════════════════════════════

/*═══════════ 대시보드 (완벽 정리본) ═══════════*/
var deptChart = null; // 차트 중복 생성 방지용 전역 변수
var taskStatusChart = null;

function renderDashboard() {
  var li = CACHE.leaveInfo, today = new Date(); today.setHours(0, 0, 0, 0);
  var ac = CACHE.approval.filter(function(d) { return ((d.approver1 || '').toLowerCase() === USER.email && d.status === '대기') || ((d.approver2 || '').toLowerCase() === USER.email && d.status === '1차 승인'); }).length;
  var inP = CACHE.tasks.filter(function(t) { return (t.assignees || '').toLowerCase().indexOf(USER.email) > -1 && t.status === 'In Progress'; }).length;
  var nc = buildNotifications().length;
  var urgentTasks = CACHE.tasks.filter(function(t) { if (!t.deadline || t.status === 'Done') return false; return Math.ceil((new Date(t.deadline) - today) / 86400000) <= 3; }).sort(function(a, b) { return new Date(a.deadline) - new Date(b.deadline); });
  var ongoing = CACHE.devProjects.filter(function(p) { return p.status !== '배포완료' && p.status !== '보류'; });
  var d = new Date(), dateStr = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + '일월화수목금토'[d.getDay()] + '요일';

  // 1. 사내 퀵링크 렌더링 데이터 준비
  var qlHtml = (CACHE.quickLinks || []).map(function(q) {
    return '<a href="' + q.url + '" target="_blank" class="flex flex-col items-center justify-center p-4 bg-white border border-gray-100 hover:border-blue-300 r24 shadow-sm hover:shadow-md transition group"><i class="' + esc(q.icon || 'ri-link') + ' text-2xl text-blue-500 mb-2 group-hover:scale-110 transition"></i><span class="text-xs font-bold text-gray-700 w-full text-center truncate">' + esc(q.name) + '</span></a>';
  }).join('');
  qlHtml += '<div onclick="openQuickLinkModal()" class="flex flex-col items-center justify-center p-4 bg-gray-50 border border-dashed border-gray-300 hover:border-blue-300 hover:bg-blue-50 r24 cursor-pointer transition group"><i class="ri-add-line text-2xl text-gray-400 mb-2 group-hover:text-blue-500 transition"></i><span class="text-xs font-bold text-gray-500 group-hover:text-blue-600">추가하기</span></div>';

  // 2. 전체 레이아웃 렌더링
  document.getElementById('tab-home').innerHTML =
    '<div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-2"><h1 class="text-2xl md:text-4xl font-black text-gray-800 tracking-tight">좋은 하루입니다, ' + esc(USER.name) + '님! 👋</h1><p class="text-sm text-gray-400 font-bold">' + dateStr + '</p></div>' +
    '<h3 class="text-sm font-bold text-gray-800 mb-3"><i class="ri-links-fill text-blue-500"></i> 바로가기 링크</h3>' +
    '<div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">' + qlHtml + '</div>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">' +
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-purple-200 border border-transparent" onclick="showTab(\'leaves\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">남은 연차</h3><p class="text-3xl md:text-4xl font-black text-purple-600">' + li.remain + ' 일</p></div>' +
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-green-200 border border-transparent" onclick="showTab(\'approval\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">대기 중 결재</h3><p class="text-3xl md:text-4xl font-black text-green-500">' + ac + '</p></div>' +
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-rose-200 border border-transparent" onclick="showTab(\'dev\')"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">진행 중 업무</h3><p class="text-3xl md:text-4xl font-black text-rose-500">' + inP + '</p></div>' +
    '<div class="p-6 md:p-8 bg-white r35 card-shadow card-hover cursor-pointer hover:border-blue-200 border border-transparent" onclick="openNotifModal()"><h3 class="text-xs font-bold text-gray-400 uppercase mb-3">미확인 알림</h3><p class="text-3xl md:text-4xl font-black text-blue-500">' + nc + '</p></div>' +
    '</div>' +
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8">' +
    '<div class="bg-white p-6 md:p-8 r35 card-shadow"><h3 class="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2"><i class="ri-pie-chart-2-fill text-emerald-500"></i> 부서별 업무 비중</h3><canvas id="deptChart" height="160"></canvas></div>' +
    '<div class="bg-white p-6 md:p-8 r35 card-shadow"><h3 class="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2"><i class="ri-bar-chart-fill text-blue-500"></i> 업무 진행 현황</h3><canvas id="taskStatusChart" height="160"></canvas></div>' +
    '<div class="bg-white p-6 md:p-8 r35 card-shadow flex flex-col"><h3 class="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="ri-alarm-warning-fill text-red-500"></i> D-day 마감 업무</h3><div class="flex-1 overflow-y-auto space-y-2 hide-scrollbar">' + (urgentTasks.length === 0 ? '<p class="text-xs text-gray-400 font-bold text-center py-4">마감 임박 없음 🎉</p>' : urgentTasks.map(function(t) {
      var diff = Math.ceil((new Date(t.deadline) - today) / 86400000);
      var badge = diff < 0 ? '<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 r20 font-black shrink-0">D+' + Math.abs(diff) + '</span>' : diff === 0 ? '<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 r20 font-black shrink-0">D-day</span>' : '<span class="text-[10px] bg-orange-400 text-white px-2 py-0.5 r20 font-black shrink-0">D-' + diff + '</span>';
      var clickAction = t.taskType === 'team' ? "showTab('calendar');setTimeout(function(){openTaskDetail('" + t.id + "');},100)" : "showTab('calendar')";
      return '<div class="flex items-center gap-2 p-3 bg-gray-50 r20 hover:bg-gray-100 cursor-pointer transition" onclick="' + clickAction + '">' + badge + '<span class="flex-1 text-xs font-bold text-gray-700 truncate">' + esc(t.title) + '</span></div>';
    }).join('')) + '</div></div></div>' +
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">' +
    '<div class="bg-gradient-to-br from-indigo-900 to-indigo-700 p-8 md:p-10 r35 card-shadow h-72 flex flex-col text-white"><h3 class="text-sm font-bold text-indigo-200 mb-4 flex items-center gap-2"><i class="ri-megaphone-fill text-red-400"></i> 사내 공지</h3><div id="dash-notice" class="flex-1 overflow-y-auto text-base font-medium leading-relaxed whitespace-pre-wrap hide-scrollbar text-indigo-100">공지 없음</div></div>' +
    '<div class="bg-white p-8 md:p-10 r35 card-shadow h-72 flex flex-col"><h3 class="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="ri-macbook-fill text-blue-500"></i> 진행 중인 개발 프로젝트</h3><div class="flex-1 overflow-y-auto space-y-3 hide-scrollbar">' + (ongoing.length === 0 ? '<p class="text-xs text-gray-400 font-bold text-center mt-4">진행 중인 프로젝트 없음</p>' : ongoing.map(function(p) {
      return '<div class="p-4 bg-gray-50 r24 border border-gray-100 hover:border-blue-200 cursor-pointer transition" onclick="showTab(\'dev\')"><div class="flex justify-between items-center mb-2"><span class="font-black text-gray-800 text-sm truncate">' + esc(p.title) + '</span><span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 r20 font-bold shrink-0">' + p.status + '</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + (p.progress || 0) + '%"></div></div><p class="text-[10px] text-gray-400 mt-1 font-bold text-right">' + (p.progress || 0) + '%</p></div>';
    }).join('')) + '</div></div></div>';

  // 3. 차트 실행 및 공지 로드
  renderDashCharts();
  FB.get('notices', function(err, data) {
    var notices = parseNode(data);
    var el = document.getElementById('dash-notice');
    if (el && notices.length > 0) el.innerText = notices[notices.length - 1].content || '공지 없음';
  });
}

function renderDashCharts() {
  // 부서별 비중 차트
  var dCtx = document.getElementById('deptChart');
  if (dCtx) {
    if (deptChart) deptChart.destroy();
    deptChart = new Chart(dCtx, {
      type: 'doughnut',
      data: {
        labels: ['개발', '영업', '결재', 'CS'],
        datasets: [{
          data: [CACHE.devProjects.length, CACHE.crm.length, CACHE.approval.length, CACHE.cs.length],
          backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }

  // 업무 상태 차트
  var tCtx = document.getElementById('taskStatusChart');
  if (tCtx) {
    if (taskStatusChart) taskStatusChart.destroy();
    var mt = CACHE.tasks.filter(function(t) { return (t.deadline || '').startsWith(new Date().toISOString().slice(0, 7)); });
    var bS = { Todo: mt.filter(function(t) { return t.status === 'Todo'; }).length, 'In Progress': mt.filter(function(t) { return t.status === 'In Progress'; }).length, Done: mt.filter(function(t) { return t.status === 'Done'; }).length };
    taskStatusChart = new Chart(tCtx, {
      type: 'bar',
      data: {
        labels: ['대기', '진행', '완료'],
        datasets: [{
          data: [bS.Todo, bS['In Progress'], bS.Done],
          backgroundColor: ['#e5e7eb', '#3b82f6', '#10b981'],
          borderRadius: 8
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
    });
  }
}

// 파일 맨 아래(아무 곳이나)에 퀵링크 추가 기능 함수를 덧붙여주세요.
function openQuickLinkModal(){
  renderModalRoot('ql-modal', '<div class="bg-white r35 modal-content max-w-sm p-8 shadow-2xl fade-in"><h2 class="text-xl font-black mb-4"><i class="ri-link"></i> 바로가기 추가</h2><input type="text" id="ql-name" placeholder="이름 (예: 구글 드라이브)" class="w-full border p-3 r20 mb-3 text-sm outline-none bg-gray-50"><input type="text" id="ql-url" placeholder="URL (https://...)" class="w-full border p-3 r20 mb-6 text-sm outline-none bg-gray-50"><div class="flex justify-end gap-2"><button onclick="closeModal(\'ql-modal\')" class="px-6 py-2 bg-gray-100 r20 text-sm font-bold">취소</button><button onclick="submitQuickLink()" class="px-6 py-2 bg-blue-600 text-white r20 text-sm font-bold shadow-lg">추가</button></div></div>');
  openModal('ql-modal');
}
function submitQuickLink(){
  var n=document.getElementById('ql-name').value, u=document.getElementById('ql-url').value;
  if(!n||!u) return showToast('이름과 URL을 모두 입력해주세요.');
  if(!u.startsWith('http')) u = 'https://' + u; // http 보정
  var id=genId();
  var obj={id:id, name:n, url:u, icon:'ri-external-link-line'};
  if(!CACHE.quickLinks) CACHE.quickLinks=[];
  CACHE.quickLinks.push(obj);
  FB.set('quickLinks/'+id, obj);
  closeModal('ql-modal'); renderDashboard(); showToast('링크 추가 완료!');
}

// ═══════════════════════════════════════════════
//  일정 및 할 일 (구글 캘린더 연동 제거, 나의 할일 + 팀 할일)
// ═══════════════════════════════════════════════
var calendar = null;

// 1. 달력/업무 탭의 전체 틀을 잡는 함수
function renderCalendar() {
  var el = document.getElementById('tab-calendar');
  if(!el) return;

  var isMobile = window.innerWidth < 1024;

  // 1. 저장된 레이아웃 순서 불러오기 (없으면 기본값)
  var savedLayout = JSON.parse(localStorage.getItem('calLayoutOrder')) || ['col-my-todo', 'col-team-board'];

  var blocks = {
    'col-my-todo': `
      <div data-id="col-my-todo" class="flex-1 bg-white p-6 r35 card-shadow flex flex-col overflow-hidden min-w-[300px] transition-all">
        <div class="drag-handle flex justify-between items-center mb-4 cursor-move hover:bg-gray-50 p-2 -m-2 rounded-xl transition">
          <h2 class="font-bold text-gray-800 flex items-center gap-2 text-sm pointer-events-none"><i class="ri-user-heart-line text-pink-500"></i> 내 할 일</h2>
          <div class="flex gap-2 items-center">
            <button onclick="extractWeeklyReport()" class="bg-gray-800 text-white text-[10px] px-3 py-1 r20 hover:bg-black transition">주간보고 추출</button>
            <i class="ri-drag-move-fill text-gray-300 text-lg"></i>
          </div>
        </div>
        <div class="flex gap-2 mb-4">
          <input type="text" id="my-todo-input" placeholder="@이름 멘션 가능..." class="flex-1 border p-2.5 r20 text-xs outline-none bg-gray-50" onkeypress="if(event.key==='Enter')addMyTodo()">
          <button onclick="addMyTodo()" class="bg-pink-500 text-white w-9 h-9 r20 font-bold">+</button>
        </div>
        <div id="my-todo-list" class="flex-1 overflow-y-auto space-y-2 hide-scrollbar"></div>
      </div>`,
    'col-team-board': `
      <div data-id="col-team-board" class="flex-1 bg-white p-8 r35 card-shadow flex flex-col overflow-hidden min-w-[300px] transition-all">
        <div class="drag-handle flex justify-between items-center mb-6 cursor-move hover:bg-gray-50 p-2 -m-2 rounded-xl transition">
          <h2 class="font-black text-gray-800 text-lg flex items-center pointer-events-none"><i class="ri-team-fill text-blue-500 mr-2"></i> 전사 업무 현황</h2>
          <div class="flex items-center gap-3">
            <div class="flex bg-gray-100 p-1 r20">
              <button onclick="changeTeamView('list')" id="view-btn-list" class="px-3 py-1 r20 text-xs font-bold transition">리스트</button>
              <button onclick="changeTeamView('board')" id="view-btn-board" class="px-3 py-1 r20 text-xs font-bold transition">보드</button>
            </div>
            <i class="ri-drag-move-fill text-gray-300 text-xl"></i>
          </div>
        </div>
        <div id="team-project-tracking-board" class="flex-1 overflow-y-auto pr-2 hide-scrollbar flex flex-col"></div>
      </div>`
  };

  var orderedHtml = savedLayout.map(id => blocks[id]).join('');

  el.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <h1 class="text-2xl font-black text-gray-800"><i class="ri-briefcase-fill text-blue-600 mr-2"></i> 프로젝트 통합 관제</h1>
      <button onclick="openTeamTaskModal()" class="bg-blue-600 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-blue-700 transition">+ 새 업무 등록</button>
    </div>
    <div id="cal-main-container" class="flex flex-col lg:flex-row gap-6 ${isMobile ? 'h-auto' : 'h-[calc(100vh-12rem)]'}">
      ${orderedHtml}
    </div>
  `;

  renderMyTodo();
  renderTeamProjectBoard();
  setupMention('my-todo-input');

  // 좌우 드래그 앤 드롭 활성화 (내 할일 vs 전사현황 위치 변경)
  setTimeout(() => {
    var container = document.getElementById('cal-main-container');
    if(container) {
      new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        onEnd: function() {
          var order = Array.from(container.children).map(c => c.getAttribute('data-id'));
          localStorage.setItem('calLayoutOrder', JSON.stringify(order));
        }
      });
    }
  }, 100);
}

function renderTeamProjectBoard() {
  var el = document.getElementById('team-project-tracking-board');
  if(!el) return;

  // 버튼 스타일 업데이트
  var btnList = document.getElementById('view-btn-list');
  var btnBoard = document.getElementById('view-btn-board');
  if(btnList && btnBoard) {
    btnList.className = `px-3 py-1 r20 text-xs font-bold ${teamTaskViewMode==='list'?'bg-white text-gray-800 shadow-sm':'text-gray-400'}`;
    btnBoard.className = `px-3 py-1 r20 text-xs font-bold ${teamTaskViewMode==='board'?'bg-white text-gray-800 shadow-sm':'text-gray-400'}`;
  }

  var teamTasks = CACHE.tasks.filter(t => t.taskType === 'team');
  if(teamTasks.length === 0) {
    el.innerHTML = '<div class="text-center py-20 text-gray-300 font-bold">등록된 팀별 업무가 없습니다.</div>';
    return;
  }

  if (teamTaskViewMode === 'list') {
    var groups = {};
    teamTasks.forEach(t => { var p = t.project || '공통 업무'; if(!groups[p]) groups[p] = []; groups[p].push(t); });
    
    var savedFolderOrder = JSON.parse(localStorage.getItem('teamFolderOrder')) || Object.keys(groups);
    Object.keys(groups).forEach(p => { if(!savedFolderOrder.includes(p)) savedFolderOrder.push(p); });

    // 🌟 [추가] 브라우저에 저장된 접힘 상태 가져오기
    var folderStates = JSON.parse(localStorage.getItem('teamFolderStates')) || {};

    el.innerHTML = savedFolderOrder.filter(pName => groups[pName]).map(pName => {
      var tasks = groups[pName].sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
      
      // 🌟 [핵심] 저장된 값이 'closed'면 open 속성을 아예 빼버림 (기본값은 열림)
      var isOpenAttr = folderStates[pName] === 'closed' ? '' : 'open';
      
      return `
        <details ${isOpenAttr} data-project="${esc(pName)}" class="bg-gray-50/50 r35 border border-gray-100 mb-6 group transition-all folder-drag-item shadow-sm" ontoggle="saveFolderState('${esc(pName)}', this.open)">
          <summary class="p-6 font-black text-gray-700 text-base cursor-pointer list-none flex justify-between items-center outline-none folder-drag-handle">
            <div class="flex items-center">
              <i class="ri-drag-move-2-line text-gray-300 mr-3 text-lg"></i>
              <i class="ri-folder-info-fill text-blue-400 mr-2 text-xl"></i> ${esc(pName)} 
              <span class="ml-2 text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 r20">${tasks.length}</span>
            </div>
            <i class="ri-arrow-down-s-line text-gray-400 text-xl group-open:rotate-180 transition-transform"></i>
          </summary>
          <div class="px-6 pb-6 pt-2 space-y-3">
            ${tasks.map(t => `
              <div onclick="openTaskDetail('${t.id}')" class="bg-white p-5 r24 border border-gray-200 hover:border-blue-400 cursor-pointer transition group shadow-sm">
                <div class="flex justify-between items-start gap-4"><p class="text-sm font-bold text-gray-800 flex-1">${esc(t.title)}</p>${statusBadge(t.status === 'Done' ? '완료' : '진행중')}</div>
                <div class="flex justify-between items-center mt-4"><div class="flex items-center gap-2"><span class="text-[10px] text-gray-500 font-bold">${getMemberName(t.creator)}</span></div><div class="text-[10px] text-gray-400"><i class="ri-chat-3-line"></i> ${Object.values(CACHE.comments).filter(c => c.targetId === t.id).length}</div></div>
              </div>`).join('')}
          </div>
        </details>`;
    }).join('');

    // 드래그 순서 저장 로직 (생략 - 기존 유지)
    new Sortable(el, { handle: '.folder-drag-handle', animation: 150, onEnd: function() {
        var order = Array.from(el.querySelectorAll('.folder-drag-item')).map(item => item.getAttribute('data-project'));
        localStorage.setItem('teamFolderOrder', JSON.stringify(order));
    }});

  } else {
    // 보드 모드 코드 (기존 유지)
    var statuses = ['Todo', 'In Progress', 'Done'];
    el.innerHTML = `<div class="flex gap-4 h-full min-w-max pb-4 overflow-x-auto">` + statuses.map(s => {
      var tasks = teamTasks.filter(t => t.status === s).sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
      return `
        <div class="w-64 flex flex-col bg-gray-50/50 r35 p-4 border border-gray-100">
          <div class="flex items-center justify-between mb-4 px-2"><span class="text-xs font-black uppercase tracking-wider text-gray-600">${s}</span><span class="text-xs font-bold text-gray-400">${tasks.length}</span></div>
          <div id="team-board-${s}" class="flex-1 space-y-3 min-h-[100px]">
            ${tasks.map(t => `<div data-id="${t.id}" onclick="openTaskDetail('${t.id}')" class="bg-white p-4 r20 border border-gray-200 hover:border-blue-400 cursor-pointer shadow-sm group"><p class="text-[10px] text-blue-500 font-bold mb-1">${t.project}</p><p class="text-xs font-bold text-gray-800 mb-3">${esc(t.title)}</p></div>`).join('')}
          </div>
        </div>`;
    }).join('') + `</div>`;
  }
}


// 🌟 폴더(프로젝트) 접힘/펼침 상태 실시간 저장
function saveFolderState(projectName, isOpen) {
  var folderStates = JSON.parse(localStorage.getItem('teamFolderStates')) || {};
  folderStates[projectName] = isOpen ? 'open' : 'closed';
  localStorage.setItem('teamFolderStates', JSON.stringify(folderStates));
}

// 하위 업무 추가 함수
function addSubTask(taskId) {
  var inp = document.getElementById('new-subtask-in');
  if(!inp.value.trim()) return;
  var t = CACHE.tasks.find(x => x.id === taskId);
  t.checklist.push({ text: inp.value.trim(), done: false, addedBy: USER.email });
  FB.patch('tasks/' + taskId, { checklist: t.checklist });
  inp.value = ''; openTaskDetail(taskId);
}

// 하위 업무 토글 함수
function toggleSubTask(taskId, idx, done) {
  var t = CACHE.tasks.find(x => x.id === taskId);
  t.checklist[idx].done = done;
  t.checklist[idx].completedBy = done ? USER.email : null;
  FB.patch('tasks/' + taskId, { checklist: t.checklist });
  setTimeout(() => openTaskDetail(taskId), 300);
}

function confirmDeleteTask(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("업무 삭제","이 업무를 삭제하시겠습니까?",function(){
    CACHE.tasks=CACHE.tasks.filter(function(x){return x.id!==id;});
    FB.patch('tasks/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    closeModal('task-detail-modal');
    renderMyTodo();
    renderTeamProjectBoard();
    showToast("삭제 완료");
  });
}

function submitTaskComment(id) {
  var inp = document.getElementById('task-cmt-in');
  if(!inp || !inp.value.trim()) return;
  var cId = genId();
  var c = {targetId: id, email: USER.email, authorName: USER.name, content: inp.value, date: nowFmt()};
  CACHE.comments[cId] = c;
  FB.set('comments/' + cId, c);
  openTaskDetail(id); // 화면 갱신
  showToast("의견이 등록되었습니다.");
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
  CACHE.tasks.push(obj);closeModal('team-task-modal');renderTeamProjectBoard();showToast("업무 등록 완료!");FB.set('tasks/'+id,obj);
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
// 1. 일정 삭제 변경
function deleteScheduleAction(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("일정 삭제","이 일정을 삭제할까요?",function(){
    CACHE.schedules=CACHE.schedules.filter(function(x){return x.id!==id;});
    FB.patch('schedules/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    closeModal('schedule-modal');showToast("삭제 완료 (숨김 처리됨)");
  });
}

function initDevTab(){
  var el=document.getElementById('tab-dev');if(el.querySelector('#dev-board-view'))return;
  el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><div><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-macbook-fill text-blue-500 mr-2"></i> 개발 프로젝트</h1><p class="text-sm text-gray-400 mt-1 ml-8" id="dev-project-count"></p></div><div class="flex items-center gap-3 flex-wrap"><label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-600 bg-white px-3 py-2 r24 border border-gray-200 shadow-sm hover:bg-blue-50 transition"><input type="checkbox" id="dev-my-filter" onchange="renderDevProjects()" class="w-4 h-4 accent-blue-600"> 내 업무만</label><div class="flex bg-white border border-gray-200 p-1 r24 text-xs font-bold"><button id="dev-view-list" onclick="setDevView(\'list\')" class="px-4 py-2 r20 text-gray-400">리스트</button><button id="dev-view-board" onclick="setDevView(\'board\')" class="px-4 py-2 r20 bg-gray-100 text-gray-800">보드</button></div><select id="dev-status-filter" onchange="renderDevProjects()" class="border border-gray-200 bg-white p-2.5 r24 text-xs font-bold outline-none text-gray-600"><option value="all">전체 상태</option><option>기획중</option><option>개발중</option><option>QA/테스트</option><option>배포완료</option><option>보류</option></select><input type="text" id="dev-search" oninput="renderDevProjects()" placeholder="검색..." class="pl-4 pr-4 py-2.5 border border-gray-200 r24 text-xs outline-none w-36 bg-white"><button onclick="openDevModal()" class="bg-blue-600 text-white px-5 py-2.5 r24 text-sm font-bold shadow-md hover:bg-blue-700 transition">+ 새 프로젝트</button></div></div><div id="dev-list-view" class="flex-1 overflow-y-auto hide-scrollbar hidden"><div id="dev-list-body" class="space-y-1.5"></div></div><div id="dev-board-view" class="flex-1 overflow-x-auto hide-scrollbar" style="min-height:0"><div class="flex gap-4 h-full pb-4 min-w-max">'+['기획중','개발중','QA/테스트','배포완료','보류'].map(function(s){var m=DEV_STATUS_META[s];return'<div class="w-72 flex flex-col"><div class="flex items-center gap-2 mb-3 px-2"><span class="w-2.5 h-2.5 rounded-full '+m.dot+'"></span><span class="text-xs font-black text-gray-600 uppercase tracking-wider">'+s+'</span><span class="text-xs text-gray-400 font-bold ml-auto" id="dev-cnt-'+s+'"></span></div><div class="space-y-3 flex-1 overflow-y-auto hide-scrollbar" id="dev-board-'+s+'"></div></div>';}).join('')+'</div></div>';
}
function setDevView(v){devView=v;var lv=document.getElementById('dev-list-view'),bv=document.getElementById('dev-board-view');if(lv)lv.classList.toggle('hidden',v!=='list');if(bv)bv.classList.toggle('hidden',v!=='board');['list','board'].forEach(function(x){var b=document.getElementById('dev-view-'+x);if(b)b.className='px-4 py-2 r20 transition text-xs font-bold '+(x===v?'bg-gray-100 text-gray-800':'text-gray-400');});renderDevProjects();}
function renderDevProjects(){
  initDevTab();
  var sf=(document.getElementById('dev-status-filter')||{value:'all'}).value;
  var kw=(document.getElementById('dev-search')||{value:''}).value.toLowerCase();
  var myOnly = document.getElementById('dev-my-filter') && document.getElementById('dev-my-filter').checked;
  var data=CACHE.devProjects.filter(function(p){
    var isMy = !myOnly || (p.assignees||'').toLowerCase().indexOf(USER.email.toLowerCase())>-1;
    return isMy && (sf==='all'||p.status===sf)&&(!kw||(p.title||'').toLowerCase().indexOf(kw)>-1||(p.tags||'').toLowerCase().indexOf(kw)>-1);
  });
  var cnt=document.getElementById('dev-project-count');if(cnt)cnt.innerText='총 '+data.length+'개';
  if(devView==='list')renderDevListView(data);else renderDevBoardView(data);
}
function renderDevListView(data){var el=document.getElementById('dev-list-body');if(!el)return;if(!data.length){el.innerHTML='<div class="text-center py-16 text-gray-400 font-bold text-sm">프로젝트가 없습니다.</div>';return;}el.innerHTML=data.map(function(p){var m=DEV_STATUS_META[p.status]||DEV_STATUS_META['보류'];return'<div onclick="openDevDetail(\''+p.id+'\')" class="group flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 bg-white r24 border border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer transition mb-1.5"><div class="flex items-center gap-3 flex-1 min-w-0"><span class="w-2 h-2 rounded-full '+m.dot+' shrink-0"></span><p class="font-black text-gray-800 text-sm truncate group-hover:text-blue-600">'+esc(p.title)+'</p></div><div class="flex items-center gap-3 flex-wrap">'+priorityHtml(p.priority)+'<span class="text-xs px-3 py-1 r20 font-black '+m.badge+'">'+p.status+'</span><div class="flex items-center gap-2"><div class="w-20 progress-bar"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div><span class="text-xs font-black text-blue-600">'+(p.progress||0)+'%</span></div><div class="flex">'+avatarHtml(p.assignees)+'</div></div></div>';}).join('');}
// ▼ 기존 renderDevBoardView 함수 전체를 지우고 이걸로 덮어쓰세요 ▼
function renderDevBoardView(data){
  ['기획중','개발중','QA/테스트','배포완료','보류'].forEach(function(s){
    var colEl=document.getElementById('dev-board-'+s); var cntEl=document.getElementById('dev-cnt-'+s); if(!colEl)return;
    var items=data.filter(function(p){return p.status===s;}); if(cntEl)cntEl.innerText=items.length+'건';
    if(!items.length){colEl.innerHTML='<div class="text-xs text-gray-300 font-bold text-center py-8 border-2 border-dashed border-gray-100 r24">없음</div>';}
    else {
      colEl.innerHTML=items.map(function(p){var pm=PRIORITY_META[p.priority]; var tBadge = p.ticketId ? '<span class="text-blue-500 mr-1 text-[10px]">['+p.ticketId+']</span>' : ''; return'<div data-id="'+p.id+'" onclick="openDevDetail(\''+p.id+'\')" class="bg-white border border-gray-100 hover:border-blue-300 p-5 r24 cursor-pointer shadow-sm hover:shadow-md transition group"><div class="flex items-start justify-between mb-2 gap-2"><p class="font-black text-gray-800 text-sm leading-snug group-hover:text-blue-600 flex-1">'+tBadge+esc(p.title)+'</p>'+(pm?'<span class="text-[10px] px-2 py-0.5 r20 font-black shrink-0 '+pm.bg+' '+pm.text+'"><i class="'+pm.icon+'"></i>'+p.priority+'</span>':'')+'</div><div class="flex gap-1 flex-wrap mb-3">'+tagHtml(p.tags)+'</div><div class="progress-bar mb-3"><div class="progress-fill" style="width:'+(p.progress||0)+'%"></div></div><div class="flex justify-between items-center"><div class="flex">'+avatarHtml(p.assignees,3)+'</div></div></div>';}).join('');
    }
    new Sortable(colEl, { group: 'dev-projects', animation: 150, onEnd: function(evt) { var newStatus = evt.to.id.replace('dev-board-', ''); var projectId = evt.item.getAttribute('data-id'); if(!projectId) return; var d = CACHE.devProjects.find(function(x){return x.id===projectId;}); if(d) d.status = newStatus; FB.patch('devProjects/'+projectId, {status: newStatus}); showToast("상태가 [" + newStatus + "]로 변경되었습니다."); }});
  });
}

// (추가) 댓글 전송 함수
function submitDevComment(id){
  var inp=document.getElementById('dev-cmt-in');if(!inp||!inp.value.trim())return;
  var msg=inp.value; inp.value=''; var cId=genId();
  var c={targetId:id,email:USER.email,authorName:USER.name,content:msg,date:nowFmt()};
  CACHE.comments[cId]=c; 
  FB.set('comments/'+cId,c);
  openDevDetail(id); // 화면 새로고침
}
// (추가) 개발 프로젝트 세부 업무 로직
function renderDevProjectTasks(id){
  var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d)return;
  var el=document.getElementById('dev-task-list');if(!el)return;
  if(!d.tasks || !d.tasks.length){el.innerHTML='<p class="text-xs text-gray-400 text-center py-4 font-bold">등록된 세부 업무가 없습니다.</p>';return;}

  var groups={};
  d.tasks.forEach(function(t, i){
    var cat=t.category||'기본';
    if(!groups[cat]) groups[cat]=[];
    t.originalIndex=i;
    groups[cat].push(t);
  });

  var html='';
  Object.keys(groups).sort().forEach(function(cat){
    html+='<div class="mb-3"><h4 class="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 px-2 bg-gray-100 inline-block rounded-full py-1">'+esc(cat)+'</h4>';
    var catTasks=groups[cat].sort(function(a,b){return (a.deadline||'9999-99-99').localeCompare(b.deadline||'9999-99-99');});
    catTasks.forEach(function(t){
      html+='<div class="flex items-center gap-3 p-2.5 '+(t.done?'bg-gray-50':'')+' r20 group transition border-b border-gray-50 last:border-0"><input type="checkbox" class="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0" '+(t.done?'checked':'')+' onchange="toggleDevProjectTask(\''+id+'\','+t.originalIndex+',this.checked)"><div class="flex-1 min-w-0"><p class="text-xs '+(t.done?'line-through text-gray-400':'font-bold text-gray-700')+'">'+esc(t.text)+'</p></div>'+(t.deadline?'<span class="text-[10px] '+(t.done?'bg-gray-200 text-gray-400':'bg-red-50 text-red-600')+' px-2 py-0.5 r20 font-bold shrink-0"><i class="ri-calendar-event-line"></i> '+t.deadline+'</span>':'')+'<button onclick="deleteDevProjectTask(\''+id+'\','+t.originalIndex+')" class="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition ml-2"><i class="ri-delete-bin-line text-sm"></i></button></div>';
    });
    html+='</div>';
  });
  el.innerHTML=html;
}

// 🌟 진행률 자동 계산 함수 (새로 추가)
function updateDevProgress(id) {
  var d = CACHE.devProjects.find(x => x.id === id);
  if(!d) return;
  if(!d.tasks || d.tasks.length === 0) { d.progress = 0; }
  else {
    var doneCount = d.tasks.filter(t => t.done).length;
    d.progress = Math.round((doneCount / d.tasks.length) * 100);
  }
  
  FB.patch('devProjects/'+id, {progress: d.progress});
  renderDevProjects(); // 리스트 갱신
  
  // 모달이 열려있다면 게이지바 애니메이션 적용
  var progFill = document.getElementById('dev-detail-progress-fill');
  var progText = document.getElementById('dev-detail-progress-text');
  if(progFill) progFill.style.width = d.progress + '%';
  if(progText) progText.innerText = d.progress + '%';
}

// 2-2. 상세업무 추가/수정/삭제 시 진행률 함수(updateDevProgress) 호출 추가
function addDevProjectTask(id){
  var cat=document.getElementById('dev-task-cat').value.trim()||'기본';
  var text=document.getElementById('dev-task-text').value.trim();
  var deadline=document.getElementById('dev-task-deadline').value;
  if(!text) return showToast('업무 내용을 입력하세요.');
  var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d)return;
  if(!d.tasks) d.tasks=[];
  d.tasks.push({category:cat, text:text, deadline:deadline, done:false});
  FB.patch('devProjects/'+id, {tasks:d.tasks});
  document.getElementById('dev-task-text').value='';
  renderDevProjectTasks(id);
  updateDevProgress(id); // 🌟 진행률 업데이트
}

function toggleDevProjectTask(id, idx, done){
  var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d||!d.tasks)return;
  d.tasks[idx].done=done;
  FB.patch('devProjects/'+id, {tasks:d.tasks});
  renderDevProjectTasks(id);
  updateDevProgress(id); // 🌟 진행률 업데이트
}

function deleteDevProjectTask(id, idx){
  var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d||!d.tasks)return;
  d.tasks.splice(idx,1);
  FB.patch('devProjects/'+id, {tasks:d.tasks});
  renderDevProjectTasks(id);
  updateDevProgress(id); // 🌟 진행률 업데이트
}

// 2-3. 상세 모달창 열 때 HTML에 id 부여 (진행률 애니메이션 용도)
function openDevDetail(id){
  var d=CACHE.devProjects.find(function(x){return String(x.id)===String(id);});if(!d)return;
  if(!d.images) d.images = [];
  var cList=Object.keys(CACHE.comments||{}).map(function(k){return CACHE.comments[k];}).filter(function(c){return c.targetId===id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var tBadge = d.ticketId ? '<span class="text-blue-600 mr-2 text-sm bg-blue-100 px-2 py-1 r20 font-black">['+d.ticketId+']</span>' : '';
  var noteHtml = d.note && d.note.includes('<') ? d.note : esc(d.note||'내용 없음');

  var leftHtml = '<div class="flex-1 p-8 md:p-10 overflow-y-auto"><div class="flex items-center gap-2 mb-2">'+tBadge+priorityHtml(d.priority,'md')+'</div><h2 class="text-xl md:text-3xl font-black text-gray-900 mb-4 pr-10">'+esc(d.title)+'</h2><div class="flex gap-2 flex-wrap mb-4">'+tagHtml(d.tags)+'<span class="text-xs px-3 py-1 r20 font-black '+(DEV_STATUS_META[d.status]||DEV_STATUS_META['보류']).badge+'">'+d.status+'</span>'+(d.deadline?'<span class="text-xs px-3 py-1 r20 font-black bg-red-50 text-red-600"><i class="ri-calendar-line"></i> 마감: '+d.deadline+'</span>':'')+'</div>' + 
  // 🌟 게이지 바에 ID 부여
  '<div class="grid grid-cols-1 gap-4 mb-6 bg-gray-50 p-5 r24 text-sm"><div><span class="text-gray-400 text-xs font-bold">진행률 (자동계산)</span><div class="flex items-center gap-2 mt-1"><div class="flex-1 progress-bar"><div id="dev-detail-progress-fill" class="progress-fill transition-all duration-500" style="width:'+(d.progress||0)+'%"></div></div><span id="dev-detail-progress-text" class="text-sm font-black text-blue-600">'+(d.progress||0)+'%</span></div></div><div><span class="text-gray-400 text-xs font-bold">담당자</span><div class="flex gap-1 mt-1">'+avatarHtml(d.assignees,8)+'</div></div></div><div class="mb-6 border-t border-gray-100 pt-5"><h3 class="text-sm font-black text-gray-800 flex items-center gap-2 mb-3"><i class="ri-list-check-2 text-blue-500"></i> 카테고리별 세부 업무</h3><div id="dev-task-list" class="space-y-3 mb-4 max-h-[300px] overflow-y-auto hide-scrollbar"></div><div class="flex gap-2 bg-gray-50 p-3 r20"><input type="text" id="dev-task-cat" placeholder="분류(예: 기획)" class="w-1/4 border p-2 r20 text-xs outline-none bg-white focus:border-blue-400"><input type="text" id="dev-task-text" placeholder="업무 내용 입력" class="flex-1 border p-2 r20 text-xs outline-none bg-white focus:border-blue-400"><input type="date" id="dev-task-deadline" class="w-32 border p-2 r20 text-xs outline-none bg-white focus:border-blue-400"><button onclick="addDevProjectTask(\''+d.id+'\')" class="bg-blue-600 text-white px-4 py-2 r20 text-xs font-bold hover:bg-blue-700 shadow-sm">추가</button></div></div><div class="bg-white border border-gray-200 p-5 r24 mb-6"><p class="text-xs font-black text-blue-500 mb-4 border-b pb-2">상세 설명 (에디터)</p><div class="ql-editor p-0 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">'+noteHtml+'</div></div>' + 
  '<div class="mb-8 border-t pt-6"><div class="flex justify-between items-center mb-4"><h3 class="text-sm font-black text-gray-800 flex items-center gap-2"><i class="ri-image-add-fill text-blue-500"></i> 첨부 이미지</h3><label class="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 r20 text-xs font-bold transition">+ 사진 올리기<input type="file" class="hidden" accept="image/*" onchange="handleDevImage(this, \''+d.id+'\')"></label></div><div class="grid grid-cols-2 md:grid-cols-3 gap-3">' + (d.images.length===0 ? '<p class="text-xs text-gray-400 col-span-3 py-4">첨부된 사진이 없습니다.</p>' : d.images.map(img => `<a href="${img}" target="_blank" class="block aspect-video bg-gray-100 r20 overflow-hidden border border-gray-200 hover:border-blue-400 transition"><img src="${img}" class="w-full h-full object-cover object-center"></a>`).join('')) + '</div></div>' +
  '<div class="flex justify-end gap-3"><button onclick="closeModal(\'dev-detail-modal\');openDevModal(CACHE.devProjects.find(function(x){return x.id===\''+d.id+'\';}))" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">수정</button><button onclick="confirmDeleteDev2(\''+d.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold hover:bg-red-100 transition">삭제</button></div></div>';
  
  var rightHtml = '<div class="w-full md:w-[360px] bg-gray-50 border-l p-8 flex flex-col h-[600px] md:h-auto"><h3 class="font-black text-lg mb-4 text-gray-800"><i class="ri-chat-3-fill text-blue-500 mr-2"></i>업무 코멘트 / 멘션</h3><div id="dev-cmt-list" class="flex-1 overflow-y-auto space-y-3 hide-scrollbar mb-4">'+(cList.length?cList.map(function(c){var ctext = esc(c.content).replace(/@([^\s]+)/g, '<span class="text-blue-600 font-bold bg-blue-100 px-1 r20">@$1</span>');return'<div class="bg-white p-4 r20 shadow-sm border border-gray-100"><div class="flex justify-between items-center mb-1"><span class="font-black text-xs text-gray-800">'+c.authorName+'</span><span class="text-[10px] text-gray-400">'+c.date+'</span></div><p class="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">'+ctext+'</p></div>';}).join(''):'<p class="text-xs text-gray-400 text-center py-10">댓글이 없습니다.<br>@이름 으로 팀원을 호출해 보세요.</p>')+'</div><div class="relative"><textarea id="dev-cmt-in" rows="3" placeholder="@이름 으로 멘션, 내용 입력..." class="w-full border p-4 pr-12 r20 text-sm outline-none resize-none focus:border-blue-400 shadow-sm bg-white"></textarea><button onclick="submitDevComment(\''+d.id+'\')" class="absolute bottom-4 right-4 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-700 transition"><i class="ri-send-plane-fill text-sm"></i></button></div></div>';

  renderModalRoot('dev-detail-modal','<div class="bg-white r35 modal-content max-w-6xl p-0 shadow-2xl relative fade-in flex flex-col md:flex-row overflow-hidden"><button onclick="closeModal(\'dev-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black z-10"><i class="ri-close-line text-3xl"></i></button>'+leftHtml+rightHtml+'</div>');
  openModal('dev-detail-modal'); renderDevProjectTasks(d.id); var cl=document.getElementById('dev-cmt-list');if(cl)cl.scrollTop=cl.scrollHeight;
}

// 2. 개발 프로젝트 삭제 변경
function confirmDeleteDev2(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("프로젝트 삭제","정말 삭제하시겠습니까?",function(){
    CACHE.devProjects=CACHE.devProjects.filter(function(x){return x.id!==id;});
    closeModal('dev-detail-modal');renderDevProjects();
    FB.patch('devProjects/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    showToast("삭제 완료 (숨김 처리됨)");
  });
}

// 1-1. 프로젝트 생성 모달 (진행률 수동입력 제거, 드롭다운 z-index 수정)
function openDevModal(data){
  // 기존 수동 진행률(progressHtml) 삭제
  renderModalRoot('dev-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-10 shadow-2xl fade-in overflow-y-visible max-h-[90vh]"><h2 class="text-xl md:text-2xl font-black text-blue-600 mb-6"><i class="ri-macbook-fill"></i> '+(data?'프로젝트 수정':'프로젝트 생성')+'</h2><input id="dev-title" type="text" value="'+(data?esc(data.title):'')+'" placeholder="프로젝트명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50 focus:border-blue-500"><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">우선순위</label><select id="dev-priority-select" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50"><option value="P1" '+(data&&data.priority==='P1'?'selected':'')+'>P1 긴급</option><option value="P2" '+(data&&data.priority==='P2'?'selected':'')+'>P2 높음</option><option value="P3" '+((!data||data.priority==='P3')?'selected':'')+'>P3 보통</option><option value="P4" '+(data&&data.priority==='P4'?'selected':'')+'>P4 낮음</option></select></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">상태</label><select id="dev-status" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50">'+Object.keys(DEV_STATUS_META).map(function(s){return'<option value="'+s+'" '+(data&&data.status===s?'selected':'')+'>'+s+'</option>';}).join('')+'</select></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">프로젝트 마감일</label><input id="dev-deadline-main" type="date" value="'+(data&&data.deadline?data.deadline:'')+'" class="w-full border p-4 r24 outline-none text-sm font-bold bg-gray-50"></div></div><div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">태그 (쉼표 구분)</label><input id="dev-tags-input" type="text" value="'+(data?esc(data.tags||''):'')+'" placeholder="iOS, API" class="w-full border p-4 r24 outline-none text-sm bg-gray-50"></div>' + 
  
  // 🌟 참여인원 드롭다운이 에디터 위로 올라오도록 relative와 z-50 부여
  '<div class="mb-6 relative z-50"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">참여 인원</label><div id="dev-assignees-container" class="w-full border p-4 r24 bg-white max-h-32 overflow-y-auto space-y-2 hide-scrollbar shadow-inner relative z-50"></div></div>' + 
  
  // 에디터 컨테이너는 z-index를 낮게(z-10) 설정
  '<label class="block text-xs font-bold text-gray-500 mb-2 pl-2">프로젝트 상세 설명</label><div id="dev-quill-container" class="mb-6 bg-white border border-gray-200 r24 relative z-10" style="height: 250px;"></div><input type="hidden" id="dev-edit-id" value="'+(data?data.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'dev-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">취소</button><button onclick="submitDevProject()" class="px-8 py-3.5 bg-blue-600 text-white r35 text-sm font-bold shadow-lg hover:bg-blue-700 transition">'+(data?'수정':'생성')+'</button></div></div>');
  
  openModal('dev-modal');
  populateAssignees('dev-assignees-container',data?data.assignees:'');
  
  setTimeout(function(){
    devQuillEditor = new Quill('#dev-quill-container', editorOptions);
    if(data && data.note) devQuillEditor.root.innerHTML = data.note;
  }, 100);
}

// 1-2. 프로젝트 생성/수정 시 기존 진행률 유지
function submitDevProject(){
  var id=document.getElementById('dev-edit-id').value;
  var title=document.getElementById('dev-title').value.trim();
  if(!title) return showToast("프로젝트명을 입력하세요.");
  
  var fields={
    title:title, status:document.getElementById('dev-status').value, 
    assignees:getChecked('dev-assignees-container'), 
    deadline: document.getElementById('dev-deadline-main').value,
    note: devQuillEditor.root.innerHTML,
    tags:document.getElementById('dev-tags-input').value, priority:document.getElementById('dev-priority-select').value
  };
  
  if(id){
    var idx=CACHE.devProjects.findIndex(function(x){return x.id===id;});
    if(idx>-1) Object.assign(CACHE.devProjects[idx],fields); // 기존 진행률(progress) 보존됨
    closeModal('dev-modal');showToast("수정 완료!");renderDevProjects();FB.patch('devProjects/'+id,fields);
  }else{
    var newId=genId();
    var tId=getNextTicketId(CACHE.devProjects, 'DEV');
    // 새 프로젝트는 진행률 0으로 시작
    var obj=Object.assign({id:newId, ticketId:tId, images:[], progress:0},fields,{creator:USER.email,timestamp:Date.now()});
    CACHE.devProjects.push(obj); closeModal('dev-modal');showToast("생성 완료 ("+tId+")");renderDevProjects();FB.set('devProjects/'+newId,obj);
  }
}



// 📸 개발 프로젝트 - 이미지 업로드 처리 함수
function handleDevImage(input, devId) {
  if(!input.files || !input.files[0]) return;
  showToast("⏳ 사진을 압축하여 올리는 중...");
  compressAndUploadImage(input.files[0], 'dev_images', function(url){
    var d = CACHE.devProjects.find(x => x.id === devId);
    if(!d.images) d.images = [];
    d.images.push(url);
    FB.patch('devProjects/' + devId, { images: d.images });
    showToast("✅ 사진 업로드 완료!");
    openDevDetail(devId); // 모달 새로고침
  });
}


// ═══════════════════════════════════════════════
//  CRM
// ═══════════════════════════════════════════════
var CRM_COLUMNS=[{label:'잠재고객(Lead)',key:'Lead',cls:'text-gray-500'},{label:'연락/미팅(Contact)',key:'Contact',cls:'text-blue-500'},{label:'제안/견적(Proposal)',key:'Proposal',cls:'text-purple-500'},{label:'계약성공(Won)',key:'Won',cls:'text-emerald-600'}];
function initCRMTab(){var el=document.getElementById('tab-crm');if(el.querySelector('#col-crm-Lead'))return;el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-briefcase-4-fill text-emerald-500 mr-2"></i> 영업 파이프라인</h1><div class="flex items-center gap-3 flex-wrap"><input type="text" id="crm-search" oninput="filterCRM()" placeholder="고객사명 검색..." class="px-4 py-3 border r35 text-sm outline-none w-48 bg-white card-shadow"><button onclick="openCRMModal()" class="bg-emerald-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-emerald-600 transition">+ 영업 리드 등록</button></div></div><div class="flex gap-4 flex-1 pb-6 overflow-x-auto hide-scrollbar">'+CRM_COLUMNS.map(function(col){return'<div class="flex-1 min-w-[260px] bg-white p-5 r35 card-shadow flex flex-col"><h2 class="font-black '+col.cls+' text-sm uppercase mb-4 px-2 tracking-wider">'+col.label+'</h2><div id="col-crm-'+col.key+'" class="flex-1 space-y-4 overflow-y-auto hide-scrollbar"></div></div>';}).join('')+'</div>';}
function filterCRM(){initCRMTab();var k=(document.getElementById('crm-search')||{value:''}).value.toLowerCase();renderCRMUI(CACHE.crm.filter(function(c){return(c.company||'').toLowerCase().indexOf(k)>-1||(c.contactName||'').toLowerCase().indexOf(k)>-1;}));}
function renderCRMUI(data){
  var colMap={'잠재고객(Lead)':'col-crm-Lead','연락/미팅(Contact)':'col-crm-Contact','제안/견적(Proposal)':'col-crm-Proposal','계약성공(Won)':'col-crm-Won'};
  Object.values(colMap).forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='';});
  data.forEach(function(d){
    var colId=colMap[d.status]||'col-crm-Lead';var el=document.getElementById(colId);if(!el)return;
    var lastComment=Object.keys(CACHE.comments||{}).map(function(k){return CACHE.comments[k];}).filter(function(c){return c.targetId===d.id;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0];
    var lastDate=lastComment?lastComment.date:'';var daysAgo='';if(lastDate){var diff=Math.floor((Date.now()-new Date(lastDate).getTime())/86400000);daysAgo=diff===0?'오늘':diff+'일 전';}
    el.innerHTML+='<div onclick="openCRMDetail(\''+d.id+'\')" data-id="'+d.id+'" class="bg-white p-5 r24 card-shadow border-2 border-transparent hover:border-emerald-300 card-hover cursor-pointer"><h3 class="text-sm font-black text-gray-800 mb-1 truncate">'+esc(d.company)+'</h3><p class="text-xs text-gray-500 mb-2">'+esc(d.contactName||'-')+'</p>'+(d.firstDate?'<p class="text-[10px] font-bold text-emerald-600 mb-2"><i class="ri-calendar-event-fill mr-1"></i>최초 거래: '+d.firstDate+'</p>':'')+'<div class="flex justify-between items-center"><div class="flex gap-1"><span class="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 r20 font-bold">'+(d.b2Type||'B2B')+'</span></div>'+(daysAgo?'<span class="text-[10px] text-gray-400 font-bold">'+daysAgo+' 업데이트</span>':'')+'</div></div>';
  });
  Object.entries(colMap).forEach(function(e){
    var colId=e[1];var el=document.getElementById(colId);if(!el)return;
    new Sortable(el,{group:'crm',onEnd:function(ev){
      var statusMap={'col-crm-Lead':'잠재고객(Lead)','col-crm-Contact':'연락/미팅(Contact)','col-crm-Proposal':'제안/견적(Proposal)','col-crm-Won':'계약성공(Won)'};
      var ns=statusMap[ev.to.id];var cId=ev.item.getAttribute('data-id');var idx=CACHE.crm.findIndex(function(x){return x.id===cId;});
      if(idx>-1&&ns&&CACHE.crm[idx].status!==ns){CACHE.crm[idx].status=ns;FB.patch('crm/'+cId,{status:ns});if(ns==='계약성공(Won)')showToast('🎉 파트너십 성공!');}
    }});
  });
}
function openCRMModal(data){
  var services = ['세척서비스', '아란테', '세척장구축컨설팅', '용기판매', '기타'];
  var currentServices = data && data.serviceType ? data.serviceType.split(',') : [];
  
  var serviceHtml = services.map(s => `
    <label class="flex items-center gap-2 cursor-pointer bg-white p-2 r20 border border-gray-100 hover:bg-gray-50 shadow-sm">
      <input type="checkbox" class="crm-service-cb w-4 h-4 accent-emerald-500" value="${s}" ${currentServices.includes(s) ? 'checked' : ''}>
      <span class="text-xs font-bold text-gray-700">${s}</span>
    </label>
  `).join('');

  renderModalRoot('crm-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black text-emerald-700 mb-6"><i class="ri-briefcase-4-fill"></i> '+(data?'고객사 수정':'고객사 등록')+'</h2>'+
    '<input id="crm-company" type="text" value="'+(data?esc(data.company):'')+'" placeholder="고객사명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50">'+
    '<div class="grid grid-cols-2 gap-4 mb-4"><input id="crm-name" type="text" value="'+(data?esc(data.contactName||''):'')+'" placeholder="담당자" class="border p-4 r24 outline-none text-sm"><input id="crm-phone" type="text" value="'+(data?esc(data.phone||''):'')+'" placeholder="연락처" class="border p-4 r24 outline-none text-sm"></div>'+
    
    // B2B/B2G/B2C 선택 (라디오)
    '<label class="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2">고객 구분</label>'+
    '<div class="flex gap-3 mb-4">'+
      ['B2B', 'B2G', 'B2C'].map(v => `<label class="flex-1 flex items-center justify-center gap-2 p-3 border r24 cursor-pointer hover:bg-emerald-50 transition bg-white font-bold text-sm text-gray-600 has-[:checked]:border-emerald-500 has-[:checked]:text-emerald-700 has-[:checked]:bg-emerald-50"><input type="radio" name="crm-b2-type" value="${v}" class="hidden" ${data && data.b2Type === v ? 'checked' : (!data && v === 'B2B' ? 'checked' : '')}>${v}</label>`).join('')+
    '</div>'+

    // 사업 영역 (중복 체크박스)
    '<label class="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-2">관련 사업 (중복 선택)</label>'+
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">'+serviceHtml+'</div>'+

    '<select id="crm-status" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-emerald-50 text-emerald-700"><option value="잠재고객(Lead)" '+((!data||data.status==='잠재고객(Lead)')?'selected':'')+'>잠재고객</option><option value="연락/미팅(Contact)" '+(data&&data.status==='연락/미팅(Contact)'?'selected':'')+'>연락/미팅</option><option value="제안/견적(Proposal)" '+(data&&data.status==='제안/견적(Proposal)'?'selected':'')+'>제안/견적</option><option value="계약성공(Won)" '+(data&&data.status==='계약성공(Won)'?'selected':'')+'>계약성공</option></select>'+
    '<textarea id="crm-note" rows="3" placeholder="비고" class="w-full border p-4 r24 mb-6 outline-none text-sm">'+(data?esc(data.note||''):'')+'</textarea>'+
    '<input type="hidden" id="crm-edit-id" value="'+(data?data.id:'')+'">'+
    '<div class="flex justify-end gap-3"><button onclick="closeModal(\'crm-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitCRM()" class="px-8 py-3.5 bg-emerald-600 text-white r35 text-sm font-bold shadow-lg">'+(data?'수정':'등록')+'</button></div></div>');openModal('crm-modal');
}
function submitCRM(){
  var id=document.getElementById('crm-edit-id').value;
  var co=document.getElementById('crm-company').value.trim();
  if(!co)return showToast("고객사명 입력");
  
  // 체크된 사업 영역 가져오기
  var selectedServices = Array.from(document.querySelectorAll('.crm-service-cb:checked')).map(cb => cb.value).join(',');
  // 라디오에서 선택된 고객 구분 가져오기
  var b2Type = document.querySelector('input[name="crm-b2-type"]:checked').value;

  var f={
    company: co,
    contactName: document.getElementById('crm-name').value,
    phone: document.getElementById('crm-phone').value,
    b2Type: b2Type,
    serviceType: selectedServices, // 중복 선택된 사업 영역 저장
    status: document.getElementById('crm-status').value,
    note: document.getElementById('crm-note').value,
    manager: USER.email
  };

  if(id){
    var idx=CACHE.crm.findIndex(function(x){return x.id===id;});
    if(idx>-1)Object.assign(CACHE.crm[idx],f);
    closeModal('crm-modal');
    showToast("수정 완료!");
    filterCRM();
    FB.patch('crm/'+id,f);
  }else{
    var nid=genId();
    var o=Object.assign({id:nid},f,{timestamp:Date.now()});
    CACHE.crm.push(o);
    closeModal('crm-modal');
    showToast("등록 완료!");
    filterCRM();
    FB.set('crm/'+nid,o);
  }
}
function openCRMDetail(id){
  var d=CACHE.crm.find(function(x){return String(x.id)===String(id);});if(!d)return;
  var cList=Object.keys(CACHE.comments||{}).map(function(k){return CACHE.comments[k];}).filter(function(c){return c.targetId===id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  renderModalRoot('crm-detail-modal','<div class="bg-white r35 modal-content max-w-5xl p-0 shadow-2xl relative fade-in flex flex-col md:flex-row overflow-hidden"><button onclick="closeModal(\'crm-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black z-10"><i class="ri-close-line text-3xl"></i></button><div class="flex-1 p-8 md:p-10 overflow-y-auto"><h2 class="text-2xl md:text-3xl font-black mb-4 text-gray-900 pr-10">'+esc(d.company)+'</h2><div class="flex gap-2 mb-6"><span class="text-xs px-3 py-1 r20 font-black bg-gray-100 text-gray-600">'+(d.b2Type||'B2B')+'</span><span class="text-xs px-3 py-1 r20 font-black bg-emerald-50 text-emerald-700">'+d.status+'</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-5 r24 text-sm"><div><span class="text-gray-400 text-xs font-bold block mb-1">담당자</span><span class="font-bold">'+esc(d.contactName||'-')+'</span></div><div><span class="text-gray-400 text-xs font-bold block mb-1">최초 거래(협력)일</span><span class="font-bold text-emerald-600">'+(d.firstDate||'미기재')+'</span></div><div><span class="text-gray-400 text-xs font-bold block mb-1">연락처</span><span class="font-bold text-blue-600">'+esc(d.phone||'-')+'</span></div></div><div class="mb-6"><p class="text-xs font-black text-gray-400 mb-2">기본 정보</p><div class="bg-gray-50 p-5 r24 whitespace-pre-wrap text-sm text-gray-700">'+esc(d.note||'비고 없음')+'</div></div><div class="flex justify-end gap-3"><button onclick="closeModal(\'crm-detail-modal\');openCRMModal(CACHE.crm.find(function(x){return x.id===\''+d.id+'\';}))" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold">수정</button><button onclick="confirmDeleteCRM(\''+d.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold">삭제</button></div></div><div class="w-full md:w-[360px] bg-gray-50 border-l p-8 flex flex-col h-[500px] md:h-auto"><h3 class="font-black text-lg mb-4 text-gray-800"><i class="ri-history-line text-emerald-500 mr-2"></i>조직 히스토리</h3><div id="crm-cmt-list" class="flex-1 overflow-y-auto space-y-3 hide-scrollbar mb-4">'+(cList.length?cList.map(function(c){return'<div class="bg-white p-4 r20 shadow-sm border border-gray-100"><div class="flex justify-between items-center mb-1"><span class="font-black text-xs text-gray-800">'+c.authorName+'</span><span class="text-[10px] text-gray-400">'+c.date+'</span></div><p class="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">'+esc(c.content)+'</p></div>';}).join(''):'<p class="text-xs text-gray-400 text-center py-10">히스토리가 없습니다.</p>')+'</div><div class="relative"><textarea id="crm-cmt-in" rows="3" placeholder="미팅 결과, 특이사항 기록..." class="w-full border p-4 pr-12 r20 text-sm outline-none resize-none focus:border-emerald-400 shadow-sm bg-white"></textarea><button onclick="submitCRMComment(\''+d.id+'\')" class="absolute bottom-4 right-4 bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-600 transition"><i class="ri-send-plane-fill text-sm"></i></button></div></div></div>');
  openModal('crm-detail-modal');
  var cl=document.getElementById('crm-cmt-list');if(cl)cl.scrollTop=cl.scrollHeight;
  setTimeout(function(){ setupMention('crm-cmt-in'); }, 200);
}

function submitCRMComment(id){
  var inp=document.getElementById('crm-cmt-in');if(!inp||!inp.value.trim())return;
  var msg=inp.value;inp.value='';var cId=genId();
  var c={targetId:id,email:USER.email,authorName:USER.name,content:msg,date:nowFmt()};
  CACHE.comments[cId]=c;FB.set('comments/'+cId,c);openCRMDetail(id);
}
// 3. CRM 삭제 변경
function confirmDeleteCRM(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("고객사 삭제","정말 삭제하시겠습니까?",function(){
    CACHE.crm=CACHE.crm.filter(function(x){return x.id!==id;});
    closeModal('crm-detail-modal');filterCRM();
    FB.patch('crm/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    showToast("삭제 완료 (숨김 처리됨)");
  });
}
// ▲ 여기까지 복사 ▲

/*═══════════ CS ═══════════*/
function initCSTab(){
  var el=document.getElementById('tab-cs');if(el.querySelector('#col-cs-대기'))return;
  el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-customer-service-2-fill text-orange-500 mr-2"></i> CS 고객지원</h1><div class="flex gap-3 flex-wrap"><label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-600 bg-white px-3 py-2 r35 border border-gray-200 shadow-sm hover:bg-orange-50 transition"><input type="checkbox" id="cs-my-filter" onchange="filterCS()" class="w-4 h-4 accent-orange-500"> 내 업무만</label><input type="text" id="cs-search" oninput="filterCS()" placeholder="검색..." class="px-4 py-3 border r35 text-sm outline-none w-48 bg-white card-shadow"><button onclick="openCSModal()" class="bg-orange-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 티켓 생성</button></div></div><div class="flex gap-4 flex-1 pb-6 overflow-x-auto hide-scrollbar">'+[['대기','text-red-500','신규 접수'],['처리중','text-orange-500','처리 중'],['완료','text-gray-400','완료']].map(function(x){return'<div class="flex-1 min-w-[260px] bg-white p-5 r35 card-shadow flex flex-col"><h2 class="font-black '+x[1]+' text-sm uppercase mb-4 px-2 tracking-wider">'+x[2]+'</h2><div id="col-cs-'+x[0]+'" class="flex-1 space-y-4 overflow-y-auto hide-scrollbar"></div></div>';}).join('')+'</div>';
}

function filterCS(){
  initCSTab();
  var k=(document.getElementById('cs-search')||{value:''}).value.toLowerCase();
  var myOnly = document.getElementById('cs-my-filter') && document.getElementById('cs-my-filter').checked;
  renderCSUI(CACHE.cs.filter(function(c){
    var isMy = !myOnly || (c.assignees||'').toLowerCase().indexOf(USER.email.toLowerCase())>-1;
    return isMy && ((c.customer||'').toLowerCase().indexOf(k)>-1||(c.issue||'').toLowerCase().indexOf(k)>-1);
  }));
}

function renderCSUI(data){
  ['대기','처리중','완료'].forEach(function(s){var el=document.getElementById('col-cs-'+s);if(el)el.innerHTML='';});
  data.forEach(function(d){
    var pColor=d.priority==='긴급'?'bg-red-100 text-red-600':'bg-orange-100 text-orange-600';
    var el=document.getElementById('col-cs-'+(d.status||'대기'));if(!el)return;
    var tBadge = d.ticketId ? '<span class="text-orange-500 mr-1">['+d.ticketId+']</span>' : '';
    el.innerHTML+='<div data-id="'+d.id+'" onclick="openCSDetail(\''+d.id+'\')" class="bg-white p-5 r24 card-shadow border-2 border-transparent hover:border-orange-300 card-hover cursor-pointer"><div class="flex justify-between items-center mb-2"><span class="text-[10px] px-3 py-1 r20 font-black '+pColor+'">'+d.priority+'</span><div class="flex">'+avatarHtml(d.assignees,3)+'</div></div><h3 class="text-sm font-black text-gray-800 mb-1 truncate">'+tBadge+esc(d.customer)+'</h3><p class="text-xs text-gray-500 line-clamp-2">'+esc(d.issue)+'</p></div>';
  });
  ['대기','처리중','완료'].forEach(function(s){
    var el=document.getElementById('col-cs-'+s);if(!el)return;
    new Sortable(el,{group:'cs',onEnd:function(ev){
      var ns=ev.to.id.replace('col-cs-','');var cId=ev.item.getAttribute('data-id');var idx=CACHE.cs.findIndex(function(x){return x.id===cId;});
      if(idx>-1&&CACHE.cs[idx].status!==ns){ CACHE.cs[idx].status=ns;FB.patch('cs/'+cId,{status:ns});if(ns==='완료')showToast('✅ CS 처리 완료!'); }
    }});
  });
}

// 수정 모드 지원하도록 openCSModal 변경
function openCSModal(data){
  renderModalRoot('cs-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-orange-500"><i class="ri-customer-service-2-fill"></i> '+(data?'CS 티켓 수정':'신규 CS 티켓')+'</h2><input id="cs-customer" type="text" value="'+(data?esc(data.customer):'')+'" placeholder="고객사명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50 focus:border-orange-400"><select id="cs-priority" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold"><option value="긴급" '+(data&&data.priority==='긴급'?'selected':'')+'>긴급</option><option value="보통" '+(!data||data.priority==='보통'?'selected':'')+'>보통</option><option value="낮음" '+(data&&data.priority==='낮음'?'selected':'')+'>낮음</option></select><div class="mb-4"><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">담당자 할당</label><div id="cs-assignees" class="w-full border r24 bg-white max-h-40 overflow-y-auto hide-scrollbar shadow-inner"></div></div><textarea id="cs-issue" rows="4" placeholder="이슈 상세" class="w-full border p-4 r24 mb-6 outline-none text-sm focus:border-orange-400">'+(data?esc(data.issue):'')+'</textarea><input type="hidden" id="cs-edit-id" value="'+(data?data.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'cs-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200">취소</button><button onclick="submitCSTicket()" class="px-8 py-3.5 bg-orange-500 text-white r35 text-sm font-bold shadow-lg hover:bg-orange-600">'+(data?'수정':'접수')+'</button></div></div>');
  openModal('cs-modal');
  populateAssignees('cs-assignees', data?data.assignees:'');
}

/* === CS 수정 코드 === */
function submitCSTicket(){
  var id=document.getElementById('cs-edit-id').value;
  var c=document.getElementById('cs-customer').value,i=document.getElementById('cs-issue').value,p=document.getElementById('cs-priority').value,a=getChecked('cs-assignees');
  if(!c||!i)return showToast("필수 입력");
  if(id){
    var idx=CACHE.cs.findIndex(function(x){return x.id===id;});
    if(idx>-1){ Object.assign(CACHE.cs[idx], {customer:c,issue:i,priority:p,assignees:a}); FB.patch('cs/'+id, {customer:c,issue:i,priority:p,assignees:a}); }
    closeModal('cs-modal'); filterCS(); showToast("수정 완료!");
  } else {
    var newId=genId();
    var tId=getNextTicketId(CACHE.cs, 'CS'); // 티켓 번호 발급!
    var obj={id:newId, ticketId:tId, customer:c,issue:i,priority:p,status:'대기',assignees:a,creator:USER.email,timestamp:Date.now()};
    CACHE.cs.push(obj); closeModal('cs-modal'); filterCS(); showToast("접수 완료 ("+tId+")"); FB.set('cs/'+newId,obj);
  }
}

// (신규) CS 디테일 및 코멘트 기능 추가
function openCSDetail(id){
  var d=CACHE.cs.find(function(x){return String(x.id)===String(id);});if(!d)return;
  var cList=Object.keys(CACHE.comments||{}).map(function(k){return CACHE.comments[k];}).filter(function(c){return c.targetId===id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var tBadge = d.ticketId ? '<span class="text-orange-500 mr-2 bg-orange-50 px-2 py-1 r20 text-sm font-black">['+d.ticketId+']</span>' : '';
  
  var leftHtml = '<div class="flex-1 p-8 md:p-10 overflow-y-auto"><h2 class="text-2xl md:text-3xl font-black text-gray-900 mb-4 pr-10">'+tBadge+esc(d.customer)+'</h2><div class="flex gap-2 mb-6"><span class="text-xs px-3 py-1 r20 font-black '+(d.priority==='긴급'?'bg-red-100 text-red-600':'bg-orange-100 text-orange-600')+'">'+d.priority+'</span><span class="text-xs px-3 py-1 r20 font-black bg-gray-100 text-gray-600">'+d.status+'</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-5 r24 text-sm"><div class="md:col-span-2"><span class="text-gray-400 text-xs font-bold mb-1 block">할당된 담당자</span><div class="flex gap-1 mt-1">'+avatarHtml(d.assignees,8)+'</div></div></div><div class="bg-gray-50 p-5 r24 mb-6"><p class="text-xs font-black text-gray-400 mb-2">접수 내용 (이슈 상세)</p><p class="text-sm text-gray-700 whitespace-pre-wrap">'+esc(d.issue||'내용 없음')+'</p></div><div class="flex justify-end gap-3"><button onclick="closeModal(\'cs-detail-modal\');openCSModal(CACHE.cs.find(function(x){return x.id===\''+d.id+'\';}))" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold hover:bg-gray-200 transition">수정</button>'+(d.status!=='완료'?'<button onclick="markCSDone(\''+d.id+'\')" class="px-6 py-3 bg-orange-500 text-white r35 text-sm font-bold hover:bg-orange-600 transition shadow-lg">완료 처리</button>':'')+'<button onclick="confirmDeleteCS(\''+d.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold hover:bg-red-100 transition">삭제</button></div></div>';
  var rightHtml = '<div class="w-full md:w-[360px] bg-gray-50 border-l p-8 flex flex-col h-[600px] md:h-auto"><h3 class="font-black text-lg mb-4 text-gray-800"><i class="ri-chat-3-fill text-orange-500 mr-2"></i>처리 히스토리</h3><div id="cs-cmt-list" class="flex-1 overflow-y-auto space-y-3 hide-scrollbar mb-4">'+(cList.length?cList.map(function(c){var ctext = esc(c.content).replace(/@([^\s]+)/g, '<span class="text-orange-600 font-bold bg-orange-100 px-1 r20">@$1</span>');return'<div class="bg-white p-4 r20 shadow-sm border border-gray-100"><div class="flex justify-between items-center mb-1"><span class="font-black text-xs text-gray-800">'+c.authorName+'</span><span class="text-[10px] text-gray-400">'+c.date+'</span></div><p class="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">'+ctext+'</p></div>';}).join(''):'<p class="text-xs text-gray-400 text-center py-10">기록이 없습니다.<br>진행 상황을 남겨주세요.</p>')+'</div><div class="relative"><textarea id="cs-cmt-in" rows="3" placeholder="진행 상황, 고객 응대 내용 기록..." class="w-full border p-4 pr-12 r20 text-sm outline-none resize-none focus:border-orange-400 shadow-sm bg-white"></textarea><button onclick="submitCSComment(\''+d.id+'\')" class="absolute bottom-4 right-4 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-orange-600 transition"><i class="ri-send-plane-fill text-sm"></i></button></div></div>';
  renderModalRoot('cs-detail-modal','<div class="bg-white r35 modal-content max-w-5xl p-0 shadow-2xl relative fade-in flex flex-col md:flex-row overflow-hidden"><button onclick="closeModal(\'cs-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black z-10"><i class="ri-close-line text-3xl"></i></button>'+leftHtml+rightHtml+'</div>');
  openModal('cs-detail-modal'); var cl=document.getElementById('cs-cmt-list');if(cl)cl.scrollTop=cl.scrollHeight;
}

function submitCSComment(id){
  var inp=document.getElementById('cs-cmt-in');if(!inp||!inp.value.trim())return;
  var msg=inp.value; inp.value=''; var cId=genId();
  var c={targetId:id,email:USER.email,authorName:USER.name,content:msg,date:nowFmt()};
  CACHE.comments[cId]=c; FB.set('comments/'+cId,c);
  openCSDetail(id); // 화면 새로고침
}

function markCSDone(id){
  var d=CACHE.cs.find(function(x){return String(x.id)===String(id);});if(!d)return;
  openCustomConfirm("CS 완료 처리", "고객 지원 건을 완료로 이동하시겠습니까?", function(){
    d.status='완료';
    FB.patch('cs/'+id,{status:'완료'});
    closeModal('cs-detail-modal');
    filterCS();
    showToast("✅ CS 처리 완료!");
  });
}

// 4. CS 티켓 삭제 변경
function confirmDeleteCS(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("CS 삭제","정말 삭제하시겠습니까?",function(){
    CACHE.cs=CACHE.cs.filter(function(x){return x.id!==id;});
    closeModal('cs-detail-modal');filterCS();
    FB.patch('cs/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    showToast("삭제 완료 (숨김 처리됨)");
  });
}
// ═══════════════════════════════════════════════
//  결재 (1차 결재권자 = 해당 팀장 자동 지정)
// ═══════════════════════════════════════════════
function initMonthFilters(){var now=new Date(),y=now.getFullYear(),m=now.getMonth();var os='<option value="all">전체</option>';for(var i=0;i<18;i++){var ty=y,tm=m-i;while(tm<0){tm+=12;ty--;}var v=ty+'-'+pad(tm+1);os+='<option value="'+v+'">'+ty+'년 '+(tm+1)+'월</option>';}['appr-month-filter','leave-month-filter','admin-export-month'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML=os;el.value=y+'-'+pad(m+1);}});}
function matchMonth(d,f){if(f==='all')return true;if(!d)return false;var s=String(d);if(!isNaN(s)&&s.length>10){var dt=new Date(Number(s));s=dt.getFullYear()+'-'+pad(dt.getMonth()+1);}return s.indexOf(f)===0;}

function renderApproval() {
  var el = document.getElementById('tab-approval');
  // 초기 뼈대 생성 (필터 UI 포함)
  if (!el.querySelector('#appr-filter-area')) {
    el.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3">
        <h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-bank-card-fill mr-2"></i> 지출 및 결재</h1>
        <button onclick="openApprovalModal()" class="bg-gray-900 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-black transition">+ 지출결의서 작성</button>
      </div>
      
      <div id="appr-filter-area" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 bg-white p-5 r35 card-shadow border border-gray-100">
        <div><label class="block text-[10px] font-black text-gray-400 mb-1 ml-1">대상 월</label><select id="appr-month-filter" class="w-full border p-2.5 r20 text-xs font-bold outline-none bg-gray-50" onchange="renderApproval()"></select></div>
        <div><label class="block text-[10px] font-black text-gray-400 mb-1 ml-1">계정과목</label><select id="appr-cat-filter" class="w-full border p-2.5 r20 text-xs font-bold outline-none bg-gray-50" onchange="renderApproval()"><option value="all">전체 과목</option><option>복리후생비(식대/간식)</option><option>여비교통비(출장/유류)</option><option>소모품비(비품/사무용품)</option><option>지급수수료(구독/이체)</option><option>접대비(외부미팅/선물)</option><option>기타</option></select></div>
        <div><label class="block text-[10px] font-black text-gray-400 mb-1 ml-1">상태</label><select id="appr-status-filter" class="w-full border p-2.5 r20 text-xs font-bold outline-none bg-gray-50" onchange="renderApproval()"><option value="all">전체 상태</option><option>대기</option><option>최종 승인</option><option>반려</option></select></div>
        <div><label class="block text-[10px] font-black text-gray-400 mb-1 ml-1">기안자 검색</label><input type="text" id="appr-user-search" class="w-full border p-2.5 r20 text-xs outline-none bg-gray-50" placeholder="이름 입력..." oninput="renderApproval()"></div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div><h2 class="text-xl font-bold mb-6 text-gray-700">지출 내역 리스트</h2><div id="appr-list-main" class="space-y-4"></div></div>
        <div><h2 class="text-xl font-bold mb-6 text-blue-600">회계 요약 (필터 결과)</h2><div id="appr-summary-card" class="bg-blue-600 text-white p-8 r35 card-shadow flex flex-col justify-center min-h-[200px]"></div></div>
      </div>`;
    initMonthFilters();
  }

  var fMonth = document.getElementById('appr-month-filter').value;
  var fCat = document.getElementById('appr-cat-filter').value;
  var fStatus = document.getElementById('appr-status-filter').value;
  var fUser = document.getElementById('appr-user-search').value.toLowerCase();

  var filtered = CACHE.approval.filter(function(d) {
    return matchMonth(d.dateCreated, fMonth) &&
           (fCat === 'all' || d.reason === fCat) &&
           (fStatus === 'all' || d.status === fStatus) &&
           (d.drafterName.toLowerCase().includes(fUser));
  });

  var totalAmount = filtered.reduce((acc, cur) => acc + Number(cur.amount || 0), 0);

  // 리스트 렌더링
  var listEl = document.getElementById('appr-list-main');
  listEl.innerHTML = filtered.length === 0 ? '<p class="text-sm text-gray-400 py-10 text-center font-bold">내역 없음</p>' : filtered.map(d => {
    var uBadge = d.isUrgent ? '<span class="text-[9px] bg-red-500 text-white px-1.5 py-0.5 r10 font-black ml-1">긴급</span>' : '';
    return `
      <div class="p-5 border r24 bg-white card-shadow card-hover cursor-pointer border-transparent hover:border-blue-300 relative group" onclick="openApprovalDetail('${d.id}')">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-black text-sm text-gray-800 truncate">${esc(d.reason)}${uBadge}</h3>
          ${statusBadge(d.status)}
        </div>
        <div class="text-lg font-black text-emerald-600 mb-1">₩${Number(d.amount).toLocaleString()}</div>
        <p class="text-[10px] text-gray-400 font-bold">기안: ${d.drafterName} · ${fmtDT(d.dateCreated)}</p>
        <button onclick="event.stopPropagation(); copyApprovalData('${d.id}')" class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 bg-blue-50 text-blue-600 text-[10px] px-3 py-1.5 r20 font-bold border border-blue-100 transition">복사해서 새로 작성</button>
      </div>`;
  }).join('');

  // 요약 카드 렌더링
  document.getElementById('appr-summary-card').innerHTML = `
    <p class="text-blue-100 text-sm font-bold mb-2 uppercase tracking-widest">Selected Total</p>
    <h3 class="text-4xl md:text-5xl font-black mb-4">₩${totalAmount.toLocaleString()}</h3>
    <p class="text-blue-200 text-xs font-bold leading-relaxed">선택된 조건에 따른 총 지출액입니다.<br>검색 결과 총 ${filtered.length}건이 집계되었습니다.</p>
  `;
}

// 🌟 복사 기능 함수 (새로 추가)
function copyApprovalData(id) {
  var d = CACHE.approval.find(x => x.id === id);
  if(!d) return;
  openApprovalModal(); // 모달 먼저 열고
  setTimeout(() => {
    // 값을 슥슥 채워넣기 (ID와 날짜는 제외)
    var row = document.querySelector('.appr-item-row');
    if(row) {
      row.querySelector('.appr-reason-select').value = d.reason.includes('(') ? d.reason : '기타';
      if(row.querySelector('.appr-reason-select').value === '기타') {
        row.querySelector('.appr-reason-custom').classList.remove('hidden');
        row.querySelector('.appr-reason-custom').value = d.reason;
      }
      row.querySelector('.appr-detail').value = d.detail || '';
      row.querySelector('.appr-bank').value = d.bank || '';
      row.querySelector('.appr-account').value = d.account || '';
      row.querySelector('.appr-amount').value = d.amount || '';
    }
    showToast("기존 내역을 복사해왔습니다. 내용을 확인 후 제출하세요!");
  }, 300);
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
// 3-1. 지출결의서 입력폼 (회계 전문용어 적용)
function addApprItemRow(){
  var bankOpts='<option value="">은행선택</option><option>국민은행</option><option>신한은행</option><option>우리은행</option><option>하나은행</option><option>농협은행</option><option>기업은행</option><option>카카오뱅크</option><option>토스뱅크</option><option>기타</option>';
  var html='<div class="appr-item-row bg-gray-50 border border-gray-100 p-5 r35 relative mb-3">'+
    '<button onclick="this.parentElement.remove()" class="absolute top-4 right-4 text-gray-300 hover:text-red-500"><i class="ri-close-circle-fill text-xl"></i></button>'+
    
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">'+
      '<div><label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 pl-1">지출일자</label><input type="date" class="appr-spend-date w-full border p-3 r24 text-sm outline-none bg-white"></div>'+
      '<div><label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 pl-1">계정과목 (분류)</label><select class="appr-reason-select w-full border p-3 r24 text-sm font-bold outline-none bg-white" onchange="var row=this.closest(\'.appr-item-row\');row.querySelector(\'.appr-reason-custom\').classList.toggle(\'hidden\',this.value!==\'기타\');">'+
      '<option value="">선택 *</option><option value="복리후생비(식대/간식)">복리후생비 (식대/간식)</option><option value="여비교통비(출장/유류)">여비교통비 (출장/유류)</option><option value="소모품비(비품/사무용품)">소모품비 (비품/사무용품)</option><option value="지급수수료(구독/이체)">지급수수료 (구독/소프트웨어)</option><option value="접대비(외부미팅/선물)">접대비 (외부미팅/선물)</option><option value="기타">기타</option></select><input type="text" class="appr-reason-custom hidden w-full border p-3 r24 mt-2 text-sm outline-none bg-white" placeholder="기타 계정 직접 입력"></div>'+
      '<div><label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 pl-1">결제수단 / 증빙</label><select class="appr-pay-method w-full border p-3 r24 text-sm font-bold outline-none bg-white">'+
      '<option value="법인카드 (영수증)">법인카드 (영수증)</option><option value="개인카드 (환급)">개인카드 (환급)</option><option value="현금 (지출결의)">현금 (지출결의)</option><option value="세금계산서 (청구)">세금계산서 (청구)</option></select></div>'+
    '</div>'+

    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 pl-1">적요 (상세내역) 및 영수증 첨부</label>'+
    '<div class="flex flex-col md:flex-row gap-2 mb-3">'+
      '<input type="text" class="appr-detail flex-1 border p-3 r24 text-sm outline-none bg-white" placeholder="어디서, 누구와, 무엇을 위해 지출했는지 상세히 기재">'+
      '<div class="flex items-center bg-white border border-blue-200 p-2 r24 overflow-hidden shrink-0 md:w-64 cursor-pointer hover:bg-blue-50 transition"><i class="ri-attachment-line text-blue-500 ml-2 mr-2"></i><input type="file" class="appr-file text-xs w-full outline-none cursor-pointer" accept="image/*,application/pdf"></div>'+
    '</div>'+
    
    '<label class="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 pl-1">입금 정보 (환급/청구시 작성)</label>'+
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">'+
      '<select class="appr-bank border p-3 r24 text-sm font-bold outline-none bg-white">'+bankOpts+'</select>'+
      '<input type="text" class="appr-account border p-3 r24 text-sm font-bold bg-white" placeholder="계좌번호 (숫자만)">'+
      '<input type="number" class="appr-amount border p-3 r24 text-base font-black text-green-600 bg-white" placeholder="청구 금액(원)">'+
    '</div></div>';
  var c2=document.getElementById('appr-items-container');if(c2)c2.insertAdjacentHTML('beforeend',html);
}

// 3-2. 데이터 묶어서 제출
async function submitApprovalBulk(){
  var a1=document.getElementById('appr-approver1')?document.getElementById('appr-approver1').value:'';
  var a2=document.getElementById('appr-approver2')?document.getElementById('appr-approver2').value:'';
  var date=document.getElementById('appr-date')?document.getElementById('appr-date').value:'';
  if(!a1||!date){showToast("1차 결재권자와 입금일 필수");return;}
  var rows=document.querySelectorAll('.appr-item-row');if(!rows.length){showToast("최소 1항목 필요");return;}
  var valid=true;
  rows.forEach(function(row){
      var rs=row.querySelector('.appr-reason-select').value,rc=row.querySelector('.appr-reason-custom').value;
      var reason=rs==='기타'?rc:rs;
      var amount=row.querySelector('.appr-amount').value;
      if(!reason||!amount){showToast("계정과목과 금액은 필수입니다");valid=false;}
  });
  if(!valid) return;

  var isUrgent=document.getElementById('appr-is-urgent').checked;
  var btn = document.getElementById('btn-submit-appr');
  if(btn) { btn.disabled = true; btn.innerText = "⏳ 파일 업로드 및 처리 중..."; }

  for(var i=0; i<rows.length; i++) {
    var row = rows[i];
    var rs=row.querySelector('.appr-reason-select').value,rc=row.querySelector('.appr-reason-custom').value;
    var reason=rs==='기타'?rc:rs;
    var fileInput=row.querySelector('.appr-file');
    var fileUrl = '';

    if(fileInput && fileInput.files && fileInput.files[0]) {
      try {
        var file = fileInput.files[0];
        var storageRef = firebase.storage().ref('receipts/' + Date.now() + '_' + file.name);
        await storageRef.put(file);
        fileUrl = await storageRef.getDownloadURL();
      } catch(e) { 
        console.error("스토리지 에러:", e); 
        alert("파일 업로드 실패!");
        if(btn) { btn.disabled = false; btn.innerText = "결재 올리기"; }
        return; 
      }
    }

    var id=genId();
    var obj={
      id:id, 
      reason:reason, // 계정과목
      spendDate:row.querySelector('.appr-spend-date').value || '', // 지출일자
      detail:row.querySelector('.appr-detail').value, // 적요
      payMethod:row.querySelector('.appr-pay-method').value, // 결제수단
      bank:row.querySelector('.appr-bank').value, account:row.querySelector('.appr-account').value,
      amount:row.querySelector('.appr-amount').value, approver1:a1, approver2:a2||'',
      date:date, isUrgent:isUrgent,
      drafter:USER.email, drafterName:USER.name, status:'대기', 
      dateCreated:Date.now(), // 🌟 밀리초 타임스탬프 (나중에 기안일시로 변환)
      fileUrl: fileUrl
    };
    CACHE.approval.push(obj);
    FB.set('approvals/'+id, obj);
  }
  
  if(btn) { btn.disabled = false; btn.innerText = "결재 올리기"; }
  closeModal('approval-modal'); showToast("제출 완료!"); updateBadges(); renderApproval();
}

// [최종 완성본] 결재 상세창 (기안일시 및 회계/세무 뷰 반영)
function openApprovalDetail(id){
  var d=CACHE.approval.find(function(x){return x.id===id;});
  if(!d)return;

  var isMyTurn = false;
  if (d.status === '대기' && (d.approver1 || '').toLowerCase() === USER.email.toLowerCase()) isMyTurn = true;
  if (d.status === '1차 승인' && (d.approver2 || '').toLowerCase() === USER.email.toLowerCase()) isMyTurn = true;

  var urgentBadge = d.isUrgent ? '<span class="text-[10px] bg-red-500 text-white px-2 py-0.5 r20 font-black ml-2 align-middle">긴급</span>' : '';
  
  // 🌟 기안일시 포맷팅 (YYYY-MM-DD HH:MM)
  var createTimeStr = fmtDT(d.dateCreated);

  var html='<div class="bg-white r35 modal-content max-w-lg p-8 shadow-2xl fade-in">' +
    '<div class="flex justify-between items-start mb-6">' +
      '<div>' + statusBadge(d.status) + urgentBadge + '<h2 class="text-2xl font-black mt-2">' + esc(d.reason) + '</h2></div>' +
      '<button onclick="closeModal(\'appr-detail-modal\')" class="text-gray-400 hover:text-gray-600 text-2xl"><i class="ri-close-line"></i></button>' +
    '</div>' +
    '<div class="space-y-4 mb-8">' +
      // 🌟 회계사들이 확인하기 좋게 용어 및 배치 변경 완료!
      '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">기안자 (기안일시)</span><span class="font-black text-right">' + d.drafterName + '<br><span class="text-[10px] text-gray-400 font-normal">'+createTimeStr+'</span></span></div>' +
      (d.spendDate ? '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">지출 일자</span><span class="text-sm font-bold">' + d.spendDate + '</span></div>' : '') +
      '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">청구 금액</span><span class="font-black text-blue-600 text-lg">₩' + Number(d.amount).toLocaleString() + '</span></div>' +
      (d.payMethod ? '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">결제 수단</span><span class="text-sm font-bold">'+esc(d.payMethod)+'</span></div>' : '') +
      ((d.bank && d.account) ? '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">입금 계좌</span><span class="text-sm">' + d.bank + ' ' + d.account + '</span></div>' : '') +
      (d.fileUrl ? '<div class="flex justify-between border-b pb-2"><span class="text-gray-500 font-bold">증빙 자료</span><a href="'+d.fileUrl+'" target="_blank" class="text-blue-600 font-bold text-sm hover:underline"><i class="ri-attachment-line"></i> 영수증 보기</a></div>' : '') +
      '<div class="py-2"><span class="text-gray-500 font-bold block mb-1">적요 (상세내용)</span><p class="text-sm bg-gray-50 p-4 r24 leading-relaxed">' + esc(d.detail || d.note || '내용 없음') + '</p></div>' +
    '</div>';

  if(isMyTurn){
    html += '<div class="grid grid-cols-2 gap-3">' +
      '<button onclick="processAppr(\''+d.id+'\',\'반려\')" class="py-4 bg-red-50 text-red-600 r24 font-black hover:bg-red-100 transition">반려하기</button>' +
      '<button onclick="processAppr(\''+d.id+'\',\'승인\')" class="py-4 bg-blue-600 text-white r24 font-black shadow-lg hover:bg-blue-700 transition">승인하기</button>' +
    '</div>';
  }
  html += '</div>';
  renderModalRoot('appr-detail-modal', html);
  openModal('appr-detail-modal');
}

// [세련된 반려 사유 모달창]
function openRejectModal(id, type){
  renderModalRoot('reject-modal',
    '<div class="bg-white r35 modal-content max-w-sm p-8 shadow-2xl fade-in text-center">'+
    '<div class="text-red-500 text-5xl mb-4"><i class="ri-close-circle-fill"></i></div>'+
    '<h2 class="text-xl font-black mb-3">반려 사유</h2>'+
    '<textarea id="reject-reason-input" rows="3" placeholder="반려 사유를 입력해주세요..." class="w-full border p-4 r20 mb-6 outline-none text-sm resize-none"></textarea>'+
    '<div class="flex justify-center gap-3">'+
    '<button onclick="closeModal(\'reject-modal\')" class="px-6 py-3 bg-gray-100 r35 text-sm font-bold">취소</button>'+
    '<button onclick="submitReject(\''+id+'\',\''+type+'\')" class="px-6 py-3 bg-red-600 text-white r35 text-sm font-bold shadow-lg">반려 확정</button>'+
    '</div></div>');
  openModal('reject-modal');
}

// [반려 처리 함수]
function submitReject(id, type){
  var reason = document.getElementById('reject-reason-input').value.trim();
  if(!reason) return showToast("반려 사유를 입력해주세요.");
  
  var path = type === 'approval' ? 'approvals/' : 'leaves/';
  var cache = type === 'approval' ? CACHE.approval : CACHE.leaves;
  var d = cache.find(function(x){return x.id===id;});
  
  if(d) d.status = '반려';
  FB.patch(path + id, {status: '반려', rejectReason: reason});
  
  closeModal('reject-modal');
  closeModal('appr-detail-modal');
  closeModal('leave-detail-modal');
  showToast("반려 처리되었습니다.");
  updateBadges();
  if(type === 'approval') renderApproval(); else renderLeaves();
}

function processAppr(id, action){
  var d = CACHE.approval.find(function(x){return x.id===id;});
  if(!d) return;

  if(action === '반려'){
    openRejectModal(id, 'approval'); // 세련된 모달로 연결
    return;
  }

  var nextStatus = '';
  if(d.status === '대기' && (d.approver1||'').toLowerCase() === USER.email.toLowerCase()){
    nextStatus = d.approver2 ? '1차 승인' : '최종 승인';
  } else if(d.status === '1차 승인' && (d.approver2||'').toLowerCase() === USER.email.toLowerCase()){
    nextStatus = '최종 승인';
  }
  if(!nextStatus) return showToast("승인 권한이 없습니다.");

  openCustomConfirm("결재 승인", nextStatus + " 처리하시겠습니까?", function(){
    d.status = nextStatus;
    var updateObj = { status: nextStatus };
    if(nextStatus === '1차 승인') updateObj.approved1At = nowFmt();
    if(nextStatus === '최종 승인') updateObj.approved2At = nowFmt();
    FB.patch('approvals/'+id, updateObj);
    closeModal('appr-detail-modal');
    showToast(nextStatus + " 완료!");
    updateBadges();
    renderApproval();
  });
}

// ═══════════════════════════════════════════════
//  Vault
// ═══════════════════════════════════════════════
function renderVault(){var el=document.getElementById('tab-vault');if(!el.querySelector('#vault-search-input')){el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><div><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-shield-keyhole-fill text-amber-500 mr-2"></i> 팀 보안 금고</h1></div><div class="flex items-center gap-3 flex-wrap"><input type="text" id="vault-search-input" oninput="filterVaultUI()" placeholder="검색..." class="px-4 py-3 border border-amber-200 r35 text-sm outline-none w-56 bg-amber-50/30"><button onclick="openVaultModal()" class="bg-amber-500 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 신규 등록</button></div></div><div id="vault-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>';}filterVaultUI();}
function filterVaultUI(){var k=(document.getElementById('vault-search-input')||{value:''}).value.toLowerCase().trim();renderVaultGrid(k?CACHE.vault.filter(function(v){return String(v.category||'').toLowerCase().indexOf(k)>-1||String(v.loginId||'').toLowerCase().indexOf(k)>-1;}):CACHE.vault);}
function renderVaultGrid(data){var el=document.getElementById('vault-grid');if(!el)return;el.innerHTML=!data.length?'<p class="col-span-3 text-sm text-gray-400 text-center py-10">등록된 계정이 없습니다.</p>':data.map(function(d){return'<div class="p-6 md:p-8 border border-amber-200 r35 bg-white card-shadow relative"><button onclick="event.stopPropagation();openVaultModal(\''+d.id+'\')" class="absolute top-5 right-14 text-gray-400 hover:text-amber-600"><i class="ri-edit-line text-xl"></i></button><button onclick="event.stopPropagation();confirmDeleteVault(\''+d.id+'\')" class="absolute top-5 right-5 text-red-300 hover:text-red-500"><i class="ri-delete-bin-line text-xl"></i></button><h3 class="font-black text-xl text-gray-800 mb-4 truncate pr-16"><i class="ri-key-2-fill text-amber-500 mr-2"></i>'+esc(d.category)+'</h3><div class="bg-amber-50/50 rounded-2xl p-4 text-sm mb-3 border border-amber-100"><div class="flex justify-between items-center mb-3"><span class="text-amber-700 text-xs font-bold">ID</span><span class="font-bold cursor-pointer bg-white px-3 py-1 r20 shadow-sm text-sm" onclick="navigator.clipboard.writeText(\''+esc(d.loginId)+'\').then(function(){showToast(\'복사!\');})">'+esc(d.loginId)+' <i class="ri-file-copy-line text-xs"></i></span></div><div class="flex justify-between items-center"><span class="text-amber-700 text-xs font-bold">PW</span><span class="font-bold cursor-pointer bg-white px-3 py-1 r20 shadow-sm text-sm" onclick="copyVaultPw(\''+d.id+'\')">•••••••• <i class="ri-file-copy-line text-xs"></i></span></div></div><p class="text-[10px] text-gray-400 font-bold">권한: '+d.visibility+'</p></div>';}).join('');}
function copyVaultPw(id){db.ref('vault/'+id).once('value',function(snap){var v=snap.val();if(!v){showToast("계정 없음");return;}var ok=USER.role==='ADMIN'||v.creator===USER.email||v.visibility==='ALL'||(v.visibility||'').indexOf(USER.dept)>-1||(v.visibility||'').indexOf(USER.email)>-1;if(ok){navigator.clipboard.writeText(v.password).then(function(){showToast("PW 복사 완료!");});}else showToast("권한 없음");});}
function openVaultModal(id){
  var v=id?CACHE.vault.find(function(x){return String(x.id)===String(id);}):null;
  var teamVal = USER.dept || 'TEAM';
  var isTeam = v && v.visibility === teamVal;
  var isAll = v && v.visibility === 'ALL';
  var isPrivate = !v || v.visibility === 'PRIVATE';
  
  renderModalRoot('vault-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-amber-600"><i class="ri-shield-keyhole-fill"></i> '+(v?'수정':'보안 계정 등록')+'</h2><input id="vault-category" type="text" value="'+(v?esc(v.category):'')+'" placeholder="서비스명 *" class="w-full border p-4 r24 mb-4 outline-none font-bold text-lg bg-gray-50"><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><input id="vault-loginid" type="text" value="'+(v?esc(v.loginId):'')+'" placeholder="ID" class="w-full border p-4 r24 outline-none text-sm"></div><div><input id="vault-password" type="password" placeholder="'+(v?'변경시만 입력':'PW')+'" class="w-full border p-4 r24 outline-none text-sm"></div></div><textarea id="vault-note" rows="2" placeholder="비고" class="w-full border p-4 r24 mb-4 outline-none text-sm">'+(v?esc(v.note||''):'')+'</textarea><select id="vault-visibility-select" class="w-full border p-4 r24 mb-6 outline-none text-sm font-bold bg-amber-50"><option value="PRIVATE" '+(isPrivate?'selected':'')+'>나만 보기</option><option value="TEAM" '+(isTeam?'selected':'')+'>우리 팀('+esc(USER.dept)+')만 보기</option><option value="ALL" '+(isAll?'selected':'')+'>전체 공개</option></select><input type="hidden" id="vault-edit-id" value="'+(v?v.id:'')+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'vault-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitVault()" class="px-8 py-3.5 bg-amber-500 text-white r35 text-sm font-bold shadow-lg">저장</button></div></div>');
  openModal('vault-modal');
}

function submitVault(){
  var id=document.getElementById('vault-edit-id').value;
  var cat=document.getElementById('vault-category').value.trim(),lid=document.getElementById('vault-loginid').value,pw=document.getElementById('vault-password').value,note=document.getElementById('vault-note').value;
  
  // 권한 설정: 'TEAM'을 선택하면 로그인한 유저의 소속 부서 이름으로 치환하여 저장
  var visRaw=document.getElementById('vault-visibility-select').value;
  var vis = (visRaw === 'TEAM') ? USER.dept : visRaw; 

  if(!cat||!lid||(id===''&&!pw))return showToast("필수 항목 입력");
  if(id){
    var updates={category:cat,loginId:lid,note:note,visibility:vis};
    if(pw)updates.password=pw;
    var idx=CACHE.vault.findIndex(function(x){return String(x.id)===String(id);});
    if(idx>-1)Object.assign(CACHE.vault[idx],updates);
    closeModal('vault-modal');showToast("수정 완료");renderVault();FB.patch('vault/'+id,updates);
  }else{
    if(!pw)return showToast("비밀번호 입력");
    var newId=genId();var obj={id:newId,category:cat,loginId:lid,password:pw,note:note,visibility:vis,creator:USER.email};
    CACHE.vault.push(Object.assign({},obj,{password:'••••••••'}));
    closeModal('vault-modal');showToast("등록 완료");renderVault();FB.set('vault/'+newId,obj);
  }
}
// 5. 보안 금고 삭제 변경
function confirmDeleteVault(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("계정 삭제","삭제할까요?",function(){
    CACHE.vault=CACHE.vault.filter(function(x){return x.id!==id;});
    FB.patch('vault/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    showToast("삭제됨");renderVault();
  });
}


/*═══════════ 위키 (Quill 에디터 적용) ═══════════*/
// 🌟 공통 에디터 툴바 옵션 (코드 하이라이팅 기능 추가!)
var editorOptions = {
  theme: 'snow',
  modules: {
    syntax: true, // 👈 코드를 예쁘게 칠해주는 핵심 스위치
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'], // code-block 버튼 활성화됨
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link']
    ]
  },
  placeholder: '내용을 자세히 작성해주세요...'
};
var quillEditor = null;
var devQuillEditor = null;


function renderWiki(){var el=document.getElementById('tab-wiki');if(!el.querySelector('#wiki-search-input')){el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-book-read-fill text-gray-800 mr-2"></i> 사내 위키</h1><div class="flex items-center gap-3 flex-wrap"><input type="text" id="wiki-search-input" oninput="filterWikiUI()" placeholder="검색..." class="px-4 py-3 border r35 text-sm outline-none w-56 bg-white card-shadow"><button onclick="openWikiModal()" class="bg-gray-800 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 새 문서</button></div></div><div id="wiki-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>';}filterWikiUI();}

function filterWikiUI(){var k=(document.getElementById('wiki-search-input')||{value:''}).value.toLowerCase();var data=CACHE.wiki.filter(function(w){return(w.title||'').toLowerCase().indexOf(k)>-1||(w.content||'').toLowerCase().indexOf(k)>-1;});var el=document.getElementById('wiki-grid');if(!el)return;el.innerHTML=!data.length?'<p class="col-span-2 text-sm text-gray-400 text-center py-10">문서가 없습니다.</p>':data.map(function(d){var isPdf=!!d.pdfData; var previewText = isPdf ? '📄 PDF 문서' : esc(d.content.replace(/<[^>]*>?/gm, '')); return'<div onclick="openWikiDetail(\''+d.id+'\')" class="p-6 md:p-8 border r35 bg-white card-shadow hover:shadow-xl card-hover cursor-pointer transition"><div class="flex items-center gap-3 mb-3">'+(isPdf?'<i class="ri-file-pdf-2-fill text-red-500 text-2xl shrink-0"></i>':'<i class="ri-file-text-line text-gray-400 text-2xl shrink-0"></i>')+'<h3 class="font-black text-xl md:text-2xl text-gray-800 truncate">'+esc(d.title)+'</h3></div><p class="text-sm text-gray-500 line-clamp-3 leading-relaxed">'+previewText+'</p><p class="text-[10px] text-gray-400 mt-3 font-bold">'+getMemberName(d.author)+'</p></div>';}).join('');}

function openWikiModal(){
  renderModalRoot('wiki-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-gray-800">새 문서 작성</h2><input id="wiki-title" type="text" placeholder="문서 제목" class="w-full text-2xl font-black border-b-2 mb-6 p-3 outline-none text-gray-800"><div class="flex gap-3 mb-4"><button onclick="showWikiTextForm()" id="wiki-tab-text" class="px-4 py-2 r24 text-sm font-bold bg-gray-100 text-gray-800">에디터 작성</button><button onclick="showWikiPdfForm()" id="wiki-tab-pdf" class="px-4 py-2 r24 text-sm font-bold text-gray-400">PDF 파일 업로드</button></div><div id="wiki-text-form" class="mb-6"><div id="wiki-quill-container" style="height: 350px;" class="bg-gray-50 r24"></div></div><div id="wiki-pdf-form" class="hidden"><label class="flex flex-col items-center justify-center w-full h-40 upload-zone r24 bg-white mb-6"><i class="ri-file-pdf-2-fill text-5xl text-red-400 mb-2"></i><span class="text-sm font-bold text-gray-400" id="wiki-pdf-name">클릭하여 PDF 업로드</span><input type="file" accept=".pdf" class="hidden" id="wiki-pdf-input" onchange="handleWikiPdf(this)"></label></div><div class="flex justify-end gap-3"><button onclick="closeModal(\'wiki-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitWiki()" class="px-8 py-3.5 bg-gray-900 text-white r35 text-sm font-bold shadow-lg">게시</button></div></div>');
  openModal('wiki-modal');
setTimeout(function(){
  quillEditor = new Quill('#wiki-quill-container', editorOptions); // 🌟 여기서 공통 옵션 사용!
}, 100);
}

function showWikiTextForm(){document.getElementById('wiki-text-form').classList.remove('hidden');document.getElementById('wiki-pdf-form').classList.add('hidden');document.getElementById('wiki-tab-text').className='px-4 py-2 r24 text-sm font-bold bg-gray-100 text-gray-800';document.getElementById('wiki-tab-pdf').className='px-4 py-2 r24 text-sm font-bold text-gray-400';}
function showWikiPdfForm(){document.getElementById('wiki-text-form').classList.add('hidden');document.getElementById('wiki-pdf-form').classList.remove('hidden');document.getElementById('wiki-tab-pdf').className='px-4 py-2 r24 text-sm font-bold bg-red-100 text-red-700';document.getElementById('wiki-tab-text').className='px-4 py-2 r24 text-sm font-bold text-gray-400';}

var wikiPdfBase64=null;
function handleWikiPdf(input){if(!input.files[0])return;var file=input.files[0];if(file.size>5*1024*1024){showToast("5MB 이하 파일만 가능합니다.");return;}document.getElementById('wiki-pdf-name').innerText=file.name;var reader=new FileReader();reader.onload=function(e){wikiPdfBase64=e.target.result;};reader.readAsDataURL(file);}

function submitWiki(){
  var t=document.getElementById('wiki-title').value;if(!t)return showToast("제목을 입력하세요.");
  var isPdfMode=!document.getElementById('wiki-pdf-form').classList.contains('hidden');
  var id=genId();
  if(isPdfMode&&wikiPdfBase64){
    var obj={id:id,title:t,author:USER.email,content:'[PDF 문서]',pdfData:wikiPdfBase64,visibility:'ALL',createdAt:Date.now()};
    CACHE.wiki.push(obj);closeModal('wiki-modal');wikiPdfBase64=null;showToast("PDF 문서 저장 완료");filterWikiUI();FB.set('wiki/'+id,obj);
  }else{
    if(quillEditor.getText().trim()==='') return showToast("내용을 입력하세요.");
    var c=quillEditor.root.innerHTML;
    var obj2={id:id,title:t,author:USER.email,content:c,isHtml:true,visibility:'ALL',createdAt:Date.now()};
    CACHE.wiki.push(obj2);closeModal('wiki-modal');showToast("저장 완료");filterWikiUI();FB.set('wiki/'+id,obj2);
  }
}

function openWikiDetail(id){
  var w = CACHE.wiki.find(function(x){return String(x.id)===String(id);});
  if(!w) return;

  // 🌟 [추가] 1. 읽음 로그 기록 (Realtime DB 방식)
  if (USER) {
    var readKey = w.id + '_' + USER.email.replace(/\./g, '_');
    db.ref('wiki_reads/' + readKey).set({
      wikiId: w.id,
      userName: USER.name,
      userEmail: USER.email,
      at: Date.now()
    });
  }

  var isPdf = !!w.pdfData;
  var canEdit = USER.role === 'ADMIN' || w.author === USER.email;
  var contentHtml = w.isHtml ? w.content : esc(w.content);

  // 🌟 [수정] 2. 상세 팝업 렌더링 (하단에 #wiki-reader-list 영역 추가)
  renderModalRoot('wiki-detail-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-12 shadow-2xl relative fade-in"><button onclick="closeModal(\'wiki-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-2xl md:text-3xl font-black mb-4 text-gray-900 pr-10">'+esc(w.title)+'</h2><p class="text-sm font-bold text-gray-400 mb-6 pb-4 border-b">작성자: '+getMemberName(w.author)+'</p>'+(isPdf?'<div class="text-center mb-6"><a href="'+w.pdfData+'" download="'+esc(w.title)+'.pdf" class="inline-flex items-center gap-3 bg-red-50 text-red-600 px-8 py-4 r35 font-bold text-base hover:bg-red-100 transition"><i class="ri-file-pdf-2-fill text-2xl"></i> PDF 다운로드</a></div>':'<div class="ql-editor p-0 text-base md:text-lg text-gray-800 leading-relaxed min-h-[150px] mb-6">'+contentHtml+'</div>') +
  
  // 🌟 읽은 사람 목록이 들어갈 도화지
  '<div id="wiki-reader-list" class="mt-10 pt-6 border-t border-gray-100"></div>' +

  (canEdit?'<div class="flex justify-end gap-3 border-t pt-6 mt-6">'+(isPdf?'':'<button onclick="openWikiEditModal(\''+w.id+'\')" class="px-6 py-3 bg-blue-50 text-blue-600 r35 text-sm font-bold">수정</button>')+'<button onclick="confirmDeleteWiki(\''+w.id+'\')" class="px-6 py-3 bg-red-50 text-red-600 r35 text-sm font-bold">삭제</button></div>':'')+'</div>');
  
  openModal('wiki-detail-modal');

  // 🌟 [추가] 3. 읽은 사람 목록 렌더링 실행
  renderWikiReaders(w.id);
}

// 읽은 사람 목록 가져와서 뿌려주기
function renderReadStatus(targetId) {
  db.collection('logs').where('targetId', '==', targetId).get().then(snapshot => {
    const readers = snapshot.docs.map(doc => doc.data());
    const readerListEl = document.getElementById('reader-list');
    if(!readerListEl) return;

    readerListEl.innerHTML = `
      <div class="mt-8 pt-6 border-t border-gray-100">
        <p class="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-wider">읽은 사람 (${readers.length})</p>
        <div class="flex flex-wrap gap-2">
          ${readers.map(r => `
            <div class="flex items-center bg-gray-50 px-2 py-1 r12 border border-gray-100">
              <span class="text-[10px] font-bold text-gray-600">${r.userName}</span>
              <span class="text-[8px] text-gray-400 ml-1">${timeSince(r.timestamp)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
}

// 6. 위키 삭제 변경
function confirmDeleteWiki(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("문서 삭제","삭제하시겠습니까?",function(){
    CACHE.wiki=CACHE.wiki.filter(function(x){return x.id!==id;});
    closeModal('wiki-detail-modal');showToast("삭제 완료");filterWikiUI();
    FB.patch('wiki/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
  });
}

function openWikiEditModal(id){
  var w=CACHE.wiki.find(function(x){return String(x.id)===String(id);});if(!w)return;
  closeModal('wiki-detail-modal');
  renderModalRoot('wiki-edit-modal','<div class="bg-white r35 modal-content max-w-4xl p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-gray-800">문서 수정</h2><input id="wiki-edit-title" type="text" value="'+esc(w.title)+'" class="w-full text-2xl font-black border-b-2 mb-6 p-3 outline-none text-gray-800"><div id="wiki-edit-quill-container" style="height: 350px;" class="mb-6 bg-gray-50 r24"></div><input type="hidden" id="wiki-edit-id" value="'+w.id+'"><div class="flex justify-end gap-3"><button onclick="closeModal(\'wiki-edit-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitWikiEdit()" class="px-8 py-3.5 bg-blue-600 text-white r35 text-sm font-bold shadow-lg">저장</button></div></div>');
  openModal('wiki-edit-modal');
setTimeout(function(){
    quillEditor = new Quill('#wiki-edit-quill-container', { theme: 'snow' });
    if(w.isHtml) quillEditor.root.innerHTML = w.content; else quillEditor.setText(w.content);
  }, 100);
}

function submitWikiEdit(){
  var id=document.getElementById('wiki-edit-id').value;
  var title=document.getElementById('wiki-edit-title').value.trim();
  var content=quillEditor.root.innerHTML;
  if(!title)return showToast("제목을 입력하세요.");
  var w=CACHE.wiki.find(function(x){return x.id===id;});
  if(w){w.title=title;w.content=content;w.isHtml=true;w.updatedAt=Date.now();}
  FB.patch('wiki/'+id,{title:title,content:content,isHtml:true,updatedAt:Date.now()});
  closeModal('wiki-edit-modal');showToast("수정 완료");filterWikiUI();
}

// ═══════════════════════════════════════════════
//  휴가
// ═══════════════════════════════════════════════
function renderLeaves(){
  var el=document.getElementById('tab-leaves');
  if(!el.querySelector('#leave-my-list')){
    el.innerHTML='<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3"><h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-flight-takeoff-fill text-purple-500 mr-2"></i> 휴가 및 근태</h1><div class="flex items-center gap-3 flex-wrap"><select id="leave-month-filter" class="border p-3 r35 text-sm font-bold outline-none bg-white card-shadow px-6" onchange="renderLeaves()"></select><button onclick="openLeaveModal()" class="bg-purple-600 text-white px-6 py-3 r35 text-sm font-bold shadow-lg">+ 휴가 신청</button></div></div>'+
    '<div class="mb-8 p-8 md:p-10 bg-white border border-purple-100 r35 card-shadow flex flex-col md:flex-row justify-around items-center text-center gap-4"><div><p class="text-sm font-bold text-gray-500 mb-2">총 연차</p><p class="text-3xl md:text-4xl font-black text-gray-800">'+CACHE.leaveInfo.total+' 일</p></div><div class="hidden md:block w-px h-16 bg-gray-200"></div><div><p class="text-sm font-bold text-gray-500 mb-2">사용</p><p class="text-3xl md:text-4xl font-black text-pink-500">'+CACHE.leaveInfo.used+' 일</p></div><div class="hidden md:block w-px h-16 bg-gray-200"></div><div><p class="text-sm font-bold text-gray-500 mb-2">남은 연차</p><p class="text-3xl md:text-4xl font-black text-purple-600">'+CACHE.leaveInfo.remain+' 일</p></div></div>'+
    '<div class="mb-8 bg-white p-6 r35 card-shadow"><h3 class="text-sm font-bold text-gray-800 mb-4"><i class="ri-calendar-2-fill text-purple-500 mr-1"></i> 이번 달 팀 휴가 현황</h3><div id="leave-calendar-view" class="overflow-x-auto hide-scrollbar"></div></div>'+
    '<div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12"><div><h2 class="text-xl font-bold mb-6 text-purple-700">내 휴가 신청 내역</h2><div id="leave-my-list" class="space-y-4"></div></div><div><h2 class="text-xl font-bold mb-6 text-gray-700">내게 온 결재 대기함</h2><div id="leave-to-me" class="space-y-4"></div></div></div>';
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
  renderLeaveCalendar();
}
function openLeaveModal(){var admins=CACHE.members.filter(function(m){return isApprover(m);});var myLeader=getTeamLeader(USER.dept);renderModalRoot('leave-modal','<div class="bg-white r35 modal-content max-w-md p-8 md:p-10 shadow-2xl fade-in"><h2 class="text-xl md:text-2xl font-black mb-6 text-purple-700"><i class="ri-flight-takeoff-fill"></i> 휴가 신청</h2><select id="leave-type" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold text-purple-700 bg-purple-50"><option value="연차">연차</option><option value="반차">반차</option><option value="병가">병가</option><option value="공가">공가</option></select><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">시작일</label><input id="leave-start" type="date" class="w-full border p-4 r24 outline-none text-sm"></div><div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">종료일</label><input id="leave-end" type="date" class="w-full border p-4 r24 outline-none text-sm"></div></div><label class="block text-xs font-bold text-gray-500 mb-2 pl-2">결재권자</label><select id="leave-approver" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-white">'+admins.map(function(m){var pos=getMemberPosition(m);return'<option value="'+m.email+'" '+(m.email===myLeader?'selected':'')+'>'+m.name+' ('+m.dept+' · '+pos+')</option>';}).join('')+'</select><textarea id="leave-reason" rows="3" placeholder="사유" class="w-full border p-4 r24 mb-6 outline-none text-sm bg-gray-50"></textarea><div class="flex justify-end gap-3"><button onclick="closeModal(\'leave-modal\')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button><button onclick="submitLeave()" class="px-8 py-3.5 bg-purple-600 text-white r35 text-sm font-bold shadow-lg">결재 올리기</button></div></div>');openModal('leave-modal');}
function submitLeave(){var s=document.getElementById('leave-start').value,e=document.getElementById('leave-end').value,t=document.getElementById('leave-type').value,r=document.getElementById('leave-reason').value,a=document.getElementById('leave-approver').value;if(!s||!a)return showToast("필수 입력");var id=genId();var obj={id:id,applicant:USER.email,applicantName:USER.name,startDate:s,endDate:e||s,type:t,reason:r,status:'대기',approver1:a};CACHE.leaves.push(obj);closeModal('leave-modal');showToast("신청 완료");updateBadges();renderLeaves();FB.set('leaves/'+id,obj);}
function openLeaveDetail(id){var d=CACHE.leaves.find(function(x){return String(x.id)===String(id);});if(!d)return;var btns='';if((d.applicant||'').toLowerCase()===USER.email&&d.status==='대기')btns='<button onclick="withdrawLeaveAction(\''+d.id+'\')" class="px-6 py-3 bg-gray-200 text-gray-700 r35 text-sm font-bold">철회</button>';else if(d.status==='대기'&&(d.approver1||'').toLowerCase()===USER.email)btns='<button onclick="openRejectModal(\''+d.id+'\',\'leave\')" class="px-6 py-3 border border-red-200 text-red-600 r35 text-sm font-bold">반려</button><button onclick="approveLeave(\''+d.id+'\')" class="px-6 py-3 bg-purple-600 text-white r35 text-sm font-bold shadow-lg">승인</button>';renderModalRoot('leave-detail-modal','<div class="bg-white r35 modal-content max-w-lg p-8 md:p-10 shadow-2xl relative fade-in"><button onclick="closeModal(\'leave-detail-modal\')" class="absolute top-6 right-6 text-gray-400 hover:text-black"><i class="ri-close-line text-3xl"></i></button><h2 class="text-xl md:text-2xl font-black mb-6 border-b pb-4 text-purple-700">휴가 상세</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-6 r24"><div><span class="text-gray-400 font-bold block mb-1 text-xs">신청자</span><span class="font-bold text-gray-800 text-lg">'+d.applicantName+'</span></div><div><span class="text-gray-400 font-bold block mb-1 text-xs">상태</span>'+statusBadge(d.status)+'</div><div class="md:col-span-2"><span class="text-gray-400 font-bold block mb-1 text-xs">일정</span><span class="font-bold text-purple-600 text-lg">'+d.startDate+' ~ '+d.endDate+' ('+d.type+')</span></div><div class="md:col-span-2"><span class="text-gray-400 font-bold block mb-1 text-xs">사유</span><span class="text-gray-700 bg-white border p-3 r20 block">'+esc(d.reason||'없음')+'</span></div></div><div class="flex justify-end gap-3 mt-6 border-t pt-4">'+btns+'</div></div>');openModal('leave-detail-modal');}
function withdrawLeaveAction(id){openCustomConfirm("휴가 철회","철회하시겠습니까?",function(){var d=CACHE.leaves.find(function(x){return x.id===id;});if(d)d.status='철회';FB.patch('leaves/'+id,{status:'철회'});closeModal('leave-detail-modal');showToast("철회 완료");updateBadges();renderLeaves();});}
function approveLeave(id){var d=CACHE.leaves.find(function(x){return x.id===id;});if(!d)return;openCustomConfirm("휴가 승인","승인할까요?",function(){d.status='승인';FB.patch('leaves/'+id,{status:'승인'});closeModal('leave-detail-modal');showToast("승인 완료");updateBadges();renderLeaves();CACHE.leaveInfo.used+=(d.type==='연차'?1:0.5);CACHE.leaveInfo.remain=CACHE.leaveInfo.total-CACHE.leaveInfo.used;});}
function renderLeaveCalendar(){
  var el=document.getElementById('leave-calendar-view');if(!el)return;
  var now=new Date();var year=now.getFullYear(),month=now.getMonth();
  var daysInMonth=new Date(year,month+1,0).getDate();
  var monthLeaves=CACHE.leaves.filter(function(l){
    if(l.status!=='승인')return false;
    var s=new Date(l.startDate),e=new Date(l.endDate);
    return s.getMonth()===month||e.getMonth()===month;
  });
  if(!monthLeaves.length){el.innerHTML='<p class="text-xs text-gray-400 text-center py-4">이번 달 승인된 휴가가 없습니다.</p>';return;}
  var colors=['bg-purple-200','bg-pink-200','bg-blue-200','bg-emerald-200','bg-amber-200','bg-rose-200'];
  var html='<div style="min-width:600px"><div class="flex mb-1"><div class="w-20 shrink-0"></div>';
  for(var d=1;d<=daysInMonth;d++){var dow=new Date(year,month,d).getDay();html+='<div class="flex-1 text-center text-[10px] font-bold '+(dow===0||dow===6?'text-red-400':'text-gray-400')+' min-w-[24px]">'+d+'</div>';}
  html+='</div>';
  monthLeaves.forEach(function(l,i){
    var s=new Date(l.startDate),e=new Date(l.endDate);
    var startDay=s.getMonth()===month?s.getDate():1;
    var endDay=e.getMonth()===month?e.getDate():daysInMonth;
    html+='<div class="flex items-center mb-1"><div class="w-20 shrink-0 text-xs font-bold text-gray-700 truncate pr-2">'+l.applicantName+'</div>';
    for(var d=1;d<=daysInMonth;d++){var inRange=d>=startDay&&d<=endDay;html+='<div class="flex-1 h-6 min-w-[24px] '+(inRange?colors[i%colors.length]+' rounded-sm':'')+'" title="'+(inRange?l.type:'')+'"></div>';}
    html+='</div>';
  });
  el.innerHTML=html+'</div>';
}
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
// 기존 renderAdmin 내부 HTML에 '삭제된 기록 다운로드' 버튼을 추가합니다.
function renderAdmin(){
  var el=document.getElementById('tab-admin');
  el.innerHTML='<h1 class="text-2xl md:text-3xl font-black text-red-600 mb-8"><i class="ri-settings-3-fill mr-2"></i> 관리자 설정</h1>'+
  '<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">'+
  '<div class="bg-white border-2 border-red-50 p-8 md:p-10 r35 card-shadow"><h2 class="text-xl font-bold text-red-600 mb-5"><i class="ri-megaphone-fill"></i> 팝업 공지</h2><textarea id="admin-notice-content" rows="4" placeholder="공지 내용" class="w-full border p-4 r24 mb-4 outline-none text-sm bg-gray-50"></textarea><button onclick="submitNoticeAdmin()" class="bg-red-600 text-white px-6 py-3 r35 font-bold w-full shadow-lg">전사 팝업 띄우기</button></div>'+
  '<div class="bg-white border p-8 md:p-10 r35 card-shadow"><h2 class="text-xl font-bold text-gray-800 mb-5"><i class="ri-database-2-fill text-blue-600"></i> 데이터 다운로드</h2><select id="admin-export-month" class="w-full border p-4 r24 mb-4 outline-none text-sm font-bold bg-gray-50"></select><div class="flex gap-3 mb-3"><button onclick="downloadCSVAdmin(\'Approval\')" class="flex-1 bg-gray-800 text-white py-3 r35 text-sm font-bold shadow-md">지출내역</button><button onclick="downloadCSVAdmin(\'Leaves\')" class="flex-1 bg-gray-800 text-white py-3 r35 text-sm font-bold shadow-md">휴가내역</button></div><button onclick="downloadDeletedData()" class="w-full bg-red-100 text-red-700 hover:bg-red-200 transition py-3 r35 text-sm font-bold shadow-sm"><i class="ri-delete-bin-fill mr-1"></i> 삭제된 전체 기록 다운로드</button></div>'+
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
// 삭제된 데이터 엑셀 추출 함수 (코드 맨 밑에 추가)
function downloadDeletedData() {
  var csv = '\uFEFF삭제모듈,데이터제목,삭제자,삭제일시\n';
  var nodes = ['crm', 'devProjects', 'cs', 'vault', 'wiki', 'schedules'];
  
  showToast("데이터베이스에서 삭제 기록을 수집 중입니다...");
  
  var promises = nodes.map(function(node) {
    return new Promise(function(resolve) {
      db.ref(node).once('value', function(snap) {
        var data = snap.val();
        if(data) {
          Object.keys(data).forEach(function(k) {
            var item = data[k];
            if(item.isDeleted) {
               var title = item.company || item.title || item.customer || item.category || '이름없음';
               csv += '"' + node + '","' + title + '","' + (item.deletedBy||'알수없음') + '","' + (item.deletedAt||'') + '"\n';
            }
          });
        }
        resolve();
      });
    });
  });

  Promise.all(promises).then(function() {
    var b = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = '삭제된_기록_추출_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    showToast("다운로드 완료!");
  });
}

// 전역 키보드 이벤트 감시자
window.addEventListener('keydown', function(e){
  // 1. Ctrl+K (또는 Cmd+K)로 검색창 열기
  if((e.ctrlKey || e.metaKey) && e.key === 'k'){
    e.preventDefault(); 
    openGlobalSearchModal();
  }
  
  // 2. Esc 키로 열려있는 모든 모달 닫기
  if(e.key === 'Escape'){
    closeModal('gs-modal');
    closeModal('wiki-detail-modal');
    closeModal('dev-detail-modal');
    closeModal('crm-detail-modal');
    // 추가로 다른 모달 ID가 있다면 여기에 넣어주세요.
  }
});

function openGlobalSearchModal(){
  // 🌟 상단 닫기 버튼(X)과 배경 클릭 시 닫히는 로직이 강화된 HTML입니다.
  renderModalRoot('gs-modal', `
    <div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150]" onclick="closeModal('gs-modal')">
      <div class="bg-white r35 modal-content max-w-2xl p-8 shadow-2xl fade-in mt-10 mx-auto relative" onclick="event.stopPropagation()">
        
        <button onclick="closeModal('gs-modal')" class="absolute top-6 right-6 text-gray-400 hover:text-black transition">
          <i class="ri-close-line text-3xl"></i>
        </button>

        <div class="flex items-center gap-3 border-b-2 border-gray-800 pb-4 mb-4 mt-2">
          <i class="ri-search-line text-2xl text-gray-400"></i>
          <input type="text" id="gs-input" oninput="doGlobalSearch(this.value)" placeholder="검색어를 입력하세요... (위키, CRM, 개발, 조직도)" class="flex-1 text-xl font-black outline-none bg-transparent">
        </div>
        
        <div id="gs-results" class="max-h-[50vh] overflow-y-auto space-y-2 hide-scrollbar">
          <p class="text-gray-400 text-sm text-center py-10 font-bold">검색어를 입력하면 결과가 나타납니다.</p>
        </div>
        
        <div class="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-bold">
          <span><kbd class="border px-1.5 py-0.5 r5 bg-gray-50">Esc</kbd> 누르면 닫기</span>
          <span>Circular Labs Search</span>
        </div>
      </div>
    </div>
  `);
  
  openModal('gs-modal');
  // 자동으로 입력창에 포커스
  setTimeout(function(){ 
    var inp = document.getElementById('gs-input');
    if(inp) inp.focus(); 
  }, 100);
}

/* 🔍 통합 검색 고도화 (데이터 연결 기능 포함) */
function doGlobalSearch(q) {
  q = q.toLowerCase().trim();
  var el = document.getElementById('gs-results');
  if (!q) { 
    el.innerHTML = '<p class="text-gray-400 text-sm text-center py-10 font-bold">검색어를 입력하면 결과가 나타납니다.</p>'; 
    return; 
  }

  var res = '';
  
  // 1. CRM 고객사 검색
  var crmMatches = CACHE.crm.filter(c => (c.company||'').toLowerCase().includes(q) || (c.contactName||'').toLowerCase().includes(q));
  crmMatches.forEach(c => {
    res += `
      <div onclick="closeModal('gs-modal'); showTab('crm'); setTimeout(() => openCRMDetail('${c.id}'), 200);" class="p-4 bg-emerald-50/50 hover:bg-emerald-50 r20 cursor-pointer border border-transparent hover:border-emerald-200 transition mb-2">
        <p class="text-[10px] text-emerald-600 font-black mb-1"><i class="ri-briefcase-4-fill"></i> CRM 고객사</p>
        <p class="text-sm font-black text-gray-800">${esc(c.company)} <span class="text-xs font-normal text-gray-500">(${esc(c.contactName || '담당자미정')})</span></p>
      </div>`;
  });

  // 2. 개발 프로젝트 검색
  var devMatches = CACHE.devProjects.filter(p => (p.title||'').toLowerCase().includes(q));
  devMatches.forEach(p => {
    res += `
      <div onclick="closeModal('gs-modal'); showTab('dev'); setTimeout(() => openDevDetail('${p.id}'), 200);" class="p-4 bg-blue-50/50 hover:bg-blue-50 r20 cursor-pointer border border-transparent hover:border-blue-200 transition mb-2">
        <p class="text-[10px] text-blue-600 font-black mb-1"><i class="ri-macbook-fill"></i> 개발 프로젝트</p>
        <p class="text-sm font-black text-gray-800">${esc(p.title)} <span class="text-[10px] bg-blue-100 px-1.5 py-0.5 r10 ml-2">${p.status}</span></p>
      </div>`;
  });

  // 3. 전사 업무(Task) 검색
  var taskMatches = CACHE.tasks.filter(t => (t.title||'').toLowerCase().includes(q));
  taskMatches.forEach(t => {
    res += `
      <div onclick="closeModal('gs-modal'); showTab('calendar'); setTimeout(() => openTaskDetail('${t.id}'), 200);" class="p-4 bg-rose-50/50 hover:bg-rose-50 r20 cursor-pointer border border-transparent hover:border-rose-200 transition mb-2">
        <p class="text-[10px] text-rose-600 font-black mb-1"><i class="ri-checkbox-circle-fill"></i> 진행 업무</p>
        <p class="text-sm font-black text-gray-800">${esc(t.title)} <span class="text-xs font-normal text-gray-500">@${t.project}</span></p>
      </div>`;
  });

  // 4. 사내 위키 검색
  var wikiMatches = CACHE.wiki.filter(w => (w.title||'').toLowerCase().includes(q) || (w.content||'').toLowerCase().includes(q));
  wikiMatches.forEach(w => {
    res += `
      <div onclick="closeModal('gs-modal'); showTab('wiki'); setTimeout(() => openWikiDetail('${w.id}'), 200);" class="p-4 bg-gray-50 hover:bg-gray-100 r20 cursor-pointer border border-gray-200 transition mb-2">
        <p class="text-[10px] text-gray-500 font-black mb-1"><i class="ri-book-read-fill"></i> 위키 문서</p>
        <p class="text-sm font-black text-gray-800">${esc(w.title)}</p>
      </div>`;
  });

  el.innerHTML = res || '<p class="text-gray-400 text-sm text-center py-10 font-bold">검색 결과가 없습니다. 🤔</p>';
}

/*═══════════ 다크 모드 토글 기능 ═══════════*/
function toggleDarkMode(){
  var html = document.documentElement;
  html.classList.toggle('dark-theme');
  
  // 다크모드용 CSS 스타일이 없으면 삽입
  if(!document.getElementById('dark-theme-style')){
    var style = document.createElement('style');
    style.id = 'dark-theme-style';
    // 배경은 어둡게 반전시키되, 이미지/캔버스(차트)는 원래 색으로 재반전
    style.innerHTML = `
      html.dark-theme { filter: invert(0.92) hue-rotate(180deg); background: #111; } 
      html.dark-theme img, html.dark-theme canvas, html.dark-theme [class*="avatar"] { filter: invert(1) hue-rotate(180deg); }
      html.dark-theme .modal-overlay { background: rgba(255,255,255,0.5); }
    `;
    document.head.appendChild(style);
  }
  
  if(html.classList.contains('dark-theme')){
    showToast("🌙 다크 모드가 켜졌습니다.");
  } else {
    showToast("☀️ 라이트 모드로 돌아왔습니다.");
  }
}

function setupRealtimeListeners() {
  // 1. 코멘트 멘션 알림
  db.ref('comments').on('child_added', function(snap) {
    if(isInitialLoad) return;
    var c = snap.val();
    if(c && c.authorName !== USER.name && c.content && c.content.indexOf('@'+USER.name) > -1) {
      showToast("🔔 " + c.authorName + "님이 회원님을 호출했습니다.");
      sendNativeNotification("워크스페이스 알림", c.authorName + "님이 코멘트에서 호출했습니다.");
      refreshNotifBadge(); 
    }
  });

  // 2. 내 휴가/결재 상태 변경 알림
  db.ref('leaves').on('child_changed', function(snap) {
    if(isInitialLoad) return; // 🌟 이 줄을 추가하여 초기 로딩 시 알림 방지
    var l = snap.val();
    if(l && l.applicant === USER.email) {
      showToast("🔔 휴가 신청 상태 변경: [" + l.status + "]");
      sendNativeNotification("결재 알림", "내 휴가 신청이 [" + l.status + "] 처리되었습니다.");
    }
  });
  
  // 3. 결재 요청 알림
  db.ref('approvals').on('child_added', function(snap) {
    if(isInitialLoad) return;
    var d = snap.val();
    if(d && ((d.approver1 === USER.email && d.status === '대기') || (d.approver2 === USER.email && d.status === '1차 승인'))) {
      showToast("📝 새 결재 대기 건이 도착했습니다.");
      sendNativeNotification("결재 대기", d.drafterName + "님이 결재를 요청했습니다.");
    }
  });

  setTimeout(function(){ isInitialLoad = false; }, 3000);
}

/*═══════════ 티켓 번호 자동 생성기 ═══════════*/
function getNextTicketId(list, prefix) {
  var max = 0;
  list.forEach(function(item) {
    if(item.ticketId && item.ticketId.startsWith(prefix+'-')) {
      var num = parseInt(item.ticketId.split('-')[1], 10);
      if(num > max) max = num;
    }
  });
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

/*═══════════ 누락된 디버깅 추가 함수들 ═══════════*/

// 1. 초기 로딩 시 호출되는 스켈레톤 UI 더미 함수
function showSkeleton(){
  // 필요 시 로딩 스피너 로직 추가
  console.log("로딩 중...");
}
function withdrawApprovalAction(id){
  openCustomConfirm("결재 철회", "해당 기안을 철회하시겠습니까?", function(){
    var d = CACHE.approval.find(function(x){return x.id === id;});
    if(d) d.status = '철회';
    FB.patch('approvals/'+id, {status: '철회'});
    closeModal('approval-detail-modal');
    showToast("철회 완료");
    updateBadges();
    renderApproval();
  });
}

function actionApproval(id, nextStatus){
  openCustomConfirm("결재 승인", nextStatus + " 처리하시겠습니까?", function(){
    var d = CACHE.approval.find(function(x){return x.id === id;});
    if(!d) return;
    var updateObj = { status: nextStatus };
    if(nextStatus === '1차 승인') updateObj.approved1At = nowFmt();
    if(nextStatus === '최종 승인') updateObj.approved2At = nowFmt();
    d.status = nextStatus;
    FB.patch('approvals/'+id, updateObj);
    closeModal('approval-detail-modal');
    showToast(nextStatus + " 완료");
    updateBadges();
    renderApproval();
  });
}

function renderTeamCalendar() {
  // 🌟 [수정] 도화지 ID를 tab-teamcal로 변경
  var el = document.getElementById('tab-teamcal'); 
  
  if(!el) return;

  el.innerHTML = `
    <div class="flex flex-col h-full" style="height: 80vh;">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-black text-gray-800"><i class="ri-calendar-check-fill text-blue-600 mr-2"></i> 전사 통합 캘린더</h1>
        <a href="https://calendar.google.com" target="_blank" class="px-4 py-2 bg-white border r20 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50 transition">Google 캘린더 앱에서 열기</a>
      </div>
      <div class="flex-1 bg-white r35 card-shadow overflow-hidden border border-gray-100">
        <iframe src="https://calendar.google.com/calendar/embed?src=${encodeURIComponent(USER.email)}&ctz=Asia%2FSeoul" 
                style="border: 0" width="100%" height="100%" frameborder="0" scrolling="no"></iframe>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
// 누락된 업무(Task) 및 체크리스트 렌더링 함수 복구
// ═══════════════════════════════════════════════


// [수정됨] 나의 할 일 (드래그 앤 드롭 순서 변경 및 저장 기능 추가)
function renderMyTodo(){
  var el = document.getElementById('my-todo-list');
  if(!el) return;
  
  // 🌟 (a.order || 0) - (b.order || 0) 를 추가하여 드래그한 순서대로 정렬
  var myTasks = CACHE.tasks.filter(function(t){
    return t.taskType==='personal' && (t.assignees||'').toLowerCase().indexOf(USER.email.toLowerCase()) > -1;
  }).sort(function(a,b){
    return (a.status==='Done'?1:0) - (b.status==='Done'?1:0) || (a.order||0) - (b.order||0) || (b.timestamp||0) - (a.timestamp||0);
  });
  
  if(myTasks.length === 0){
    el.innerHTML = '<p class="text-xs text-gray-400 font-bold text-center py-4">할 일이 없습니다.</p>';
    return;
  }

  el.innerHTML = myTasks.map(function(t){
    var isCreator = (t.creator||'').toLowerCase() === USER.email.toLowerCase();
    var fromBadge = isCreator ? '' : `<span class="ml-2 text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 r10 font-bold border border-blue-100">by ${getMemberName(t.creator)}</span>`;
    var delBtn = isCreator ? `<button onclick="deleteTodo('${t.id}')" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"><i class="ri-delete-bin-line"></i></button>` : '';

    // 🌟 data-id 부여 및 손잡이(todo-drag-handle) 아이콘 추가
    return `<div data-id="${t.id}" class="flex items-center gap-3 p-3 bg-gray-50 r20 group hover:bg-gray-100 transition">
      <i class="ri-draggable text-gray-300 hover:text-gray-500 cursor-move todo-drag-handle text-lg"></i>
      <input type="checkbox" class="w-5 h-5 rounded accent-blue-600 cursor-pointer shrink-0" ${t.status==='Done'?'checked':''} onchange="toggleTodo('${t.id}',this.checked)">
      <span class="flex-1 text-sm font-bold ${t.status==='Done'?'line-through text-gray-400':'text-gray-700'}">${esc(t.title)}${fromBadge}</span>
      ${delBtn}
    </div>`;
  }).join('');

  // 🌟 SortableJS를 이용한 드래그 앤 드롭 활성화 및 Firebase 순서 업데이트
  if(window.myTodoSortable) window.myTodoSortable.destroy(); // 기존 인스턴스 초기화
  window.myTodoSortable = new Sortable(el, {
    handle: '.todo-drag-handle', // 손잡이 부분만 잡고 끌 수 있게 설정
    animation: 150,
    ghostClass: 'opacity-50', // 드래그 중인 항목 반투명 처리
    onEnd: function(evt) {
      // 드래그가 끝난 후, 바뀐 순서(index)를 파이어베이스에 각각 저장
      var items = Array.from(evt.to.children);
      items.forEach(function(item, idx) {
        var id = item.getAttribute('data-id');
        var task = CACHE.tasks.find(x => x.id === id);
        if(task && task.order !== idx) {
          task.order = idx;
          FB.patch('tasks/' + id, { order: idx }); // 조용히 서버만 업데이트
        }
      });
    }
  });
}

function addMyTodo(){
  var input=document.getElementById('my-todo-input');
  var title=input?input.value.trim():''; if(!title) return;
  
  var mentions = [];
  var mentionRegex = /@([가-힣a-zA-Z0-9]+)/g;
  var match;
  
  // 1. 멘션된 이름으로 정확한 이메일 찾기
  while ((match = mentionRegex.exec(title)) !== null) {
    var mName = match[1];
    var found = CACHE.members.find(m => m.name === mName);
    if(found) mentions.push(found.email.toLowerCase());
  }

  var id = genId();
  // 2. 담당자 목록 생성 (나 + 멘션된 사람들)
  var assigneeList = [USER.email.toLowerCase()];
  mentions.forEach(m => { if(!assigneeList.includes(m)) assigneeList.push(m); });

  var obj = {
    id: id,
    taskType: 'personal',
    project: '일반',
    category: '할일',
    title: title,
    assignees: assigneeList.join(','), // 쉼표로 구분하여 저장
    priority: 'Medium',
    deadline: '',
    content: '',
    status: 'Todo',
    creator: USER.email,
    timestamp: Date.now()
  };
  
  // 3. 서버에 저장 (저장 즉시 1단계 리스너가 모든 PC 화면을 갱신합니다)
  FB.set('tasks/'+id, obj);
  input.value = '';
}

function toggleTodo(id,done){var ns=done?'Done':'Todo';var t=CACHE.tasks.find(function(x){return x.id===id;});if(t)t.status=ns;renderMyTodo();FB.patch('tasks/'+id,{status:ns});}
function deleteTodo(id){
  var t = CACHE.tasks.find(x => x.id === id);
  if(!t) return;
  if((t.creator||'').toLowerCase() !== USER.email.toLowerCase()) return showToast("자신이 등록한 업무만 삭제할 수 있습니다.");
  
  openCustomConfirm("할 일 삭제", "정말 이 항목을 삭제하시겠습니까?", function(){
    CACHE.tasks = CACHE.tasks.filter(x => x.id !== id);
    renderMyTodo();
    FB.patch('tasks/'+id, { isDeleted: true, deletedAt: Date.now() });
    closeModal('custom-confirm-modal');
    showToast("삭제 완료");
  });
}

// [수정됨] 업무 상세창 (이미지 갤러리 및 업로드 추가)
// 🌟 업무 상세 모달 (댓글 사진 첨부 지원)
function openTaskDetail(id) {
  var t = CACHE.tasks.find(x => x.id === id);
  if(!t) return;
  if(!t.checklist) t.checklist = [];
  if(!t.images) t.images = [];
  var comments = Object.values(CACHE.comments).filter(c => c.targetId === id).sort((a,b) => new Date(a.date) - new Date(b.date));

  var html = `
    <div class="bg-white r35 modal-content max-w-5xl p-0 shadow-2xl relative fade-in flex flex-col md:flex-row overflow-hidden">
      <button onclick="closeModal('task-detail-modal')" class="absolute top-6 right-6 text-gray-400 hover:text-black z-10"><i class="ri-close-line text-3xl"></i></button>
      
      <div class="flex-1 p-8 md:p-10 border-r border-gray-100 overflow-y-auto">
        <div class="flex items-center gap-2 mb-4"><span class="text-[10px] font-black px-2 py-1 r20 bg-blue-100 text-blue-700">${t.project}</span>${statusBadge(t.status === 'Done' ? '전체완료' : '진행중')}</div>
        <h2 class="text-2xl font-black text-gray-900 mb-6">${esc(t.title)}</h2>
        
        <div class="mb-8">
          <h3 class="text-sm font-black text-gray-800 mb-4 flex items-center gap-2"><i class="ri-checkbox-list-line text-blue-500"></i> 세부 실행 업무</h3>
          <div id="task-checklist-area" class="space-y-2 mb-4">
            ${t.checklist.map((item, idx) => `
              <div class="flex items-center gap-3 p-3 ${item.done ? 'bg-gray-50' : 'bg-white border border-gray-100'} r20 group">
                <input type="checkbox" class="w-5 h-5 rounded accent-blue-600 cursor-pointer" ${item.done ? 'checked' : ''} onchange="toggleSubTask('${t.id}', ${idx}, this.checked)">
                <span class="flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'font-bold text-gray-700'}">${renderMentionText(item.text)}</span>
                <span class="text-[9px] text-gray-300 font-bold">${item.completedBy ? getMemberName(item.completedBy) + ' 완료' : ''}</span>
              </div>
            `).join('')}
          </div>
          <div class="flex gap-2">
            <input type="text" id="new-subtask-in" placeholder="@이름 할 일 추가..." class="flex-1 border p-3 r20 text-xs outline-none bg-gray-50 focus:border-blue-400" onkeypress="if(event.key==='Enter')addSubTask('${t.id}')">
            <button onclick="addSubTask('${t.id}')" class="bg-blue-600 text-white px-5 r20 font-bold text-sm">추가</button>
          </div>
        </div>

        <div class="mb-8 border-t pt-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-black text-gray-800 flex items-center gap-2"><i class="ri-image-add-fill text-blue-500"></i> 첨부 이미지</h3>
            <label class="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 r20 text-xs font-bold transition">+ 사진 올리기<input type="file" class="hidden" accept="image/*" onchange="handleTaskImage(this, '${t.id}')"></label>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${t.images.length===0 ? '<p class="text-xs text-gray-400 col-span-3 py-4">첨부된 사진이 없습니다.</p>' : t.images.map(img => `<a href="${img}" target="_blank" class="block aspect-video bg-gray-100 r20 overflow-hidden border border-gray-200 hover:border-blue-400 transition"><img src="${img}" class="w-full h-full object-cover object-center"></a>`).join('')}
          </div>
        </div>

        <div class="flex justify-between items-center text-[11px] text-gray-400 border-t pt-6">
          <span>최초 등록: ${getMemberName(t.creator)}</span><button onclick="confirmDeleteTask('${t.id}')" class="text-red-400 hover:underline">업무 삭제</button>
        </div>
      </div>

      <div class="w-full md:w-[380px] bg-gray-50 p-8 flex flex-col h-[600px] md:h-auto">
        <h3 class="font-black text-gray-800 mb-4 flex items-center gap-2 text-sm"><i class="ri-chat-follow-up-fill text-blue-500"></i> 팔로업 기록</h3>
        <div id="task-cmt-list" class="flex-1 overflow-y-auto space-y-3 mb-4 hide-scrollbar">
          ${comments.map(c => `
            <div class="bg-white p-4 r20 shadow-sm border border-gray-100">
              <div class="flex justify-between items-center mb-1"><span class="font-black text-[10px] text-gray-800">${c.authorName}</span><span class="text-[9px] text-gray-400">${c.date}</span></div>
              ${c.fileUrl ? `<a href="${c.fileUrl}" target="_blank" class="block mb-2"><img src="${c.fileUrl}" class="w-full h-24 object-cover r10 border border-gray-200 hover:opacity-80 transition"></a>` : ''}
              <p class="text-xs text-gray-600 leading-relaxed">${renderMentionText(c.content)}</p>
            </div>`).join('')}
        </div>
        
        <div class="relative bg-white p-2 r24 border shadow-sm focus-within:border-blue-400">
          <textarea id="task-cmt-in" rows="2" placeholder="@이름 호출, 혹은 텍스트 입력..." class="w-full p-2 text-sm outline-none resize-none bg-transparent"></textarea>
          <div class="flex justify-between items-center mt-1 border-t border-gray-50 pt-2 px-1">
            <label class="cursor-pointer text-gray-400 hover:text-blue-500 transition px-2" title="사진 첨부 및 전송">
              <i class="ri-image-add-line text-lg"></i>
              <input type="file" class="hidden" accept="image/*" onchange="uploadTaskCommentImage(this, '${t.id}')">
            </label>
            <button onclick="submitTaskComment('${t.id}')" class="bg-blue-600 text-white px-4 py-1.5 r20 text-xs font-bold shadow-md hover:bg-blue-700 transition">등록</button>
          </div>
        </div>
        
      </div>
    </div>
  `;
  renderModalRoot('task-detail-modal', html);
  openModal('task-detail-modal');
  setTimeout(() => { setupMention('task-cmt-in'); setupMention('new-subtask-in'); }, 200);
}

// 🌟 댓글 전용 사진 업로드 함수
function uploadTaskCommentImage(input, taskId) {
  if(!input.files || !input.files[0]) return;
  showToast("⏳ 사진을 압축하여 전송 중...");
  
  compressAndUploadImage(input.files[0], 'comment_images', function(url){
    var inp = document.getElementById('task-cmt-in');
    var msg = inp ? inp.value.trim() : '';
    
    var cId = genId();
    var c = {
      targetId: taskId, email: USER.email, authorName: USER.name, 
      content: msg || '(사진 첨부)', date: nowFmt(), fileUrl: url // 🌟 fileUrl 속성 추가
    };
    
    CACHE.comments[cId] = c;
    FB.set('comments/' + cId, c);
    
    if(inp) inp.value = '';
    openTaskDetail(taskId); // 화면 갱신
    showToast("✅ 사진 댓글이 등록되었습니다.");
  });
}

// 📸 전사 업무 - 이미지 업로드 처리 함수
function handleTaskImage(input, taskId) {
  if(!input.files || !input.files[0]) return;
  showToast("⏳ 사진을 압축하여 올리는 중...");
  compressAndUploadImage(input.files[0], 'task_images', function(url){
    var t = CACHE.tasks.find(x => x.id === taskId);
    if(!t.images) t.images = [];
    t.images.push(url);
    FB.patch('tasks/' + taskId, { images: t.images });
    showToast("✅ 사진 업로드 완료!");
    openTaskDetail(taskId); // 모달 새로고침
  });
}

function addSubTask(taskId) {
  var inp = document.getElementById('new-subtask-in');
  if(!inp.value.trim()) return;
  var t = CACHE.tasks.find(x => x.id === taskId);
  t.checklist.push({ text: inp.value.trim(), done: false, addedBy: USER.email });
  FB.patch('tasks/' + taskId, { checklist: t.checklist });
  inp.value = ''; openTaskDetail(taskId);
  renderTeamProjectBoard();
}

function toggleSubTask(taskId, idx, done) {
  var t = CACHE.tasks.find(x => x.id === taskId);
  t.checklist[idx].done = done;
  t.checklist[idx].completedBy = done ? USER.email : null;
  FB.patch('tasks/' + taskId, { checklist: t.checklist });
  setTimeout(() => { openTaskDetail(taskId); renderTeamProjectBoard(); }, 300);
}

function confirmDeleteTask(id){
  if(!canDelete()) return showToast("삭제 권한은 팀장 이상에게만 있습니다.");
  openCustomConfirm("업무 삭제","이 업무를 삭제하시겠습니까?",function(){
    CACHE.tasks=CACHE.tasks.filter(function(x){return x.id!==id;});
    FB.patch('tasks/'+id, { isDeleted: true, deletedAt: nowFmt(), deletedBy: USER.name });
    closeModal('task-detail-modal');
    renderMyTodo();
    renderTeamProjectBoard();
    showToast("삭제 완료");
  });
}

function submitTaskComment(id) {
  var inp = document.getElementById('task-cmt-in');
  if(!inp || !inp.value.trim()) return;
  var cId = genId();
  var c = {targetId: id, email: USER.email, authorName: USER.name, content: inp.value, date: nowFmt()};
  CACHE.comments[cId] = c;
  FB.set('comments/' + cId, c);
  openTaskDetail(id); // 화면 갱신
  renderTeamProjectBoard();
  showToast("의견이 등록되었습니다.");
}

function openTeamTaskModal(){
  var existingProjects={};CACHE.tasks.filter(function(t){return t.taskType==='team'&&t.project;}).forEach(function(t){existingProjects[t.project]=true;});
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
  CACHE.tasks.push(obj);closeModal('team-task-modal');renderTeamProjectBoard();showToast("업무 등록 완료!");FB.set('tasks/'+id,obj);
}
// 1단계: 모든 사용자의 화면을 실시간으로 동기화하는 리스너
function listenRealtimeTasks() {
  db.ref('tasks').on('value', function(snapshot) {
    var data = snapshot.val();
    if(data) {
      var now = Date.now();
      // 🌟 서버 데이터를 CACHE에 동기화 (오래된 완료 업무는 자동으로 숨김)
      CACHE.tasks = Object.keys(data).map(function(k) {
        return Object.assign({id:k}, data[k]);
      }).filter(function(t) { 
        return !t.isDeleted && !(t.status==='Done' && (now-(parseInt(t.timestamp)||now))>30*86400000); 
      });

      // 🌟 캘린더 탭을 보고 있다면 즉시 화면 갱신
      var calendarTab = document.getElementById('tab-calendar');
      if (calendarTab && !calendarTab.classList.contains('hidden')) {
        renderMyTodo(); 
        renderTeamProjectBoard();
      }
      
      // 🌟 대시보드 탭을 보고 있다면 즉시 화면 갱신 (D-day 현황 등)
      var homeTab = document.getElementById('tab-home');
      if (homeTab && !homeTab.classList.contains('hidden')) {
        renderDashboard(); 
      }
    }
  });
}

// 🚨 주의: app.js 상단(약 120번째 줄)에 있는 옛날 initApp() 함수는 중복되니 꼭 지워주시거나 무시하세요!
// 앱 초기화 최종본
function initApp(){
  showSkeleton();
  
  // 🌟 실시간 리스너 실행 (이게 있어야 데이터가 즉시 반영됩니다)
  if(typeof listenRealtimeTasks === 'function') listenRealtimeTasks(); 

  var nodes=['tasks','devProjects','sprints','crm','cs','schedules','approvals','leaves','vault','comments','wiki','notices','quickLinks','products'];
  var results={}, idx=0;
  
  function next(){
    if(idx >= nodes.length){
      processData(results);
      return;
    }
    var node = nodes[idx++];
    FB.get(node, function(err, data){
      results[node] = data;
      next();
    });
  }
  next();
}
// 1. 초기 로딩 시 호출되는 스켈레톤 UI 더미 함수
function showSkeleton(){
  var el = document.getElementById('tab-home');
  if(el) el.innerHTML = '<div class="flex flex-col items-center justify-center py-20"><div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-sm font-bold text-gray-400">데이터를 불러오는 중...</p></div>';
}

// 📸 이미지 자동 압축 및 업로드 헬퍼 함수
function compressAndUploadImage(file, pathPrefix, callback) {
  if (!file || !file.type.startsWith('image/')) return showToast("이미지 파일만 가능합니다.");
  
  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function(event) {
    var img = new Image();
    img.src = event.target.result;
    img.onload = async function() {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var maxWidth = 1200; // 가로 최대 1200px로 리사이징
      var maxHeight = 1200;
      var width = img.width;
      var height = img.height;

      if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } } 
      else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
      
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // 80% 퀄리티의 JPEG로 압축
      var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      var arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
      var bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){ u8arr[n] = bstr.charCodeAt(n); }
      var compressedFile = new Blob([u8arr], {type:mime});

      try {
        var storageRef = firebase.storage().ref(pathPrefix + '/' + Date.now() + '.jpg');
        await storageRef.put(compressedFile);
        var url = await storageRef.getDownloadURL();
        callback(url);
      } catch(e) {
        console.error("이미지 업로드 실패:", e);
        showToast("이미지 업로드에 실패했습니다.");
      }
    }
  };
}


/*═══════════════════════════════════════════════
   제품 라인업 (Products) - UI 고도화 및 데이터 매칭
  ═══════════════════════════════════════════════*/

function renderProducts() {
  var el = document.getElementById('tab-products');
  if(!el) return;

  if(!window.productViewMode) window.productViewMode = 'list'; 

  el.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-gray-800"><i class="ri-box-3-fill text-gray-700 mr-2"></i> 제품 라인업</h1>
        <p class="text-xs text-gray-400 mt-1 ml-9 font-bold uppercase tracking-tight">Product & Asset Management</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex bg-gray-100 p-1 r24 border border-gray-200 shadow-inner">
          <button onclick="window.productViewMode='list'; renderProducts();" class="px-5 py-2 r20 text-xs font-bold transition ${window.productViewMode==='list'?'bg-white text-gray-800 shadow-sm':'text-gray-400'}"><i class="ri-list-check"></i> 전체 목록</button>
          <button onclick="window.productViewMode='grid'; renderProducts();" class="px-5 py-2 r20 text-xs font-bold transition ${window.productViewMode==='grid'?'bg-white text-gray-800 shadow-sm':'text-gray-400'}"><i class="ri-layout-grid-fill"></i> 갤러리</button>
        </div>
        
        <input type="text" id="product-search" oninput="filterProducts()" placeholder="제품명 검색..." class="px-5 py-3 border r35 text-sm outline-none w-48 bg-white card-shadow focus:border-pink-300 transition">
        
        ${canDelete() ? `
          <button onclick="openProductEditModal()" class="bg-gray-800 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-black transition">+ 제품 등록</button>
          <button onclick="openCsvUploadModal()" class="bg-emerald-600 text-white px-6 py-3 r35 text-sm font-bold shadow-lg hover:bg-emerald-700 transition"><i class="ri-file-excel-2-fill"></i> CSV 일괄등록</button>
        ` : ''}
      </div>
    </div>
    <div id="product-display-area" class="fade-in overflow-hidden r35"></div>
  `;
  filterProducts();
}

function filterProducts() {
  var q = (document.getElementById('product-search')||{value:''}).value.toLowerCase();
  var data = CACHE.products.filter(p => !p.isDeleted && ((p.name||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q)));
  var el = document.getElementById('product-display-area');
  if(!el) return;

  if (window.productViewMode === 'list') {
    // 🌟 표 형태 뷰 (데이터 매칭 수정)
    el.className = "bg-white r35 overflow-hidden border border-gray-100 shadow-sm overflow-x-auto";
    el.innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
        <thead class="bg-gray-50/80 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
          <tr>
            <th class="p-5 pl-8">제품명</th>
            <th class="p-5">분류</th>
            <th class="p-5">용량</th>
            <th class="p-5">형태</th>
            <th class="p-5">카테고리</th>
            <th class="p-5 text-right">원가</th>
            <th class="p-5 text-right">구입가</th>
            <th class="p-5 text-right text-pink-600">렌탈/세척가</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${data.map(p => `
            <tr onclick="openProductDetail('${p.id}')" class="hover:bg-pink-50/20 cursor-pointer transition">
              <td class="p-4 pl-8 font-bold text-gray-700 flex items-center gap-4">
                <div class="w-10 h-10 r10 overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                  <img src="${p.imageUrl || 'https://i.imgur.com/7XvX8nD.png'}" class="w-full h-full object-cover">
                </div>
                <div>
                    <p class="text-sm font-black text-gray-800">${esc(p.name)}</p>
                    <p class="text-[9px] text-gray-400 uppercase tracking-tighter">${esc(p.code)}</p>
                </div>
              </td>
              <td class="p-4 text-gray-500 font-medium">${esc(p.subType || '-')}</td>
              <td class="p-4 text-gray-500 font-medium">${esc(p.volume || '-')}</td>
              <td class="p-4"><span class="bg-gray-100 text-gray-500 px-2.5 py-1 r8 font-bold text-[10px]">${esc(p.shape || 'PP')}</span></td>
              <td class="p-4"><span class="bg-purple-50 text-purple-600 px-2.5 py-1 r8 font-black text-[10px]">${esc(p.category)}</span></td>
              
              <td class="p-4 text-right font-bold text-gray-400">${p.price_origin ? Number(p.price_origin).toLocaleString() : '0'}</td>
              <td class="p-4 text-right font-bold text-gray-800">${p.price_buy ? Number(p.price_buy).toLocaleString() : '0'}</td>
              <td class="p-4 text-right font-black text-pink-600 bg-pink-50/30">${p.price_rent ? Number(p.price_rent).toLocaleString() : '0'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } else {
    // 갤러리형 뷰 (R값 r35 적용)
    el.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6";
    el.innerHTML = data.map(p => `
      <div onclick="openProductDetail('${p.id}')" class="bg-white r35 card-shadow overflow-hidden cursor-pointer hover:-translate-y-1 transition duration-300 border border-gray-100 group relative">
        <div class="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
          ${p.imageUrl ? `<img src="${p.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">` : `<i class="ri-box-3-line text-4xl text-gray-200"></i>`}
          <div class="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 r10 text-[10px] font-black text-gray-600 shadow-sm border border-gray-100">${p.category}</div>
        </div>
        <div class="p-5 text-center">
          <p class="text-[10px] font-bold text-pink-500 mb-1 uppercase tracking-widest">${p.code}</p>
          <h3 class="font-black text-gray-800 truncate text-sm">${p.name}</h3>
        </div>
      </div>`).join('');
  }
}


// 🌟 제품 저장 함수 (화면 튕김 방지 및 필드명 최적화 버전)
async function submitNewProduct(id) {
  const btn = document.getElementById('btn-prod-save');
  if(btn) {
    btn.disabled = true;
    btn.innerText = "⏳ 저장 중...";
  }

  // 1. 데이터 수집 (시안의 표 열과 1:1 매칭)
  var obj = {
    name: document.getElementById('p-name').value.trim(),
    code: document.getElementById('p-code').value.trim(),
    subType: document.getElementById('p-subtype').value,
    volume: document.getElementById('p-volume').value,
    shape: document.getElementById('p-shape').value,
    category: document.getElementById('p-cat').value,
    imageUrl: document.getElementById('p-img-url').value || "",
    
    // 💰 가격 데이터 매칭
    price_origin: Number(document.getElementById('p-p1').value) || 0, // 원가
    price_buy: Number(document.getElementById('p-p2').value) || 0,    // 구입가
    price_rent: Number(document.getElementById('p-p3').value) || 0,   // 렌탈가
    
    description: document.getElementById('p-desc').value,
    updatedAt: Date.now()
  };

  // 필수값 검성
  if(!obj.name || !obj.code) {
    showToast("⚠️ 제품명과 코드는 필수입니다.");
    if(btn) { btn.disabled = false; btn.innerText = "제품 데이터 저장"; }
    return;
  }

  try {
    if(id) {
      // 수정 모드
      await db.ref('products/' + id).update(obj);
      // 로컬 캐시 즉시 업데이트 (속도 최적화)
      var idx = CACHE.products.findIndex(x => x.id === id);
      if(idx > -1) Object.assign(CACHE.products[idx], obj);
      showToast("✅ 수정 완료");
    } else {
      // 신규 등록 모드
      var newId = genId();
      obj.id = newId; 
      obj.creator = USER.email; 
      obj.timestamp = Date.now();
      await db.ref('products/' + newId).set(obj);
      CACHE.products.push(obj); // 로컬 캐시에 추가
      showToast("✅ 등록 완료");
    }

    // 2. 모달 닫기
    closeModal('product-edit-modal');

    // 🌟 3. 화면 튕김 방지 핵심 로직
    // initApp()을 호출하지 않고, 현재 탭(제품 라인업)을 유지하며 리스트만 다시 그립니다.
    renderProducts(); 

  } catch(e) {
    console.error(e);
    showToast("❌ 저장 중 오류 발생");
  } finally {
    if(btn) {
      btn.disabled = false;
      btn.innerText = "제품 데이터 저장";
    }
  }
}

// 🌟 제품 등록/수정 모달
function openProductEditModal(id) {
  var p = id ? CACHE.products.find(x => x.id === id) : null;
  renderModalRoot('product-edit-modal', `
    <div class="bg-white r35 modal-content max-w-3xl p-8 md:p-10 shadow-2xl fade-in overflow-y-auto max-h-[90vh]">
      <h2 class="text-xl md:text-2xl font-black text-gray-800 mb-6 border-b pb-4"><i class="ri-edit-box-line text-pink-600 mr-2"></i> ${p ? '제품 정보 수정' : '신규 제품 등록'}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="space-y-4">
          <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">제품명 *</label><input type="text" id="p-name" value="${p?esc(p.name):''}" class="w-full border p-3 r20 text-sm font-bold bg-gray-50 outline-none"></div>
          <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">제품 코드 *</label><input type="text" id="p-code" value="${p?esc(p.code):''}" class="w-full border p-3 r20 text-sm bg-gray-50 outline-none uppercase"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">분류</label><input type="text" id="p-subtype" value="${p?esc(p.subType):''}" class="w-full border p-3 r20 text-sm bg-gray-50"></div>
            <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">용량</label><input type="text" id="p-volume" value="${p?esc(p.volume):''}" class="w-full border p-3 r20 text-sm bg-gray-50"></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">형태/재질</label><input type="text" id="p-shape" value="${p?esc(p.shape):'PP'}" class="w-full border p-3 r20 text-sm bg-gray-50"></div>
            <div><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">카테고리</label><select id="p-cat" class="w-full border p-3 r20 text-sm bg-gray-50 font-bold">
              <option ${p&&p.category==='다회용기'?'selected':''}>다회용기</option>
              <option ${p&&p.category==='다회용컵'?'selected':''}>다회용컵</option>
              <option ${p&&p.category==='키오스크'?'selected':''}>키오스크</option>
              <option ${p&&p.category==='RFID 계수기'?'selected':''}>RFID 계수기</option>
              <option ${p&&p.category==='기타'?'selected':''}>기타</option>
            </select></div>
          </div>
        </div>
        <div class="space-y-4">
          <label class="block w-full aspect-video bg-gray-100 r24 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-200 overflow-hidden relative group">
            <div id="p-img-preview" class="absolute inset-0 flex items-center justify-center p-2">${p && p.imageUrl ? `<img src="${p.imageUrl}" class="w-full h-full object-contain">` : '<i class="ri-image-add-line text-4xl text-gray-300"></i>'}</div>
            <input type="file" class="hidden" accept="image/*" onchange="handleProductImageUpload(input)">
            <input type="hidden" id="p-img-url" value="${p?p.imageUrl:''}">
          </label>
          <div class="grid grid-cols-3 gap-2 mt-4">
            <div><label class="block text-[8px] font-black text-gray-400">원가</label><input type="number" id="p-p1" value="${p?p.price_origin:''}" class="w-full border p-3 r16 text-xs bg-gray-50 font-bold"></div>
            <div><label class="block text-[8px] font-black text-gray-400">구입가</label><input type="number" id="p-p2" value="${p?p.price_buy:''}" class="w-full border p-3 r16 text-xs bg-gray-50 font-bold"></div>
            <div><label class="block text-[8px] font-black text-pink-500">렌탈가</label><input type="number" id="p-p3" value="${p?p.price_rent:''}" class="w-full border p-3 r16 text-xs bg-pink-50 font-black text-pink-600"></div>
          </div>
        </div>
      </div>
      <div class="mb-8"><label class="block text-[10px] font-black text-gray-400 mb-1 pl-1">상세 설명</label><textarea id="p-desc" rows="4" class="w-full border p-4 r24 text-sm bg-gray-50 outline-none resize-none">${p?esc(p.description):''}</textarea></div>
      <div class="flex justify-end gap-3 pt-6 border-t">
        ${p ? `<button onclick="deleteProduct('${p.id}')" class="px-6 py-3.5 bg-red-50 text-red-600 r35 text-sm font-bold mr-auto">삭제</button>` : ''}
        <button onclick="closeModal('product-edit-modal')" class="px-8 py-3.5 bg-gray-100 r35 text-sm font-bold">취소</button>
        <button onclick="submitNewProduct('${p?p.id:''}')" id="btn-prod-save" class="px-8 py-3.5 bg-gray-900 text-white r35 text-sm font-bold shadow-xl">제품 데이터 저장</button>
      </div>
    </div>
  `);
  openModal('product-edit-modal');
}

// 🌟 사진 업로드 로직 (핸들러)
function handleProductImageUpload(input) {
  if(!input.files || !input.files[0]) return;
  var previewArea = document.getElementById('p-img-preview');
  var urlInput = document.getElementById('p-img-url');
  var saveBtn = document.getElementById('btn-prod-save');
  
  if(saveBtn) saveBtn.disabled = true;
  showToast("⏳ 사진 압축 및 업로드 중...");
  previewArea.innerHTML = '<div class="animate-spin text-2xl text-pink-500"><i class="ri-loader-4-line"></i></div>';

  compressAndUploadImage(input.files[0], 'products', function(url) {
    if(url) {
      urlInput.value = url;
      previewArea.innerHTML = `<img src="${url}" class="w-full h-full object-contain">`;
      showToast("✅ 업로드 완료!");
    } else {
      previewArea.innerHTML = '<i class="ri-image-add-line text-4xl text-gray-300"></i>';
      showToast("❌ 업로드 실패");
    }
    if(saveBtn) saveBtn.disabled = false;
  });
}


function openProductDetail(id) {
  var p = CACHE.products.find(x => x.id === id);
  if(!p) return;
  if(!p.specTable) p.specTable = [['항목', '상세내용'], ['규격', '-'], ['재질', '-']];

  renderModalRoot('product-detail-modal', `
    <div class="bg-white r35 modal-content max-w-5xl p-0 shadow-2xl relative fade-in flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
      <button onclick="closeModal('product-detail-modal')" class="absolute top-6 right-6 text-gray-800 bg-white/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-white z-10 backdrop-blur"><i class="ri-close-line text-2xl"></i></button>
      <div class="w-full md:w-1/2 bg-gray-100 flex items-center justify-center overflow-hidden">
        ${p.imageUrl ? `<img src="${p.imageUrl}" class="w-full h-full object-contain">` : `<i class="ri-box-3-fill text-9xl text-gray-200"></i>`}
      </div>
      <div class="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto hide-scrollbar">
        <p class="text-sm font-black text-pink-500 mb-2 uppercase tracking-widest">${p.code}</p>
        <h2 class="text-3xl font-black text-gray-900 mb-8 leading-tight">${p.name}</h2>
        <div class="mb-8">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-black text-gray-400 uppercase tracking-wider">세부 스펙 및 단가</h3>
            ${canDelete() ? `<button onclick="saveSpecTable('${p.id}')" class="text-[10px] bg-blue-600 text-white px-3 py-1 r10 font-bold shadow-md">표 저장</button>` : ''}
          </div>
          <div class="border border-gray-100 r20 overflow-hidden shadow-sm">
            <table id="spec-table-${p.id}" class="w-full text-sm divide-y divide-gray-100">
              ${p.specTable.map((row, rIdx) => `
                <tr class="divide-x divide-gray-50">
                  ${row.map((cell, cIdx) => `
                    <td class="p-3 ${rIdx===0?'bg-gray-50 font-black text-gray-500':'text-gray-700'}">
                      ${canDelete() ? `<input type="text" value="${esc(cell)}" class="w-full bg-transparent outline-none focus:text-pink-500" data-row="${rIdx}" data-col="${cIdx}">` : esc(cell)}
                    </td>
                  `).join('')}
                </tr>`).join('')}
            </table>
            ${canDelete() ? `<button onclick="addSpecRow('${p.id}')" class="w-full py-2 bg-gray-50 text-[10px] font-bold text-gray-400 hover:bg-gray-100">+ 행 추가</button>` : ''}
          </div>
        </div>
        <div class="bg-gray-50 p-6 r24 mb-8">
          <p class="text-xs font-black text-gray-400 mb-2">상세 비고</p>
          <p class="text-sm text-gray-700 leading-relaxed">${esc(p.description || '내용 없음')}</p>
        </div>
        <div class="flex justify-between items-center border-t pt-4">
          <p class="text-[10px] text-gray-400">등록자: ${getMemberName(p.creator)}</p>
          ${canDelete() ? `<button onclick="closeModal('product-detail-modal'); openProductEditModal('${p.id}');" class="px-5 py-2 bg-gray-900 text-white r20 text-xs font-bold hover:bg-black transition">수정하기</button>` : ''}
        </div>
      </div>
    </div>
  `);
  openModal('product-detail-modal');
}

function addSpecRow(id) {
  var p = CACHE.products.find(x => x.id === id);
  if(!p) return;
  p.specTable.push(['신규항목', '-']);
  openProductDetail(id);
}

function saveSpecTable(id) {
  var p = CACHE.products.find(x => x.id === id);
  var tableEl = document.getElementById('spec-table-' + id);
  var inputs = tableEl.querySelectorAll('input');
  inputs.forEach(inp => {
    p.specTable[inp.dataset.row][inp.dataset.col] = inp.value;
  });
  FB.patch('products/' + id, { specTable: p.specTable });
  showToast("✅ 단가표 저장 완료");
}

function deleteProduct(id) {
  if(!canDelete()) return showToast("권한 없음");
  openCustomConfirm("제품 삭제", "정말 삭제하시겠습니까?", function(){
    db.ref('products/'+id).update({ isDeleted: true });
    closeModal('product-edit-modal');
    closeModal('product-detail-modal');
    if(typeof initApp === 'function') initApp();
    showToast("삭제되었습니다.");
  });
}

// 🌟 CSV 일괄 등록 (PapaParse)
function openCsvUploadModal() {
  renderModalRoot('csv-modal', `
    <div class="bg-white r35 modal-content max-w-sm p-10 text-center shadow-2xl fade-in">
      <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><i class="ri-file-excel-2-fill"></i></div>
      <h2 class="text-xl font-black mb-2">CSV 제품 일괄 업로드</h2>
      <p class="text-[10px] text-gray-400 mb-8 leading-relaxed">준비된 CSV 파일을 선택해주세요.<br>헤더명: 제품명, 코드, 분류, 용량, 형태, 카테고리, 원가, 구입가, 렌탈가, 설명</p>
      <input type="file" id="csv-file-input" accept=".csv" class="hidden" onchange="handleCsvFile(this)">
      <label for="csv-file-input" class="w-full block bg-emerald-500 text-white py-4 r24 font-black cursor-pointer shadow-lg hover:bg-emerald-600 transition mb-3">파일 선택하기</label>
      <button onclick="closeModal('csv-modal')" class="text-sm font-bold text-gray-300 transition hover:text-gray-600">닫기</button>
    </div>
  `);
  openModal('csv-modal');
}

function handleCsvFile(input) {
  if(!input.files[0]) return;
  Papa.parse(input.files[0], {
    header: true, skipEmptyLines: true,
    complete: async function(results) {
      const data = results.data;
      if(confirm(data.length + "개의 데이터를 등록하시겠습니까?")) {
        showToast("⏳ 처리 중...");
        for(let row of data) {
          const id = genId();
          const obj = {
            id: id, name: row['제품명'], code: row['코드'], subType: row['분류'], 
            volume: row['용량'], shape: row['형태'], category: row['카테고리'] || '기타',
            price_origin: Number(row['원가']) || 0, price_buy: Number(row['구입가']) || 0, price_rent: Number(row['렌탈가']) || 0,
            description: row['설명'], creator: USER.email, timestamp: Date.now()
          };
          await db.ref('products/' + id).set(obj);
        }
        showToast("✅ 일괄 등록 완료!");
        closeModal('csv-modal');
        if(typeof initApp === 'function') initApp();
      }
    }
  });
}

// 🌟 위키 읽음 확인 기능 명단 렌더링
function renderWikiReaders(wikiId) {
  var el = document.getElementById('wiki-reader-list');
  if(!el) return;
  db.ref('wiki_reads').orderByChild('wikiId').equalTo(wikiId).once('value', function(snap) {
    var data = snap.val();
    if(!data) { el.innerHTML = '<p class="text-[10px] font-black text-gray-300">아직 읽은 사람이 없습니다.</p>'; return; }
    var readers = Object.values(data).sort((a, b) => b.at - a.at);
    el.innerHTML = `<p class="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-wider">읽은 사람 (${readers.length})</p><div class="flex flex-wrap gap-2">${readers.map(r => `<div class="flex items-center bg-gray-50 px-2.5 py-1 r12 border border-gray-100 shadow-sm"><span class="text-[10px] font-bold text-gray-600">${r.userName}</span></div>`).join('')}</div>`;
  });
}

// 🌟 주간 업무 보고 자동 추출
function extractWeeklyReport() {
  var lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000); 
  var myDoneTasks = CACHE.tasks.filter(function(t) {
    var isMine = (t.assignees||'').toLowerCase().indexOf(USER.email.toLowerCase()) > -1;
    var isRecent = (t.timestamp || 0) > lastWeek; 
    return isMine && t.status === 'Done' && isRecent;
  });

  if(myDoneTasks.length === 0) return showToast("최근 7일 내 완료된 업무가 없습니다.");

  var reportText = `[주간 업무 완료 보고 - ${USER.name}]\n\n`;
  var team = myDoneTasks.filter(t => t.taskType === 'team');
  var personal = myDoneTasks.filter(t => t.taskType === 'personal');

  if(team.length > 0) {
    reportText += "■ 전사 프로젝트 업무\n";
    team.forEach(t => { reportText += `- [${t.project||'공통'}] ${t.title}\n`; });
    reportText += "\n";
  }
  if(personal.length > 0) {
    reportText += "■ 개인 할 일\n";
    personal.forEach(t => { reportText += `- ${t.title}\n`; });
  }

  navigator.clipboard.writeText(reportText).then(() => showToast("✅ 보고서 복사 완료! 메신저에 붙여넣으세요."));
}

function changeTeamView(mode) {
  teamTaskViewMode = mode;
  renderTeamProjectBoard();
}

/*═══════════ [THE END] ═══════════*/


// 🌟 주간 업무 보고 자동 추출기
function extractWeeklyReport() {
  var lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7일 전 타임스탬프
  
  // 지난 7일 이내에 '완료(Done)' 처리된 내 업무 찾기
  var myDoneTasks = CACHE.tasks.filter(function(t) {
    var isMine = (t.assignees||'').toLowerCase().indexOf(USER.email.toLowerCase()) > -1;
    var isRecent = (t.timestamp || 0) > lastWeek; // 이상적으로는 완료일을 찍어야 하지만 임시로 생성일/수정일 기준
    return isMine && t.status === 'Done' && isRecent;
  });

  if(myDoneTasks.length === 0) {
    return showToast("최근 7일 내에 완료 처리된 업무가 없습니다.");
  }

  // 텍스트 포맷팅
  var reportText = "[주간 업무 완료 보고 - " + USER.name + "]\n\n";
  
  var personal = myDoneTasks.filter(t => t.taskType === 'personal');
  var team = myDoneTasks.filter(t => t.taskType === 'team');

  if(team.length > 0) {
    reportText += "■ 전사 프로젝트 업무\n";
    team.forEach(t => { reportText += "- [" + (t.project||'공통') + "] " + t.title + "\n"; });
    reportText += "\n";
  }

  if(personal.length > 0) {
    reportText += "■ 개인 할 일\n";
    personal.forEach(t => { reportText += "- " + t.title + "\n"; });
  }

  // 클립보드에 복사
  navigator.clipboard.writeText(reportText).then(function() {
    showToast("✅ 주간 보고서가 복사되었습니다! 메신저나 문서에 붙여넣기 하세요.");
  }).catch(function() {
    showToast("복사에 실패했습니다. 권한을 확인해주세요.");
  });
}

function markNotifAsRead(notifId, originalAction) {
  // 1. 로컬 스토리지에 저장 (서버 데이터까지 건드리지 않고 브라우저에서 즉시 사라지게 함)
  var readNotifs = JSON.parse(localStorage.getItem('read_notifs_' + USER.email)) || [];
  if(!readNotifs.includes(notifId)) {
    readNotifs.push(notifId);
    localStorage.setItem('read_notifs_' + USER.email, JSON.stringify(readNotifs));
  }
  
  // 2. 모달 닫기 및 알림 뱃지 갱신
  closeModal('notif-modal');
  refreshNotifBadge();
  updateBadges();

  // 3. 원래 하려던 행동(페이지 이동 등) 수행
  if(originalAction) originalAction();
}
// 🌟 브라우저 네이티브 알림 요청 및 실행
function sendNativeNotification(title, body) {
  if (!("Notification" in window)) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, { body: body, icon: 'https://i.imgur.com/gzXQ8nD.png' });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body: body, icon: 'https://i.imgur.com/gzXQ8nD.png' });
      }
    });
  }
}

// 읽은 사람 명단을 실시간으로 가져와서 출력
function renderWikiReaders(wikiId) {
  var el = document.getElementById('wiki-reader-list');
  if(!el) return;

  db.ref('wiki_reads').orderByChild('wikiId').equalTo(wikiId).once('value', function(snap) {
    var data = snap.val();
    if(!data) {
      el.innerHTML = '<p class="text-[10px] font-black text-gray-300 uppercase tracking-widest">아직 읽은 사람이 없습니다.</p>';
      return;
    }

    var readers = Object.values(data).sort((a, b) => b.at - a.at);
    
    el.innerHTML = `
      <p class="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-wider">읽은 사람 (${readers.length})</p>
      <div class="flex flex-wrap gap-2">
        ${readers.map(r => `
          <div class="flex items-center bg-gray-50 px-2.5 py-1 r12 border border-gray-100 shadow-sm" title="${fmtDT(r.at)}">
            <span class="text-[10px] font-bold text-gray-600">${r.userName}</span>
            <span class="text-[8px] text-gray-300 ml-1.5 font-normal">${fmtDT(r.at).split(' ')[0]}</span>
          </div>
        `).join('')}
      </div>
    `;
  });
}

function openCsvUploadModal() {
  renderModalRoot('csv-modal', `
    <div class="bg-white r35 modal-content max-w-sm p-10 text-center shadow-2xl fade-in">
      <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><i class="ri-file-excel-2-fill"></i></div>
      <h2 class="text-xl font-black mb-2">CSV 제품 일괄 업로드</h2>
      <p class="text-xs text-gray-400 mb-8 leading-relaxed">준비된 CSV 파일을 선택해주세요.<br>형식: 제품명,코드,분류,용량,형태,카테고리,원가,구입가,렌탈가,설명</p>
      <input type="file" id="csv-file-input" accept=".csv" class="hidden" onchange="handleCsvFile(this)">
      <label for="csv-file-input" class="w-full block bg-emerald-500 text-white py-4 r24 font-black cursor-pointer shadow-lg hover:bg-emerald-600 transition mb-3">파일 선택하기</label>
      <button onclick="closeModal('csv-modal')" class="text-sm font-bold text-gray-300">다음에 하기</button>
    </div>
  `);
  openModal('csv-modal');
}

function handleCsvFile(input) {
  if(!input.files[0]) return;
  Papa.parse(input.files[0], {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const data = results.data;
      if(confirm(data.length + "개의 제품 데이터를 업데이트하시겠습니까?")) {
        data.forEach(row => {
          const id = genId();
          const obj = {
            id: id, name: row['제품명'], code: row['코드'], subType: row['분류'], 
            volume: row['용량'], shape: row['형태'], category: row['카테고리'] || '기타',
            price_origin: Number(row['원가']), price_buy: Number(row['구입가']), price_rent: Number(row['렌탈가']),
            description: row['설명'], creator: USER.email, timestamp: Date.now()
          };
          FB.set('products/' + id, obj);
          CACHE.products.push(obj);
        });
        showToast("✅ " + data.length + "개 제품 업로드 완료!");
        closeModal('csv-modal');
        renderProducts();
      }
    }
  });
}

// 🌟 뷰 전환 전용 함수 (이게 있어야 리스트/보드 전환이 됩니다)
function changeTeamView(mode) {
  teamTaskViewMode = mode;
  renderTeamProjectBoard();
}
// 🌟 공지사항 팝업 제어 (7일간 보지 않기 로직 포함)
function closeNoticeModal() {
  const isHideChecked = document.getElementById('hide-notice-week')?.checked;
  
  if (isHideChecked) {
    // 현재 시간 + 7일(ms 단위)을 계산하여 로컬 스토리지에 저장
    const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('hideNoticeUntil', expiry);
    showToast("🌙 일주일 동안 공지 팝업을 띄우지 않습니다.");
  }
  
  closeModal('global-notice-modal');
}

// 🌟 앱 시작 시(initApp 등) 호출하여 팝업을 띄울지 판단하는 로직
function checkAndShowNotice(content) {
  const hideUntil = localStorage.getItem('hideNoticeUntil');
  const now = Date.now();

  // 저장된 기한이 없거나, 기한이 지났을 때만 팝업을 띄움
  if (!hideUntil || now > parseInt(hideUntil)) {
    showNoticePopup(content); 
  }
}

// 끝