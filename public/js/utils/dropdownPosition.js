/**
 * Dropdown Position Utility
 *
 * Automatically adjusts dropdown menu position to prevent overflow
 * when the trigger button is near the edge of the screen.
 *
 * Usage:
 *   adjustDropdownPosition(dropdownElement)
 *
 * Features:
 * - Detects if dropdown would overflow right edge
 * - Detects if dropdown would overflow left edge
 * - Automatically flips alignment to keep dropdown in viewport
 * - Adjusts vertical position if near bottom edge
 */

/**
 * Adjusts dropdown position to prevent viewport overflow
 * @param {HTMLElement} dropdown - The dropdown menu element
 * @param {HTMLElement} trigger - Optional trigger button element
 */
function adjustDropdownPosition(dropdown, trigger = null) {
  if (!dropdown) return;

  // Get dropdown dimensions and position
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight();

  // Safety margins from viewport edges
  const EDGE_MARGIN = 16; // pixels

  // Check horizontal overflow
  const overflowsRight = dropdownRect.right > viewportWidth - EDGE_MARGIN;
  const overflowsLeft = dropdownRect.left < EDGE_MARGIN;

  // Remove existing alignment classes
  dropdown.classList.remove('align-right', 'align-left', 'align-center', 'overflow-right', 'overflow-left');

  // Apply appropriate alignment based on overflow
  if (overflowsRight && !overflowsLeft) {
    // Dropdown overflows right edge - align to RIGHT of parent container
    dropdown.classList.add('align-right');
    dropdown.classList.add('overflow-right');
    dropdown.style.left = 'auto';
    dropdown.style.right = '0';
  } else if (overflowsLeft && !overflowsRight) {
    // Dropdown overflows left edge - align to LEFT of parent container
    dropdown.classList.add('align-left');
    dropdown.classList.add('overflow-left');
    dropdown.style.right = 'auto';
    dropdown.style.left = '0';
  } else if (!dropdown.classList.contains('align-left') && !dropdown.classList.contains('align-center')) {
    // Default to right alignment if no specific class
    dropdown.classList.add('align-right');
    dropdown.style.left = 'auto';
    dropdown.style.right = '0';
  }

  // Check vertical overflow
  const overflowsBottom = dropdownRect.bottom > viewportHeight - EDGE_MARGIN;

  if (overflowsBottom) {
    // Position dropdown above trigger instead of below
    dropdown.classList.add('position-above');
    dropdown.style.bottom = '100%';
    dropdown.style.top = 'auto';
    dropdown.style.marginBottom = '8px';
  } else {
    dropdown.classList.remove('position-above');
    dropdown.style.bottom = 'auto';
    dropdown.style.marginBottom = '0';
  }

  // Ensure dropdown stays within horizontal bounds with max-width
  const maxWidth = Math.min(320, viewportWidth - (2 * EDGE_MARGIN));
  dropdown.style.maxWidth = `${maxWidth}px`;
}

/**
 * Auto-adjusts dropdown position when opened
 * Call this function when toggling dropdown to open state
 * @param {HTMLElement} dropdown - The dropdown menu element
 * @param {HTMLElement} trigger - The trigger button element
 */
function autoAdjustDropdown(dropdown, trigger) {
  if (!dropdown) return;

  // Wait for dropdown to be rendered with display:block
  // then adjust position
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      adjustDropdownPosition(dropdown, trigger);
    });
  });
}

/**
 * Setup automatic dropdown positioning for all dropdowns
 * Call this on page load or after dynamic content is added
 */
function setupDropdownPositioning() {
  // Use MutationObserver to detect when dropdowns are opened
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const element = mutation.target;

        // Check if dropdown was just opened
        if (element.classList.contains('menu-dropdown') && element.classList.contains('open')) {
          const trigger = element.previousElementSibling;
          autoAdjustDropdown(element, trigger);
        }
      }
    });
  });

  // Observe all dropdown containers
  document.querySelectorAll('.menu-container, .menu-dots, .user-menu').forEach((container) => {
    observer.observe(container, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  });

  // Also setup resize handler to re-adjust on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      document.querySelectorAll('.menu-dropdown.open').forEach((dropdown) => {
        adjustDropdownPosition(dropdown);
      });
    }, 100);
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDropdownPositioning);
} else {
  setupDropdownPositioning();
}

// Export functions for manual use
if (typeof window !== 'undefined') {
  window.adjustDropdownPosition = adjustDropdownPosition;
  window.autoAdjustDropdown = autoAdjustDropdown;
  window.setupDropdownPositioning = setupDropdownPositioning;
}
