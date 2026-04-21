import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { FitcheckResult } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function fetchProductImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const html = await response.text();

    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch?.[1]) return ogImageMatch[1];

    if (url.includes("myntra.com")) {
      const m = html.match(/"image":"([^"]+\.jpg[^"]*)"/);
      if (m?.[1]) return m[1].replace(/\\/g, "");
    }
    if (url.includes("ajio.com")) {
      const m = html.match(/\"image\":\"([^\"]+)\"/);
      if (m?.[1]) return m[1].replace(/\\/g, "");
    }
    return null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(profile: Record<string, unknown>): string {
  const colorsWork = Array.isArray(profile.colors_that_work)
    ? (profile.colors_that_work as string[]).join(", ")
    : "";
  const colorsAvoid = Array.isArray(profile.colors_to_avoid)
    ? (profile.colors_to_avoid as string[]).join(", ")
    : "";
  const gender = profile.gender || "men";

  return `You are Fitcheck's garment analysis engine — a brutally honest but supportive fashion friend. Real talk, no corporate fluff.

USER PROFILE:
- Shopping for: ${gender}
- Skin tone: ${profile.skin_tone} with ${profile.undertone} undertones
- Body type: ${profile.body_type}
- Proportions: ${profile.proportions || "not specified"}
- Clothing recommendations: ${profile.clothing_recommendations || profile.best_fits}
- Colors that work: ${colorsWork}
- Colors to avoid: ${colorsAvoid}
- Style notes: ${profile.style_notes}

Evaluate the garment against this SPECIFIC profile. Reference their skin tone undertone vs garment colour, whether the silhouette flatters their body type, whether the fit matches their recommendations.

Respond ONLY with valid JSON:
{
  "verdict": "yes",
  "headline": "This is your colour, no debate.",
  "reasoning": "2-3 sentences — reference their specific undertone, body type or proportions",
  "what_works": ["specific reason tied to their profile"],
  "what_doesnt": ["specific concern tied to their profile"],
  "pair_with": ["specific item 1", "specific item 2", "specific item 3"],
  "alternatives": ["2-3 alternative items or colours that would work even better for them — be specific"],
  "confidence": 85
}

Rules:
- verdict: "yes", "no", or "maybe"
- headline: punchy 1 sentence, like a friend texting
- what_works: 1-3 items if yes/maybe, empty [] if no
- what_doesnt: 1-3 items if no/maybe, empty [] if yes
- pair_with: 2-4 specific pairing suggestions
- alternatives: always 2-3 specific alternatives or better colour options that suit their profile
- confidence: 0-100`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("style_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "No style profile found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const productUrl = formData.get("url") as string | null;

    let garmentImageBase64: string | null = null;
    let garmentMediaType = "image/jpeg";
    let garmentImageUrl: string | null = null;

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      garmentImageBase64 = Buffer.from(bytes).toString("base64");
      garmentMediaType = imageFile.type;
    } else if (productUrl) {
      const scrapedUrl = await fetchProductImage(productUrl);
      if (scrapedUrl) {
        garmentImageUrl = scrapedUrl;
        try {
          const imgRes = await fetch(scrapedUrl, { signal: AbortSignal.timeout(8000) });
          if (imgRes.ok) {
            garmentImageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
            garmentMediaType = imgRes.headers.get("content-type") || "image/jpeg";
          }
        } catch { /* fall through */ }
      }
    }

    if (!garmentImageBase64 && !productUrl) {
      return NextResponse.json({ error: "No image or URL provided" }, { status: 400 });
    }

    const userContent: Anthropic.MessageParam["content"] = [];
    if (garmentImageBase64) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: garmentMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: garmentImageBase64,
        },
      });
    }
    userContent.push({
      type: "text",
      text: productUrl && !garmentImageBase64
        ? `Evaluate this product for me. URL: ${productUrl}`
        : "Does this work for me? Give me your honest verdict.",
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1200,
      system: buildSystemPrompt(profile),
      messages: [{ role: "user", content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response from Claude");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse JSON from Claude response");

    const result: FitcheckResult = JSON.parse(jsonMatch[0]);
    if (!result.alternatives) result.alternatives = [];

    return NextResponse.json({
      result,
      garmentImageUrl,
      profile: {
        skin_tone: profile.skin_tone,
        undertone: profile.undertone,
        body_type: profile.body_type,
        gender: profile.gender,
      },
    });
  } catch (error) {
    console.error("Analyze outfit error:", error);
    return NextResponse.json({ error: "Failed to analyze outfit" }, { status: 500 });
  }
}
