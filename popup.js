document.addEventListener('DOMContentLoaded', function() {
  const sortButton = document.getElementById('sortTabs');
  
  sortButton.addEventListener('click', async () => {
    try {
      // Get all tabs in the current window
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      // Sort tabs by title
      const sortedTabs = tabs.sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        return titleA.localeCompare(titleB);
      });
      
      // Move each tab to its new position
      for (let i = 0; i < sortedTabs.length; i++) {
        await chrome.tabs.move(sortedTabs[i].id, { index: i });
      }
    } catch (error) {
      console.error('Error sorting tabs:', error);
    }
  });

  const removeDuplicatesButton = document.getElementById('removeDuplicates');

  removeDuplicatesButton.addEventListener('click', async () => {
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
      console.error('Error removing duplicate tabs:', error);
    }
  });
}); 