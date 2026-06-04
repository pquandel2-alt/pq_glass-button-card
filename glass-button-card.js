// =====================================================================
//  Glass Button Card v1.3.0
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
    this._popupEl = null;
    this._popupOpen = false;
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

  set hass(hass) {
    this._hass = hass;
    if (this._popupOpen) {
      this._refreshPopupControls();
    } else {
      this._render();
    }
  }

  _isActive() {
    const st = this._entityState();
    if (!st) return false;
    return ACTIVE_STATES.includes(st.state);
  }

  _isThresholdExceeded() {
    if (this._config.threshold === undefined || this._config.threshold === null || this._config.threshold === '') return false;
    const st = this._entityState();
    if (!st) return false;
    const val = parseFloat(st.state);
    if (isNaN(val)) return false;
    const op  = this._config.threshold_operator || '>=';
    const thr = parseFloat(this._config.threshold);
    switch (op) {
      case '>=': return val >= thr;
      case '>':  return val >  thr;
      case '<=': return val <= thr;
      case '<':  return val <  thr;
      case '==': return val === thr;
      default:   return val >= thr;
    }
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
    const active = this._isActive() || this._isThresholdExceeded();
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

  _handleTap() {
    if (this._config.popup_enabled && (this._config.popup_trigger || 'tap') === 'tap') {
      this._openPopup(); return;
    }
    this._performAction(this._config.tap_action || { action: 'toggle' });
  }

  _handleHold() {
    if (this._config.popup_enabled && this._config.popup_trigger === 'hold') {
      this._openPopup(); return;
    }
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

  // ---- Popup ----

  _openPopup() {
    this._popupOpen = true;
    if (!this._popupEl) {
      this._popupEl = document.createElement('div');
      this.shadowRoot.appendChild(this._popupEl);
    } else if (!this.shadowRoot.contains(this._popupEl)) {
      this.shadowRoot.appendChild(this._popupEl);
    }
    this._popupEl.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    this._buildPopupContent();
  }

  _closePopup() {
    this._popupOpen = false;
    if (this._popupEl) this._popupEl.style.display = 'none';
    this._lastRenderKey = null;
    this._render();
  }

  _ensurePopup() {
    if (!this._popupEl) return;
    if (!this.shadowRoot.contains(this._popupEl)) {
      this.shadowRoot.appendChild(this._popupEl);
    }
    this._popupEl.style.cssText = `position:fixed;inset:0;z-index:9999;display:${this._popupOpen ? 'flex' : 'none'};align-items:flex-end;justify-content:center;`;
  }

  _refreshPopupControls() {
    if (!this._popupEl || !this._hass) return;
    (this._config.popup_entities || []).forEach(item => {
      const entityId = typeof item === 'string' ? item : item.entity;
      if (!entityId) return;
      const st = this._hass.states[entityId];
      if (!st) return;
      const domain = entityId.split('.')[0];

      // Toggle (any on/off entity)
      const cb = this._popupEl.querySelector(`[data-entity="${entityId}"][data-control="toggle"]`);
      if (cb) cb.checked = st.state === 'on' || (domain === 'lock' ? st.state === 'locked' : false);

      // Slider — data-type tells us which value to read
      const slider = this._popupEl.querySelector(`[data-entity="${entityId}"][data-control="slider"]`);
      if (slider) {
        const t = slider.dataset.type;
        let val;
        if (t === 'climate-temp')  val = st.attributes.temperature;
        else if (t === 'volume')   val = Math.round((st.attributes.volume_level ?? 0) * 100);
        else if (t === 'fan-pct')  val = st.attributes.percentage ?? 0;
        else                       val = parseFloat(st.state);
        if (!isNaN(val)) slider.value = val;
      }

      // Val badge (generic)
      const valEl = this._popupEl.querySelector(`[data-val="${entityId}"]`);
      if (valEl) {
        const t = slider?.dataset.type;
        if (t === 'climate-temp') valEl.textContent = `${st.attributes.temperature ?? '–'} °C`;
        else if (t === 'volume')  valEl.textContent = `${Math.round((st.attributes.volume_level ?? 0) * 100)} %`;
        else if (t === 'fan-pct') valEl.textContent = `${st.attributes.percentage ?? 0} %`;
        else {
          const unit = st.attributes.unit_of_measurement || '';
          valEl.textContent = `${parseFloat(st.state)}${unit ? ' '+unit : ''}`;
        }
      }

      // Select (input_select, select, climate mode)
      const sel = this._popupEl.querySelector(`[data-entity="${entityId}"][data-control="select"]`);
      if (sel) sel.value = st.state;

      // Timer remaining
      const timerDisp = this._popupEl.querySelector(`[data-timer="${entityId}"]`);
      if (timerDisp) timerDisp.textContent = st.attributes.remaining || '–';

      // Media info text
      const mediaInfo = this._popupEl.querySelector(`[data-media-info="${entityId}"]`);
      if (mediaInfo) {
        const title = st.attributes.media_title || '';
        const artist = st.attributes.media_artist || '';
        mediaInfo.textContent = title ? (artist ? `${artist} – ${title}` : title) : '';
      }
    });
  }

  _buildPopupContent() {
    const c = this._config;
    const hass = this._hass;
    const entities = c.popup_entities || [];
    const cardName = c.name || (this._entityState()?.attributes.friendly_name) || 'Steuerung';
    const IC = (icon, color='rgba(255,255,255,0.55)') =>
      `<ha-icon icon="${icon}" style="--mdc-icon-size:20px;color:${color};flex-shrink:0;"></ha-icon>`;
    const TOGGLE = (entityId, isOn) => `
      <label class="toggle-sw">
        <input type="checkbox" data-entity="${entityId}" data-control="toggle" ${isOn ? 'checked' : ''} />
        <span class="tog-track"><span class="tog-thumb"></span></span>
      </label>`;
    const SLIDER = (entityId, min, max, step, val, unit, type) => `
      <div class="popup-row-head" style="padding:0;">
        <span class="popup-val-badge" data-val="${entityId}">${val}${unit ? ' '+unit : ''}</span>
      </div>
      <input type="range" class="popup-slider" data-entity="${entityId}" data-control="slider" data-type="${type}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${val}" />`;
    const ACTBTN = (entityId, ctrl, label) =>
      `<button class="act-btn" data-entity="${entityId}" data-control="${ctrl}">${label}</button>`;
    const COVBTN = (entityId, ctrl, label) =>
      `<button class="cov-btn" data-entity="${entityId}" data-control="${ctrl}">${label}</button>`;

    const CLIMATE_MODES = {heat:'Heizen',cool:'Kühlen',auto:'Auto',heat_cool:'Auto Temp',
                           dry:'Trocknen',fan_only:'Lüfter',off:'Aus'};

    let rows = '';

    entities.forEach(item => {
      const entityId = typeof item === 'string' ? item : (item.entity || '');
      if (!entityId) return;
      const st = hass?.states[entityId];
      const label = (typeof item === 'object' && item.name) || st?.attributes.friendly_name || entityId;
      const domain = entityId.split('.')[0];
      const icon = getEntityIcon(hass, entityId);

      if (!st) {
        rows += `<div class="popup-row">${IC(icon,'rgba(255,255,255,0.2)')}<span class="popup-label" style="opacity:.4">${label} (nicht verfügbar)</span></div>`;
        return;
      }

      const s = st.state;
      const isOn = s === 'on';

      // ── Button / Scene / Script ──
      if (['button', 'input_button', 'scene'].includes(domain)) {
        rows += `<div class="popup-row">${IC(icon)}<span class="popup-label">${label}</span>
          ${ACTBTN(entityId, 'press', domain === 'scene' ? 'Aktivieren' : 'Auslösen')}</div>`;

      // ── Script ──
      } else if (domain === 'script') {
        rows += `<div class="popup-row">${IC(icon, isOn ? '#ffd54f' : 'rgba(255,255,255,0.55)')}
          <span class="popup-label">${label}</span>
          ${isOn ? `<span class="popup-state-val">Läuft…</span>` : ''}
          ${ACTBTN(entityId, 'press', 'Ausführen')}</div>`;

      // ── Lock ──
      } else if (domain === 'lock') {
        const locked = s === 'locked';
        rows += `<div class="popup-row">${IC(locked ? 'mdi:lock' : 'mdi:lock-open-outline', locked ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
          <span class="popup-label">${label}</span>
          <span class="popup-state-val">${locked ? 'Verriegelt' : 'Offen'}</span>
          ${TOGGLE(entityId, locked)}</div>`;

      // ── Cover ──
      } else if (domain === 'cover') {
        const pos = st.attributes.current_position;
        rows += `<div class="popup-row">${IC(icon)}
          <span class="popup-label">${label}</span>
          ${pos !== undefined ? `<span class="popup-state-val">${pos} %</span>` : ''}
          <div class="btn-grp">
            ${COVBTN(entityId,'cover-open','Auf')}
            ${COVBTN(entityId,'cover-stop','Stop')}
            ${COVBTN(entityId,'cover-close','Zu')}
          </div></div>`;

      // ── Climate ──
      } else if (domain === 'climate') {
        const modes = st.attributes.hvac_modes || [];
        const temp = st.attributes.temperature;
        const currTemp = st.attributes.current_temperature;
        const minT = st.attributes.min_temp ?? 5;
        const maxT = st.attributes.max_temp ?? 35;
        const stepT = st.attributes.target_temp_step ?? 0.5;
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">
            ${IC(icon, s !== 'off' ? '#ffd54f' : 'rgba(255,255,255,0.4)')}
            <span class="popup-label">${label}</span>
            ${currTemp !== undefined ? `<span class="popup-state-val">${currTemp} °C</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:2px 0;">
            <span style="font-size:12px;color:rgba(255,255,255,0.45);flex:1;">Modus</span>
            <select class="popup-select" data-entity="${entityId}" data-control="select">
              ${modes.map(m => `<option value="${m}" ${m===s?'selected':''}>${CLIMATE_MODES[m]||m}</option>`).join('')}
            </select>
          </div>
          ${temp !== undefined ? SLIDER(entityId, minT, maxT, stepT, temp, '°C', 'climate-temp') : ''}
        </div>`;

      // ── Media Player ──
      } else if (domain === 'media_player') {
        const isPlaying = s === 'playing';
        const isOff = ['off','unavailable','unknown'].includes(s);
        const vol = Math.round((st.attributes.volume_level ?? 0) * 100);
        const title = st.attributes.media_title || '';
        const artist = st.attributes.media_artist || '';
        const mediaText = title ? (artist ? `${artist} – ${title}` : title) : '';
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">
            ${IC(icon, isPlaying ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
            <span class="popup-label">${label}</span>
            ${!isOff ? `<button class="act-btn" data-entity="${entityId}" data-control="media-play" style="padding:5px 8px;">
              <ha-icon icon="${isPlaying ? 'mdi:pause' : 'mdi:play'}" style="--mdc-icon-size:16px;"></ha-icon>
            </button>` : `<span class="popup-state-val">${STATE_MAP_DE[s]||s}</span>`}
          </div>
          ${mediaText ? `<div style="font-size:12px;color:rgba(255,255,255,0.45);padding-left:32px;" data-media-info="${entityId}">${mediaText}</div>` : ''}
          ${!isOff && st.attributes.volume_level !== undefined ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <ha-icon icon="mdi:volume-medium" style="--mdc-icon-size:16px;color:rgba(255,255,255,0.4);flex-shrink:0;"></ha-icon>
            <input type="range" class="popup-slider" style="flex:1;" data-entity="${entityId}" data-control="slider" data-type="volume" data-unit="%" min="0" max="100" step="1" value="${vol}" />
            <span class="popup-val-badge" data-val="${entityId}">${vol} %</span>
          </div>` : ''}
        </div>`;

      // ── Vacuum ──
      } else if (domain === 'vacuum') {
        const isCleaning = s === 'cleaning';
        const isDocked = s === 'docked';
        const isPaused = s === 'paused';
        const stateLabel = {cleaning:'Saugt',returning:'Kehrt zurück',docked:'In Station',idle:'Bereit',paused:'Pausiert',error:'Fehler'}[s] || s;
        rows += `<div class="popup-row">${IC(icon, isCleaning ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
          <span class="popup-label">${label}</span>
          <span class="popup-state-val">${stateLabel}</span>
          <div class="btn-grp">
            ${!isCleaning && !isPaused ? COVBTN(entityId,'vacuum-start','Start') : ''}
            ${isCleaning ? COVBTN(entityId,'vacuum-pause','Pause') : ''}
            ${isPaused ? COVBTN(entityId,'vacuum-start','Weiter') : ''}
            ${!isDocked ? COVBTN(entityId,'vacuum-dock','Dock') : ''}
          </div></div>`;

      // ── Timer ──
      } else if (domain === 'timer') {
        const isActive = s === 'active';
        const isPaused = s === 'paused';
        const remaining = st.attributes.remaining || '–';
        rows += `<div class="popup-row">${IC(icon, isActive ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
          <span class="popup-label">${label}</span>
          <span class="popup-val-badge" data-timer="${entityId}">${remaining}</span>
          <div class="btn-grp">
            ${!isActive || isPaused ? COVBTN(entityId,'timer-start', isPaused ? 'Weiter' : 'Start') : ''}
            ${isActive && !isPaused ? COVBTN(entityId,'timer-pause','Pause') : ''}
            ${(isActive || isPaused) ? COVBTN(entityId,'timer-cancel','Stop') : ''}
          </div></div>`;

      // ── Input Text ──
      } else if (domain === 'input_text') {
        const maxLen = st.attributes.max ?? 100;
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">${IC(icon)}<span class="popup-label">${label}</span></div>
          <input type="text" class="popup-text-input" data-entity="${entityId}" data-control="text" value="${s}" maxlength="${maxLen}" />
        </div>`;

      // ── Automation ──
      } else if (domain === 'automation') {
        rows += `<div class="popup-row">${IC(icon, isOn ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
          <span class="popup-label">${label}</span>
          ${ACTBTN(entityId,'automation-trigger','Auslösen')}
          ${TOGGLE(entityId, isOn)}</div>`;

      // ── Fan ──
      } else if (domain === 'fan') {
        const hasPct = st.attributes.percentage !== undefined && st.attributes.percentage_step !== undefined;
        const pct = st.attributes.percentage ?? 0;
        const pctStep = st.attributes.percentage_step ?? 1;
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">
            ${IC(icon, isOn ? '#ffd54f' : 'rgba(255,255,255,0.5)')}
            <span class="popup-label">${label}</span>
            ${TOGGLE(entityId, isOn)}
          </div>
          ${hasPct && isOn ? SLIDER(entityId, 0, 100, pctStep, pct, '%', 'fan-pct') : ''}
        </div>`;

      // ── Input Number / Number ──
      } else if (['input_number', 'number'].includes(domain)) {
        const min = st.attributes.min ?? 0;
        const max = st.attributes.max ?? 100;
        const step = st.attributes.step ?? 1;
        const val = parseFloat(s);
        const unit = st.attributes.unit_of_measurement || '';
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">${IC(icon)}<span class="popup-label">${label}</span></div>
          ${SLIDER(entityId, min, max, step, val, unit, 'number')}
        </div>`;

      // ── Input Select / Select ──
      } else if (['input_select', 'select'].includes(domain)) {
        const opts = st.attributes.options || [];
        rows += `<div class="popup-row">${IC(icon)}<span class="popup-label">${label}</span>
          <select class="popup-select" data-entity="${entityId}" data-control="select">
            ${opts.map(o => `<option value="${o}" ${o===s?'selected':''}>${o}</option>`).join('')}
          </select></div>`;

      // ── Generic: entity has options → select ──
      } else if (Array.isArray(st.attributes.options) && st.attributes.options.length) {
        const opts = st.attributes.options;
        rows += `<div class="popup-row">${IC(icon)}<span class="popup-label">${label}</span>
          <select class="popup-select" data-entity="${entityId}" data-control="select">
            ${opts.map(o => `<option value="${o}" ${o===s?'selected':''}>${o}</option>`).join('')}
          </select></div>`;

      // ── Generic: entity has min/max → slider ──
      } else if (st.attributes.min !== undefined && st.attributes.max !== undefined) {
        const min = st.attributes.min;
        const max = st.attributes.max;
        const step = st.attributes.step ?? 1;
        const val = parseFloat(s);
        const unit = st.attributes.unit_of_measurement || '';
        rows += `<div class="popup-row popup-col">
          <div class="popup-row-head">${IC(icon)}<span class="popup-label">${label}</span></div>
          ${SLIDER(entityId, min, max, step, val, unit, 'number')}
        </div>`;

      // ── Generic: on/off → toggle ──
      } else if (s === 'on' || s === 'off') {
        rows += `<div class="popup-row">${IC(icon, isOn ? '#ffd54f' : 'rgba(255,255,255,0.45)')}
          <span class="popup-label">${label}</span>
          ${TOGGLE(entityId, isOn)}</div>`;

      // ── Fallback: display + more-info ──
      } else {
        const disp = s + (st.attributes.unit_of_measurement ? ` ${st.attributes.unit_of_measurement}` : '');
        rows += `<div class="popup-row">${IC(icon)}
          <span class="popup-label">${label}</span>
          <span class="popup-state-val">${disp}</span>
          <button class="act-btn" data-entity="${entityId}" data-control="more-info" style="padding:4px 8px;">
            <ha-icon icon="mdi:information-outline" style="--mdc-icon-size:16px;"></ha-icon>
          </button></div>`;
      }
    });

    if (!rows) {
      rows = `<div style="text-align:center;padding:20px 0;color:rgba(255,255,255,0.35);font-size:13px;">Keine Entitäten konfiguriert</div>`;
    }

    this._popupEl.innerHTML = `
      <style>
        .popup-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
        .popup-sheet{
          position:relative;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;
          background:rgba(28,28,38,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
          border:1px solid rgba(255,255,255,0.14);border-radius:20px 20px 0 0;
          padding:20px;box-sizing:border-box;animation:gbcSlideUp .25s ease;
        }
        @keyframes gbcSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        .popup-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
        .popup-title{font-size:16px;font-weight:600;color:rgba(255,255,255,0.92);}
        .popup-close{background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;padding:0;}
        .popup-close:hover{background:rgba(255,255,255,0.2);}
        .popup-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.07);}
        .popup-row:last-child{border-bottom:none;}
        .popup-col{flex-direction:column;align-items:stretch;gap:8px;}
        .popup-row-head{display:flex;align-items:center;gap:12px;}
        .popup-label{flex:1;font-size:14px;color:rgba(255,255,255,0.87);}
        .popup-state-val{font-size:13px;color:rgba(255,255,255,0.5);font-weight:500;}
        .popup-val-badge{font-size:13px;color:#ffd54f;font-weight:600;white-space:nowrap;}
        .popup-slider{width:100%;accent-color:#ffd54f;cursor:pointer;}
        .popup-select{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:rgba(255,255,255,0.9);padding:6px 10px;font-size:13px;outline:none;max-width:160px;}
        .popup-select option{background:#2a2a3a;color:#fff;}
        .popup-text-input{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:rgba(255,255,255,0.9);padding:8px 10px;font-size:13px;outline:none;width:100%;box-sizing:border-box;}
        .popup-text-input:focus{border-color:#ffd54f;}
        .toggle-sw{position:relative;display:inline-block;width:42px;height:24px;flex-shrink:0;}
        .toggle-sw input{opacity:0;width:0;height:0;position:absolute;}
        .tog-track{position:absolute;inset:0;background:rgba(255,255,255,0.15);border-radius:24px;cursor:pointer;transition:.3s;}
        .toggle-sw input:checked+.tog-track{background:#ffd54f;}
        .tog-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.3s;}
        .toggle-sw input:checked+.tog-track .tog-thumb{transform:translateX(18px);}
        .btn-grp{display:flex;gap:6px;}
        .cov-btn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:rgba(255,255,255,0.85);padding:6px 12px;font-size:12px;cursor:pointer;transition:.2s;}
        .cov-btn:hover{background:rgba(255,255,255,0.2);}
        .act-btn{background:rgba(255,213,79,0.15);border:1px solid rgba(255,213,79,0.35);border-radius:8px;color:#ffd54f;padding:6px 14px;font-size:12px;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:4px;flex-shrink:0;}
        .act-btn:hover{background:rgba(255,213,79,0.28);}
      </style>
      <div class="popup-backdrop" id="gbcBackdrop"></div>
      <div class="popup-sheet">
        <div class="popup-header">
          <span class="popup-title">${cardName}</span>
          <button class="popup-close" id="gbcClose">&#x2715;</button>
        </div>
        ${rows}
      </div>
    `;

    this._popupEl.querySelector('#gbcClose').addEventListener('click', () => this._closePopup());
    this._popupEl.querySelector('#gbcBackdrop').addEventListener('click', () => this._closePopup());

    // Toggle (on/off + lock)
    this._popupEl.querySelectorAll('[data-control="toggle"]').forEach(cb => {
      cb.addEventListener('change', e => {
        const entityId = e.target.dataset.entity;
        const domain = entityId.split('.')[0];
        if (domain === 'lock') {
          this._hass.callService('lock', e.target.checked ? 'lock' : 'unlock', { entity_id: entityId });
        } else {
          this._hass.callService('homeassistant', e.target.checked ? 'turn_on' : 'turn_off', { entity_id: entityId });
        }
      });
    });

    // Generic slider
    this._popupEl.querySelectorAll('[data-control="slider"]').forEach(slider => {
      slider.addEventListener('input', e => {
        const valEl = this._popupEl.querySelector(`[data-val="${e.target.dataset.entity}"]`);
        const unit = e.target.dataset.unit || '';
        if (valEl) valEl.textContent = `${e.target.value}${unit ? ' '+unit : ''}`;
      });
      slider.addEventListener('change', e => {
        const entityId = e.target.dataset.entity;
        const domain = entityId.split('.')[0];
        const t = e.target.dataset.type;
        const val = parseFloat(e.target.value);
        if (t === 'climate-temp') {
          this._hass.callService('climate', 'set_temperature', { entity_id: entityId, temperature: val });
        } else if (t === 'volume') {
          this._hass.callService('media_player', 'volume_set', { entity_id: entityId, volume_level: val / 100 });
        } else if (t === 'fan-pct') {
          this._hass.callService('fan', 'set_percentage', { entity_id: entityId, percentage: val });
        } else if (domain === 'input_number') {
          this._hass.callService('input_number', 'set_value', { entity_id: entityId, value: val });
        } else {
          this._hass.callService('number', 'set_value', { entity_id: entityId, value: val });
        }
      });
    });

    // Select (input_select, select, climate hvac_mode)
    this._popupEl.querySelectorAll('[data-control="select"]').forEach(sel => {
      sel.addEventListener('change', e => {
        const entityId = e.target.dataset.entity;
        const domain = entityId.split('.')[0];
        if (domain === 'input_select') {
          this._hass.callService('input_select', 'select_option', { entity_id: entityId, option: e.target.value });
        } else if (domain === 'climate') {
          this._hass.callService('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: e.target.value });
        } else {
          this._hass.callService('select', 'select_option', { entity_id: entityId, option: e.target.value });
        }
      });
    });

    // Cover buttons
    this._popupEl.querySelectorAll('[data-control^="cover-"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const entityId = e.currentTarget.dataset.entity;
        const ctrl = e.currentTarget.dataset.control;
        const svc = ctrl === 'cover-open' ? 'open_cover' : ctrl === 'cover-close' ? 'close_cover' : 'stop_cover';
        this._hass.callService('cover', svc, { entity_id: entityId });
      });
    });

    // Press / activate buttons (button, input_button, scene, script)
    this._popupEl.querySelectorAll('[data-control="press"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const entityId = e.currentTarget.dataset.entity;
        const domain = entityId.split('.')[0];
        const svcMap = { button:'press', input_button:'press', scene:'turn_on', script:'turn_on' };
        this._hass.callService(domain, svcMap[domain] || 'turn_on', { entity_id: entityId });
      });
    });

    // Media play/pause
    this._popupEl.querySelectorAll('[data-control="media-play"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const entityId = e.currentTarget.dataset.entity;
        const st = this._hass.states[entityId];
        const svc = st?.state === 'playing' ? 'media_pause' : 'media_play';
        this._hass.callService('media_player', svc, { entity_id: entityId });
      });
    });

    // Vacuum buttons
    this._popupEl.querySelectorAll('[data-control^="vacuum-"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const entityId = e.currentTarget.dataset.entity;
        const ctrl = e.currentTarget.dataset.control;
        const svc = { 'vacuum-start':'start', 'vacuum-pause':'pause', 'vacuum-dock':'return_to_base' }[ctrl];
        if (svc) this._hass.callService('vacuum', svc, { entity_id: entityId });
      });
    });

    // Timer buttons
    this._popupEl.querySelectorAll('[data-control^="timer-"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const entityId = e.currentTarget.dataset.entity;
        const ctrl = e.currentTarget.dataset.control;
        const svc = { 'timer-start':'start', 'timer-pause':'pause', 'timer-cancel':'cancel' }[ctrl];
        if (svc) this._hass.callService('timer', svc, { entity_id: entityId });
      });
    });

    // Automation trigger
    this._popupEl.querySelectorAll('[data-control="automation-trigger"]').forEach(btn => {
      btn.addEventListener('click', e => {
        this._hass.callService('automation', 'trigger', { entity_id: e.currentTarget.dataset.entity });
      });
    });

    // Input text
    this._popupEl.querySelectorAll('[data-control="text"]').forEach(inp => {
      const save = e => {
        this._hass.callService('input_text', 'set_value', { entity_id: e.target.dataset.entity, value: e.target.value });
      };
      inp.addEventListener('change', save);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(e); });
    });

    // More-info fallback
    this._popupEl.querySelectorAll('[data-control="more-info"]').forEach(btn => {
      btn.addEventListener('click', e => this._fireMoreInfo(e.currentTarget.dataset.entity));
    });
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
    const activeState         = this._isActive();
    const thresholdExceeded   = this._isThresholdExceeded();
    const active              = activeState || thresholdExceeded;
    const unavailable         = this._isUnavailable();
    const color               = thresholdExceeded
      ? (this._config.threshold_color || '#FF6B35')
      : (this._config.active_color    || '#ffd54f');
    const glow        = this._config.glow_intensity || 12;
    const icon        = this._currentIcon();
    const name        = this._config.name || (this._entityState()?.attributes.friendly_name) || '';
    const stateText   = this._displayState();
    const nameSize    = this._config.name_size  || 11;
    const stateSize   = this._config.state_size || 12;

    const renderKey = `${active}|${unavailable}|${icon}|${name}|${stateText}|${JSON.stringify(this._config)}`;
    if (renderKey === this._lastRenderKey) return;
    this._lastRenderKey = renderKey;

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

    this._ensurePopup();

    const btn = this.shadowRoot.getElementById('btn');
    let holdTimer = null, held = false;

    btn.addEventListener('click', () => {
      if (unavailable || held) { held = false; return; }
      this._handleTap();
    });

    const hasHold = (this._config.hold_action && this._config.hold_action.action !== 'none') ||
                    (this._config.popup_enabled && this._config.popup_trigger === 'hold');

    if (hasHold) {
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

  _buildEntityPicker(container, currentValue, onChange) {
    container.innerHTML = '';
    const hass = this._hass;
    const entities = hass ? Object.keys(hass.states) : [];

    const preferred = ['light','switch','sensor','binary_sensor','climate','cover',
                       'media_player','input_boolean','vacuum','fan','lock','alarm_control_panel',
                       'input_number','input_select','number','select','cover'];
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

    const iconEl = document.createElement('ha-icon');
    iconEl.icon = getEntityIcon(hass, currentValue);
    iconEl.style.cssText = '--mdc-icon-size:20px;color:var(--secondary-text-color,#727272);flex-shrink:0;';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Entität suchen (Name oder ID)…';
    input.style.cssText = 'flex:1;border:none;outline:none;background:transparent;color:var(--primary-text-color,#212121);font-size:14px;';

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

  _buildPopupEntityList(container) {
    if (!container) return;
    container.innerHTML = '';
    const entities = this._config.popup_entities || [];

    if (entities.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px;color:var(--secondary-text-color,#727272);padding:4px 0 8px;';
      hint.textContent = 'Noch keine Entitäten hinzugefügt.';
      container.appendChild(hint);
      return;
    }

    entities.forEach((item, idx) => {
      const entityId = typeof item === 'string' ? item : (item.entity || '');

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;';

      const pickerDiv = document.createElement('div');
      pickerDiv.style.cssText = 'flex:1;';

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'flex-shrink:0;width:36px;height:38px;background:rgba(200,60,60,0.1);border:1px solid rgba(200,60,60,0.3);border-radius:8px;color:rgb(180,40,40);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;padding:0;';
      removeBtn.addEventListener('click', () => {
        const arr = [...(this._config.popup_entities || [])];
        arr.splice(idx, 1);
        this._config = { ...this._config, popup_entities: arr };
        this._emit();
        this._buildPopupEntityList(container);
      });

      row.appendChild(pickerDiv);
      row.appendChild(removeBtn);
      container.appendChild(row);

      this._buildEntityPicker(pickerDiv, entityId, (newEntityId) => {
        const arr = [...(this._config.popup_entities || [])];
        arr[idx] = newEntityId;
        this._config = { ...this._config, popup_entities: arr };
        this._emit();
      });
    });
  }

  _render() {
    this._rendered = true;
    const root = this.shadowRoot;
    const c = this._config;
    const tapAction  = c.tap_action?.action  || 'toggle';
    const holdAction = c.hold_action?.action || 'none';
    const glowOn = c.glow !== false;
    const popupEnabled = !!c.popup_enabled;
    const popupTrigger = c.popup_trigger || 'tap';
    const tapBlocked  = popupEnabled && popupTrigger === 'tap';
    const holdBlocked = popupEnabled && popupTrigger === 'hold';

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
        .add-btn{background:rgba(3,169,244,0.08);border:1px solid rgba(3,169,244,0.3);border-radius:8px;
          color:var(--primary-color,#03a9f4);padding:8px 14px;font-size:13px;cursor:pointer;
          width:100%;margin-top:8px;transition:.2s;}
        .add-btn:hover{background:rgba(3,169,244,0.18);}
        .popup-hint{font-size:12px;color:var(--secondary-text-color,#888);padding:6px 0 2px;
          background:rgba(3,169,244,0.06);border-radius:6px;padding:6px 10px;}
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

        <div class="section">Schwellenwert-Leuchten</div>
        <div class="hint" style="margin-bottom:4px;">Leuchtet in einer eigenen Farbe wenn der Entitätswert eine Bedingung erfüllt – z.B. Temperatur über 25°C oder Verbrauch über 2000 W.</div>
        <div class="row">
          <div class="field">
            <label>Operator</label>
            <select id="threshold_operator">
              ${[['>=','≥  (größer gleich)'],['>', '>  (größer als)'],['<=','≤  (kleiner gleich)'],['<', '<  (kleiner als)'],['==','=  (gleich)']].map(([v,l])=>`<option value="${v}" ${(c.threshold_operator||'>=')===v?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Schwellenwert</label>
            <input type="number" id="threshold" value="${c.threshold??''}" step="any" placeholder="z.B. 25" />
          </div>
        </div>
        <div class="field">
          <label>Leuchtfarbe bei Überschreitung</label>
          <input type="color" id="threshold_color" value="${c.threshold_color||'#FF6B35'}" />
        </div>

        <div class="section">Popup</div>
        <div class="toggle-row">
          <label>Popup aktivieren</label>
          <input type="checkbox" id="popup_enabled" ${popupEnabled?'checked':''} />
        </div>
        ${popupEnabled ? `
          <div class="field">
            <label>Popup öffnen bei</label>
            <select id="popup_trigger">
              <option value="tap" ${popupTrigger==='tap'?'selected':''}>Tippen</option>
              <option value="hold" ${popupTrigger==='hold'?'selected':''}>Gedrückt halten</option>
            </select>
          </div>
          <div class="field">
            <label>Entitäten im Popup</label>
            <div id="popupEntitiesContainer"></div>
            <button class="add-btn" id="addPopupEntity">+ Entität hinzufügen</button>
          </div>
        ` : ''}

        <div class="section">Aktion bei Tippen</div>
        ${tapBlocked
          ? `<div class="popup-hint">Tippen öffnet das Popup.</div>`
          : `<div class="field">
              <label>Was soll passieren?</label>
              <select id="tap_type">
                ${actions.map(([v,l])=>`<option value="${v}" ${tapAction===v?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            ${tapAction==='navigate'    ? `<div class="field"><label>Navigationspfad</label><input type="text" id="nav_path" value="${c.tap_action?.navigation_path||''}" placeholder="/lovelace/meinzimmer" /></div>` : ''}
            ${tapAction==='call-service'? `<div class="field"><label>Dienst</label><input type="text" id="svc" value="${c.tap_action?.service||''}" placeholder="script.mein_script" /><span class="hint">Format: domain.dienst</span></div>` : ''}
            ${tapAction==='url'         ? `<div class="field"><label>URL</label><input type="text" id="url_path" value="${c.tap_action?.url_path||''}" placeholder="https://..." /></div>` : ''}`}

        <div class="section">Aktion bei Gedrückt halten</div>
        ${holdBlocked
          ? `<div class="popup-hint">Gedrückt halten öffnet das Popup.</div>`
          : `<div class="field">
              <label>Was soll passieren?</label>
              <select id="hold_type">
                ${actions.map(([v,l])=>`<option value="${v}" ${holdAction===v?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            ${holdAction==='navigate'    ? `<div class="field"><label>Navigationspfad</label><input type="text" id="hold_nav_path" value="${c.hold_action?.navigation_path||''}" placeholder="/lovelace/meinzimmer" /></div>` : ''}
            ${holdAction==='call-service'? `<div class="field"><label>Dienst</label><input type="text" id="hold_svc" value="${c.hold_action?.service||''}" placeholder="script.mein_script" /><span class="hint">Format: domain.dienst</span></div>` : ''}
            ${holdAction==='url'         ? `<div class="field"><label>URL</label><input type="text" id="hold_url_path" value="${c.hold_action?.url_path||''}" placeholder="https://..." /></div>` : ''}
            ${holdAction==='more-info'   ? `<div class="field"><span class="hint">Öffnet das Info-Fenster der konfigurierten Entität.</span></div>` : ''}`}
      </div>
    `;

    // Entity Picker
    this._buildEntityPicker(
      root.getElementById('entityContainer'),
      c.entity || '',
      (entityId) => {
        const autoIcon = getEntityIcon(this._hass, entityId);
        this._config = { ...this._config, entity: entityId, icon: autoIcon };
        this._emit();
        this._render();
      }
    );

    // Icon Picker
    this._buildIconPicker(root.getElementById('iconContainer'), 'Standard Icon', c.icon||'', v => this._update('icon', v));
    this._buildIconPicker(root.getElementById('iconActiveContainer'), 'Icon wenn aktiv (optional)', c.icon_active||'', v => this._update('icon_active', v));

    // Popup entity list
    if (popupEnabled) {
      this._buildPopupEntityList(root.getElementById('popupEntitiesContainer'));
    }

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
    on('threshold_operator', 'threshold_operator');
    on('threshold_color', 'threshold_color');

    const thrEl = root.getElementById('threshold');
    if (thrEl) thrEl.addEventListener('change', e => {
      const v = e.target.value.trim();
      const cfg = { ...this._config };
      if (v === '') { delete cfg.threshold; } else { cfg.threshold = parseFloat(v); }
      this._config = cfg; this._emit();
    });

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

    // Popup controls
    const popupEnabledCb = root.getElementById('popup_enabled');
    if (popupEnabledCb) popupEnabledCb.addEventListener('change', e => {
      this._config = { ...this._config, popup_enabled: e.target.checked };
      this._emit();
      setTimeout(() => this._render(), 50);
    });

    const popupTriggerSel = root.getElementById('popup_trigger');
    if (popupTriggerSel) popupTriggerSel.addEventListener('change', e => {
      this._config = { ...this._config, popup_trigger: e.target.value };
      this._emit();
      setTimeout(() => this._render(), 50);
    });

    const addPopupEntityBtn = root.getElementById('addPopupEntity');
    if (addPopupEntityBtn) addPopupEntityBtn.addEventListener('click', () => {
      const arr = [...(this._config.popup_entities || []), ''];
      this._config = { ...this._config, popup_entities: arr };
      this._emit();
      this._buildPopupEntityList(root.getElementById('popupEntitiesContainer'));
    });

    // Tap action
    const tapType = root.getElementById('tap_type');
    if (tapType) tapType.addEventListener('change', e => this._setActionType('tap_action', e.target.value));
    const navPath = root.getElementById('nav_path');
    if (navPath) navPath.addEventListener('change', e => this._updateAction('tap_action','navigation_path',e.target.value));
    const svc = root.getElementById('svc');
    if (svc) svc.addEventListener('change', e => this._updateAction('tap_action','service',e.target.value));
    const urlPath = root.getElementById('url_path');
    if (urlPath) urlPath.addEventListener('change', e => this._updateAction('tap_action','url_path',e.target.value));

    // Hold action
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
  description: 'Konfigurierbarer Button im Glasstil mit Editor, Popup, Leuchteffekt und zustandsabhängigen Icons',
  preview: true,
  documentationURL: 'https://github.com/pquandel2-alt/glass-button-card',
});
