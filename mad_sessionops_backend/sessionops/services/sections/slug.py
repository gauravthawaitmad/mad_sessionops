"""
Slug normalization for buckets (F-M6-2). A bucket's section_name is a
normalized slug derived from the CO's free-text display name; the display
name itself is stored separately in section_display_name.
"""

import re

from sessionops.exceptions import ValidationError

_SLUG_MAX_LENGTH = 100  # matches class_section.section_name width (widened in F-M6-1)


def normalize_section_slug(display_name: str) -> str:
    s = display_name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = s.strip("_")
    if not s:
        raise ValidationError("Bucket name must contain at least one letter or digit.")
    if len(s) > _SLUG_MAX_LENGTH:
        raise ValidationError("Bucket name is too long.")
    return s


def next_default_display_name(school_id: int) -> str:
    from sessionops.models import ClassSection

    n = ClassSection.objects.filter(school_id=school_id, is_active=True, removed=False).count()
    return f"Group {n + 1}"
