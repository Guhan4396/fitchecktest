"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SelfieAnalysisResult } from "@/lib/types";

type Step = "upload" | "analyzing" | "result";

const SKIN_TONE_COLORS: Record<string, string> = {
  fair: "#FDDBB4",
  light: "#EEC99A",
  medium: "#C68642",
  olive: "#8D5524",
  brown: "#6B3A2A",
  dark: "#3B1F0E",
};

const BODY_TYPE_ICONS: Record<string, string> = {
  hourglass: "⧖",
  pear: "🍐",
  apple: "🍎",
  rectangle: "▬",
  inverted_triangle: "△",
};

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<SelfieAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
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

  async function analyzePhoto() {
    if (!selectedFile) return;
    setStep("analyzing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/analyze-selfie", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Need to sign in first
          const authRes = await fetch("/api/auth/anonymous", {
            method: "POST",
          });
          if (authRes.ok) {
            // Retry
            const retryRes = await fetch("/api/analyze-selfie", {
              method: "POST",
              body: formData,
            });
            const retryData = await retryRes.json();
            if (!retryRes.ok) throw new Error(retryData.error || "Analysis failed");
            setAnalysis(retryData.analysis);
            setStep("result");
            return;
          }
        }
        throw new Error(data.error || "Analysis failed");
      }

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
        <button
          onClick={() => router.push("/")}
          className="text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1" />
        <span className="text-white/30 text-sm">Step 1 of 1</span>
      </div>

      {step === "upload" && (
        <>
          <h1 className="text-2xl font-bold mb-2">
            First, let&apos;s read you.
          </h1>
          <p className="text-white/50 mb-8 leading-relaxed">
            Upload a clear selfie — face and upper body ideally. AI will extract
            your skin tone and body type to build your style profile.
          </p>

          {/* Drop zone */}
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
              ${previewUrl ? "aspect-square overflow-hidden" : "aspect-[4/3] flex flex-col items-center justify-center gap-3"}
            `}
          >
            {previewUrl ? (
              <>
                <Image
                  src={previewUrl}
                  alt="Your selfie"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white font-medium text-sm bg-black/50 px-3 py-1.5 rounded-full">
                    Change photo
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl">📸</div>
                <div className="text-center">
                  <p className="text-white/70 font-medium">
                    Tap to upload a selfie
                  </p>
                  <p className="text-white/30 text-sm mt-1">
                    or drag and drop here
                  </p>
                </div>
                <p className="text-white/20 text-xs">
                  JPG, PNG or WEBP · Max 10MB
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {error && (
            <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={analyzePhoto}
              disabled={!selectedFile}
              className="btn-primary w-full text-base py-4"
            >
              Analyse my style →
            </button>

            <p className="text-white/25 text-xs text-center">
              Your photo is processed securely. We don&apos;t store it beyond
              your profile.
            </p>
          </div>

          {/* Tips */}
          <div className="mt-8 card-glass p-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              For best results
            </p>
            <ul className="space-y-2">
              {[
                "Good natural lighting",
                "Face and upper body visible",
                "Neutral background if possible",
              ].map((tip) => (
                <li key={tip} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="text-fuchsia-400 text-xs">✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {step === "analyzing" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          {previewUrl && (
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-fuchsia-500/50">
              <Image
                src={previewUrl}
                alt="Analyzing"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold mb-2">Reading you...</h2>
            <p className="text-white/50 text-sm">
              AI is analysing your skin tone and body type
            </p>
          </div>

          <div className="card-glass p-4 w-full space-y-3">
            {["Detecting skin tone", "Analysing body type", "Building style profile"].map(
              (item, i) => (
                <div key={item} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-fuchsia-400 border-t-transparent animate-spin shrink-0"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                  <span className="text-white/60 text-sm">{item}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {step === "result" && analysis && (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <div className="text-3xl mb-3">✨</div>
            <h1 className="text-2xl font-bold mb-2">Your style profile</h1>
            <p className="text-white/50 text-sm">
              Here&apos;s what AI picked up about you
            </p>
          </div>

          {/* Selfie preview */}
          {previewUrl && (
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-fuchsia-500/50 mx-auto">
              <Image
                src={previewUrl}
                alt="Your selfie"
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Skin tone card */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-white/20 shrink-0"
                style={{
                  backgroundColor:
                    SKIN_TONE_COLORS[analysis.skin_tone] || "#C68642",
                }}
              />
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
                  Skin Tone
                </p>
                <p className="font-bold text-lg capitalize">
                  {analysis.skin_tone}
                </p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              {analysis.skin_tone_description}
            </p>
          </div>

          {/* Body type card */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl shrink-0">
                {BODY_TYPE_ICONS[analysis.body_type] || "👤"}
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
                  Body Type
                </p>
                <p className="font-bold text-lg capitalize">
                  {analysis.body_type.replace("_", " ")}
                </p>
              </div>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              {analysis.body_type_description}
            </p>
          </div>

          {/* Style notes */}
          <div className="card-glass p-5 border-fuchsia-500/20">
            <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Style Notes
            </p>
            <p className="text-white/80 text-sm leading-relaxed">
              {analysis.style_notes}
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={() => router.push("/fitcheck")}
            className="btn-primary w-full text-base py-4"
          >
            Start checking outfits →
          </button>

          <button
            onClick={() => {
              setStep("upload");
              setPreviewUrl(null);
              setSelectedFile(null);
              setAnalysis(null);
            }}
            className="btn-secondary w-full text-sm py-3"
          >
            Redo with a different photo
          </button>
        </div>
      )}
    </main>
  );
}
