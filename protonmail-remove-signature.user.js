// ==UserScript==
// @name         ProtonMail Remove Signature
// @namespace    nisc
// @version      2025.06.08-A
// @description  Auto-remove ProtonMail signature when writing / replying to / forwarding emails
// @homepageURL  https://github.com/nisc/protonmail-userscripts/
// @downloadURL  https://raw.githubusercontent.com/nisc/protonmail-userscripts/main/protonmail-remove-signature.user.js
// @author       nisc
// @include      https://mail.proton.me/*
// @icon         https://mail.proton.me/assets/favicon.ico
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * This userscript automatically removes ProtonMail signatures from email composers.
 * It works with both new emails and replies/forwards.
 *
 * Features:
 * - Instantly hides signatures using CSS to prevent visual flash
 * - Properly removes both empty and non-empty signatures
 * - Handles multiple composer instances
 * - Cleans up all associated signature elements
 * - Preserves proper spacing before quoted text
 *
 * Technical details:
 * - Uses MutationObserver to detect composer iframes and signature insertions
 * - Handles ProtonMail's iframe-based composer architecture
 */

/**
 * Configuration object containing all constants used in the script
 */
const CONFIG = {
  // DOM selectors used throughout the script
  selectors: {
    composer: 'iframe[title="Email composer"]',
    signatureBlock: '.protonmail_signature_block',
    protonSignature: '.protonmail_signature_block-proton',
    emptySignature: '.protonmail_signature_block-empty'
  },
  maxInitAttempts: 50,  // Maximum number of attempts to wait for iframe initialization
  initRetryDelay: 50    // Delay between initialization attempts (ms)
};

/**
 * Injects CSS to hide signature blocks immediately while JS removes them
 * This prevents the brief flash of signature before removal
 */
function injectHideSignatureCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .protonmail_signature_block,
    .protonmail_signature_block-proton,
    .protonmail_signature_block-empty {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Removes the ProtonMail signature block and its associated elements from the email composer
 * Preserves proper spacing by adding a line break before the quoted text
 *
 * The signature block can appear in two forms:
 * 1. Regular signature: Has content and needs to remove both the signature and previous element
 * 2. Empty signature: Just a placeholder that needs to remove both previous elements
 *
 * @param {Element} node - The signature block node to process
 * @returns {boolean} - Whether the signature was successfully removed
 */
function removeSignature(node) {
  try {
    const prev = node.previousElementSibling;
    const isEmptySignature = node.firstElementChild?.classList.contains(
      CONFIG.selectors.emptySignature.slice(1)
    );

    // Insert line break before the signature block (which is where quoted text will be)
    const br = node.ownerDocument.createElement('br');
    node.parentNode.insertBefore(br, node);

    if (!isEmptySignature) {
      prev?.remove();
    } else {
      const prevPrev = prev?.previousElementSibling;
      prevPrev?.remove();
      prev?.remove();
    }

    const signature = node.querySelector(CONFIG.selectors.protonSignature);
    if (signature) {
      signature.remove();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Sets up the mutation observer on the iframe's contentDocument
 * Watches for signature block insertions and removes them
 * Also checks for any existing signatures that might have been added before setup
 *
 * @param {Document} iframeDoc - The iframe's contentDocument
 */
function setupObserver(iframeDoc) {
  // Create an observer to watch for signature block insertion
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        // Skip text nodes and non-element nodes
        if (!node.classList) return;

        // Check if the added node is a signature block with a Proton signature
        const isSignatureBlock = node.classList.contains(CONFIG.selectors.signatureBlock.slice(1));
        if (isSignatureBlock) {
          const protonSignature = node.querySelector(CONFIG.selectors.protonSignature);
          if (protonSignature) {
            removeSignature(node);
          }
        }
      });
    });
  });

  // Set up observer with all necessary mutation types
  observer.observe(iframeDoc, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true
  });

  // Check for any existing signatures that might have been added before observer setup
  const existingSignatures = iframeDoc.querySelectorAll(CONFIG.selectors.signatureBlock);
  existingSignatures.forEach(node => {
    const protonSignature = node.querySelector(CONFIG.selectors.protonSignature);
    if (protonSignature) {
      removeSignature(node);
    }
  });
}

/**
 * Waits for the iframe's contentDocument to be ready
 * Uses a retry mechanism with configurable attempts and delay
 *
 * @param {HTMLIFrameElement} iframe - The composer iframe element
 * @returns {Promise<Document>} - Resolves with the iframe's contentDocument when ready
 */
async function waitForIframeDoc(iframe) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkDoc = () => {
      attempts++;

      try {
        const doc = iframe.contentDocument;
        if (doc && doc.readyState !== 'uninitialized') {
          resolve(doc);
          return;
        }
      } catch (e) {
        // Ignore errors - they're expected while iframe initializes
      }

      if (attempts >= CONFIG.maxInitAttempts) {
        reject(new Error('Failed to initialize editor after max attempts'));
        return;
      }

      setTimeout(checkDoc, CONFIG.initRetryDelay);
    };

    checkDoc();
  });
}

/**
 * Sets up the main observer to watch for composer iframes being added to the page
 */
function setupComposerObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        // Skip text nodes and non-element nodes
        if (!node.nodeType === Node.ELEMENT_NODE) return;

        // Check if the added node is a composer iframe
        if (node.matches?.(CONFIG.selectors.composer)) {
          waitForIframeDoc(node).then(setupObserver).catch(() => {
            // If initialization fails, the next composer instance will try again
          });
        }

        // Also check children of added nodes for composer iframes
        const composerIframes = node.querySelectorAll?.(CONFIG.selectors.composer);
        if (composerIframes) {
          composerIframes.forEach(iframe => {
            waitForIframeDoc(iframe).then(setupObserver).catch(() => {
              // If initialization fails, the next composer instance will try again
            });
          });
        }
      });
    });
  });

  // Set up observer to watch for composer iframes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Check for any existing composer iframes
  const existingComposers = document.querySelectorAll(CONFIG.selectors.composer);
  existingComposers.forEach(iframe => {
    waitForIframeDoc(iframe).then(setupObserver).catch(() => {
      // If initialization fails, the next composer instance will try again
    });
  });
}

// Inject CSS immediately when script loads
injectHideSignatureCSS();

// Start watching for composer iframes
setupComposerObserver();