// Pulls ratings and reviews from Google (Places API) and Yelp (Fusion API) into
// the reviews table, then rebuilds the site if anything changed.
// Secrets: GOOGLE_PLACES_API_KEY, YELP_API_KEY, DEPLOY_HOOK_URL, CRON_SECRET.
// Runs daily from pg_cron and on demand from the admin.
import { authorize, cors, json, triggerDeploy } from "../_shared/admin.ts";

type Row = { source_id: string; external_id: string; author_name: string; author_photo_url?: string | null; rating: number; text: string; review_url?: string | null; published_at?: string | null };

async function google(placeId: string) {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews" },
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const p = await res.json();
  const reviews: Row[] = (p.reviews || []).map((r: any) => ({
    source_id: "", external_id: r.name, author_name: r.authorAttribution?.displayName || "Google user",
    author_photo_url: r.authorAttribution?.photoUri || null, rating: r.rating,
    text: r.originalText?.text || r.text?.text || "", review_url: r.googleMapsUri || p.googleMapsUri || null, published_at: r.publishTime || null,
  }));
  return { rating: p.rating ?? null, count: p.userRatingCount ?? null, profile: p.googleMapsUri || null, reviews };
}

async function yelp(id: string) {
  const key = Deno.env.get("YELP_API_KEY");
  if (!key) throw new Error("YELP_API_KEY is not set");
  const h = { Authorization: `Bearer ${key}`, accept: "application/json" };
  const [b, r] = await Promise.all([
    fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}`, { headers: h }),
    fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}/reviews?limit=3&sort_by=yelp_sort`, { headers: h }),
  ]);
  if (!b.ok) throw new Error(`Yelp ${b.status}: ${await b.text()}`);
  const biz = await b.json();
  const rv = r.ok ? await r.json() : { reviews: [] };
  const reviews: Row[] = (rv.reviews || []).map((x: any) => ({
    source_id: "", external_id: x.id, author_name: x.user?.name || "Yelp user", author_photo_url: x.user?.image_url || null,
    rating: x.rating, text: x.text || "", review_url: x.url || biz.url, published_at: x.time_created ? new Date(x.time_created.replace(" ", "T") + "-06:00").toISOString() : null,
  }));
  return { rating: biz.rating ?? null, count: biz.review_count ?? null, profile: (biz.url || "").split("?")[0] || null, reviews };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = await authorize(req);
  if (!db) return json({ error: "Sign in as an admin to sync reviews." }, 401);

  const { data: sources, error } = await db.from("review_sources").select("*").eq("enabled", true).in("kind", ["google_places", "yelp_fusion"]);
  if (error) return json({ error: error.message }, 500);

  let imported = 0, changed = false;
  const problems: string[] = [];
  for (const s of sources || []) {
    if (!s.external_id) continue;
    try {
      const r = s.kind === "google_places" ? await google(s.external_id) : await yelp(s.external_id);
      if (r.rating !== s.rating || r.count !== s.review_count) changed = true;
      await db.from("review_sources").update({
        rating: r.rating, review_count: r.count, last_synced_at: new Date().toISOString(),
        ...(s.profile_url ? {} : { profile_url: r.profile }),
      }).eq("id", s.id);
      if (r.reviews.length) {
        const rows = r.reviews.map((x) => ({ ...x, source_id: s.id }));
        const { error: e2 } = await db.from("reviews").upsert(rows, { onConflict: "source_id,external_id" });
        if (e2) throw e2;
        imported += rows.length;
        changed = true;
      }
    } catch (e) {
      problems.push(`${s.name}: ${(e as Error).message}`);
    }
  }
  const deployed = changed ? await triggerDeploy() : false;
  return json({ imported, deployed, problems }, problems.length && !imported ? 502 : 200);
});
