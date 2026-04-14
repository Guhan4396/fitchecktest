"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { StyleProfile } from "@/lib/types";

const UNDERTONE_COLORS: Record<string, string> = {
  warm: "#C8860A",
  cool: "#5B6EAE",
  neutral: "#8A7A6A",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) { router.replace("/"); return; }

      const { data } = await supabase
        .from("style_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!data) { router.replace("/onboarding"); return; }

      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen flex flex-col max-w-lg mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gradient flex-1 text-center">My Style Profile</h1>
        <div className="w-12" />
      </div>

      {profile.profile_image_url && (
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-fuchsia-500/50">
            <Image src={profile.profile_image_url} alt="Your profile" fill className="object-cover" />
          </div>
        </div>
      )}

      {/* Skin tone + undertone */}
      <div className="card-glass p-5 mb-4">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">Skin Tone</p>
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded-full border border-white/20 shrink-0"
            style={{ backgroundColor: UNDERTONE_COLORS[profile.undertone] || "#C68642" }}
          />
          <p className="font-bold text-lg capitalize">
            {profile.skin_tone}
            <span className="text-white/40 font-normal text-sm ml-2">
              · {profile.undertone} undertone
            </span>
          </p>
        </div>
      </div>

      {/* Face shape */}
      <div className="card-glass p-5 mb-4">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Face Shape</p>
        <p className="font-bold text-lg capitalize mb-2">{profile.face_shape}</p>
        {profile.best_necklines && (
          <p className="text-white/60 text-sm leading-relaxed">{profile.best_necklines}</p>
        )}
      </div>

      {/* Body type */}
      <div className="card-glass p-5 mb-4">
        <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Body Type</p>
        <p className="font-bold text-lg capitalize mb-2">{profile.body_type}</p>
        {profile.best_fits && (
          <p className="text-white/60 text-sm leading-relaxed">{profile.best_fits}</p>
        )}
      </div>

      {/* Color palette */}
      {((profile.colors_that_work?.length > 0) || (profile.colors_to_avoid?.length > 0)) && (
        <div className="card-glass p-5 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-4">Colour Palette</p>
          {profile.colors_that_work?.length > 0 && (
            <div className="mb-4">
              <p className="text-emerald-400 text-xs font-semibold mb-2">Always works</p>
              <div className="flex flex-wrap gap-2">
                {profile.colors_that_work.map((color) => (
                  <span key={color} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-white/70 text-xs">
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.colors_to_avoid?.length > 0 && (
            <div>
              <p className="text-red-400 text-xs font-semibold mb-2">Avoid</p>
              <div className="flex flex-wrap gap-2">
                {profile.colors_to_avoid.map((color) => (
                  <span key={color} className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-white/50 text-xs">
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Style notes */}
      <div className="card-glass p-5 border-fuchsia-500/20 mb-6">
        <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-2">Style Notes</p>
        <p className="text-white/80 text-sm leading-relaxed">{profile.style_notes}</p>
      </div>

      <p className="text-white/20 text-xs text-center mb-6">
        Profile created{" "}
        {new Date(profile.created_at).toLocaleDateString("en-IN", {
          day: "numeric", month: "long", year: "numeric",
        })}
      </p>

      <button onClick={() => router.push("/fitcheck")} className="btn-primary w-full text-base py-4 mb-3">
        Check an outfit →
      </button>
      <button onClick={() => router.push("/onboarding")} className="btn-secondary w-full text-sm py-3">
        Update profile with new selfie
      </button>
    </main>
  );
}
