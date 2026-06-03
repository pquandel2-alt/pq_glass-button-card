# 💡 Glass Button Card

Eine hochgradig konfigurierbare Button-Card für Home Assistant im modernen Glasmorphism-Stil – komplett über einen visuellen Editor einstellbar. Icons reagieren automatisch auf den Zustand der Entität.

## ✨ Features

- **Visueller Editor** – alles per Maske einstellbar, kein YAML nötig
- **4 Designs** – Glas, Vollfläche, Umrandet, Minimal
- **Einstellbare Leuchtkraft** – Glow-Effekt an/aus und Intensität per Regler
- **Frei wählbare Aktion** – Ein-/Ausschalten, zu Seite navigieren, Info-Fenster öffnen, Dienst auslösen oder Webseite öffnen
- **Zustandsabhängige Icons** – eigenes Icon für aktiven Zustand, wechselt automatisch wenn die Entität an/offen/aktiv ist
- **Anpassbare Aktiv-Farbe** – Button, Icon und Glow nehmen deine Wunschfarbe an
- **Optionale Anzeige** von Name und Zustand/Wert
- **Hold-Aktion** möglich (per YAML)

## 📦 Installation

### Über HACS (Custom Repository)

1. HACS → Frontend → ⋮ → **Custom Repositories**
2. URL: `https://github.com/pquandel2-alt/glass-button-card`
3. Kategorie: **Lovelace**
4. Hinzufügen → **Herunterladen** → Browser neu laden

### Manuell

1. `glass-button-card.js` nach `/config/www/` kopieren
2. In `configuration.yaml` eintragen:

```yaml
lovelace:
  resources:
    - url: /local/glass-button-card.js
      type: module
```

## 🚀 Verwendung

Am einfachsten über den **visuellen Editor**: Card hinzufügen → „Glass Button Card" → alles per Maske einstellen.

Oder per YAML:

```yaml
type: custom:glass-button-card
entity: light.wohnzimmer
name: Wohnzimmer
design: glass
icon: mdi:lightbulb
icon_active: mdi:lightbulb-on
glow: true
glow_intensity: 12
active_color: '#ffd54f'
show_name: true
tap_action:
  action: toggle
```

## ⚙️ Konfiguration

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `entity` | string | – | Zu steuernde / anzuzeigende Entität |
| `name` | string | Entitätsname | Eigener Text unter dem Icon |
| `design` | string | `glass` | `glass`, `solid`, `outline`, `minimal` |
| `active_color` | string | `#ffd54f` | Farbe wenn aktiv (Hex) |
| `glow` | bool | `true` | Leuchteffekt wenn aktiv |
| `glow_intensity` | number | `12` | Stärke des Leuchtens (0–40) |
| `icon` | string | `mdi:lightbulb` | Standard-Icon |
| `icon_active` | string | – | Icon wenn aktiv |
| `icon_inactive` | string | – | Icon wenn inaktiv (optional) |
| `show_name` | bool | `true` | Name anzeigen |
| `show_state` | bool | `false` | Zustand/Wert anzeigen |
| `icon_size` | number | `24` | Icon-Größe in px |
| `height` | number | – | Feste Höhe in px |
| `border_radius` | number | `16` | Eckenradius in px |
| `tap_action` | object | `{action: toggle}` | Aktion bei Tippen |
| `hold_action` | object | – | Aktion bei langem Drücken |

### Aktions-Typen

```yaml
# Ein-/Ausschalten
tap_action:
  action: toggle

# Navigieren
tap_action:
  action: navigate
  navigation_path: /lovelace/wohnzimmer

# Info-Fenster
tap_action:
  action: more-info

# Dienst auslösen
tap_action:
  action: call-service
  service: switch.toggle
  target:
    entity_id: switch.steckdose

# Webseite öffnen
tap_action:
  action: url
  url_path: https://...
```

## 🎨 Designs

| Design | Beschreibung |
|--------|--------------|
| `glass` | Glasmorphism – transparent mit Blur |
| `solid` | Gefüllte Fläche |
| `outline` | Nur Umrandung, transparenter Hintergrund |
| `minimal` | Flach, ohne Rahmen |

## 🔆 Zustandserkennung

Der Button gilt als „aktiv" wenn der Zustand der Entität einer von diesen ist: `on`, `open`, `home`, `playing`, `active`, `heat`, `cool`, `auto`, `heat_cool`, `cleaning`, `returning`, `detected`, `unlocked`, `present`. In diesem Fall werden Aktiv-Farbe, Aktiv-Icon und Glow angewendet.

## 📄 Lizenz

MIT
