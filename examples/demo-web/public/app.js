/**
 * CrossPlay demo shop (B-026): login → inventory list → item detail.
 * Mirrors the Android demo apps' screens so one spec runs everywhere (FR-070).
 *
 * Deliberately asynchronous: login takes ~400ms behind a spinner and the list
 * items fade in — a suite without auto-waiting flakes here (FR-040 showcase).
 */
const ITEMS = [
  { id: 1, name: 'Trace Recorder', price: '$29', blurb: 'Every step, every screenshot, one portable file.' },
  { id: 2, name: 'Auto Waiter', price: '$49', blurb: 'Present, visible, stable, enabled — then act.' },
  { id: 3, name: 'Selector Unifier', price: '$19', blurb: 'One testId for web and Android.' },
  { id: 4, name: 'Flake Eliminator', price: '$99', blurb: '0 failures in 50 runs, or your money back.' },
  { id: 5, name: 'Doctor Kit', price: '$9', blurb: 'Diagnoses your environment in seconds.' },
];
const VALID = { user: 'demo', pass: 'crossplay' };
const app = document.getElementById('app');

function loginScreen(message) {
  app.innerHTML = `
    <h1>Demo Shop</h1>
    <p data-testid="login_hint">Sign in with demo / crossplay</p>
    <input data-testid="username" placeholder="Username" autocomplete="username" />
    <input data-testid="password" placeholder="Password" type="password" autocomplete="current-password" />
    <button data-testid="login_button">Sign in</button>
    <p class="error ${message ? '' : 'hidden'}" data-testid="login_error">${message ?? ''}</p>
  `;
  document.querySelector('[data-testid="login_button"]').addEventListener('click', () => {
    const user = document.querySelector('[data-testid="username"]').value;
    const pass = document.querySelector('[data-testid="password"]').value;
    app.innerHTML = `<p id="spinner" data-testid="spinner">Signing in…</p>`;
    setTimeout(() => {
      if (user === VALID.user && pass === VALID.pass) listScreen();
      else loginScreen('Wrong username or password');
    }, 400);
  });
}

function listScreen() {
  app.innerHTML = `
    <h1>Inventory</h1>
    <p data-testid="greeting">Welcome back, demo</p>
    <ul data-testid="item_list"></ul>
    <button data-testid="logout_button">Log out</button>
  `;
  const ul = document.querySelector('[data-testid="item_list"]');
  // Items appear one by one — exercises present/stable waiting on the last row.
  ITEMS.forEach((item, idx) => {
    setTimeout(() => {
      const li = document.createElement('li');
      li.dataset.testid = `item_row_${item.id}`;
      li.textContent = `${item.name} — ${item.price}`;
      li.addEventListener('click', () => detailScreen(item));
      ul.appendChild(li);
    }, 80 * (idx + 1));
  });
  document.querySelector('[data-testid="logout_button"]').addEventListener('click', () => loginScreen());
}

function detailScreen(item) {
  app.innerHTML = `
    <h1 data-testid="detail_title">${item.name}</h1>
    <p data-testid="detail_price">${item.price}</p>
    <p data-testid="detail_blurb">${item.blurb}</p>
    <button data-testid="back_button">Back to list</button>
  `;
  document.querySelector('[data-testid="back_button"]').addEventListener('click', listScreen);
}

loginScreen();
