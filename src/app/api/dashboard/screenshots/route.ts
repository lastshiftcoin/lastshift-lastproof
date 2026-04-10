import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/screenshots — upload a screenshot (multipart)
 * DELETE /api/dashboard/screenshots?id=xxx — delete a screenshot
 */

const MAX_SHOTS = 8;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function getProfile(session: { walletAddress: string }) {
  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();
  if (!operator) return { profile: null, sb };
  const profile = await getProfileByOperatorId(operator.id);
  return { profile, sb };
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const position = parseInt(formData.get("position") as string, 10) || 0;

  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  // Check existing count
  const { count } = await sb
    .from("screenshots")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);

  if ((count ?? 0) >= MAX_SHOTS) {
    return NextResponse.json({ error: "max_screenshots_reached" }, { status: 400 });
  }

  // Upload to Supabase Storage (screenshots bucket)
  const ext = file.name.split(".").pop() || "png";
  const storagePath = `${profile.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage
    .from("screenshots")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("[screenshots] upload error:", uploadErr);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data: urlData } = sb.storage.from("screenshots").getPublicUrl(storagePath);
  const imageUrl = urlData.publicUrl;

  // Insert DB row
  const { data, error } = await sb
    .from("screenshots")
    .insert({
      profile_id: profile.id,
      image_url: imageUrl,
      linked_url: null,
      position,
    })
    .select()
    .single();

  if (error) {
    console.error("[screenshots] insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    screenshot: {
      id: data.id,
      imageUrl: data.image_url,
      linkedUrl: data.linked_url,
      position: data.position,
    },
  });
}

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { profile, sb } = await getProfile(session);
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Verify ownership
  const { data: shot } = await sb
    .from("screenshots")
    .select("id, image_url")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!shot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Delete storage object (extract path from URL)
  try {
    const publicUrl = shot.image_url as string;
    const pathMatch = publicUrl.split("/screenshots/").pop();
    if (pathMatch) {
      await sb.storage.from("screenshots").remove([pathMatch]);
    }
  } catch {
    // Non-fatal — row deletion is more important
    console.warn("[screenshots] storage delete failed for", id);
  }

  const { error } = await sb.from("screenshots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
