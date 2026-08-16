const items = document.querySelector('#items');

window.clipdeckSuggestions.onUpdate((payload) => {
  items.replaceChildren();
  for (const [index, item] of (payload.items || []).entries()) {
    const row = document.createElement('div');
    row.className = `item${index === 0 ? ' primary' : ''}`;
    const top = document.createElement('div');
    top.className = 'item-top';
    const trigger = document.createElement('code');
    trigger.textContent = item.trigger;
    const name = document.createElement('span');
    name.textContent = item.name;
    top.append(trigger, name);
    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.textContent = item.hasVariables ? `${item.preview}  ·  needs values` : item.preview;
    row.append(top, preview);
    items.appendChild(row);
  }
});
