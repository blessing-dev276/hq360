import { createFileRoute } from "@tanstack/react-router";
import { TestimonialsPage } from "@/components/site/TestimonialsPage";
import { buildSeo, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/testimonials")({
  head: () =>
    buildSeo(
      {
        title: "Testimonials & Reviews | HQ360",
        description:
          "Client testimonials, video and screenshots — real feedback from businesses HQ360 has worked with.",
        path: "/testimonials",
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Testimonials & Reviews", path: "/testimonials" },
      ]),
    ),
  component: TestimonialsPage,
});
