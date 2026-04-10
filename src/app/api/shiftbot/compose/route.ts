import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.LASTPROOF_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPTS: Record<string, string> = {
  pitch: `You are SHIFTBOT, an AI writing assistant for Web3 operators on LASTPROOF — a platform where crypto marketers, raiders, KOLs, and community managers showcase verified work.

The operator has written a draft pitch. Rewrite it to be more compelling, concise, and professional while keeping their voice, facts, and personality. Use confident, direct language suited to the Web3/crypto space. Keep it under 500 characters.

Return ONLY the rewritten text. No quotes, no explanations, no preamble.`,

  about: `You are SHIFTBOT, an AI writing assistant for Web3 operators on LASTPROOF — a platform where crypto marketers, raiders, KOLs, and community managers showcase verified work.

The operator has written a draft "About Me" section. Rewrite it to be more engaging and human while keeping their facts and personality. This section is about who they are — background, interests, what makes them unique. Keep it under 500 characters.

Return ONLY the rewritten text. No quotes, no explanations, no preamble.`,
};

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: "SHIFTBOT is not configured yet." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.text || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "No text provided." },
      { status: 400 },
    );
  }

  const field = body.field === "about" ? "about" : "pitch";
  const text = body.text.trim().slice(0, 2000);

  if (text.length < 10) {
    return NextResponse.json(
      { error: "Please write at least one full sentence first." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[field] },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "Groq error");
      console.error("[shiftbot/compose] Groq error:", res.status, err);
      return NextResponse.json(
        { error: "SHIFTBOT couldn't generate a rewrite right now." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const rewrite = data.choices?.[0]?.message?.content?.trim();

    if (!rewrite) {
      return NextResponse.json(
        { error: "SHIFTBOT returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ rewrite });
  } catch (err) {
    console.error("[shiftbot/compose] fetch error:", err);
    return NextResponse.json(
      { error: "SHIFTBOT is temporarily unavailable." },
      { status: 502 },
    );
  }
}
