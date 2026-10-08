// Nudges an admin can send an expert: a bell notification + email each.
// The tone is cheeky, never abusive: these are partners, teammates, friends
// and family. The goal is a laugh, then action.

export type Nudge = {
  key: string;
  label: string;
  /** Expert workspace tab the notification opens. */
  tab: string;
  title: string;
  /** Variants; one is picked at random so repeat nudges don't read the same. */
  lines: string[];
};

/** Closing line added to every nudge. */
export const NUDGE_SIGNOFF =
  "Not feeling the expert life anymore? No hard feelings. Message the admin and we'll part as friends (and still share jollof).";

export const NUDGES: Nudge[] = [
  {
    key: "complete_profile",
    label: "Complete your profile",
    tab: "profile",
    title: "Your profile is giving 'under construction'",
    lines: [
      "Your expert profile is still half-built, and clients can tell. An unfinished profile makes HQ360 look like we hired you this morning. Five minutes, and you're a legend again.",
      "We showed a client the experts page and they asked if your profile was a placeholder. We laughed nervously. Please finish it so we can stop laughing nervously.",
      "Your profile currently has the energy of a 'coming soon' sign from 2019. Fill it in and let the world see the genius we keep bragging about.",
    ],
  },
  {
    key: "submit_profile",
    label: "Submit profile for review",
    tab: "profile",
    title: "Your profile is ready… and just sitting there",
    lines: [
      "Your profile is basically done but you haven't sent it for review. It's like cooking a full meal and not serving it. Hit 'Send for review' and let's publish you.",
      "We can't publish what you haven't submitted. Your profile is in the drafts folder of life. Free it.",
    ],
  },
  {
    key: "profile_photo",
    label: "Add a profile photo",
    tab: "profile",
    title: "Clients can't see your face",
    lines: [
      "Your profile has no photo, so clients are imagining what you look like. Some of them imagined a lizard. Upload a proper photo and save us all.",
      "A profile without a photo looks like a witness protection programme. Upload a clean, smiling photo so you look like the expert you are.",
    ],
  },
  {
    key: "intro_bio",
    label: "Write your intro & bio",
    tab: "profile",
    title: "Your bio is shorter than a text message",
    lines: [
      "Your intro and bio are doing the absolute minimum. Clients want to know why you're brilliant, and right now even we're guessing. Tell your story.",
      "Your bio currently says less than a fortune cookie. Give clients a few lines on who you help and how. You've got this.",
    ],
  },
  {
    key: "portfolio",
    label: "Add portfolio items",
    tab: "portfolio",
    title: "Your portfolio is emptier than a Monday inbox",
    lines: [
      "Your portfolio is empty, which makes our brand look like a garage sale with no garage. Add your best work so clients can see what you can do.",
      "An expert with no portfolio is like a chef with no menu. Add two or three pieces of your best work and watch the trust roll in.",
      "Clients keep asking for examples of your work and we keep changing the subject. Please add portfolio items so we can stop changing the subject.",
    ],
  },
  {
    key: "testimonial",
    label: "Add a video testimonial",
    tab: "portfolio",
    title: "Your clients love you. Prove it.",
    lines: [
      "You've done great work, but there's no video testimonial to show for it. Ask a happy client for a 30-second clip. Social proof is free marketing.",
      "No testimonials yet, so right now your fan club is just us. Grab a short video from a happy client and add it to your portfolio page.",
    ],
  },
  {
    key: "client_reviews",
    label: "Add client reviews",
    tab: "portfolio",
    title: "Screenshot those compliments",
    lines: [
      "Clients have said nice things about you and you're keeping it a secret. Add review screenshots so the next client believes the hype.",
      "Your reviews section is quieter than a library. Add a few client review screenshots and let your work speak.",
    ],
  },
  {
    key: "platform_links",
    label: "Add Fiverr / Upwork / LinkedIn links",
    tab: "profile",
    title: "Where else can clients find you?",
    lines: [
      "Your Fiverr, Upwork or LinkedIn links are missing, so clients can't check your track record. Add them; it makes you (and us) look established.",
      "You have a professional life outside HQ360 and your profile is hiding it. Link your LinkedIn, Fiverr or Upwork so clients can see it.",
    ],
  },
  {
    key: "perplexity_key",
    label: "Add your Perplexity API key",
    tab: "scout",
    title: "Your email search is running on vibes",
    lines: [
      "You haven't added your Perplexity API key, so finding author emails is basically guesswork. Add it under Scouting → Email search settings and let the robots work.",
      "No Perplexity key means no author email search, which means a very quiet outreach day. Add your key and unlock the good stuff.",
    ],
  },
  {
    key: "academy_trainer",
    label: "Set up your Academy trainer profile",
    tab: "academy",
    title: "Your trainees are waiting, Coach",
    lines: [
      "You're an Academy trainer, but your trainer profile isn't set up. Trainees are looking at an empty chair. Add a photo and headline to your profile and check your Trainer tools.",
      "Trainees signed up to learn from the best, and the best hasn't finished their trainer setup. Pop into Academy trainer and get it ready.",
    ],
  },
  {
    key: "scout_target",
    label: "Hit the 50-authors-a-day scouting target",
    tab: "scout",
    title: "50 authors a day won't scout themselves",
    lines: [
      "The scouting target is 50 authors a day and your numbers are giving 'weekend mode'. Open Scouting, run a batch, and let's fill that pipeline.",
      "Authors are out there writing great books and nobody's finding them. That's literally your job. 50 a day, champ. Go.",
    ],
  },
  {
    key: "follow_up_leads",
    label: "Follow up on your leads",
    tab: "leads",
    title: "Your leads are getting cold",
    lines: [
      "Some of your leads haven't heard from you in a while. Remember: follow up every day until they reply. Your leads are not going to chase themselves.",
      "Your pipeline is full of authors waiting for your follow-up. Leaving them on read makes us look flaky. Send those follow-ups today.",
    ],
  },
  {
    key: "finish_audits",
    label: "Finish your audits",
    tab: "audit",
    title: "That audit isn't going to publish itself",
    lines: [
      "You have an audit sitting unfinished. The author is refreshing their inbox. Run the research, publish the site, and make them feel like royalty.",
      "An unfinished audit is like a cliffhanger with no next season. Wrap it up and send the author their report.",
    ],
  },
  {
    key: "check_notifications",
    label: "Check your notifications",
    tab: "dashboard",
    title: "Your bell has been ringing",
    lines: [
      "You have unread updates piling up in your workspace. The bell has been ringing so long it's starting a band. Have a quick look.",
    ],
  },
];

export const NUDGE_KEYS = NUDGES.map((n) => n.key);

export function nudgeBody(n: Nudge, note: string) {
  const line = n.lines[Math.floor(Math.random() * n.lines.length)]!;
  return [line, note.trim() ? `From the admin: ${note.trim()}` : "", NUDGE_SIGNOFF]
    .filter(Boolean)
    .join("\n\n");
}
