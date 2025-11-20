/**
 * CreateFormModal Component
 *
 * Modal form for creating new records with parent relationship handling.
 *
 * Features:
 * - Modal overlay with click-to-close
 * - Parent field auto-filling for 1:N relationships
 * - Default values support (e.g., from calendar)
 * - Calendar date range handling
 * - All field types support (text, date, enum, relation, etc.)
 * - Granted selector in header
 * - Auto-focus on first editable field
 * - Form reset after successful creation
 * - Success message display
 *
 * Dependencies:
 * - CalendarDateRangeTool (from /public/js/components/CalendarDateRangeTool.js)
 * - RelationAutocomplete (from /public/js/components/RelationAutocomplete.js)
 * - GrantedSelector (from /public/js/components/GrantedSelector.js)
 * - React (global)
 *
 * Props:
 * - tableName: Name of the table to create record in
 * - structure: Table structure definition
 * - tableConfig: Table configuration (from schema)
 * - permissions: User permissions object
 * - onClose: Callback when modal is closed
 * - onSuccess: Callback when record is created successfully (receives new record ID)
 * - parentTable: Parent table name (for 1:N creation)
 * - parentId: Parent record ID (for 1:N creation)
 * - defaultValues: Object with default field values (e.g., {startDate: '2025-11-16'})
 */


class CreateFormModal extends React.Component {
  constructor(props) {
    super(props);

    const { structure, parentTable, parentId, defaultValues } = props;

    // Initialize form data with default values
    const formData = {};
    Object.entries(structure.fields).forEach(([fieldName, field]) => {
      // Skip system fields and computed fields
      if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(fieldName)) {
        return;
      }
      if (field.as || field.calculate) {
        return;
      }

      // Set parent field if this is a 1:N creation
      if (parentTable && typeof parentTable === 'string' && parentId) {
        // Check if this field is a relation to the parent table
        if (field.relation === parentTable) {
          formData[fieldName] = parseInt(parentId);
        } else {
          // Fallback: check for exact match like "idOrganization" or "organizationId"
          const lowerField = fieldName.toLowerCase();
          const lowerParent = parentTable.toLowerCase();
          if (lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
            formData[fieldName] = parseInt(parentId);
          }
        }
      }

      // Set default values from URL parameters (e.g., startDate from calendar)
      if (defaultValues && defaultValues[fieldName] !== undefined) {
        formData[fieldName] = defaultValues[fieldName];
      }

      // Set default values based on field type
      if (!formData[fieldName] && formData[fieldName] !== 0) {
        if (field.type === 'boolean') {
          formData[fieldName] = false;
        } else if (field.type === 'integer') {
          formData[fieldName] = '';
        } else {
          formData[fieldName] = '';
        }
      }
    });

    // Set default granted value
    formData.granted = 'draft';

    this.state = {
      formData,
      saveStatus: 'idle', // idle, saving, saved, error
      errors: {},
      newRecordId: null, // Will be set after first auto-creation
      createdRecordId: null, // Track if record has been created
      fullscreenField: null // Track which field is being edited in fullscreen (null = no fullscreen)
    };

    this.fieldRefs = {};
    this.saveTimeout = null;
    this.autosaveDelay = SCHEMA_CONFIG?.autosave || 500;
  }

  componentDidMount() {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Auto-focus first editable field
    const { structure, parentTable } = this.props;
    const editableFields = Object.keys(structure.fields).filter(f => {
      const field = structure.fields[f];
      if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)) return false;
      if (field.as || field.calculate) return false;
      // Skip parent field if this is a 1:N creation
      if (this.isParentField(f)) {
        return false;
      }
      return true;
    });

    if (editableFields.length > 0 && this.fieldRefs[editableFields[0]]) {
      setTimeout(() => {
        this.fieldRefs[editableFields[0]].focus();
      }, 100);
    }
  }

  componentWillUnmount() {
    // Restore body scroll
    document.body.style.overflow = '';

    // Clear any pending saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  isParentField(fieldName) {
    const { parentTable, structure } = this.props;
    if (!parentTable) return false;

    // Check if this field is actually a foreign key relation to the parent table
    if (structure && structure.fields && structure.fields[fieldName]) {
      const field = structure.fields[fieldName];
      // Only filter if it's a relation field pointing to the parent table
      if (field.relation === parentTable) {
        return true;
      }
    }

    // Fallback: check for exact match like "idOrganization" for "Organization"
    // but NOT partial matches like "organizationRole"
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField === `id${lowerParent}` || lowerField === `${lowerParent}id`;
  }

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onClose();
    }
  }

  handleFieldChange = (fieldName, value) => {
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        [fieldName]: value
      },
      saveStatus: 'idle'
    }));

    // Auto-create or auto-save with debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      if (this.state.createdRecordId) {
        // Record already exists, do autosave
        this.autoSaveField(fieldName, value);
      } else {
        // First input, create the record
        this.autoCreateRecord();
      }
    }, this.autosaveDelay);
  }

  autoCreateRecord = async () => {
    const { tableName, onSuccess } = this.props;
    const { formData } = this.state;

    this.setState({ saveStatus: 'saving' });

    try {
      const response = await fetch(`/_api/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Mark that this is the first creation (not a subsequent save)
        this.isFirstCreation = true;

        this.setState({
          saveStatus: 'saved',
          createdRecordId: data.id,
          newRecordId: data.id,
          errors: {}
        });

        // Call onSuccess to refresh parent list
        if (onSuccess) {
          onSuccess(data.id);
        }

        // Hide success indicator after 2 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
          this.isFirstCreation = false; // Reset flag after showing message
        }, 2000);
      } else {
        this.setState({ saveStatus: 'error', errors: { _general: data.error } });
      }
    } catch (error) {
      console.error('Auto-create error:', error);
      this.setState({ saveStatus: 'error', errors: { _general: error.message } });
    }
  }

  autoSaveField = async (fieldName, value) => {
    const { tableName } = this.props;
    const { createdRecordId } = this.state;

    this.setState({ saveStatus: 'saving' });

    try {
      const response = await fetch(`/_api/${tableName}/${createdRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: value })
      });

      const data = await response.json();

      if (data.success) {
        this.setState({ saveStatus: 'saved', errors: {} });

        // Hide success indicator after 2 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 2000);
      } else {
        this.setState({ saveStatus: 'error', errors: { [fieldName]: data.error } });
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      this.setState({ saveStatus: 'error', errors: { [fieldName]: error.message } });
    }
  }

  handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const { tableName, onSuccess } = this.props;
    const { formData } = this.state;

    this.setState({ saveStatus: 'saving' });

    try {
      const response = await fetch(`/_api/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Show success message and keep modal open for creating another record
        this.setState({ saveStatus: 'success', newRecordId: data.id });

        // Call onSuccess to refresh parent list
        if (onSuccess) {
          onSuccess(data.id);
        }

        // Reset form after 1 second
        setTimeout(() => {
          // Reset form data but keep parent field if it exists
          const { structure, parentTable, parentId } = this.props;
          const formData = {};

          Object.keys(structure.fields).forEach((fieldName) => {
            const field = structure.fields[fieldName];

            if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(fieldName)) {
              return;
            }
            if (field.as || field.calculate) {
              return;
            }

            // Re-set parent field if this is a 1:N creation
            if (parentTable && typeof parentTable === 'string' && parentId) {
              // Check if this field is a relation to the parent table
              if (field.relation === parentTable) {
                formData[fieldName] = parseInt(parentId);
                return;
              }
              // Fallback: check for exact match like "idOrganization" or "organizationId"
              const lowerField = fieldName.toLowerCase();
              const lowerParent = parentTable.toLowerCase();
              if (lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
                formData[fieldName] = parseInt(parentId);
                return;
              }
            }

            // Reset to default values
            if (field.type === 'boolean') {
              formData[fieldName] = false;
            } else {
              formData[fieldName] = '';
            }
          });

          // Reset granted to draft
          formData.granted = 'draft';

          this.setState({
            formData,
            saveStatus: 'idle',
            errors: {},
            newRecordId: null
          });
        }, 1000);
      } else {
        this.setState({ saveStatus: 'error', errors: { _general: data.error } });
      }
    } catch (error) {
      console.error('Create error:', error);
      this.setState({ saveStatus: 'error', errors: { _general: error.message } });
    }
  }

  handleDateRangeChange = (startFieldName, endFieldName, startValue, endValue) => {
    // Update both fields at once
    this.setState(prev => ({
      formData: {
        ...prev.formData,
        [startFieldName]: startValue,
        [endFieldName]: endValue
      },
      saveStatus: 'idle'
    }));

    // Auto-create or auto-save with debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      if (this.state.createdRecordId) {
        // Record already exists, save both fields
        this.autoSaveDateRange(startFieldName, endFieldName, startValue, endValue);
      } else {
        // First input, create the record
        this.autoCreateRecord();
      }
    }, this.autosaveDelay);
  }

  autoSaveDateRange = async (startFieldName, endFieldName, startValue, endValue) => {
    const { tableName } = this.props;
    const { createdRecordId } = this.state;

    this.setState({ saveStatus: 'saving' });

    try {
      const response = await fetch(`/_api/${tableName}/${createdRecordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [startFieldName]: startValue,
          [endFieldName]: endValue
        })
      });

      const data = await response.json();

      if (data.success) {
        this.setState({ saveStatus: 'saved', errors: {} });

        // Hide success indicator after 2 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 2000);
      } else {
        this.setState({ saveStatus: 'error', errors: { _general: data.error } });
      }
    } catch (error) {
      console.error('Auto-save date range error:', error);
      this.setState({ saveStatus: 'error', errors: { _general: error.message } });
    }
  }

  renderField = (fieldName, field) => {
    const { formData, errors } = this.state;
    const { structure, tableConfig, permissions, parentTable } = this.props;
    const value = formData[fieldName];
    const label = field.label || fieldName;

    // Skip computed fields
    if (field.as || field.calculate) {
      return null;
    }

    // Hide parent field if this is a 1:N creation (it's pre-filled and hidden)
    if (this.isParentField(fieldName)) {
      return null; // Hidden field
    }

    // Check if this table has calendar configuration
    if (tableConfig.calendar) {
      const startDateField = tableConfig.calendar.startDate || 'startDate';
      const endDateField = tableConfig.calendar.endDate || 'endDate';

      // If this is the startDate field, render the CalendarDateRangeTool
      if (fieldName === startDateField) {
        const startValue = formData[startDateField];
        const endValue = formData[endDateField];
        const startFieldDef = structure.fields[startDateField];
        const endFieldDef = structure.fields[endDateField];

        return e('div', { key: 'calendar-date-range', className: 'calendar-date-range-wrapper' },
          e(CalendarDateRangeTool, {
            startValue: startValue,
            endValue: endValue,
            startLabel: startFieldDef?.label || startDateField,
            endLabel: endFieldDef?.label || endDateField,
            onChangeRange: (newStartValue, newEndValue) => {
              this.handleDateRangeChange(startDateField, endDateField, newStartValue, newEndValue);
            }
          })
        );
      }

      // If this is the endDate field, skip it (already handled by CalendarDateRangeTool)
      if (fieldName === endDateField) {
        return null;
      }
    }

    // Check if this is a relation
    if (field.relation) {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label),
        e(RelationAutocomplete, {
          fieldName: fieldName,
          relatedTable: field.relation,
          value: null,
          currentId: value,
          onChange: (id, item) => this.handleFieldChange(fieldName, id),
          canCreate: permissions.canCreate,
          onAddNew: () => {
            window.open(`/_crud/${field.relation}`, '_blank');
          },
          ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
        })
      );
    }

    // Skip granted field (now in header)
    if (fieldName === 'granted') {
      return null;
    }

    // Special handling for image fields (not supported during creation)
    if (field.renderer === 'image') {
      return e('div', { key: fieldName, className: 'edit-field field-image-create' },
        e('label', { className: 'edit-field-label' }, label),
        e('div', {
          className: 'create-image-notice',
          style: {
            padding: '16px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#856404'
          }
        },
          e('span', { style: { marginRight: '8px' } }, 'ℹ️'),
          'Vous pourrez ajouter une image après la création de l\'enregistrement.'
        )
      );
    }

    // Render based on field type
    switch (field.type) {
      case 'text':
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('div', { className: 'textarea-with-fullscreen' },
            e('textarea', {
              className: 'edit-field-textarea',
              value: value || '',
              onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
              ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
            }),
            e('button', {
              className: 'btn-fullscreen-edit',
              onClick: () => this.setState({ fullscreenField: fieldName }),
              type: 'button',
              title: 'Ouvrir en plein écran'
            }, '⛶')
          ),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      case 'enum':
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('select', {
            className: 'edit-field-select',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          },
            e('option', { value: '' }, '-- Sélectionner --'),
            field.values && field.values.map(val =>
              e('option', { key: val, value: val }, val)
            )
          ),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      case 'boolean':
      case 'integer':
        const inputType = field.type === 'boolean' ? 'checkbox' : 'number';
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('input', {
            type: inputType,
            className: 'edit-field-input',
            [inputType === 'checkbox' ? 'checked' : 'value']: inputType === 'checkbox' ? !!value : (value || ''),
            onChange: (e) => this.handleFieldChange(
              fieldName,
              inputType === 'checkbox' ? e.target.checked : e.target.value
            ),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      case 'date':
      case 'datetime':
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('input', {
            type: field.type === 'datetime' ? 'datetime-local' : 'date',
            className: 'edit-field-input',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      default:
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('input', {
            type: 'text',
            className: 'edit-field-input',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );
    }
  }

  render() {
    const { tableName, structure, tableConfig, permissions, onClose, parentTable } = this.props;
    const { saveStatus, errors, createdRecordId, fullscreenField, formData } = this.state;

    // Get editable fields (exclude system fields, granted, and parent field in sub-lists)
    const editableFields = Object.keys(structure.fields).filter(f => {
      if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)) return false;
      const field = structure.fields[f];
      if (field.as || field.calculate) return false;
      // Hide parent field if this is a 1:N creation
      if (this.isParentField(f)) {
        return false;
      }
      return true;
    });

    return e('div', {
      className: 'modal-overlay-detail',
      onClick: this.handleOverlayClick
    },
      // Fullscreen text editor modal
      fullscreenField && e(FullscreenTextEditor, {
        fieldName: fullscreenField,
        value: formData[fullscreenField],
        label: structure.fields[fullscreenField]?.label || fullscreenField,
        isMarkdown: structure.fields[fullscreenField]?.renderer === 'markdown',
        onSave: (newValue) => {
          this.handleFieldChange(fullscreenField, newValue);
        },
        onClose: () => this.setState({ fullscreenField: null })
      }),

      e('div', { className: 'modal-content-detail' },
        // Fixed header with granted selector
        e('div', { className: 'modal-header-detail' },
          e('div', { className: 'modal-title-section' },
            // Granted selector before title
            e('div', {
              className: 'modal-granted-inline',
              onClick: (ev) => ev.stopPropagation()
            },
              e(GrantedSelector, {
                value: this.state.formData.granted,
                publishableTo: tableConfig.publishableTo || [],
                tableGranted: tableConfig.granted || {},
                onChange: (val) => this.handleFieldChange('granted', val),
                disabled: !permissions.canPublish,
                compact: true
              })
            ),
            e('h3', { className: 'modal-title-detail' },
              `Nouvelle fiche ${tableName}`,
              parentTable && typeof parentTable === 'string' && e('span', { key: 'parent', className: 'modal-subtitle' }, ` (liée à ${parentTable})`)
            )
          ),
          // Close button
          e('button', {
            className: 'modal-close-detail',
            onClick: onClose,
            title: 'Fermer (Echap)'
          }, '✖')
        ),

        // Scrollable body
        e('div', { className: 'modal-body-detail' },
          e('form', {
            className: 'edit-form',
            onSubmit: this.handleSubmit
          },
            // General error
            errors._general && e('div', { className: 'error' }, errors._general),

            // Save indicator (fixed in top-right corner, like EditForm)
            saveStatus !== 'idle' && e('div', {
              style: {
                position: 'fixed',
                top: '80px',
                right: '20px',
                padding: '10px 16px',
                background: saveStatus === 'saved' ? '#d4edda' : (saveStatus === 'error' ? '#f8d7da' : '#d1ecf1'),
                color: saveStatus === 'saved' ? '#155724' : (saveStatus === 'error' ? '#721c24' : '#0c5460'),
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                fontSize: '14px',
                fontWeight: '500',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            },
              saveStatus === 'saving' && e('span', null, '💾 Enregistrement...'),
              saveStatus === 'saved' && e('span', null, this.isFirstCreation ? '✅ Fiche créée !' : '✅ Enregistré'),
              saveStatus === 'error' && e('span', null, '❌ Erreur')
            ),

            // Form fields grid
            e('div', { className: 'edit-form-grid' },
              editableFields.map((fieldName) => {
                const field = structure.fields[fieldName];
                return this.renderField(fieldName, field);
              })
            ),

            // Submit button (only show before record is created, for backwards compatibility)
            e('div', { style: { marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              // Only show "Annuler" if record hasn't been created yet, otherwise show "Fermer"
              e('button', {
                type: 'button',
                className: 'btn-cancel',
                onClick: onClose
              }, createdRecordId ? 'Fermer' : 'Annuler'),
              // Hide the "Créer" button after record is auto-created
              !createdRecordId && e('button', {
                type: 'submit',
                className: 'btn-apply',
                disabled: saveStatus === 'saving',
                style: { opacity: 0.5 }
              }, 'Créer (ou tapez pour auto-créer)')
            )
          )
        )
      )
    );
  }
}

// Export to global scope for use in crudList.js
window.CreateFormModal = CreateFormModal;
