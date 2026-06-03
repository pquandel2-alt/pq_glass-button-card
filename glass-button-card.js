// =====================================================================
//  Glass Button Card v1.2.0
// =====================================================================

const ACTIVE_STATES = [
  'on','open','home','playing','active','heat','cool','auto',
  'heat_cool','cleaning','returning','detected','unlocked','present',
];

const STATE_MAP_DE = {
  on:'An', off:'Aus',
  open:'Offen', closed:'Geschlossen', opening:'Öffnet', closing:'Schließt',
  home:'Zuhause', not_home:'Abwesend',
  locked:'Verriegelt', unlocked:'Entriegelt',
  detected:'Erkannt', clear:'Frei',
  idle:'Bereit', playing:'Spielt', paused:'Pausiert', buffering:'Puffert',
  standby:'Standby',
  cleaning:'Reinigt', docked:'In Station', returning:'Kehrt zurück',
  error:'Fehler',
  heat:'Heizen', cool:'Kühlen', auto:'Auto', heat_cool:'Auto',
  dry:'Trocknen', fan_only:'Nur Lüfter',
  active:'Aktiv', inactive:'Inaktiv',
  unavailable:'Nicht verfügbar', unknown:'Unbekannt',
  charging:'Lädt', discharging:'Entlädt', full:'Voll',
  present:'Anwesend', absent:'Abwesend',
  armed_home:'Aktiv (Zuhause)', armed_away:'Aktiv (Abwesend)',
  armed_night:'Aktiv (Nacht)', disarmed:'Deaktiviert',
  triggered:'Ausgelöst', pending:'Verzögert', arming:'Wird aktiviert',
  wet:'Nass', moist:'Feucht',
};

// Standard-Icons pro Domain
const DOMAIN_ICONS = {
  light: 'mdi:lightbulb', switch: 'mdi:toggle-switch', sensor: 'mdi:eye',
  binary_sensor: 'mdi:radiobox-marked', climate: 'mdi:thermostat',
  cover: 'mdi:window-shutter', media_player: 'mdi:television',
  input_boolean: 'mdi:toggle-switch', script: 'mdi:script-text',
  automation: 'mdi:robot', vacuum: 'mdi:robot-vacuum',
  camera: 'mdi:camera', person: 'mdi:account', device_tracker: 'mdi:map-marker',
  todo: 'mdi:clipboard-list', weather: 'mdi:weather-partly-cloudy',
  input_select: 'mdi:form-select', input_number: 'mdi:numeric',
  input_text: 'mdi:form-textbox', timer: 'mdi:timer',
  alarm_control_panel: 'mdi:alarm-light', lock: 'mdi:lock',
  fan: 'mdi:fan', water_heater: 'mdi:water-boiler',
};

function getDomainIcon(entityId) {
  if (!entityId) return 'mdi:help-circle';
  const domain = entityId.split('.')[0];
  return DOMAIN_ICONS[domain] || 'mdi:help-circle';
}

function getEntityIcon(hass, entityId) {
  if (!hass || !entityId) return getDomainIcon(entityId);
  const st = hass.states[entityId];
  if (!st) return getDomainIcon(entityId);
  return st.attributes.icon || getDomainIcon(entityId);
}

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
      design: 'glass', glow: true, glow_intensity: 12,
      active_color: '#ffd54f',
      follow_theme: false,
      show_name: true, show_state: false,
      name_size: 11, state_size: 12,
      tap_action: { action: 'toggle' },
      ...config,
    };
  }

  set hass(hass) { this._hass = hass; this._render(); }

  _isActive() {
    const st = this._entityState();
    if (!st) return false;
    return ACTIVE_STATES.includes(st.state);
  }

  _isUnavailable() {
    const st = this._entityState();
    return st && (st.state === 'unavailable' || st.state === 'unknown');
  }

  _entityState() {
    if (!this._hass || !this._config.entity) return null;
    return this._hass.states[this._config.entity] || null;
  }

  _currentIcon() {
    const active = this._isActive();
    if (active && this._config.icon_active) return this._config.icon_active;
    if (!active && this._config.icon_inactive) return this._config.icon_inactive;
    return this._config.icon || getDomainIcon(this._config.entity);
  }

  _displayState() {
    const st = this._entityState();
    if (!st) return '';
    if (this._hass.formatEntityState) {
      try { const f = this._hass.formatEntityState(st); if (f) return f; } catch (_) {}
    }
    const val = st.state;
    const unit = st.attributes.unit_of_measurement || '';
    if (!isNaN(parseFloat(val)) && isFinite(val)) return unit ? `${val} ${unit}` : val;
    const t = STATE_MAP_DE[val.toLowerCase ? val.toLowerCase() : val];
    return unit ? `${t||val} ${unit}` : (t||val);
  }

  _handleTap() { this._performAction(this._config.tap_action || { action: 'toggle' }); }
  _handleHold() {
    const a = this._config.hold_action;
    if (a && a.action !== 'none') this._performAction(a);
  }

  _performAction(action) {
    switch (action.action) {
      case 'toggle':
        if (this._config.entity)
          this._hass.callService('homeassistant', 'toggle', { entity_id: this._config.entity });
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
    }
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const e = new Event('hass-more-info', { bubbles: true, composed: true });
    e.detail = { entityId };
    this.dispatchEvent(e);
  }

  _hexToRgba(hex, alpha) {
    if (!hex || hex.startsWith('rgb')) return hex || `rgba(255,255,255,${alpha})`;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0,2),16);
    const g = parseInt(h.substring(2,4),16);
    const b = parseInt(h.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _cardCSS(active, unavailable, color, glow) {
    const glowShadow = `0 0 ${glow}px ${this._hexToRgba(color, 0.3)}`;
    const d = this._config.design || 'glass';
    const opacity = unavailable ? 'opacity: 0.5;' : '';

    // Theme folgen: HA-Card-Variablen nutzen (Liquid Glass etc. greifen)
    if (this._config.follow_theme) {
      return `
        background: ${active ? this._hexToRgba(color, 0.15) : 'var(--ha-card-background, var(--card-background-color, rgba(255,255,255,0.05)))'};
        border: var(--ha-card-border-width, 1px) solid ${active ? this._hexToRgba(color, 0.6) : 'var(--ha-card-border-color, var(--divider-color, rgba(255,255,255,0.12)))'};
        box-shadow: ${active && this._config.glow ? glowShadow : 'var(--ha-card-box-shadow, none)'};
        backdrop-filter: var(--ha-card-backdrop-filter, none);
        -webkit-backdrop-filter: var(--ha-card-backdrop-filter, none);
        transition: all 0.3s ease;
        ${opacity}
      `;
    }

    switch (d) {
      case 'glass': return `
        background: ${active ? this._hexToRgba(color, 0.12) : 'rgba(255,255,255,0.06)'};
        border: 1px solid ${active ? this._hexToRgba(color, 0.6) : 'rgba(255,255,255,0.15)'};
        box-shadow: ${active && this._config.glow ? glowShadow : 'none'};
        transition: all 0.3s ease;
        ${opacity}
      `;
      case 'solid': return `
        background: ${active ? this._hexToRgba(color, 0.9) : 'rgba(40,40,45,0.95)'};
        border: none;
        box-shadow: ${active && this._config.glow ? glowShadow : 'none'};
        transition: all 0.3s ease;
        ${opacity}
      `;
      case 'outline': return `
        background: transparent;
        border: 2px solid ${active ? color : 'rgba(255,255,255,0.25)'};
        box-shadow: ${active && this._config.glow ? glowShadow : 'none'};
        transition: all 0.3s ease;
        ${opacity}
      `;
      case 'minimal': return `
        background: ${active ? this._hexToRgba(color, 0.1) : 'transparent'};
        border: none; box-shadow: none;
        transition: all 0.3s ease;
        ${opacity}
      `;
      default: return '';
    }
  }

  _iconCSS(active, color) {
    const d = this._config.design || 'glass';
    const glow = this._config.glow_intensity || 12;
    if (active) {
      const ds = `filter: drop-shadow(0 0 ${Math.round(glow/2)}px ${this._hexToRgba(color, 0.7)});`;
      if (this._config.follow_theme) return `color:${color}; ${ds}`;
      switch (d) {
        case 'glass':   return `color:${color}; ${ds}`;
        case 'solid':   return `color:white; ${ds}`;
        case 'outline': return `color:${color}; ${ds}`;
        case 'minimal': return `color:${color};`;
        default:        return `color:${color};`;
      }
    }
    if (this._config.follow_theme) {
      return `color:var(--state-icon-color, var(--primary-text-color, rgba(255,255,255,0.7))); filter:none;`;
    }
    switch (d) {
      case 'glass':   return `color:rgba(255,255,255,0.75); filter:none;`;
      case 'solid':   return `color:rgba(255,255,255,0.7); filter:none;`;
      case 'outline': return `color:rgba(255,255,255,0.5); filter:none;`;
      case 'minimal': return `color:rgba(255,255,255,0.5); filter:none;`;
      default:        return `color:rgba(255,255,255,0.6); filter:none;`;
    }
  }

  _render() {
    if (!this._hass) return;
    const active      = this._isActive();
    const unavailable = this._isUnavailable();
    const color       = this._config.active_color || '#ffd54f';
    const glow        = this._config.glow_intensity || 12;
    const icon        = this._currentIcon();
    const name        = this._config.name || (this._entityState()?.attributes.friendly_name) || '';
    const stateText   = this._displayState();
    const nameSize    = this._config.name_size  || 11;
    const stateSize   = this._config.state_size || 12;

    const renderKey = `${active}|${unavailable}|${icon}|${name}|${stateText}|${JSON.stringify(this._config)}`;
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;

    // Durchgestrichen wenn nicht verfügbar
    const strikeStyle = unavailable
      ? `position:relative; &::after { content:''; position:absolute; top:50%; left:10%; width:80%; height:2px; background:rgba(255,255,255,0.5); transform:rotate(-45deg); }`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          ${this._config.height ? `height:${this._config.height}px;` : ''}
        }
        .btn {
          ${this._cardCSS(active, unavailable, color, glow)}
          border-radius: ${this._config.border_radius || 16}px;
          padding: ${this._config.height ? '0' : '14px 10px'};
          ${this._config.height ? 'height:100%;' : ''}
          width: ${this._config.width ? `min(${this._config.width}px, 100%)` : '100%'};
          max-width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: ${unavailable ? 'not-allowed' : 'pointer'};
          box-sizing: border-box;
          user-select: none;
          position: relative;
        }
        .btn:active { transform: ${unavailable ? 'none' : 'scale(0.96)'}; }
        .icon-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        ha-icon {
          --mdc-icon-size: ${this._config.icon_size || 24}px;
          ${this._iconCSS(active, color)}
          transition: all 0.3s ease;
        }
        /* Durchgestrichene Linie bei unavailable */
        .strike-line {
          display: ${unavailable ? 'block' : 'none'};
          position: absolute;
          top: 50%; left: -2px; right: -2px;
          height: 2px;
          background: rgba(255,255,255,0.6);
          transform: rotate(-45deg);
          border-radius: 2px;
          pointer-events: none;
        }
        .name {
          font-size: ${nameSize}px;
          font-weight: 500;
          color: ${active
            ? this._hexToRgba(color, 0.95)
            : (this._config.follow_theme ? 'var(--primary-text-color, rgba(255,255,255,0.7))' : 'rgba(255,255,255,0.7)')};
          text-align: center;
          transition: color 0.3s ease;
          ${unavailable ? 'text-decoration: line-through; opacity: 0.6;' : ''}
        }
        .state {
          font-size: ${stateSize}px;
          font-weight: 600;
          color: ${active
            ? color
            : (this._config.follow_theme ? 'var(--secondary-text-color, rgba(255,255,255,0.85))' : 'rgba(255,255,255,0.85)')};
          text-align: center;
          transition: color 0.3s ease;
        }
      </style>
      <div class="btn" id="btn">
        <div class="icon-wrap">
          <ha-icon icon="${icon}"></ha-icon>
          <div class="strike-line"></div>
        </div>
        ${this._config.show_state && stateText ? `<span class="state">${stateText}</span>` : ''}
        ${this._config.show_name && name ? `<span class="name">${name}</span>` : ''}
      </div>
    `;

    const btn = this.shadowRoot.getElementById('btn');
    let holdTimer = null, held = false;

    btn.addEventListener('click', () => {
      if (unavailable || held) { held = false; return; }
      this._handleTap();
    });

    if (this._config.hold_action && this._config.hold_action.action !== 'none') {
      const start  = () => { held=false; holdTimer=setTimeout(()=>{held=true;this._handleHold();},500); };
      const cancel = () => clearTimeout(holdTimer);
      btn.addEventListener('mousedown', start);
      btn.addEventListener('touchstart', start, { passive:true });
      btn.addEventListener('mouseup', cancel);
      btn.addEventListener('mouseleave', cancel);
      btn.addEventListener('touchend', cancel);
    }
  }

  getCardSize() {
    const h = this._config?.height;
    if (h) return Math.max(1, Math.ceil(h / 50));
    return 2;
  }
  static getConfigElement() { return document.createElement('glass-button-card-editor'); }
  static getStubConfig() {
    return {
      entity: '', design: 'glass', icon: 'mdi:lightbulb', icon_active: '',
      glow: true, glow_intensity: 12, active_color: '#ffd54f',
      show_name: true, show_state: false, name_size: 11, state_size: 12,
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
    this._rendered = false;
  }

  setConfig(config) { this._config = { ...config }; this._render(); }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }

  _update(key, value) {
    this._config = { ...this._config, [key]: value };
    this._emit();
  }

  _updateAction(actionKey, subKey, value) {
    this._config = { ...this._config, [actionKey]: { ...(this._config[actionKey]||{}), [subKey]: value } };
    this._emit();
  }

  _setActionType(actionKey, type) {
    this._config = { ...this._config, [actionKey]: { action: type } };
    this._emit();
    this._render();
  }

  _emit() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }

  // ---- Entity Picker mit Icon + Friendly Name + Suche ----
  _buildEntityPicker(container, currentValue, onChange) {
    container.innerHTML = '';
    const hass = this._hass;
    const entities = hass ? Object.keys(hass.states) : [];

    // Sinnvolle Sortierung: bevorzugte Domains zuerst
    const preferred = ['light','switch','sensor','binary_sensor','climate','cover',
                       'media_player','input_boolean','vacuum','fan','lock','alarm_control_panel'];
    const sorted = [
      ...entities.filter(e => preferred.some(d => e.startsWith(d+'.'))),
      ...entities.filter(e => !preferred.some(d => e.startsWith(d+'.'))),
    ].sort((a,b) => {
      const da = preferred.findIndex(d => a.startsWith(d+'.'));
      const db = preferred.findIndex(d => b.startsWith(d+'.'));
      if (da !== db) return da - db;
      return a.localeCompare(b);
    });

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;align-items:center;gap:8px;border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;background:var(--card-background-color,#fff);padding:6px 11px;';

    // Icon der aktuell gewählten Entität
    const iconEl = document.createElement('ha-icon');
    iconEl.icon = getEntityIcon(hass, currentValue);
    iconEl.style.cssText = '--mdc-icon-size:20px;color:var(--secondary-text-color,#727272);flex-shrink:0;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Entität suchen (Name oder ID)…';
    input.style.cssText = 'flex:1;border:none;outline:none;background:transparent;color:var(--primary-text-color,#212121);font-size:14px;';

    // Zeige Friendly Name des aktuellen Werts
    if (currentValue && hass && hass.states[currentValue]) {
      const fn = hass.states[currentValue].attributes.friendly_name;
      input.value = fn || currentValue;
    } else {
      input.value = currentValue || '';
    }

    inputRow.appendChild(iconEl);
    inputRow.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:none;margin-top:2px;';

    const showDropdown = (filter='') => {
      dropdown.innerHTML = '';
      const lower = filter.toLowerCase().trim();
      const filtered = sorted.filter(e => {
        if (!lower) return true;
        const fn = (hass.states[e]?.attributes.friendly_name || '').toLowerCase();
        return fn.includes(lower) || e.toLowerCase().includes(lower);
      }).slice(0, 200);

      filtered.forEach(e => {
        const fn = hass.states[e]?.attributes.friendly_name || '';
        const entityIcon = getEntityIcon(hass, e);
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--divider-color,#f0f0f0);';

        const itemIcon = document.createElement('ha-icon');
        itemIcon.icon = entityIcon;
        itemIcon.style.cssText = '--mdc-icon-size:18px;color:var(--secondary-text-color,#727272);flex-shrink:0;';

        const textDiv = document.createElement('div');
        textDiv.innerHTML = `<div style="font-size:13px;font-weight:500;color:var(--primary-text-color,#212121)">${fn||e}</div><div style="font-size:11px;color:var(--secondary-text-color,#727272)">${e}</div>`;

        item.appendChild(itemIcon);
        item.appendChild(textDiv);

        item.addEventListener('mousedown', ev => {
          ev.preventDefault();
          input.value = fn || e;
          iconEl.icon = entityIcon;
          dropdown.style.display = 'none';
          onChange(e);
        });
        item.addEventListener('mouseover', () => item.style.background = 'var(--secondary-background-color,#f5f5f5)');
        item.addEventListener('mouseout',  () => item.style.background = '');
        dropdown.appendChild(item);
      });
      dropdown.style.display = filtered.length ? 'block' : 'none';
    };

    input.addEventListener('focus', () => showDropdown(input.value));
    input.addEventListener('input', () => showDropdown(input.value));
    input.addEventListener('blur',  () => setTimeout(() => { dropdown.style.display='none'; }, 150));

    wrapper.appendChild(inputRow);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);
  }

  // ---- Icon Picker ----
  _buildIconPicker(container, label, currentValue, onChange) {
    container.innerHTML = '';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:13px;font-weight:500;color:var(--primary-text-color,#212121);margin-bottom:5px;display:block;';
    lbl.textContent = label;
    container.appendChild(lbl);

    const isReal = customElements.get('ha-icon-picker') !== undefined;
    if (isReal) {
      const ip = document.createElement('ha-icon-picker');
      ip.value = currentValue;
      ip.addEventListener('value-changed', e => onChange(e.detail.value));
      container.appendChild(ip);
    } else {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';
      const preview = document.createElement('ha-icon');
      preview.icon = currentValue || 'mdi:help-circle';
      preview.style.cssText = '--mdc-icon-size:24px;color:var(--secondary-text-color,#727272);flex-shrink:0;';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = currentValue || '';
      inp.placeholder = 'mdi:lightbulb';
      inp.style.cssText = 'flex:1;padding:9px 11px;border-radius:8px;border:1px solid var(--divider-color,#e0e0e0);background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);font-size:14px;outline:none;';
      inp.addEventListener('input', e => { preview.icon = e.target.value || 'mdi:help-circle'; });
      inp.addEventListener('change', e => onChange(e.target.value));
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:var(--secondary-text-color,#727272);margin-top:4px;';
      hint.textContent = 'Alle Icons: materialdesignicons.com';
      row.appendChild(preview);
      row.appendChild(inp);
      container.appendChild(row);
      container.appendChild(hint);
    }
  }

  _render() {
    this._rendered = true;
    const root = this.shadowRoot;
    const c = this._config;
    const tapAction  = c.tap_action?.action  || 'toggle';
    const holdAction = c.hold_action?.action || 'none';
    const glowOn = c.glow !== false;

    const designs = [['glass','Glas'],['solid','Vollfläche'],['outline','Umrandet'],['minimal','Minimal']];
    const actions = [
      ['toggle','Ein-/Ausschalten'],['navigate','Zu Seite navigieren'],
      ['more-info','Info-Fenster öffnen'],['call-service','Dienst auslösen'],
      ['url','Webseite öffnen'],['none','Nichts'],
    ];

    root.innerHTML = `
      <style>
        .editor{display:flex;flex-direction:column;gap:14px;padding:8px 0;}
        .field{display:flex;flex-direction:column;gap:5px;}
        .row{display:flex;gap:12px;} .row .field{flex:1;}
        label{font-size:13px;font-weight:500;color:var(--primary-text-color,#212121);}
        .hint{font-size:11px;color:var(--secondary-text-color,#727272);}
        input[type=text],input[type=number],select{
          padding:9px 11px;border-radius:8px;border:1px solid var(--divider-color,#e0e0e0);
          background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);
          font-size:14px;outline:none;box-sizing:border-box;width:100%;}
        input[type=text]:focus,input[type=number]:focus,select:focus{border-color:var(--primary-color,#03a9f4);}
        input[type=color]{padding:4px;height:40px;cursor:pointer;width:100%;border-radius:8px;}
        .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0;}
        .toggle-row label{flex:1;}
        .section{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
          color:var(--secondary-text-color,#727272);margin-top:6px;
          border-bottom:1px solid var(--divider-color,#e0e0e0);padding-bottom:4px;}
        .range-wrap{display:flex;align-items:center;gap:8px;}
        .range-wrap input{flex:1;}
        .range-val{font-size:12px;color:var(--secondary-text-color,#727272);min-width:34px;text-align:right;}
      </style>
      <div class="editor">
        <div class="section">Allgemein</div>
        <div class="field">
          <label>Entität</label>
          <div id="entityContainer"></div>
        </div>
        <div class="field">
          <label>Name (optional)</label>
          <input type="text" id="name" value="${c.name||''}" placeholder="Leer = Entitätsname wird verwendet" />
        </div>

        <div class="section">Aussehen</div>
        <div class="row">
          <div class="field">
            <label>Design</label>
            <select id="design">
              ${designs.map(([v,l])=>`<option value="${v}" ${(c.design||'glass')===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Aktiv-Farbe</label>
            <input type="color" id="active_color" value="${c.active_color||'#ffd54f'}" />
          </div>
        </div>
        <div class="toggle-row">
          <label>Theme folgen (HA-Design übernehmen)</label>
          <input type="checkbox" id="follow_theme" ${c.follow_theme?'checked':''} />
        </div>
        <div class="toggle-row">
          <label>Leuchten wenn aktiv</label>
          <input type="checkbox" id="glow" ${glowOn?'checked':''} />
        </div>
        <div id="glowField" style="${glowOn?'':'display:none'}">
          <div class="field">
            <label>Leuchtkraft</label>
            <div class="range-wrap">
              <input type="range" id="glow_intensity" min="0" max="40" step="1" value="${c.glow_intensity??12}" />
              <span class="range-val" id="glowVal">${c.glow_intensity??12}</span>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>Höhe (px, optional)</label>
            <input type="number" id="height" value="${c.height||''}" min="30" max="300" step="1" placeholder="automatisch" />
          </div>
          <div class="field">
            <label>Breite (px, optional)</label>
            <input type="number" id="width" value="${c.width||''}" min="30" max="600" step="1" placeholder="volle Breite" />
          </div>
        </div>
        <div class="field">
          <label>Eckenradius (px)</label>
          <input type="number" id="border_radius" value="${c.border_radius||16}" min="0" max="40" step="1" />
        </div>

        <div class="section">Anzeige</div>
        <div class="toggle-row">
          <label>Name anzeigen</label>
          <input type="checkbox" id="show_name" ${c.show_name?'checked':''} />
        </div>
        <div class="toggle-row">
          <label>Zustand/Wert anzeigen</label>
          <input type="checkbox" id="show_state" ${c.show_state?'checked':''} />
        </div>
        <div class="row">
          <div class="field">
            <label>Schriftgröße Name (px)</label>
            <input type="number" id="name_size" value="${c.name_size||11}" min="8" max="32" step="1" />
          </div>
          <div class="field">
            <label>Schriftgröße Wert (px)</label>
            <input type="number" id="state_size" value="${c.state_size||12}" min="8" max="32" step="1" />
          </div>
        </div>

        <div class="section">Icons</div>
        <div class="field" id="iconContainer"></div>
        <div class="field" id="iconActiveContainer"></div>

        <div class="section">Aktion bei Tippen</div>
        <div class="field">
          <label>Was soll passieren?</label>
          <select id="tap_type">
            ${actions.map(([v,l])=>`<option value="${v}" ${tapAction===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        ${tapAction==='navigate'   ? `<div class="field"><label>Navigationspfad</label><input type="text" id="nav_path" value="${c.tap_action?.navigation_path||''}" placeholder="/lovelace/meinzimmer" /></div>` : ''}
        ${tapAction==='call-service'? `<div class="field"><label>Dienst</label><input type="text" id="svc" value="${c.tap_action?.service||''}" placeholder="script.mein_script" /><span class="hint">Format: domain.dienst</span></div>` : ''}
        ${tapAction==='url'         ? `<div class="field"><label>URL</label><input type="text" id="url_path" value="${c.tap_action?.url_path||''}" placeholder="https://..." /></div>` : ''}

        <div class="section">Aktion bei Gedrückt halten</div>
        <div class="field">
          <label>Was soll passieren?</label>
          <select id="hold_type">
            ${actions.map(([v,l])=>`<option value="${v}" ${holdAction===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        ${holdAction==='navigate'    ? `<div class="field"><label>Navigationspfad</label><input type="text" id="hold_nav_path" value="${c.hold_action?.navigation_path||''}" placeholder="/lovelace/meinzimmer" /></div>` : ''}
        ${holdAction==='call-service'? `<div class="field"><label>Dienst</label><input type="text" id="hold_svc" value="${c.hold_action?.service||''}" placeholder="script.mein_script" /><span class="hint">Format: domain.dienst</span></div>` : ''}
        ${holdAction==='url'         ? `<div class="field"><label>URL</label><input type="text" id="hold_url_path" value="${c.hold_action?.url_path||''}" placeholder="https://..." /></div>` : ''}
        ${holdAction==='more-info'   ? `<div class="field"><span class="hint">Öffnet das Info-Fenster der konfigurierten Entität.</span></div>` : ''}
      </div>
    `;

    // Entity Picker – beim Auswählen Standard-Icon der Entität übernehmen
    this._buildEntityPicker(
      root.getElementById('entityContainer'),
      c.entity || '',
      (entityId) => {
        const autoIcon = getEntityIcon(this._hass, entityId);
        this._config = {
          ...this._config,
          entity: entityId,
          icon: autoIcon,  // Icon der gewählten Entität übernehmen
        };
        this._emit();
        this._render();
      }
    );

    // Icon Picker
    this._buildIconPicker(root.getElementById('iconContainer'), 'Standard Icon', c.icon||'', v => this._update('icon', v));
    this._buildIconPicker(root.getElementById('iconActiveContainer'), 'Icon wenn aktiv (optional)', c.icon_active||'', v => this._update('icon_active', v));

    // Einfache Felder
    const on = (id, key, ev='change', fn=v=>v) => {
      const el = root.getElementById(id);
      if (el) el.addEventListener(ev, e => this._update(key, fn(e.target.value)));
    };
    on('name', 'name');
    on('design', 'design', 'change', v => { setTimeout(()=>this._render(),50); return v; });
    on('active_color', 'active_color');
    on('name_size', 'name_size', 'change', v => parseInt(v));
    on('state_size', 'state_size', 'change', v => parseInt(v));
    on('border_radius', 'border_radius', 'change', v => parseInt(v));

    // Höhe & Breite: leer = Wert entfernen (automatisch)
    const dimHandler = (id, key) => {
      const el = root.getElementById(id);
      if (!el) return;
      el.addEventListener('change', e => {
        const v = e.target.value.trim();
        if (v === '') {
          const cfg = { ...this._config };
          delete cfg[key];
          this._config = cfg;
          this._emit();
        } else {
          this._update(key, parseInt(v));
        }
      });
    };
    dimHandler('height', 'height');
    dimHandler('width', 'width');

    const followTheme = root.getElementById('follow_theme');
    if (followTheme) followTheme.addEventListener('change', e => this._update('follow_theme', e.target.checked));

    const glowCb = root.getElementById('glow');
    if (glowCb) glowCb.addEventListener('change', e => {
      this._update('glow', e.target.checked);
      root.getElementById('glowField').style.display = e.target.checked ? '' : 'none';
    });
    const glowRange = root.getElementById('glow_intensity');
    if (glowRange) glowRange.addEventListener('input', e => {
      root.getElementById('glowVal').textContent = e.target.value;
      this._update('glow_intensity', parseInt(e.target.value));
    });

    const showName = root.getElementById('show_name');
    if (showName) showName.addEventListener('change', e => this._update('show_name', e.target.checked));
    const showState = root.getElementById('show_state');
    if (showState) showState.addEventListener('change', e => this._update('show_state', e.target.checked));

    const tapType = root.getElementById('tap_type');
    if (tapType) tapType.addEventListener('change', e => this._setActionType('tap_action', e.target.value));

    const navPath = root.getElementById('nav_path');
    if (navPath) navPath.addEventListener('change', e => this._updateAction('tap_action','navigation_path',e.target.value));
    const svc = root.getElementById('svc');
    if (svc) svc.addEventListener('change', e => this._updateAction('tap_action','service',e.target.value));
    const urlPath = root.getElementById('url_path');
    if (urlPath) urlPath.addEventListener('change', e => this._updateAction('tap_action','url_path',e.target.value));

    const holdType = root.getElementById('hold_type');
    if (holdType) holdType.addEventListener('change', e => this._setActionType('hold_action', e.target.value));

    const holdNavPath = root.getElementById('hold_nav_path');
    if (holdNavPath) holdNavPath.addEventListener('change', e => this._updateAction('hold_action','navigation_path',e.target.value));
    const holdSvc = root.getElementById('hold_svc');
    if (holdSvc) holdSvc.addEventListener('change', e => this._updateAction('hold_action','service',e.target.value));
    const holdUrlPath = root.getElementById('hold_url_path');
    if (holdUrlPath) holdUrlPath.addEventListener('change', e => this._updateAction('hold_action','url_path',e.target.value));
  }
}

customElements.define('glass-button-card-editor', GlassButtonCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'glass-button-card',
  name: 'Glass Button Card',
  description: 'Konfigurierbarer Button im Glasstil mit Editor, Leuchteffekt und zustandsabhängigen Icons',
  preview: true,
  documentationURL: 'https://github.com/pquandel2-alt/glass-button-card',
});
