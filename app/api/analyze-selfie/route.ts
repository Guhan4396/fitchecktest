import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SelfieAnalysisResult, Gender } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function buildSystemPrompt(gender: Gender): string {
  return `You are Fitcheck's style analysis engine. Analyse this full body photo and extract the following. Return ONLY valid JSON — no extra text.

ANALYSE:

SKIN: Skin tone (fair, wheatish, medium brown, dark brown, deep) and undertone (warm, cool, neutral).

BODY TYPE:
${gender === "men"
    ? "For men — slim, athletic, average, broad, heavyset"
    : "For women — pear, hourglass, apple, rectangle, athletic"
  }

PROPORTIONS: Shoulder to hip ratio, torso length — what this means for clothing fit.

COLOR PALETTE: 6 colors that work for this skin tone and undertone. 3 colors to avoid. Be specific about why.

CLOTHING RECOMMENDATIONS:
${gender === "men"
    ? "For men — what shirt fits work (slim fit, regular, oversized), what trouser cuts work (slim, straight, tapered), what to avoid."
    : "For women — what dress silhouettes work, what trouser cuts work, what necklines work, what to avoid."
  }

Keep everything direct and specific. No generic advice.

Return this exact JSON structure:
{
  "skin_tone": "medium brown",
  "undertone": "warm",
  "body_type": "athletic",
  "proportions": "broad shoulders, average hip width — clothes that balance the upper body work best",
  "colors_that_work": ["navy", "olive", "rust", "terracotta", "mustard", "forest green"],
  "colors_to_avoid": ["pastel pink", "lavender", "icy blue"],
  "clothing_recommendations": "Slim fit shirts suit well. Tapered trousers balance the broad shoulders. Avoid boxy oversized cuts — they add bulk without shape.",
  "style_notes": "2-3 sentences of honest, specific advice tailored to what you actually see."
}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const gender = (formData.get("gender") as Gender) || "men";

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = imageFile.type as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(gender),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Analyse this photo and return my style profile as JSON.",
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response from Claude");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse JSON from Claude response");

    const raw = JSON.parse(jsonMatch[0]);

    const analysis: SelfieAnalysisResult = {
      skin_tone: raw.skin_tone || "medium brown",
      undertone: raw.undertone || "neutral",
      face_shape: raw.face_shape || "",
      best_necklines: raw.best_necklines || "",
      body_type: raw.body_type || "average",
      best_fits: raw.clothing_recommendations || "",
      proportions: raw.proportions || "",
      colors_that_work: Array.isArray(raw.colors_that_work) ? raw.colors_that_work : [],
      colors_to_avoid: Array.isArray(raw.colors_to_avoid) ? raw.colors_to_avoid : [],
      clothing_recommendations: raw.clothing_recommendations || "",
      style_notes: raw.style_notes || "",
    };

    // Upload image to Supabase Storage
    const fileName = `${user.id}/profile-${Date.now()}.${imageFile.name.split(".").pop()}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, imageFile, { upsert: true, contentType: mediaType });

    let profileImageUrl: string | null = null;
    if (!uploadError && uploadData) {
      const { data: { publicUrl } } = supabase.storage
        .from("profile-images")
        .getPublicUrl(uploadData.path);
      profileImageUrl = publicUrl;
    }

    const { data: profile, error: profileError } = await supabase
      .from("style_profiles")
      .upsert(
        {
          user_id: user.id,
          gender,
          skin_tone: analysis.skin_tone,
          undertone: analysis.undertone,
          face_shape: analysis.face_shape,
          best_necklines: analysis.best_necklines,
          body_type: analysis.body_type,
          best_fits: analysis.best_fits,
          proportions: analysis.proportions,
          colors_that_work: analysis.colors_that_work,
          colors_to_avoid: analysis.colors_to_avoid,
          clothing_recommendations: analysis.clothing_recommendations,
          skin_tone_description: `${analysis.skin_tone}, ${analysis.undertone} undertone`,
          body_type_description: analysis.best_fits,
          style_notes: analysis.style_notes,
          profile_image_url: profileImageUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (profileError) {
      console.error("Profile save error:", profileError);
      return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }

    return NextResponse.json({ profile, analysis });
  } catch (error) {
    console.error("Analyze selfie error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
