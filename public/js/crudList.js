/**
 * CRUD List Component - React without Babel
 * Uses React.createElement (e) for component creation
 *
 * Features:
 * - Inline edit form with auto-save
 * - Special granted field selector
 * - Relation autocomplete search
 * - "+" buttons to create new records
 */

const e = React.createElement;

// Global schema config (fetched from server)
let SCHEMA_CONFIG = null;

/**
 * Field Renderer Component
 * Renders field values according to their renderer type
 */
class FieldRenderer extends React.Component {
  render() {
    const { value, field, tableName } = this.props;

    if (value === null || value === undefined) {
      return e('span', { className: 'field-value empty' }, '-');
    }

    const renderer = field.renderer || field.type;

    switch (renderer) {
      case 'telephone':
        return e('span', { className: 'field-value telephone' },
          e('a', {
            href: `tel:${value}`,
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Appeler'
          }, '📞'),
          ' ',
          value
        );

      case 'email':
        return e('span', { className: 'field-value email' },
          e('a', {
            href: `mailto:${value}`,
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Envoyer un email'
          }, '📧'),
          ' ',
          value
        );

      case 'url':
        return e('span', { className: 'field-value url' },
          e('a', {
            href: value,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (ev) => ev.stopPropagation(),
            className: 'field-icon-link',
            title: 'Ouvrir le lien'
          }, '🔗'),
          ' ',
          value
        );

      case 'markdown':
        return e('div', {
          className: 'field-value markdown',
          dangerouslySetInnerHTML: { __html: this.simpleMarkdown(value) }
        });

      case 'date':
      case 'datetime':
        const date = new Date(value);
        const formatted = date.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          ...(renderer === 'datetime' && {
            hour: '2-digit',
            minute: '2-digit'
          })
        });
        return e('time', {
          dateTime: value,
          className: 'field-value date'
        }, formatted);

      case 'boolean':
        return e('span', {
          className: `field-value boolean ${value ? 'true' : 'false'}`
        }, value ? '✓' : '✗');

      default:
        return e('span', { className: 'field-value text' }, String(value));
    }
  }

  simpleMarkdown(text) {
    return String(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}

/**
 * Relation Autocomplete Component
 * Search and select related records
 */
class RelationAutocomplete extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      results: [],
      loading: false,
      showDropdown: false,
      selectedIndex: -1
    };
    this.searchTimeout = null;
    this.dropdownRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
    // Load initial value if exists
    if (this.props.value && this.props.value.label) {
      this.setState({ searchText: this.props.value.label });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  handleClickOutside = (event) => {
    if (this.dropdownRef.current && !this.dropdownRef.current.contains(event.target)) {
      this.setState({ showDropdown: false });
    }
  }

  handleSearchChange = (event) => {
    const searchText = event.target.value;
    this.setState({ searchText, showDropdown: true });

    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (searchText.length >= 1) {
      this.searchTimeout = setTimeout(() => this.performSearch(searchText), 300);
    } else {
      this.setState({ results: [], loading: false });
    }
  }

  performSearch = async (query) => {
    const { relatedTable } = this.props;
    this.setState({ loading: true });

    try {
      const response = await fetch(`/_api/search/${relatedTable}?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (data.success) {
        this.setState({
          results: data.results,
          loading: false,
          selectedIndex: -1
        });
      } else {
        console.error('Search failed:', data.error);
        this.setState({ results: [], loading: false });
      }
    } catch (error) {
      console.error('Search error:', error);
      this.setState({ results: [], loading: false });
    }
  }

  handleKeyDown = (event) => {
    const { results, selectedIndex, showDropdown } = this.state;

    if (!showDropdown || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.setState(prev => ({
        selectedIndex: Math.min(prev.selectedIndex + 1, results.length - 1)
      }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.setState(prev => ({
        selectedIndex: Math.max(prev.selectedIndex - 1, -1)
      }));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0) {
        this.selectItem(results[selectedIndex]);
      }
    } else if (event.key === 'Escape') {
      this.setState({ showDropdown: false });
    }
  }

  selectItem = (item) => {
    this.setState({
      searchText: item.label,
      showDropdown: false,
      results: []
    });

    if (this.props.onChange) {
      this.props.onChange(item.id, item);
    }
  }

  handleAddNew = () => {
    if (this.props.onAddNew) {
      this.props.onAddNew();
    }
  }

  render() {
    const { fieldName, disabled, canCreate } = this.props;
    const { searchText, results, loading, showDropdown, selectedIndex } = this.state;

    return e('div', { className: 'relation-autocomplete', ref: this.dropdownRef },
      e('div', { className: 'relation-input-wrapper' },
        e('input', {
          type: 'text',
          className: 'edit-field-input relation-input',
          value: searchText,
          onChange: this.handleSearchChange,
          onKeyDown: this.handleKeyDown,
          onFocus: () => this.setState({ showDropdown: true }),
          disabled: disabled,
          placeholder: 'Rechercher...'
        }),
        canCreate && e('button', {
          type: 'button',
          className: 'btn-add-relation',
          onClick: this.handleAddNew,
          title: 'Créer un nouvel enregistrement'
        }, '+')
      ),
      showDropdown && (loading || results.length > 0) && e('div', { className: 'autocomplete-dropdown' },
        loading && e('div', { className: 'autocomplete-loading' }, 'Recherche...'),
        !loading && results.length === 0 && searchText.length >= 1 && e('div', { className: 'autocomplete-empty' }, 'Aucun résultat'),
        !loading && results.map((item, idx) =>
          e('div', {
            key: item.id,
            className: `autocomplete-item ${idx === selectedIndex ? 'selected' : ''}`,
            onClick: () => this.selectItem(item),
            onMouseEnter: () => this.setState({ selectedIndex: idx })
          }, item.label)
        )
      )
    );
  }
}

/**
 * Granted Field Selector Component
 * Special handling for the granted field with draft/shared/published options
 */
class GrantedSelector extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: props.value || 'draft',
      publishRole: 'public'
    };

    // Parse initial value
    if (props.value && props.value.startsWith('published @')) {
      this.state.selectedValue = 'published';
      this.state.publishRole = props.value.replace('published @', '');
    }
  }

  handleChange = (value) => {
    this.setState({ selectedValue: value });

    let grantedValue = value;
    if (value === 'published') {
      grantedValue = `published @${this.state.publishRole}`;
    }

    if (this.props.onChange) {
      this.props.onChange(grantedValue);
    }
  }

  handlePublishRoleChange = (role) => {
    this.setState({ publishRole: role });

    if (this.state.selectedValue === 'published') {
      if (this.props.onChange) {
        this.props.onChange(`published @${role}`);
      }
    }
  }

  getIcon() {
    const { selectedValue, publishRole } = this.state;
    switch (selectedValue) {
      case 'draft': return '📝';
      case 'shared': return '👥';
      case 'published': return '🌐';
      default: return '📝';
    }
  }

  getLabel() {
    const { selectedValue, publishRole } = this.state;
    switch (selectedValue) {
      case 'draft': return 'Brouillon';
      case 'shared': return 'Partagée';
      case 'published': return `Publiée @${publishRole}`;
      default: return 'Brouillon';
    }
  }

  render() {
    const { publishableTo = [], userRole = 'member', disabled, compact } = this.props;
    const { selectedValue, publishRole } = this.state;

    if (compact) {
      return e('div', { className: 'granted-selector-compact' },
        e('select', {
          className: 'granted-compact-select',
          value: selectedValue === 'published' ? `published:${publishRole}` : selectedValue,
          onChange: (ev) => {
            const val = ev.target.value;
            if (val.startsWith('published:')) {
              const role = val.replace('published:', '');
              this.setState({ selectedValue: 'published', publishRole: role });
              if (this.props.onChange) {
                this.props.onChange(`published @${role}`);
              }
            } else {
              this.handleChange(val);
            }
          },
          disabled: disabled,
          title: this.getLabel()
        },
          e('option', { value: 'draft' }, '📝 Brouillon'),
          e('option', { value: 'shared' }, `👥 Partagée (${userRole})`),
          publishableTo.length > 0 && publishableTo.map(role =>
            e('option', { key: role, value: `published:${role}` }, `🌐 Publiée @${role}`)
          )
        )
      );
    }

    return e('div', { className: 'granted-selector' },
      // Draft option
      e('div', {
        className: `granted-option ${selectedValue === 'draft' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('draft')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'draft',
          checked: selectedValue === 'draft',
          onChange: () => this.handleChange('draft'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '📝 Brouillon'),
          e('div', { className: 'granted-option-desc' }, 'La fiche vous appartient')
        )
      ),

      // Shared option
      e('div', {
        className: `granted-option ${selectedValue === 'shared' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('shared')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'shared',
          checked: selectedValue === 'shared',
          onChange: () => this.handleChange('shared'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '👥 Partagée'),
          e('div', { className: 'granted-option-desc' }, `Partagée avec ${userRole}`)
        )
      ),

      // Published option (if publishableTo is set)
      publishableTo.length > 0 && e('div', {
        className: `granted-option ${selectedValue === 'published' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('published')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'published',
          checked: selectedValue === 'published',
          onChange: () => this.handleChange('published'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '🌐 Publiée'),
          e('div', { className: 'granted-option-desc' },
            e('select', {
              className: 'edit-field-select',
              value: publishRole,
              onChange: (e) => this.handlePublishRoleChange(e.target.value),
              onClick: (e) => e.stopPropagation(),
              disabled: disabled || selectedValue !== 'published'
            },
              publishableTo.map(role =>
                e('option', { key: role, value: role }, role)
              )
            )
          )
        )
      )
    );
  }
}

/**
 * Edit Form Component
 * Inline form for editing record with auto-save
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
      errors: {}
    };

    this.saveTimeout = null;
    this.autosaveDelay = SCHEMA_CONFIG?.autosave || 500;
    this.firstInputRef = React.createRef();
  }

  componentDidMount() {
    // Auto-focus first input field
    if (this.firstInputRef.current) {
      setTimeout(() => {
        this.firstInputRef.current.focus();
      }, 100);
    }
  }

  componentWillUnmount() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
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

    // Auto-save with debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveChanges();
    }, this.autosaveDelay);
  }

  saveChanges = async () => {
    const { tableName, row } = this.props;
    const { formData } = this.state;

    this.setState({ saveStatus: 'saving' });

    try {
      // Remove _relations before sending (it's a computed field, not a database field)
      const { _relations, ...dataToSend } = formData;

      const response = await fetch(`/_api/${tableName}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (data.success) {
        this.setState({ saveStatus: 'saved' });
        // Reset to idle after 2 seconds
        setTimeout(() => {
          this.setState({ saveStatus: 'idle' });
        }, 2000);

        // Notify parent of successful save
        if (this.props.onSave) {
          this.props.onSave(formData);
        }
      } else {
        this.setState({ saveStatus: 'error', errors: { _general: data.error } });
      }
    } catch (error) {
      console.error('Save error:', error);
      this.setState({ saveStatus: 'error', errors: { _general: error.message } });
    }
  }

  renderField = (fieldName, field, isFirstField = false) => {
    const { formData, errors } = this.state;
    const { structure, tableConfig, permissions } = this.props;
    const value = formData[fieldName];
    const label = field.label || fieldName;

    // Skip computed fields
    if (field.as || field.calculate) {
      return null;
    }

    // Check if this is a relation
    if (field.relation) {
      return e('div', { key: fieldName, className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, label),
        e(RelationAutocomplete, {
          fieldName: fieldName,
          relatedTable: field.relation,
          value: formData._relations && formData._relations[fieldName],
          onChange: (id, item) => this.handleFieldChange(fieldName, id),
          canCreate: permissions.canCreate,
          onAddNew: () => {
            // Open new window to create related record
            window.open(`/_crud/${field.relation}`, '_blank');
          }
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
          userRole: 'member', // TODO: Get from user context
          onChange: (val) => this.handleFieldChange(fieldName, val),
          disabled: !permissions.canPublish
        })
      );
    }

    // Render based on field type
    switch (field.type) {
      case 'text':
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('textarea', {
            className: 'edit-field-textarea',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value)
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );

      case 'enum':
        return e('div', { key: fieldName, className: 'edit-field' },
          e('label', { className: 'edit-field-label' }, label),
          e('select', {
            className: 'edit-field-select',
            value: value || '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value)
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
            )
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
            value: value ? this.formatDateForInput(value, field.type) : '',
            onChange: (e) => this.handleFieldChange(fieldName, e.target.value)
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
            ref: isFirstField ? this.firstInputRef : null
          }),
          errors[fieldName] && e('span', { className: 'edit-field-error' }, errors[fieldName])
        );
    }
  }

  formatDateForInput = (value, type) => {
    if (!value) return '';
    const date = new Date(value);
    if (type === 'datetime') {
      return date.toISOString().slice(0, 16);
    } else {
      return date.toISOString().slice(0, 10);
    }
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

  render() {
    const { structure, onClose, row, tableName, tableConfig, permissions } = this.props;
    const { saveStatus, errors, formData } = this.state;

    // Get editable fields (exclude system fields, id, granted, and relations arrays)
    const editableFields = Object.keys(structure.fields).filter(f =>
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)
    );

    return e('div', { className: 'edit-form' },
      // Header
      e('div', { className: 'edit-form-header' },
        e('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 } },
          e('h3', {
            className: 'edit-form-title clickable',
            onClick: onClose,
            title: 'Cliquer pour fermer le formulaire'
          }, `✏️ ${tableName} / ${row.id}`),
          // Granted selector in header
          structure.fields.granted && e('div', { style: { marginLeft: 'auto' } },
            e(GrantedSelector, {
              value: formData.granted,
              publishableTo: tableConfig.publishableTo || [],
              userRole: 'member',
              onChange: (val) => this.handleFieldChange('granted', val),
              disabled: !permissions.canPublish,
              compact: true
            })
          )
        ),
        e('div', { className: 'edit-form-actions' },
          saveStatus !== 'idle' && e('span', {
            className: `save-indicator ${saveStatus}`
          }, this.getSaveIndicatorText()),
          e('button', {
            className: 'btn-close-edit',
            onClick: onClose,
            title: 'Fermer le formulaire'
          }, '✖')
        )
      ),

      // General error
      errors._general && e('div', { className: 'error' }, errors._general),

      // Form fields grid
      e('div', { className: 'edit-form-grid' },
        editableFields.map((fieldName, index) => {
          const field = structure.fields[fieldName];
          // Check if this is the first non-computed field
          const isFirstField = index === 0 || editableFields.slice(0, index).every(fn => {
            const f = structure.fields[fn];
            return f.as || f.calculate || f.relation || fn === 'granted';
          });
          return this.renderField(fieldName, field, isFirstField);
        })
      )
    );
  }
}

/**
 * N:1 Relation Renderer
 */
class RelationRenderer extends React.Component {
  render() {
    const { relation, fieldName, relatedTable } = this.props;

    if (!relation) {
      return e('span', { className: 'relation-value empty' }, '-');
    }

    const displayValue = this.getDisplayValue(relation);

    return e('div', { className: 'relation-value' },
      e('a', {
        href: `/_crud/${relatedTable}/${relation.id}`,
        className: 'relation-link',
        onClick: (ev) => ev.stopPropagation()
      }, '🔗 ', displayValue)
    );
  }

  getDisplayValue(relation) {
    if (typeof relation === 'string') return relation;

    const values = [];
    for (const key in relation) {
      if (key !== 'id' && key !== '_table' && relation[key]) {
        values.push(relation[key]);
      }
    }

    if (values.length > 0) {
      return values.join(' ');
    }

    return `#${relation.id || '?'}`;
  }
}

/**
 * Table Header Component
 */
class TableHeader extends React.Component {
  render() {
    const { fields, structure, orderBy, order, onSort, displayMode } = this.props;

    if (displayMode === 'raw') {
      return e('thead', null,
        e('tr', null,
          fields.map(fieldName =>
            e('th', { key: fieldName }, fieldName)
          )
        )
      );
    }

    return e('thead', null,
      e('tr', null,
        fields.map(fieldName => {
          const field = structure.fields[fieldName];
          const label = field?.label || fieldName;
          const isSorted = orderBy === fieldName;
          const sortIcon = isSorted ? (order === 'ASC' ? ' ▲' : ' ▼') : '';

          return e('th', {
            key: fieldName,
            className: `sortable ${isSorted ? 'sorted' : ''}`,
            onClick: () => onSort(fieldName)
          }, label, sortIcon);
        })
      )
    );
  }
}

/**
 * Table Row Component
 */
class TableRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      expanded: false,
      editMode: false,
      fullData: null,
      loading: false
    };
  }

  toggleExpand = async () => {
    const { expanded, fullData, editMode } = this.state;
    const { row, tableName } = this.props;

    // If in edit mode, clicking should not toggle
    if (editMode) return;

    if (!expanded && !fullData) {
      // First time expanding - fetch full data
      this.setState({ loading: true, expanded: true });

      try {
        const response = await fetch(`/_api/${tableName}/${row.id}?relation=all&compact=1`);
        const data = await response.json();

        if (data.success && data.rows && data.rows.length > 0) {
          this.setState({
            loading: false,
            fullData: data.rows[0]
          });
        } else {
          console.error('Failed to fetch full data:', data.error || 'No data returned');
          this.setState({ loading: false });
        }
      } catch (error) {
        console.error('Error fetching full data:', error);
        this.setState({ loading: false });
      }
    } else {
      // Toggle expanded
      this.setState({ expanded: !expanded });
    }
  }

  enterEditMode = () => {
    const { permissions } = this.props;
    if (permissions && permissions.canUpdate) {
      this.setState({ editMode: true, expanded: true });
    }
  }

  exitEditMode = () => {
    this.setState({ editMode: false });
  }

  handleSave = (updatedData) => {
    // Update the full data with saved changes
    this.setState(prev => ({
      fullData: {
        ...prev.fullData,
        ...updatedData
      }
    }));

    // Notify parent to refresh list
    if (this.props.onUpdate) {
      this.props.onUpdate();
    }
  }

  render() {
    const { row, fields, structure, displayMode, tableName, permissions, tableConfig } = this.props;
    const { expanded, editMode, fullData, loading } = this.state;

    if (displayMode === 'raw') {
      return e('tr', null,
        fields.map(fieldName =>
          e('td', { key: fieldName }, String(row[fieldName] || ''))
        )
      );
    }

    const displayData = fullData || row;

    return e(React.Fragment, null,
      e('tr', {
        className: `data-row ${expanded ? 'expanded' : ''}`,
        onClick: this.toggleExpand,
        onDoubleClick: this.enterEditMode
      },
        fields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];
          const relationData = row._relations && row._relations[fieldName];

          return e('td', { key: fieldName },
            relationData
              ? e(RelationRenderer, {
                  relation: relationData,
                  fieldName,
                  relatedTable: field.relation
                })
              : e(FieldRenderer, {
                  value,
                  field,
                  tableName
                })
          );
        })
      ),
      expanded && e('tr', { className: 'detail-row' },
        e('td', { colSpan: fields.length },
          loading
            ? e('div', { className: 'detail-loading' }, 'Chargement des détails...')
            : editMode
              ? e(EditForm, {
                  row: displayData,
                  structure,
                  tableName,
                  tableConfig,
                  permissions,
                  onClose: this.exitEditMode,
                  onSave: this.handleSave
                })
              : e(RowDetailView, {
                  row: displayData,
                  structure,
                  tableName,
                  permissions,
                  onEdit: this.enterEditMode
                })
        )
      )
    );
  }
}

/**
 * Row Detail View Component
 */
class RowDetailView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      openRelations: new Set()
    };
  }

  componentDidMount() {
    const { row } = this.props;
    if (row._relations) {
      const strongRelations = new Set();
      Object.entries(row._relations).forEach(([relName, relData]) => {
        if (Array.isArray(relData) && relData.length > 0) {
          strongRelations.add(relName);
        }
      });
      this.setState({ openRelations: strongRelations });
    }
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
    const { row, structure, tableName, permissions, onEdit } = this.props;
    const { openRelations } = this.state;

    const allFields = Object.keys(structure.fields).filter(f =>
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)
    );

    const relations1N = {};
    if (row._relations) {
      Object.entries(row._relations).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          relations1N[key] = value;
        }
      });
    }

    const handleFieldClick = (e) => {
      if (permissions && permissions.canUpdate) {
        onEdit();
      }
    };

    return e('div', { className: 'row-detail' },
      // Fields grid - clickable to edit
      e('div', {
        className: 'detail-fields',
        style: permissions && permissions.canUpdate ? { cursor: 'pointer' } : {},
        onClick: handleFieldClick,
        title: permissions && permissions.canUpdate ? 'Cliquer pour éditer' : ''
      },
        allFields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];
          const label = field?.label || fieldName;

          const relationN1 = row._relations && row._relations[fieldName] && !Array.isArray(row._relations[fieldName])
            ? row._relations[fieldName]
            : null;

          return e('div', { key: fieldName, className: 'detail-field' },
            e('label', { className: 'detail-label' }, label),
            e('div', { className: 'detail-value' },
              relationN1
                ? e(RelationRenderer, {
                    relation: relationN1,
                    fieldName: fieldName,
                    relatedTable: field.relation
                  })
                : e(FieldRenderer, {
                    value,
                    field,
                    tableName
                  })
            )
          );
        })
      ),

      // 1:N Relations
      Object.keys(relations1N).length > 0 && e('div', { className: 'detail-relations-1n' },
        e('h4', null, 'Relations liées'),
        Object.entries(relations1N).map(([relName, relRows]) => {
          const isOpen = openRelations.has(relName);
          const relatedTable = relRows[0]?._table || relName;

          return e('div', { key: relName, className: 'relation-section' },
            e('div', {
              className: 'relation-header',
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
            },
              e('div', {
                style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 },
                onClick: () => this.toggleRelation(relName)
              },
                e('span', { className: 'relation-toggle' }, isOpen ? '▼' : '▶'),
                e('strong', null, relName),
                e('span', { className: 'relation-count' }, ` (${relRows.length})`)
              ),
              e('button', {
                className: 'btn-add-relation-item',
                onClick: (ev) => {
                  ev.stopPropagation();
                  window.open(`/_crud/${relatedTable}?parent=${tableName}&parentId=${row.id}`, '_blank');
                },
                title: `Créer un nouveau ${relatedTable}`
              }, '+ Nouveau')
            ),
            isOpen && e('div', { className: 'relation-list' },
              e(SubList, {
                rows: relRows,
                tableName: relatedTable,
                parentTable: tableName
              })
            )
          );
        })
      )
    );
  }
}

/**
 * Sub-List Component
 */
class SubList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      structure: null
    };
  }

  async componentDidMount() {
    const { tableName } = this.props;

    try {
      const response = await fetch(`/_crud/${tableName}/structure`);
      const data = await response.json();
      if (data.success) {
        this.setState({ structure: data.structure });
      }
    } catch (error) {
      console.error('Failed to fetch table structure:', error);
    }
  }

  render() {
    const { rows, tableName, parentTable } = this.props;
    const { structure } = this.state;

    if (!rows || rows.length === 0) {
      return e('div', { className: 'sub-list-empty' }, 'Aucune donnée');
    }

    if (!structure) {
      return e('div', { className: 'sub-list-loading' }, 'Chargement...');
    }

    const firstRow = rows[0];
    const fields = Object.keys(firstRow).filter(f =>
      !f.startsWith('_') &&
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f) &&
      !this.isParentField(f, parentTable)
    );

    return e('table', { className: 'sub-list-table' },
      e('thead', null,
        e('tr', null,
          fields.map(f => {
            const field = structure.fields[f];
            const label = field?.label || f;
            return e('th', { key: f }, label);
          })
        )
      ),
      e('tbody', null,
        rows.map((row, idx) =>
          e('tr', { key: row.id || idx },
            fields.map(f => {
              const field = structure.fields[f];
              const value = row[f];
              const relationData = row._relations && row._relations[f];

              return e('td', { key: f },
                relationData
                  ? e(RelationRenderer, {
                      relation: relationData,
                      fieldName: f,
                      relatedTable: field?.relation
                    })
                  : e(FieldRenderer, {
                      value,
                      field: field || { type: 'text' },
                      tableName
                    })
              );
            })
          )
        )
      )
    );
  }

  isParentField(fieldName, parentTable) {
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${parentTable}`;
  }
}

/**
 * Field Selector Modal Component
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
            className: 'modal-close',
            onClick: onClose
          }, '✖')
        ),
        e('div', { className: 'modal-body' },
          e('div', { className: 'modal-actions' },
            e('button', {
              className: 'btn-select-all',
              onClick: this.selectAll
            }, 'Tout sélectionner'),
            e('button', {
              className: 'btn-select-none',
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
            className: 'btn-cancel',
            onClick: onClose
          }, 'Annuler'),
          e('button', {
            className: 'btn-apply',
            onClick: this.apply
          }, 'Appliquer')
        )
      )
    );
  }
}

/**
 * Three-Dot Menu Component
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
    this.setState(prev => ({ isOpen: !prev.isOpen }));
  }

  handleOptionClick = (action) => {
    this.setState({ isOpen: false });
    if (this.props[action]) {
      this.props[action]();
    }
  }

  render() {
    const { displayMode, onDisplayModeChange, onFieldSelect } = this.props;
    const { isOpen } = this.state;

    return e('div', { className: 'menu-dots', ref: this.menuRef },
      e('button', {
        className: 'btn-menu',
        onClick: this.toggleMenu,
        'aria-label': 'Options'
      }, '⋮'),
      isOpen && e('div', { className: 'menu-dropdown' },
        e('div', { className: 'menu-section' },
          e('div', { className: 'menu-label' }, 'Mode de présentation'),
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
        e('div', { className: 'menu-divider' }),
        e('button', {
          className: 'menu-item',
          onClick: () => this.handleOptionClick('onFieldSelect')
        }, '🎯 Sélectionner les champs')
      )
    );
  }
}

/**
 * Main CRUD List Component
 */
class CrudList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: null,
      data: null,
      search: '',
      orderBy: 'updatedAt',
      order: 'DESC',
      displayMode: 'default',
      showSystemFields: false,
      selectedFields: null,
      showFieldSelector: false,
      page: 0,
      limit: 100
    };
  }

  componentDidMount() {
    this.loadSchema();
    this.loadData();
    this.loadUserPreferences();
  }

  loadSchema = async () => {
    try {
      const response = await fetch(`/_crud/${this.props.table}/data?limit=1`);
      const data = await response.json();
      if (data.success && data.tableConfig) {
        SCHEMA_CONFIG = data.tableConfig;
        // Set CSS variables for column sizes
        const root = document.documentElement;
        root.style.setProperty('--max-col-width', data.tableConfig.maxColWidth || '20em');
        root.style.setProperty('--max-col-height', data.tableConfig.maxColHeight || '1em');
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    }
  }

  loadUserPreferences = () => {
    const prefs = this.getCookie(`crud_prefs_${this.props.table}`);
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        this.setState({
          displayMode: parsed.displayMode || 'default',
          selectedFields: parsed.selectedFields || null
        });
      } catch (e) {
        console.error('Failed to parse preferences:', e);
      }
    }
  }

  saveUserPreferences = () => {
    const { displayMode, selectedFields } = this.state;
    const prefs = JSON.stringify({ displayMode, selectedFields });
    this.setCookie(`crud_prefs_${this.props.table}`, prefs, 365);
  }

  getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  }

  loadData = async () => {
    this.setState({ loading: true, error: null });

    const { table } = this.props;
    const { search, orderBy, order, page, limit, displayMode, selectedFields } = this.state;

    const showSystemFields = displayMode === 'raw';

    try {
      const params = new URLSearchParams({
        limit,
        offset: page * limit,
        orderBy,
        order,
        search: search || '',
        showSystemFields: showSystemFields ? '1' : '0'
      });

      if (displayMode === 'custom' && selectedFields && selectedFields.length > 0) {
        params.set('selectedFields', selectedFields.join(','));
      }

      const response = await fetch(`/_crud/${table}/data?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement des données');
      }

      this.setState({
        loading: false,
        data
      });
    } catch (error) {
      this.setState({
        loading: false,
        error: error.message
      });
    }
  }

  handleSort = (fieldName) => {
    this.setState(prev => {
      if (prev.orderBy === fieldName) {
        if (prev.order === 'ASC') {
          return {
            orderBy: fieldName,
            order: 'DESC'
          };
        } else {
          return {
            orderBy: 'updatedAt',
            order: 'DESC'
          };
        }
      } else {
        return {
          orderBy: fieldName,
          order: 'ASC'
        };
      }
    }, this.loadData);
  }

  handleSearch = (value) => {
    this.setState({ search: value, page: 0 }, () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(this.loadData, 300);
    });
  }

  handleDisplayModeChange = (mode) => {
    this.setState({ displayMode: mode }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  handleShowFieldSelector = () => {
    this.setState({ showFieldSelector: true });
  }

  handleCloseFieldSelector = () => {
    this.setState({ showFieldSelector: false });
  }

  handleApplyFieldSelection = (fields) => {
    this.setState({
      selectedFields: fields,
      displayMode: 'custom'
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  handleLoadMore = () => {
    this.setState(prev => ({
      limit: prev.limit + 100
    }), this.loadData);
  }

  handleAddNew = () => {
    // For now, just reload. Could open a modal or navigate to create form
    window.location.href = `/_crud/${this.props.table}?new=1`;
  }

  render() {
    const { table } = this.props;
    const { loading, error, data, search, orderBy, order, displayMode, showFieldSelector, selectedFields } = this.state;

    return e('div', { className: 'crud-list-container' },
      // Header
      e('div', { className: 'crud-header' },
        e('h1', { className: 'crud-title' }, '📋 ', table),
        e('div', { className: 'crud-actions' },
          data && data.permissions && data.permissions.canCreate && e('button', {
            className: 'btn-add-record',
            onClick: this.handleAddNew
          }, '+ Nouveau'),
          e('input', {
            type: 'text',
            className: 'search-input',
            placeholder: 'Rechercher...',
            value: search,
            onChange: (ev) => this.handleSearch(ev.target.value)
          }),
          e(ThreeDotsMenu, {
            displayMode,
            onDisplayModeChange: this.handleDisplayModeChange,
            onFieldSelect: this.handleShowFieldSelector
          })
        )
      ),

      // Content
      loading && e('div', { className: 'loading' }, 'Chargement...'),
      error && e('div', { className: 'error' }, error),

      data && e('div', { className: 'crud-content' },
        e('table', { className: 'crud-table' },
          e(TableHeader, {
            fields: data.visibleFields,
            structure: data.structure,
            orderBy,
            order,
            onSort: this.handleSort,
            displayMode
          }),
          e('tbody', null,
            data.rows.map((row, idx) =>
              e(TableRow, {
                key: row.id || idx,
                row,
                fields: data.visibleFields,
                structure: data.structure,
                displayMode,
                tableName: table,
                permissions: data.permissions,
                tableConfig: data.tableConfig,
                onUpdate: this.loadData
              })
            )
          )
        ),

        data.pagination && e('div', { className: 'pagination' },
          e('span', { className: 'pagination-info' },
            `Affichage de ${data.pagination.offset + 1} à ${data.pagination.offset + data.pagination.count} sur ${data.pagination.total} résultats`
          ),
          (data.pagination.offset + data.pagination.count < data.pagination.total) && e('button', {
            className: 'btn-load-more',
            onClick: this.handleLoadMore
          }, '+ Plus de lignes')
        )
      ),

      showFieldSelector && data && e(FieldSelectorModal, {
        allFields: data.allFields,
        selectedFields: selectedFields,
        structure: data.structure,
        onApply: this.handleApplyFieldSelection,
        onClose: this.handleCloseFieldSelector
      })
    );
  }
}

// Export for use
window.CrudList = CrudList;
