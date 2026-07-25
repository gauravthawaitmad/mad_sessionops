"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Image from "next/image";
import { mediaQueries } from "@/config/design-tokens";

// A fixed-size crossfade slideshow — one mentor/child illustration at a
// time, swapped on a timer with an opacity fade. Deliberately NOT a
// scrolling/growing list: the frame has a hard height so the brand panel
// can never push the page taller than the viewport.

interface SlideImage {
  src: string;
  alt: string;
}

const IMAGES: SlideImage[] = [
  { src: "/images/landing_page_image/image_1.png", alt: "A mentor standing beside a child" },
  {
    src: "/images/landing_page_image/image_2.png",
    alt: "A mentor showing children a book, one child waving",
  },
  {
    src: "/images/landing_page_image/image_3.png",
    alt: "Three people sitting together at a table, talking",
  },
  {
    src: "/images/landing_page_image/image_4.png",
    alt: "Two people sitting and talking with each other",
  },
  {
    src: "/images/landing_page_image/image_5.png",
    alt: "Three children holding hands together",
  },
];

const INTERVAL_MS = 4000;

export function BrandPanelSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: 260,
        flexShrink: 0,
        bgcolor: "rgba(255,255,255,0.96)",
        borderRadius: 3,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {IMAGES.map((img, i) => (
        <Box
          key={img.src}
          sx={{
            position: "absolute",
            inset: 0,
            p: 2.5,
            opacity: i === index ? 1 : 0,
            transition: "opacity 0.9s ease",
            [mediaQueries.reducedMotion]: { transition: "none" },
          }}
        >
          <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
            <Image
              src={img.src}
              alt={img.alt}
              fill
              style={{ objectFit: "contain" }}
              sizes="320px"
              priority={i === 0}
            />
          </Box>
        </Box>
      ))}

      {/* Progress dots */}
      <Box
        sx={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 0.75,
        }}
      >
        {IMAGES.map((_, i) => (
          <Box
            key={i}
            sx={{
              width: i === index ? 14 : 6,
              height: 6,
              borderRadius: 3,
              bgcolor: i === index ? "#C62828" : "rgba(0,0,0,0.15)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default BrandPanelSlideshow;
