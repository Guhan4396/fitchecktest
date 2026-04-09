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
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Try to extract OG image or main product image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );

    if (ogImageMatch?.[1]) {
      return ogImageMatch[1];
    }

    // Myntra-specific: look for product image URLs
    if (url.includes("myntra.com")) {
      const myntraMatch = html.match(/"image":"([^"]+\.jpg[^"]*)"/);
      if (myntraMatch?.[1]) return myntraMatch[1].replace(/\\/g, "");
    }

    // Ajio-specific
    if (url.includes("ajio.com")) {
      const ajioMatch = html.match(/\"image\":\"([^\"]+)\"/);
      if (ajioMatch?.[1]) return ajioMatch[1].replace(/\\/g, "");
    }

    return null;
  } catch {
    return null;
  }
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

    // Get user's style profile
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
      // Try to scrape product image
      const scrapedUrl = await fetchProductImage(productUrl);
      if (scrapedUrl) {
        garmentImageUrl = scrapedUrl;
        // Fetch the image itself
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
          // Will fall through to URL-only analysis
        }
      }
    }

    if (!garmentImageBase64 && !productUrl) {
      return NextResponse.json(
        { error: "No image or URL provided" },
        { status: 400 }
      );
    }

    const profileContext = `
USER STYLE PROFILE:
- Skin tone: ${profile.skin_tone} (${profile.skin_tone_description})
- Body type: ${profile.body_type} (${profile.body_type_description})
- Style notes: ${profile.style_notes}
`;

    const prompt = `You are a brutally honest but supportive fashion friend. Not a corporate stylist. You tell it like it is, with warmth.

${profileContext}

Analyze this garment/outfit against the user's style profile. Give a REAL verdict — not wishy-washy, not overly positive. If it's not great for them, say so clearly but kindly.

${productUrl && !garmentImageBase64 ? `Product URL: ${productUrl}` : ""}

Respond ONLY with valid JSON matching this exact structure:
{
  "verdict": "yes",
  "headline": "This is your color, no debate.",
  "reasoning": "2-3 sentences explaining the overall verdict in a conversational, honest tone",
  "what_works": ["specific thing 1", "specific thing 2"],
  "what_doesnt": ["specific concern 1"],
  "pair_with": ["specific item suggestion 1", "specific item suggestion 2", "specific item suggestion 3"],
  "confidence": 85
}

Rules:
- verdict is "yes", "no", or "maybe"
- headline is punchy, 1 sentence, honest (think friend texting you, not brand copy)
- what_works has 1-3 items (empty array [] if verdict is "no")
- what_doesnt has 1-3 items (empty array [] if verdict is "yes")
- pair_with always has 2-4 specific pairing suggestions
- confidence is 0-100 (how confident you are in your verdict given what you can see)
- Be specific to THEIR skin tone and body type, not generic advice`;

    const messageContent: Anthropic.MessageParam["content"] = [];

    if (garmentImageBase64) {
      messageContent.push({
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

    messageContent.push({
      type: "text",
      text: prompt,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
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
        body_type: profile.body_type,
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
