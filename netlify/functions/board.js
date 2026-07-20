const { getStore } = require("@netlify/blobs");

function openStore(name) {
  const siteID = process.env.BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

exports.handler = async () => {
  try {
    const store = openStore("checkins");
    const { blobs } = await store.list({ prefix: "member:" });

    const members = await Promise.all(
      blobs.map(async ({ key }) => {
        const raw = await store.get(key, { type: "json" });
        if (!raw) return null;
        // Never expose the pin hash to the client
        const { pinHash, ...safe } = raw;
        return safe;
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ members: members.filter(Boolean) }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not load the board." }),
    };
  }
};
