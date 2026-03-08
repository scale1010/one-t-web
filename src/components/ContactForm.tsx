"use client";

import { useState, useRef, useEffect } from "react";

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactForm({ isOpen, onClose }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setEmail("");
      setMessage("");
      setError("");
      setIsSuccess(false);
    }
  }, [isOpen]);

  // Auto-close success message after 3 seconds
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!trimmedMessage) {
      setError("Message is required");
      return;
    }

    if (trimmedMessage.length < 10) {
      setError("Message must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
        }),
      });

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

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - only on mobile for better UX */}
      <div 
        className="fixed inset-0 z-40 md:hidden bg-black/20" 
        aria-hidden="true"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute right-0 top-full mt-2 z-50 w-80 md:w-96
                   bg-white dark:bg-zinc-900
                   border border-zinc-300 dark:border-zinc-700
                   rounded-lg shadow-xl
                   animate-fade-in"
      >
        <div className="p-6">
          {isSuccess ? (
            <div className="text-center py-4">
              <div className="mb-3">
                <svg
                  className="w-12 h-12 mx-auto text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                Message sent!
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                We'll get back to you soon.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
                  Contact Us
                </h3>
                <button
                  onClick={onClose}
                  className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200
                             transition-colors"
                  aria-label="Close"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    placeholder="Name"
                    required
                    disabled={isSubmitting}
                    className="w-full h-10 px-3
                               rounded-lg border
                               border-zinc-300 dark:border-zinc-700
                               bg-white dark:bg-zinc-900
                               text-zinc-900 dark:text-white
                               focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500
                               font-sans text-sm
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="Email"
                    required
                    disabled={isSubmitting}
                    className="w-full h-10 px-3
                               rounded-lg border
                               border-zinc-300 dark:border-zinc-700
                               bg-white dark:bg-zinc-900
                               text-zinc-900 dark:text-white
                               focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500
                               font-sans text-sm
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setError("");
                    }}
                    placeholder="Message"
                    required
                    disabled={isSubmitting}
                    rows={4}
                    className="w-full px-3 py-2
                               rounded-lg border
                               border-zinc-300 dark:border-zinc-700
                               bg-white dark:bg-zinc-900
                               text-zinc-900 dark:text-white
                               focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500
                               font-sans text-sm resize-none
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 animate-fade-in">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 px-4
                             rounded-lg
                             bg-zinc-800 dark:bg-zinc-800
                             text-zinc-300
                             font-medium text-sm
                             cursor-pointer
                             focus:outline-none
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-opacity
                             flex items-center justify-center"
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
                    "Send"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
