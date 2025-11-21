/**
 * RowDetailModal Component
 *
 * Full-screen modal wrapper with overlay for detailed row view.
 * Displays a row in a modal with fixed header containing title, granted selector, and close button.
 * Handles both view mode and edit mode, preventing body scroll when open.
 *
 * Dependencies:
 * - React (global)
 * - buildCardTitle (utils function)
 * - getGrantedIcon (utils function)
 * - GrantedSelector (forms component)
 * - EditForm (forms component)
 * - RowDetailView (details component)
 *
 * @component
 */


class RowDetailModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showDuplicateMenu: false,
      showRelationSelector: false,
      duplicating: false,
      showNotifyModal: false,
      notifying: false
    };
    this.menuRef = React.createRef();
  }

  componentDidMount() {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    // Add click listener for closing duplicate menu
    document.addEventListener('click', this.handleClickOutside);
  }

  componentWillUnmount() {
    // Restore body scroll
    document.body.style.overflow = '';
    // Remove click listener
    document.removeEventListener('click', this.handleClickOutside);
  }

  handleClickOutside = (event) => {
    if (this.menuRef.current && !this.menuRef.current.contains(event.target)) {
      this.setState({ showDuplicateMenu: false });
    }
  }

  toggleDuplicateMenu = (ev) => {
    ev.stopPropagation();
    this.setState(prev => ({ showDuplicateMenu: !prev.showDuplicateMenu }), () => {
      // After opening, adjust dropdown position to prevent overflow
      if (this.state.showDuplicateMenu && this.menuRef.current) {
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

  handleDuplicate = async () => {
    const { tableName, row, onClose } = this.props;
    this.setState({ showDuplicateMenu: false, duplicating: true });

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/duplicate`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert(`Enregistrement dupliqué avec succès ! (ID: ${data.id})`);
        // Refresh the list and open the new record
        window.location.href = `/_crud/${tableName}?open=${data.id}`;
      } else {
        alert(`Erreur lors de la duplication : ${data.error}`);
        this.setState({ duplicating: false });
      }
    } catch (error) {
      console.error('Duplicate error:', error);
      alert(`Erreur lors de la duplication : ${error.message}`);
      this.setState({ duplicating: false });
    }
  }

  handleDuplicateWithRelations = () => {
    this.setState({ showDuplicateMenu: false, showRelationSelector: true });
  }

  handleConfirmDuplicateWithRelations = async (selectedRelations) => {
    const { tableName, row } = this.props;
    this.setState({ showRelationSelector: false, duplicating: true });

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/duplicate-with-relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relations: selectedRelations })
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || `Enregistrement dupliqué avec succès ! (ID: ${data.id})`);
        // Refresh the list and open the new record
        window.location.href = `/_crud/${tableName}?open=${data.id}`;
      } else {
        alert(`Erreur lors de la duplication : ${data.error}`);
        this.setState({ duplicating: false });
      }
    } catch (error) {
      console.error('Duplicate with relations error:', error);
      alert(`Erreur lors de la duplication : ${error.message}`);
      this.setState({ duplicating: false });
    }
  }

  handleCancelRelationSelector = () => {
    this.setState({ showRelationSelector: false });
  }

  handleNotifyClick = () => {
    this.setState({ showNotifyModal: true });
  }

  handleCancelNotify = () => {
    this.setState({ showNotifyModal: false });
  }

  handleConfirmNotify = async (options) => {
    const { tableName, row, onUpdate } = this.props;
    this.setState({ showNotifyModal: false, notifying: true });

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || 'Notifications envoyées avec succès');
      } else {
        alert(`Erreur : ${data.error}`);
      }
    } catch (error) {
      console.error('Notify error:', error);
      alert(`Erreur lors de l'envoi des notifications : ${error.message}`);
    } finally {
      this.setState({ notifying: false });
    }
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onClose();
    }
  }

  render() {
    const {
      row,
      tableName,
      tableConfig,
      structure,
      permissions,
      editMode,
      loading,
      focusFieldName,
      onClose,
      onEnterEditMode,
      onExitEditMode,
      onSave,
      onUpdate,
      parentTable,
      hideRelations1N,
      onSubRecordUpdate
    } = this.props;

    const cardTitle = buildCardTitle(row, tableName, tableConfig);
    const grantedIcon = getGrantedIcon(row.granted);

    return e('div', {
      className: 'modal-overlay-detail',
      onClick: this.handleOverlayClick
    },
      e('div', { className: 'modal-content-detail' },
        // Fixed header
        e('div', { className: 'modal-header-detail' },
          // Title section with granted selector
          e('div', { className: 'modal-title-section' },
            // Granted selector before title
            structure.fields.granted && e('div', {
              className: 'modal-granted-inline',
              onClick: (ev) => ev.stopPropagation()
            },
              e(GrantedSelector, {
                value: row.granted,
                publishableTo: tableConfig.publishableTo || [],
                tableGranted: tableConfig.granted || {},
                onChange: async (val) => {
                  try {
                    const response = await fetch(`/_api/${tableName}/${row.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ granted: val })
                    });
                    const data = await response.json();
                    if (data.success && onUpdate) {
                      // Pass the updated granted value to onUpdate
                      onUpdate({ granted: val });
                    }
                  } catch (error) {
                    console.error('Failed to save granted:', error);
                  }
                },
                disabled: !permissions.canPublish,
                compact: true
              })
            ),
            e('h3', {
              className: 'modal-title-detail'
            },
              cardTitle ? [
                cardTitle,
                e('a', {
                  key: 'subtitle',
                  className: 'modal-subtitle',
                  href: `/_crud/${tableName}/${row.id}`,
                  onClick: (e) => e.stopPropagation(),
                  title: 'Ouvrir dans une nouvelle page'
                }, ` 🔗 ${tableName}/${row.id}`)
              ] : e('a', {
                href: `/_crud/${tableName}/${row.id}`,
                onClick: (e) => e.stopPropagation(),
                title: 'Ouvrir dans une nouvelle page'
              }, `🔗 ${tableName}/${row.id}`)
            )
          ),
          // Action buttons section
          e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            // Actions menu (only show if not in edit mode and has permissions)
            !editMode && permissions && (permissions.canCreate || permissions.canRead) && e('div', {
              className: '_menu-dots',
              ref: this.menuRef,
              style: { position: 'relative' }
            },
              e('button', {
                className: 'btn btn-menu btn-icon three-dots',
                onClick: this.toggleDuplicateMenu,
                title: 'Actions',
                disabled: this.state.duplicating || this.state.notifying,
                style: {
                  cursor: (this.state.duplicating || this.state.notifying) ? 'wait' : 'pointer',
                }
              }, '⋮'),
              this.state.showDuplicateMenu && e('div',
                {
                  className: 'menu-dropdown open align-right',
                  style: { top: '100%', marginTop: '4px' }
                },
                // Notify option (only show if has read permission)
                permissions.canRead && e('button', {
                  className: 'menu-item',
                  onClick: () => {
                    this.setState({ showDuplicateMenu: false });
                    this.handleNotifyClick();
                  },
                  disabled: this.state.notifying
                }, this.state.notifying ? '⏳ Envoi...' : '📧 Notifier'),
                // Separator (only if both notify and duplicate options are visible)
                permissions.canRead && permissions.canCreate && e('div', {className: 'menu-divider divider' }),
                // Duplicate options (only show if has create permission)
                permissions.canCreate && e('button', { className: 'menu-item',onClick: this.handleDuplicate }, '📋 Dupliquer'),
                permissions.canCreate && e('button', { className: 'menu-item', onClick: this.handleDuplicateWithRelations }, '📋 Dupliquer avec relations...')
              )
            ),
            // Close button (X exits edit mode if in edit, otherwise closes modal)
            // Special case: if parentTable is set and in edit mode, close the entire modal
            // instead of going back to detail view (for sub-records)
            e('button', {
              className: 'btn btn-close modal-close-detail btn-icon',
              onClick: editMode ? (parentTable ? onClose : onExitEditMode) : onClose,
              title: editMode ? (parentTable ? 'Retour à la fiche parent' : 'Retour à la fiche') : 'Fermer (Echap)'
            }, '✖')
          )
        ),
        // Scrollable body
        e('div', { className: 'modal-body-detail' },
          loading
            ? e('div', { className: 'detail-loading' }, 'Chargement des détails...')
            : editMode
              ? e(EditForm, {
                  row,
                  structure,
                  tableName,
                  tableConfig,
                  permissions,
                  onClose: onExitEditMode,
                  onSave,
                  onUpdate,
                  focusFieldName,
                  parentTable,
                  hideRelations1N
                })
              : e(RowDetailView, {
                  row,
                  structure,
                  tableName,
                  permissions,
                  onEdit: onEnterEditMode,
                  parentTable,
                  hideRelations1N,
                  onSubRecordUpdate
                })
        )
      ),
      // Relation selector dialog
      this.state.showRelationSelector && (() => {
        // Build relations list for the selector
        const relations1N = [];

        if (structure.relations) {
          Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
            if (relationConfig.type === 'one-to-many') {
              const relData = (row._relations && row._relations[relationName]) || [];
              relations1N.push({
                name: relationName,
                label: relationName,
                count: Array.isArray(relData) ? relData.length : 0
              });
            }
          });
        }

        return e(RelationSelectorDialog, {
          tableName,
          rowId: row.id,
          relations: relations1N,
          onConfirm: this.handleConfirmDuplicateWithRelations,
          onCancel: this.handleCancelRelationSelector
        });
      })(),
      // Notify modal
      this.state.showNotifyModal && e(NotifyModal, {
        tableName,
        rowId: row.id,
        onConfirm: this.handleConfirmNotify,
        onCancel: this.handleCancelNotify
      })
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RowDetailModal;
}

// Export to global scope for use in crudList.js
window.RowDetailModal = RowDetailModal;
