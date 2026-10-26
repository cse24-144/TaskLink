(async () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));
  const money = value => "P" + Number(value || 0).toLocaleString("en-BW");
  const timeAgo = value => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(value || Date.now()).getTime()) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + " min ago";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    const days = Math.round(hours / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  };
  const dateLabel = value => value ? new Date(value + "T12:00:00").toLocaleDateString("en-BW", { day: "numeric", month: "short", year: "numeric" }) : "Flexible timing";
  const iconFor = value => String(value || "?").trim().charAt(0).toUpperCase();
  const toast = message => {
    const old = $(".toast");
    if (old) old.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.setAttribute("role", "status");
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  };
  const reportError = error => {
    console.error("TaskLink:", error);
    toast(error && error.message ? error.message : "Something went wrong. Please try again.");
  };
  const params = new URLSearchParams(location.search);
  const db = window.TaskLinkDB;
  if (!db || !db.client) {
    const status = $("#database-status");
    if (status) status.textContent = "Supabase client is unavailable. Check the site scripts and connection settings.";
    return;
  }

  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const menuToggle = $("[data-menu-toggle]");
  const nav = $("[data-main-nav]");
  if (menuToggle && nav) menuToggle.addEventListener("click", () => nav.classList.toggle("open"));

  let user = null;
  let profile = null;
  try {
    user = await db.currentUser();
    if (user) profile = await db.getProfile();
  } catch (error) {
    console.error("Could not load the signed-in TaskLink profile:", error);
  }

  const authLink = $(".nav-login");
  if (authLink && user) {
    authLink.textContent = profile ? profile.full_name : (user.email || "My account");
    authLink.href = "profile.html";
  }
  const authAction = $(".nav-actions .btn");
  if (authAction && user && authAction.textContent.toLowerCase().includes("join")) {
    authAction.textContent = "My dashboard";
    authAction.href = "dashboard.html";
  }

  const searchForm = $("[data-search-form]");
  if (searchForm) searchForm.addEventListener("submit", event => {
    event.preventDefault();
    const query = $('input[name="q"]', searchForm).value.trim();
    location.href = "browse.html" + (query ? "?q=" + encodeURIComponent(query) : "");
  });

  const results = $("#task-results");
  if (results) {
    const status = $("#database-status");
    const search = $("#task-search");
    const locationFilter = $("#task-location");
    const sort = $("#sort-tasks");
    try {
      const [tasks, categories, locations] = await Promise.all([db.loadTasks(), db.getCategories(), db.getLocations()]);
      if (status) status.textContent = "Showing live open tasks from the TaskLink database.";
      const categoryGroup = $$(".filter-group").find(group => $("h3", group)?.textContent.trim() === "Category");
      if (categoryGroup) {
        categoryGroup.innerHTML = "<h3>Category</h3>" + categories.map(category =>
          "<label><input type=\"checkbox\" name=\"category\" value=\"" + esc(category.name) + "\"> " + esc(category.name) + "</label>"
        ).join("");
      }
      const cities = [...new Set(locations.map(place => place.city).filter(Boolean))];
      if (locationFilter) {
        locationFilter.innerHTML = "<option value=\"\">All locations</option>" + cities.map(city =>
          "<option value=\"" + esc(city) + "\">" + esc(city) + "</option>"
        ).join("");
      }
      if (search) search.value = params.get("q") || "";
      const selected = name => $$('input[name="' + name + '"]:checked').map(input => input.value);
      const render = () => {
        const q = (search?.value || "").toLowerCase().trim();
        const selectedLocation = locationFilter?.value || "";
        const cats = selected("category");
        const types = selected("worktype");
        const min = Number($("#budget-min")?.value || 0);
        const max = Number($("#budget-max")?.value || Infinity);
        let filtered = tasks.filter(task => {
          const text = [task.title, task.description, task.category, task.location].join(" ").toLowerCase();
          return (!q || text.includes(q))
            && (!selectedLocation || task.city === selectedLocation)
            && (!cats.length || cats.includes(task.category))
            && (!types.length || types.includes(task.worktype))
            && Number(task.budget) >= min && Number(task.budget) <= max;
        });
        if (sort?.value === "budget-high") filtered.sort((a, b) => b.budget - a.budget);
        else if (sort?.value === "budget-low") filtered.sort((a, b) => a.budget - b.budget);
        $("#results-count").textContent = filtered.length + (filtered.length === 1 ? " task found" : " tasks found");
        $("#empty-results")?.classList.toggle("hidden", filtered.length > 0);
        results.innerHTML = filtered.map(task =>
          "<article class=\"task-card\"><div class=\"task-card-top\"><span class=\"task-card-icon\">" + iconFor(task.category) + "</span><div class=\"task-card-heading\"><h3>" + esc(task.title) + "</h3><div class=\"task-meta\"><span>" + esc(task.location) + "</span><span>" + esc(task.category) + "</span><span>" + esc(task.worktype) + "</span></div></div><div class=\"task-budget\">" + money(task.budget) + "</div></div><p class=\"task-card-desc\">" + esc(task.description.length > 190 ? task.description.slice(0, 187) + "…" : task.description) + "</p><div class=\"task-card-footer\"><div class=\"task-tags\"><span class=\"tag\">Posted " + timeAgo(task.createdAt) + "</span></div><div class=\"task-card-actions\"><a href=\"task-details.html?id=" + encodeURIComponent(task.id) + "\">View details</a><a class=\"btn btn-primary\" href=\"task-details.html?id=" + encodeURIComponent(task.id) + "\">View task</a></div></div></article>"
        ).join("");
      };
      $("#search-tasks")?.addEventListener("click", render);
      $("#apply-filters")?.addEventListener("click", render);
      search?.addEventListener("keydown", event => { if (event.key === "Enter") render(); });
      locationFilter?.addEventListener("change", render);
      sort?.addEventListener("change", render);
      $("#clear-filters")?.addEventListener("click", () => {
        if (search) search.value = "";
        if (locationFilter) locationFilter.value = "";
        $$('input[name="category"],input[name="worktype"]').forEach(input => input.checked = false);
        if ($("#budget-min")) $("#budget-min").value = "";
        if ($("#budget-max")) $("#budget-max").value = "";
        render();
      });
      $("#empty-clear")?.addEventListener("click", () => $("#clear-filters")?.click());
      render();
    } catch (error) {
      if (status) status.textContent = "Could not load live tasks: " + error.message;
      reportError(error);
    }
  }

  const postForm = $("#post-task-form");
  if (postForm) {
    try {
      const [categories, locations] = await Promise.all([db.getCategories(), db.getLocations()]);
      const categorySelect = $("#task-category");
      if (categorySelect) categorySelect.innerHTML = "<option value=\"\">Choose a category</option>" + categories.map(category =>
        "<option value=\"" + category.category_id + "\">" + esc(category.name) + "</option>"
      ).join("");
      const locationSelect = $("#task-location");
      const uniqueLocations = [];
      const seenCities = new Set();
      locations.forEach(place => {
        if (place.city && !seenCities.has(place.city)) {
          seenCities.add(place.city);
          uniqueLocations.push(place);
        }
      });
      if (locationSelect) locationSelect.innerHTML = "<option value=\"\">Choose a location</option>" + uniqueLocations.map(place =>
        "<option value=\"" + place.location_id + "\">" + esc(place.city) + "</option>"
      ).join("");
    } catch (error) { reportError(error); }
    postForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!postForm.reportValidity()) return;
      if (!user || !profile) {
        location.href = "login.html?next=" + encodeURIComponent("post-task.html");
        return;
      }
      const form = new FormData(postForm);
      try {
        const result = await db.createTask({
          title: String(form.get("title")).trim(),
          description: String(form.get("description")).trim(),
          category_id: form.get("category"),
          location_id: form.get("location"),
          price_pula: form.get("budget"),
          job_type: form.get("worktype"),
          deadline: form.get("deadline"),
          contact_preference: form.get("contact")
        });
        toast("Task posted to the TaskLink database.");
        setTimeout(() => location.href = "task-details.html?id=" + result.job_id, 500);
      } catch (error) { reportError(error); }
    });
  }

  const detail = $("#task-detail-content");
  if (detail) {
    try {
      const task = await db.getTask(params.get("id"));
      if (!task) {
        detail.innerHTML = "<section class=\"detail-main\"><h2>Task not found</h2><p class=\"detail-description\">This task may be closed or the link is incomplete.</p><a class=\"btn btn-primary\" href=\"browse.html\">Browse tasks</a></section>";
      } else {
        let owner = false;
        let applications = [];
        if (profile) {
          const myJobs = await db.getMyJobs(profile.user_id);
          owner = myJobs.some(job => String(job.job_id) === task.id);
          if (owner) applications = await db.getApplicationsForMyJobs([Number(task.id)]);
        }
        const applicantList = owner ? "<h2>Applications</h2>" + (applications.length ? applications.map(app =>
          "<article class=\"application-card\"><strong>" + esc(app.status) + "</strong><p>Provider #" + app.provider_id + " · Proposed " + money(app.proposed_price_pula) + "</p><p>" + esc(app.message || "No message included.") + "</p>" +
              (app.status === "pending" ? "<button class=\"btn btn-primary\" data-respond=\"accept\" data-app=\"" + app.application_id + "\">Accept</button> <button class=\"btn btn-outline\" data-respond=\"reject\" data-app=\"" + app.application_id + "\">Decline</button>" : "") +
          ((app.status === "pending" || app.status === "accepted") ? "<a class=\"btn btn-outline\" href=\"messages.html?application=" + app.application_id + "\">Message</a>" : "") + "</article>"
        ).join("") : "<p>No applications yet.</p>") : "";
        detail.innerHTML =
          "<section class=\"detail-main\"><a href=\"browse.html\" class=\"text-link\">Back to tasks</a><div class=\"detail-title-row\" style=\"margin-top:24px\"><span class=\"task-card-icon\">" + iconFor(task.category) + "</span><div><h1>" + esc(task.title) + "</h1><div class=\"task-meta\"><span>" + esc(task.location) + "</span><span>" + esc(task.category) + "</span><span>" + esc(task.worktype) + "</span></div></div></div><div class=\"detail-budget\">" + money(task.budget) + "</div><h2>About this task</h2><p class=\"detail-description\">" + esc(task.description) + "</p><h2>Timing</h2><p class=\"detail-description\">" + esc(dateLabel(task.deadline)) + "</p><div id=\"apply-feedback\"></div>" + applicantList + "</section>" +
          "<aside class=\"detail-sidebar\"><h3>Task summary</h3><div class=\"detail-info-row\"><span>Budget</span><strong>" + money(task.budget) + "</strong></div><div class=\"detail-info-row\"><span>Category</span><strong>" + esc(task.category) + "</strong></div><div class=\"detail-info-row\"><span>Location</span><strong>" + esc(task.location) + "</strong></div><div class=\"detail-info-row\"><span>Work type</span><strong>" + esc(task.worktype) + "</strong></div><div class=\"detail-info-row\"><span>Posted</span><strong>" + timeAgo(task.createdAt) + "</strong></div>" +
          (owner ? "<p>This is your task.</p>" : "<form id=\"apply-task-form\"><label class=\"field-label\" for=\"proposed-price\">Your proposed price (BWP)</label><input class=\"form-control\" id=\"proposed-price\" type=\"number\" min=\"0\" value=\"" + Number(task.budget) + "\" required><label class=\"field-label\" for=\"application-message\">Message</label><textarea class=\"form-control\" id=\"application-message\" rows=\"3\" maxlength=\"2000\" placeholder=\"Introduce yourself and explain how you would do the task.\"></textarea><button class=\"btn btn-primary btn-full\" type=\"submit\">Apply for this task</button></form>") +
          "<p class=\"demo-note\">Applications are shared with the task owner.</p></aside>";
        $("#apply-task-form")?.addEventListener("submit", async event => {
          event.preventDefault();
          if (!user || !profile) { location.href = "login.html?next=" + encodeURIComponent("task-details.html?id=" + task.id); return; }
          try {
            await db.applyToJob(task.id, $("#proposed-price").value, $("#application-message").value);
            toast("Your application was sent.");
            event.currentTarget.innerHTML = "<p>Your application was saved to the TaskLink database.</p>";
          } catch (error) { reportError(error); }
        });
        $$("[data-respond]").forEach(button => button.addEventListener("click", async () => {
          try {
            await db.respondToApplication(button.dataset.app, button.dataset.respond);
            toast(button.dataset.respond === "accept" ? "Application accepted." : "Application declined.");
            location.reload();
          } catch (error) { reportError(error); }
        }));
      }
    } catch (error) { detail.innerHTML = "<section class=\"detail-main\"><h2>Could not load this task</h2><p>" + esc(error.message) + "</p></section>"; }
  }

  const register = $("#register-form");
  if (register) register.addEventListener("submit", async event => {
    event.preventDefault();
    if (!register.reportValidity()) return;
    try {
      const data = await db.signUp({
        fullName: $("#register-name").value,
        email: $("#register-email").value,
        password: $("#register-password").value,
        role: $("#register-role").value
      });
      if (data.session) {
        toast("Your account is ready.");
        setTimeout(() => location.href = params.get("next") || "dashboard.html", 500);
      } else {
        toast("Check your email to confirm your account, then log in.");
        $("#register-form .notice-box").innerHTML = "<p>We sent a confirmation link to your email. Confirm it, then log in to finish setting up your profile.</p>";
      }
    } catch (error) { reportError(error); }
  });

  const login = $("#login-form");
  if (login) login.addEventListener("submit", async event => {
    event.preventDefault();
    if (!login.reportValidity()) return;
    try {
      await db.signIn($("#login-email").value, $("#login-password").value);
      toast("You are signed in.");
      setTimeout(() => location.href = params.get("next") || "dashboard.html", 500);
    } catch (error) { reportError(error); }
  });

  const profileForm = $("#profile-form");
  if (profileForm) {
    if (!user) {
      location.href = "login.html?next=" + encodeURIComponent("profile.html");
      return;
    }
    try {
      profile = await db.getProfile();
      const locations = await db.getLocations();
      const locationSelect = $("#profile-location");
      const unique = [];
      const seen = new Set();
      locations.forEach(place => {
        if (place.city && !seen.has(place.city)) { seen.add(place.city); unique.push(place); }
      });
      if (locationSelect) locationSelect.innerHTML = unique.map(place =>
        "<option value=\"" + place.location_id + "\">" + esc(place.city) + "</option>"
      ).join("");
      $("#profile-name").value = profile?.full_name || "";
      $("#profile-phone") && ($("#profile-phone").value = profile?.phone || "");
      $("#profile-role").value = profile?.role || "both";
      $("#profile-location").value = profile?.location_id || "";
      $("#profile-bio").value = profile?.bio || "";
      $("#profile-skills").value = profile?.skills || "";
      const updateDisplay = () => {
        const name = $("#profile-name").value.trim() || "TaskLink Member";
        $("#profile-display-name").textContent = name;
        $("#profile-display-role").textContent = ($("#profile-role").selectedOptions[0]?.textContent || "Member") + " · Botswana";
        $("#profile-avatar").textContent = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
      };
      profileForm.addEventListener("input", updateDisplay);
      updateDisplay();
      profileForm.addEventListener("submit", async event => {
        event.preventDefault();
        try {
          await db.updateProfile({
            full_name: $("#profile-name").value.trim(),
            phone: $("#profile-phone")?.value || "",
            location_id: $("#profile-location").value,
            bio: $("#profile-bio").value.trim(),
            skills: $("#profile-skills").value.trim()
          });
          toast("Profile saved.");
          updateDisplay();
        } catch (error) { reportError(error); }
      });
      $("#sign-out")?.addEventListener("click", async () => {
        try { await db.signOut(); location.href = "index.html"; } catch (error) { reportError(error); }
      });
      const reviews = await db.getReviews(profile.user_id);
      const reviewList = $("#profile-reviews");
      if (reviewList) reviewList.innerHTML = reviews.length ? reviews.map(review =>
        "<article><strong>" + review.rating + " / 5</strong><p>" + esc(review.comment || "") + "</p></article>"
      ).join("") : "<p>No reviews yet.</p>";
    } catch (error) { reportError(error); }
  }

  const dashboard = $("#dashboard-my-tasks");
  if (dashboard) {
    if (!user || !profile) {
      dashboard.innerHTML = "<p><a href=\"login.html?next=dashboard.html\">Log in</a> to see your dashboard.</p>";
    } else {
      try {
        const [myJobs, myApps, conversations] = await Promise.all([db.getMyJobs(profile.user_id), db.getMyApplications(profile.user_id), db.getConversations()]);
        const received = await db.getApplicationsForMyJobs(myJobs.map(job => job.job_id));
        $("#stat-posted").textContent = myJobs.length;
        $("#stat-applied").textContent = myApps.length;
        $("#stat-messages").textContent = conversations.length;
        $("#dashboard-welcome-name") && ($("#dashboard-welcome-name").textContent = profile.full_name);
        dashboard.innerHTML = myJobs.length ? myJobs.map(job => {
          const place = job.location || {};
          const where = [place.area, place.block_or_ward, place.city].filter(Boolean).join(", ");
          const apps = received.filter(app => app.job_id === job.job_id);
          return "<div class=\"my-task-row\"><span class=\"task-symbol blue-soft\">" + iconFor(job.category?.name) + "</span><div class=\"my-task-row-main\"><strong><a href=\"task-details.html?id=" + job.job_id + "\">" + esc(job.title) + "</a></strong><small>" + esc(where) + " · " + money(job.price_pula) + " · " + dateLabel(job.posted_at?.slice(0, 10)) + "</small></div><span class=\"task-state\">" + esc(job.status) + "</span>" +
            (job.status === "open" ? "<button class=\"text-button\" data-cancel-job=\"" + job.job_id + "\">Cancel</button>" : "") +
            (job.status === "in_progress" ? "<button class=\"text-button\" data-complete-job=\"" + job.job_id + "\">Mark complete</button>" : "") +
            (apps.length ? apps.map(app => "<div class=\"application-card\"><strong>Provider #" + app.provider_id + " · " + esc(app.status) + "</strong><p>Proposed " + money(app.proposed_price_pula) + "</p><p>" + esc(app.message || "") + "</p>" +
              (app.status === "pending" ? "<button class=\"btn btn-primary\" data-dashboard-respond=\"accept\" data-app=\"" + app.application_id + "\">Accept</button> <button class=\"btn btn-outline\" data-dashboard-respond=\"reject\" data-app=\"" + app.application_id + "\">Decline</button>" : "") +
              (job.status === "completed" && app.status === "accepted" ? "<button class=\"text-button\" data-review=\"" + app.application_id + "\" data-reviewee=\"" + app.provider_id + "\">Review provider</button>" : "") +
              ((app.status === "pending" || app.status === "accepted") ? "<a class=\"btn btn-outline\" href=\"messages.html?application=" + app.application_id + "\">Message</a>" : "") + "</div>"
            ).join("") : "<small>No applications yet.</small>") + "</div>";
        }).join("") : "<div class=\"empty-mini\">You haven’t posted any tasks yet. <a href=\"post-task.html\">Create your first task</a></div>";
        const appliedHost = $("#dashboard-my-applications");
        if (appliedHost) appliedHost.innerHTML = myApps.length ? myApps.map(app =>
          "<div class=\"my-task-row\"><div class=\"my-task-row-main\"><strong>" + esc(app.job?.title || "Task") + "</strong><small>" + esc(app.status) + " · proposed " + money(app.proposed_price_pula) + "</small></div>" + ((app.status === "pending" || app.status === "accepted") ? "<a class=\"btn btn-outline\" href=\"messages.html?application=" + app.application_id + "\">Messages</a>" : "") +
          (app.status === "pending" ? "<button class=\"text-button\" data-withdraw=\"" + app.application_id + "\">Withdraw</button>" : "") +
          (app.job?.status === "completed" && app.status === "accepted" ? "<button class=\"text-button\" data-review=\"" + app.application_id + "\" data-reviewee=\"" + app.job.seeker_id + "\">Review client</button>" : "") + "</div>"
        ).join("") : "<p>You haven’t applied to any tasks.</p>";

        $$("[data-dashboard-respond]").forEach(button => button.addEventListener("click", async () => {
          try { await db.respondToApplication(button.dataset.app, button.dataset.dashboardRespond); location.reload(); }
          catch (error) { reportError(error); }
        }));
        $$("[data-cancel-job],[data-complete-job]").forEach(button => button.addEventListener("click", async () => {
          const nextStatus = button.dataset.cancelJob ? "cancelled" : "completed";
          try { await db.setTaskStatus(button.dataset.cancelJob || button.dataset.completeJob, nextStatus); location.reload(); }
          catch (error) { reportError(error); }
        }));
        $$("[data-withdraw]").forEach(button => button.addEventListener("click", async () => {
          try { await db.respondToApplication(button.dataset.withdraw, "withdraw"); location.reload(); }
          catch (error) { reportError(error); }
        }));
        $$("[data-review]").forEach(button => button.addEventListener("click", async () => {
          try { if (await db.hasReview(button.dataset.review, profile.user_id)) { toast("You already reviewed this task participant."); button.remove(); return; } } catch (error) { reportError(error); return; }
          const applicationId = button.dataset.review;
          const revieweeId = button.dataset.reviewee;
          const rating = prompt("Rating from 1 to 5?");
          if (!rating) return;
          const comment = prompt("Optional comment") || "";
          try { await db.createReview(applicationId, profile.user_id, revieweeId, rating, comment); toast("Review saved."); button.remove(); }
          catch (error) { reportError(error); }
        }));
      } catch (error) { reportError(error); }
    }
  }

  const messagesHost = $(".conversation-list");
  const chatForm = $("#chat-form");
  if (messagesHost && chatForm) {
    if (!user || !profile) {
      messagesHost.innerHTML = "<p><a href=\"login.html?next=messages.html\">Log in</a> to see your conversations.</p>";
      chatForm.hidden = true;
    } else {
      try {
        const conversations = await db.getConversations();
        const selected = params.get("application") || String(conversations[0]?.application_id || "");
        messagesHost.innerHTML = "<div class=\"conversation-search\"><input id=\"conversation-search\" placeholder=\"Search conversations\"></div><div id=\"conversation-items\">" +
          (conversations.length ? conversations.map(conversation =>
            "<a class=\"conversation\" href=\"messages.html?application=" + conversation.application_id + "\"><span class=\"conversation-avatar avatar-blue\">" + iconFor(conversation.other_name) + "</span><span class=\"conversation-copy\"><strong>" + esc(conversation.other_name) + "</strong><small>About: " + esc(conversation.job_title) + "</small><em>" + esc(conversation.last_message || "Start the conversation") + "</em></span></a>"
          ).join("") : "<p>No conversations yet. Apply for a task or review its applications to begin messaging.</p>") + "</div>";
        $("#conversation-search")?.addEventListener("input", event => {
          $$("#conversation-items .conversation").forEach(item => item.classList.toggle("hidden", !item.textContent.toLowerCase().includes(event.target.value.toLowerCase())));
        });
        const active = conversations.find(item => String(item.application_id) === String(selected));
        if (!active) {
          $("#chat-name").textContent = "Your messages";
          $("#chat-body").innerHTML = "<p class=\"empty-mini\">Choose a conversation to view messages.</p>";
          chatForm.hidden = true;
        } else {
          $("#chat-name").textContent = active.other_name + " · " + active.job_title;
          $("#chat-avatar").textContent = iconFor(active.other_name);
          if (active.application_status !== "pending" && active.application_status !== "accepted") {
            chatForm.hidden = true;
            $(".chat-demo-note").textContent = "This application is closed. You can still read the conversation.";
          }
          const messages = await db.getMessages(active.application_id);
          $("#chat-body").innerHTML = messages.map(message =>
            "<div class=\"chat-message " + (message.sender_user_id === profile.user_id ? "sent" : "received") + "\">" + esc(message.body) + "<small>" + new Date(message.sent_at).toLocaleString() + "</small></div>"
          ).join("") || "<p class=\"empty-mini\">No messages yet. Say hello.</p>";
          $("#chat-body").scrollTop = $("#chat-body").scrollHeight;
          chatForm.addEventListener("submit", async event => {
            event.preventDefault();
            const input = $("#chat-input");
            if (!input.value.trim()) return;
            try { await db.sendMessage(active.application_id, input.value); location.reload(); }
            catch (error) { reportError(error); }
          });
        }
      } catch (error) { reportError(error); }
    }
  }
})();
