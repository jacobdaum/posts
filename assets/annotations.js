(() => {
  "use strict";

  const config = window.JACOB_ANNOTATIONS;
  const clientFactory = window.supabase && window.supabase.createClient;
  if (!config || !clientFactory) return;

  const db = clientFactory(config.url, config.publishableKey);
  const body = document.querySelector(".post-body");
  const panel = document.querySelector("#annotation-panel");
  const toggle = document.querySelector("#annotation-toggle");
  const close = document.querySelector("#annotation-close");
  const count = document.querySelector("#annotation-count");
  const sessionBox = document.querySelector("#annotation-session");
  const composer = document.querySelector("#annotation-composer");
  const quoteBox = document.querySelector("#annotation-quote");
  const commentBox = document.querySelector("#annotation-comment");
  const submitButton = document.querySelector("#annotation-submit");
  const cancelButton = document.querySelector("#annotation-cancel");
  const statusBox = document.querySelector("#annotation-status");
  const list = document.querySelector("#annotation-list");
  const moderation = document.querySelector("#annotation-moderation");
  const accountQueue = document.querySelector("#annotation-account-queue");

  if (!body || !panel || !toggle) return;

  const state = {
    user: null,
    profile: null,
    annotations: [],
    ranges: new Map(),
    pendingSelection: null,
    layerVisible: false,
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function setStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.style.color = isError ? "#8d2f24" : "";
  }

  function openPanel() {
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("annotations-open");
    state.layerVisible = true;
    renderHighlights();
  }

  function closePanel() {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("annotations-open");
    state.layerVisible = false;
    if (window.CSS?.highlights) CSS.highlights.delete("public-annotations");
  }

  function textMap() {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.parentElement?.closest("script, style, mjx-assistive-mml")) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      const start = text.length;
      text += node.nodeValue;
      nodes.push({ node, start, end: text.length });
    }
    return { text, nodes };
  }

  function globalOffset(map, node, offset) {
    const entry = map.nodes.find((item) => item.node === node);
    return entry ? entry.start + offset : null;
  }

  function rangeFromOffsets(map, start, end) {
    const first = map.nodes.find((item) => start >= item.start && start <= item.end);
    const last = [...map.nodes].reverse().find((item) => end >= item.start && end <= item.end);
    if (!first || !last || start >= end) return null;
    const range = document.createRange();
    range.setStart(first.node, Math.min(start - first.start, first.node.length));
    range.setEnd(last.node, Math.min(end - last.start, last.node.length));
    return range;
  }

  function locateAnnotation(annotation, map) {
    const savedStart = Number(annotation.start_offset);
    if (Number.isInteger(savedStart) && map.text.slice(savedStart, savedStart + annotation.quote.length) === annotation.quote) {
      return { start: savedStart, end: savedStart + annotation.quote.length };
    }

    const matches = [];
    let index = map.text.indexOf(annotation.quote);
    while (index !== -1) {
      const before = map.text.slice(Math.max(0, index - annotation.prefix.length), index);
      const after = map.text.slice(index + annotation.quote.length, index + annotation.quote.length + annotation.suffix.length);
      let score = 0;
      if (before.endsWith(annotation.prefix)) score += 1;
      if (after.startsWith(annotation.suffix)) score += 1;
      matches.push({ start: index, end: index + annotation.quote.length, score });
      index = map.text.indexOf(annotation.quote, index + 1);
    }
    matches.sort((a, b) => b.score - a.score);
    return matches[0] || null;
  }

  function renderHighlights() {
    state.ranges.clear();
    if (!window.CSS || !CSS.highlights || !window.Highlight) return;
    if (!state.layerVisible) {
      CSS.highlights.delete("public-annotations");
      return;
    }
    const map = textMap();
    const ranges = [];
    for (const annotation of state.annotations) {
      const location = locateAnnotation(annotation, map);
      if (!location) continue;
      const range = rangeFromOffsets(map, location.start, location.end);
      if (!range) continue;
      ranges.push(range);
      state.ranges.set(annotation.id, range);
    }
    CSS.highlights.set("public-annotations", new Highlight(...ranges));
  }

  function renderAnnotations() {
    count.textContent = state.annotations.length;
    list.innerHTML = state.annotations.length
      ? state.annotations.map((annotation) => `
          <article class="annotation-card" data-annotation-id="${annotation.id}" tabindex="0">
            <blockquote>${escapeHtml(annotation.quote)}</blockquote>
            <p>${escapeHtml(annotation.comment)}</p>
            <p class="annotation-byline">${escapeHtml(annotation.profiles?.username || "reader")}</p>
            ${state.profile?.moderator ? `<button class="annotation-secondary annotation-remove" data-note-action="rejected" data-id="${annotation.id}" type="button">Take down</button>` : ""}
          </article>`).join("")
      : '<p class="annotation-status">No public annotations yet.</p>';
    renderHighlights();
  }

  async function loadAnnotations() {
    const { data, error } = await db
      .from("annotations")
      .select("id,user_id,quote,prefix,suffix,start_offset,end_offset,comment,created_at,profiles(username)")
      .eq("page_path", config.pagePath)
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    if (error) {
      setStatus("The annotation layer could not be loaded.", true);
      return;
    }
    state.annotations = data || [];
    renderAnnotations();
  }

  function renderSession() {
    if (!state.user) {
      sessionBox.innerHTML = `
        <form class="annotation-auth" id="annotation-login-form">
          <p class="annotation-account-state">Reader accounts are invitation-only.</p>
          <label for="annotation-email">Email</label>
          <input id="annotation-email" type="email" autocomplete="email" required placeholder="you@example.com">
          <label for="annotation-password">Password</label>
          <input id="annotation-password" type="password" autocomplete="current-password" minlength="8" required>
          <div class="annotation-actions">
            <button class="annotation-primary" type="submit">Sign in</button>
          </div>
        </form>`;
      return;
    }

    if (!state.profile?.username) {
      sessionBox.innerHTML = `
        <form class="annotation-auth" id="annotation-username-form">
          <p class="annotation-account-state">Signed in as ${escapeHtml(state.user.email)}. Choose the name that will appear beside your notes.</p>
          <label for="annotation-username">Username</label>
          <input id="annotation-username" minlength="2" maxlength="32" pattern="[A-Za-z0-9_-]+" required placeholder="reader-name">
          <button class="annotation-primary" type="submit">Request access</button>
        </form>`;
      return;
    }

    if (state.profile.approved && !state.profile.password_set) {
      sessionBox.innerHTML = `
        <form class="annotation-auth" id="annotation-password-form">
          <p class="annotation-account-state">Welcome, @${escapeHtml(state.profile.username)}. Choose the password you will use here.</p>
          <label for="annotation-new-password">New password</label>
          <input id="annotation-new-password" type="password" autocomplete="new-password" minlength="8" required>
          <button class="annotation-primary" type="submit">Set password</button>
        </form>`;
      return;
    }

    const access = state.profile.approved
      ? "You may select text and publish notes."
      : state.profile.denied
        ? "This account request was not approved."
        : "Your account is waiting for Jacob’s approval.";
    sessionBox.innerHTML = `
      <p class="annotation-account-state"><strong>@${escapeHtml(state.profile.username)}</strong><br>${access}</p>
      <div class="annotation-session-row"><button class="annotation-secondary" id="annotation-signout" type="button">Sign out</button></div>`;
  }

  async function loadProfile() {
    if (!state.user) {
      state.profile = null;
      renderSession();
      moderation.hidden = true;
      return;
    }
    const { data, error } = await db.from("profiles").select("id,username,approved,denied,moderator,password_set").eq("id", state.user.id).single();
    if (error) {
      setStatus("Your reader profile could not be loaded.", true);
      return;
    }
    state.profile = data;
    renderSession();
    renderAnnotations();
    if (data.moderator) await loadModeration();
  }

  async function loadModeration() {
    moderation.hidden = false;
    accountQueue.innerHTML = `
      <form class="annotation-auth" id="annotation-invite-form">
        <p class="annotation-account-state">Only people you invite can create reader accounts.</p>
        <label for="annotation-invite-email">Friend’s email</label>
        <input id="annotation-invite-email" type="email" required placeholder="friend@example.com">
        <label for="annotation-invite-username">Username</label>
        <input id="annotation-invite-username" minlength="2" maxlength="32" pattern="[A-Za-z0-9_-]+" required placeholder="reader-name">
        <button class="annotation-primary" type="submit">Send invitation</button>
      </form>`;
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer)) return;
    const quote = selection.toString().trim();
    if (quote.length < 2 || quote.length > 1000) {
      setStatus("Select between 2 and 1,000 characters.", true);
      return;
    }
    const map = textMap();
    const start = globalOffset(map, range.startContainer, range.startOffset);
    const end = globalOffset(map, range.endContainer, range.endOffset);
    if (start === null || end === null) return;
    state.pendingSelection = {
      quote,
      prefix: map.text.slice(Math.max(0, start - 48), start),
      suffix: map.text.slice(end, end + 48),
      start_offset: start,
      end_offset: end,
    };
    quoteBox.textContent = quote;
    commentBox.value = "";
    composer.hidden = !(state.profile && state.profile.approved && state.profile.password_set);
    openPanel();
    if (!state.user) setStatus("Sign in first; your selection will stay ready.");
    else if (!state.profile?.approved) setStatus("This account is not approved.");
    else if (!state.profile?.password_set) setStatus("Set your password before publishing a note.");
    else {
      setStatus("");
      commentBox.focus();
    }
  }

  async function submitAnnotation() {
    const comment = commentBox.value.trim();
    if (!comment || !state.pendingSelection || !state.profile?.approved || !state.profile?.password_set) return;
    submitButton.disabled = true;
    const { error } = await db.from("annotations").insert({
      user_id: state.user.id,
      page_path: config.pagePath,
      page_title: config.pageTitle,
      ...state.pendingSelection,
      comment,
    });
    submitButton.disabled = false;
    if (error) {
      setStatus(error.message, true);
      return;
    }
    composer.hidden = true;
    state.pendingSelection = null;
    window.getSelection()?.removeAllRanges();
    setStatus("Published.");
    await loadAnnotations();
  }

  async function init() {
    if (!window.MathJax?.startup?.promise) {
      await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
    }
    if (window.MathJax?.startup?.promise) {
      try {
        await window.MathJax.startup.promise;
      } catch (_error) {
        // Annotations on prose should remain available if one equation fails.
      }
    }
    const { data } = await db.auth.getUser();
    state.user = data.user;
    await Promise.all([loadAnnotations(), loadProfile()]);
  }

  toggle.addEventListener("click", () => panel.classList.contains("is-open") ? closePanel() : openPanel());
  close.addEventListener("click", closePanel);
  cancelButton.addEventListener("click", () => {
    composer.hidden = true;
    state.pendingSelection = null;
    window.getSelection()?.removeAllRanges();
  });
  submitButton.addEventListener("click", submitAnnotation);
  body.addEventListener("mouseup", () => setTimeout(captureSelection, 0));
  body.addEventListener("touchend", () => setTimeout(captureSelection, 80));
  body.addEventListener("click", (event) => {
    if (!state.layerVisible || window.getSelection()?.toString()) return;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const fallback = !point ? document.caretRangeFromPoint?.(event.clientX, event.clientY) : null;
    const node = point?.offsetNode || fallback?.startContainer;
    const offset = point?.offset ?? fallback?.startOffset;
    if (!node || offset === undefined) return;
    for (const [id, range] of state.ranges) {
      if (!range.isPointInRange(node, offset)) continue;
      list.querySelector(`[data-annotation-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }
  });

  sessionBox.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "annotation-login-form") {
      const email = event.target.querySelector("#annotation-email").value;
      const password = event.target.querySelector("#annotation-password").value;
      const { error } = await db.auth.signInWithPassword({ email, password });
      setStatus(error ? error.message : "Signed in.", Boolean(error));
    }
    if (event.target.id === "annotation-username-form") {
      const username = event.target.querySelector("#annotation-username").value;
      const { error } = await db.rpc("set_my_username", { new_username: username });
      if (error) setStatus(error.message, true);
      else {
        setStatus("Access requested. Jacob can now approve your account.");
        await loadProfile();
      }
    }
    if (event.target.id === "annotation-password-form") {
      const password = event.target.querySelector("#annotation-new-password").value;
      const passwordResult = await db.auth.updateUser({ password });
      if (passwordResult.error) {
        setStatus(passwordResult.error.message, true);
        return;
      }
      const { error } = await db.rpc("mark_password_set");
      if (error) setStatus(error.message, true);
      else {
        setStatus("Password saved. You can now publish notes.");
        await loadProfile();
      }
    }
  });

  sessionBox.addEventListener("click", async (event) => {
    if (event.target.id !== "annotation-signout") return;
    await db.auth.signOut();
    state.user = null;
    state.profile = null;
    renderSession();
    moderation.hidden = true;
  });

  list.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-note-action]");
    if (remove) {
      event.stopPropagation();
      db.rpc("moderate_annotation", { target_id: remove.dataset.id, new_status: remove.dataset.noteAction })
        .then(async ({ error }) => {
          if (error) setStatus(error.message, true);
          else {
            setStatus("Annotation taken down.");
            await loadAnnotations();
          }
        });
      return;
    }
    const card = event.target.closest("[data-annotation-id]");
    if (!card) return;
    const range = state.ranges.get(card.dataset.annotationId);
    range?.startContainer.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-annotation-id]");
    if (!card) return;
    event.preventDefault();
    const range = state.ranges.get(card.dataset.annotationId);
    range?.startContainer.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  moderation.addEventListener("submit", async (event) => {
    if (event.target.id !== "annotation-invite-form") return;
    event.preventDefault();
    const email = event.target.querySelector("#annotation-invite-email").value;
    const username = event.target.querySelector("#annotation-invite-username").value;
    const { error } = await db.functions.invoke("invite-reader", {
      body: { email, username, redirectTo: window.location.href.split("#")[0] },
    });
    if (error) setStatus(error.message, true);
    else {
      event.target.reset();
      setStatus(`Invitation sent to ${email}.`);
    }
  });

  db.auth.onAuthStateChange((_event, session) => {
    const nextUser = session?.user || null;
    if (nextUser?.id === state.user?.id) return;
    state.user = nextUser;
    setTimeout(loadProfile, 0);
  });

  init();
})();
