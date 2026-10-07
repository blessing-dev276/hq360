import { createFileRoute } from "@tanstack/react-router";
import { AcademyApp } from "@/components/academy/AcademyApp";
import academyCss from "@/components/academy/academy.css?url";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: "Author Scout Academy | HQ360" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "stylesheet", href: academyCss }],
  }),
  component: AcademyApp,
});
