
// Family Grocery - LocalStorage PWA
const LS_KEY = "family_grocery_items_v1";

const defaultStores = ["Walmart", "Sam's Club", "Costco", "Other"];

let state = {
  items: loadItems(),
  filter: "All"
};

function loadItems(){
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch(e){
    return [];
  }
}

function saveItems(){
  localStorage.setItem(LS_KEY, JSON.stringify(state.items));
}

function uid(){
  return Math.random().toString(36).slice(2,10);
}

// UI refs
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("nameInput");
const qtyInput = document.getElementById("qtyInput");
const storeInput = document.getElementById("storeInput");
const listsEl = document.getElementById("lists");
const suggestionsEl = document.getElementById("suggestions");
const rememberedEl = document.getElementById("remembered");
const clearCheckedBtn = document.getElementById("clearCheckedBtn");
const markAllBtn = document.getElementById("markAllBtn");
const exportBtn = document.getElementById("exportBtn");

// Event: add item
addForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const name = nameInput.value.trim();
  const qty = parseInt(qtyInput.value || "1", 10);
  const store = storeInput.value;
  if(!name) return;
  state.items.push({
    id: uid(),
    name, qty, store,
    needed: true,
    purchaseCount: 0,
    lastPurchasedAt: null
  });
  saveItems();
  nameInput.value = "";
  qtyInput.value = 1;
  render();
});

// Filters
document.querySelectorAll(".chip").forEach(chip=>{
  chip.addEventListener("click", ()=>{
    document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
    chip.classList.add("active");
    state.filter = chip.dataset.filter;
    render();
  });
});

// Clear purchased
clearCheckedBtn.addEventListener("click", ()=>{
  state.items = state.items.filter(it => it.needed);
  saveItems();
  render();
});

// Mark all needed
markAllBtn.addEventListener("click", ()=>{
  state.items = state.items.map(it => ({...it, needed:true}));
  saveItems();
  render();
});

// Export JSON
exportBtn.addEventListener("click", ()=>{
  const data = JSON.stringify(state.items, null, 2);
  const blob = new Blob([data], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "family-grocery-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

function incrementPurchase(id){
  state.items = state.items.map(it => it.id===id ? {...it, needed:false, purchaseCount: it.purchaseCount+1, lastPurchasedAt: Date.now()} : it);
  saveItems();
  render();
}

function updateQty(id, qty){
  state.items = state.items.map(it => it.id===id ? {...it, qty: Math.max(1, qty)} : it);
  saveItems();
}

function toggleNeeded(id){
  state.items = state.items.map(it => it.id===id ? {...it, needed: !it.needed} : it);
  saveItems();
  render();
}

function removeItem(id){
  state.items = state.items.filter(it => it.id!==id);
  saveItems();
  render();
}

function render(){
  // Suggestions based on typed name: top 8 frequent names
  const byName = {};
  state.items.forEach(it => {
    const key = it.name.toLowerCase();
    if(!byName[key]) byName[key] = {name: it.name, count:0};
    byName[key].count += (it.purchaseCount >= 1 ? it.purchaseCount : 0);
  });
  const top = Object.values(byName).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,8);
  suggestionsEl.innerHTML = "";
  if (top.length){
    suggestionsEl.classList.remove("hidden");
    top.forEach(s => {
      const tag = document.createElement("button");
      tag.className = "tag";
      tag.textContent = s.name;
      tag.addEventListener("click", ()=>{
        nameInput.value = s.name;
        nameInput.focus();
      });
      suggestionsEl.appendChild(tag);
    });
  } else {
    suggestionsEl.classList.add("hidden");
  }

  // Lists by store, filtered
  const stores = ["Walmart", "Sam's Club", "Costco", "Other"];
  listsEl.innerHTML = "";
  const activeFilter = state.filter;

  stores.forEach(store => {
    const list = state.items
      .filter(it => (activeFilter==="All" || it.store===activeFilter) && it.store===store)
      .sort((a,b)=> Number(b.needed) - Number(a.needed));

    const section = document.createElement("div");
    section.className = "list";
    const h3 = document.createElement("h3");
    h3.textContent = store;
    section.appendChild(h3);

    if (list.length===0){
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No items for this store.";
      section.appendChild(p);
    } else {
      list.forEach(it => {
        const row = document.createElement("div");
        row.className = "item";

        const left = document.createElement("div");
        left.className = "left";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !it.needed;
        cb.addEventListener("change", ()=> toggleNeeded(it.id));

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = it.name;

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `Qty ${it.qty}${it.purchaseCount>=2 ? " • Fav" : ""}`;

        left.appendChild(cb);
        left.appendChild(name);
        left.appendChild(meta);

        const right = document.createElement("div");
        right.style.display = "flex";
        right.style.gap = "6px";
        right.style.alignItems = "center";

        const qtyInput = document.createElement("input");
        qtyInput.type = "number";
        qtyInput.min = "1";
        qtyInput.value = it.qty;
        qtyInput.className = "input";
        qtyInput.style.width = "72px";
        qtyInput.addEventListener("change", (e)=> updateQty(it.id, parseInt(e.target.value||"1",10)));

        const buyBtn = document.createElement("button");
        buyBtn.className = "btn primary";
        buyBtn.textContent = "Purchased";
        buyBtn.addEventListener("click", ()=> incrementPurchase(it.id));

        const delBtn = document.createElement("button");
        delBtn.className = "btn ghost";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", ()=> removeItem(it.id));

        right.appendChild(qtyInput);
        right.appendChild(buyBtn);
        right.appendChild(delBtn);

        row.appendChild(left);
        row.appendChild(right);

        section.appendChild(row);
      });
    }

    listsEl.appendChild(section);
  });

  // Remembered items: purchased 2+ times
  const remembered = Object.values(
    state.items.reduce((acc, it)=>{
      const key = it.name.toLowerCase();
      if(!acc[key]) acc[key] = { name: it.name, total:0 };
      if (it.purchaseCount >= 2) acc[key].total += it.purchaseCount;
      return acc;
    }, {})
  ).filter(x=>x.total>0).sort((a,b)=>b.total-a.total).slice(0,20);

  rememberedEl.innerHTML = "";
  if (remembered.length === 0){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No favorites yet. Mark items as Purchased a couple of times to remember them here.";
    rememberedEl.appendChild(p);
  } else {
    remembered.forEach(r=>{
      const pill = document.createElement("div");
      pill.className = "pill";
      const span = document.createElement("span");
      span.textContent = r.name;
      pill.appendChild(span);
      defaultStores.forEach(store=>{
        const btn = document.createElement("button");
        btn.textContent = `Add to ${store}`;
        btn.addEventListener("click", ()=>{
          state.items.push({
            id: uid(),
            name: r.name,
            qty: 1,
            store,
            needed: true,
            purchaseCount: 0,
            lastPurchasedAt: null
          });
          saveItems();
          render();
        });
        pill.appendChild(btn);
      });
      rememberedEl.appendChild(pill);
    });
  }
}

render();

// Register service worker for offline use
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}
