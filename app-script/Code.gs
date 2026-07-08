/**
 * Sienna's Cake Kitchen — Apps Script backend
 *
 * Bind this script to the same Google Sheet used for the cake catalog:
 *   Sheet open → Extensions → Apps Script → paste this file in as Code.gs
 *
 * The sheet needs two tabs:
 *   "Cakes"    — header row: Name | Description | Price | Image URL | Available
 *   "Bookings" — created automatically the first time a booking comes in
 *
 * Deploy: Deploy → New deployment → type "Web app"
 *   Execute as:        Me
 *   Who has access:    Anyone
 * Copy the resulting /exec URL — that's APPS_SCRIPT_URL in Cloudflare.
 *
 * Script Properties (Project Settings → Script Properties → Add property):
 *   STAFF_EMAIL    — inbox that should receive booking alerts (required)
 *   SHARED_SECRET  — any random string; also set as APPS_SCRIPT_SHARED_SECRET
 *                    in Cloudflare so randoms can't POST bookings directly to
 *                    this URL and spam your inbox. Optional but recommended.
 */

const CAKES_SHEET_NAME = 'Cakes';
const BOOKINGS_SHEET_NAME = 'Bookings';

function doGet(e) {
  try {
    return jsonOutput_(getCakes_());
  } catch (err) {
    return jsonOutput_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const sharedSecret = props.getProperty('SHARED_SECRET');
    const staffEmail = props.getProperty('STAFF_EMAIL');

    if (!staffEmail) {
      return jsonOutput_({ error: 'STAFF_EMAIL script property is not set' });
    }

    const body = JSON.parse(e.postData.contents || '{}');

    if (sharedSecret && body.secret !== sharedSecret) {
      return jsonOutput_({ error: 'Unauthorized' });
    }

    // Honeypot — bots fill hidden fields, humans don't.
    if (body.company) {
      return jsonOutput_({ ok: true });
    }

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const cake = String(body.cake || '').trim();
    const eventDate = String(body.eventDate || '').trim();
    const notes = String(body.notes || '').trim();

    if (!name || !phone || !email || !cake || !eventDate) {
      return jsonOutput_({ error: 'Missing required fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonOutput_({ error: 'Invalid email address' });
    }

    MailApp.sendEmail({
      to: staffEmail,
      replyTo: email,
      subject: `New booking: ${cake} for ${eventDate}`,
      body:
`New cake booking request

Name:      ${name}
Phone:     ${phone}
Email:     ${email}
Cake:      ${cake}
Needed by: ${eventDate}
Notes:     ${notes || '(none)'}

Call the customer to confirm details and take payment.`,
    });

    MailApp.sendEmail({
      to: email,
      replyTo: staffEmail,
      subject: `We've got your cake request — Sienna's Cake Kitchen`,
      body:
`Hi ${name},

Thanks for your booking request for the "${cake}" — we've got it!

We'll call you at ${phone} within a day to confirm flavor, size, and your pickup or delivery details, and to arrange payment.

If anything changes before then, just reply to this email.

Sienna's Cake Kitchen`,
    });

    logBooking_(name, phone, email, cake, eventDate, notes);

    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ error: String(err) });
  }
}

function getCakes_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAKES_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${CAKES_SHEET_NAME}" not found`);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map((h) => String(h).trim().toLowerCase());
  const idx = {
    name: header.indexOf('name'),
    description: header.indexOf('description'),
    price: header.indexOf('price'),
    image: header.indexOf('image url'),
    available: header.indexOf('available'),
  };

  return values.slice(1)
    .filter((row) => row[idx.name])
    .map((row) => ({
      name: String(row[idx.name] || ''),
      description: idx.description >= 0 ? String(row[idx.description] || '') : '',
      price: idx.price >= 0 ? row[idx.price] : '',
      image: idx.image >= 0 ? String(row[idx.image] || '') : '',
      available: idx.available >= 0 ? isTruthy_(row[idx.available]) : true,
    }))
    .filter((cake) => cake.available);
}

function isTruthy_(value) {
  return value === true || String(value).trim().toLowerCase() === 'true';
}

function logBooking_(name, phone, email, cake, eventDate, notes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Email', 'Cake', 'Event Date', 'Notes']);
  }
  sheet.appendRow([new Date(), name, phone, email, cake, eventDate, notes]);
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
