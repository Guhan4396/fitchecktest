export type SkinTone =
  | "fair"
  | "wheatish"
  | "medium brown"
  | "dark brown"
  | "deep";

export type Undertone = "warm" | "cool" | "neutral";

export type FaceShape =
  | "oval"
  | "rectangle"
  | "square"
  | "round"
  | "heart"
  | "diamond";

export type BodyType =
  | "slim/lean"
  | "athletic"
  | "average"
  | "broad shoulders"
  | "pear shaped"
  | "plus size";

export interface StyleProfile {
  id: string;
  user_id: string;
  skin_tone: string;
  undertone: string;
  face_shape: string;
  best_necklines: string;
  body_type: string;
  best_fits: string;
  colors_that_work: string[];
  colors_to_avoid: string[];
  skin_tone_description: string;
  body_type_description: string;
  style_notes: string;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelfieAnalysisResult {
  skin_tone: string;
  undertone: string;
  face_shape: string;
  best_necklines: string;
  body_type: string;
  best_fits: string;
  colors_that_work: string[];
  colors_to_avoid: string[];
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
