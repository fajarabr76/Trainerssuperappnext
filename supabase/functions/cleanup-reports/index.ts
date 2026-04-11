/**
 * Hapus file .docx dari bucket `reports` jika sudah diunduh dan lewat 5 menit.
 * Jadwalkan via Supabase Dashboard → Edge Functions → Schedule (setiap 1 menit) atau pg_cron.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "Missing env" }), { status: 500 });
  }

  const supabase = createClient(url, key);
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: expiredReports, error } = await supabase
    .from("reports")
    .select("id, file_url")
    .eq("status", "completed")
    .not("downloaded_at", "is", null)
    .not("file_url", "is", null)
    .lt("downloaded_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let cleaned = 0;
  for (const report of expiredReports ?? []) {
    const path = report.file_url as string;
    if (!path) continue;

    if (!path.startsWith("http")) {
      await supabase.storage.from("reports").remove([path]);
    } else {
      const part = path.split("/reports/")[1]?.split("?")[0];
      if (part) await supabase.storage.from("reports").remove([part]);
    }

    await supabase
      .from("reports")
      .update({ file_url: null, status: "expired" })
      .eq("id", report.id);

    cleaned++;
  }

  return new Response(JSON.stringify({ cleaned }), {
    headers: { "Content-Type": "application/json" },
  });
});
