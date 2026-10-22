-- The daily lessons from the Author Scout Playbook (chapter 26), moved into
-- content records so trainers can add the next one from the dashboard.
-- published_at is the lesson date, so the 7 day New badge stays accurate.
INSERT INTO public.academy_content
  (kind, playbook, slug, group_name, title, summary, body, published, published_at, lesson_date, updated_by)
VALUES
('daily_lesson', 'author', 'lesson-2026-10-20-price-two-questions', 'Business: price talk',
 'Answer the price question with two questions first',
 'Ask what they need and what happens today, then give an honest price.',
 $md$Sooner or later a roofer or a cleaner will ask you: how much does it cost? Many new scouts panic. Some hide the price and sound like they have a secret. Others say a big number right away, before the owner knows what they would get. Both ways lose trust.

Brian Tracy teaches that price only makes sense next to value. A number on its own feels too high. So do not dodge the question, but ask two short questions first. One about what they need, such as: do you want online booking, missed call text back, or a new website? And one about what happens now, such as: what do you do today when you miss a call on a job? Then give an honest price or a clear range for what they told you they want.

Keep it fair. Tell the price plainly when they ask, never say the price goes up tomorrow if it does not, and never promise more jobs or more leads for the money. If they say it is too much, thank them and offer the smallest useful option. If they say no a second time, stop.

Today, write down your two price questions for one trade you scout, such as plumbers or painters. Practice saying them out loud three times, so you are calm the next time someone asks how much.

> copy: Good question, and I will give you a clear price. So I quote the right thing, can I ask two quick questions first: which do you need most, online booking or a missed call text back, and what happens today when you miss a call on a job?

_Idea from Brian Tracy, The Psychology of Selling (build value before you talk price)_$md$,
 true, '2026-10-20T07:00:00Z', '2026-10-20', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-19-lists-that-fit', 'Authors: genres or trades',
 'Find the lists that fit the book',
 'Name two or three real Listopia lists that truly match the book.',
 $md$Many scouts tell every author the same thing: we can help your book on Goodreads lists. A cozy mystery writer and a dark fantasy writer get the same email. Each author can tell it was not written for them.

On Goodreads, Listopia lists are made by members and the books are voted on by readers. Lists are about very exact things, such as cozy mysteries with cats, fantasy with found family, or romance set in small towns. Jeffrey Gitomer teaches that people want to buy from someone who took the time to understand them. Showing an author two or three real lists that truly match their book proves you looked at their work and their readers.

Be honest about what lists can do. Real readers decide the votes, so never promise a rank, a number of readers or more sales. Only name lists where the book clearly belongs, and never suggest fake votes or swapping votes.

Today, pick three authors from your prospect list. For each book, search Listopia and write down two lists that truly fit its genre and theme. Then send each author a short note that names those lists.

> copy: Hi Daniel, I read about The Lantern Road and I think it fits well on two Goodreads lists I found: Fantasy with Found Family and Quiet Fantasy Adventures. Readers who vote on those lists seem to enjoy books like yours. Would you like me to share a few more lists that match your story?

_Idea from Goodreads Listopia (member made, reader voted lists) and Jeffrey Gitomer, The Little Red Book of Selling_$md$,
 true, '2026-10-19T07:00:00Z', '2026-10-19', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-18-one-small-next-step', 'Business: closing',
 'Ask for one small next step',
 'End every good conversation with one clear, small invitation.',
 $md$Many scouts have a good talk with a roofer or a cleaner and then end it with "let me know if you are interested." The owner is busy, so nothing happens. A good close is not pressure. It is a clear, small invitation that is easy to say yes to.

Brian Tracy calls this the invitation close. You do not ask the owner to buy everything today. You offer one simple next step, such as seeing a demo made for their business, or a short call on a day they choose. Always say clearly that the demo is a sample, and do not talk about price until they say they want to go ahead.

If they say no, that is fine. Thank them, follow up once later with something new and useful, and stop after a second clear no. If they ask you to remove them, stop at once.

Today: look at your last three good conversations with service businesses that ended without a next step. Send each one a short message that offers one small, specific next step and asks a simple yes or no question.

> copy: Would it help if I made you a short sample of how online booking could look on your website, clearly marked as a demo, so you can decide if it is worth a closer look?

_Idea from Brian Tracy, The Psychology of Selling (the invitation close)_$md$,
 true, '2026-10-18T07:00:00Z', '2026-10-18', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-17-one-free-tip', 'Authors: first message',
 'Give one free tip first',
 'Share one small, honest tip about their own book page before asking for anything.',
 $md$Most first emails to authors are about the scout. They say who we are, what we sell and why the author should reply. The author reads it as one more ad and moves on.

Bob Burg, in The Go-Giver, teaches that your real worth is in how much more value you give than you take. In a first message, that means giving the author something useful before you ask for anything. Look at their book page on Goodreads or Amazon and find one small, honest thing that could help. Maybe the description starts slowly, maybe the first line does not say what the book is about, or maybe the author photo is missing.

Share that one tip kindly and simply, as a gift with no strings. Do not list ten problems, do not make it sound urgent, and do not mention any price. Then ask one soft question, such as whether they would like a few more ideas. If they say no, thank them and leave the door open.

Today, write three first messages to authors. Each one must hold one real, specific tip about that author's own book page, and nothing about price.

> copy: Hi Maria, I read the page for The Salt Garden and I think the first line of your description could do more work. Right now it starts with the setting, but your hook about the missing sister is much stronger. You could try moving that line to the top. Would you like two or three more small ideas like this?

_Idea from Bob Burg and John David Mann, The Go-Giver (the Law of Value)_$md$,
 true, '2026-10-17T07:00:00Z', '2026-10-17', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-16-what-else-besides-money', 'Business: no money',
 'Ask what else, besides money',
 'Agree that money matters, then isolate the real objection.',
 $md$When a plumber or roofer says "I cannot afford it right now", many scouts either give up or rush to offer a discount. Both are mistakes. Often money is real, but often it is only the easiest thing to say. The owner may also be worried that the tool will be hard to use, or that they will be stuck in a contract.

Dan Lok teaches a simple step here. First agree that money matters. Then ask one calm question: apart from the cost, is there anything else that makes this feel wrong? If the answer is "no, it is only money", you now know the real issue and can talk about a smaller first step, such as setting up their Google Business Profile before anything else. If the answer is something else, you have found the true worry and can answer it honestly.

Do not argue, do not cut your price on the spot, and never say the work will bring them jobs. If they say no a second time, thank them and stop. A kind exit today keeps the door open for later.

Today: write this question on a card next to your phone, and use it the next time an owner says money is the problem.

> copy: I understand, money matters, especially for a small business. Can I ask, apart from the cost, is there anything else that makes this feel wrong for you right now?

_Idea from Dan Lok, isolating the objection_$md$,
 true, '2026-10-16T07:00:00Z', '2026-10-16', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-15-invite-them-to-check', 'Authors: trust and scams',
 'Invite them to check you',
 'Welcome the scam worry and make your note easy to verify.',
 $md$Many authors get emails every week from strangers who say they loved the book and then ask for money. Writer Beware, a well known watchdog for writers, warns that many of these emails are scams. They praise the book in vague words that could fit any book, and they push the author to pay fast. So when your email arrives, the author is already on guard. That is not personal. It is smart.

Do not fight this worry. Welcome it. Make your note easy to check. Use your real name. Mention one true and specific detail about their book, such as a character name or the list it sits on, so they can see you really looked. Point them to hq360.space so they can see who we are. Do not ask for money or name a price in the first message, and never say they must decide today.

Robert Cialdini teaches that people trust what they can verify. When you invite an author to check you, you show you have nothing to hide, and that alone sets you apart from the scammers.

Today, open your last three author emails. Take out any praise that could fit any book, add one real detail from each book, and add one line that invites the author to look us up first.

> copy: Before you reply, please feel free to look us up at hq360.space and ask me anything. I would rather you feel sure than feel rushed.

_Idea from Writer Beware (SFWA) warnings on book marketing scams; Robert Cialdini on trust and authority_$md$,
 true, '2026-10-15T07:00:00Z', '2026-10-15', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-14-van-is-parked', 'Business: timing',
 'Call when the van is parked',
 'Call trades early or late, and keep every callback time you promise.',
 $md$Most trade business owners are on a roof, under a sink or in a garden for most of the day. If you call at 11 in the morning, you reach a busy person with dirty hands, or you reach voicemail. A good message at a bad time feels like a bother.

Think about their day, not yours. Many owners answer the phone early, before the first job, or late in the afternoon when they drive home and plan tomorrow. Rainy days are often quiet for roofers, painters and landscapers, because the weather stops the work. Those are calm moments when they have time to listen.

If someone picks up and says they are on a job, do not push. Thank them, ask what time is better, and call back at exactly that time. Keeping a small promise like this shows you are reliable before you ever talk about your service. Dale Carnegie taught that people listen when you see things from their side, and respecting their time is the first way to show it.

Today, pick five service businesses on your list and plan your calls for an early or late window instead of the middle of the day. Write down any callback time a prospect gives you, and keep it.

> copy: Hello, this is [Your Name]. I can hear you are busy on a job, so I will not keep you. What time would be better for a two minute call? I will ring you back then.

_Idea from Dale Carnegie, How to Win Friends and Influence People; common field sales practice of calling trades outside working hours_$md$,
 true, '2026-10-14T07:00:00Z', '2026-10-14', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-13-ask-happy-authors', 'Authors: referrals',
 'Ask happy authors who they know',
 'Ask about a small, clear group, and make no an easy answer.',
 $md$Authors know other authors. They meet in writing groups, on Facebook pages for their genre, at book fairs and in reader clubs. When one author is pleased with your help, the easiest next author to reach is often a friend of theirs.

Bill Cates, who wrote a well known book on referrals, teaches that you should not ask "Do you know anyone?" That question is too wide, and most people answer "Not right now." Instead, ask about a small, clear group. For example, ask about other writers in their genre or in their writing group. Make it easy to say a name, and make it easy to say no.

Ask only after you have truly helped, and never push. If the author says no, thank them warmly and do not ask again. If they give you a name, ask if they would be happy to introduce you, or if you may say they suggested you. Never contact a friend and pretend the author sent you if they did not.

Today, pick one author who thanked you or was pleased with your help this month. Send them one short message asking about a small group of writers they know.

> copy: Thank you again for working with us on your book. Are there one or two writers in your romance group who might like the same kind of help? If not, that is completely fine.

_Idea from Bill Cates, Get More Referrals Now_$md$,
 true, '2026-10-13T07:00:00Z', '2026-10-13', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-13-read-the-replies', 'Business: research',
 'Read the replies, not just the stars',
 'A profile full of kind reviews with no owner replies is a real, small gap.',
 $md$Before you write to a roofer, cleaner or plumber, open their Google Business Profile and scroll through their reviews. Do not only look at the star rating. Look for the small replies from the owner under each review. Many busy owners have good reviews but have not answered any of them, or stopped answering months ago.

Google itself says that when a business replies to reviews, it shows customers that the business values their feedback and is responsive. So a profile full of kind reviews with no replies is a real, small gap you can point to. You are not guessing and you are not judging. You are telling the owner something true about their own page.

Keep it kind and simple. Name one real review you saw, say that it has no reply yet, and offer to help them keep up with replies or set up review requests. Never say this will bring more jobs or a higher ranking. Just say it helps customers see that someone is listening.

Today, open the Google profiles of five local businesses on your list. Write down how many of their last ten reviews have an owner reply, and use that fact in the first line of your message to the ones with few or none.

> copy: Hello [Name], I was reading your Google reviews today and saw the kind words from [Reviewer] about your work on their kitchen. I noticed it does not have a reply yet. Would you like a simple way to keep up with replies so your customers can see you are listening?

_Idea from Google Business Profile Help (Manage customer reviews) and Dale Carnegie_$md$,
 true, '2026-10-13T06:00:00Z', '2026-10-13', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-12-name-the-worry', 'Objections',
 'Name the worry out loud',
 'Label the feeling behind the objection, then stop and wait.',
 $md$When an author pushes back, many scouts rush to argue. They list features, send more links, or write longer emails. The author feels pushed and goes quiet.

Chris Voss, a former FBI hostage negotiator, teaches a better way called labeling. You say out loud the feeling you hear behind the words. Start with "It sounds like" or "It seems like", name the feeling, and then stop and wait. When people feel understood, they relax and tell you what really worries them.

So if an author writes "I have been burned by book promoters before", do not defend HQ360 at once. Name the feeling first and let them answer. Only then explain, in simple and true words, how we work with real readers. If they still say no after that, thank them and stop. That is the two no rule.

Today, find the last three objections you got from authors. For each one, write one label that starts with "It sounds like" and send it as your reply.

> copy: It sounds like you have been let down by promoters before, and you do not want to spend money on something that is not real again. Is that fair to say?

_Idea from Chris Voss, Never Split the Difference (labeling)_$md$,
 true, '2026-10-12T07:00:00Z', '2026-10-12', 'Emmanuel Sunday'),

('daily_lesson', 'author', 'lesson-2026-10-10-check-the-badge', 'Research',
 'Check the badge before you write',
 'A missing Goodreads Author badge gives you a true and useful first line.',
 $md$Before you write to an author, open their Goodreads author page and look near their name for the words Goodreads Author. Goodreads says that if this badge is missing, the author has not joined the Author Program yet. That means they cannot add their own bio or photo, cannot answer readers through Ask the Author, and readers cannot follow them to hear about new books.

This small check gives you a true and useful first line. You are not guessing. You are telling the author something real about their own page that they may not know. Dale Carnegie taught that people listen when you talk about what they care about, and every author cares about their own page.

Be kind and exact. Say what you saw, why it matters to readers, and offer to show them how to fix it. Do not say it will bring sales or rankings. It simply makes their page complete and lets readers follow them.

Today, open the Goodreads pages of five authors on your lead list. Write down which ones have no Goodreads Author badge, and use that fact as the first line of your message to them.

> copy: Hello [Name], I was looking at your book on Goodreads today and I noticed your author page does not yet show the Goodreads Author badge. That means readers cannot follow you or ask you questions there yet. Would you like me to send you the simple steps to claim it?

_Idea from Goodreads Author Program guidance and Dale Carnegie_$md$,
 true, '2026-10-10T07:00:00Z', '2026-10-10', 'Emmanuel Sunday')
ON CONFLICT (slug) DO NOTHING;
