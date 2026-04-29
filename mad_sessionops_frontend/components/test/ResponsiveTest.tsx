"use client";

import {
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useWindowSize,
} from "@/hooks/useBreakpoint";
import {
  useMediaQuery,
  usePrefersReducedMotion,
  usePrefersDarkMode,
  useIsTouchDevice,
  useOrientation,
} from "@/hooks/useMediaQuery";
import { breakpoints, breakpointValues } from "@/config/design-tokens/breakpoints";
import { useState, useEffect } from "react";

export default function ResponsiveTest() {
  const breakpoint = useBreakpoint();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const windowSize = useWindowSize();
  const prefersReducedMotion = usePrefersReducedMotion();
  const prefersDarkMode = usePrefersDarkMode();
  const isTouchDevice = useIsTouchDevice();
  const orientation = useOrientation();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
            Responsive Breakpoints
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>Testing responsive design system</p>
        </div>

        {/* Current Breakpoint Display */}
        <section className="card mb-8">
          <h2 className="text-3xl font-bold mb-6">Current Breakpoint</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "base" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold">Base</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                &lt; 480px
              </div>
            </div>

            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "sm" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold">SM</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {breakpoints.sm}+
              </div>
            </div>

            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "md" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold">MD</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {breakpoints.md}+
              </div>
            </div>

            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "lg" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">💻</div>
              <div className="font-bold">LG</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {breakpoints.lg}+
              </div>
            </div>

            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "xl" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">🖥️</div>
              <div className="font-bold">XL</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {breakpoints.xl}+
              </div>
            </div>

            <div
              className="text-center p-6 rounded-lg"
              style={{
                backgroundColor:
                  breakpoint === "2xl" ? "var(--color-primary-100)" : "var(--color-surface)",
              }}
            >
              <div className="text-4xl mb-2">🖥️</div>
              <div className="font-bold">2XL</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {breakpoints["2xl"]}+
              </div>
            </div>
          </div>

          <div
            className="mt-6 p-4 rounded-lg"
            style={{ backgroundColor: "var(--color-primary-50)" }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Current: {breakpoint.toUpperCase()}</div>
              <div style={{ color: "var(--color-text-secondary)" }}>
                Window: {windowSize.width}px × {windowSize.height}px
              </div>
            </div>
          </div>
        </section>

        {/* Device Detection */}
        <section className="card mb-8">
          <h2 className="text-3xl font-bold mb-6">Device Detection</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className={`p-6 rounded-lg text-center ${isMobile ? "bg-green-100" : "bg-gray-100"}`}
            >
              <div className="text-4xl mb-2">📱</div>
              <div className="font-bold">Mobile</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {isMobile ? "✅ Active" : "❌ Inactive"}
              </div>
            </div>

            <div
              className={`p-6 rounded-lg text-center ${isTablet ? "bg-green-100" : "bg-gray-100"}`}
            >
              <div className="text-4xl mb-2">📲</div>
              <div className="font-bold">Tablet</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {isTablet ? "✅ Active" : "❌ Inactive"}
              </div>
            </div>

            <div
              className={`p-6 rounded-lg text-center ${isDesktop ? "bg-green-100" : "bg-gray-100"}`}
            >
              <div className="text-4xl mb-2">💻</div>
              <div className="font-bold">Desktop</div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {isDesktop ? "✅ Active" : "❌ Inactive"}
              </div>
            </div>
          </div>
        </section>

        {/* System Preferences */}
        <section className="card mb-8">
          <h2 className="text-3xl font-bold mb-6">System Preferences</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: prefersDarkMode
                  ? "var(--color-primary-100)"
                  : "var(--color-surface)",
              }}
            >
              <div className="font-semibold mb-1">Dark Mode</div>
              <div className="text-2xl">{prefersDarkMode ? "🌙" : "☀️"}</div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: isTouchDevice
                  ? "var(--color-primary-100)"
                  : "var(--color-surface)",
              }}
            >
              <div className="font-semibold mb-1">Touch Device</div>
              <div className="text-2xl">{isTouchDevice ? "👆" : "🖱️"}</div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: prefersReducedMotion
                  ? "var(--color-warning-100)"
                  : "var(--color-surface)",
              }}
            >
              <div className="font-semibold mb-1">Reduced Motion</div>
              <div className="text-2xl">{prefersReducedMotion ? "✅" : "❌"}</div>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: "var(--color-surface)" }}>
              <div className="font-semibold mb-1">Orientation</div>
              <div className="text-2xl">{orientation === "portrait" ? "📱" : "📐"}</div>
              <div className="text-sm capitalize">{orientation}</div>
            </div>
          </div>
        </section>

        {/* Responsive Grid Demo */}
        <section className="card mb-8">
          <h2 className="text-3xl font-bold mb-6">Responsive Grid</h2>
          <p className="mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Resize your browser to see the grid adapt
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square flex items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--color-primary-500)", color: "white" }}
              >
                <span className="text-2xl font-bold">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded" style={{ backgroundColor: "var(--color-surface)" }}>
            <code className="text-sm">
              grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6
            </code>
          </div>
        </section>

        {/* Responsive Typography */}
        <section className="card mb-8">
          <h2 className="text-3xl font-bold mb-6">Responsive Typography</h2>
          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
              Responsive Heading
            </h1>
            <p className="text-sm sm:text-base md:text-lg">
              This text scales based on viewport size
            </p>
            <div className="p-3 rounded" style={{ backgroundColor: "var(--color-surface)" }}>
              <code className="text-sm">text-2xl sm:text-3xl md:text-4xl lg:text-5xl</code>
            </div>
          </div>
        </section>

        {/* Breakpoint Values Reference */}
        <section className="card">
          <h2 className="text-3xl font-bold mb-6">Breakpoint Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--color-surface)" }}>
                  <th className="text-left p-3">Breakpoint</th>
                  <th className="text-left p-3">Min Width</th>
                  <th className="text-left p-3">Typical Devices</th>
                  <th className="text-left p-3">Tailwind Prefix</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 font-bold">XS</td>
                  <td className="p-3">{breakpoints.xs}</td>
                  <td className="p-3">Large Phones</td>
                  <td className="p-3">
                    <code>xs:</code>
                  </td>
                </tr>
                <tr style={{ backgroundColor: "var(--color-surface)" }}>
                  <td className="p-3 font-bold">SM</td>
                  <td className="p-3">{breakpoints.sm}</td>
                  <td className="p-3">Tablets</td>
                  <td className="p-3">
                    <code>sm:</code>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-bold">MD</td>
                  <td className="p-3">{breakpoints.md}</td>
                  <td className="p-3">Small Laptops</td>
                  <td className="p-3">
                    <code>md:</code>
                  </td>
                </tr>
                <tr style={{ backgroundColor: "var(--color-surface)" }}>
                  <td className="p-3 font-bold">LG</td>
                  <td className="p-3">{breakpoints.lg}</td>
                  <td className="p-3">Desktops</td>
                  <td className="p-3">
                    <code>lg:</code>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-bold">XL</td>
                  <td className="p-3">{breakpoints.xl}</td>
                  <td className="p-3">Large Desktops</td>
                  <td className="p-3">
                    <code>xl:</code>
                  </td>
                </tr>
                <tr style={{ backgroundColor: "var(--color-surface)" }}>
                  <td className="p-3 font-bold">2XL</td>
                  <td className="p-3">{breakpoints["2xl"]}</td>
                  <td className="p-3">Extra Large Screens</td>
                  <td className="p-3">
                    <code>2xl:</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
