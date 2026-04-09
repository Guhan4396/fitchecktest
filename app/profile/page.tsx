"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { StyleProfile } from "@/lib/types";

const SKIN_TONE_COLORS: Record<string, string> = {
  fair: "#FDDBB4",
  light: "#EEC99A",
  medium: "#C68642",
  olive: "#8D5524",
  brown: "#6B3A2A",
  dark: "#3B1F0E",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("style_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!data) {
        router.replace("/onboarding");
        return;
      }

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
        <h1 className="text-xl font-bold text-gradient flex-1 text-center">
          My Style Profile
        </h1>
        <div className="w-12" />
      </div>

      {/* Profile photo */}
      {profile.profile_image_url && (
        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-fuchsia-500/50">
            <Image
              src={profile.profile_image_url}
              alt="Your profile"
              fill
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Skin tone */}
      <div className="card-glass p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-white/20 shrink-0"
            style={{
              backgroundColor:
                SKIN_TONE_COLORS[profile.skin_tone] || "#C68642",
            }}
          />
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
              Skin Tone
            </p>
            <p className="font-bold text-lg capitalize">{profile.skin_tone}</p>
          </div>
        </div>
        <p className="text-white/60 text-sm leading-relaxed">
          {profile.skin_tone_description}
        </p>
      </div>

      {/* Body type */}
      <div className="card-glass p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl shrink-0">
            👤
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
              Body Type
            </p>
            <p className="font-bold text-lg capitalize">
              {profile.body_type.replace("_", " ")}
            </p>
          </div>
        </div>
        <p className="text-white/60 text-sm leading-relaxed">
          {profile.body_type_description}
        </p>
      </div>

      {/* Style notes */}
      <div className="card-glass p-5 border-fuchsia-500/20 mb-6">
        <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-2">
          Your Style Notes
        </p>
        <p className="text-white/80 text-sm leading-relaxed">
          {profile.style_notes}
        </p>
      </div>

      {/* Last updated */}
      <p className="text-white/20 text-xs text-center mb-6">
        Profile created{" "}
        {new Date(profile.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <button
        onClick={() => router.push("/fitcheck")}
        className="btn-primary w-full text-base py-4 mb-3"
      >
        Check an outfit →
      </button>

      <button
        onClick={() => router.push("/onboarding")}
        className="btn-secondary w-full text-sm py-3"
      >
        Update profile with new selfie
      </button>
    </main>
  );
}
