"use client";

import { useState, useEffect, useRef } from "react";

const ROLES = [
  "Business Users",
  "Content Creators",
  "Research Analysts",
  "Programmers",
  "SRE",
  "Security Professionals",
  "CxOs",
];

const CYCLE_INTERVAL = 3000;
const SLIDE_DURATION = 400; // ms — smooth, not too fast

export default function VerticalSlideDisplay() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIsSliding(true);

      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % ROLES.length);
        setIsSliding(false);
      }, SLIDE_DURATION);
    }, CYCLE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const nextIndex = (currentIndex + 1) % ROLES.length;

  return (
    <span
      className="relative inline-block role-underline"
      style={{ 
        verticalAlign: "baseline"
      }}
      aria-live="polite"
    >
      {/* Sliding container with overflow hidden */}
      <span
        className="inline-block overflow-hidden"
        style={{ 
          height: "1em",
          lineHeight: "1em"
        }}
      >
        {/* Sliding track: current slides up and out, next slides up into view */}
        <span
          className="block"
          style={{
            transition: `transform ${SLIDE_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            transform: isSliding ? `translateY(-1em)` : "translateY(0)",
          }}
        >
          {/* Current role */}
          <span
            className="block font-semibold text-zinc-900 dark:text-white whitespace-nowrap"
            style={{ 
              height: "1em",
              lineHeight: "1em"
            }}
          >
            {ROLES[currentIndex]}
          </span>
          {/* Next role (positioned below, slides up) */}
          <span
            className="block font-semibold text-zinc-900 dark:text-white whitespace-nowrap"
            style={{ 
              height: "1em",
              lineHeight: "1em"
            }}
          >
            {ROLES[nextIndex]}
          </span>
        </span>
      </span>
    </span>
  );
}
