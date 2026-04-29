"use client";

import { useState } from "react";
import { colors, spacing, fontSize, fontWeight, radius, shadows } from "@/config/design-tokens";

export default function DesignTokensTest() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-5xl font-bold mb-2"
              style={{
                fontSize: fontSize["5xl"],
                fontWeight: fontWeight.bold,
                color: "var(--color-text-primary)",
              }}
            >
              Design Tokens
            </h1>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Complete design system tokens showcase
            </p>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary">
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>

        {/* Color Palette */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Color Palette
          </h2>

          {/* Primary Colors */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Primary Colors</h3>
            <div className="grid grid-cols-11 gap-2">
              {Object.entries(colors.primary).map(([shade, color]) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-16 rounded mb-2"
                    style={{ backgroundColor: color, boxShadow: shadows.sm }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {shade}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary Colors */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Secondary Colors</h3>
            <div className="grid grid-cols-11 gap-2">
              {Object.entries(colors.secondary).map(([shade, color]) => (
                <div key={shade} className="text-center">
                  <div
                    className="h-16 rounded mb-2"
                    style={{ backgroundColor: color, boxShadow: shadows.sm }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {shade}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Semantic Colors */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div
                className="h-20 rounded mb-2"
                style={{ backgroundColor: colors.success[600], boxShadow: shadows.md }}
              />
              <p className="font-semibold">Success</p>
            </div>
            <div className="text-center">
              <div
                className="h-20 rounded mb-2"
                style={{ backgroundColor: colors.warning[500], boxShadow: shadows.md }}
              />
              <p className="font-semibold">Warning</p>
            </div>
            <div className="text-center">
              <div
                className="h-20 rounded mb-2"
                style={{ backgroundColor: colors.error[500], boxShadow: shadows.md }}
              />
              <p className="font-semibold">Error</p>
            </div>
            <div className="text-center">
              <div
                className="h-20 rounded mb-2"
                style={{ backgroundColor: colors.info[500], boxShadow: shadows.md }}
              />
              <p className="font-semibold">Info</p>
            </div>
          </div>
        </section>

        {/* Typography Scale */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Typography Scale</h2>
          <div className="card space-y-4">
            <div style={{ fontSize: fontSize["6xl"], fontWeight: fontWeight.bold }}>Display XL</div>
            <div style={{ fontSize: fontSize["5xl"], fontWeight: fontWeight.bold }}>Display LG</div>
            <div style={{ fontSize: fontSize["4xl"], fontWeight: fontWeight.bold }}>
              Heading 4XL
            </div>
            <div style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.semibold }}>
              Heading 3XL
            </div>
            <div style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.semibold }}>
              Heading 2XL
            </div>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold }}>Heading XL</div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>Heading LG</div>
            <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.normal }}>
              Body Base - Regular paragraph text
            </div>
            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.normal }}>
              Body SM - Smaller text for supporting content
            </div>
            <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.normal }}>
              Body XS - Captions and fine print
            </div>
          </div>
        </section>

        {/* Spacing Scale */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Spacing Scale</h2>
          <div className="card">
            <div className="space-y-2">
              {[1, 2, 3, 4, 6, 8, 12, 16, 24].map((size) => (
                <div key={size} className="flex items-center gap-4">
                  <div
                    className="bg-blue-500"
                    style={{
                      width: spacing[size as keyof typeof spacing],
                      height: spacing[4],
                      boxShadow: shadows.sm,
                    }}
                  />
                  <span style={{ color: "var(--color-text-secondary)", fontSize: fontSize.sm }}>
                    spacing[{size}] = {spacing[size as keyof typeof spacing]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Border Radius */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Border Radius</h2>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(radius).map(([name, value]) => (
              <div key={name} className="card text-center">
                <div
                  className="w-full h-20 bg-blue-500 mb-3"
                  style={{ borderRadius: value, boxShadow: shadows.sm }}
                />
                <p className="font-semibold">{name}</p>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Shadows */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Shadow Scale</h2>
          <div className="grid grid-cols-3 gap-6">
            {Object.entries(shadows)
              .filter(([name]) => name !== "none" && name !== "inner")
              .map(([name, value]) => (
                <div
                  key={name}
                  className="p-6 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    boxShadow: value,
                  }}
                >
                  <p className="font-semibold mb-1">{name}</p>
                  <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    shadows.{name}
                  </p>
                </div>
              ))}
          </div>
        </section>

        {/* Component Examples */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Component Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buttons */}
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">Buttons</h3>
              <div className="flex flex-col gap-3">
                <button
                  style={{
                    padding: `${spacing[3]} ${spacing[6]}`,
                    backgroundColor: colors.primary[600],
                    color: colors.white,
                    borderRadius: radius.lg,
                    fontWeight: fontWeight.medium,
                    boxShadow: shadows.sm,
                  }}
                >
                  Primary Button
                </button>
                <button
                  style={{
                    padding: `${spacing[3]} ${spacing[6]}`,
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    border: `1px solid var(--color-border)`,
                    borderRadius: radius.lg,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Secondary Button
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">Cards</h3>
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: `1px solid var(--color-border)`,
                  boxShadow: shadows.md,
                }}
              >
                <h4 className="font-semibold mb-2">Card Title</h4>
                <p style={{ fontSize: fontSize.sm, color: "var(--color-text-secondary)" }}>
                  Card content using design tokens
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
