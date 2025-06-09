// ==UserScript==
// @name         ProtonMail Oldest Emails First
// @namespace    nisc
// @version      2025.06.08-A
// @description  Automatically sort emails by date (oldest first) in Proton Mail inbox
// @homepageURL  https://github.com/nisc/protonmail-userscripts/
// @downloadURL  https://raw.githubusercontent.com/nisc/protonmail-userscripts/main/protonmail-oldest-first.user.js
// @author       nisc
// @match        https://mail.proton.me/*
// @icon         https://mail.proton.me/assets/favicon.ico
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // Configuration object containing all adjustable settings and constants
  const CONFIG = {
    // DOM selectors used throughout the script
    selectors: {
      dropdownButton: '[data-testid="dropdown-button"][title="Sort conversations"]',
      sortOldestButton: '[data-testid="toolbar:sort-old-to-new"]'
    },
    // URL patterns and parameters
    url: {
      inboxPattern: /^\/u\/\d+\/inbox$/,
      sortParam: 'sort=date'
    },
    // Timing delays (in ms) for various operations
    delays: {
      DROPDOWN_CHECK: 50,    // Delay between checks for the sort dropdown menu
      DROPDOWN_CLOSE: 25     // Delay before closing the dropdown after sorting
    }
  };

  /**
   * Checks if the current URL matches the inbox pattern and applies sorting if needed
   * If we're in the inbox without a sort parameter, adds it and triggers the sort
   */
  function checkURL() {
    const url = new URL(window.location.href);
    if (url.pathname.match(CONFIG.url.inboxPattern) && !url.hash.includes(CONFIG.url.sortParam)) {
      url.hash = CONFIG.url.sortParam;
      history.replaceState(null, '', url.toString());
      triggerSortByDate();
    }
  }

  /**
   * Triggers the sort-by-date action by simulating clicks on the UI elements
   * Opens the sort dropdown, clicks the "oldest first" option, then closes the dropdown
   */
  function triggerSortByDate() {
    const dropdownButton = document.querySelector(CONFIG.selectors.dropdownButton);
    if (dropdownButton) {
      dropdownButton.click();
      const interval = setInterval(() => {
        const sortOldestFirstButton = document.querySelector(CONFIG.selectors.sortOldestButton);
        if (sortOldestFirstButton) {
          clearInterval(interval);
          sortOldestFirstButton.click();
          setTimeout(() => {
            dropdownButton.click();
          }, CONFIG.delays.DROPDOWN_CLOSE);
        }
      }, CONFIG.delays.DROPDOWN_CHECK);
    }
  }

  // Override history methods to detect SPA navigation
  const originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    checkURL();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    checkURL();
  };

  // Listen for browser navigation events
  window.addEventListener('popstate', checkURL);

  // Watch for DOM changes to detect SPA navigation
  const observer = new MutationObserver(checkURL);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial check when script loads
  checkURL();
})();