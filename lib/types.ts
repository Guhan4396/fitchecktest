export type Gender = "men" | "women";

export type Undertone = "warm" | "cool" | "neutral";

export interface StyleProfile {
  id: string;
  user_id: string;
  gender: Gender;
  skin_tone: string;
  undertone: string;
  face_shape: string;
  best_necklines: string;
  body_type: string;
  best_fits: string;
  proportions: string;
  colors_that_work: string[];
  colors_to_avoid: string[];
  clothing_recommendations: string;
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
  proportions: string;
  colors_that_work: string[];
  colors_to_avoid: string[];
  clothing_recommendations: string;
  style_notes: string;
}

export interface FitcheckResult {
  verdict: "yes" | "no" | "maybe";
  headline: string;
  reasoning: string;
  what_works: string[];
  what_doesnt: string[];
  pair_with: string[];
  alternatives: string[];
  confidence: number;
}
