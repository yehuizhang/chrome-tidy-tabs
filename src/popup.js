function getDomainAndSubdomain(url) {
  try {
    const urlObj = new URL(url);
    const hostnameParts = urlObj.hostname.split(".");
    if (hostnameParts.length > 2) {
      // Likely has a subdomain
      return {
        domain:
          hostnameParts[hostnameParts.length - 2] +
          "." +
          hostnameParts[hostnameParts.length - 1],
        subdomain: hostnameParts.slice(0, hostnameParts.length - 2).join("."),
      };
    } else {
      // No subdomain or simple domain (e.g., example.com)
      return {
        domain: urlObj.hostname,
        subdomain: "",
      };
    }
  } catch (e) {
    console.error("Invalid URL:", url, e);
    return { domain: "", subdomain: "" };
  }
}

async function sortTabsByDomainAndSubdomain(tabs) {
  const sortedTabs = tabs.sort((a, b) => {
    const urlA = getDomainAndSubdomain(a.url);
    const urlB = getDomainAndSubdomain(b.url);

    // Primary sort by domain
    const domainCompare = urlA.domain.localeCompare(urlB.domain);
    if (domainCompare !== 0) {
      return domainCompare;
    }

    // Secondary sort by subdomain
    return urlA.subdomain.localeCompare(urlB.subdomain);
  });

  for (let i = sortedTabs.length - 1; i >= 0; i--) {
    await chrome.tabs.move(sortedTabs[i].id, { index: i });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const sortButton = document.getElementById("sortTabs");

  sortButton.addEventListener("click", async () => {
    try {
      // Get all tabs in the current window
      const tabs = await chrome.tabs.query({ currentWindow: true });

      await sortTabsByDomainAndSubdomain(tabs);
    } catch (error) {
      console.error("Error sorting tabs:", error);
    }
  });

  const removeDuplicatesButton = document.getElementById("removeDuplicates");

  removeDuplicatesButton.addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const seenUrls = new Set();
      const duplicateTabIds = [];
      for (const tab of tabs) {
        if (seenUrls.has(tab.url)) {
          duplicateTabIds.push(tab.id);
        } else {
          seenUrls.add(tab.url);
        }
      }
      if (duplicateTabIds.length > 0) {
        await chrome.tabs.remove(duplicateTabIds);
      }
    } catch (error) {
      console.error("Error removing duplicate tabs:", error);
    }
  });

  const mergeWindowsButton = document.getElementById("mergeWindows");

  mergeWindowsButton.addEventListener("click", async () => {
    try {
      // Get the current window
      const currentWindow = await chrome.windows.getCurrent();
      // Get all tabs in all windows
      const allTabs = await chrome.tabs.query({});
      // Filter tabs that are not in the current window
      const tabsToMove = allTabs.filter(
        (tab) => tab.windowId !== currentWindow.id
      );
      // Move each tab to the current window
      for (const tab of tabsToMove) {
        await chrome.tabs.move(tab.id, {
          windowId: currentWindow.id,
          index: -1,
        });
      }
    } catch (error) {
      console.error("Error merging windows:", error);
    }
  });
});
