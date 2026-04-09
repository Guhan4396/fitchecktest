"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if they have a profile
        const { data: profile } = await supabase
          .from("style_profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          router.replace("/fitcheck");
        } else {
          router.replace("/onboarding");
        }
      } else {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  async function handleGetStarted() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInAnonymously();
    router.push("/onboarding");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center max-w-lg mx-auto w-full">
        <div className="text-6xl mb-6">👗</div>

        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="text-gradient">Fitcheck</span>
        </h1>

        <p className="text-xl text-white/70 font-medium mb-2">
          Your AI fashion advisor.
        </p>
        <p className="text-white/50 text-base mb-10 leading-relaxed">
          Upload a selfie, get your style profile. Then check any outfit to see
          if it actually works for you — not just anyone.
        </p>

        <button onClick={handleGetStarted} className="btn-primary w-full text-lg py-4 mb-4">
          Get my style profile
        </button>

        <p className="text-white/30 text-sm">
          No account needed · Takes 30 seconds
        </p>
      </div>

      {/* How it works */}
      <div className="px-6 pb-16 max-w-lg mx-auto w-full">
        <div className="card-glass p-6 space-y-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
            How it works
          </h2>

          {[
            {
              step: "01",
              title: "Take a selfie",
              desc: "AI reads your skin tone and body type",
            },
            {
              step: "02",
              title: "Upload a garment",
              desc: "Photo or paste a Myntra / Ajio link",
            },
            {
              step: "03",
              title: "Get the real verdict",
              desc: "Yes, No, and exactly what to pair it with",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4 items-start">
              <span className="text-fuchsia-400 font-mono text-sm font-bold shrink-0 mt-0.5">
                {step}
              </span>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-white/50 text-sm">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
