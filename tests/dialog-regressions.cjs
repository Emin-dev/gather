/** Exact production-function regression tests with a deterministic DOM/storage shim.
 * No browser, IndexedDB implementation, native focus or accessibility-tree claim.
 * GATHER_APP_SOURCE optionally tests an unmodified baseline against these assertions.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.GATHER_APP_SOURCE || path.join(__dirname, '../web/app.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing production section: ${start}`);
  return source.slice(a, b);
}
class Node {
  constructor(tag, document) {
    this.tag = tag; this.document = document; this.attrs = {}; this.children = [];
    this.listeners = {}; this.value = ''; this.disabled = false; this.parent = null;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  append(...nodes) { for (const n of nodes) { if (n instanceof Node) n.parent = this; this.children.push(n); } }
  replaceChildren(...nodes) { for (const n of this.children) if (n instanceof Node) n.parent = null; this.children = []; this.append(...nodes); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; } }
  get textContent() { return this.children.map(n => n instanceof Node ? n.textContent : n).join(''); }
  set textContent(v) { this.replaceChildren(String(v)); }
  get lastElementChild() { return this.children.filter(n => n instanceof Node).at(-1); }
  contains(n) { return n === this || this.children.some(c => c instanceof Node && c.contains(n)); }
  querySelectorAll(selector) {
    return nodes(this).slice(1).filter(n => selector.startsWith('#') ? n.attrs.id === selector.slice(1)
      : selector === '[data-focus]' ? 'data-focus' in n.attrs
      : selector === '[data-review-action="request-changes"]' ? n.attrs['data-review-action'] === 'request-changes'
      : n.tag === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getClientRects() { return [{}]; }
  focus() { this.document.activeElement = this; }
}
function nodes(root) { return [root, ...root.children.flatMap(n => n instanceof Node ? nodes(n) : [])]; }
function harness(action) {
  const document = { activeElement: null, createTextNode: s => String(s) };
  document.createElement = tag => new Node(tag, document);
  const modal = new Node('dialog', document), app = new Node('main', document), heading = new Node('h2', document);
  document.getElementById = () => heading;
  modal.open = false; modal.closes = 0;
  modal.showModal = () => { modal.open = true; };
  modal.close = () => { modal.open = false; modal.closes++; };
  const item = { id: 1, version: 1, status: action === 'submit' ? 'missing' : 'submitted', requirement: { title: 'Original asset', instructions: 'Supply a PDF.', formats: ['pdf'] } };
  if (action !== 'submit') item.file = { name: 'asset.pdf', size: 1, sha256: 'sha', content: 'WA==' };
  const state = { revision: 1, project_id: 'original', items: [item] };
  const pending = [], messages = [];
  let saved = state, renders = 0;
  const c = vm.createContext({
    Node, document, modal, app, state, role: action === 'submit' || action === 'sample' ? 'recipient' : 'owner', filter: 'submitted',
    busy: false, generation: 1, activeReader: null, dialogReturnFocusKey: 'item-1', MAX_FILE: 2097152,
    icon: () => new Node('svg', document), statusBadge: () => new Node('span', document),
    formatSize: String, crypto: { randomUUID: () => 'created' }, toast: (...m) => messages.push(m),
    render: () => { renders++; }, readAsBase64: async () => 'WA==', fromBase64: () => new Uint8Array(), downloadBytes() {},
    sampleBytes: () => new Uint8Array(), File: class { constructor(_, name) { this.name = name; this.size = 1; } },
    core(command, current = c.state) {
      if (command.op === 'validate') return { state: current };
      const next = JSON.parse(JSON.stringify(current)); next.revision++;
      if (command.op === 'create') next.project_id = 'created';
      if (command.op === 'sample') next.project_id = 'sample';
      if (command.op === 'accept') next.items[0].status = 'accepted';
      if (command.op === 'submit') next.items[0].status = 'submitted';
      if (command.op === 'request_changes') next.items[0].status = 'changes_requested';
      return { state: next };
    },
    commit(next, previous) { assert.equal(previous, c.state); return new Promise((resolve, reject) => pending.push({ next, resolve() { saved = next; resolve(); }, reject })); },
    readState: async () => saved,
  });
  vm.runInContext(section('function el(', 'function toast(')
    + section('async function mutation(', 'function statusBadge(')
    + section('function openItem(', 'function readAsBase64(')
    + section('function templateRequirements(', 'async function boot('), c);
  return { c, modal, pending, messages, document, renders: () => renders, saved: () => saved,
    run: expression => vm.runInContext(expression, c),
    button(name) { const n = nodes(modal).find(n => n.tag === 'button' && n.textContent === name); assert(n, `Button ${name}`); return n; },
    click(name) { return this.button(name).listeners.click(); },
  };
}
async function start(h, action) {
  if (action === 'create') { h.run('newPacket()'); h.modal.querySelector('input').value = 'Created packet'; }
  else if (action === 'sample') h.run('resetDemo()');
  else { h.run('openItem(1)'); if (action === 'request_changes') { h.click('Request changes'); h.modal.querySelector('textarea').value = 'Please revise.'; }
    if (action === 'submit') { const input = h.modal.querySelector('input'); input.files = [{ name: 'asset.pdf', size: 1 }]; await input.listeners.change(); } }
  const names = { accept: 'Accept this version', submit: 'Submit for review', request_changes: 'Send revision request', create: 'Create and replace packet', sample: 'Reset to sample' };
  const original = h.modal.lastElementChild, originalError = nodes(original).find(n => n.attrs.role === 'alert');
  const button = h.button(names[action]), completion = button.listeners.click();
  assert.equal(h.pending.length, 1); assert.equal(h.c.busy, true);
  return { completion, button, original, originalError };
}
function captureNewDraft(h, closeFirst = true) {
  if (closeFirst) h.run('closeDialog()');
  h.run('newPacket()');
  const body = h.modal.lastElementChild;
  const fields = nodes(body).filter(n => ['input', 'textarea', 'select'].includes(n.tag));
  fields.forEach((n, i) => { n.value = `Unsaved draft ${i}`; });
  fields[0].focus();
  return { body, fields, values: fields.map(n => n.value), focused: h.document.activeElement, role: h.c.role, filter: h.c.filter, closes: h.modal.closes, messages: h.messages.length };
}
function assertDraft(h, draft) {
  assert.equal(h.modal.open, true, 'The newer dialog must stay open');
  assert.equal(h.modal.lastElementChild, draft.body, 'The newer body must remain');
  assert.deepEqual(draft.fields.map(n => n.value), draft.values, 'Typed values must remain');
  assert.equal(h.document.activeElement, draft.focused, 'Old completion must not move focus');
  assert.equal(h.modal.closes, draft.closes, 'Old completion must not close a dialog');
  assert.equal(h.c.role, draft.role, 'Old completion must not reset the current role');
  assert.equal(h.c.filter, draft.filter, 'Old completion must not reset the current filter');
  assert.equal(h.messages.length, draft.messages, 'Old completion must not show stale success/error');
}
async function main() {
  let passed = 0, failed = 0;
  async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
  const actions = ['accept', 'submit', 'request_changes', 'create', 'sample'];
  for (const action of actions) {
    for (const closeFirst of [true, false]) for (const fail of [false, true]) {
      await test(`${action}: ${fail ? 'rejected' : 'committed'} old save preserves ${closeFirst ? 'closed then reopened' : 'direct replacement'} draft`, async () => {
        const h = harness(action), old = await start(h, action), previous = h.c.state;
        const draft = captureNewDraft(h, closeFirst);
        if (fail) h.pending[0].reject(Error('Save rejected')); else h.pending[0].resolve();
        await old.completion;
        assertDraft(h, draft); assert.equal(h.c.busy, false);
        assert.equal(h.c.state, fail ? previous : h.pending[0].next, 'Completed save must still update state');
        assert.equal(h.saved(), fail ? previous : h.pending[0].next, 'Committed state is not discarded');
        if (old.originalError) assert.equal(old.originalError.textContent, '', 'No stale detached error writes');
      });
    }
    for (const fail of [false, true]) await test(`${action}: ${fail ? 'failure' : 'success'} after dismissal stays dismissed`, async () => {
      const h = harness(action), old = await start(h, action);
      h.run('closeDialog()'); const closes = h.modal.closes, focus = h.document.activeElement;
      if (fail) h.pending[0].reject(Error('Save rejected')); else h.pending[0].resolve();
      await old.completion; assert.equal(h.modal.open, false); assert.equal(h.modal.closes, closes);
      assert.equal(h.document.activeElement, focus); assert.equal(h.messages.length, 0);
    });
    await test(`${action}: current successful save keeps normal completion behavior and prevents duplicate writes`, async () => {
      const h = harness(action), old = await start(h, action);
      await old.button.listeners.click(); assert.equal(h.pending.length, 1);
      h.pending[0].resolve(); await old.completion;
      assert.equal(h.modal.open, false); assert.equal(h.modal.closes, 1); assert.equal(h.messages.length, 1);
      assert.equal(h.c.state, h.pending[0].next); assert.equal(h.c.busy, false);
      if (action === 'create') { assert.equal(h.c.role, 'recipient'); assert.equal(h.c.filter, 'all'); }
      if (action === 'sample') { assert.equal(h.c.role, 'owner'); assert.equal(h.c.filter, 'all'); }
    });
    await test(`${action}: current failed save exposes the error and allows retry`, async () => {
      const h = harness(action), old = await start(h, action);
      h.pending[0].reject(Error('Save rejected')); await old.completion;
      assert.equal(h.modal.open, true); assert.equal(h.modal.lastElementChild, old.original); assert.equal(h.c.busy, false);
      if (action === 'sample') assert.deepEqual(h.messages, [['Save rejected', true]]);
      else assert.equal(old.originalError.textContent, 'Save rejected');
      if (action === 'submit') assert.equal(old.button.disabled, false);
      const retry = old.button.listeners.click(); assert.equal(h.pending.length, 2); h.pending[1].resolve(); await retry;
      assert.equal(h.modal.open, false);
    });
  }
  await test('pending acceptance cannot replace its controls with a new revision draft in the same body', async () => {
    const h = harness('accept'), old = await start(h, 'accept');
    h.click('Request changes');
    assert.equal(h.modal.querySelector('textarea'), null, 'Wait for acceptance before opening a revision editor');
    h.pending[0].resolve(); await old.completion;
    assert.equal(h.modal.open, false); assert.equal(h.c.state.items[0].status, 'accepted');
    h.run('openItem(1)'); h.click('Request changes');
    assert(h.modal.querySelector('textarea'), 'Revision remains available after acceptance completes');
  });
  for (const fail of [false, true]) await test(`revision Cancel/Back invalidates ${fail ? 'failed' : 'successful'} save completion without stealing review focus`, async () => {
    const h = harness('request_changes'), old = await start(h, 'request_changes');
    h.click('Cancel'); const body = h.modal.lastElementChild, focused = h.document.activeElement;
    assert.equal(focused.getAttribute('data-review-action'), 'request-changes');
    if (fail) h.pending[0].reject(Error('Save rejected')); else h.pending[0].resolve();
    await old.completion; assert.equal(h.modal.open, true); assert.equal(h.modal.lastElementChild, body);
    assert.equal(h.document.activeElement, focused); assert.equal(h.messages.length, 0);
  });
  await test('a newer packet can be saved after an older acceptance finishes without losing its draft', async () => {
    const h = harness('accept'), old = await start(h, 'accept'), draft = captureNewDraft(h);
    h.pending[0].resolve(); await old.completion; assertDraft(h, draft);
    const next = h.click('Create and replace packet'); assert.equal(h.pending.length, 2);
    h.pending[1].resolve(); await next;
    assert.equal(h.c.state.project_id, 'created'); assert.equal(h.modal.open, false); assert.equal(h.c.role, 'recipient');
  });
  await test('new-packet labels contain the exact visible phrase and unique item context after add/remove', () => {
    const h = harness('accept'); h.run('newPacket()');
    function checkLabels() {
      const names = [];
      for (const label of nodes(h.modal).filter(n => n.tag === 'label')) {
        const control = label.children.find(n => n instanceof Node && ['input', 'textarea', 'select'].includes(n.tag));
        if (!control) continue;
        const visible = label.children.filter(n => n !== control).map(n => n instanceof Node ? n.textContent : n).join('').trim();
        const name = control.attrs['aria-label'] || visible;
        assert(name.includes(visible), `${JSON.stringify(name)} must include ${JSON.stringify(visible)}`); names.push(name);
      }
      assert.equal(new Set(names).size, names.length, 'All field names are distinct');
    }
    checkLabels(); h.click('Add a requirement'); checkLabels(); h.click('Remove'); checkLabels();
  });
  await test('revision feedback accessible label contains its visible question', () => {
    const h = harness('accept'); h.run('openItem(1)'); h.click('Request changes');
    const field = h.modal.querySelector('textarea');
    const visible = field.parent.children.filter(n => n !== field).map(n => n.textContent).join('');
    assert(field.attrs['aria-label'].includes(visible)); assert(field.attrs['aria-label'].includes('Revision feedback'));
  });
  console.log(`${passed} dialog ownership/name source-shim checks passed; ${failed} failed. Not a browser test.`);
  if (failed) throw Error(`${failed} dialog regression checks failed`);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = main;
