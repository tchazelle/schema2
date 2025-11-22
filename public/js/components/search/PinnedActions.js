/**
 * PinnedActions Component
 * Displays pinned actions as quick-access buttons in the table header
 *
 * Features:
 * - Renders pinned actions from ThreeDotsMenu as standalone buttons
 * - Syncs with localStorage to maintain user preferences
 * - Shows only the actions that are currently pinned
 * - Compact button design for header integration
 *
 * Props:
 * - tableName: Name of the table (for localStorage key)
 * - storageKeyPrefix: Optional prefix for localStorage key (default: 'pinnedActions')
 * - actions: Object mapping action keys to action configs
 *   Example: {
 *     create: { label: 'Nouveau', icon: '+', onClick: () => {...}, show: true },
 *     fieldSelect: { label: 'Champs', icon: '🎯', onClick: () => {...}, show: true }
 *   }
 */

class PinnedActions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pinnedActions: this.loadPinnedActions()
    };

    // Listen for changes from ThreeDotsMenu
    this.handleStorageChange = this.handleStorageChange.bind(this);
  }

  componentDidMount() {
    window.addEventListener('storage', this.handleStorageChange);
    // Also check every second for changes (for same-window updates)
    this.interval = setInterval(() => {
      const newPinned = this.loadPinnedActions();
      if (JSON.stringify(newPinned) !== JSON.stringify(this.state.pinnedActions)) {
        this.setState({ pinnedActions: newPinned });
      }
    }, 1000);
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.handleStorageChange);
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  getStorageKey() {
    const prefix = this.props.storageKeyPrefix || 'pinnedActions';
    return `${prefix}_${this.props.tableName || 'default'}`;
  }

  handleStorageChange(e) {
    if (e.key === this.getStorageKey()) {
      this.setState({ pinnedActions: this.loadPinnedActions() });
    }
  }

  loadPinnedActions() {
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  render() {
    const { actions } = this.props;
    const { pinnedActions } = this.state;

    if (!actions || pinnedActions.length === 0) {
      return null;
    }

    return e('div', {
      className: 'pinned-actions',
      style: {
        display: 'flex',
        gap: 'var(--space-sm)',
        alignItems: 'center'
      }
    },
      pinnedActions.map(actionKey => {
        const action = actions[actionKey];
        if (!action || !action.show) return null;

        return e('button', {
          key: actionKey,
          className: 'btn btn-pinned',
          onClick: action.onClick,
          title: action.label,
          style: {
            padding: 'var(--space-xs) var(--space-sm)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            whiteSpace: 'nowrap'
          }
        },
          action.icon && e('span', null, action.icon),
          e('span', null, action.label)
        );
      })
    );
  }
}

// Export to global scope
window.PinnedActions = PinnedActions;
