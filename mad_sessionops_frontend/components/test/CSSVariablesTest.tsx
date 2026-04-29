"use client";

import { useState } from "react";

export default function CSSVariablesTest() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="container-custom py-16">
        {/* Header with Theme Toggle */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
              CSS Variables Test
            </h1>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Testing our design system variables
            </p>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary">
            {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        {/* Color Palette */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Color Palette
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Primary Colors */}
            <div className="card">
              <div
                className="h-20 rounded mb-3"
                style={{ backgroundColor: "var(--color-primary-500)" }}
              />
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Primary
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                --color-primary-500
              </p>
            </div>

            {/* Secondary Colors */}
            <div className="card">
              <div
                className="h-20 rounded mb-3"
                style={{ backgroundColor: "var(--color-secondary-500)" }}
              />
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Secondary
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                --color-secondary-500
              </p>
            </div>

            {/* Success */}
            <div className="card">
              <div
                className="h-20 rounded mb-3"
                style={{ backgroundColor: "var(--color-success)" }}
              />
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Success
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                --color-success
              </p>
            </div>

            {/* Error */}
            <div className="card">
              <div
                className="h-20 rounded mb-3"
                style={{ backgroundColor: "var(--color-error)" }}
              />
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Error
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                --color-error
              </p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Typography Scale
          </h2>
          <div className="card space-y-4">
            <p style={{ fontSize: "var(--font-size-6xl)", fontWeight: "var(--font-weight-bold)" }}>
              Heading 1
            </p>
            <p style={{ fontSize: "var(--font-size-4xl)", fontWeight: "var(--font-weight-bold)" }}>
              Heading 2
            </p>
            <p
              style={{
                fontSize: "var(--font-size-2xl)",
                fontWeight: "var(--font-weight-semibold)",
              }}
            >
              Heading 3
            </p>
            <p style={{ fontSize: "var(--font-size-base)", color: "var(--color-text-primary)" }}>
              Body text - This is what regular content looks like
            </p>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
              Small text - Supporting information and captions
            </p>
          </div>
        </section>

        {/* Spacing */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Spacing Scale
          </h2>
          <div className="card">
            <div className="space-y-4">
              {[2, 4, 6, 8, 12, 16].map((size) => (
                <div key={size} className="flex items-center gap-4">
                  <div
                    className="bg-blue-500"
                    style={{
                      width: `var(--spacing-${size})`,
                      height: "var(--spacing-4)",
                    }}
                  />
                  <span style={{ color: "var(--color-text-secondary)" }}>--spacing-{size}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Components */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Component Examples
          </h2>

          {/* Buttons */}
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className="btn btn-primary">Primary Button</button>
              <button className="btn btn-secondary">Secondary Button</button>
              <button className="btn btn-primary" disabled>
                Disabled
              </button>
            </div>
          </div>

          {/* Inputs */}
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">Form Inputs</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Enter text..." className="input" />
              <input type="email" placeholder="Email address" className="input" />
            </div>
          </div>

          {/* Badges */}
          <div className="card mb-6">
            <h3 className="text-xl font-semibold mb-4">Badges</h3>
            <div className="flex flex-wrap gap-3">
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-success">Success</span>
              <span className="badge badge-warning">Warning</span>
              <span className="badge badge-error">Error</span>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card">
              <h4 className="text-lg font-semibold mb-2">Card Title</h4>
              <p style={{ color: "var(--color-text-secondary)" }}>
                This is a card component using our design system variables.
              </p>
            </div>
            <div className="card">
              <h4 className="text-lg font-semibold mb-2">Another Card</h4>
              <p style={{ color: "var(--color-text-secondary)" }}>
                Hover over cards to see the shadow transition effect.
              </p>
            </div>
            <div className="card">
              <h4 className="text-lg font-semibold mb-2">Third Card</h4>
              <p style={{ color: "var(--color-text-secondary)" }}>
                All styling comes from CSS variables for easy theming.
              </p>
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>
            Shadow Scale
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {["sm", "base", "md", "lg", "xl", "2xl"].map((shadow) => (
              <div
                key={shadow}
                className="p-6 rounded-lg"
                style={{
                  backgroundColor: "var(--color-surface)",
                  boxShadow: `var(--shadow-${shadow})`,
                }}
              >
                <p className="font-semibold">Shadow {shadow}</p>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  --shadow-{shadow}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
