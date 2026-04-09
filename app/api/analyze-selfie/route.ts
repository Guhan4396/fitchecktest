import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SelfieAnalysisResult } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = imageFile.type as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const prompt = `You are a fashion expert analyzing someone's selfie to create their style profile. Be observant and accurate.

Analyze this photo and extract:
1. **Skin tone** — choose exactly one: fair, light, medium, olive, brown, dark
2. **Body type** — choose exactly one: hourglass, pear, apple, rectangle, inverted_triangle
3. **Skin tone description** — 1-2 sentences describing the specific undertones (warm/cool/neutral) and what colors work best
4. **Body type description** — 1-2 sentences describing their proportions
5. **Style notes** — 2-3 sentences of honest, specific style advice based on what you see. Be real, not generic.

Respond ONLY with valid JSON matching this exact structure:
{
  "skin_tone": "medium",
  "body_type": "hourglass",
  "skin_tone_description": "...",
  "body_type_description": "...",
  "style_notes": "..."
}

If you cannot clearly see the person's body (e.g. very close-up face only), make your best assessment for skin tone and set body_type to "rectangle" as a neutral default, noting this in the body_type_description.`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
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
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from Claude response");
    }

    const analysis: SelfieAnalysisResult = JSON.parse(jsonMatch[0]);

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
          body_type: analysis.body_type,
          skin_tone_description: analysis.skin_tone_description,
          body_type_description: analysis.body_type_description,
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
