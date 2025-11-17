/**
 * RelationSelectorDialog Component
 * Relation selector dialog for duplication with relations
 *
 * Allows users to select which 1:N relations to duplicate when duplicating a record.
 *
 * Features:
 * - Checkbox list for all available 1:N relations
 * - Show count of related records for each relation
 * - Select all / deselect all buttons
 * - Real-time selection tracking
 * - Modal overlay with click-outside to close
 *
 * Props:
 * - tableName: Name of the table being duplicated
 * - rowId: ID of the row being duplicated
 * - relations: Array of relation objects { name, count, label }
 * - onConfirm: Callback when user confirms (selectedRelationsArray)
 * - onCancel: Callback to close the dialog
 */

const e = React.createElement;

class RelationSelectorDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedRelations: new Set()
    };
  }

  toggleRelation = (relationName) => {
    this.setState(prev => {
      const newSet = new Set(prev.selectedRelations);
      if (newSet.has(relationName)) {
        newSet.delete(relationName);
      } else {
        newSet.add(relationName);
      }
      return { selectedRelations: newSet };
    });
  }

  selectAll = () => {
    const allRelations = this.props.relations.map(rel => rel.name);
    this.setState({ selectedRelations: new Set(allRelations) });
  }

  selectNone = () => {
    this.setState({ selectedRelations: new Set() });
  }

  confirm = () => {
    const relationsArray = Array.from(this.state.selectedRelations);
    this.props.onConfirm(relationsArray);
  }

  render() {
    const { relations, onCancel, tableName } = this.props;
    const { selectedRelations } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: onCancel
    },
      e('div', {
        className: 'modal-content',
        onClick: (ev) => ev.stopPropagation(),
        style: { maxWidth: '500px' }
      },
        e('div', { className: 'modal-header' },
          e('h3', null, 'Dupliquer avec relations'),
          e('button', {
            className: 'modal-close',
            onClick: onCancel
          }, '✖')
        ),
        e('div', { className: 'modal-body' },
          e('p', { style: { marginBottom: '16px', color: '#666' } },
            'Sélectionnez les relations à dupliquer :'
          ),

          relations.length > 0 ? [
            e('div', { key: 'actions', className: 'modal-actions', style: { marginBottom: '12px' } },
              e('button', {
                className: 'btn-select-all',
                onClick: this.selectAll,
                style: { fontSize: '12px', padding: '4px 8px' }
              }, 'Tout sélectionner'),
              e('button', {
                className: 'btn-select-none',
                onClick: this.selectNone,
                style: { fontSize: '12px', padding: '4px 8px' }
              }, 'Tout désélectionner')
            ),
            e('div', { key: 'list', className: 'field-list', style: { maxHeight: '300px', overflowY: 'auto' } },
              relations.map(relation => {
                const isSelected = selectedRelations.has(relation.name);

                return e('label', {
                  key: relation.name,
                  className: 'field-checkbox',
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee'
                  }
                },
                  e('input', {
                    type: 'checkbox',
                    checked: isSelected,
                    onChange: () => this.toggleRelation(relation.name),
                    style: { marginRight: '8px' }
                  }),
                  e('span', { style: { flex: 1 } }, relation.label || relation.name),
                  e('span', {
                    className: 'badge',
                    style: {
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }
                  }, relation.count)
                );
              })
            )
          ] : e('p', { style: { color: '#999', fontStyle: 'italic' } },
            'Aucune relation 1:N disponible pour cette table.'
          )
        ),
        e('div', { className: 'modal-footer' },
          e('button', {
            className: 'btn-cancel',
            onClick: onCancel
          }, 'Annuler'),
          e('button', {
            className: 'btn-apply',
            onClick: this.confirm,
            disabled: selectedRelations.size === 0 && relations.length > 0
          }, selectedRelations.size === 0 ? 'Dupliquer sans relations' : `Dupliquer avec ${selectedRelations.size} relation(s)`)
        )
      )
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RelationSelectorDialog;
}
