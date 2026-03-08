"use client";

import VerticalSlideDisplay from "@/components/SplitFlapDisplay";
import ThemeToggle from "@/components/ThemeToggle";
import ContactForm from "@/components/ContactForm";
import { useState, useRef } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isContactOpen, setIsContactOpen] = useState(false);
  const contactButtonRef = useRef<HTMLButtonElement>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server error. Please try again later.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      // Success - replace form with message
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-[#0a0a0a]">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 relative">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-mono">
          OneThought AI
        </h1>
        <div className="flex items-center gap-2 relative">
          <button
            ref={contactButtonRef}
            onClick={() => setIsContactOpen(!isContactOpen)}
            className="relative w-10 h-10 flex items-center justify-center rounded-full 
                       bg-zinc-200 dark:bg-zinc-800 
                       hover:bg-zinc-300 dark:hover:bg-zinc-700
                       text-zinc-700 dark:text-zinc-300
                       cursor-pointer
                       transition-colors"
            aria-label="Contact us"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </button>
          <ContactForm isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
          <ThemeToggle />
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        {/* 
          Layout: both headline and input share the same center line.
          The wider container (max-w-3xl) holds the headline grid.
          The input (max-w-md) is centered within it.
          Both have the same center point.
        */}
        <div className="w-full max-w-3xl">
          {/* Software for + Role — split at center */}
          <div className="grid grid-cols-2 mb-14">
            {/* Left half: "Software for" right-aligned to center */}
            <span className="text-2xl md:text-4xl lg:text-5xl font-light text-zinc-500 dark:text-zinc-400 whitespace-nowrap leading-none text-right pr-2 md:pr-3">
              AI Kernel for
            </span>
            {/* Right half: Role left-aligned from center */}
            <span className="text-2xl md:text-4xl lg:text-5xl leading-none text-left pl-2 md:pl-3">
              <VerticalSlideDisplay />
            </span>
          </div>

          {/* Email input + Go button — centered, narrower */}
          {isSuccess ? (
            <div className="max-w-md mx-auto animate-fade-in">
              <p className="text-center text-lg md:text-xl text-zinc-900 dark:text-white font-sans">
                Thank you. Your interest is noted. We will reach out soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col items-center max-w-md mx-auto">
              <div className="flex items-center w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(""); // Clear error on input change
                  }}
                  placeholder="Get early access"
                  required
                  disabled={isSubmitting}
                  className="input-shimmer input-glow
                             flex-1 h-12 px-4 
                             rounded-l-lg border border-r-0 
                             border-zinc-300 dark:border-zinc-700 
                             bg-white dark:bg-zinc-900 
                             text-zinc-900 dark:text-white 
                             focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500
                             font-sans text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 px-6 
                             rounded-r-lg 
                             bg-zinc-800 dark:bg-zinc-800
                             text-zinc-300
                             font-medium text-sm
                             cursor-pointer
                             focus:outline-none
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-opacity
                             flex items-center justify-center
                             min-w-[60px]"
                >
                  {isSubmitting ? (
                    <svg
                      className="animate-spin h-5 w-5 text-zinc-300"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    "Go"
                  )}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center w-full animate-fade-in">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="px-6 md:px-10 py-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto text-left">
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-800 dark:text-zinc-200 font-bold">ker·nel</span>
            {" "}
            <span className="text-zinc-400 dark:text-zinc-500">/ˈkərnl/</span>
            {" "}
            <span className="italic text-zinc-400 dark:text-zinc-500">noun</span>
          </p>
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 mt-1">
            The core of an operating system: the layer that manages every resource, process and permission.
          </p>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 italic mt-2">
            AI did not have one. Now it does.
          </p>
        </div>
      </footer>
    </div>
  );
}
