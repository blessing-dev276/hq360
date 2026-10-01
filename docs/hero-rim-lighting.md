# Hero rim-lighting update

All five hero portraits use a warm orange-red studio rim light on the viewer’s right: hair, temple, cheek edge, jaw and shoulder. Front fill keeps the face readable. The existing transparent cutouts and originals remain available; the homepage uses sibling assets `src/assets/team-hero-{1..5}-rim.webp`.

Mode: built-in imagegen, individual lighting edits of `src/assets/team-hero-{1..5}-cutout.webp`. PNG outputs retain actual alpha; WebP encodings use quality 0.9 without resizing. Existing hero masks and animation remain unchanged.

Exact shared prompt:

> Use case: lighting-weather. Edit target: the supplied transparent portrait for the HQ360 orange studio-style website hero. Change only lighting: add dramatic photographic orange-red rim lighting from behind on the viewer's right, sculpting the side of the face, cheek edge, ear and jawline, with a restrained warm highlight on the hair and shoulder edge. Strong, clear cinematic rim, like a warm gelled studio strip light, with soft neutral front fill so the face remains clear and natural. Preserve exact identity, expression, facial geometry, skin texture, glasses, hair, clothing, pose, hands, crop and framing. Keep the central face's natural skin tone; no overall orange tint, no crushed shadows, no neon outline or drawn stroke. Actual transparent alpha background, no backdrop, no glow painted into empty space, no text. Return one portrait.

Validation: build, TypeScript and changed-file ESLint passed. All five WebP images loaded with transparent alpha; desktop (1440 px) and mobile (390 px) screenshots were inspected with no horizontal overflow. Combined asset size is approximately 1.55 MB. No deployment performed.
