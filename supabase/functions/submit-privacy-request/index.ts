import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeCorsHeaders } from "../_shared/cors.ts";

const VALID_TYPES = ["erasure", "access", "portability", "rectification", "objection", "other"] as const;
type RequestType = typeof VALID_TYPES[number];

Deno.serve(async (req) => {
  const corsHeaders = makeCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Honeypot — bots fill hidden fields; humans don't
  if (body.website) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate inputs
  const email       = String(body.email       ?? "").trim().toLowerCase();
  const name        = String(body.name        ?? "").trim().slice(0, 200) || null;
  const requestType = String(body.requestType ?? "") as RequestType;
  const message     = String(body.message     ?? "").trim().slice(0, 10_000);

  if (!email || !email.includes("@") || email.length > 254) {
    return new Response(JSON.stringify({ error: "A valid email address is required." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!VALID_TYPES.includes(requestType)) {
    return new Response(JSON.stringify({ error: "Invalid request type." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!message || message.length < 10) {
    return new Response(JSON.stringify({ error: "Please describe your request (at least 10 characters)." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Rate limit: max 3 submissions per email per 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("privacy_requests")
    .select("*", { count: "exact", head: true })
    .eq("from_email", email)
    .gte("created_at", cutoff);

  if ((count ?? 0) >= 3) {
    return new Response(
      JSON.stringify({ error: "Too many submissions. Please wait 24 hours before trying again." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const subject = `Privacy request: ${requestType}`;

  const { data, error } = await admin
    .from("privacy_requests")
    .insert({
      from_email:   email,
      from_name:    name,
      subject,
      body_text:    message,
      request_type: requestType,
      status:       "new",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[submit-privacy-request] DB error:", error.message);
    return new Response(JSON.stringify({ error: "Failed to record your request. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[submit-privacy-request] ${requestType} from ${email} (id: ${data.id})`);

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
