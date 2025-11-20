/**
 * FullscreenTextEditor Component
 *
 * Fullscreen modal editor for textarea fields with large content.
 *
 * Features:
 * - Fullscreen modal overlay
 * - Large textarea for comfortable editing
 * - Character count display
 * - Escape key to close
 * - Auto-focus on textarea
 * - Markdown preview (optional)
 * - Auto-save on change (debounced)
 *
 * Dependencies:
 * - React (global)
 * - marked (global - for markdown rendering)
 *
 * Props:
 * - fieldName: Name of the field being edited
 * - value: Current value of the field
 * - label: Label to display in header
 * - onSave: Callback when value changes (receives new value) - called with debounce
 * - onClose: Callback when modal is closed
 * - isMarkdown: Boolean to show markdown preview (optional)
 * - row: Current row data (optional - for displaying record title)
 * - tableConfig: Table configuration (optional - for displayFields)
 */

class FullscreenTextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value || '',
      showPreview: false // Toggle between edit and preview mode
    };
    this.textareaRef = React.createRef();
    this.saveTimeout = null;
    this.autosaveDelay = 300; // 300ms debounce
  }

  componentDidMount() {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Auto-focus textarea
    if (this.textareaRef.current) {
      this.textareaRef.current.focus();
      // Move cursor to end
      const length = this.state.value.length;
      this.textareaRef.current.setSelectionRange(length, length);
    }

    // Listen for Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    // Restore body scroll
    document.body.style.overflow = '';

    // Remove event listener
    document.removeEventListener('keydown', this.handleKeyDown);

    // Clear pending save timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      // Save before closing if there are unsaved changes
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.props.onSave(this.state.value);
      }
      this.props.onClose();
    }
  }

  handleChange = (e) => {
    const newValue = e.target.value;
    this.setState({ value: newValue });

    // Auto-save with debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.props.onSave(newValue);
      this.saveTimeout = null;
    }, this.autosaveDelay);
  }

  handleOverlayClick = (e) => {
    // Don't close on overlay click to prevent accidental loss
    // Only close via Escape key or close button
  }

  togglePreview = () => {
    this.setState(prev => ({ showPreview: !prev.showPreview }));
  }

  renderMarkdownPreview = () => {
    const { value } = this.state;

    let html;

    // Use marked.js if available for proper markdown rendering
    if (typeof marked !== 'undefined') {
      try {
        html = marked.parse(value || '');
      } catch (error) {
        console.error('Marked.js error:', error);
        html = this.renderBasicMarkdown(value);
      }
    } else {
      // Fallback to basic markdown rendering
      html = this.renderBasicMarkdown(value);
    }

    return e('div', {
      className: 'fullscreen-editor-preview markdown',
      dangerouslySetInnerHTML: { __html: html }
    });
  }

  renderBasicMarkdown = (value) => {
    // Simple markdown rendering (basic support)
    return value
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  }

  getRecordTitle = () => {
    const { row, tableConfig } = this.props;

    if (!row || !tableConfig || !tableConfig.displayFields) {
      return null;
    }

    // Get display fields and build title
    const displayFields = tableConfig.displayFields;
    const titleParts = displayFields.map(fieldName => row[fieldName]).filter(Boolean);

    return titleParts.join(' ');
  }

  render() {
    const { fieldName, label, onClose, isMarkdown } = this.props;
    const { value, showPreview } = this.state;

    const charCount = value.length;
    const lineCount = value.split('\n').length;
    const recordTitle = this.getRecordTitle();

    return e('div', {
      className: 'fullscreen-editor-overlay',
      onClick: this.handleOverlayClick
    },
      e('div', { className: 'fullscreen-editor-container' },
        // Header - Single line with record title, field name, stats, and actions
        e('div', { className: 'fullscreen-editor-header' },
          e('div', { className: 'fullscreen-editor-title-section' },
            // Record title (if available)
            recordTitle && e('span', {
              className: 'fullscreen-editor-record-title'
            }, recordTitle, ' - '),
            // Field name
            e('span', { className: 'fullscreen-editor-field-name' }, label || fieldName),
            // Stats
            e('span', { className: 'fullscreen-editor-stats' },
              ` - ${charCount} caractères · ${lineCount} lignes`
            )
          ),
          e('div', { className: 'fullscreen-editor-actions' },
            // Preview toggle for markdown fields
            isMarkdown && e('button', {
              className: showPreview ? 'btn-preview active' : 'btn-preview',
              onClick: this.togglePreview,
              type: 'button'
            }, showPreview ? '✏️ Éditer' : 'Aperçu'),

            // Close button
            e('button', {
              className: 'fullscreen-editor-close',
              onClick: onClose,
              title: 'Fermer (Échap)',
              type: 'button'
            }, '✖')
          )
        ),

        // Content area - Full height, no padding
        e('div', { className: 'fullscreen-editor-content' },
          showPreview && isMarkdown ? (
            this.renderMarkdownPreview()
          ) : (
            e('textarea', {
              ref: this.textareaRef,
              className: 'fullscreen-editor-textarea',
              value: value,
              onChange: this.handleChange,
              placeholder: 'Saisissez votre texte ici...'
            })
          )
        )
      )
    );
  }
}

// Export to global scope
window.FullscreenTextEditor = FullscreenTextEditor;
