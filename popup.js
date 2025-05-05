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
}); 