// api/arena.js — thin read-only proxy for the two Are.na endpoints that
// require auth (T1 probe: /users/:id/channels and /users/:id/following are
// 401 anonymous). Holds ARENA_ACCESS_TOKEN server-side, caches responses,
// and does nothing else. Everything other Are.na data stays browser-direct.
export default async function handler(req, res) {
  const { kind, id, page = "1", per = "25" } = req.query;

  if (kind !== "channels" && kind !== "following") {
    return res.status(400).json({ error: "kind must be channels|following" });
  }
  if (!/^[a-z0-9_-]+$/i.test(String(id ?? ""))) {
    return res.status(400).json({ error: "id must be an Are.na user id or slug" });
  }
  const perN = Math.min(parseInt(String(per), 10) || 25, 25); // >25 504s upstream (T1)
  const pageN = Math.max(parseInt(String(page), 10) || 1, 1);

  const token = process.env.ARENA_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "ARENA_ACCESS_TOKEN not configured" });
  }

  try {
    const upstream = await fetch(
      `https://api.are.na/v2/users/${id}/${kind}?per=${perN}&page=${pageN}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await upstream.text();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: "upstream fetch failed" });
  }
}
