import { expect, test } from "bun:test";
import { emailsIn } from "../src/lib/scout/perplexity-contact.server";

test("reads plain and spam-protected emails", () => {
  expect([...emailsIn("Email: joanna AT JFPenn.com today")]).toEqual(["joanna@jfpenn.com"]);
  expect([...emailsIn("write to jo [at] site [dot] co.uk")]).toEqual(["jo@site.co.uk"]);
  expect([...emailsIn('<a href="mailto:a.b@x.org">')]).toEqual(["a.b@x.org"]);
  expect(emailsIn("I looked at the site").size).toBe(0);
});
