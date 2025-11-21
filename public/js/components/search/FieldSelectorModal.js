/**
 * FieldSelectorModal Component
 * Column visibility selector modal
 *
 * Allows users to customize which columns are displayed in the table view.
 *
 * Features:
 * - Checkbox list for all available fields
 * - Select all / deselect all buttons
 * - Real-time selection tracking
 * - Modal overlay with click-outside to close
 *
 * Props:
 * - allFields: Array of all available field names
 * - selectedFields: Array of currently selected field names
 * - structure: Table structure object (with fields definitions)
 * - onApply: Callback when user applies selection (fieldsArray)
 * - onClose: Callback to close the modal
 */


class FieldSelectorModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedFields: props.selectedFields ? new Set(props.selectedFields) : new Set(props.allFields)
    };
  }

  toggleField = (fieldName) => {
    this.setState(prev => {
      const newSet = new Set(prev.selectedFields);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return { selectedFields: newSet };
    });
  }

  selectAll = () => {
    this.setState({ selectedFields: new Set(this.props.allFields) });
  }

  selectNone = () => {
    this.setState({ selectedFields: new Set() });
  }

  apply = () => {
    const fieldsArray = Array.from(this.state.selectedFields);
    this.props.onApply(fieldsArray);
    this.props.onClose();
  }

  render() {
    const { allFields, structure, onClose } = this.props;
    const { selectedFields } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: onClose
    },
      e('div', {
        className: 'modal-content',
        onClick: (ev) => ev.stopPropagation()
      },
        e('div', { className: 'modal-header' },
          e('h3', null, 'Sélectionner les champs à afficher'),
          e('button', {
            className: 'btn btn-close  btn-icon',
            onClick: onClose
          }, '✖')
        ),
        e('div', { className: 'modal-body' },
          e('div', { className: 'modal-actions' },
            e('button', {
              className: 'btn btn-select-all btn btn-secondary',
              onClick: this.selectAll
            }, 'Tout sélectionner'),
            e('button', {
              className: 'btn btn-select-none btn btn-secondary',
              onClick: this.selectNone
            }, 'Tout désélectionner')
          ),
          e('div', { className: 'field-list' },
            allFields.map(fieldName => {
              const field = structure.fields[fieldName];
              const label = field?.label || fieldName;
              const isSelected = selectedFields.has(fieldName);

              return e('label', {
                key: fieldName,
                className: 'field-checkbox'
              },
                e('input', {
                  type: 'checkbox',
                  checked: isSelected,
                  onChange: () => this.toggleField(fieldName)
                }),
                e('span', null, label)
              );
            })
          )
        ),
        e('div', { className: 'modal-footer' },
          e('button', {
            className: 'btn btn-cancel btn btn-secondary',
            onClick: onClose
          }, 'Annuler'),
          e('button', {
            className: 'btn btn-apply btn btn-primary',
            onClick: this.apply
          }, 'Appliquer')
        )
      )
    );
  }
}

// Export to global scope for use in crudList.js
window.FieldSelectorModal = FieldSelectorModal;
