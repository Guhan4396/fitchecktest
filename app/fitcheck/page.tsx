"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FitcheckResult } from "@/lib/types";
import type { StyleProfile } from "@/lib/types";

type InputMode = "image" | "url";
type Step = "input" | "analyzing" | "result";

function VerdictBadge({ verdict }: { verdict: FitcheckResult["verdict"] }) {
  const styles = {
    yes: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    no: "bg-red-500/20 text-red-400 border-red-500/30",
    maybe: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  const labels = { yes: "✓ Yes, wear it", no: "✗ Hard pass", maybe: "~ Maybe" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-bold ${styles[verdict]}`}
    >
      {labels[verdict]}
    </span>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-white/40 text-xs font-mono">{value}%</span>
    </div>
  );
}

export default function FitcheckPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [step, setStep] = useState<Step>("input");
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [result, setResult] = useState<FitcheckResult | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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
      setLoadingProfile(false);
    }

    loadProfile();
  }, [router]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Image must be under 15MB.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function runFitcheck() {
    if (inputMode === "image" && !selectedFile) return;
    if (inputMode === "url" && !productUrl.trim()) return;

    setStep("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      if (inputMode === "image" && selectedFile) {
        formData.append("image", selectedFile);
      } else if (inputMode === "url") {
        formData.append("url", productUrl.trim());
      }

      const response = await fetch("/api/analyze-outfit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data.result);
      setGarmentImageUrl(data.garmentImageUrl || previewUrl);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("input");
    }
  }

  function reset() {
    setStep("input");
    setPreviewUrl(null);
    setSelectedFile(null);
    setProductUrl("");
    setResult(null);
    setGarmentImageUrl(null);
    setError(null);
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col max-w-lg mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gradient flex-1">Fitcheck</h1>
        {profile && (
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <span className="capitalize">{profile.skin_tone}</span>
            <span>·</span>
            <span className="capitalize">{profile.body_type.replace("_", " ")}</span>
          </button>
        )}
      </div>

      {step === "input" && (
        <>
          <h2 className="text-2xl font-bold mb-2">Does it work for you?</h2>
          <p className="text-white/50 mb-6 text-sm leading-relaxed">
            Drop a photo of the garment or paste a Myntra / Ajio link. We&apos;ll check it against your profile.
          </p>

          {/* Input mode toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            <button
              onClick={() => setInputMode("image")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === "image"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              📸 Upload photo
            </button>
            <button
              onClick={() => setInputMode("url")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === "url"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              🔗 Paste URL
            </button>
          </div>

          {inputMode === "image" ? (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                  ${dragging ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-white/20 hover:border-white/40 hover:bg-white/5"}
                  ${previewUrl ? "aspect-[3/4] overflow-hidden" : "aspect-[4/3] flex flex-col items-center justify-center gap-3"}
                `}
              >
                {previewUrl ? (
                  <>
                    <Image
                      src={previewUrl}
                      alt="Garment"
                      fill
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white font-medium text-sm bg-black/50 px-3 py-1.5 rounded-full">
                        Change photo
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl">👕</div>
                    <div className="text-center">
                      <p className="text-white/70 font-medium">
                        Upload garment photo
                      </p>
                      <p className="text-white/30 text-sm mt-1">
                        Full outfit, flat lay, or product photo
                      </p>
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </>
          ) : (
            <div className="space-y-3">
              <input
                type="url"
                placeholder="https://www.myntra.com/..."
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-fuchsia-500/50 transition-colors"
              />
              <p className="text-white/25 text-xs">
                Works best with Myntra and Ajio product pages. We&apos;ll extract the product image.
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
          )}

          <button
            onClick={runFitcheck}
            disabled={
              (inputMode === "image" && !selectedFile) ||
              (inputMode === "url" && !productUrl.trim())
            }
            className="btn-primary w-full text-base py-4 mt-6"
          >
            Fitcheck this →
          </button>
        </>
      )}

      {step === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="text-5xl animate-bounce">🔍</div>
          <div>
            <h2 className="text-xl font-bold mb-2">Checking the fit...</h2>
            <p className="text-white/50 text-sm">
              Comparing against your style profile
            </p>
          </div>

          {profile && (
            <div className="card-glass p-4 w-full">
              <p className="text-white/30 text-xs uppercase tracking-wider font-semibold mb-3">
                Your profile
              </p>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-white/40">Skin: </span>
                  <span className="text-white capitalize">{profile.skin_tone}</span>
                </div>
                <div>
                  <span className="text-white/40">Body: </span>
                  <span className="text-white capitalize">
                    {profile.body_type.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-5">
          {/* Garment image */}
          {(garmentImageUrl || previewUrl) && (
            <div className="relative w-full aspect-[3/4] max-h-72 rounded-2xl overflow-hidden">
              <Image
                src={garmentImageUrl || previewUrl!}
                alt="Garment"
                fill
                className="object-contain bg-white/5"
              />
            </div>
          )}

          {/* Verdict */}
          <div className="card-glass p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <VerdictBadge verdict={result.verdict} />
            </div>

            <h2 className="text-xl font-bold mb-2 leading-snug">
              {result.headline}
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              {result.reasoning}
            </p>

            <div className="space-y-1">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-1">
                Confidence
              </p>
              <ConfidenceMeter value={result.confidence} />
            </div>
          </div>

          {/* What works */}
          {result.what_works.length > 0 && (
            <div className="card-glass p-5 border-emerald-500/10">
              <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                What works
              </p>
              <ul className="space-y-2">
                {result.what_works.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What doesn't */}
          {result.what_doesnt.length > 0 && (
            <div className="card-glass p-5 border-red-500/10">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">
                The issue
              </p>
              <ul className="space-y-2">
                {result.what_doesnt.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pair with */}
          {result.pair_with.length > 0 && (
            <div className="card-glass p-5 border-fuchsia-500/10">
              <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Pair it with
              </p>
              <ul className="space-y-2">
                {result.pair_with.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                    <span className="text-fuchsia-400 mt-0.5 shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Profile used */}
          {profile && (
            <div className="text-center">
              <p className="text-white/25 text-xs">
                Checked against your {profile.skin_tone} skin ·{" "}
                {profile.body_type.replace("_", " ")} body profile
              </p>
            </div>
          )}

          <button onClick={reset} className="btn-primary w-full text-base py-4">
            Check another outfit →
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="btn-secondary w-full text-sm py-3"
          >
            View my style profile
          </button>
        </div>
      )}
    </main>
  );
}
