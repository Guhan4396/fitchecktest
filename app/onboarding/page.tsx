"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SelfieAnalysisResult, Gender } from "@/lib/types";

type Step = "gender" | "upload" | "analyzing" | "result";

const UNDERTONE_COLORS: Record<string, string> = {
  warm: "#C8860A",
  cool: "#5B6EAE",
  neutral: "#8A7A6A",
};

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("gender");
  const [gender, setGender] = useState<Gender | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<SelfieAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Image must be under 15MB."); return; }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function analyzePhoto() {
    if (!selectedFile || !gender) return;
    setStep("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("gender", gender);

      let response = await fetch("/api/analyze-selfie", { method: "POST", body: formData });
      let data = await response.json();

      if (!response.ok && response.status === 401) {
        await fetch("/api/auth/anonymous", { method: "POST" });
        response = await fetch("/api/analyze-selfie", { method: "POST", body: formData });
        data = await response.json();
      }

      if (!response.ok) throw new Error(data.error || "Analysis failed");

      setAnalysis(data.analysis);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("upload");
    }
  }

  return (
    <main className="min-h-screen flex flex-col max-w-lg mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        {step !== "gender" && (
          <button
            onClick={() => setStep(step === "upload" ? "gender" : step === "result" ? "upload" : "gender")}
            className="text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            ← Back
          </button>
        )}
        {step === "gender" && (
          <button onClick={() => router.push("/")} className="text-white/40 hover:text-white/70 transition-colors text-sm">
            ← Back
          </button>
        )}
        <div className="flex-1" />
        <span className="text-white/30 text-sm">
          {step === "gender" ? "Step 1 of 2" : step === "upload" ? "Step 2 of 2" : ""}
        </span>
      </div>

      {/* STEP: Gender */}
      {step === "gender" && (
        <div className="flex flex-col items-center text-center flex-1 justify-center gap-8">
          <div>
            <h1 className="text-2xl font-bold mb-3">I am shopping for</h1>
            <p className="text-white/50 text-sm">This helps personalise your style analysis</p>
          </div>

          <div className="flex gap-4 w-full">
            <button
              onClick={() => { setGender("men"); setStep("upload"); }}
              className="flex-1 card-glass py-10 rounded-2xl flex flex-col items-center gap-3
                         hover:border-fuchsia-500/50 hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              <span className="text-5xl">👔</span>
              <span className="font-bold text-lg">Men</span>
            </button>
            <button
              onClick={() => { setGender("women"); setStep("upload"); }}
              className="flex-1 card-glass py-10 rounded-2xl flex flex-col items-center gap-3
                         hover:border-fuchsia-500/50 hover:bg-white/10 transition-all duration-200 active:scale-95"
            >
              <span className="text-5xl">👗</span>
              <span className="font-bold text-lg">Women</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP: Upload */}
      {step === "upload" && (
        <>
          <h1 className="text-2xl font-bold mb-2">Upload a full body photo</h1>
          <p className="text-white/50 mb-8 leading-relaxed">
            A full body photo gives the best analysis — skin tone, body type, and proportions all in one shot.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
              ${dragging ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-white/20 hover:border-white/40 hover:bg-white/5"}
              ${previewUrl ? "aspect-[3/4] overflow-hidden" : "aspect-[3/4] flex flex-col items-center justify-center gap-3"}
            `}
          >
            {previewUrl ? (
              <>
                <Image src={previewUrl} alt="Your photo" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white font-medium text-sm bg-black/50 px-3 py-1.5 rounded-full">Change photo</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl">📸</div>
                <div className="text-center">
                  <p className="text-white/70 font-medium">Tap to upload a full body photo</p>
                  <p className="text-white/30 text-sm mt-1">or drag and drop here</p>
                </div>
                <p className="text-white/20 text-xs">JPG, PNG or WEBP · Max 15MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}

          <div className="mt-6 space-y-3">
            <button onClick={analyzePhoto} disabled={!selectedFile} className="btn-primary w-full text-base py-4">
              Analyse my style →
            </button>
            <p className="text-white/25 text-xs text-center">
              Your photo is processed securely and not stored beyond your profile.
            </p>
          </div>

          <div className="mt-6 card-glass p-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">For best results</p>
            <ul className="space-y-2">
              {["Full body visible — head to toe", "Good natural lighting", "Neutral background if possible"].map((tip) => (
                <li key={tip} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="text-fuchsia-400 text-xs">✓</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* STEP: Analyzing */}
      {step === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          {previewUrl && (
            <div className="relative w-32 h-40 rounded-2xl overflow-hidden border-2 border-fuchsia-500/50">
              <Image src={previewUrl} alt="Analyzing" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold mb-2">Reading you...</h2>
            <p className="text-white/50 text-sm">Building your full style profile</p>
          </div>
          <div className="card-glass p-4 w-full space-y-3">
            {["Detecting skin tone & undertone", "Analysing body type & proportions", "Building colour palette", "Writing clothing recommendations"].map((item, i) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full border-2 border-fuchsia-400 border-t-transparent animate-spin shrink-0"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
                <span className="text-white/60 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP: Result */}
      {step === "result" && analysis && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl mb-3">✨</div>
            <h1 className="text-2xl font-bold mb-1">Your style profile</h1>
            <p className="text-white/40 text-sm capitalize">
              {gender === "men" ? "👔 Men" : "👗 Women"}
            </p>
          </div>

          {previewUrl && (
            <div className="relative w-20 h-28 rounded-xl overflow-hidden border-2 border-fuchsia-500/50 mx-auto">
              <Image src={previewUrl} alt="Your photo" fill className="object-cover" />
            </div>
          )}

          {/* Skin tone */}
          <div className="card-glass p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Skin Tone</p>
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full border border-white/20 shrink-0"
                style={{ backgroundColor: UNDERTONE_COLORS[analysis.undertone] || "#C68642" }}
              />
              <p className="font-bold text-lg capitalize">
                {analysis.skin_tone}
                <span className="text-white/40 font-normal text-sm ml-2">· {analysis.undertone} undertone</span>
              </p>
            </div>
          </div>

          {/* Body type + proportions */}
          <div className="card-glass p-5">
            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Body Type</p>
            <p className="font-bold text-lg capitalize mb-2">{analysis.body_type}</p>
            {analysis.proportions && (
              <p className="text-white/60 text-sm leading-relaxed">{analysis.proportions}</p>
            )}
          </div>

          {/* Clothing recommendations */}
          {analysis.clothing_recommendations && (
            <div className="card-glass p-5">
              <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">What Works For You</p>
              <p className="text-white/70 text-sm leading-relaxed">{analysis.clothing_recommendations}</p>
            </div>
          )}

          {/* Color palette */}
          {(analysis.colors_that_work.length > 0 || analysis.colors_to_avoid.length > 0) && (
            <div className="card-glass p-5">
              <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-4">Your Colour Palette</p>
              {analysis.colors_that_work.length > 0 && (
                <div className="mb-4">
                  <p className="text-emerald-400 text-xs font-semibold mb-2">Always works</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.colors_that_work.map((c) => (
                      <span key={c} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-white/70 text-xs">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.colors_to_avoid.length > 0 && (
                <div>
                  <p className="text-red-400 text-xs font-semibold mb-2">Avoid</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.colors_to_avoid.map((c) => (
                      <span key={c} className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-white/50 text-xs">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Style notes */}
          <div className="card-glass p-5 border-fuchsia-500/20">
            <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-2">Style Notes</p>
            <p className="text-white/80 text-sm leading-relaxed">{analysis.style_notes}</p>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button onClick={() => router.push("/fitcheck")} className="btn-primary w-full text-base py-4">
            Start checking outfits →
          </button>
          <button
            onClick={() => { setStep("gender"); setPreviewUrl(null); setSelectedFile(null); setAnalysis(null); setGender(null); }}
            className="btn-secondary w-full text-sm py-3"
          >
            Start over
          </button>
        </div>
      )}
    </main>
  );
}
