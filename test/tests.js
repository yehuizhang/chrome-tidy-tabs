// Mock chrome.tabs API for testing in Node.js
const chrome = {
  tabs: {
    move: async (tabId, moveProperties) => {
      // console.log(`Mock: Moving tab ${tabId} to index ${moveProperties.index}`);
      // No-op for Node.js tests, as actual tab movement is not relevant for unit testing sorting logic
    },
    query: async (queryInfo) => {
      // This will be mocked per test case if needed
      return [];
    },
  },
};

function getDomainAndSubdomain(url) {
  try {
    const urlObj = new URL(url);
    const hostnameParts = urlObj.hostname.split(".");
    let domain = "";
    let subdomain = "";

    // This is a simplified heuristic and not a full Public Suffix List implementation
    // It attempts to handle common multi-part TLDs like .co.uk
    if (
      hostnameParts.length >= 3 &&
      (hostnameParts[hostnameParts.length - 2] === "co" ||
        hostnameParts[hostnameParts.length - 2] === "com" ||
        hostnameParts[hostnameParts.length - 2] === "org" ||
        hostnameParts[hostnameParts.length - 2] === "net") &&
      hostnameParts[hostnameParts.length - 1].length === 2
    ) {
      // Assuming 2-letter country code TLD
      // e.g., domain.co.uk, domain.com.au
      domain =
        hostnameParts[hostnameParts.length - 3] +
        "." +
        hostnameParts[hostnameParts.length - 2] +
        "." +
        hostnameParts[hostnameParts.length - 1];
      subdomain = hostnameParts.slice(0, hostnameParts.length - 3).join(".");
    } else if (hostnameParts.length >= 2) {
      // e.g., google.com, example.org
      domain =
        hostnameParts[hostnameParts.length - 2] +
        "." +
        hostnameParts[hostnameParts.length - 1];
      subdomain = hostnameParts.slice(0, hostnameParts.length - 2).join(".");
    } else {
      // e.g., localhost, single word domains
      domain = urlObj.hostname;
      subdomain = "";
    }

    return { domain, subdomain };
  } catch (e) {
    console.error("Invalid URL:", url, e);
    return { domain: "", subdomain: "" };
  }
}

async function sortTabsByDomainAndSubdomain(tabs) {
  const sortedTabs = tabs.sort((a, b) => {
    const urlA = getDomainAndSubdomain(a.url);
    const urlB = getDomainAndSubdomain(b.url);

    const domainCompare = urlA.domain.localeCompare(urlB.domain);
    if (domainCompare !== 0) {
      return domainCompare;
    }

    return urlA.subdomain.localeCompare(urlB.subdomain);
  });

  for (let i = sortedTabs.length - 1; i >= 0; i--) {
    await chrome.tabs.move(sortedTabs[i].id, { index: i });
  }
  return sortedTabs; // Return sorted tabs for verification
}

// --- Unit Tests ---

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  passedTests = 0;
  failedTests = 0;

  console.log("Running tests for getDomainAndSubdomain...");
  // Test cases for getDomainAndSubdomain
  assert(
    getDomainAndSubdomain("https://www.google.com").domain === "google.com",
    "getDomainAndSubdomain: www.google.com domain"
  );
  assert(
    getDomainAndSubdomain("https://www.google.com").subdomain === "www",
    "getDomainAndSubdomain: www.google.com subdomain"
  );
  assert(
    getDomainAndSubdomain("https://mail.google.com").domain === "google.com",
    "getDomainAndSubdomain: mail.google.com domain"
  );
  assert(
    getDomainAndSubdomain("https://mail.google.com").subdomain === "mail",
    "getDomainAndSubdomain: mail.google.com subdomain"
  );
  assert(
    getDomainAndSubdomain("https://example.com").domain === "example.com",
    "getDomainAndSubdomain: example.com domain"
  );
  assert(
    getDomainAndSubdomain("https://example.com").subdomain === "",
    "getDomainAndSubdomain: example.com subdomain"
  );
  assert(
    getDomainAndSubdomain("http://localhost:8080/path").domain === "localhost",
    "getDomainAndSubdomain: localhost domain"
  );
  assert(
    getDomainAndSubdomain("http://localhost:8080/path").subdomain === "",
    "getDomainAndSubdomain: localhost subdomain"
  );
  assert(
    getDomainAndSubdomain("invalid-url").domain === "",
    "getDomainAndSubdomain: invalid url domain"
  );
  assert(
    getDomainAndSubdomain("invalid-url").subdomain === "",
    "getDomainAndSubdomain: invalid url subdomain"
  );
  assert(
    getDomainAndSubdomain("https://sub.sub.domain.co.uk").domain ===
      "domain.co.uk",
    "getDomainAndSubdomain: sub.sub.domain.co.uk domain"
  );
  assert(
    getDomainAndSubdomain("https://sub.sub.domain.co.uk").subdomain ===
      "sub.sub",
    "getDomainAndSubdomain: sub.sub.domain.co.uk subdomain"
  );

  console.log("\nRunning tests for sortTabsByDomainAndSubdomain...");
  const tabs = [
    { id: 1, url: "https://www.google.com/search?q=test" },
    { id: 2, url: "https://mail.google.com/mail/u/0/" },
    { id: 3, url: "https://docs.google.com/document/d/123" },
    { id: 4, url: "https://github.com/user/repo" },
    { id: 5, url: "https://www.github.com/another/repo" },
    { id: 6, url: "https://example.com/page1" },
    { id: 7, url: "https://sub.example.com/page2" },
    { id: 8, url: "https://another.example.com/page3" },
  ];

  const sortedTabs = await sortTabsByDomainAndSubdomain(tabs);

  const expectedOrder = [
    "https://example.com/page1", // example.com, (empty)
    "https://another.example.com/page3", // example.com, another
    "https://sub.example.com/page2", // example.com, sub
    "https://github.com/user/repo", // github.com, (empty)
    "https://www.github.com/another/repo", // github.com, www
    "https://docs.google.com/document/d/123", // google.com, docs
    "https://mail.google.com/mail/u/0/", // google.com, mail
    "https://www.google.com/search?q=test", // google.com, www
  ].map((url) => ({ url }));

  const actualUrls = sortedTabs.map((tab) => tab.url);
  const expectedUrls = expectedOrder.map((tab) => tab.url);

  assert(
    JSON.stringify(actualUrls) === JSON.stringify(expectedUrls),
    "sortTabsByDomainAndSubdomain: correct sorting order"
  );

  console.log("\n--- Test Summary ---");
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  if (failedTests > 0) {
    process.exit(1); // Exit with a non-zero code if tests fail
  }
}

runTests();
