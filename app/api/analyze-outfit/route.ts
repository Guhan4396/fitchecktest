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
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    const ogImageMatch =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      );

    if (ogImageMatch?.[1]) return ogImageMatch[1];

    if (url.includes("myntra.com")) {
      const myntraMatch = html.match(/"image":"([^"]+\.jpg[^"]*)"/);
      if (myntraMatch?.[1]) return myntraMatch[1].replace(/\\/g, "");
    }

    if (url.includes("ajio.com")) {
      const ajioMatch = html.match(/\"image\":\"([^\"]+)\"/);
      if (ajioMatch?.[1]) return ajioMatch[1].replace(/\\/g, "");
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

  return `You are Fitcheck's garment analysis engine — a brutally honest but supportive fashion friend. Not corporate. Not generic. Real talk.

You have the user's full style profile:
- Skin tone: ${profile.skin_tone} with ${profile.undertone} undertones
- Face shape: ${profile.face_shape}
- Best necklines/collars for their face: ${profile.best_necklines}
- Body type: ${profile.body_type}
- Best fits/silhouettes for their body: ${profile.best_fits}
- Colors that work for them: ${colorsWork}
- Colors to avoid: ${colorsAvoid}
- Style notes: ${profile.style_notes}

When evaluating the garment, reference their SPECIFIC profile — skin tone undertone vs garment colour, whether the neckline suits their face shape, whether the silhouette flatters their body type. Be precise. Be personal. No generic fashion advice.

Respond ONLY with valid JSON in this exact structure:
{
  "verdict": "yes",
  "headline": "This is your colour, no debate.",
  "reasoning": "2-3 sentences explaining the verdict in a conversational, honest tone — reference their specific skin tone, undertone, body type or face shape",
  "what_works": ["specific reason tied to their profile", "another specific reason"],
  "what_doesnt": ["specific concern tied to their profile"],
  "pair_with": ["specific item 1", "specific item 2", "specific item 3"],
  "confidence": 85
}

Rules:
- verdict is "yes", "no", or "maybe"
- headline is punchy, 1 sentence, honest (friend texting you, not brand copy)
- what_works: 1-3 items if yes/maybe, empty [] if no
- what_doesnt: 1-3 items if no/maybe, empty [] if yes
- pair_with: always 2-4 specific suggestions
- confidence: 0-100 based on how clearly you can see the garment
- reference their skin tone undertone when talking about colour — warm/cool/neutral matters`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    let garmentMediaType: string = "image/jpeg";
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
          const imgResponse = await fetch(scrapedUrl, {
            signal: AbortSignal.timeout(8000),
          });
          if (imgResponse.ok) {
            const imgBytes = await imgResponse.arrayBuffer();
            garmentImageBase64 = Buffer.from(imgBytes).toString("base64");
            garmentMediaType =
              imgResponse.headers.get("content-type") || "image/jpeg";
          }
        } catch {
          // fall through
        }
      }
    }

    if (!garmentImageBase64 && !productUrl) {
      return NextResponse.json(
        { error: "No image or URL provided" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(profile);

    const userContent: Anthropic.MessageParam["content"] = [];

    if (garmentImageBase64) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: garmentMediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: garmentImageBase64,
        },
      });
    }

    userContent.push({
      type: "text",
      text: productUrl && !garmentImageBase64
        ? `Evaluate this product for me based on my style profile. Product URL: ${productUrl}`
        : "Does this garment work for me? Evaluate it against my style profile and give me your honest verdict.",
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from Claude response");
    }

    const result: FitcheckResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      result,
      garmentImageUrl,
      profile: {
        skin_tone: profile.skin_tone,
        undertone: profile.undertone,
        body_type: profile.body_type,
        face_shape: profile.face_shape,
      },
    });
  } catch (error) {
    console.error("Analyze outfit error:", error);
    return NextResponse.json(
      { error: "Failed to analyze outfit" },
      { status: 500 }
    );
  }
}
