import video1 from "@/assets/testimonial-video-1-full.mp4";
import video2 from "@/assets/testimonial-video-2.mp4";
import reviewSanman from "@/assets/review-sanman.png";

import reviewBrandon from "@/assets/review-brandon.png";
import reviewHmarkos from "@/assets/review-hmarkos.png";
import reviewDashboard from "@/assets/review-dashboard.png";

export const VIDEO_TESTIMONIALS = [
  {
    id: "v1",
    label: "Client testimonial",
    title: "A client walks through the launch",
    src: video1,
  },
  {
    id: "v2",
    label: "Proof of work",
    title: "Inside a live campaign",
    src: video2,
  },
];

export const REVIEW_SHOTS = [
  {
    src: reviewSanman,
    alt: "Five star review from sanman_thapa praising CRM workflow, email sequences and a lift in visibility and sales",
    caption: "sanman_thapa, five star review",
  },
  {
    src: reviewBrandon,
    alt: "Five star review from Brandon reporting a Best Seller list placement and twenty copies a day",
    caption: "Brandon, five star review",
  },
  {
    src: reviewHmarkos,
    alt: "Five star review from hmarkos noting significant movement in Listopia lists",
    caption: "hmarkos, five star review",
  },
  {
    src: reviewDashboard,
    alt: "Sales dashboard showing estimated royalties of 2477 dollars and 825 processed orders in one month",
    caption: "Client dashboard, one month of sales",
  },
];
