"use client";

import Box from "@mui/material/Box";
import Image from "next/image";
import { keyframes } from "@mui/material";
import { mediaQueries } from "@/config/design-tokens";

// A slow, continuously-looping single-column marquee of the mentor/child
// illustrations, used behind the auth screens (login, forgot/set/reset
// password) to give the shared brand panel a warmer, "alive" feel instead of
// a flat gradient. The 5-image list is rendered twice back-to-back so a
// translateY(0 -> -50%) loop has no visible seam — standard CSS marquee
// technique.

interface MarqueeImage {
  src: string;
  alt: string;
}

const IMAGES: MarqueeImage[] = [
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

const scrollUp = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(-50%); }
`;

function MarqueeCard({ src, alt }: MarqueeImage) {
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.96)",
        borderRadius: 3,
        p: 2,
        mb: 2.5,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: 168 }}>
        <Image src={src} alt={alt} fill style={{ objectFit: "contain" }} sizes="280px" />
      </Box>
    </Box>
  );
}

export function BrandPanelMarquee() {
  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
      }}
    >
      <Box
        sx={{
          animation: `${scrollUp} 40s linear infinite`,
          [mediaQueries.reducedMotion]: { animation: "none" },
        }}
      >
        {[...IMAGES, ...IMAGES].map((img, i) => (
          <MarqueeCard key={i} src={img.src} alt={img.alt} />
        ))}
      </Box>
    </Box>
  );
}

export default BrandPanelMarquee;
