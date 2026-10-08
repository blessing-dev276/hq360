-- Practice room difficulty: Easy, Medium, Hard, Extreme. Harder authors start
-- colder, punish mistakes more, and may ignore several follow-ups before replying.
ALTER TABLE public.sessions
  ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  -- Follow-ups this author will ignore before their first reply.
  ADD COLUMN silent_left INTEGER NOT NULL DEFAULT 0;

-- Lines for the two new author reactions, in any author's voice.
INSERT INTO public.response_bank (id, author, reaction, text) VALUES
('any-trust_issue-1', 'ANY', 'trust_issue', 'I have been burned before by someone who said all the right things. Why should I believe you are any different?'),
('any-trust_issue-2', 'ANY', 'trust_issue', 'Honestly, the last person who offered to help my book took my money and disappeared. I am not keen to repeat that.'),
('any-trust_issue-3', 'ANY', 'trust_issue', 'I do not really trust people who message me out of the blue about my book. No offence.'),
('any-trust_issue-4', 'ANY', 'trust_issue', 'Everyone says they want to help authors. Very few actually do. What makes you different?'),
('any-trust_issue-5', 'ANY', 'trust_issue', 'I paid for a marketing package once and got nothing for it. You will understand why I am careful.'),
('any-trust_issue-6', 'ANY', 'trust_issue', 'I would need to know a lot more about you before I trust anything you say about {book}.'),
('any-trust_issue-7', 'ANY', 'trust_issue', 'How do I know you are not just another person trying to take advantage of new authors?'),
('any-trust_issue-8', 'ANY', 'trust_issue', 'I want to believe you, but I have learned the hard way. Give me a reason to.'),
('any-no_budget-1', 'ANY', 'no_budget', 'I will be honest, I do not have money to spend on this right now.'),
('any-no_budget-2', 'ANY', 'no_budget', 'This sounds nice, but there is no budget for marketing. Writing the book already cost me more than I expected.'),
('any-no_budget-3', 'ANY', 'no_budget', 'I cannot afford to pay for services at the moment. Things are tight.'),
('any-no_budget-4', 'ANY', 'no_budget', 'If this costs money, I am out. I am barely breaking even on {book}.'),
('any-no_budget-5', 'ANY', 'no_budget', 'I would love more readers, but I simply do not have the money right now.'),
('any-no_budget-6', 'ANY', 'no_budget', 'Is there anything that does not cost a fortune? Because that is all I could manage.'),
('any-no_budget-7', 'ANY', 'no_budget', 'Money is the problem. I have none set aside for this.'),
('any-no_budget-8', 'ANY', 'no_budget', 'Maybe later in the year. For now there really is no money for it.')
ON CONFLICT (id) DO NOTHING;
