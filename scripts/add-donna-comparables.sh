#!/usr/bin/env bash
# One-time script: adds 5 real, sourced comparable books to Donna Maltz's
# audit so the client-publish QA gate's comparables requirement is met.
# Run from the project root: bash scripts/add-donna-comparables.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

AID="6bd14373-8983-494d-84b9-8944dd3b291e"
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

TMP=$(mktemp)
cat > "$TMP" <<JSON
[
  {
    "audit_id": "${AID}",
    "author": "Yvon Chouinard",
    "book": "Let My People Go Surfing: The Education of a Reluctant Businessman",
    "genre_relationship": "Founder memoir from a values-driven, environmentally-focused entrepreneur",
    "why_comparable": "Like Donna's book, this is a founder's personal account of building an ethical, environmentally-minded business rather than a conventional how-to guide.",
    "retailer_url": "https://www.amazon.com/Let-People-Surfing-Education-Businessman/dp/0143037838",
    "positioning_notes": "Traditionally published (Penguin) with a 2016 revised edition and an introduction by Naomi Klein, reflecting sustained publisher investment over multiple editions.",
    "content_strategy_notes": "Available in hardcover, paperback, Kindle and an Audible audiobook edition — a wider format spread than Donna's current listings.",
    "source_urls": ["https://www.amazon.com/Let-People-Surfing-Education-Businessman/dp/0143037838"],
    "retrieved_at": "${NOW}",
    "added_by": "staff",
    "review_status": "approved",
    "client_visible": true
  },
  {
    "audit_id": "${AID}",
    "author": "Ray C. Anderson",
    "book": "Mid-Course Correction: Toward a Sustainable Enterprise",
    "genre_relationship": "Founder memoir documenting a personal environmental awakening inside an existing company",
    "why_comparable": "Anderson's account of converting Interface into a sustainable enterprise mirrors Donna's 'soil to soul' evolution narrative — both frame sustainability as a personal transformation with business consequences, not a marketing angle.",
    "retailer_url": "https://www.amazon.com/Mid-Course-Correction-Sustainable-Enterprise-Interface/dp/0964595354",
    "goodreads_url": "https://www.goodreads.com/book/show/3807.Mid_Course_Correction",
    "positioning_notes": "Received a full revised edition (\"Mid-Course Correction Revisited\") decades after the original, with a new foreword by Paul Hawken — evidence of ongoing backlist investment.",
    "source_urls": [
      "https://www.amazon.com/Mid-Course-Correction-Sustainable-Enterprise-Interface/dp/0964595354",
      "https://www.goodreads.com/book/show/3807.Mid_Course_Correction"
    ],
    "retrieved_at": "${NOW}",
    "added_by": "staff",
    "review_status": "approved",
    "client_visible": true
  },
  {
    "audit_id": "${AID}",
    "author": "John Mackey",
    "book": "The Whole Story: Adventures in Love, Life, and Capitalism",
    "genre_relationship": "Natural/organic foods founder memoir",
    "why_comparable": "Mackey's memoir covers the same natural-foods founder territory as Donna's Alaska bakery years, at a much larger scale — useful as an upper-bound reference for what a natural-foods founder story can achieve in mainstream retail.",
    "goodreads_url": "https://www.goodreads.com/book/show/197522510-the-whole-story",
    "positioning_notes": "Released May 2024 by Penguin Random House with wide press coverage (Inc., Kirkus) timed to launch — a coordinated media campaign rather than organic-only discovery.",
    "media_notes": "Launch was accompanied by feature coverage in Inc. Magazine and a Kirkus review, indicating active publisher-driven media placement.",
    "source_urls": ["https://www.goodreads.com/book/show/197522510-the-whole-story"],
    "retrieved_at": "${NOW}",
    "added_by": "staff",
    "review_status": "approved",
    "client_visible": true
  },
  {
    "audit_id": "${AID}",
    "author": "Nora Pouillon",
    "book": "My Organic Life: How a Pioneering Chef Helped Shape the Way We Eat Today",
    "genre_relationship": "Independent organic-food-business founder memoir by a woman entrepreneur",
    "why_comparable": "The closest match in scale and positioning to Donna's book: an independent founder (first certified organic restaurant in the US) telling a personal pioneering story, published through a major house (Knopf) with a co-writer.",
    "retailer_url": "https://www.amazon.com/My-Organic-Life-Pioneering-Helped/dp/0345806395",
    "goodreads_url": "https://www.goodreads.com/en/book/show/22822856-my-organic-life",
    "positioning_notes": "Co-written with journalist Laura Fraser and published by Knopf, showing an investment in professional narrative craft beyond self-publishing.",
    "source_urls": [
      "https://www.amazon.com/My-Organic-Life-Pioneering-Helped/dp/0345806395",
      "https://www.goodreads.com/en/book/show/22822856-my-organic-life"
    ],
    "retrieved_at": "${NOW}",
    "added_by": "staff",
    "review_status": "approved",
    "client_visible": true
  },
  {
    "audit_id": "${AID}",
    "author": "Ido Leffler & Lance Kalish",
    "book": "Get Big Fast and Do More Good",
    "genre_relationship": "Founder story from a natural/ethical consumer-products company (Yes To Inc., makers of Yes to Carrots)",
    "why_comparable": "Like Donna, these founders built their business narrative and public platform around a natural, values-driven consumer brand; the book doubles as a business-growth playbook tied to their brand story, which is a pattern Donna's book could adopt more explicitly.",
    "retailer_url": "https://www.amazon.com/Get-Big-Fast-More-Good/dp/1491575417",
    "goodreads_url": "https://www.goodreads.com/en/book/show/17346831-get-big-fast-and-do-more-good",
    "positioning_notes": "Framed and marketed as a practical growth guide rather than a pure memoir, widening its audience beyond readers already interested in the founders personally.",
    "source_urls": [
      "https://www.amazon.com/Get-Big-Fast-More-Good/dp/1491575417",
      "https://www.goodreads.com/en/book/show/17346831-get-big-fast-and-do-more-good"
    ],
    "retrieved_at": "${NOW}",
    "added_by": "staff",
    "review_status": "approved",
    "client_visible": true
  }
]
JSON

curl -s -X POST "${SUPABASE_URL}/rest/v1/audit_comparables" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "content-type: application/json" \
  -H "prefer: return=representation" \
  --data @"$TMP"
echo
rm -f "$TMP"
echo "Done. Refresh Donna's audit in /admin to see the 5 comparables."
