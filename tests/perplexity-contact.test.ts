import { expect, test } from "bun:test";
import { emailsIn } from "../src/lib/scout/perplexity-contact.server";

test("reads plain and spam-protected emails", () => {
  expect([...emailsIn("Email: joanna AT JFPenn.com today")]).toEqual(["joanna@jfpenn.com"]);
  expect([...emailsIn("write to jo [at] site [dot] co.uk")]).toEqual(["jo@site.co.uk"]);
  expect([...emailsIn('<a href="mailto:a.b@x.org">')]).toEqual(["a.b@x.org"]);
  expect(emailsIn("I looked at the site").size).toBe(0);
});

test("emailsIn drops machine ids, page files, vendors and escapes", async () => {
  const { emailsIn } = await import("../src/lib/scout/perplexity-contact.server");
  expect([
    ...emailsIn(
      "\\u003eralemiller375@gmail.com\\u003c 3863-1791394200@g.net point@index.html info@themepunch.com blog@wordpress.com jo AT site DOT com",
    ),
  ]).toEqual(["ralemiller375@gmail.com", "jo@site.com"]);
});

test("guessAuthorSites builds personal domains from the name", async () => {
  const { guessAuthorSites } = await import("../src/lib/scout/website-contact.server");
  const sites = guessAuthorSites("Timothy R. Baldwin Jr.");
  expect(sites).toContain("https://timothyrbaldwin.com");
  expect(sites).toContain("https://timothybaldwinauthor.com");
  expect(guessAuthorSites("Madonna")).toEqual([]);
});
