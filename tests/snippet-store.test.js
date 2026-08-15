const test = require('node:test');
const assert = require('node:assert/strict');
const { SnippetStore, extractVariables, renderTemplate } = require('../src/snippet-store');

test('extracts unique template variables in order', () => {
  assert.deepEqual(extractVariables('Hello {{name}}, meet {{name}} on {{date}}.'), ['name', 'date']);
});

test('renders template variables', () => {
  assert.equal(renderTemplate('Hello {{ name }}!', { name: 'Yavuz' }), 'Hello Yavuz!');
});

test('saves and updates snippets', () => {
  const store = new SnippetStore();
  const first = store.save({ name: 'Greeting', template: 'Hello {{name}}' }, 100);
  assert.equal(store.list().length, 1);
  assert.deepEqual(first.variables, ['name']);
  store.save({ id: first.id, name: 'Greeting 2', template: 'Hi {{name}}' }, 200);
  const items = store.list();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Greeting 2');
  assert.equal(items[0].updatedAt, 200);
});
