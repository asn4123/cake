// POST /api/book
// Forwards a booking request to the Apps Script Web App (see
// /apps-script/Code.gs), which sends the staff + customer emails via
// MailApp and logs the booking to the "Bookings" sheet tab. This function
// still does basic validation and honeypot checking before forwarding, so
// obviously-bad requests never reach Apps Script's daily email quota.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  // Honeypot: bots fill every field, including hidden ones.
  if (body.company) {
    return jsonResponse({ ok: true });
  }

  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();
  const cake = (body.cake || '').trim();
  const eventDate = (body.eventDate || '').trim();
  const notes = (body.notes || '').trim();

  if (!name || !phone || !email || !cake || !eventDate) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Invalid email address' }, 400);
  }

  if (!env.APPS_SCRIPT_URL) {
    return jsonResponse({ error: 'Booking is not configured on the server' }, 500);
  }

  try {
    const res = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, phone, email, cake, eventDate, notes,
        secret: env.APPS_SCRIPT_SHARED_SECRET || '',
      }),
      redirect: 'follow',
    });
    const data = await res.json().catch(() => ({}));
    if (data.error) return jsonResponse({ error: data.error }, 502);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: 'Booking request failed, please try again' }, 502);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
