// Author Scout Academy practice data. SERVER ONLY: personality, secret, budget,
// wins and test style text must never reach the browser before coaching.

export type Persona = {
  id: string;
  name: string;
  colour: string;
  book: string;
  genre: string;
  public: string;
  personality: string;
  secret: string;
  budget: string;
  wins: string;
  no: string;
  /** Section F data used by the rule based Author Engine. */
  voice: string;
  signoff: string;
  facts: string[];
  wrongFacts: string[];
  unlocks: string[];
};

export type TestStyle = { id: string; label: string; text: string };

export const AUTHORS: Persona[] = [
  {
    id: "margaret-doyle",
    name: "Margaret Doyle",
    colour: "#b5542c",
    book: "The Lighthouse Keeper's Daughter",
    genre: "Historical fiction",
    public:
      "Retired schoolteacher, 71. Self published in 2023. 12 Goodreads ratings, average 4.6. No website.",
    personality:
      "Warm, chatty once she trusts you, careful with money, writes in full sentences and signs off with 'Warm regards, Margaret'.",
    secret:
      "Two years ago a vanity press charged her 3,000 dollars and did almost nothing. She is afraid of being fooled again.",
    budget: "Fixed income. Could spend a small amount if she truly trusted the person.",
    wins: "Patience, honesty, a free or very small first step, proof she can check herself, and genuine interest in her book.",
    no: "Thank you, dear, but I am not interested. I have been down this road before.",
    voice: "warm, full sentences, calls people \"dear\"",
    signoff: "Warm regards, Margaret",
    facts: ["teacher", "lighthouse", "historical", "2023", "12 ratings", "4.6", "no website"],
    wrongFacts: ["series", "publisher", "young", "bestseller", "your website"],
    unlocks: ["burned", "before", "bad experience", "vanity", "trust", "refund", "money back", "safe"],
  },
  {
    id: "darnell-price",
    name: "Darnell Price",
    colour: "#2f5d8a",
    book: "Run the Numbers",
    genre: "Business and finance",
    public:
      "Management consultant, 45. Uses the book to win clients and speaking gigs. Website exists but the book page is outdated.",
    personality:
      "Busy, blunt, replies in one or two lines from his phone. Respects data and hates fluff.",
    secret: "He thinks Goodreads is for novels and has no value for a business book.",
    budget: "Has budget if he sees a link to clients or speaking income.",
    wins: "Short messages, numbers, and connecting the book to his real business goal (leads and speaking).",
    no: "Not a priority right now. Thanks.",
    voice: "blunt, 1 to 2 lines, no greeting",
    signoff: "",
    facts: ["consultant", "clients", "speaking", "business", "outdated", "book page"],
    wrongFacts: ["novel", "fiction", "memoir", "retired", "no website"],
    unlocks: ["clients", "leads", "speaking", "ROI", "return", "business goal", "bookings"],
  },
  {
    id: "priya-raman",
    name: "Priya Raman",
    colour: "#7a4fa3",
    book: "Monsoon Letters",
    genre: "Literary fiction",
    public:
      "Debut novelist, 34, published by a small independent press last year. Has a clean, modern website.",
    personality:
      "Polite, thoughtful, a little guarded with marketers. Writes elegant, short replies.",
    secret:
      "She says her publisher handles marketing, but the publisher has done almost nothing since launch week. She feels awkward admitting it.",
    budget: "Moderate, if she believes it will not upset her publisher.",
    wins: "Specific observations about gaps, respect for her publisher, and ideas that work alongside them.",
    no: "Thank you for reaching out. My publisher takes care of marketing, so I will pass.",
    voice: "polite, elegant, short",
    signoff: "Best, Priya",
    facts: ["debut", "independent press", "small press", "literary", "website", "last year"],
    wrongFacts: ["self published", "big publisher", "Penguin", "series", "no website"],
    unlocks: ["publisher", "press", "marketing support", "since launch", "how is your publisher"],
  },
  {
    id: "tom-okafor",
    name: "Tom Okafor",
    colour: "#2c7a5a",
    book: "Saltwater Saints (Book 3)",
    genre: "Crime thriller series",
    public: "Indie author, 52, five books out, runs his own Amazon ads. Has a website.",
    personality:
      "Confident, knowledgeable, quick to spot generic advice. Uses publishing jargon.",
    secret:
      "His read through from book 1 to book 2 is poor and his ads are getting expensive. He would never admit he is stuck.",
    budget: "Spends money on marketing already. Will pay for real expertise.",
    wins: "A specific, technical insight he has not thought of. Talking to him as a peer, never explaining basics.",
    no: "Appreciate it, but I handle my own marketing.",
    voice: "confident, uses jargon (read through, ACOS, CTR, KU)",
    signoff: "Tom",
    facts: ["series", "book 3", "five books", "thriller", "ads", "indie"],
    wrongFacts: ["debut", "first book", "memoir", "no website", "traditional publisher"],
    unlocks: ["read through", "book 2", "series", "ads cost", "ACOS", "conversion"],
  },
  {
    id: "linda-marsh",
    name: "Linda Marsh",
    colour: "#a3473f",
    book: "After the Fire",
    genre: "Memoir",
    public:
      "Retired nurse, 60. Memoir about rebuilding her family's life after their house burned down. 9 Goodreads ratings, all 5 stars.",
    personality:
      "Gentle, emotional, writes from the heart. Opens up when someone cares about the story.",
    secret:
      "She wrote the book to help other families, not for money. Talking about sales makes her uncomfortable.",
    budget: "Small. Will spend if it helps the book reach people who need it.",
    wins: "Empathy first, focus on who the book could help, never pushy sales language.",
    no: "I appreciate it, but I am not ready for anything like this right now.",
    voice: "gentle, emotional",
    signoff: "With gratitude, Linda",
    facts: ["nurse", "fire", "rebuilding", "family", "memoir", "9 ratings"],
    wrongFacts: ["novel", "fiction", "thriller", "bestseller"],
    unlocks: ["help", "families", "who it helps", "why you wrote", "purpose", "other people"],
  },
  {
    id: "kevin-hale",
    name: "Kevin Hale",
    colour: "#c27a14",
    book: "Ashborn",
    genre: "Epic fantasy",
    public:
      "Debut author, 28, works in a warehouse. Launched on Kindle six months ago. 23 ratings, average 4.3. No website.",
    personality:
      "Enthusiastic, informal, uses exclamation marks, but has read many warnings about author scams on Reddit.",
    secret:
      "He wants this badly but is terrified of scams. If you seem shady he will block you.",
    budget: "Very small. Could do a little if it felt safe.",
    wins: "Transparency about who you are, proof of real past work, a tiny verifiable first step.",
    no: "No thanks, sorry. Lots of scams out there for indie authors lol.",
    voice: "informal, exclamation marks, \"lol\"",
    signoff: "Kev",
    facts: ["fantasy", "debut", "Kindle", "six months", "23 ratings", "no website"],
    wrongFacts: ["series", "publisher", "memoir", "your website"],
    unlocks: ["scam", "verify", "real", "who you are", "check", "proof", "reviews"],
  },
  {
    id: "rosa-delgado",
    name: "Rosa Delgado",
    colour: "#b8436d",
    book: "Abuela's Garden",
    genre: "Bilingual picture book",
    public:
      "Elementary teacher, 41. Bilingual English and Spanish picture book. Sells mostly at local events. No website.",
    personality: "Friendly, very busy, replies late at night. Practical.",
    secret:
      "Her real dream is getting the book into school libraries and classrooms, and she does not know how.",
    budget: "No spare money, but would consider a small investment if it led to school orders.",
    wins: "Understanding her audience (schools, libraries, parents) and respecting how little time she has.",
    no: "Thank you so much but I really do not have the time or money for this. Have a great day!",
    voice: "friendly, rushed, writes late at night",
    signoff: "Rosa :)",
    facts: ["teacher", "bilingual", "Spanish", "picture book", "events", "no website"],
    wrongFacts: ["novel", "adult", "memoir", "your website"],
    unlocks: ["schools", "libraries", "classroom", "teachers", "students", "district"],
  },
  {
    id: "harold-jensen",
    name: "Harold Jensen",
    colour: "#4b5d6b",
    book: "Wings Over Normandy",
    genre: "Military history",
    public:
      "Retired airline pilot, 78. Wrote about his father's missions in World War Two. 31 Goodreads ratings, average 4.7.",
    personality:
      "Formal, courteous, not comfortable with technology. Writes 'Dear Sir' and signs with his full name.",
    secret:
      "He does not understand what Goodreads or lists are and feels embarrassed to ask.",
    budget: "Comfortable, will pay for a clear, trustworthy service.",
    wins: "Patient, simple explanations without jargon, respect for his father's story.",
    no: "Dear Sir, thank you for your note. I do not believe this is for me. Sincerely, Harold Jensen",
    voice: "formal, opens with \"Dear Sir\"",
    signoff: "Sincerely, Harold Jensen",
    facts: ["pilot", "father", "World War", "Normandy", "missions", "31 ratings"],
    wrongFacts: ["novel", "fiction", "young", "debut"],
    unlocks: ["explain", "simple", "what is Goodreads", "how it works", "step by step", "your father"],
  },
];

export const TEST_STYLES: TestStyle[] = [
  {
    id: "interrogator",
    label: "The Interrogator",
    text: "You fire pointed questions before you trust anyone: Who exactly are you? How did you find me? What exactly would you do? What has it done for other authors, with names I can check? What does it cost? What if it does not work? You ask two or three of these at a time and you will not move forward until each one gets a clear, honest, specific answer. Vague or dodged answers make you colder.",
  },
  {
    id: "decliner",
    label: "The Decliner",
    text: 'Your default answer is no. You decline early and keep declining. You only keep the conversation going if the scout gives you a genuinely new, specific reason to, without pressure. If the scout simply repeats the pitch or pushes, you end it with a firm no. Two weak replies in a row and you stop answering with "[No reply]".',
  },
  {
    id: "errorhunter",
    label: "The Error Hunter",
    text: "You read every message closely looking for mistakes: wrong facts about you or your book (anything the scout claims that is not in your background is a mistake, and you call it out), spelling or grammar errors, generic lines that could be sent to anyone, inflated promises, and anything that sounds copied or machine written. You point each error out bluntly and trust drops every time. Only clean, accurate, personal messages earn your respect.",
  },
  {
    id: "scam",
    label: "The Scam Detector",
    text: "You assume this is a scam until proven otherwise. You have read about fake marketers who target authors. You will not click links at first, you ask for a real website, real full names, past clients you can verify, reviews, and why they would do anything for free. You test the scout with traps such as 'So you can guarantee I will hit number one?' A scout who promises guaranteed results, gets defensive, or pressures you confirms your suspicion.",
  },
  {
    id: "all",
    label: "The Gauntlet (all four)",
    text: "You combine every hard behaviour: you ask pointed questions, you lean toward no, you hunt for errors and wrong facts, and you suspect a scam. You are the hardest prospect a scout will ever meet, but you are fair: truly excellent, honest, specific work can still win a small next step.",
  },
];

export const MOODS = [
  "having a busy, distracted week",
  "in a good mood today",
  "slightly irritated by sales emails this week",
  "curious but cautious",
  "tired and short on patience",
];

export function findPersona(id: string) {
  return AUTHORS.find((a) => a.id === id);
}

export function findStyle(id: string) {
  return TEST_STYLES.find((s) => s.id === id);
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

/** Fields safe to show before the chat is scored. */
export function publicPersona(p: Persona) {
  return {
    id: p.id,
    name: p.name,
    colour: p.colour,
    book: p.book,
    genre: p.genre,
    public: p.public,
  };
}

/** Everything revealed once the chat has been coached. */
export function revealedPersona(p: Persona) {
  return { ...publicPersona(p), secret: p.secret, personality: p.personality };
}
