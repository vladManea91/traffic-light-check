const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

function openStore(name) {
  const siteID = process.env.BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

const KEEP_WEEKS = 30; // roughly 7 months of history
const COLORS = new Set(["green", "yellow", "red"]);

function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hashPin(pin) {
  return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function lastNWeeks(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    out.push(isoWeek(d));
  }
  return out;
}

function pruneLogs(logs) {
  const keep = new Set(lastNWeeks(KEEP_WEEKS));
  const out = {};
  Object.keys(logs || {}).forEach((w) => {
    if (keep.has(w)) out[w] = logs[w];
  });
  return out;
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Bad request." }) };
    }

    const { action, name, pin } = body;
    if (!name || !pin || String(pin).length < 4) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name and a 4 digit code are required." }),
      };
    }

    const slug = slugify(name);
    if (!slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "That name did not work, try again." }) };
    }

    const store = openStore("checkins");
    const key = `member:${slug}`;
    const existing = await store.get(key, { type: "json" });
    const pinHash = hashPin(pin);

    // ----- Claim / sign in -----
    if (action === "claim") {
      if (!existing) {
        const fresh = {
          slug,
          name: name.trim(),
          pinHash,
          logs: {},
          createdAt: new Date().toISOString(),
        };
        await store.setJSON(key, fresh);
        const { pinHash: _omit, ...safe } = fresh;
        return { statusCode: 200, headers, body: JSON.stringify({ member: safe, created: true }) };
      }
      if (existing.pinHash !== pinHash) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: "That name is already taken with a different code. If this is you, use your original code." }),
        };
      }
      const { pinHash: _omit, ...safe } = existing;
      return { statusCode: 200, headers, body: JSON.stringify({ member: safe, created: false }) };
    }

    // ----- Weekly check-in -----
    if (action === "checkin") {
      const { color, note } = body;
      if (!COLORS.has(color)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Pick a color first." }) };
      }
      if (!existing) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "We could not find your name, claim it first." }) };
      }
      if (existing.pinHash !== pinHash) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "That code does not match this name." }) };
      }

      const week = isoWeek(new Date());
      const logs = pruneLogs({
        ...(existing.logs || {}),
        [week]: { color, note: (note || "").slice(0, 160), savedAt: new Date().toISOString() },
      });
      const updated = { ...existing, logs, updatedAt: new Date().toISOString() };
      await store.setJSON(key, updated);
      const { pinHash: _omit, ...safe } = updated;
      return { statusCode: 200, headers, body: JSON.stringify({ member: safe }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action." }) };
  } catch (err) {
    console.error("checkin function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error: " + (err && err.message ? err.message : "unknown") }),
    };
  }
};
