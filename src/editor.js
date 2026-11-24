// Builderland editor: automatic first, then hand-edited.
// Paint parcels with brushes (forest, meadow, park, pond, road block, plaza, lots, a landmark slot,
// erase), drop single props, rotate with R, delete with ⌫, undo with ⌘Z. Painting past the edge grows
// the land. Edits live in the land JSON as `map` and `props`, so re-rolling the seed keeps them.
import { KIND_SIZE, KIND_LABEL } from './places.js';
import { CAR_MODELS } from './traffic.js';

export const BRUSH_UI = [
  ['forest', '🌲', 'Forest'], ['meadow', '🌼', 'Meadow'], ['park', '🛝', 'Park'], ['pond', '💧', 'Pond'],
  ['road', '🛣', 'Road block'], ['plaza', '⛲', 'Plaza'], ['lots', '🏡', 'Lots'], ['landmark', '🏛', 'Landmark'], ['none', '🧽', 'Erase'],
];
export const PROP_UI = [
  ['tree', '🌳', 'Tree'], ['pine', '🌲', 'Pine'], ['bush', '🌿', 'Bush'], ['flowers', '🌸', 'Flowers'], ['bench', '🪑', 'Bench'], ['lamp', '🏮', 'Lamp'],
  ['banner', '🚩', 'Banner'], ['billboard', '🪧', 'Billboard'], ['car', '🚗', 'Car'], ['capybara', '🦫', 'Capybara'], ['cat', '🐈', 'Cat'], ['person', '🧍', 'Person'],
  ['erase', '🧽', 'Remove'],
];
const BRUSH_COLOR = { forest: '#3F6E3A', meadow: '#F7D35C', park: '#17A398', pond: '#5C8FD6', road: '#7D7164', plaza: '#E6D9BC', lots: '#E4572E', landmark: '#7B61FF', none: '#2B2530' };

/**
 * Mounts the editor on the land. `state` holds map/props/places and is saved by `commit`.
 * `commit()` must save and rebuild the land without moving the camera.
 */
export function mountEditor({ land, state, commit, toast, panel, onToggle }) {
  const el = land.stage.renderer.domElement;
  let open = false;
  let tab = 'Paint';
  let tool = { kind: 'brush', v: 'forest' };
  let rot = 0;
  let landmarkId = '';
  let carN = 0, signN = 0;
  let stroke = null;
  let last = null;
  const snap = () => JSON.stringify({ map: state.map, props: state.props });
  let history = [snap()], at = 0;
  const record = () => { history = history.slice(0, at + 1); history.push(snap()); at = history.length - 1; if (history.length > 80) { history.shift(); at--; } };
  const restore = (s) => { const d = JSON.parse(s); state.map = d.map; state.props = d.props; commit(); render(); };
  const undo = () => { if (at > 0) restore(history[--at]); else toast('Nothing to undo'); };
  const redo = () => { if (at < history.length - 1) restore(history[++at]); };

  const landmarks = () => state.places.map((p, i) => ({ p, i })).filter(({ p }) => KIND_SIZE[p.kind] && KIND_SIZE[p.kind] !== 'half');
  const placeId = (p, i) => p.id || `place-${i}-${String(p.name || 'place').toLowerCase().replace(/\W+/g, '-')}`;

  function render() {
    const count = Object.keys(state.map).length + state.props.length;
    const btn = ([v, icon, label]) => `<button class="tool" data-v="${v}" aria-pressed="${(tab === 'Paint' ? tool.kind === 'brush' : tool.kind === 'prop') && tool.v === v}" title="${label}"><span>${icon}</span>${label}</button>`;
    const lm = landmarks();
    if (!landmarkId && lm.length) landmarkId = placeId(lm[0].p, lm[0].i);
    panel.innerHTML = `
      <div class="ehead"><strong>Edit your land</strong><button class="x" data-act="close" aria-label="Close">✕</button></div>
      <div class="etabs">${['Paint', 'Place'].map((t) => `<button data-tab="${t}" aria-selected="${t === tab}">${t === 'Paint' ? 'Paint parcels' : 'Place things'}</button>`).join('')}</div>
      <div class="tools">${(tab === 'Paint' ? BRUSH_UI : PROP_UI).map(btn).join('')}</div>
      ${tab === 'Paint' && tool.v === 'landmark' ? `<label class="field">Which landmark<select data-act="lm">${lm.map(({ p, i }) => `<option value="${placeId(p, i)}" ${placeId(p, i) === landmarkId ? 'selected' : ''}>${p.name} · ${KIND_LABEL[p.kind]}</option>`).join('')}</select></label>` : ''}
      <div class="erow">
        <button class="btn sm" data-act="undo" ${at > 0 ? '' : 'disabled'}>↶ Undo</button>
        <button class="btn sm" data-act="redo" ${at < history.length - 1 ? '' : 'disabled'}>↷ Redo</button>
        <button class="btn sm" data-act="reset" ${count ? '' : 'disabled'}>Clear edits</button>
      </div>
      <div class="hint">${tab === 'Paint'
        ? 'Click or drag across the land to paint whole parcels. Paint past the edge to grow the land. Right-drag orbits, scroll zooms.'
        : 'Click to drop. <b>R</b> rotates, <b>⌫</b> removes the thing under the cursor.'} <b>⌘Z</b> undoes. Your edits survive a new seed.</div>`;
    panel.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; tool = tab === 'Paint' ? { kind: 'brush', v: 'forest' } : { kind: 'prop', v: 'tree' }; land.setCursor(null); render(); }));
    panel.querySelectorAll('.tool').forEach((b) => (b.onclick = () => { tool = { kind: tab === 'Paint' ? 'brush' : 'prop', v: b.dataset.v }; render(); }));
    panel.querySelector('[data-act=close]').onclick = () => toggle(false);
    panel.querySelector('[data-act=undo]').onclick = undo;
    panel.querySelector('[data-act=redo]').onclick = redo;
    panel.querySelector('[data-act=reset]').onclick = () => { state.map = {}; state.props = []; record(); commit(); render(); toast('Hand edits cleared. The land is automatic again.'); };
    const sel = panel.querySelector('[data-act=lm]');
    if (sel) sel.onchange = () => (landmarkId = sel.value);
  }

  const snapXZ = (v) => Math.round(v * 4) / 4;
  const nextProp = (g) => {
    const pr = { type: tool.v, x: snapXZ(g.x), z: snapXZ(g.z), rot };
    if (tool.v === 'car') pr.model = CAR_MODELS[carN % CAR_MODELS.length];
    if (tool.v === 'banner' || tool.v === 'billboard') pr.sign = signN;
    return pr;
  };
  function hover(e) {
    const g = land.pickGround(e.clientX, e.clientY);
    last = { x: e.clientX, y: e.clientY, g };
    if (!g) { land.setCursor(null); return; }
    if (tool.kind === 'brush') {
      if (stroke && tool.v !== 'landmark') stroke.set(`${g.i},${g.j}`, [g.i, g.j]);
      const cells = stroke ? [...stroke.values()] : [[g.i, g.j]];
      land.setCursor({ cells, color: BRUSH_COLOR[tool.v] });
    } else if (tool.v === 'erase') land.setCursor(null);
    else land.setCursor({ prop: nextProp(g) });
  }
  el.addEventListener('pointermove', (e) => { if (open) hover(e); });
  el.addEventListener('pointerdown', (e) => {
    if (!open || e.button !== 0) return;
    const g = land.pickGround(e.clientX, e.clientY);
    if (!g) return;
    if (tool.kind === 'brush') { stroke = new Map([[`${g.i},${g.j}`, [g.i, g.j]]]); hover(e); return; }
    if (tool.v === 'erase') { remove(e.clientX, e.clientY); return; }
    state.props.push(nextProp(g));
    if (tool.v === 'car') carN++;
    if (tool.v === 'banner' || tool.v === 'billboard') signN++;
    record(); commit(); render();
  });
  addEventListener('pointerup', () => {
    if (!open || !stroke) return;
    const cells = [...stroke.keys()];
    stroke = null;
    const v = tool.v === 'landmark' ? `place:${landmarkId}` : tool.v;
    if (tool.v === 'landmark') {
      if (!landmarkId) { toast('Add a landmark in Build → Places first'); return; }
      for (const [k, val] of Object.entries(state.map)) if (val === v) delete state.map[k];   // a landmark lives in one place
    }
    for (const k of cells) state.map[k] = v;
    record(); commit(); render();
  });
  function remove(cx, cy) {
    const n = land.pickProp(cx, cy);
    if (n < 0) { toast('Point at something you placed to remove it'); return; }
    state.props.splice(n, 1);
    record(); commit(); render();
  }
  addEventListener('keydown', (e) => {
    if (!open || e.target.matches('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'r' || e.key === 'R') { rot = (rot + Math.PI / 4) % (Math.PI * 2); if (last?.g && tool.kind === 'prop' && tool.v !== 'erase') land.setCursor({ prop: nextProp(last.g) }); }
    if ((e.key === 'Backspace' || e.key === 'Delete') && last) { e.preventDefault(); remove(last.x, last.y); }
    if (e.key === 'Escape') toggle(false);
  });

  function toggle(on = !open) {
    open = on;
    panel.classList.toggle('on', on);
    land.setEditing(on);
    if (on) { land.unfocus?.(); render(); }
    onToggle?.(on);
  }
  /** Call when the land was replaced from outside (import, reset) so undo starts fresh. */
  const resetHistory = () => { history = [snap()]; at = 0; if (open) render(); };
  return { toggle, get open() { return open; }, resetHistory };
}
