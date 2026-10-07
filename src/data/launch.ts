import coverReveal from "@/assets/launch-cover-reveal.mp4";
import coverFront from "@/assets/launch-cover-front.jpg";
import coverBack from "@/assets/launch-cover-back.webp";
import bookSnow from "@/assets/launch-book-snow.jpg";
import authorTable1 from "@/assets/launch-author-table-1.jpg";
import authorTable2 from "@/assets/launch-author-table-2.jpg";
import venue from "@/assets/launch-venue.jpg";
import group from "@/assets/launch-group.jpg";
import guests from "@/assets/launch-guests.jpg";
import speech from "@/assets/launch-speech.jpg";
import signingDesk from "@/assets/launch-signing-desk.jpg";
import trioTable from "@/assets/launch-trio-table.jpg";
import familyBanner from "@/assets/launch-family-banner.jpg";
import readersThree from "@/assets/launch-readers-three.jpg";
import familyFour from "@/assets/launch-family-four.jpg";
import windowDisplay from "@/assets/launch-window-display.jpg";
import windowClose from "@/assets/launch-window-close.jpg";
import groupWide from "@/assets/launch-group-wide.jpg";

export const LAUNCH = {
  author: "Sanman Thapa",
  book: "From the Window: The City of What Ifs",
  publisher: "Arti Facts Publishing",
  intro:
    "A live launch day for Sanman Thapa, built around signed copies, a full room and a cover reveal film. Photographs and video from the event.",
  video: {
    src: coverReveal,
    title: "Cover reveal film for From the Window: The City of What Ifs",
  },
};

export const LAUNCH_COVERS = [
  {
    src: coverFront,
    alt: "Front cover of From the Window: The City of What Ifs by Sanman Thapa",
    caption: "Front cover",
  },
  {
    src: coverBack,
    alt: "Back cover copy for From the Window: The City of What Ifs",
    caption: "Back cover",
  },
  {
    src: bookSnow,
    alt: "Printed copy of the book standing in snow",
    caption: "First printed copy",
  },
];

export const LAUNCH_GALLERY = [
  {
    src: group,
    alt: "Guests holding copies of the books beside the Arti Facts Publishing banner",
    caption: "The room at the signing",
    wide: true,
  },
  {
    src: speech,
    alt: "Sanman Thapa speaking into a microphone at the launch event",
    caption: "Opening remarks",
  },
  {
    src: authorTable1,
    alt: "Sanman Thapa at the signing table with stacked copies of both titles",
    caption: "Signing table",
  },
  {
    src: authorTable2,
    alt: "Sanman Thapa holding a copy of From the Window: The City of What Ifs",
    caption: "Holding the new title",
  },
  {
    src: guests,
    alt: "Two guests seated by the cafe window during the launch",
    caption: "Guests at the venue",
  },
  {
    src: venue,
    alt: "Meet the author signage outside the cafe hosting the launch",
    caption: "Street level signage",
  },
  {
    src: signingDesk,
    alt: "A reader photographing the display of copies at the signing desk",
    caption: "At the signing desk",
  },
  {
    src: trioTable,
    alt: "Three guests holding copies of both titles behind the launch table",
    caption: "Copies in hand",
  },
  {
    src: familyFour,
    alt: "Four guests holding the books beside the display table",
    caption: "Family and friends",
  },
  {
    src: readersThree,
    alt: "Three readers holding A Fight for a Cup of Chai and From the Window",
    caption: "Both titles on the table",
  },
  {
    src: familyBanner,
    alt: "The full group with books in front of the Arti Facts Publishing banner",
    caption: "The full group",
    wide: true,
  },
  {
    src: groupWide,
    alt: "Guests smiling with copies of the books at the launch venue",
    caption: "A room of readers",
    wide: true,
  },
  {
    src: windowDisplay,
    alt: "Cafe window display with book posters and the meet the author board",
    caption: "Window display",
  },
  {
    src: windowClose,
    alt: "Close view of the cafe window with signed copy signage",
    caption: "Signed copies inside",
  },
];
