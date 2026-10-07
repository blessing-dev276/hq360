// Fallback roles reflect the published roster. Biographies require approved source material.
export type TeamMember = {
  name: string;
  role: string;
  /** key into TeamAvatar PHOTOS */
  photo: string;
  initials: string;
  /** One line on what they own — shown on About and the homepage team showcase. */
  blurb: string;
};

export const TEAM: TeamMember[] = [
  { name: "Blessing Daniel", role: "Founder & CEO", photo: "blessing", initials: "B", blurb: "" },
  {
    name: "Richard Promise",
    role: "Digital Marketing Specialist",
    photo: "richard",
    initials: "R",
    blurb: "",
  },
  {
    name: "Ebenezer Oluwajoba",
    role: "Brand & Creatives Lead",
    photo: "ebenezer",
    initials: "E",
    blurb: "",
  },
  {
    name: "Emmanuel Sunday",
    role: "Website Development Specialist",
    photo: "emmanuel",
    initials: "E",
    blurb: "",
  },
];
