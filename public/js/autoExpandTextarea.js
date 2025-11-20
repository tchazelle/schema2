/**
 * Auto-Expand Textarea Utility
 *
 * Automatically adjusts textarea height based on content.
 *
 * Features:
 * - Auto-expands on input
 * - Handles initial content on page load
 * - Smooth height transitions
 * - Minimum height preservation
 * - Works with dynamically added textareas
 *
 * Usage:
 * 1. Import this script in your HTML:
 *    <script src="/js/autoExpandTextarea.js"></script>
 *
 * 2. Initialize on page load:
 *    AutoExpandTextarea.init();
 *
 * 3. Or apply to specific elements:
 *    AutoExpandTextarea.apply(document.querySelector('textarea'));
 *
 * 4. With custom options:
 *    AutoExpandTextarea.init({
 *      selector: '.my-textarea',
 *      minHeight: 60,
 *      maxHeight: 400
 *    });
 */

class AutoExpandTextarea {
  /**
   * Default configuration
   */
  static config = {
    selector: 'textarea', // CSS selector for textareas
    minHeight: 80,        // Minimum height in pixels
    maxHeight: 400,       // Maximum height in pixels (null = unlimited) - Limited to 400px to prevent page scrolling issues
    extraPadding: 4       // Extra padding to prevent scrollbar flicker
  };

  /**
   * Initialize auto-expand on all textareas matching the selector
   * @param {Object} options - Configuration options
   */
  static init(options = {}) {
    // Merge options with defaults
    const config = { ...this.config, ...options };

    // Apply to all existing textareas
    const textareas = document.querySelectorAll(config.selector);
    textareas.forEach(textarea => {
      this.apply(textarea, config);
    });

    // Watch for dynamically added textareas
    this.observeDOM(config);
  }

  /**
   * Apply auto-expand to a single textarea
   * @param {HTMLTextAreaElement} textarea - The textarea element
   * @param {Object} config - Configuration options
   */
  static apply(textarea, config = null) {
    if (!textarea || textarea.tagName !== 'TEXTAREA') {
      return;
    }

    // Use provided config or default
    const settings = config || this.config;

    // Skip if already initialized
    if (textarea.dataset.autoExpand === 'true') {
      return;
    }

    // Mark as initialized
    textarea.dataset.autoExpand = 'true';

    // Set initial styles
    textarea.style.overflow = 'hidden';
    textarea.style.resize = 'none';
    textarea.style.boxSizing = 'border-box';
    textarea.style.transition = 'height 0.1s ease';

    if (settings.minHeight) {
      textarea.style.minHeight = `${settings.minHeight}px`;
    }

    if (settings.maxHeight) {
      textarea.style.maxHeight = `${settings.maxHeight}px`;
      textarea.style.overflowY = 'auto';
    }

    // Auto-adjust function
    const autoAdjust = () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Calculate new height
      let newHeight = textarea.scrollHeight + settings.extraPadding;

      // Apply min/max constraints
      if (settings.minHeight && newHeight < settings.minHeight) {
        newHeight = settings.minHeight;
      }

      if (settings.maxHeight && newHeight > settings.maxHeight) {
        newHeight = settings.maxHeight;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }

      // Set new height
      textarea.style.height = `${newHeight}px`;
    };

    // Adjust on input
    textarea.addEventListener('input', autoAdjust);

    // Adjust on initial load (for pre-filled content)
    setTimeout(() => autoAdjust(), 0);

    // Adjust on window resize (for responsive layouts)
    const resizeObserver = new ResizeObserver(() => {
      autoAdjust();
    });
    resizeObserver.observe(textarea);

    // Store cleanup function
    textarea._autoExpandCleanup = () => {
      resizeObserver.disconnect();
      textarea.removeEventListener('input', autoAdjust);
      delete textarea.dataset.autoExpand;
      delete textarea._autoExpandCleanup;
    };
  }

  /**
   * Remove auto-expand from a textarea
   * @param {HTMLTextAreaElement} textarea - The textarea element
   */
  static destroy(textarea) {
    if (textarea && textarea._autoExpandCleanup) {
      textarea._autoExpandCleanup();
    }
  }

  /**
   * Observe DOM for dynamically added textareas
   * @param {Object} config - Configuration options
   */
  static observeDOM(config) {
    // Use MutationObserver to watch for new textareas
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is a textarea
          if (node.tagName === 'TEXTAREA' && node.matches(config.selector)) {
            this.apply(node, config);
          }

          // Check if the added node contains textareas
          if (node.querySelectorAll) {
            const textareas = node.querySelectorAll(config.selector);
            textareas.forEach(textarea => {
              this.apply(textarea, config);
            });
          }
        });
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Manually trigger resize on a textarea
   * @param {HTMLTextAreaElement} textarea - The textarea element
   */
  static resize(textarea) {
    if (textarea && textarea.dataset.autoExpand === 'true') {
      textarea.dispatchEvent(new Event('input'));
    }
  }

  /**
   * Update configuration for all future textareas
   * @param {Object} options - New configuration options
   */
  static configure(options) {
    this.config = { ...this.config, ...options };
  }
}

// Export to global scope
window.AutoExpandTextarea = AutoExpandTextarea;

// Auto-initialize on DOMContentLoaded if not already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-init is enabled (default: true)
    if (!window.AUTO_EXPAND_DISABLED) {
      AutoExpandTextarea.init();
    }
  });
} else {
  // DOM already loaded, init immediately
  if (!window.AUTO_EXPAND_DISABLED) {
    AutoExpandTextarea.init();
  }
}
