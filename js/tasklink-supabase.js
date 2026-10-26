(() => {
  const cfg = window.TASKLINK_SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.publishableKey) {
    window.TaskLinkDB = { error: new Error("Supabase client settings are unavailable.") };
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const api = {
    client,
    tasks: [],
    connected: false,
    error: null,
    async currentUser() {
      const { data, error } = await client.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") throw error;
      return data.user || null;
    },
    async ensureProfile(fullName, role, phone) {
      const { data, error } = await client.rpc("ensure_tasklink_profile", {
        p_full_name: fullName,
        p_role: role || "both",
        p_phone: phone || null
      });
      if (error) throw error;
      return data;
    },
    async signUp({ fullName, email, password, role, phone }) {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), role: role || "both" } }
      });
      if (error) throw error;
      if (data.session) await api.ensureProfile(fullName, role, phone);
      return data;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const meta = data.user.user_metadata || {};
      await api.ensureProfile(meta.full_name || null, meta.role || "both", null);
      return data;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getProfile() {
      const user = await api.currentUser();
      if (!user) return null;
      const { data, error } = await client.from("users")
        .select("user_id,auth_id,full_name,phone,email,role,skills,qualifications,bio,location_id")
        .eq("auth_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async updateProfile(profile) {
      const user = await api.currentUser();
      if (!user) throw new Error("Please sign in to update your profile.");
      const { data, error } = await client.from("users").update({
        full_name: profile.full_name,
        phone: profile.phone || null,
        bio: profile.bio || null,
        skills: profile.skills || null,
        location_id: profile.location_id || null
      }).eq("auth_id", user.id).select("user_id").single();
      if (error) throw error;
      return data;
    },
    async getCategories() {
      const { data, error } = await client.from("category").select("category_id,name").order("name");
      if (error) throw error;
      return data || [];
    },
    async getLocations() {
      const { data, error } = await client.from("location")
        .select("location_id,area,block_or_ward,city").order("city").order("area");
      if (error) throw error;
      return data || [];
    },
    async loadTasks() {
      const { data, error } = await client.from("job")
        .select("job_id,title,description,price_pula,job_type,status,posted_at,deadline,category:category(name),location:location(area,block_or_ward,city)")
        .eq("status", "open").order("posted_at", { ascending: false }).limit(100);
      if (error) { api.error = error; throw error; }
      api.tasks = (data || []).map(row => {
        const place = row.location || {};
        return {
          id: String(row.job_id),
          title: row.title || "Untitled task",
          description: row.description || "",
          category: row.category?.name || "Other",
          worktype: row.job_type || "On-site",
          location: [place.area, place.block_or_ward, place.city].filter(Boolean).join(", ") || "Botswana",
          city: place.city || "",
          budget: Number(row.price_pula || 0),
          deadline: row.deadline || "",
          createdAt: row.posted_at ? new Date(row.posted_at).getTime() : Date.now(),
          owner: "TaskLink member",
          sample: false,
          applications: 0,
          status: row.status
        };
      });
      api.connected = true;
      api.error = null;
      return api.tasks;
    },
    async getTask(jobId) {
      const { data, error } = await client.from("job")
        .select("job_id,title,description,price_pula,job_type,status,posted_at,deadline,category:category(name),location:location(area,block_or_ward,city)")
        .eq("job_id", Number(jobId)).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const place = data.location || {};
      return {
        id: String(data.job_id), title: data.title || "Untitled task",
        description: data.description || "", category: data.category?.name || "Other",
        worktype: data.job_type || "On-site",
        location: [place.area, place.block_or_ward, place.city].filter(Boolean).join(", ") || "Botswana",
        city: place.city || "", budget: Number(data.price_pula || 0), deadline: data.deadline || "",
        createdAt: data.posted_at ? new Date(data.posted_at).getTime() : Date.now(),
        owner: "TaskLink member", sample: false, applications: 0, status: data.status
      };
    },
    async createTask(task) {
      const user = await api.currentUser();
      if (!user) throw new Error("Please sign in to post a task.");
      const profile = await api.getProfile();
      const payload = {
        title: task.title,
        description: task.description,
        seeker_id: profile.user_id,
        category_id: Number(task.category_id),
        location_id: Number(task.location_id),
        price_pula: Number(task.price_pula),
        job_type: task.job_type,
        deadline: task.deadline || null,
        contact_preference: task.contact_preference || null
      };
      const { data, error } = await client.from("job").insert(payload).select("job_id").single();
      if (error) throw error;
      return data;
    },
    async getMyJobs(userId) {
      const { data, error } = await client.from("job")
        .select("job_id,title,description,price_pula,job_type,status,posted_at,deadline,category:category(name),location:location(area,block_or_ward,city)")
        .eq("seeker_id", userId).order("posted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async getMyApplications(userId) {
      const { data, error } = await client.from("application")
        .select("application_id,job_id,provider_id,proposed_price_pula,message,status,applied_at,job:job(title,status,seeker_id)")
        .eq("provider_id", userId).order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async getApplicationsForMyJobs(jobIds) {
      if (!jobIds.length) return [];
      const { data, error } = await client.from("application")
        .select("application_id,job_id,provider_id,proposed_price_pula,message,status,applied_at")
        .in("job_id", jobIds).order("applied_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async applyToJob(jobId, proposedPrice, message) {
      const profile = await api.getProfile();
      if (!profile) throw new Error("Please sign in to apply.");
      const { error } = await client.from("application").insert({
        job_id: Number(jobId),
        provider_id: profile.user_id,
        proposed_price_pula: Number(proposedPrice),
        message: message || null
      });
      if (error) throw error;
    },
    async respondToApplication(applicationId, action) {
      const { data, error } = await client.rpc("respond_to_task_application", {
        p_application_id: Number(applicationId),
        p_action: action
      });
      if (error) throw error;
      return data;
    },
    async setTaskStatus(jobId, status) {
      const { data, error } = await client.rpc("set_task_status", {
        p_job_id: Number(jobId),
        p_status: status
      });
      if (error) throw error;
      return data;
    },
    async getConversations() {
      const { data, error } = await client.rpc("tasklink_my_conversations");
      if (error) throw error;
      return data || [];
    },
    async getMessages(applicationId) {
      const { error: readError } = await client.rpc("tasklink_mark_messages_read", {
        p_application_id: Number(applicationId)
      });
      if (readError) throw readError;
      const { data, error } = await client.from("message")
        .select("message_id,application_id,sender_user_id,body,sent_at,read_at")
        .eq("application_id", Number(applicationId)).order("sent_at");
      if (error) throw error;
      return data || [];
    },
    async sendMessage(applicationId, body) {
      const profile = await api.getProfile();
      if (!profile) throw new Error("Please sign in to message.");
      const { error } = await client.from("message").insert({
        application_id: Number(applicationId),
        sender_user_id: profile.user_id,
        body: body.trim()
      });
      if (error) throw error;
    },
    async createReview(applicationId, reviewerId, revieweeId, rating, comment) {
      const { error } = await client.from("review").insert({
        application_id: Number(applicationId),
        reviewer_id: Number(reviewerId),
        reviewee_id: Number(revieweeId),
        rating: Number(rating),
        comment: comment || null
      });
      if (error) throw error;
    },
    async hasReview(applicationId, reviewerId) {
      const { data, error } = await client.from("review").select("review_id")
        .eq("application_id", Number(applicationId)).eq("reviewer_id", Number(reviewerId)).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getReviews(userId) {
      const { data, error } = await client.from("review")
        .select("review_id,reviewee_id,rating,comment,created_at")
        .eq("reviewee_id", Number(userId)).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  };
  window.TaskLinkDB = api;
})();
