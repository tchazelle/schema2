/**
 * EditForm Component
 *
 * Full inline edit form with auto-save functionality for editing existing records.
 *
 * Features:
 * - Auto-save on field change with debouncing
 * - Field-level dirty tracking
 * - Support for all field types (text, date, enum, relation, etc.)
 * - Calendar date range handling
 * - Computed and readonly field support
 * - 1:N relation management with expand/collapse
 * - Attachments management
 * - Auto-focus on specified field
 *
 * Dependencies:
 * - CalendarDateRangeTool (from /public/js/components/CalendarDateRangeTool.js)
 * - RelationAutocomplete (from /public/js/components/RelationAutocomplete.js)
 * - GrantedSelector (from /public/js/components/GrantedSelector.js)
 * - SubList (from /public/js/components/SubList.js)
 * - AttachmentsTab (from /public/js/components/AttachmentsTab.js)
 * - SCHEMA_CONFIG (global variable)
 * - React (global)
 *
 * Props:
 * - structure: Table structure definition
 * - row: Record data to edit
 * - tableName: Name of the table
 * - tableConfig: Table configuration (from schema)
 * - permissions: User permissions object
 * - onClose: Callback when form is closed
 * - onSave: Callback when field is saved (receives {fieldName: value})
 * - onUpdate: Callback to refresh the list
 * - hideRelations1N: Boolean to hide 1:N relations
 * - parentTable: Parent table name (for sub-lists)
 * - focusFieldName: Field name to auto-focus on mount
 */


class EditForm extends React.Component {
  constructor(props) {
    super(props);
    const { row } = props;

    // Initialize form data from row
    const formData = {};
    Object.keys(row).forEach(key => {
      if (!key.startsWith('_') && key !== 'id') {
        formData[key] = row[key];
      }
    });

    // Keep _relations for relation autocomplete
    if (row._relations) {
      formData._relations = row._relations;
    }

    this.state = {
      formData: formData,
      originalRow: row,
      saveStatus: 'idle', // idle, saving, saved, error
      errors: {},
      openRelations: new Set(), // Track which 1:n relations are expanded
      dirtyFields: new Set(), // Track which fields have been modified
      showAttachments: true, // Track if attachments section is expanded (open by default)
      attachmentCount: 0 // Track number of attachments
    };

    this.saveTimeout = null;
    this.autosaveDelay = SCHEMA_CONFIG?.autosave || 500;
    this.fieldRefs = {};
    this.pendingSaves = new Map(); // Track pending saves per field
  }

  async componentDidMount() {
    // Open "Strong" relations by default, keep "Weak" relations closed
    const { structure } = this.props;
    const strongRelations = new Set();

    if (structure && structure.fields) {
      Object.entries(structure.fields).forEach(([fieldName, field]) => {
        if (field.arrayName && field.relationshipStrength === 'Strong') {
          strongRelations.add(field.arrayName);
        }
      });
    }

    this.setState({ openRelations: strongRelations });

    // Load attachment count
    await this.loadAttachmentCount();

    // Auto-focus the specified field or first editable field
    const { focusFieldName } = this.props;

    if (focusFieldName && this.fieldRefs[focusFieldName]) {
      setTimeout(() => {
        this.fieldRefs[focusFieldName].focus();
      }, 100);
    } else {
      // Find first editable, non-computed field
      const editableFields = Object.keys(structure.fields).filter(f => {
        const field = structure.fields[f];
        return !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f) &&
               !field.as && !field.calculate;
      });

      if (editableFields.length > 0 && this.fieldRefs[editableFields[0]]) {
        setTimeout(() => {
          this.fieldRefs[editableFields[0]].focus();
        }, 100);
      }
    }
  }

  componentWillUnmount() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }

  loadAttachmentCount = async () => {
    const { tableName, row } = this.props;
    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/attachments`);
      const data = await response.json();
      if (data.success) {
        this.setState({ attachmentCount: data.attachments?.length || 0 });
      }
    } catch (error) {
      console.error('Error loading attachment count:', error);
    }
  }

  handleFieldChange = (fieldName, value) => {
    this.setState(prev => {
      const newDirtyFields = new Set(prev.dirtyFields);
      newDirtyFields.add(fieldName);

      return {
        formData: {
          ...prev.formData,
          [fieldName]: value
        },
        saveStatus: 'idle',
        dirtyFields: newDirtyFields
      };
    });

    // Auto-save this specific field with debounce
    // Cancel any pending save for this field
    if (this.pendingSaves.has(fieldName)) {
      clearTimeout(this.pendingSaves.get(fieldName));
    }

    // Schedule save for this field
    const timeoutId = setTimeout(() => {
      this.saveField(fieldName, value);
    }, this.autosaveDelay);

    this.pendingSaves.set(fieldName, timeoutId);
  }

  saveField = async (fieldName, value) => {
    const { tableName, row } = this.props;

    this.setState({ saveStatus: 'saving' });

    try {
      // Send only the changed field
      const dataToSend = { [fieldName]: value };


      const response = await fetch(`/_api/${tableName}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (data.success) {
        this.setState(prev => {
          const newDirtyFields = new Set(prev.dirtyFields);
          newDirtyFields.delete(fieldName);

          return {
            saveStatus: 'saved',
            dirtyFields: newDirtyFields
          };
        });

        // Reset to idle after 2 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 2000);

        // Notify parent of successful save (only send changed field to avoid full re-render)
        if (this.props.onSave) {
          this.props.onSave({ [fieldName]: value });
        }

        // Refresh the list to show the updated data
        if (this.props.onUpdate) {
          this.props.onUpdate();
        }

        // Clear pending save
        this.pendingSaves.delete(fieldName);
      } else {
        this.setState({ saveStatus: 'error', errors: { [fieldName]: data.error } });
      }
    } catch (error) {
      console.error(`Save error for field ${fieldName}:`, error);
      this.setState({ saveStatus: 'error', errors: { [fieldName]: error.message } });
    }
  }

  // Legacy method for compatibility (in case it's called elsewhere)
  saveChanges = async () => {
    const { dirtyFields } = this.state;

    // Save all dirty fields
    for (const fieldName of dirtyFields) {
      await this.saveField(fieldName, this.state.formData[fieldName]);
    }
  }

  handleDateRangeChange = (startFieldName, endFieldName, startValue, endValue) => {
    // Update both fields at once
    this.setState(prev => {
      const newDirtyFields = new Set(prev.dirtyFields);
      newDirtyFields.add(startFieldName);
      newDirtyFields.add(endFieldName);

      return {
        formData: {
          ...prev.formData,
          [startFieldName]: startValue,
          [endFieldName]: endValue
        },
        saveStatus: 'idle',
        dirtyFields: newDirtyFields
      };
    });

    // Auto-save both fields
    const timeoutId = setTimeout(() => {
      this.saveField(startFieldName, startValue);
      this.saveField(endFieldName, endValue);
    }, this.autosaveDelay);

    this.pendingSaves.set(startFieldName, timeoutId);
    this.pendingSaves.set(endFieldName, timeoutId);
  }

  renderField = (fieldName, field) => {
    const { formData, errors } = this.state;
    const { structure, tableConfig, permissions } = this.props;
    const value = formData[fieldName];

    // Special handling for _dateRange virtual field
    if (fieldName === '_dateRange' && tableConfig.calendar) {
      const startDateField = tableConfig.calendar.startDate || 'startDate';
      const endDateField = tableConfig.calendar.endDate || 'endDate';
      const startValue = formData[startDateField];
      const endValue = formData[endDateField];
      const startFieldDef = structure.fields[startDateField];
      const endFieldDef = structure.fields[endDateField];

      // Build precise calendar link from startValue
      let calendarUrl = '/_calendar';
      if (startValue) {
        const startDate = new Date(startValue);
        if (!isNaN(startDate.getTime())) {
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          calendarUrl = `/_calendar/${year}/${month}`;
        }
      }

      return e('div', { key: '_dateRange', className: 'edit-field' },
        e('label', {
          className: 'edit-field-label',
          style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
          onClick: () => {
            // Focus on the startDate field when clicking the label
            const startDateInput = this.fieldRefs[startDateField];
            if (startDateInput && startDateInput.focus) {
              startDateInput.focus();
            }
          }
        },
          'Période',
          ' ',
          e('a', {
            href: calendarUrl,
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Voir le calendrier',
            style: { fontSize: '1.2em', textDecoration: 'none', marginLeft: '5px' }
          }, '📅'),
          e('span', { style: { fontSize: '10px', color: '#6c757d', fontWeight: 400 } }, '(cliquer pour modifier)')
        ),
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

    const label = field.label || fieldName;

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

    // Show computed fields as readonly
    if (field.as || field.calculate) {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label, ' ', e('span', { style: { fontSize: '10px', color: '#6c757d', fontWeight: 400 } }, '(calculé)')),
        e('input', {
          type: 'text',
          className: 'edit-field-input',
          value: value || '',
          readOnly: true,
          disabled: true,
          style: { background: '#e9ecef', cursor: 'not-allowed' }
        })
      );
    }

    // Show readonly fields as readonly
    if (field.readonly) {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label, ' ', e('span', { style: { fontSize: '10px', color: '#6c757d', fontWeight: 400 } }, '(lecture seule)')),
        e('input', {
          type: 'text',
          className: 'edit-field-input',
          value: value || '',
          readOnly: true,
          disabled: true,
          style: { background: '#e9ecef', cursor: 'not-allowed' }
        })
      );
    }

    // Check if this is a relation
    if (field.relation) {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label),
        e(RelationAutocomplete, {
          fieldName: fieldName,
          relatedTable: field.relation,
          value: formData._relations && formData._relations[fieldName],
          currentId: value, // Pass the current ID of the related record
          onChange: (id, item) => this.handleFieldChange(fieldName, id),
          canCreate: permissions.canCreate,
          onAddNew: () => {
            // Open new window to create related record
            window.open(`/_crud/${field.relation}`, '_blank');
          },
          ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
        })
      );
    }

    // Special handling for granted field
    if (fieldName === 'granted') {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label),
        e(GrantedSelector, {
          value: value,
          publishableTo: tableConfig.publishableTo || [],
          tableGranted: tableConfig.granted || {},
          onChange: (val) => this.handleFieldChange(fieldName, val),
          disabled: !permissions.canPublish,
          compact: true
        })
      );
    }

    // Check if field is markdown to apply full-width class
    const isMarkdown = field && (field.renderer === 'markdown' || field.type === 'markdown');
    const fieldClasses = isMarkdown ? 'edit-field field-markdown' : 'edit-field';

    // Render based on field type
    switch (field.type) {
      case 'text':
        return e('div', { key: fieldName, className: fieldClasses },
          e('label', { className: 'edit-field-label' }, label),
          e('textarea', {
            className: 'edit-field-textarea',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      case 'enum':
        return e('div', { key: fieldName, className: fieldClasses },
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
        return e('div', { key: fieldName, className: fieldClasses },
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
        return e('div', { key: fieldName, className: fieldClasses },
          e('label', { className: 'edit-field-label' }, label),
          e('input', {
            type: field.type === 'datetime' ? 'datetime-local' : 'date',
            className: 'edit-field-input',
            value: value ? this.formatDateForInput(value, field.type) : '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value),
            ref: (el) => { if (el) this.fieldRefs[fieldName] = el; }
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      default:
        return e('div', { key: fieldName, className: fieldClasses },
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

  formatDateForInput = (value, type) => {
    if (!value) return '';

    // Parse date as STRING to avoid timezone conversion
    // MySQL returns dates as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
    if (type === 'datetime') {
      // Parse "2025-11-16 16:00:00" or "2025-11-16T16:00:00"
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hours, minutes] = match;
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    } else {
      // Parse "2025-11-16"
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${year}-${month}-${day}`;
      }
    }

    // Fallback to original value if parsing fails
    return String(value);
  }

  getSaveIndicatorText = () => {
    const { saveStatus } = this.state;
    switch (saveStatus) {
      case 'saving': return '💾 Sauvegarde...';
      case 'saved': return '✅ Sauvegardé';
      case 'error': return '❌ Erreur';
      default: return '';
    }
  }

  isParentField(fieldName) {
    const { parentTable } = this.props;
    if (!parentTable) return false;

    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${lowerParent}`;
  }

  toggleRelation = (relName) => {
    this.setState(prev => {
      const newSet = new Set(prev.openRelations);
      if (newSet.has(relName)) {
        newSet.delete(relName);
      } else {
        newSet.add(relName);
      }
      return { openRelations: newSet };
    });
  }

  render() {
    const { structure, onClose, row, tableName, tableConfig, permissions, hideRelations1N = false, parentTable } = this.props;
    const { saveStatus, errors, formData, openRelations, showAttachments, attachmentCount } = this.state;

    // Get calendar config from structure if available
    const hasCalendar = structure.calendar;
    const startDateField = hasCalendar ? (structure.calendar.startDate || 'startDate') : null;
    const endDateField = hasCalendar ? (structure.calendar.endDate || 'endDate') : null;

    // First pass: collect all fields and track startDate position
    let startDateIndex = -1;
    const rawFields = Object.keys(structure.fields);

    // Find the position of startDate in the original field order
    if (hasCalendar && startDateField) {
      startDateIndex = rawFields.indexOf(startDateField);
    }

    // Get editable fields (exclude system fields, id, granted, relations arrays, and parent fields in sub-lists)
    // Also filter out startDate and endDate if table has calendar (they will be replaced by _dateRange)
    const editableFields = rawFields.filter(f => {
      // Filter out system fields
      if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)) {
        return false;
      }
      // Filter out parent fields
      if (this.isParentField(f)) {
        return false;
      }
      // Filter out startDate and endDate if table has calendar (they will be replaced by _dateRange)
      if (hasCalendar && (f === startDateField || f === endDateField)) {
        return false;
      }
      return true;
    });

    // Add _dateRange at the position where startDate was (substitution)
    if (hasCalendar && !editableFields.includes('_dateRange')) {
      // Calculate the adjusted index after filtering
      // Count how many fields before startDate were filtered out
      let adjustedIndex = 0;
      if (startDateIndex > 0) {
        for (let i = 0; i < startDateIndex; i++) {
          const f = rawFields[i];
          if (!['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f) && !this.isParentField(f)) {
            adjustedIndex++;
          }
        }
      }
      editableFields.splice(adjustedIndex, 0, '_dateRange');
    }

    // Extract 1:N relations (only if not hidden)
    const relations1N = [];
    if (!hideRelations1N) {
      // Get all defined 1:N relations from structure.relations (preferred method)
      if (structure.relations) {
        Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
          if (relationConfig.type === 'one-to-many') {
            // Check if data exists in row._relations, otherwise use empty array
            const relData = (row._relations && row._relations[relationName]) || [];

            relations1N.push({
              name: relationName,
              data: Array.isArray(relData) ? relData : [],
              relatedTable: relationConfig.relatedTable,
              relationshipStrength: relationConfig.relationshipStrength
            });
          }
        });
      }

      // Also include any 1:N relations from row._relations not yet in relations1N
      if (row._relations) {
        Object.entries(row._relations).forEach(([key, value]) => {
          if (Array.isArray(value) && !relations1N.find(r => r.name === key)) {
            relations1N.push({
              name: key,
              data: value,
              relatedTable: value[0]?._table || key,
              relationshipStrength: 'Weak'
            });
          }
        });
      }
    }

    return e('div', { className: 'edit-form' },
      // General error
      errors._general && e('div', { className: 'error' }, errors._general),

      // Save indicator (if not idle) - positioned in top-right corner
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
          animation: 'fadeInSlide 0.3s ease-out',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      }, this.getSaveIndicatorText()),

      // Form fields grid
      e('div', { className: 'edit-form-grid' },
        editableFields.map((fieldName) => {
          const field = structure.fields[fieldName];
          return this.renderField(fieldName, field);
        })
      ),

      // 1:N Relations
      relations1N.length > 0 && e('div', { className: 'edit-form-relations-1n' },
        relations1N.map((relation) => {
          const relName = relation.name;
          const relRows = relation.data;
          const relatedTable = relation.relatedTable;
          const isOpen = openRelations.has(relName);
          const count = relRows.length;

          return e('div', { key: relName, className: 'relation-section' },
            e('div', {
              className: 'relation-header',
              style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }
            },
              // Left side: toggle, name, badge (clickable to toggle)
              e('div', {
                style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 },
                onClick: () => this.toggleRelation(relName)
              },
                e('span', { className: 'relation-toggle' }, isOpen ? '▼' : '▶'),
                e('strong', null, relName),
                count > 0 && e('span', { className: 'relation-count badge' }, count),
                // Add calendar icon if related table has calendar configuration
                (() => {
                  const relatedTableConfig = SCHEMA_CONFIG?.tables?.[relatedTable];
                  if (relatedTableConfig?.calendar) {
                    return e('a', {
                      href: '/_calendar',
                      onClick: (ev) => ev.stopPropagation(),
                      className: 'field-icon-link',
                      title: 'Voir le calendrier',
                      style: { marginLeft: '4px', fontSize: '0.9em', textDecoration: 'none' }
                    }, '📅');
                  }
                  return null;
                })()
              ),
              // Right side: "+ ajouter" button
              e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                e('button', {
                  className: 'btn-add-relation-item',
                  onClick: (ev) => {
                    ev.stopPropagation();
                    window.open(`/_crud/${relatedTable}?parent=${tableName}&parentId=${row.id}`, '_blank');
                  },
                  title: count === 0 ? `Créer la première fiche ${relatedTable}` : `Ajouter un ${relatedTable}`
                }, count === 0 ? '+ Créer la première fiche' : '+ Ajouter')
              )
            ),
            isOpen && e('div', { className: 'relation-list' },
              e(SubList, {
                rows: relRows,
                tableName: relatedTable,
                parentTable: tableName,
                parentId: row.id,
                relationName: relName,
                hideHeader: false
              })
            )
          );
        })
      ),

      // Attachments section (only shown if hasAttachmentsTab is true)
      (tableConfig?.hasAttachmentsTab !== false) && e('div', { className: 'edit-form-attachments-section' },
        e('div', {
          className: 'relation-header',
          style: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }
        },
          e('div', {
            style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 },
            onClick: () => this.setState(prev => ({ showAttachments: !prev.showAttachments }))
          },
            e('span', { className: 'relation-toggle' }, showAttachments ? '▼' : '▶'),
            e('strong', null, 'Pièces jointes'),
            (attachmentCount > 0) && e('span', { className: 'relation-count badge' }, attachmentCount)
          )
        ),
        showAttachments && e(AttachmentsTab, {
          tableName: tableName,
          rowId: row.id,
          permissions: permissions,
          structure: structure, // Pass structure to detect markdown fields
          onAttachmentChange: () => this.loadAttachmentCount(),
          onAddToMarkdown: (fieldName, markdownLink) => {
            // Append the markdown link to the end of the field
            const currentValue = this.state.formData[fieldName] || '';
            const newValue = currentValue + (currentValue ? '\n\n' : '') + markdownLink;
            this.handleFieldChange(fieldName, newValue);
          }
        })
      )
    );
  }
}

// Export to global scope for use in crudList.js
window.EditForm = EditForm;
