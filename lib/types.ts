export type SkinTone =
  | "fair"
  | "light"
  | "medium"
  | "olive"
  | "brown"
  | "dark";

export type BodyType =
  | "hourglass"
  | "pear"
  | "apple"
  | "rectangle"
  | "inverted_triangle";

export interface StyleProfile {
  id: string;
  user_id: string;
  skin_tone: SkinTone;
  body_type: BodyType;
  skin_tone_description: string;
  body_type_description: string;
  style_notes: string;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelfieAnalysisResult {
  skin_tone: SkinTone;
  body_type: BodyType;
  skin_tone_description: string;
  body_type_description: string;
  style_notes: string;
}

export interface FitcheckResult {
  verdict: "yes" | "no" | "maybe";
  headline: string;
  reasoning: string;
  what_works: string[];
  what_doesnt: string[];
  pair_with: string[];
  confidence: number;
}
