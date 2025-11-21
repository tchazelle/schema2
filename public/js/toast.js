/**
 * Toast Notification System
 *
 * Provides discrete, non-blocking notifications similar to the autosave indicator.
 *
 * Usage:
 *   showToast('Message uploadée avec succès', 'success');
 *   showToast('Erreur lors de l\'opération', 'error');
 *   showToast('Information importante', 'info');
 */

(function() {
  let toastContainer = null;

  /**
   * Get or create the toast container
   */
  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - The type of toast: 'success', 'error', or 'info'
   * @param {number} duration - Duration in milliseconds (default: 3000)
   */
  function showToast(message, type = 'success', duration = 3000) {
    const container = getToastContainer();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;

    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '✓';
        break;
      case 'error':
        icon = '✗';
        break;
      case 'info':
        icon = 'ℹ';
        break;
    }

    toast.innerHTML = `<span style="font-weight: bold; font-size: 16px;">${icon}</span><span>${message}</span>`;

    // Add to container
    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }

        // Remove container if empty
        if (container.children.length === 0 && container.parentNode) {
          container.parentNode.removeChild(container);
          toastContainer = null;
        }
      }, 300); // Wait for fade animation
    }, duration);
  }

  // Export to global scope
  window.showToast = showToast;
})();
