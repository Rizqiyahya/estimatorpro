/* ============================================================
   EstimatorPro — Supabase Realtime Presence
   Shows signed-in users who currently have EstimatorPro open.
   Presence is ephemeral: it is never written to a database.
   ============================================================ */

const Presence = {
  _channel: null,
  _users: [],
  _userId: null,

  start(user) {
    if (!DB.isCloud() || !user || !DB._supabase) {
      this.stop();
      return;
    }
    // Do not recreate an active channel for the same session. Recreating it
    // during initial page setup could cancel the just-started subscription.
    if (this._channel && this._userId === user.id) return;
    this.stop();

    const name = (user.user_metadata && user.user_metadata.name || '').trim()
      || (user.email || 'User').split('@')[0];
    const email = user.email || '';
    const channelName = 'estimatorpro-online-users';
    this._userId = user.id;

    try {
      this._channel = DB._supabase.channel(channelName, {
        config: { presence: { key: user.id } }
      });
      this._channel
        .on('presence', { event: 'sync' }, () => this._sync())
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !this._channel) return;
          const result = await this._channel.track({
            user_id: user.id,
            name,
            email,
            online_at: new Date().toISOString()
          });
          if (result !== 'ok') console.warn('Presence tracking failed:', result);
        });
    } catch (error) {
      console.warn('Presence unavailable:', error.message);
      this.stop();
    }
  },

  _sync() {
    if (!this._channel) return;
    const grouped = this._channel.presenceState();
    const users = new Map();
    Object.values(grouped).flat().forEach(member => {
      if (!member || !member.user_id || users.has(member.user_id)) return;
      users.set(member.user_id, member);
    });
    this._users = [...users.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'id')
    );
    this.render();
  },

  stop() {
    if (this._channel && DB._supabase) {
      this._channel.untrack().catch(() => {});
      DB._supabase.removeChannel(this._channel);
    }
    this._channel = null;
    this._userId = null;
    this._users = [];
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
