"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const reveal = () => setShown(true);
    let cleanup = () => {};
    const frame = window.requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const height = window.innerHeight || document.documentElement.clientHeight;
      if (rect.bottom > 0 && rect.top < height) {
        reveal();
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          reveal();
          observer.disconnect();
        },
        { threshold: 0 },
      );
      observer.observe(node);
      cleanup = () => observer.disconnect();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-in${shown ? " fade-in-shown" : ""}${className ? ` ${className}` : ""}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
