// =====================================================================
//  Glass Button Card
//  Konfigurierbare Button-Card im Glasstil mit visuellem Editor
// =====================================================================

const ACTIVE_STATES = [
  'on', 'open', 'home', 'playing', 'active', 'heat', 'cool', 'auto',
  'heat_cool', 'cleaning', 'returning', 'detected', 'unlocked', 'present',
];

class GlassButtonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._lastRenderKey = null;
  }

  setConfig(config) {
    if (!config) throw new Error('Keine Konfiguration angegeben');
    this._config = {
      design:         'glass',
      glow:           true,
      glow_intensity: 12,
      active_color:   '#ffd54f',
      icon:           'mdi:lightbulb',
      show_name:      true,
      show_state:     false,
      tap_action:     { action: 'toggle' },
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  // ----- Zustandslogik -------------------------------------------------
  _isActive() {
    if (!this._entityState()) return false;
    const state = this._entityState().state;
    return ACTIVE_STATES.includes(state);
  }

  _entityState() {
    if (!this._hass || !this._config.entity) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _currentIcon() {
    const active = this._isActive();
    if (active && this._config.icon_active) return this._config.icon_active;
    if (!active && this._config.icon_inactive) return this._config.icon_inactive;
    return this._config.icon || 'mdi:help-circle';
  }

  _displayState() {
    const st = this._entityState();
    if (!st) return '';
    // Übersetzte/formatierte Anzeige über HA-Formatierung wenn möglich
    const val = st.state;
    const unit = st.attributes.unit_of_measurement || '';
    return unit ? `${val} ${unit}` : val;
  }

  // ----- Aktionen ------------------------------------------------------
  _handleTap() {
    const action = this._config.tap_action || { action: 'toggle' };
    this._performAction(action);
  }

  _handleHold() {
    const action = this._config.hold_action;
    if (action) this._performAction(action);
  }

  _performAction(action) {
    switch (action.action) {
      case 'toggle':
        if (this._config.entity) {
          this._hass.callService('homeassistant', 'toggle', {
            entity_id: this._config.entity,
          });
        }
        break;
      case 'navigate':
        if (action.navigation_path) {
          history.pushState(null, '', action.navigation_path);
          this.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
        }
        break;
      case 'more-info':
        this._fireMoreInfo(action.entity || this._config.entity);
        break;
      case 'call-service':
      case 'perform-action': {
        const svc = action.service || action.perform_action;
        if (svc) {
          const [domain, service] = svc.split('.');
          this._hass.callService(domain, service, action.data || {}, action.target || {});
        }
        break;
      }
      case 'url':
        if (action.url_path) window.open(action.url_path, '_blank');
        break;
      case 'none':
      default:
        break;
    }
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const e = new Event('hass-more-info', { bubbles: true, composed: true });
    e.detail = { entityId };
    this.dispatchEvent(e);
  }

  // ----- Designs -------------------------------------------------------
  _designCSS(active, color, glow) {
    const glowCSS = (this._config.glow && active)
      ? `box-shadow: 0 0 ${glow}px ${this._hexToRgba(color, 0.4)};`
      : 'box-shadow: none;';

    const designs = {
      glass: `
        background: ${active ? this._hexToRgba(color, 0.15) : 'rgba(255,255,255,0.06)'};
        border: 1px solid ${active ? this._hexToRgba(color, 0.6) : 'rgba(255,255,255,0.15)'};
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        ${glowCSS}
      `,
      solid: `
        background: ${active ? this._hexToRgba(color, 0.9) : 'rgba(40,40,45,0.9)'};
        border: none;
        ${glowCSS}
      `,
      outline: `
        background: transparent;
        border: 2px solid ${active ? color : 'rgba(255,255,255,0.25)'};
        ${glowCSS}
      `,
      minimal: `
        background: ${active ? this._hexToRgba(color, 0.1) : 'transparent'};
        border: none;
        ${glowCSS}
      `,
    };
    return designs[this._config.design] || designs.glass;
  }

  _iconColor(active, color) {
    if (active) return color;
    return 'rgba(255,255,255,0.6)';
  }

  _iconGlow(active, color, glow) {
    if (this._config.glow && active) {
      return `filter: drop-shadow(0 0 ${Math.round(glow / 2)}px ${this._hexToRgba(color, 0.7)});`;
    }
    return '';
  }

  _hexToRgba(hex, alpha) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ----- Render --------------------------------------------------------
  _render() {
    if (!this.shadowRoot || !this._hass) return;

    const active = this._isActive();
    const color  = this._config.active_color || '#ffd54f';
    const glow   = this._config.glow_intensity || 12;
    const icon   = this._currentIcon();
    const name   = this._config.name
      || (this._entityState() && this._entityState().attributes.friendly_name)
      || '';
    const stateText = this._displayState();

    // Nur neu rendern wenn sich was geändert hat (Performance)
    const renderKey = `${active}|${icon}|${name}|${stateText}|${JSON.stringify(this._config)}`;
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;

    const showName  = this._config.show_name;
    const showState = this._config.show_state;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .btn {
          ${this._designCSS(active, color, glow)}
          border-radius: ${this._config.border_radius || 16}px;
          padding: ${this._config.height ? '0' : '14px 10px'};
          ${this._config.height ? `height:${this._config.height}px;` : ''}
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-sizing: border-box;
          user-select: none;
        }
        .btn:active { transform: scale(0.96); }
        ha-icon {
          --mdc-icon-size: ${this._config.icon_size || 24}px;
          color: ${this._iconColor(active, color)};
          ${this._iconGlow(active, color, glow)}
          transition: all 0.3s ease;
        }
        .name {
          font-size: ${this._config.name_size || 11}px;
          font-weight: 500;
          color: ${active ? this._hexToRgba(color, 0.95) : 'rgba(255,255,255,0.7)'};
          text-align: center;
          transition: color 0.3s ease;
        }
        .state {
          font-size: ${this._config.state_size || 12}px;
          font-weight: 600;
          color: ${active ? color : 'rgba(255,255,255,0.85)'};
          text-align: center;
          transition: color 0.3s ease;
        }
      </style>
      <div class="btn" id="btn">
        <ha-icon icon="${icon}"></ha-icon>
        ${showState && stateText ? `<span class="state">${stateText}</span>` : ''}
        ${showName && name ? `<span class="name">${name}</span>` : ''}
      </div>
    `;

    const btn = this.shadowRoot.getElementById('btn');
    let holdTimer = null;
    let held = false;

    btn.addEventListener('click', () => {
      if (held) { held = false; return; }
      this._handleTap();
    });

    if (this._config.hold_action) {
      const startHold = () => {
        held = false;
        holdTimer = setTimeout(() => { held = true; this._handleHold(); }, 500);
      };
      const cancelHold = () => clearTimeout(holdTimer);
      btn.addEventListener('mousedown', startHold);
      btn.addEventListener('touchstart', startHold, { passive: true });
      btn.addEventListener('mouseup', cancelHold);
      btn.addEventListener('mouseleave', cancelHold);
      btn.addEventListener('touchend', cancelHold);
    }
  }

  getCardSize() { return 1; }

  static getConfigElement() {
    return document.createElement('glass-button-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      design: 'glass',
      icon: 'mdi:lightbulb',
      glow: true,
      glow_intensity: 12,
      active_color: '#ffd54f',
      show_name: true,
      tap_action: { action: 'toggle' },
    };
  }
}

customElements.define('glass-button-card', GlassButtonCard);

// =====================================================================
//  Visueller Editor
// =====================================================================
class GlassButtonCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }

  _entities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states).sort();
  }

  _update(key, value) {
    this._config = { ...this._config, [key]: value };
    this._emit();
  }

  _updateAction(actionKey, subKey, value) {
    const action = { ...(this._config[actionKey] || {}), [subKey]: value };
    this._config = { ...this._config, [actionKey]: action };
    this._emit();
  }

  _setActionType(actionKey, type) {
    this._config = { ...this._config, [actionKey]: { action: type } };
    this._emit();
    this._render();
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this.shadowRoot) return;
    this._rendered = true;

    const c = this._config;
    const tapAction = (c.tap_action && c.tap_action.action) || 'toggle';
    const glowOn = c.glow !== false;

    const designs = [
      ['glass',   'Glas'],
      ['solid',   'Vollfläche'],
      ['outline', 'Umrandet'],
      ['minimal', 'Minimal'],
    ];
    const actions = [
      ['toggle',       'Ein-/Ausschalten'],
      ['navigate',     'Zu Seite navigieren'],
      ['more-info',    'Info-Fenster öffnen'],
      ['call-service', 'Dienst/Aktion auslösen'],
      ['url',          'Webseite öffnen'],
      ['none',         'Nichts'],
    ];

    this.shadowRoot.innerHTML = `
      <style>
        .editor { display:flex; flex-direction:column; gap:14px; padding:8px 0; }
        .field { display:flex; flex-direction:column; gap:5px; }
        .row { display:flex; gap:12px; }
        .row .field { flex:1; }
        label { font-size:13px; font-weight:500; color:var(--primary-text-color,#212121); }
        .hint { font-size:11px; color:var(--secondary-text-color,#727272); }
        input, select {
          padding:9px 11px; border-radius:8px;
          border:1px solid var(--divider-color,#e0e0e0);
          background:var(--card-background-color,#fff);
          color:var(--primary-text-color,#212121);
          font-size:14px; outline:none; box-sizing:border-box; width:100%;
        }
        input:focus, select:focus { border-color:var(--primary-color,#03a9f4); }
        input[type=color] { padding:4px; height:40px; cursor:pointer; }
        input[type=range] { padding:0; }
        .toggle-row { display:flex; align-items:center; justify-content:space-between; }
        .toggle-row label { flex:1; }
        .section {
          font-size:11px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.6px; color:var(--secondary-text-color,#727272);
          margin-top:6px; border-bottom:1px solid var(--divider-color,#e0e0e0);
          padding-bottom:4px;
        }
        .range-val { font-size:12px; color:var(--secondary-text-color,#727272); min-width:34px; text-align:right; }
        .range-wrap { display:flex; align-items:center; gap:8px; }
      </style>
      <div class="editor">

        <div class="section">Allgemein</div>

        <div class="field">
          <label>Entität</label>
          <input list="entityList" id="entity" value="${c.entity || ''}" placeholder="z.B. light.wohnzimmer" />
          <datalist id="entityList">
            ${this._entities().map(e => `<option value="${e}">`).join('')}
          </datalist>
          <span class="hint">Welche Entität steuert/zeigt dieser Button?</span>
        </div>

        <div class="field">
          <label>Name (optional)</label>
          <input id="name" value="${c.name || ''}" placeholder="Eigener Text" />
        </div>

        <div class="section">Aussehen</div>

        <div class="row">
          <div class="field">
            <label>Design</label>
            <select id="design">
              ${designs.map(([v, l]) => `<option value="${v}" ${(c.design||'glass')===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Aktiv-Farbe</label>
            <input type="color" id="active_color" value="${c.active_color || '#ffd54f'}" />
          </div>
        </div>

        <div class="toggle-row">
          <label>Leuchten wenn aktiv</label>
          <input type="checkbox" id="glow" ${glowOn ? 'checked' : ''} />
        </div>

        <div class="field" id="glowField" style="${glowOn ? '' : 'display:none'}">
          <label>Leuchtkraft</label>
          <div class="range-wrap">
            <input type="range" id="glow_intensity" min="0" max="40" step="1" value="${c.glow_intensity ?? 12}" />
            <span class="range-val" id="glowVal">${c.glow_intensity ?? 12}</span>
          </div>
        </div>

        <div class="section">Anzeige</div>

        <div class="toggle-row">
          <label>Name anzeigen</label>
          <input type="checkbox" id="show_name" ${c.show_name ? 'checked' : ''} />
        </div>
        <div class="toggle-row">
          <label>Zustand/Wert anzeigen</label>
          <input type="checkbox" id="show_state" ${c.show_state ? 'checked' : ''} />
        </div>

        <div class="section">Icons</div>

        <div class="field">
          <label>Icon (Standard)</label>
          <input id="icon" value="${c.icon || ''}" placeholder="mdi:lightbulb" />
        </div>
        <div class="field">
          <label>Icon wenn aktiv (optional)</label>
          <input id="icon_active" value="${c.icon_active || ''}" placeholder="mdi:lightbulb-on" />
          <span class="hint">Wird angezeigt wenn die Entität an/offen/aktiv ist</span>
        </div>

        <div class="section">Aktion bei Tippen</div>

        <div class="field">
          <label>Was soll passieren?</label>
          <select id="tap_type">
            ${actions.map(([v, l]) => `<option value="${v}" ${tapAction===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>

        ${tapAction === 'navigate' ? `
          <div class="field">
            <label>Navigationspfad</label>
            <input id="nav_path" value="${(c.tap_action && c.tap_action.navigation_path) || ''}" placeholder="/lovelace/wohnzimmer" />
          </div>` : ''}

        ${tapAction === 'call-service' ? `
          <div class="field">
            <label>Dienst</label>
            <input id="svc" value="${(c.tap_action && c.tap_action.service) || ''}" placeholder="script.mein_script" />
            <span class="hint">Format: domain.dienst (z.B. switch.toggle)</span>
          </div>` : ''}

        ${tapAction === 'url' ? `
          <div class="field">
            <label>URL</label>
            <input id="url_path" value="${(c.tap_action && c.tap_action.url_path) || ''}" placeholder="https://..." />
          </div>` : ''}

      </div>
    `;

    // Listener
    const bind = (id, key, ev = 'change', transform = v => v) => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener(ev, e => this._update(key, transform(e.target.value)));
    };

    bind('entity', 'entity', 'change');
    bind('name', 'name', 'change');
    bind('design', 'design', 'change');
    bind('active_color', 'active_color', 'change');
    bind('icon', 'icon', 'change');
    bind('icon_active', 'icon_active', 'change');

    const glowCb = this.shadowRoot.getElementById('glow');
    glowCb.addEventListener('change', e => {
      this._update('glow', e.target.checked);
      this._render();
    });

    const glowRange = this.shadowRoot.getElementById('glow_intensity');
    if (glowRange) {
      glowRange.addEventListener('input', e => {
        this.shadowRoot.getElementById('glowVal').textContent = e.target.value;
        this._update('glow_intensity', parseInt(e.target.value));
      });
    }

    this.shadowRoot.getElementById('show_name')
      .addEventListener('change', e => this._update('show_name', e.target.checked));
    this.shadowRoot.getElementById('show_state')
      .addEventListener('change', e => this._update('show_state', e.target.checked));

    this.shadowRoot.getElementById('tap_type')
      .addEventListener('change', e => this._setActionType('tap_action', e.target.value));

    const navPath = this.shadowRoot.getElementById('nav_path');
    if (navPath) navPath.addEventListener('change', e => this._updateAction('tap_action', 'navigation_path', e.target.value));
    const svc = this.shadowRoot.getElementById('svc');
    if (svc) svc.addEventListener('change', e => this._updateAction('tap_action', 'service', e.target.value));
    const urlPath = this.shadowRoot.getElementById('url_path');
    if (urlPath) urlPath.addEventListener('change', e => this._updateAction('tap_action', 'url_path', e.target.value));
  }
}

customElements.define('glass-button-card-editor', GlassButtonCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'glass-button-card',
  name:        'Glass Button Card',
  description: 'Konfigurierbarer Button im Glasstil – mit Leuchteffekt, Aktionen und zustandsabhängigen Icons',
  preview:     true,
  documentationURL: 'https://github.com/pquandel2-alt/glass-button-card',
});
