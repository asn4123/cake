const grid = document.getElementById('cake-grid');
const cakeSelect = document.getElementById('cake');
const form = document.getElementById('booking-form');
const statusEl = document.getElementById('form-status');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(price) {
  const n = Number(String(price).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return escapeHtml(String(price));
  return '$' + n.toFixed(n % 1 === 0 ? 0 : 2);
}

async function loadCakes() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const cakes = await res.json();

    if (!Array.isArray(cakes) || cakes.length === 0) {
      grid.innerHTML = '<p class="empty">Nothing on the menu right now — check back soon.</p>';
      cakeSelect.innerHTML = '<option value="" disabled selected>No cakes available</option>';
      return;
    }

    grid.innerHTML = cakes.map(cake => `
      <article class="cake-card">
        ${cake.image ? `<img class="cake-photo" src="${escapeHtml(cake.image)}" alt="${escapeHtml(cake.name)}" loading="lazy" />` : ''}
        <div class="cake-body">
          <h3 class="cake-name">${escapeHtml(cake.name)}</h3>
          <p class="cake-desc">${escapeHtml(cake.description)}</p>
          <span class="price-tag">${formatPrice(cake.price)}</span>
        </div>
      </article>
    `).join('');

    cakeSelect.innerHTML =
      '<option value="" disabled selected>Choose a cake</option>' +
      cakes.map(cake => `<option value="${escapeHtml(cake.name)}">${escapeHtml(cake.name)} — ${formatPrice(cake.price)}</option>`).join('');
  } catch (err) {
    grid.innerHTML = '<p class="error">Couldn\'t load the menu. Please refresh, or call us directly.</p>';
    cakeSelect.innerHTML = '<option value="" disabled selected>Menu unavailable</option>';
    console.error(err);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // honeypot: if filled, silently pretend success
  if (form.company.value) {
    statusEl.textContent = 'Thanks! We\'ll be in touch shortly.';
    statusEl.className = 'form-status ok';
    form.reset();
    return;
  }

  const submitBtn = form.querySelector('.btn-submit');
  submitBtn.disabled = true;
  statusEl.textContent = 'Sending…';
  statusEl.className = 'form-status';

  const payload = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    cake: form.cake.value,
    eventDate: form.eventDate.value,
    notes: form.notes.value.trim(),
  };

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    statusEl.textContent = 'Got it! We\'ll call you soon to confirm details and take payment.';
    statusEl.className = 'form-status ok';
    form.reset();
  } catch (err) {
    statusEl.textContent = 'Couldn\'t send that — please try again or call us directly.';
    statusEl.className = 'form-status err';
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});

loadCakes();
