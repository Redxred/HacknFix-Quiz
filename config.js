// ============================================================
//  HacknFix - Supabase connection settings
//
//  Fill these two in from your Supabase dashboard:
//
//    Project Settings > Data API
//      Project URL           ->  SUPABASE_URL
//
//    Project Settings > API Keys
//      Publishable key       ->  SUPABASE_ANON_KEY   (starts with sb_publishable_)
//      ...or, on the "Legacy anon, service_role API keys" tab,
//      the anon public key   ->  SUPABASE_ANON_KEY   (starts with eyJ)
//
//  Either format works. This key is MEANT to be public - it ships inside
//  the page and anyone can read it. Row Level Security (set up in
//  supabase-schema.sql) is what actually protects your data.
//
//  NEVER put a "Secret key" (sb_secret_...) or the legacy "service_role"
//  key in this file. Those bypass every security rule and would let
//  anyone read your participants' phone numbers or wipe your database.
// ============================================================

window.HACKNFIX_CONFIG = {
  SUPABASE_URL: "https://yytnfsnmthspcymzmdaq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dG5mc25tdGhzcGN5bXptZGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NTAxOTksImV4cCI6MjEwNTMyNjE5OX0.e7PZtuyGC3risOZDqjoTkyloeTcE94KF7tDHbOY9RFI"
};

// ---- Shared helpers used by both index.html and admin.html ----
window.HacknFix = (function () {
  const cfg = window.HACKNFIX_CONFIG;
  const url = (cfg.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (cfg.SUPABASE_ANON_KEY || "").trim();

  // Loud warning if a private key ends up in a file that ships to browsers.
  if (/^sb_secret_/.test(key) || /"role"\s*:\s*"service_role"/.test(atobSafe(key))) {
    console.error(
      "[HacknFix] That looks like a SECRET key. Never put it in config.js - " +
      "it ships to every visitor. Use the Publishable key instead, and rotate " +
      "the secret one in Supabase > Project Settings > API Keys."
    );
  }

  const configured = /^https?:\/\//.test(url) && key.length > 10 && !/^PASTE_/.test(key);

  // Decode the middle of a legacy JWT key so we can inspect its role claim.
  function atobSafe(k) {
    try { return atob(k.split(".")[1] || ""); } catch (e) { return ""; }
  }

  let client = null;
  if (configured && window.supabase) {
    client = window.supabase.createClient(url, key, { global: { fetch: window.HNFNetwork.fetch } });
  }

  // A database row -> the shape the quiz frontend already understands.
  function rowToQuestion(row) {
    return {
      id: row.id,
      icon: row.icon,
      q: { bn: row.q_bn, en: row.q_en },
      options: (row.options || []).map(o => ({
        bn: o.bn, en: o.en, correct: !!o.correct
      })),
      explain: { bn: row.explain_bn || "", en: row.explain_en || "" }
    };
  }

  return { client, configured, rowToQuestion };
})();
