/* TaskLink frontend prototype. Uses localStorage only; not a production backend. */
(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORAGE = { tasks:"tasklink_tasks_v1", applied:"tasklink_applied_v1", profile:"tasklink_profile_v1", user:"tasklink_demo_user_v1", messages:"tasklink_messages_v1" };
  const read = (key, fallback) => { try { const v=JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => "P" + Number(n||0).toLocaleString("en-BW");
  const timeAgo = ts => { const m = Math.round((Date.now() - (ts || Date.now())) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago"); const d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago"); };
  const dateLabel = date => { if(!date) return "Flexible timing"; const d=new Date(date+"T12:00:00"); return Number.isNaN(+d)?date:d.toLocaleDateString("en-BW",{day:"numeric",month:"short",year:"numeric"}); };
  const iconFor = category => String(category || "?").trim().charAt(0).toUpperCase();
  const seedTasks = [
    {id:"sample-1",title:"Deep clean a two-bedroom flat",category:"Cleaning",description:"Looking for someone reliable to deep clean a two-bedroom flat before the weekend. Please bring your own cleaning supplies and share your availability.",location:"Gaborone",worktype:"On-site",budget:450,deadline:"",createdAt:Date.now()-1000*60*35,owner:"Demo client",sample:true,applications:3},
    {id:"sample-2",title:"Design a flyer for a small business",category:"Design",description:"I need a clean, modern promotional flyer for a local small business. Please include examples of previous design work if available.",location:"Remote",worktype:"Remote",budget:300,deadline:"",createdAt:Date.now()-1000*60*60*4,owner:"Demo client",sample:true,applications:5},
    {id:"sample-3",title:"Help move a sofa and a few boxes",category:"Moving",description:"Need a hand moving one sofa and several boxes across Gaborone. A vehicle would be helpful, but let me know what you can offer.",location:"Broadhurst",worktype:"On-site",budget:350,deadline:"",createdAt:Date.now()-1000*60*60*18,owner:"Demo client",sample:true,applications:2},
    {id:"sample-4",title:"Fix a leaking kitchen tap",category:"Plumbing",description:"Kitchen tap is leaking and may need a washer or replacement. Please provide an estimate and your earliest available time.",location:"Francistown",worktype:"On-site",budget:250,deadline:"",createdAt:Date.now()-1000*60*60*26,owner:"Demo client",sample:true,applications:1},
    {id:"sample-5",title:"Tutor a Form 4 student in maths",category:"Tutoring",description:"Looking for patient maths tutoring twice a week. Please mention your experience and whether you can meet in person or online.",location:"Gaborone",worktype:"On-site",budget:180,deadline:"",owner:"Demo client",createdAt:Date.now()-1000*60*60*48,sample:true,applications:4},
    {id:"sample-6",title:"Check a flickering light fitting",category:"Electrical",description:"One light fitting keeps flickering. Need a qualified person to inspect it and explain what needs fixing before any work begins.",location:"Palapye",worktype:"On-site",budget:400,deadline:"",owner:"Demo client",createdAt:Date.now()-1000*60*60*72,sample:true,applications:2},
    {id:"sample-7",title:"Prepare snacks for a small event",category:"Catering",description:"Looking for someone to prepare snacks for a small family gathering of around 25 people. Please share a simple menu and estimated cost.",location:"Maun",worktype:"On-site",budget:900,deadline:"",owner:"Demo client",createdAt:Date.now()-1000*60*60*96,sample:true,applications:2},
    {id:"sample-8",title:"Walk and feed two friendly dogs",category:"Pet",description:"Need someone to check in on two friendly dogs, feed them and take them for a short walk while I am away for the afternoon.",location:"Gaborone",worktype:"On-site",budget:120,deadline:"",owner:"Demo client",createdAt:Date.now()-1000*60*60*120,sample:true,applications:1}
  ];
  const getTasks = () => { const saved=read(STORAGE.tasks,[]); return [...saved,...seedTasks]; };
  const getTaskById = id => getTasks().find(t=>String(t.id)===String(id));
  const showToast = message => { let old=$(".toast"); if(old) old.remove(); const node=document.createElement("div"); node.className="toast"; node.setAttribute("role","status"); node.textContent=message; document.body.appendChild(node); setTimeout(()=>node.remove(),3500); };
  const params = new URLSearchParams(location.search);

  $$("[data-year]").forEach(el=>el.textContent=new Date().getFullYear());
  const menuToggle=$("[data-menu-toggle]"), nav=$("[data-main-nav]");
  if(menuToggle && nav) menuToggle.addEventListener("click",()=>nav.classList.toggle("open"));
  const searchForm=$("[data-search-form]");
  if(searchForm) searchForm.addEventListener("submit",e=>{e.preventDefault();const q=$('input[name="q"]',searchForm).value.trim();location.href="browse.html"+(q?"?q="+encodeURIComponent(q):"");});

  // Browse and filter tasks
  const resultsEl=$("#task-results");
  if(resultsEl){
    const search=$("#task-search"), loc=$("#task-location"), sort=$("#sort-tasks");
    if(search) search.value=params.get("q")||"";
    const selectedChecks = name => $$(`input[name="${name}"]:checked`).map(el=>el.value);
    const render = () => {
      const q=(search?.value||"").toLowerCase().trim(), locationFilter=loc?.value||"";
      const categories=selectedChecks("category"), types=selectedChecks("worktype");
      const min=Number($("#budget-min")?.value||0), max=Number($("#budget-max")?.value||Infinity);
      let tasks=getTasks().filter(t=>{
        const text=[t.title,t.description,t.category,t.location,t.owner].join(" ").toLowerCase();
        return (!q||text.includes(q))&&(!locationFilter||t.location===locationFilter||((locationFilter==="Gaborone")&&/gaborone|broadhurst|block|extension/i.test(t.location)))&&(!categories.length||categories.includes(t.category)||categories.some(c=>c==="Moving"&&t.category==="Moving & delivery")||categories.some(c=>c==="Pet"&&t.category==="Pet care")||categories.some(c=>c==="Design"&&t.category==="Design & digital"))&&(!types.length||types.includes(t.worktype))&&Number(t.budget)>=min&&Number(t.budget)<=max;
      });
      if(sort?.value==="budget-high") tasks.sort((a,b)=>b.budget-a.budget);
      else if(sort?.value==="budget-low") tasks.sort((a,b)=>a.budget-b.budget);
      else tasks.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      $("#results-count").textContent=`${tasks.length} ${tasks.length===1?"task":"tasks"} found`;
      $("#empty-results")?.classList.toggle("hidden",tasks.length>0);
      resultsEl.innerHTML=tasks.map(t=>`<article class="task-card"><div class="task-card-top"><span class="task-card-icon">${iconFor(t.category)}</span><div class="task-card-heading"><h3>${esc(t.title)}</h3><div class="task-meta"><span>${esc(t.location)}</span><span>${esc(t.category)}</span><span>${esc(t.worktype)}</span></div></div><div class="task-budget">${money(t.budget)}</div></div><p class="task-card-desc">${esc(t.description.length>190?t.description.slice(0,187)+"…":t.description)}</p><div class="task-card-footer"><div class="task-tags"><span class="tag">${t.sample?"Sample task":"Posted "+timeAgo(t.createdAt)}</span><span class="tag">${t.applications||0} responses</span></div><div class="task-card-actions"><a href="task-details.html?id=${encodeURIComponent(t.id)}">View details</a><a class="btn btn-primary" href="task-details.html?id=${encodeURIComponent(t.id)}">View task</a></div></div></article>`).join("");
    };
    $("#search-tasks")?.addEventListener("click",render); $("#apply-filters")?.addEventListener("click",render);
    search?.addEventListener("keydown",e=>{if(e.key==="Enter")render()}); loc?.addEventListener("change",render); sort?.addEventListener("change",render);
    $("#clear-filters")?.addEventListener("click",()=>{if(search)search.value="";if(loc)loc.value="";$$('input[name="category"],input[name="worktype"]').forEach(c=>c.checked=false);if($("#budget-min"))$("#budget-min").value="";if($("#budget-max"))$("#budget-max").value="";render();});
    $("#empty-clear")?.addEventListener("click",()=>$("#clear-filters")?.click());
    render();
  }

  // Create a task in local browser storage
  const postForm=$("#post-task-form");
  if(postForm) postForm.addEventListener("submit",e=>{
    e.preventDefault(); if(!postForm.reportValidity())return;
    const fd=new FormData(postForm), tasks=read(STORAGE.tasks,[]);
    const task={id:"task-"+Date.now(),title:String(fd.get("title")).trim(),description:String(fd.get("description")).trim(),category:String(fd.get("category")),worktype:String(fd.get("worktype")),location:String(fd.get("location")),budget:Number(fd.get("budget")),deadline:String(fd.get("deadline")||""),contact:String(fd.get("contact")||"TaskLink messages"),createdAt:Date.now(),owner:(read(STORAGE.profile,{name:"You"}).name||"You"),sample:false,applications:0};
    tasks.unshift(task);write(STORAGE.tasks,tasks);showToast("Task published on this browser!");setTimeout(()=>location.href="task-details.html?id="+encodeURIComponent(task.id),650);
  });

  // Task detail view and application simulation
  const detail=$("#task-detail-content");
  if(detail){
    const id=params.get("id"), task=id?getTaskById(id):null;
    if(!task){detail.innerHTML='<div class="detail-main"><h2>Task not found</h2><p class="detail-description">This task may have been removed or the link is incomplete.</p><a class="btn btn-primary" href="browse.html">Browse tasks</a></div>'; }
    else {
      const applied=read(STORAGE.applied,[]);
      detail.innerHTML=`<section class="detail-main"><a href="browse.html" class="text-link">Back to tasks</a><div class="detail-title-row" style="margin-top:24px"><span class="task-card-icon">${iconFor(task.category)}</span><div><h1>${esc(task.title)}</h1><div class="task-meta"><span>${esc(task.location)}</span><span>${esc(task.category)}</span><span>${esc(task.worktype)}</span></div></div></div><div class="detail-budget">${money(task.budget)}</div><span class="tag">${task.sample?"Sample task":"Community post"}</span><h2>About this task</h2><p class="detail-description">${esc(task.description)}</p><h2>Timing</h2><p class="detail-description">${task.deadline?`Preferred deadline: ${esc(dateLabel(task.deadline))}`:"Flexible timing — contact the client to discuss availability."}</p><h2>Before you apply</h2><p class="detail-description">Make sure you understand the task, agree on the scope and budget with the client, and keep communication respectful. Do not share sensitive personal or payment details with strangers.</p><div id="apply-feedback"></div></section><aside class="detail-sidebar"><h3>Task summary</h3><div class="detail-info-row"><span>Budget</span><strong>${money(task.budget)}</strong></div><div class="detail-info-row"><span>Category</span><strong>${esc(task.category)}</strong></div><div class="detail-info-row"><span>Location</span><strong>${esc(task.location)}</strong></div><div class="detail-info-row"><span>Work type</span><strong>${esc(task.worktype)}</strong></div><div class="detail-info-row"><span>Posted by</span><strong>${esc(task.owner||"TaskLink member")}</strong></div><div class="detail-info-row"><span>Responses</span><strong>${task.applications||0}</strong></div><button id="apply-task" class="btn btn-primary btn-full" ${applied.includes(task.id)?"disabled":""}>${applied.includes(task.id)?"Applied":"Apply for this task"}</button><a class="btn btn-outline btn-full" href="messages.html">Message</a><p class="demo-note">Application action is simulated in your browser. A real application system needs a backend.</p></aside>`;
      $("#apply-task")?.addEventListener("click",()=>{const list=read(STORAGE.applied,[]);if(!list.includes(task.id)){list.push(task.id);write(STORAGE.applied,list);const b=$("#apply-task");b.textContent="Applied";b.disabled=true;$("#apply-feedback").innerHTML='<div class="inline-alert">Application recorded in this browser demo. No client has been notified.</div>';showToast("Demo application saved.");}});
    }
  }

  // Dashboard
  if($("#dashboard-my-tasks")){
    const host=$("#dashboard-my-tasks");
    const draw=()=>{
      const my=read(STORAGE.tasks,[]), applied=read(STORAGE.applied,[]);
      $("#stat-posted").textContent=my.length;$("#stat-applied").textContent=applied.length;
      host.innerHTML=my.length?my.map(t=>`<div class="my-task-row"><span class="task-symbol blue-soft">${iconFor(t.category)}</span><div class="my-task-row-main"><strong><a href="task-details.html?id=${encodeURIComponent(t.id)}">${esc(t.title)}</a></strong><small>${esc(t.location)} · ${money(t.budget)} · ${dateLabel(new Date(t.createdAt).toISOString().slice(0,10))}</small></div><span class="task-state">Open</span><button class="text-button" type="button" data-remove="${esc(t.id)}">Remove</button></div>`).join(""):'<div class="empty-mini">You haven’t posted any tasks yet. <a href="post-task.html">Create your first task</a></div>';
    };
    host.addEventListener("click",e=>{
      const b=e.target.closest("[data-remove]"); if(!b) return;
      if(!confirm("Remove this task from this browser?")) return;
      write(STORAGE.tasks,read(STORAGE.tasks,[]).filter(t=>String(t.id)!==b.dataset.remove));
      showToast("Task removed."); draw();
    });
    draw();
  }

  // Profile form
  const profileForm=$("#profile-form");
  if(profileForm){
    const p=read(STORAGE.profile,{name:"TaskLink Member",role:"Both a client and provider",location:"Gaborone",bio:"",skills:""});
    ["name","role","location","bio","skills"].forEach(k=>{const el=$(`#profile-${k}`);if(el)el.value=p[k]||"";});
    const update=()=>{const name=$("#profile-name").value.trim()||"TaskLink Member";$("#profile-display-name").textContent=name;$("#profile-display-role").textContent=($("#profile-role").value||"Community member")+" · "+($("#profile-location").value||"Botswana");$("#profile-avatar").textContent=name.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();};
    profileForm.addEventListener("input",update);update();
    profileForm.addEventListener("submit",e=>{e.preventDefault();const data={name:$("#profile-name").value.trim(),role:$("#profile-role").value,location:$("#profile-location").value,bio:$("#profile-bio").value.trim(),skills:$("#profile-skills").value.trim()};write(STORAGE.profile,data);showToast("Profile saved in this browser.");update();});
  }

  // Demo registration/login — intentionally not secure authentication.
  const register=$("#register-form");
  if(register)register.addEventListener("submit",e=>{e.preventDefault();if(!register.reportValidity())return;const name=$("#register-name").value.trim(),email=$("#register-email").value.trim(),role=$("#register-role").value;write(STORAGE.user,{name,email,role});const p=read(STORAGE.profile,{});write(STORAGE.profile,{...p,name,role,location:p.location||"Gaborone",bio:p.bio||"",skills:p.skills||""});showToast("Demo account details saved.");setTimeout(()=>location.href="dashboard.html",700);});
  const login=$("#login-form");
  if(login)login.addEventListener("submit",e=>{e.preventDefault();if(!login.reportValidity())return;const email=$("#login-email").value.trim();const user=read(STORAGE.user,null);if(user&&user.email.toLowerCase()!==email.toLowerCase()){showToast("No matching demo account. Try the email used at registration.");return;}if(!user)write(STORAGE.user,{name:"TaskLink Member",email,role:"Both a client and provider"});showToast("Demo login complete.");setTimeout(()=>location.href="dashboard.html",700);});

  // Messaging demo with local-only conversation history.
  const chatForm=$("#chat-form");
  if(chatForm){
    const defaults={
      thato:[{type:"received",text:"Hi! I saw your task about the electrical repair. Can you share a little more detail?",time:"10:42"},{type:"sent",text:"Hello, thanks for reaching out. I need someone to check a light fitting that keeps flickering.",time:"10:45"},{type:"received",text:"No problem. I can take a look and let you know what needs to be done before starting.",time:"10:47"}],
      kago:[{type:"received",text:"Hello! I can help with the flyer design. Do you have brand colours or a logo?",time:"Yesterday"},{type:"sent",text:"I have a logo and would like something clean and easy to read.",time:"Yesterday"},{type:"received",text:"Great, I can have a draft ready tomorrow.",time:"Yesterday"}]
    };
    let current="thato";const saved=read(STORAGE.messages,{});
    const names={thato:{name:"Thato M.",avatar:"TM",cls:"avatar-blue"},kago:{name:"Kago B.",avatar:"KB",cls:"avatar-purple"}};
    const renderChat=()=>{const msgs=saved[current]||defaults[current];$("#chat-name").textContent=names[current].name;$("#chat-avatar").textContent=names[current].avatar;$("#chat-avatar").className="conversation-avatar "+names[current].cls;$("#chat-body").innerHTML='<div class="chat-date">Sample conversation</div>'+msgs.map(m=>`<div class="chat-message ${m.type==="sent"?"sent":"received"}">${esc(m.text)}<small>${esc(m.time||"Just now")}</small></div>`).join("");$("#chat-body").scrollTop=$("#chat-body").scrollHeight;$$(".conversation").forEach(b=>b.classList.toggle("active",b.dataset.conversation===current));};
    $$(".conversation").forEach(b=>b.addEventListener("click",()=>{current=b.dataset.conversation;renderChat();}));
    chatForm.addEventListener("submit",e=>{e.preventDefault();const input=$("#chat-input"),text=input.value.trim();if(!text)return;const msgs=saved[current]||(saved[current]=defaults[current].slice());msgs.push({type:"sent",text,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})});write(STORAGE.messages,saved);input.value="";renderChat();});
    $("#conversation-search")?.addEventListener("input",e=>{$$(".conversation").forEach(b=>b.classList.toggle("hidden",!b.textContent.toLowerCase().includes(e.target.value.toLowerCase())));});
    renderChat();
  }
})();
