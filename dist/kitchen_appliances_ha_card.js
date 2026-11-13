/* ======================================================================
 * home-twin-kuechengeraete-card – smarte Küchengeräte zum Durchwischen (Küchen-Tablet)
 * Version 1.1.0 (2026-11-08) – Knitterschutz-Hinweis, Leistung der Steckdose
 *
 * Je Gerät eine Seite; wischen (oder ‹ › bzw. Punkte tippen) blättert. Im raum-panel öffnet ein Doppeltipp
 * auf den Rahmen die Vollbild-Ansicht (dort per vollbild: z. B. die home-twin-waschmaschine-card).
 *
 * Optionen (alle optional):
 *   titel: Küchengeräte          ('' = ohne Kopfzeile)
 *   hintergrund: true            (false = ohne eigene Glasplatte, z. B. im raum-panel-Rahmen)
 *   aktiv_zeigen: true           (läuft ein Gerät oder ist es fertig, springt die Ansicht dorthin)
 *   wechseln: 0                  (Sekunden bis zum automatischen Weiterblättern, 0 = aus)
 *   geraete:
 *     - typ: waschmaschine       (braucht washer_control + home-twin-waschmaschine-card für die Grafik)
 *       washer: ku_washer
 *       name: Waschmaschine
 *     - typ: entitaet            (beliebiges Gerät: Symbol + Zustand + Werte)
 *       name: Kühlschrank
 *       icon: mdi:fridge
 *       entity: sensor.kuehlschrank_status
 *       werte: [{ name: Innen, entity: sensor.kuehlschrank_temp }, …]
 *   teil: <Baustein>             (titel | geraete | punkte – setzt raum-panel bei layout: custom)
 * ====================================================================== */
(() => {
const VERSION = '1.1.1';
const TAG = 'home-twin-kuechengeraete-card';
const DEF = { titel: 'Küchengeräte', hintergrund: true, aktiv_zeigen: true, wechseln: 0,
  geraete: [{ typ: 'waschmaschine', washer: 'ku_washer', name: 'Waschmaschine' }] };
const C = { ok: '#3ddc84', warn: '#ff9f2e', bad: '#ff5a5a', info: '#4da3ff', run: '#4dc3ff', off: '#5c6068', plan: '#b48cff' };
const ST = {
  bereit: ['Bereit', C.info], laeuft: ['Läuft', C.run], pausiert: ['Pausiert', C.warn], geplant: ['Geplant', C.plan], fertig: ['Wäsche fertig', C.ok],
  beendet: ['Beendet', C.ok], fehler: ['Fehler', C.bad], getrennt: ['Offline', C.off], aus: ['Aus', C.off], unavailable: ['Nicht erreichbar', C.off], test: ['Test', C.warn],
};
const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const hm = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const tD = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const durHM = m => { m = Math.max(0, Math.round(m)); return `${Math.floor(m / 60)}:${p2(m % 60)}`; };
const sinceM = d => Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
const sinceT = d => { const m = sinceM(d); if (m < 1) return 'gerade eben'; if (m < 60) return `seit ${m} Min.`; const h = Math.floor(m / 60); return h < 24 ? `seit ${h} Std. ${p2(m % 60)} Min.` : `seit ${Math.floor(h / 24)} Tg.`; };

// gemeinsame Seite je Karte (titel/geraete/punkte als getrennte Instanzen im raum-panel)
const IDX = window.__htKgIdx || (window.__htKgIdx = new Map());
const keyOf = c => (c.geraete || []).map(g => g.washer || g.entity || g.name).join('|');
const subs = new Map();
const setIdx = (k, i, user) => { const o = IDX.get(k) || {}; IDX.set(k, { i, user: user ? Date.now() : o.user || 0 }); (subs.get(k) || new Set()).forEach(el => el._render()); };

const CSS = `
:host{display:block;height:100%;container-type:size}
*{box-sizing:border-box;margin:0}
.root{height:100%;color:#c9ccd2;line-height:1.2;font-family:Rajdhani,'Segoe UI',sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  display:flex;flex-direction:column;gap:8px;padding:12px 14px;position:relative}
.root.plate{border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(50,52,58,calc(.78 * var(--pt,1))),rgba(24,25,29,calc(.88 * var(--pt,1))));
  border:1px solid rgba(255,255,255,.07);box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 20px 36px rgba(0,0,0,.55)}
.root.bare{padding:0}
.head{display:flex;align-items:center;gap:10px;flex:none}
.head h2{flex:1;font-size:16px;letter-spacing:2.5px;text-transform:uppercase;color:#e2e4e8;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.head .n{font-family:'Share Tech Mono',monospace;font-size:12.5px;color:#9a9fa8}
.vp{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:pan-y;border-radius:14px}
.strip{display:flex;height:100%;transition:transform .38s cubic-bezier(.2,.8,.2,1);will-change:transform}
.strip.drag{transition:none}
.sl{flex:0 0 100%;height:100%;min-width:0;display:flex;gap:4%;align-items:center;padding:4px 6px}
.pic{height:100%;flex:0 0 auto;aspect-ratio:300/380;max-width:42%;display:flex;align-items:center;justify-content:center}
.pic svg{height:100%;width:100%;filter:drop-shadow(0 10px 14px rgba(0,0,0,.5))}
.pic ha-icon{--mdc-icon-size:min(34cqh,90px);color:var(--c)}
.inf{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;justify-content:center}
.nm{display:flex;align-items:center;gap:8px;min-width:0}
.nm b{font-size:clamp(13px,7cqh,20px);letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#e2e4e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:clamp(10px,4.4cqh,12.5px);letter-spacing:1.5px;font-weight:700;text-transform:uppercase;color:var(--c);
  background:rgba(0,0,0,.3);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent);white-space:nowrap;flex:none}
.pr{font-size:clamp(13px,7cqh,22px);font-weight:700;letter-spacing:1.4px;color:#d6d8dc;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr small{font-size:.7em;color:var(--c);letter-spacing:1.6px;margin-left:6px}
.lcd{border-radius:11px;padding:6px 10px;background:rgba(6,8,10,calc(.86 * var(--lcda,1)));box-shadow:inset 0 2px 8px rgba(0,0,0,calc(.85 * var(--lcda,1)));
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 8px}
.lcd .k{font-size:clamp(9px,3.8cqh,11px);letter-spacing:1.6px;font-weight:700;color:#9a9fa8;text-transform:uppercase;white-space:nowrap}
.lcd .v{font-family:'Share Tech Mono',monospace;font-size:clamp(14px,8cqh,26px);color:#e8e9ec;white-space:nowrap;line-height:1.1}
.lcd .v.rest{color:var(--c);text-shadow:0 0 12px color-mix(in srgb,var(--c) 55%,transparent)}
.prog{height:6px;border-radius:3px;background:#15161a;box-shadow:inset 0 1px 2px #000;position:relative;overflow:hidden}
.prog i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--c);box-shadow:0 0 8px var(--c);transition:width 1s}
.done{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:12px;background:rgba(61,220,132,.1);box-shadow:inset 0 0 0 1.5px ${C.ok},0 0 18px rgba(61,220,132,.25);animation:kgp 1.8s ease-in-out infinite}
.done b{font-size:clamp(15px,9cqh,28px);letter-spacing:2.5px;color:${C.ok};text-transform:uppercase;text-shadow:0 0 12px rgba(61,220,132,.5)}
.done span{font-family:'Share Tech Mono',monospace;font-size:clamp(11px,5cqh,15px);color:#a6aab2}
@keyframes kgp{50%{box-shadow:inset 0 0 0 1.5px rgba(61,220,132,.4),0 0 6px rgba(61,220,132,.1)}}
.sub{font-family:'Share Tech Mono',monospace;font-size:clamp(11px,5cqh,14px);color:#8d929b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vals{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px}
.vals div{border-radius:9px;padding:5px 9px;background:rgba(0,0,0,.25)}
.vals .k{font-size:11px;letter-spacing:1.6px;font-weight:700;color:#9a9fa8;text-transform:uppercase}
.vals .v{font-family:'Share Tech Mono',monospace;font-size:18px;color:#e8e9ec}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:26px;height:44px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;
  color:#9aa0a7;background:rgba(0,0,0,.25);font-size:20px;opacity:.55;z-index:2}
.nav.l{left:0}.nav.r{right:0}.nav:hover{opacity:1}
.dots{display:flex;justify-content:center;gap:8px;flex:none;padding:2px 0}
.dots i{width:8px;height:8px;border-radius:50%;background:#3a3c41;cursor:pointer;transition:all .25s}
.dots i.on{width:22px;border-radius:4px;background:${C.run};box-shadow:0 0 8px ${C.run}}
.dots i.act:not(.on){background:var(--c);box-shadow:0 0 6px var(--c)}
.hintz{position:absolute;right:8px;bottom:4px;font-size:10px;letter-spacing:1.5px;color:#8a8f98;font-weight:700;text-transform:uppercase;pointer-events:none}
.root.teil{padding:0;gap:0}
.teil .vp{border-radius:0}
@container (max-height:170px){.lcd .k{display:none}.prog{display:none}}
@container (max-width:340px){.pic{max-width:34%}.lcd{grid-template-columns:1fr 1fr}.lcd>div:nth-child(1){display:none}}
`;

class HtKuechengeraeteCard extends HTMLElement {
  static getStubConfig() { return {}; }
  static get rpTeile() { return { titel: { h: 26, art: 'shrink' }, geraete: { h: 230 }, punkte: { h: 16, art: 'shrink' } }; }
  static get rpDesign() { return { breite: 520, hoehe: 300 }; }
  static get rpOptionen() {
    return {
      titel: { name: 'Titel', typ: 'text', standard: 'Küchengeräte' },
      aktiv_zeigen: { name: 'Aktives Gerät zeigen', typ: 'schalter', standard: true, hinweis: 'Läuft ein Gerät oder ist es fertig, springt die Ansicht dorthin' },
      wechseln: { name: 'Automatisch blättern (s)', typ: 'zahl', standard: 0, min: 0, max: 120 },
    };
  }
  setConfig(cfg) {
    this._c = Object.assign({}, DEF, cfg || {});
    if (!Array.isArray(this._c.geraete) || !this._c.geraete.length) this._c.geraete = DEF.geraete;
    this._c.teil = this._c.teil ? String(this._c.teil) : null;
    if (this._c.teil) this._c.hintergrund = false;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      const r = this.shadowRoot;
      r.addEventListener('pointerdown', e => this._down(e));
      r.addEventListener('pointermove', e => this._move(e));
      r.addEventListener('pointerup', e => this._up(e));
      r.addEventListener('pointercancel', e => this._up(e, true));
      r.addEventListener('click', e => this._click(e), true);
    }
    this._k = keyOf(this._c);
    this._render();
  }
  connectedCallback() {
    if (!subs.has(this._k)) subs.set(this._k, new Set());
    subs.get(this._k).add(this);
    clearInterval(this._tm);
    this._tm = setInterval(() => this._tick(), 5000);
  }
  disconnectedCallback() { const s = subs.get(this._k); if (s) s.delete(this); clearInterval(this._tm); }
  set hass(h) {
    const old = this._hass; this._hass = h;
    const ids = this._ids(), chg = !old || ids.some(i => old.states[i] !== h.states[i]);
    if (chg) { this._autoJump(); this._render(); }
  }
  getCardSize() { return 4; }
  _ids() { return this._c.geraete.flatMap(g => g.typ === 'waschmaschine' ? [`sensor.${g.washer || 'ku_washer'}_status`] : [g.entity, ...((g.werte || []).map(w => w.entity))]).filter(Boolean); }
  get _i() { const o = IDX.get(this._k); const n = this._c.geraete.length; return o ? Math.min(n - 1, Math.max(0, o.i)) : 0; }
  _active(g) {
    const h = this._hass; if (!h) return null;
    if (g.typ === 'waschmaschine') { const s = h.states[`sensor.${g.washer || 'ku_washer'}_status`]; return s && ['laeuft', 'pausiert', 'fertig', 'fehler', 'geplant'].includes(s.state) ? s.state : null; }
    const s = g.entity && h.states[g.entity]; return s && ['on', 'running', 'heating', 'cooling'].includes(s.state) ? s.state : null;
  }
  _autoJump() {
    if (this._c.aktiv_zeigen === false || this._c.teil === 'titel') return;
    const o = IDX.get(this._k) || {}; if (o.user && Date.now() - o.user < 120000) return;   // nach Wischen 2 Min. in Ruhe lassen
    const G = this._c.geraete, cur = this._i;
    if (this._active(G[cur])) return;
    const j = G.findIndex(g => this._active(g)); if (j >= 0 && j !== cur) setIdx(this._k, j, false);
  }
  _tick() {
    const w = Number(this._c.wechseln) || 0, o = IDX.get(this._k) || {};
    if (w > 0 && !this._drag && (!o.user || Date.now() - o.user > 60000) && !this._active(this._c.geraete[this._i]) && this._c.teil !== 'titel' && this._c.teil !== 'punkte') {
      this._n = (this._n || 0) + 5;
      if (this._n >= w) { this._n = 0; setIdx(this._k, (this._i + 1) % this._c.geraete.length, false); }
    }
    this._render();
  }

  // ---------------------------------------------------------------- Darstellung
  _render() {
    if (!this.shadowRoot || !this._c) return;
    if (this._drag) return;
    const c = this._c, t = c.teil;
    const head = c.titel ? `<div class="head"><h2>${escH(c.titel)}</h2><span class="n">${this._i + 1}/${c.geraete.length}</span></div>` : '';
    const parts = { titel: head, geraete: this._vp(), punkte: this._dots() };
    const body = t ? (parts[t] || '') : head + parts.geraete + (c.geraete.length > 1 ? parts.punkte : '');
    const cls = t ? `root bare teil t-${escH(t)}` : `root ${c.hintergrund === false ? 'bare' : 'plate'}`;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="${cls}">${body}</div>`;
  }
  _vp() {
    const G = this._c.geraete, i = this._i;
    return `<div class="vp" id="vp"><div class="strip" id="strip" style="transform:translateX(${-i * 100}%)">${G.map((g, n) => `<div class="sl">${this._slide(g, n)}</div>`).join('')}</div>
      ${G.length > 1 ? `<div class="nav l" data-nav="-1">‹</div><div class="nav r" data-nav="1">›</div>` : ''}</div>`;
  }
  _dots() {
    const G = this._c.geraete, i = this._i;
    return `<div class="dots">${G.map((g, n) => { const a = this._active(g), col = a === 'fertig' ? C.ok : a === 'fehler' ? C.bad : C.run;
      return `<i class="${n === i ? 'on' : ''}${a ? ' act' : ''}" style="--c:${col}" data-dot="${n}" title="${escH(g.name || '')}"></i>`; }).join('')}</div>`;
  }
  _slide(g, n) {
    try { return g.typ === 'waschmaschine' ? this._washer(g, n) : this._generic(g); }
    catch (e) { return `<div class="sub">${escH(g.name || '')}: ${escH(e.message)}</div>`; }
  }
  _washer(g, n) {
    const h = this._hass, wid = g.washer || 'ku_washer', s = h && h.states[`sensor.${wid}_status`];
    const name = g.name || 'Waschmaschine';
    if (!s) return `<div class="pic" style="--c:${C.off}"><ha-icon icon="mdi:washing-machine-off"></ha-icon></div><div class="inf"><div class="nm"><b>${escH(name)}</b></div><div class="sub">washer_control nicht gefunden (sensor.${escH(wid)}_status)</div></div>`;
    const a = s.attributes || {}, st = s.state, [sn, col] = ST[st] || [a.state_name || st, C.info];
    const live = { remaining: a.remaining, phase_kind: a.phase_kind, door_open: a.door_open, door_locked: a.door_locked, remote: a.remote, error: a.error };
    const pic = window.HT_WM && window.HT_WM.svg ? window.HT_WM.svg(live, st, { id: `kg${n}${this._uidv || (this._uidv = Math.random().toString(36).slice(2, 6))}`, start: tD(a.planned_start), tankWarn: !!(a.detergent_warn || a.softener_warn) })
      : `<ha-icon icon="mdi:washing-machine"></ha-icon>`;
    let inf;
    if (st === 'fertig') {
      const at = tD(a.done_at);
      inf = `<div class="done"><b>Wäsche fertig</b><span>${escH(a.done_program || '')}${at ? ` · ${hm(at)} Uhr` : ''}</span><span>${at ? sinceT(at) : ''}</span>${a.anti_crease ? '<span style="color:#4dc3ff">↻ Knitterschutz aktiv</span>' : ''}</div>`;
    } else if (['laeuft', 'pausiert', 'geplant'].includes(st)) {
      const start = tD(a.start), end = tD(a.end), ps = tD(a.planned_start);
      const rem = end ? Math.max(0, (end - Date.now()) / 60000) : a.remaining;
      inf = `<div class="pr">${escH(a.program_name || 'Programm')}<small>${st === 'laeuft' ? escH(a.phase || '') : ''}${st === 'laeuft' && a.power != null ? ` · ${Math.round(a.power)} W` : ''}</small></div>
        <div class="lcd" style="--c:${col}"><div><div class="k">${st === 'geplant' ? 'Start' : 'Gestartet'}</div><div class="v">${start ? hm(start) : ps ? hm(ps) : '–'}</div></div>
        <div><div class="k">Rest</div><div class="v rest">${st === 'geplant' ? '–' : durHM(rem || 0)}</div></div>
        <div><div class="k">Ende</div><div class="v">${end ? hm(end) : '–'}</div></div></div>
        ${st !== 'geplant' ? `<div class="prog" style="--c:${col}"><i style="width:${a.progress || 0}%"></i></div>` : ''}`;
    } else {
      inf = `<div class="sub">${st === 'fehler' && a.error ? `Fehler ${escH(a.error)}` : a.remote ? 'Fernstart aktiv' : 'Fernstart aus'}</div>
        ${a.detergent_warn || a.softener_warn ? `<div class="sub" style="color:${C.bad}">${[a.detergent_warn && 'Waschmittel', a.softener_warn && 'Weichspüler'].filter(Boolean).join(' + ')} nachfüllen</div>` : ''}${Number(a.maintenance_due) ? `<div class="sub" style="color:${C.warn}">Wartung fällig: ${a.maintenance_due}</div>` : ''}`;
    }
    return `<div class="pic">${pic}</div><div class="inf" style="--c:${col}"><div class="nm"><b>${escH(name)}</b><span class="chip" style="--c:${col}">${escH(sn)}</span></div>${inf}</div>`;
  }
  _generic(g) {
    const h = this._hass, s = g.entity && h && h.states[g.entity], act = this._active(g), col = act ? C.run : s && s.state !== 'unavailable' ? C.info : C.off;
    const val = e => { const x = h && h.states[e.entity]; if (!x) return '–'; const v = e.attribute ? x.attributes[e.attribute] : x.state; const u = e.unit ?? x.attributes.unit_of_measurement ?? ''; return `${v}${u ? ' ' + u : ''}`; };
    return `<div class="pic" style="--c:${col}"><ha-icon icon="${escH(g.icon || (s && s.attributes.icon) || 'mdi:devices')}"></ha-icon></div><div class="inf">
      <div class="nm"><b>${escH(g.name || (s && s.attributes.friendly_name) || g.entity)}</b>${s ? `<span class="chip" style="--c:${col}">${escH(h.formatEntityState ? h.formatEntityState(s) : s.state)}</span>` : ''}</div>
      ${(g.werte || []).length ? `<div class="vals">${g.werte.map(w => `<div><div class="k">${escH(w.name || '')}</div><div class="v">${escH(val(w))}</div></div>`).join('')}</div>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- Wischen
  _down(e) {
    const vp = e.composedPath().find(x => x.id === 'vp'); if (!vp || this._c.geraete.length < 2 || e.target.closest && e.target.closest('[data-nav]')) return;
    this._drag = { x: e.clientX, y: e.clientY, w: vp.clientWidth, id: e.pointerId, dx: 0, on: false };
  }
  _move(e) {
    const d = this._drag; if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.on) { if (Math.abs(d.dx) < 8 || Math.abs(d.dx) < Math.abs(dy)) return; d.on = true; try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* */ } }
    const st = this.shadowRoot.getElementById('strip'); if (!st) return;
    const n = this._c.geraete.length, i = this._i;
    let dx = d.dx; if ((i === 0 && dx > 0) || (i === n - 1 && dx < 0)) dx /= 3;
    st.classList.add('drag'); st.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`;
  }
  _up(e, cancel) {
    const d = this._drag; if (!d || e.pointerId !== d.id) return;
    this._drag = null;
    if (!d.on) return;
    this._eat = Date.now();
    const n = this._c.geraete.length, i = this._i;
    let j = i;
    if (!cancel && Math.abs(d.dx) > Math.min(60, d.w * .18)) j = Math.max(0, Math.min(n - 1, i + (d.dx < 0 ? 1 : -1)));
    const st = this.shadowRoot.getElementById('strip'); if (st) { st.classList.remove('drag'); st.style.transform = `translateX(${-j * 100}%)`; }
    setTimeout(() => setIdx(this._k, j, true), 380);
  }
  _click(e) {
    if (this._eat && Date.now() - this._eat < 350) { e.stopPropagation(); e.preventDefault(); return; }
    const t = e.target.closest('[data-nav],[data-dot]'); if (!t) return;
    const n = this._c.geraete.length;
    const j = t.dataset.dot != null ? Number(t.dataset.dot) : (this._i + Number(t.dataset.nav) + n) % n;
    setIdx(this._k, j, true);
  }
}
if (!customElements.get(TAG)) customElements.define(TAG, HtKuechengeraeteCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === TAG)) window.customCards.push({ type: TAG, name: 'Home Twin: Küchengeräte', description: 'Smarte Küchengeräte zum Durchwischen (Waschmaschine u. a.)' });
console.info(`%c HOME-TWIN-KUECHENGERAETE %c ${VERSION} `, 'background:#4dc3ff;color:#000;font-weight:700', 'background:#222;color:#4dc3ff');
})();
