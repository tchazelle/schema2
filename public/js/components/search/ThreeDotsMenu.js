/**
 * ThreeDotsMenu Component
 * Context menu with actions for table view customization
 *
 * Features:
 * - Display mode selection (default, all, raw, custom)
 * - Field selection trigger
 * - Advanced search toggle
 * - Advanced sort toggle
 * - Delete mode toggle
 * - Sub-list specific options (when isSubList=true)
 * - Create/Add button in menu
 * - Pin favorite actions for quick access
 * - Click outside to close
 *
 * Props:
 * - displayMode: Current display mode ('default', 'all', 'raw', 'custom')
 * - showDeleteButtons: Whether delete buttons are shown
 * - hasAdvancedSearch: Whether advanced search is active
 * - hasAdvancedSort: Whether advanced sort is active
 * - canCreate: Whether user can create new items
 * - onDisplayModeChange: Callback when display mode changes (mode)
 * - onFieldSelect: Callback to open field selector
 * - onAdvancedSearch: Callback to toggle advanced search
 * - onAdvancedSort: Callback to toggle advanced sort
 * - onToggleDelete: Callback to toggle delete mode
 * - onCreate: Callback to create new item
 * - isSubList: Whether this menu is for a sub-list (default: false)
 * - tableName: Name of the table (for sub-list link)
 * - onLinkToTable: Callback to navigate to full table view
 */


class ThreeDotsMenu extends React.Component {
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
      const saved = localStorage.getItem(`pinnedActions_${this.props.tableName || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  // Save pinned actions to localStorage
  savePinnedActions(actions) {
    try {
      localStorage.setItem(`pinnedActions_${this.props.tableName || 'default'}`, JSON.stringify(actions));
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
    this.setState(prev => ({ isOpen: !prev.isOpen }), () => {
      // After opening, adjust dropdown position to prevent overflow
      if (this.state.isOpen && this.menuRef.current) {
        const dropdown = this.menuRef.current.querySelector('.menu-dropdown');
        if (dropdown && window.adjustDropdownPosition) {
          // Use requestAnimationFrame to ensure dropdown is rendered
          requestAnimationFrame(() => {
            window.adjustDropdownPosition(dropdown);
          });
        }
      }
    });
  }

  handleOptionClick = (action) => {
    this.setState({ isOpen: false });
    if (this.props[action]) {
      this.props[action]();
    }
  }

  // Helper to render a menu item with pin button
  renderMenuItem = (config) => {
    const { key, label, icon, onClick, isActive, canPin } = config;
    const { pinnedActions } = this.state;
    const isPinned = canPin && pinnedActions.includes(key);

    return e('div', {
      key,
      className: 'menu-item-wrapper',
      style: { display: 'flex', alignItems: 'center', gap: '4px' }
    },
      e('button', {
        className: `menu-item ${isActive ? 'active' : ''}`,
        onClick,
        style: { flex: 1 }
      },
        isActive ? '✓ ' : '',
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
          opacity: isPinned ? 1 : 0.3
        }
      }, '📌')
    );
  }

  render() {
    const { displayMode, onDisplayModeChange, onFieldSelect, onToggleDelete, showDeleteButtons, onAdvancedSearch, onAdvancedSort, hasAdvancedSearch, hasAdvancedSort, isSubList, tableName, onLinkToTable, onExtendAuthorization, onCreate, canCreate } = this.props;
    const { isOpen, pinnedActions } = this.state;

    return e('div', { className: 'menu-dots', ref: this.menuRef },
      e('button', {
        className: 'btn btn-menu btn-icon three-dots',
        onClick: this.toggleMenu,
        'aria-label': 'Options'
      }, '⋮'),
      isOpen && e('div', {
        className: 'menu-dropdown open align-right',
        style: { top: '100%', marginTop: '4px' }
      },
        // Create/Add button section
        (canCreate && onCreate) && [
          e('div', { key: 'create-section', className: 'menu-section' },
            this.renderMenuItem({
              key: 'create',
              label: isSubList ? 'Ajouter' : 'Nouveau',
              icon: '+',
              onClick: () => this.handleOptionClick('onCreate'),
              isActive: false,
              canPin: true
            })
          ),
          e('div', { key: 'create-divider', className: 'menu-divider divider' })
        ],

        // Search and Sort (main list only)
        !isSubList && onAdvancedSearch && this.renderMenuItem({
          key: 'advancedSearch',
          label: 'Recherche...',
          icon: '🔍',
          onClick: () => this.handleOptionClick('onAdvancedSearch'),
          isActive: hasAdvancedSearch,
          canPin: true
        }),
        !isSubList && onAdvancedSort && this.renderMenuItem({
          key: 'advancedSort',
          label: 'Tri...',
          icon: '📊',
          onClick: () => this.handleOptionClick('onAdvancedSort'),
          isActive: hasAdvancedSort,
          canPin: true
        }),

        // Delete mode (for main list only)
        !isSubList && onToggleDelete && [
          e('div', { key: 'divider-delete', className: 'menu-divider' }),
          this.renderMenuItem({
            key: 'toggleDelete',
            label: 'Mode suppression',
            icon: '🗑️',
            onClick: () => this.handleOptionClick('onToggleDelete'),
            isActive: showDeleteButtons,
            canPin: true
          })
        ],

        // Display mode section at the end (hide for sub-lists)
        !isSubList && [
          e('div', { key: 'divider-columns', className: 'menu-divider divider' }),
          e('div', { key: 'columns-section', className: 'menu-section' },
            e('div', { className: 'menu-label' }, 'Sélection des colonnes'),
            e('button', {
              className: `menu-item ${displayMode === 'default' ? 'active' : ''}`,
              onClick: () => {
                this.handleOptionClick('onDisplayModeChange');
                onDisplayModeChange('default');
              }
            }, displayMode === 'default' ? '✓ ' : '', 'Par défaut (masquer champs système)'),
            e('button', {
              className: `menu-item ${displayMode === 'all' ? 'active' : ''}`,
              onClick: () => {
                this.handleOptionClick('onDisplayModeChange');
                onDisplayModeChange('all');
              }
            }, displayMode === 'all' ? '✓ ' : '', 'Tous les champs'),
            e('button', {
              className: `menu-item ${displayMode === 'raw' ? 'active' : ''}`,
              onClick: () => {
                this.handleOptionClick('onDisplayModeChange');
                onDisplayModeChange('raw');
              }
            }, displayMode === 'raw' ? '✓ ' : '', 'Données brutes'),
            e('button', {
              className: `menu-item ${displayMode === 'custom' ? 'active' : ''}`,
              onClick: () => {
                this.handleOptionClick('onDisplayModeChange');
                onDisplayModeChange('custom');
              }
            }, displayMode === 'custom' ? '✓ ' : '', 'Sélection personnalisée')
          ),
          e('div', { key: 'divider-fieldselect', className: 'menu-divider divider' }),
          this.renderMenuItem({
            key: 'fieldSelect',
            label: 'Colonnes...',
            icon: '🎯',
            onClick: () => this.handleOptionClick('onFieldSelect'),
            isActive: false,
            canPin: true
          })
        ],

        // Sub-list specific options
        isSubList && [
          this.renderMenuItem({
            key: 'sublist-delete',
            label: 'Mode suppression',
            icon: '🗑️',
            onClick: () => this.handleOptionClick('onToggleDelete'),
            isActive: showDeleteButtons,
            canPin: true
          }),
          this.renderMenuItem({
            key: 'sublist-sort',
            label: 'Tri...',
            icon: '📊',
            onClick: () => this.handleOptionClick('onAdvancedSort'),
            isActive: false,
            canPin: true
          }),
          onExtendAuthorization && this.renderMenuItem({
            key: 'sublist-extend-auth',
            label: 'Étendre l\'autorisation aux fiches liées',
            icon: '🔐',
            onClick: () => this.handleOptionClick('onExtendAuthorization'),
            isActive: false,
            canPin: true
          }),
          e('div', { key: 'sublist-divider', className: 'menu-divider' }),
          e('button', {
            key: 'sublist-link',
            className: 'menu-item',
            onClick: () => this.handleOptionClick('onLinkToTable')
          }, `🔗 Lien vers la table ${tableName || ''}`)
        ]
      )
    );
  }
}

// Export to global scope for use in crudList.js
window.ThreeDotsMenu = ThreeDotsMenu;
