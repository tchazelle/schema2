/**
 * RowDetailMenu Component
 * Context menu with actions for row detail view customization
 *
 * Features:
 * - Notify action
 * - Duplicate actions (simple and with relations)
 * - Delete action
 * - Pin favorite actions for quick access
 * - Click outside to close
 * - Works in both view and edit mode
 *
 * Props:
 * - tableName: Name of the table (for localStorage key)
 * - permissions: Object with canCreate, canDelete, canRead flags
 * - onNotify: Callback for notify action
 * - onDuplicate: Callback for simple duplicate
 * - onDuplicateWithRelations: Callback for duplicate with relations
 * - onDelete: Callback for delete action
 * - disabled: Whether the menu is disabled (during operations)
 */

class RowDetailMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      pinnedActions: this.loadPinnedActions()
    };
    this.menuRef = React.createRef();
  }

  // Load pinned actions from localStorage
  loadPinnedActions() {
    try {
      const saved = localStorage.getItem(`pinnedRowDetailActions_${this.props.tableName || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  // Save pinned actions to localStorage
  savePinnedActions(actions) {
    try {
      localStorage.setItem(`pinnedRowDetailActions_${this.props.tableName || 'default'}`, JSON.stringify(actions));
    } catch (e) {
      console.error('Failed to save pinned actions', e);
    }
  }

  // Toggle pin state for an action
  togglePin = (actionKey) => {
    const { pinnedActions } = this.state;
    const newPinned = pinnedActions.includes(actionKey)
      ? pinnedActions.filter(a => a !== actionKey)
      : [...pinnedActions, actionKey];

    this.setState({ pinnedActions: newPinned });
    this.savePinnedActions(newPinned);
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  }

  handleClickOutside = (event) => {
    if (this.menuRef.current && !this.menuRef.current.contains(event.target)) {
      this.setState({ isOpen: false });
    }
  }

  toggleMenu = (ev) => {
    ev.stopPropagation();
    this.setState(prev => ({ isOpen: !prev.isOpen }));
    // Note: Dropdown position adjustment is now handled automatically
    // by the MutationObserver in dropdownPosition.js
  }

  handleOptionClick = (callback) => {
    this.setState({ isOpen: false });
    if (callback) {
      callback();
    }
  }

  // Helper to render a menu item with pin button
  renderMenuItem = (config) => {
    const { key, label, icon, onClick, canPin, style } = config;
    const { pinnedActions } = this.state;
    const isPinned = canPin && pinnedActions.includes(key);

    return e('div', {
      key,
      className: 'menu-item-wrapper',
      style: { display: 'flex', alignItems: 'center', gap: '4px' }
    },
      e('button', {
        className: 'menu-item',
        onClick,
        style: { flex: 1, ...(style || {}) }
      },
        icon ? `${icon} ` : '',
        label
      ),
      canPin && e('button', {
        className: 'btn-pin',
        onClick: (ev) => {
          ev.stopPropagation();
          this.togglePin(key);
        },
        title: isPinned ? 'Désépingler' : 'Épingler',
        style: {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '4px 8px',
          opacity: isPinned ? 1 : 0.5
        }
      }, '📌')
    );
  }

  render() {
    const { permissions, onNotify, onDuplicate, onDuplicateWithRelations, onDelete, disabled } = this.props;
    const { isOpen } = this.state;

    return e('div', { className: 'menu-dots', ref: this.menuRef },
      e('button', {
        className: 'btn btn-menu btn-icon three-dots',
        onClick: this.toggleMenu,
        'aria-label': 'Actions',
        disabled,
        title: 'Actions',
        style: {
          cursor: disabled ? 'wait' : 'pointer',
        }
      }, '⋮'),
      isOpen && e('div', {
        className: 'menu-dropdown open align-right',
        style: { top: '100%', marginTop: '4px' }
      },
        // Notify option (only show if has read permission)
        permissions.canRead && this.renderMenuItem({
          key: 'notify',
          label: 'Notifier',
          icon: '📧',
          onClick: () => this.handleOptionClick(onNotify),
          canPin: true
        }),

        // Separator (only if both notify and duplicate options are visible)
        permissions.canRead && permissions.canCreate && e('div', { key: 'divider-1', className: 'menu-divider divider' }),

        // Duplicate options (only show if has create permission)
        permissions.canCreate && this.renderMenuItem({
          key: 'duplicate',
          label: 'Dupliquer',
          icon: '📋',
          onClick: () => this.handleOptionClick(onDuplicate),
          canPin: true
        }),
        permissions.canCreate && this.renderMenuItem({
          key: 'duplicateWithRelations',
          label: 'Dupliquer avec relations...',
          icon: '📋',
          onClick: () => this.handleOptionClick(onDuplicateWithRelations),
          canPin: true
        }),

        // Delete option (only show if has delete permission)
        permissions.canDelete && e('div', { key: 'divider-2', className: 'menu-divider divider' }),
        permissions.canDelete && this.renderMenuItem({
          key: 'delete',
          label: 'Supprimer cette fiche...',
          icon: '🗑️',
          onClick: () => this.handleOptionClick(onDelete),
          canPin: true,
          style: { color: 'var(--color-danger, #dc3545)' }
        })
      )
    );
  }
}

// Export to global scope
window.RowDetailMenu = RowDetailMenu;
