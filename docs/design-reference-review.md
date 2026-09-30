# Reference design review

The selected references use oversized typography, warm studio lighting, rounded dark panels, generous spacing and one accented pricing card. The subject's original colours and details remain visible; dark shading is strongest near the lower edge. The current HQ360 structure uses those same visual elements.

Corrections:

- Removed luminosity blending from hero, page and team portraits. This was recolouring the entire image orange.
- Removed the 30% contrast boost and brightness reduction. Existing source portraits already have studio lighting.
- Reduced grain opacity from 16% to 3.5%.
- Delayed and softened lower-edge shading so faces remain clear, while preserving the transition into the dark page.
- Reduced the oversized heading shadow that produced visible rectangular shadow bands at the clipped text lines.
- Kept actual image assets and configured pricing intact.
- Project gallery now displays each source project once instead of repeating projects to fill twelve slots. Small collections do not auto-drift.
- Hero pointer parallax respects reduced-motion preferences.

Reviewed desktop homepage and mobile homepage/About screenshots. Portrait colours are preserved and mobile layouts have no horizontal overflow. Production build, TypeScript and focused lint passed. Production has not been deployed as part of this review.
