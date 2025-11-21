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
 * - Click outside to close
 *
 * Props:
 * - displayMode: Current display mode ('default', 'all', 'raw', 'custom')
 * - showDeleteButtons: Whether delete buttons are shown
 * - hasAdvancedSearch: Whether advanced search is active
 * - hasAdvancedSort: Whether advanced sort is active
 * - onDisplayModeChange: Callback when display mode changes (mode)
 * - onFieldSelect: Callback to open field selector
 * - onAdvancedSearch: Callback to toggle advanced search
 * - onAdvancedSort: Callback to toggle advanced sort
 * - onToggleDelete: Callback to toggle delete mode
 * - isSubList: Whether this menu is for a sub-list (default: false)
 * - tableName: Name of the table (for sub-list link)
 * - onLinkToTable: Callback to navigate to full table view
 */


class ThreeDotsMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false
    };
    this.menuRef = React.createRef();
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

  render() {
    const { displayMode, onDisplayModeChange, onFieldSelect, onToggleDelete, showDeleteButtons, onAdvancedSearch, onAdvancedSort, hasAdvancedSearch, hasAdvancedSort, isSubList, tableName, onLinkToTable, onExtendAuthorization } = this.props;
    const { isOpen } = this.state;

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
        // Display mode section (hide for sub-lists)
        !isSubList && e('div', { className: 'menu-section' },
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
        !isSubList && e('div', { className: 'menu-divider divider' }),
        !isSubList && e('button', {
          className: 'menu-item',
          onClick: () => this.handleOptionClick('onFieldSelect')
        }, '🎯 Sélectionner les champs'),
        !isSubList && e('div', { className: 'menu-divider divider' }),
        !isSubList && onAdvancedSearch && e('button', {
          className: `menu-item ${hasAdvancedSearch ? 'active' : ''}`,
          onClick: () => this.handleOptionClick('onAdvancedSearch')
        }, hasAdvancedSearch ? '✓ ' : '', '🔍 Recherche avancée...'),
        !isSubList && onAdvancedSort && e('button', {
          className: `menu-item ${hasAdvancedSort ? 'active' : ''}`,
          onClick: () => this.handleOptionClick('onAdvancedSort')
        }, hasAdvancedSort ? '✓ ' : '', '📊 Tri avancé...'),

        // Sub-list specific options
        isSubList && [
          e('button', {
            key: 'sublist-delete',
            className: `menu-item ${showDeleteButtons ? 'active' : ''}`,
            onClick: () => this.handleOptionClick('onToggleDelete')
          }, showDeleteButtons ? '✓ ' : '', '🗑️ Mode suppression'),
          e('button', {
            key: 'sublist-sort',
            className: 'menu-item',
            onClick: () => this.handleOptionClick('onAdvancedSort')
          }, '📊 Tri avancé...'),
          onExtendAuthorization && e('button', {
            key: 'sublist-extend-auth',
            className: 'menu-item',
            onClick: () => this.handleOptionClick('onExtendAuthorization')
          }, '🔐 Étendre l\'autorisation aux fiches liées'),
          e('div', { key: 'sublist-divider', className: 'menu-divider' }),
          e('button', {
            key: 'sublist-link',
            className: 'menu-item',
            onClick: () => this.handleOptionClick('onLinkToTable')
          }, `🔗 Lien vers la table ${tableName || ''}`)
        ],

        // Delete mode (for main list only)
        !isSubList && onToggleDelete && [
          e('div', { key: 'divider-delete', className: 'menu-divider' }),
          e('button', {
            key: 'toggle-delete',
            className: `menu-item ${showDeleteButtons ? 'active' : ''}`,
            onClick: () => this.handleOptionClick('onToggleDelete')
          }, showDeleteButtons ? '✓ ' : '', '🗑️ Mode suppression')
        ]
      )
    );
  }
}

// Export to global scope for use in crudList.js
window.ThreeDotsMenu = ThreeDotsMenu;
