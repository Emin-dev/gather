/** Real-DOM regression coverage, called by browser.cjs on a supported browser.
 * Production source is unmodified. A test-only IndexedDB transaction-completion
 * gate makes already-committed writes wait before notifying the UI.
 */
const assert = require('node:assert/strict');
module.exports = async function dialogBrowserChecks(page, check) {
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const close = async () => { await click('Close dialog'); };
  const newPacket = () => page.getByRole('button', { name: 'New packet', exact: true }).first().click();
  const reset = async () => {
    if (await page.locator('dialog[open]').count()) await close();
    await page.getByRole('button', { name: 'Reset demo', exact: true }).last().click();
    await click('Reset to sample'); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
  };
  const gateSave = () => page.evaluate(() => {
    const prototype = IDBDatabase.prototype, original = prototype.transaction;
    const gate = window.__gatherSaveGate = { ready: false };
    prototype.transaction = function (...args) {
      const tx = original.apply(this, args);
      if (args[1] !== 'readwrite') return tx;
      prototype.transaction = original;
      let p = tx, descriptor;
      while (p && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(p, 'oncomplete'); p = Object.getPrototypeOf(p); }
      if (!descriptor?.set) throw Error('IndexedDB completion accessor unavailable');
      Object.defineProperty(tx, 'oncomplete', {
        configurable: true,
        set(handler) {
          descriptor.set.call(tx, event => {
            gate.ready = true;
            gate.release = async () => {
              handler.call(tx, event);
              // Run the mutation and initiating async handler's promise continuations.
              await new Promise(resolve => setTimeout(resolve, 0));
            };
          });
        },
      });
      return tx;
    };
  });
  const releaseSave = () => page.evaluate(async () => {
    await window.__gatherSaveGate.release(); delete window.__gatherSaveGate;
  });
  const prepare = async action => {
    await reset();
    if (action === 'submit' || action === 'sample') await click('Recipient');
    if (action === 'create') {
      await newPacket();
      await page.getByLabel('Project title', { exact: true }).fill('First saved packet');
      await page.getByLabel('Client or team label', { exact: true }).fill('Synthetic studio');
    } else if (action === 'sample') {
      await page.getByRole('navigation', { name: 'Filter assets' }).getByRole('button', { name: 'To review', exact: true }).click();
      await page.getByRole('button', { name: 'Reset demo', exact: true }).last().click();
    } else if (action === 'submit') {
      await click('Open Project details'); await click('Use a synthetic sample file');
      await page.getByRole('button', { name: 'Submit for review', exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('dialog button')].some(b => b.textContent === 'Submit for review' && !b.disabled));
    } else {
      await click('Review ' + (action === 'accept' ? 'Website copy' : 'Brand guidelines'));
      if (action === 'request_changes') {
        await click('Request changes');
        await page.getByRole('textbox', { name: 'What needs a little more work? Revision feedback', exact: true }).fill('Please revise the synthetic asset.');
      }
    }
  };
  const actionNames = { accept: 'Accept this version', submit: 'Submit for review', request_changes: 'Send revision request', create: 'Create and replace packet', sample: 'Reset to sample' };
  for (const action of Object.keys(actionNames)) await check(`${action}: native IndexedDB completion preserves a newer dialog, draft and focus`, async () => {
    await prepare(action); await gateSave(); await click(actionNames[action]);
    await page.waitForFunction(() => window.__gatherSaveGate.ready);
    if (action === 'accept') {
      await click('Request changes');
      assert.equal(await page.getByRole('textbox', { name: 'What needs a little more work? Revision feedback', exact: true }).count(), 0);
    }
    await page.keyboard.press('Escape'); await newPacket();
    await page.getByLabel('Start with a template', { exact: true }).selectOption('custom');
    await page.getByLabel('Project title', { exact: true }).fill('Keep this unsaved project');
    await page.getByLabel('Client or team label', { exact: true }).fill('Keep this unsaved client');
    await page.getByLabel('Item title, item 1', { exact: true }).fill('Keep this requirement');
    await page.getByLabel('Instructions for the recipient, item 1', { exact: true }).fill('Keep these instructions');
    const snapshot = () => page.evaluate(() => ({
      open: document.querySelector('dialog').open,
      title: document.querySelector('#dialog-title')?.textContent,
      fields: [...document.querySelectorAll('dialog input, dialog textarea, dialog select')].map(n => n.value),
      focus: document.activeElement?.getAttribute('aria-label'),
      role: document.querySelector('[aria-pressed="true"]')?.textContent,
      filter: document.querySelector('.filters [aria-current="page"]')?.textContent,
      notice: document.querySelector('#notice').textContent,
    }));
    const before = await snapshot(); await releaseSave(); assert.deepEqual(await snapshot(), before);
    await close(); await page.reload();
    if (action === 'create') await page.getByRole('heading', { name: 'First saved packet', exact: true }).waitFor();
    else {
      await page.getByRole('heading', { name: 'A little closer to launch.', exact: true }).waitFor();
      const expected = action === 'accept' ? '3 of 5 assets accepted' : action === 'request_changes' ? '1 of 5 assets accepted' : '2 of 5 assets accepted';
      await page.getByText(expected, { exact: true }).waitFor();
      if (action === 'submit') {
        await click('Review Project details'); await page.getByRole('button', { name: 'Accept this version', exact: true }).waitFor(); await close();
      }
    }
  });
  await check('revision Cancel/Back keeps rebuilt review open and focused after native completion', async () => {
    await prepare('request_changes'); await gateSave(); await click('Send revision request');
    await page.waitForFunction(() => window.__gatherSaveGate.ready); await click('Cancel');
    const focusedBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-review-action'));
    assert.equal(focusedBefore, 'request-changes'); await releaseSave();
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-review-action')), 'request-changes');
  });
  await check('real DOM role/name locators include visible labels and unique renumbered item context', async () => {
    await reset(); await newPacket();
    async function inspect() {
      const count = await page.locator('.requirement-editor').count();
      assert.equal(await page.getByRole('combobox', { name: 'Start with a template', exact: true }).count(), 1);
      assert.equal(await page.getByRole('textbox', { name: 'Client or team label', exact: true }).count(), 1);
      for (let i = 1; i <= count; i++) {
        assert.equal(await page.getByRole('textbox', { name: `Item title, item ${i}`, exact: true }).count(), 1);
        assert.equal(await page.getByRole('textbox', { name: `Instructions for the recipient, item ${i}`, exact: true }).count(), 1);
        assert.equal(await page.getByRole('combobox', { name: `Allowed file types, item ${i}`, exact: true }).count(), 1);
      }
    }
    await inspect(); await click('Add a requirement'); await inspect();
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click(); await inspect();
  });
  await reset();
};
