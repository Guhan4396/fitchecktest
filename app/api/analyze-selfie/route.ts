import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SelfieAnalysisResult } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are Fitcheck's style analysis engine. When given a photo of a person, analyse the following and return a structured profile:

Skin tone: Identify from these categories — fair, wheatish, medium brown, dark brown, deep. Also note undertone — warm, cool, or neutral.

Face shape: Identify from — oval, rectangle, square, round, heart, diamond. Explain in one line what necklines and collar styles work best for this face shape.

Body type: Identify from — slim/lean, athletic, average, broad shoulders, pear shaped, plus size. Explain in one line what fits and silhouettes work best.

Color palette: Based on skin tone and undertone, list 5 colors that will always work for this person and 3 colors to avoid.

Overall style notes: 2-3 sentences of honest, specific advice for this person. Be specific. Be honest. Talk like a knowledgeable friend, not a fashion magazine. No generic advice. Everything must be tailored to what you actually see in the photo.

Return the response in this exact format:

Skin tone:
Undertone:
Face shape:
Best necklines/collars:
Body type:
Best fits/silhouettes:
Colors that work:
Colors to avoid:
Style notes:`;

function parseAnalysisResponse(text: string): SelfieAnalysisResult {
  const result: Record<string, string> = {};

  const lines = text.split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();
    if (value) result[key] = value;
  }

  return {
    skin_tone: result["skin tone"] || "medium brown",
    undertone: result["undertone"] || "neutral",
    face_shape: result["face shape"] || "oval",
    best_necklines: result["best necklines/collars"] || "",
    body_type: result["body type"] || "average",
    best_fits: result["best fits/silhouettes"] || "",
    colors_that_work: result["colors that work"]
      ? result["colors that work"].split(",").map((c) => c.trim()).filter(Boolean)
      : [],
    colors_to_avoid: result["colors to avoid"]
      ? result["colors to avoid"].split(",").map((c) => c.trim()).filter(Boolean)
      : [],
    style_notes: result["style notes"] || "",
  };
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

    const formData = await request.formData();
    const imageFile = formData.get("image") as File;

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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Analyse this photo and return my style profile in the exact format specified.",
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const analysis = parseAnalysisResponse(content.text);

    // Upload image to Supabase Storage
    const fileName = `${user.id}/profile-${Date.now()}.${imageFile.name.split(".").pop()}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(fileName, imageFile, {
        upsert: true,
        contentType: mediaType,
      });

    let profileImageUrl: string | null = null;
    if (!uploadError && uploadData) {
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("profile-images")
        .getPublicUrl(uploadData.path);
      profileImageUrl = publicUrl;
    }

    // Save/update style profile in Supabase
    const { data: profile, error: profileError } = await supabase
      .from("style_profiles")
      .upsert(
        {
          user_id: user.id,
          skin_tone: analysis.skin_tone,
          undertone: analysis.undertone,
          face_shape: analysis.face_shape,
          best_necklines: analysis.best_necklines,
          body_type: analysis.body_type,
          best_fits: analysis.best_fits,
          colors_that_work: analysis.colors_that_work,
          colors_to_avoid: analysis.colors_to_avoid,
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
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile, analysis });
  } catch (error) {
    console.error("Analyze selfie error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
