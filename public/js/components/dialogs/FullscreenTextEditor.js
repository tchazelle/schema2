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
 *
 * Dependencies:
 * - React (global)
 *
 * Props:
 * - fieldName: Name of the field being edited
 * - value: Current value of the field
 * - label: Label to display in header
 * - onSave: Callback when user clicks "Appliquer" (receives new value)
 * - onClose: Callback when modal is closed
 * - isMarkdown: Boolean to show markdown preview (optional)
 */

class FullscreenTextEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value || '',
      showPreview: false // Toggle between edit and preview mode
    };
    this.textareaRef = React.createRef();
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
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.props.onClose();
    }
  }

  handleChange = (e) => {
    this.setState({ value: e.target.value });
  }

  handleSave = () => {
    this.props.onSave(this.state.value);
    this.props.onClose();
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onClose();
    }
  }

  togglePreview = () => {
    this.setState(prev => ({ showPreview: !prev.showPreview }));
  }

  renderMarkdownPreview = () => {
    const { value } = this.state;

    // Simple markdown rendering (basic support)
    // For production, consider using a library like marked.js
    let html = value
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    return e('div', {
      className: 'fullscreen-editor-preview',
      dangerouslySetInnerHTML: { __html: html }
    });
  }

  render() {
    const { fieldName, label, onClose, isMarkdown } = this.props;
    const { value, showPreview } = this.state;

    const charCount = value.length;
    const lineCount = value.split('\n').length;

    return e('div', {
      className: 'fullscreen-editor-overlay',
      onClick: this.handleOverlayClick
    },
      e('div', { className: 'fullscreen-editor-container' },
        // Header
        e('div', { className: 'fullscreen-editor-header' },
          e('div', { className: 'fullscreen-editor-title-section' },
            e('h2', { className: 'fullscreen-editor-title' }, label || fieldName),
            e('div', { className: 'fullscreen-editor-stats' },
              `${charCount} caractères · ${lineCount} lignes`
            )
          ),
          e('div', { className: 'fullscreen-editor-actions' },
            // Preview toggle for markdown fields
            isMarkdown && e('button', {
              className: showPreview ? 'btn-preview active' : 'btn-preview',
              onClick: this.togglePreview,
              type: 'button'
            }, showPreview ? '✏️ Éditer' : '👁️ Aperçu'),

            // Close button
            e('button', {
              className: 'fullscreen-editor-close',
              onClick: onClose,
              title: 'Fermer (Échap)',
              type: 'button'
            }, '✖')
          )
        ),

        // Content area
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
        ),

        // Footer with actions
        e('div', { className: 'fullscreen-editor-footer' },
          e('div', { className: 'fullscreen-editor-footer-left' },
            e('span', { className: 'fullscreen-editor-hint' },
              '💡 Astuce : Appuyez sur Échap pour annuler'
            )
          ),
          e('div', { className: 'fullscreen-editor-footer-right' },
            e('button', {
              className: 'btn-cancel',
              onClick: onClose,
              type: 'button'
            }, 'Annuler'),
            e('button', {
              className: 'btn-apply',
              onClick: this.handleSave,
              type: 'button'
            }, 'Appliquer')
          )
        )
      )
    );
  }
}

// Export to global scope
window.FullscreenTextEditor = FullscreenTextEditor;
