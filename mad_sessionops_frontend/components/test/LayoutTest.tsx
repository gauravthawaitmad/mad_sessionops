"use client";

import { Box, Container, Typography, Link, Stack, Divider, Grid, IconButton } from "@mui/material";
import { GitHub, Twitter, LinkedIn, Facebook } from "@mui/icons-material";

/**
 * Footer Component
 * Bottom section with links and copyright
 */

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface SocialLink {
  platform: "github" | "twitter" | "linkedin" | "facebook";
  url: string;
}

export interface FooterProps {
  sections?: FooterSection[];
  socialLinks?: SocialLink[];
  copyright?: string;
  showDivider?: boolean;
}

const defaultSections: FooterSection[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
];

const defaultSocialLinks: SocialLink[] = [
  { platform: "github", url: "https://github.com" },
  { platform: "twitter", url: "https://twitter.com" },
  { platform: "linkedin", url: "https://linkedin.com" },
];

const socialIcons = {
  github: GitHub,
  twitter: Twitter,
  linkedin: LinkedIn,
  facebook: Facebook,
};

export function Footer({
  sections = defaultSections,
  socialLinks = defaultSocialLinks,
  copyright = `© ${new Date().getFullYear()} MAD Platform. All rights reserved.`,
  showDivider = true,
}: FooterProps) {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "background.paper",
        borderTop: showDivider ? 1 : 0,
        borderColor: "divider",
        py: 6,
        mt: "auto",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              MAD Platform
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Building the future of web applications with modern tools and best practices.
            </Typography>
            <Stack direction="row" spacing={1}>
              {socialLinks.map((social) => {
                const Icon = socialIcons[social.platform];
                return (
                  <IconButton
                    key={social.platform}
                    component="a"
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{
                      color: "text.secondary",
                      "&:hover": {
                        color: "primary.main",
                      },
                    }}
                  >
                    <Icon fontSize="small" />
                  </IconButton>
                );
              })}
            </Stack>
          </Grid>

          {sections.map((section) => (
            <Grid item xs={6} sm={4} md={2} key={section.title}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {section.title}
              </Typography>
              <Stack spacing={1}>
                {section.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    underline="hover"
                    color="text.secondary"
                    sx={{
                      fontSize: 14,
                      "&:hover": {
                        color: "primary.main",
                      },
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ mb: 3 }} />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {copyright}
          </Typography>
          <Stack direction="row" spacing={3}>
            <Link href="/privacy" variant="body2" color="text.secondary" underline="hover">
              Privacy Policy
            </Link>
            <Link href="/terms" variant="body2" color="text.secondary" underline="hover">
              Terms of Service
            </Link>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

export default Footer;
