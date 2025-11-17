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

const e = React.createElement;

class RowDetailModal extends React.Component {
  componentDidMount() {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  componentWillUnmount() {
    // Restore body scroll
    document.body.style.overflow = '';
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
      hideRelations1N
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
          // Close button (X exits edit mode if in edit, otherwise closes modal)
          e('button', {
            className: 'modal-close-detail',
            onClick: editMode ? onExitEditMode : onClose,
            title: editMode ? 'Retour à la fiche' : 'Fermer (Echap)'
          }, '✖')
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
                  hideRelations1N
                })
        )
      )
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RowDetailModal;
}
