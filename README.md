# Kitchen Appliances Card

Lovelace card (`custom:home-twin-kuechengeraete-card`) for a kitchen tablet: a swipeable carousel with one page per smart appliance. Swipe (or tap ‹ › / the dots) to browse. A running or finished appliance can be shown automatically.

UI language: German.

## Features

- Page type `waschmaschine`: washing machine from the **Washer Control** integration – status, programme, remaining time, anti-crease hint, smart plug power; the machine graphic comes from the [Washer Card](https://github.com/SysriX/washer_ha_card) (`window.HT_WM`)
- Page type `entitaet`: any appliance – icon + state + additional values
- Optional auto-advance
- Building blocks for [room_panel_ha_card](https://github.com/SysriX/room_panel_ha_card) (`custom:raum-panel` ≥ 2.98, rp-extcard bridge): `titel`, `geraete`, `punkte`; options editable in the room panel's settings. In the room panel a double tap on the frame opens the full-screen view (configured there with `vollbild:`, e.g. the washer card).

## Requirements

- For `typ: waschmaschine`: [washer_control_ha_integration](https://github.com/SysriX/washer_control_ha_integration) and the [Washer Card](https://github.com/SysriX/washer_ha_card) loaded as a resource (for the graphic)
- Styled to match the **Room Tablet** theme (`room_tablet_ha_theme`)

## Installation

### HACS (custom repository)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/SysriX/kitchen_appliances_ha_card`, category **Dashboard**.
2. Install the card from HACS and reload the browser.
3. HACS registers the resource automatically: `/hacsfiles/kitchen_appliances_ha_card/kitchen_appliances_ha_card.js` (JavaScript module).

### Manual

1. Copy `dist/kitchen_appliances_ha_card.js` to `/config/www/kitchen_appliances_ha_card.js`.
2. Settings → Dashboards → ⋮ → **Resources** → add `/local/kitchen_appliances_ha_card.js` as **JavaScript module**.
3. Reload the browser.

## Configuration

All options are optional.

```yaml
type: custom:home-twin-kuechengeraete-card
titel: Küchengeräte        # '' = no header
hintergrund: true          # false = no glass plate (e.g. inside a room-panel frame)
aktiv_zeigen: true         # jump to an appliance that is running or finished
wechseln: 0                # seconds until auto-advance, 0 = off
geraete:
  - typ: waschmaschine     # needs washer_control + washer card
    washer: ku_washer      # washer id from washer_control (default ku_washer)
    name: Waschmaschine
  - typ: entitaet          # any appliance: icon + state + values
    name: Fridge
    icon: mdi:fridge
    entity: sensor.fridge_status
    werte:
      - { name: Inside, entity: sensor.fridge_temperature }
```

Default `geraete` (if omitted): one washing machine with `washer: ku_washer` – set your own washer id.

## Notes

This card was built for the author's own home and tablets. Some defaults (entity ids, dashboard paths) reflect that setup and may need to be set explicitly in your configuration.

## Version

1.1.1

## License

MIT – see [LICENSE](LICENSE).
