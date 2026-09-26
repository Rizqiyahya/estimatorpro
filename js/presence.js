/* ============================================================
   EstimatorPro — Supabase Realtime Presence
   Shows signed-in users who currently have EstimatorPro open.
   Presence is ephemeral: it is never written to a database.
   ============================================================ */

const Presence = {
  _channel: null,
  _users: [],
  _userId: null,
  _member: null,
  _retryTimer: null,
  _retryCount: 0,
  _stopped: true,

  start(user) {
    if (!DB.isCloud() || !user || !DB._supabase) {
      this.stop();
      return;
    }
    // A joined channel for the same session is already tracking this user.
    if (this._channel && this._userId === user.id && this._channel.state === 'joined') return;
    this.stop();

    const name = (user.user_metadata?.name || '').trim() || (user.email || 'User').split('@')[0];
    this._member = { user_id: user.id, name, email: user.email || '', online_at: new Date().toISOString() };
    this._userId = user.id;
    this._stopped = false;
    // A signed-in user is online from the moment their application session
    // starts. Render this immediately; the realtime channel subsequently
    // synchronizes other visitors and reconnects if the network is delayed.
    this._mergeSelf();
    this._connect();
  },

  _connect() {
    if (this._stopped || !this._member || !DB._supabase) return;
    const member = this._member;
    try {
      this._channel = DB._supabase.channel('estimatorpro-online-users', {
        config: { presence: { key: member.user_id } }
      });
      this._channel
        .on('presence', { event: 'sync' }, () => this._sync())
        .on('presence', { event: 'join' }, () => this._sync())
        .on('presence', { event: 'leave' }, () => this._sync())
        .subscribe(async status => {
          if (this._stopped) return;
          if (status === 'SUBSCRIBED') {
            const result = await this._channel.track(member);
            if (result !== 'ok') {
              console.warn('Presence tracking failed:', result);
              this._scheduleRetry();
              return;
            }
            // Always show the signed-in visitor immediately. Some mobile browsers
            // delay the first server "sync" event even after track() succeeded.
            this._mergeSelf();
            this._retryCount = 0;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Presence channel status:', status);
            this._scheduleRetry();
          }
        });
    } catch (error) {
      console.warn('Presence unavailable:', error.message);
      this._scheduleRetry();
    }
  },

  _mergeSelf() {
    if (!this._member) return;
    const users = new Map(this._users.map(user => [user.user_id, user]));
    users.set(this._member.user_id, this._member);
    this._users = [...users.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
    this.render();
  },

  _sync() {
    if (!this._channel) return;
    const grouped = this._channel.presenceState();
    const users = new Map();
    Object.values(grouped).flat().forEach(member => {
      if (member?.user_id && !users.has(member.user_id)) users.set(member.user_id, member);
    });
    this._users = [...users.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id'));
    // Preserve the local visitor while its initial presence state is still
    // propagating. This prevents an incorrect "0 online" on mobile browsers.
    this._mergeSelf();
  },

  _scheduleRetry() {
    if (this._stopped || this._retryTimer) return;
    const delay = Math.min(30000, 1500 * (2 ** this._retryCount));
    this._retryCount += 1;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      if (this._stopped) return;
      if (this._channel && DB._supabase) DB._supabase.removeChannel(this._channel);
      this._channel = null;
      this._connect();
    }, delay);
  },

  stop() {
    this._stopped = true;
    clearTimeout(this._retryTimer);
    this._retryTimer = null;
    if (this._channel && DB._supabase) {
      this._channel.untrack().catch(() => {});
      DB._supabase.removeChannel(this._channel);
    }
    this._channel = null;
    this._userId = null;
    this._member = null;
    this._users = [];
    this._retryCount = 0;
    this.render();
  },

  initials(name) {
    return (name || 'User').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0]).join('').toUpperCase() || 'U';
  },

  color(name) {
    let hash = 0;
    for (const char of (name || '')) hash = ((hash << 5) - hash) + char.charCodeAt(0);
    return `hsl(${Math.abs(hash) % 360} 52% 42%)`;
  },

  render() {
    const button = document.getElementById('presenceButton');
    const count = document.getElementById('presenceCount');
    const avatars = document.getElementById('presenceAvatars');
    const popover = document.getElementById('presencePopover');
    if (!button || !count || !avatars || !popover) return;

    const total = this._users.length;
    button.hidden = !Auth.getUser() || !DB.isCloud();
    if (button.hidden) this.close();
    button.setAttribute('aria-label', `${total} pengguna sedang online`);
    count.textContent = `${total} online`;
    avatars.replaceChildren();

    this._users.slice(0, 4).forEach(user => {
      const avatar = document.createElement('span');
      avatar.className = 'presence-avatar';
      avatar.style.backgroundColor = this.color(user.name || user.email);
      avatar.textContent = this.initials(user.name || user.email);
      avatar.title = user.name || user.email || 'User';
      avatars.append(avatar);
    });
    if (total > 4) {
      const extra = document.createElement('span');
      extra.className = 'presence-avatar presence-extra';
      extra.textContent = `+${total - 4}`;
      avatars.append(extra);
    }

    popover.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'presence-popover-title';
    heading.textContent = total ? `Sedang online (${total})` : 'Belum ada pengguna online';
    popover.append(heading);

    this._users.forEach(user => {
      const row = document.createElement('div');
      row.className = 'presence-user';
      const avatar = document.createElement('span');
      avatar.className = 'presence-avatar presence-avatar-large';
      avatar.style.backgroundColor = this.color(user.name || user.email);
      avatar.textContent = this.initials(user.name || user.email);
      const details = document.createElement('div');
      details.className = 'presence-user-details';
      const name = document.createElement('div');
      name.className = 'presence-user-name';
      name.textContent = user.name || user.email || 'User';
      const status = document.createElement('div');
      status.className = 'presence-user-status';
      status.textContent = 'Online';
      details.append(name, status);
      row.append(avatar, details);
      popover.append(row);
    });
  },

  toggle() {
    const popover = document.getElementById('presencePopover');
    const button = document.getElementById('presenceButton');
    if (!popover || !button || button.hidden) return;
    const isOpen = popover.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
  },

  close() {
    const popover = document.getElementById('presencePopover');
    const button = document.getElementById('presenceButton');
    if (popover) popover.classList.remove('is-open');
    if (button) button.setAttribute('aria-expanded', 'false');
  }
};

// Auth and App use window.Presence because they may run independently of this
// script's lexical scope. Top-level `const` is not automatically a window
// property, so expose the service explicitly.
window.Presence = Presence;
