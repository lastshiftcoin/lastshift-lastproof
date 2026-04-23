import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getProfileByOperatorId, updateProfile } from "@/lib/profiles-store";

/**
 * POST /api/dashboard/avatar
 *
 * Uploads an avatar image to Supabase Storage and updates the profile.
 * Accepts multipart/form-data with a single "file" field.
 *
 * Storage bucket: `avatars` (from 0002_storage_buckets.sql)
 * Storage path: {profileId}.{ext}
 */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { supabaseService } = await import("@/lib/db/client");
  const sb = supabaseService();

  // Look up operator + profile
  const { data: operator } = await sb
    .from("operators")
    .select("id")
    .eq("terminal_wallet", session.walletAddress)
    .maybeSingle();

  if (!operator) {
    return NextResponse.json({ error: "no_operator" }, { status: 403 });
  }

  const profile = await getProfileByOperatorId(operator.id);
  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  // Parse multipart form
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  // Validate
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  // Determine extension
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${profile.id}.${ext}`;

  try {
    // Upload to Supabase Storage (upsert to overwrite existing)
    // Bucket is "avatars" — created by 0002_storage_buckets.sql.
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await sb.storage
      .from("avatars")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[avatar] upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = sb.storage
      .from("avatars")
      .getPublicUrl(storagePath);

    const avatarUrl = urlData.publicUrl;

    // Update profile
    const updated = await updateProfile(profile.id, { avatarUrl });

    return NextResponse.json({ avatarUrl, profile: updated });
  } catch (err) {
    console.error("[avatar] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 },
    );
  }
}
