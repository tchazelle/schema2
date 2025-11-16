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
 * Helper function to build card title from displayFields
 * @param {Object} row - The data row
 * @param {string} tableName - Table name
 * @param {Object} tableConfig - Table configuration
 * @returns {string} - Display title
 */
function buildCardTitle(row, tableName, tableConfig) {
  if (!tableConfig || !tableConfig.displayFields || tableConfig.displayFields.length === 0) {
    return null;
  }

  const values = tableConfig.displayFields
    .map(fieldName => row[fieldName])
    .filter(val => val !== null && val !== undefined && val !== '')
    .join(' ');

  return values || null;
}

/**
 * Field Renderer Component
 * Renders field values according to their renderer type
 */
class FieldRenderer extends React.Component {
  render() {
    const { value, field, tableName, fieldName } = this.props;

    if (value === null || value === undefined) {
      return e('span', { className: 'field-value empty' }, '-');
    }

    // Special handling for _dateRange field
    if (fieldName === '_dateRange') {
      // Extract year and month from the date range value
      // Format: "15 janv. 2024 14:30→18:00" or "15 janv. 2024 14:30→16 janv. 2024 10:00"
      const yearMonthMatch = value.match(/(\d{4})/);
      const monthNames = {
        'janv.': '01', 'févr.': '02', 'mars': '03', 'avr.': '04',
        'mai': '05', 'juin': '06', 'juil.': '07', 'août': '08',
        'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12'
      };

      let calendarUrl = '/_calendar';
      if (yearMonthMatch) {
        const year = yearMonthMatch[1];
        // Try to find month name in the value
        const monthMatch = value.match(/(\w+\.?)\s+\d{4}/);
        if (monthMatch && monthNames[monthMatch[1]]) {
          const month = monthNames[monthMatch[1]];
          calendarUrl = `/_calendar/${year}/${month}`;
        }
      }

      return e('span', { className: 'field-value daterange' },
        e('a', {
          href: calendarUrl,
          onClick: (ev) => ev.stopPropagation(),
          className: 'field-icon-link',
          title: 'Voir le calendrier'
        }, '📅'),
        ' ',
        value
      );
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
        // Parse date as STRING to avoid timezone conversion
        // MySQL returns dates as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
        let formatted;
        if (renderer === 'datetime') {
          // Parse "2025-11-16 16:00:00" or "2025-11-16T16:00:00"
          const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          if (match) {
            const [, year, month, day, hours, minutes] = match;
            formatted = `${day}/${month}/${year} ${hours}:${minutes}`;
          } else {
            formatted = String(value);
          }
        } else {
          // Parse "2025-11-16"
          const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const [, year, month, day] = match;
            formatted = `${day}/${month}/${year}`;
          } else {
            formatted = String(value);
          }
        }

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
      selectedIndex: -1,
      initialLoading: true
    };
    this.searchTimeout = null;
    this.dropdownRef = React.createRef();
    this.inputRef = React.createRef();
  }

  async componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
    // Load initial value if exists
    await this.loadInitialValue();
  }

  async loadInitialValue() {
    const { value, currentId, relatedTable } = this.props;

    // Case 1: value is an object with label (from _relations)
    if (value && typeof value === 'object' && (value.label || value._label)) {
      this.setState({
        searchText: value._label || value.label,
        initialLoading: false
      });
      return;
    }

    // Case 2: currentId is provided (ID of related record)
    if (currentId && relatedTable) {
      this.setState({ initialLoading: true });
      try {
        const response = await fetch(`/_api/${relatedTable}/${currentId}`);
        const data = await response.json();

        if (data.success && data.rows && data.rows.length > 0) {
          const record = data.rows[0];
          // Use _label from API (built from displayFields) or fallback to buildLabel
          const label = record._label || this.buildLabel(record);
          this.setState({
            searchText: label,
            initialLoading: false
          });
        } else {
          this.setState({ initialLoading: false });
        }
      } catch (error) {
        console.error('Failed to load initial value:', error);
        this.setState({ initialLoading: false });
      }
    } else {
      this.setState({ initialLoading: false });
    }
  }

  buildLabel(record) {
    // Try to build a meaningful label from the record
    const values = [];
    for (const key in record) {
      if (key !== 'id' && key !== 'ownerId' && key !== 'granted' &&
          key !== 'createdAt' && key !== 'updatedAt' &&
          !key.startsWith('_') && record[key]) {
        values.push(record[key]);
        if (values.length >= 3) break; // Limit to 3 fields
      }
    }
    return values.length > 0 ? values.join(' ') : `#${record.id}`;
  }

  // Expose focus method for external use
  focus() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  handleClickOutside = (event) => {
    // Ignore if click is on the input itself or within the dropdown container
    if (this.dropdownRef.current && !this.dropdownRef.current.contains(event.target)) {
      // Use a small delay to prevent closing when clicking to focus
      setTimeout(() => {
        this.setState({ showDropdown: false });
      }, 100);
    }
  }

  handleFocus = () => {
    const { searchText } = this.state;
    // Show dropdown and trigger search if there's text
    this.setState({ showDropdown: true });

    if (searchText.length >= 1) {
      // Trigger search when focusing with existing text
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.performSearch(searchText), 100);
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
    const { searchText, results, loading, showDropdown, selectedIndex, initialLoading } = this.state;

    return e('div', { className: 'relation-autocomplete', ref: this.dropdownRef },
      e('div', { className: 'relation-input-wrapper' },
        e('input', {
          type: 'text',
          className: 'edit-field-input relation-input',
          value: searchText,
          onChange: this.handleSearchChange,
          onKeyDown: this.handleKeyDown,
          onFocus: this.handleFocus,
          disabled: disabled || initialLoading,
          placeholder: initialLoading ? 'Chargement...' : 'Rechercher...',
          ref: this.inputRef
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

  getTableRoles() {
    const { tableGranted = {} } = this.props;
    // Get all roles that have at least "read" permission
    const rolesWithRead = Object.keys(tableGranted).filter(role => {
      const permissions = tableGranted[role];
      return Array.isArray(permissions) && permissions.includes('read');
    });
    return rolesWithRead.length > 0 ? rolesWithRead.join(', ') : 'utilisateurs autorisés';
  }

  render() {
    const { publishableTo = [], tableGranted = {}, disabled, compact } = this.props;
    const { selectedValue, publishRole } = this.state;
    const tableRolesLabel = this.getTableRoles();

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
          e('option', { value: 'shared' }, `👥 Partagée (${tableRolesLabel})`),
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
          e('div', { className: 'granted-option-desc' }, `Partagée avec ${tableRolesLabel}`)
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
/**
 * CalendarDateRangeTool Component
 * Smart date range picker for calendar events
 *
 * Modes:
 * 1. automatique: endDate = startDate + 1 hour
 * 2. durée: endDate = startDate + duration (in minutes)
 * 3. même jour: endDate = same day as startDate + end time
 * 4. période: separate startDate and endDate inputs with validation
 */
class CalendarDateRangeTool extends React.Component {
  constructor(props) {
    super(props);

    // Determine initial mode based on current values
    const { startValue, endValue } = props;
    const initialMode = this.detectMode(startValue, endValue);

    this.state = {
      mode: initialMode,
      duration: 60, // Default duration in minutes
      endTime: '23:59' // Default end time for "même jour" mode
    };
  }

  /**
   * Detect the current mode based on start and end values
   */
  detectMode(startValue, endValue) {
    if (!startValue || !endValue) {
      return 'automatique';
    }

    const start = new Date(startValue);
    const end = new Date(endValue);
    const diffMinutes = Math.round((end - start) / (1000 * 60));

    // If exactly 60 minutes difference -> automatique
    if (diffMinutes === 60) {
      return 'automatique';
    }

    // If same day but different times -> même jour
    if (start.toDateString() === end.toDateString()) {
      return 'même jour';
    }

    // If different days -> période
    if (start.toDateString() !== end.toDateString()) {
      return 'période';
    }

    // Default to durée
    return 'durée';
  }

  /**
   * Format date for datetime-local input (YYYY-MM-DDTHH:MM)
   */
  formatDateForInput(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Extract time from datetime value (HH:MM)
   */
  extractTime(dateValue) {
    if (!dateValue) return '00:00';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '00:00';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  /**
   * Calculate endDate based on mode and inputs
   */
  calculateEndDate(startValue, mode, duration, endTime) {
    if (!startValue) return '';

    const start = new Date(startValue);
    if (isNaN(start.getTime())) return '';

    let end;

    switch (mode) {
      case 'automatique':
        // endDate = startDate + 1 hour
        end = new Date(start.getTime() + 60 * 60 * 1000);
        break;

      case 'durée':
        // endDate = startDate + duration (in minutes)
        end = new Date(start.getTime() + duration * 60 * 1000);
        break;

      case 'même jour':
        // endDate = same day + endTime
        const [hours, minutes] = endTime.split(':').map(Number);
        end = new Date(start);
        end.setHours(hours, minutes, 0, 0);

        // Ensure endDate > startDate
        if (end <= start) {
          end = new Date(start.getTime() + 60 * 60 * 1000); // Fallback to +1 hour
        }
        break;

      case 'période':
        // Will be handled separately with explicit endDate input
        return null;

      default:
        end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    return this.formatDateForInput(end);
  }

  /**
   * Handle mode change
   */
  handleModeChange = (newMode) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ mode: newMode }, () => {
      // Recalculate endDate based on new mode
      if (newMode !== 'période') {
        const { duration, endTime } = this.state;
        const calculatedEndDate = this.calculateEndDate(startValue, newMode, duration, endTime);

        if (calculatedEndDate) {
          onChangeRange(startValue, calculatedEndDate);
        }
      }
    });
  }

  /**
   * Handle startDate change
   */
  handleStartChange = (newStartValue) => {
    const { onChangeRange, endValue } = this.props;
    const { mode, duration, endTime } = this.state;

    if (mode === 'période') {
      // In période mode, keep endDate as is (but validate it's > startDate)
      let finalEndValue = endValue;
      if (endValue && new Date(newStartValue) >= new Date(endValue)) {
        // If endDate is not after startDate, set it to startDate + 1 hour
        finalEndValue = this.calculateEndDate(newStartValue, 'automatique', 60, null);
      }
      onChangeRange(newStartValue, finalEndValue);
    } else {
      // Calculate endDate automatically
      const calculatedEndDate = this.calculateEndDate(newStartValue, mode, duration, endTime);
      onChangeRange(newStartValue, calculatedEndDate);
    }
  }

  /**
   * Handle duration change (for "durée" mode)
   */
  handleDurationChange = (newDuration) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ duration: newDuration }, () => {
      const calculatedEndDate = this.calculateEndDate(startValue, 'durée', newDuration, null);
      if (calculatedEndDate) {
        onChangeRange(startValue, calculatedEndDate);
      }
    });
  }

  /**
   * Handle end time change (for "même jour" mode)
   */
  handleEndTimeChange = (newEndTime) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ endTime: newEndTime }, () => {
      const calculatedEndDate = this.calculateEndDate(startValue, 'même jour', null, newEndTime);
      if (calculatedEndDate) {
        onChangeRange(startValue, calculatedEndDate);
      }
    });
  }

  /**
   * Handle explicit endDate change (for "période" mode)
   */
  handleEndChange = (newEndValue) => {
    const { startValue, onChangeRange } = this.props;

    // Validate that endDate > startDate
    if (startValue && newEndValue && new Date(newEndValue) <= new Date(startValue)) {
      // Show error or auto-correct
      alert('La date de fin doit être postérieure à la date de début');
      return;
    }

    onChangeRange(startValue, newEndValue);
  }

  render() {
    const { startValue, endValue, startLabel, endLabel } = this.props;
    const { mode, duration, endTime } = this.state;

    return e('div', { className: 'calendar-date-range-tool' },
      // Mode selector
      e('div', { className: 'date-range-mode-selector' },
        e('label', { className: 'edit-field-label' }, 'Mode de saisie :'),
        e('select', {
          className: 'edit-field-select mode-select',
          value: mode,
          onChange: (ev) => this.handleModeChange(ev.target.value)
        },
          e('option', { value: 'automatique' }, '⚡ Automatique (1 heure)'),
          e('option', { value: 'durée' }, '⏱️ Durée personnalisée'),
          e('option', { value: 'même jour' }, '📅 Même jour'),
          e('option', { value: 'période' }, '📆 Période complète')
        )
      ),

      // Start date input (always shown)
      e('div', { className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, startLabel),
        e('input', {
          type: 'datetime-local',
          className: 'edit-field-input',
          value: this.formatDateForInput(startValue),
          onChange: (ev) => this.handleStartChange(ev.target.value)
        })
      ),

      // Mode-specific inputs
      mode === 'durée' && e('div', { className: 'edit-field date-range-duration' },
        e('label', { className: 'edit-field-label' }, 'Durée (minutes) :'),
        e('div', { className: 'duration-input-group' },
          e('input', {
            type: 'number',
            className: 'edit-field-input duration-input',
            value: duration,
            min: 1,
            step: 15,
            onChange: (ev) => this.handleDurationChange(Number(ev.target.value))
          }),
          e('span', { className: 'duration-presets' },
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(30)
            }, '30 min'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(60)
            }, '1h'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(90)
            }, '1h30'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(120)
            }, '2h')
          )
        )
      ),

      mode === 'même jour' && e('div', { className: 'edit-field date-range-endtime' },
        e('label', { className: 'edit-field-label' }, 'Heure de fin :'),
        e('input', {
          type: 'time',
          className: 'edit-field-input',
          value: endTime,
          onChange: (ev) => this.handleEndTimeChange(ev.target.value)
        })
      ),

      mode === 'période' && e('div', { className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, endLabel),
        e('input', {
          type: 'datetime-local',
          className: 'edit-field-input',
          value: this.formatDateForInput(endValue),
          onChange: (ev) => this.handleEndChange(ev.target.value)
        })
      ),

      // Preview of calculated endDate (for non-période modes)
      mode !== 'période' && e('div', { className: 'date-range-preview' },
        e('span', { className: 'preview-label' }, endLabel + ' : '),
        e('span', { className: 'preview-value' },
          endValue ? new Date(endValue).toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : '-'
        )
      )
    );
  }
}

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
      dirtyFields: new Set() // Track which fields have been modified
    };

    this.saveTimeout = null;
    this.autosaveDelay = SCHEMA_CONFIG?.autosave || 500;
    this.fieldRefs = {};
    this.pendingSaves = new Map(); // Track pending saves per field
  }

  componentDidMount() {
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

      console.log(`Saving field ${fieldName}:`, value);

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

    // Render based on field type
    switch (field.type) {
      case 'text':
        return e('div', { key: fieldName, className: 'edit-field' },
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
            value: value ? this.formatDateForInput(value, field.type) : '',
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
    const { saveStatus, errors, formData, openRelations } = this.state;

    // Get editable fields (exclude system fields, id, granted, relations arrays, and parent fields in sub-lists)
    const editableFields = Object.keys(structure.fields).filter(f =>
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f) &&
      !this.isParentField(f)
    );

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
                e('span', { className: 'relation-count badge' }, count)
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
                hideHeader: true
              })
            )
          );
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

    // Priority 1: Use _label if available (built from displayFields by API)
    if (relation._label) {
      return relation._label;
    }

    // Priority 2: Use label if available (fallback)
    if (relation.label) {
      return relation.label;
    }

    // Priority 3: Collect non-system fields
    const values = [];
    for (const key in relation) {
      if (key !== 'id' && key !== '_table' && !key.startsWith('_') && relation[key]) {
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
    const { fields, structure, orderBy, order, onSort, displayMode, showDeleteButton, permissions, advancedSortCriteria } = this.props;
    const hasAdvancedSort = advancedSortCriteria && advancedSortCriteria.length > 0;

    if (displayMode === 'raw') {
      return e('thead', null,
        e('tr', null,
          showDeleteButton && permissions && permissions.canDelete && e('th', { key: 'delete-header', style: { width: '40px' } }, ''),
          fields.map(fieldName =>
            e('th', { key: fieldName }, fieldName)
          )
        )
      );
    }

    return e('thead', null,
      e('tr', null,
        showDeleteButton && permissions && permissions.canDelete && e('th', { key: 'delete-header', style: { width: '40px' } }, ''),
        e('th', { key: 'granted-header', style: { width: '40px', textAlign: 'center' }, title: 'Statut de publication' }, '📋'),
        fields.map(fieldName => {
          const field = structure.fields[fieldName];

          // Special label for _dateRange
          let label = field?.label || fieldName;
          if (fieldName === '_dateRange') {
            label = 'Période';
          }

          const isSorted = orderBy === fieldName;
          // Hide sort icon when advanced sort is active
          const sortIcon = (!hasAdvancedSort && isSorted) ? (order === 'ASC' ? ' ▲' : ' ▼') : '';

          return e('th', {
            key: fieldName,
            className: `sortable ${isSorted && !hasAdvancedSort ? 'sorted' : ''}`,
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
      loading: false,
      focusFieldName: null
    };
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    // Close on ESC key if this row is expanded
    if (event.key === 'Escape' && this.state.expanded) {
      // If in edit mode, close the form first (exit edit mode)
      if (this.state.editMode) {
        this.setState({ editMode: false });
      } else {
        // If not in edit mode, close the detail view
        this.setState({ expanded: false });
      }
    }
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

  enterEditMode = (focusFieldName = null) => {
    const { permissions } = this.props;
    if (permissions && permissions.canUpdate) {
      this.setState({ editMode: true, expanded: true, focusFieldName });
    }
  }

  exitEditMode = () => {
    this.setState({ editMode: false, focusFieldName: null });
  }

  handleSave = (updatedData) => {
    // Update the full data with saved changes
    this.setState(prev => ({
      fullData: {
        ...prev.fullData,
        ...updatedData
      }
    }));

    // Don't notify parent on every field change (causes list refresh)
    // Parent refresh is only needed on delete or create, not on field updates
    // The autosave already updates the DB, so the data is persisted
    // if (this.props.onUpdate) {
    //   this.props.onUpdate();
    // }
  }

  handleDelete = async (e) => {
    e.stopPropagation();
    const { row, tableName, onUpdate } = this.props;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer cet enregistrement ?`)) {
      return;
    }

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh list
        if (onUpdate) {
          onUpdate();
        }
      } else {
        alert(`Erreur lors de la suppression : ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Erreur lors de la suppression : ${error.message}`);
    }
  }

  render() {
    const { row, fields, structure, displayMode, tableName, permissions, tableConfig, parentTable, showDeleteButton } = this.props;
    const { expanded, editMode, fullData, loading, focusFieldName } = this.state;

    if (displayMode === 'raw') {
      return e('tr', null,
        fields.map(fieldName =>
          e('td', { key: fieldName }, String(row[fieldName] || ''))
        )
      );
    }

    const displayData = fullData || row;

    return e(React.Fragment, null,
      // Always show the data row (no substitution)
      e('tr', {
        className: `data-row ${expanded ? 'expanded' : ''}`,
        onClick: this.toggleExpand,
        onDoubleClick: this.enterEditMode
      },
        // Delete button column (if enabled)
        showDeleteButton && permissions && permissions.canDelete && e('td', {
          key: 'delete-col',
          'data-label': 'Supprimer',
          style: { width: '40px', textAlign: 'center' }
        },
          e('button', {
            className: 'btn-delete-row',
            onClick: this.handleDelete,
            title: 'Supprimer cet enregistrement',
            style: {
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px'
            }
          }, '🗑️')
        ),
        // Granted column (always shown) - or Calendar icon for calendar tables
        e('td', {
          key: 'granted-col',
          'data-label': 'Statut',
          style: { width: '40px', textAlign: 'center', fontSize: '16px' }
        }, (() => {
          // Check if table has calendar configuration
          const tableConfig = SCHEMA_CONFIG?.tables?.[tableName];
          if (tableConfig?.calendar) {
            // Extract year and month from _dateRange if available
            const dateRangeValue = row._dateRange;
            if (dateRangeValue) {
              const yearMonthMatch = dateRangeValue.match(/(\d{4})/);
              const monthNames = {
                'janv.': '01', 'févr.': '02', 'mars': '03', 'avr.': '04',
                'mai': '05', 'juin': '06', 'juil.': '07', 'août': '08',
                'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12'
              };

              let calendarUrl = '/_calendar';
              if (yearMonthMatch) {
                const year = yearMonthMatch[1];
                const monthMatch = dateRangeValue.match(/(\w+\.?)\s+\d{4}/);
                if (monthMatch && monthNames[monthMatch[1]]) {
                  const month = monthNames[monthMatch[1]];
                  calendarUrl = `/_calendar/${year}/${month}`;
                }
              }

              return e('a', {
                href: calendarUrl,
                onClick: (ev) => ev.stopPropagation(),
                className: 'field-icon-link',
                title: 'Voir le calendrier'
              }, '📅');
            }
          }
          // Default: show granted icon
          return getGrantedIcon(row.granted);
        })()),
        // Regular field columns
        fields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];
          const relationData = row._relations && row._relations[fieldName];

          // Special label for _dateRange
          let label = field?.label || fieldName;
          if (fieldName === '_dateRange') {
            label = 'Période';
          }

          return e('td', {
            key: fieldName,
            'data-label': label  // Add data-label for responsive cards
          },
            relationData
              ? e(RelationRenderer, {
                  relation: relationData,
                  fieldName,
                  relatedTable: field.relation
                })
              : e(FieldRenderer, {
                  value,
                  field: field || { type: 'text' },
                  tableName,
                  fieldName
                })
          );
        })
      ),
      // Modal overlay when expanded
      expanded && e(RowDetailModal, {
        row: displayData,
        tableName,
        tableConfig: tableConfig || {},
        structure,
        permissions: permissions || {},
        editMode,
        loading,
        focusFieldName,
        onClose: () => this.setState({ expanded: false, editMode: false }),
        onEnterEditMode: this.enterEditMode,
        onExitEditMode: this.exitEditMode,
        onSave: this.handleSave,
        onUpdate: this.props.onUpdate,
        // Props for sub-lists (automatically enabled when parentTable is provided)
        parentTable: parentTable,
        hideRelations1N: !!parentTable
      })
    );
  }
}

/**
 * Get icon representing the granted status
 * @param {string} granted - The granted value (draft, shared, published @role)
 * @returns {string} - Emoji icon
 */
function getGrantedIcon(granted) {
  if (!granted || granted === 'draft') {
    return '📝'; // Draft - pencil
  } else if (granted === 'shared') {
    return '👥'; // Shared - people
  } else if (granted.startsWith('published @')) {
    return '🌐'; // Published - globe
  }
  return '📋'; // Default - clipboard
}

/**
 * Row Detail Modal Component
 * Full-screen modal with fixed header containing title, granted selector, and close button
 */
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
                      onUpdate();
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
    const { row, structure } = this.props;
    // Open "Strong" relations by default, keep "Weak" relations closed
    const strongRelations = new Set();

    if (structure && structure.fields) {
      Object.entries(structure.fields).forEach(([fieldName, field]) => {
        if (field.arrayName && field.relationshipStrength === 'Strong') {
          strongRelations.add(field.arrayName);
        }
      });
    }

    this.setState({ openRelations: strongRelations });
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

  isParentField(fieldName) {
    const { parentTable } = this.props;
    if (!parentTable) return false;

    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${lowerParent}`;
  }

  render() {
    const { row, structure, tableName, permissions, onEdit, parentTable, hideRelations1N } = this.props;
    const { openRelations } = this.state;

    const allFields = Object.keys(structure.fields).filter(f =>
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f) &&
      !this.isParentField(f)
    );

    // Add _dateRange at the beginning if it exists in row
    if (row._dateRange && !allFields.includes('_dateRange')) {
      allFields.unshift('_dateRange');
    }

    // Collect all 1:N relations defined in schema (even if empty)
    // Maintain order from schema definition
    const relations1N = [];

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

    // Fallback: Get 1:N relations from fields with arrayName (old method)
    if (relations1N.length === 0) {
      Object.entries(structure.fields).forEach(([fieldName, field]) => {
        if (field.arrayName) {
          const relName = field.arrayName;
          const relData = (row._relations && row._relations[relName]) || [];
          const relatedTable = field.relation;

          relations1N.push({
            name: relName,
            data: Array.isArray(relData) ? relData : [],
            relatedTable: relatedTable,
            relationshipStrength: field.relationshipStrength
          });
        }
      });
    }

    // Also include any 1:N relations from row._relations not yet in relations1N
    // (for backwards compatibility)
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

    const handleFieldClick = (fieldName, e) => {
      if (permissions && permissions.canUpdate) {
        e.stopPropagation();
        onEdit(fieldName);
      }
    };

    return e('div', { className: 'row-detail' },
      // Fields grid - clickable to edit
      e('div', {
        className: 'detail-fields',
        title: permissions && permissions.canUpdate ? 'Cliquer sur un champ pour éditer' : ''
      },
        allFields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];

          // Special label for _dateRange
          let label = field?.label || fieldName;
          if (fieldName === '_dateRange') {
            label = 'Période';
          }

          const relationN1 = row._relations && row._relations[fieldName] && !Array.isArray(row._relations[fieldName])
            ? row._relations[fieldName]
            : null;

          // Don't allow editing _dateRange (it's a computed field)
          const isClickable = permissions && permissions.canUpdate && fieldName !== '_dateRange';

          return e('div', {
            key: fieldName,
            className: 'detail-field',
            style: isClickable ? { cursor: 'pointer' } : {},
            onClick: isClickable ? (e) => handleFieldClick(fieldName, e) : undefined
          },
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
                    field: field || { type: 'text' },
                    tableName
                  })
            )
          );
        })
      ),

      // 1:N Relations (show all, even empty ones, unless hideRelations1N is true)
      !hideRelations1N && relations1N.length > 0 && e('div', { className: 'detail-relations-1n' },
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
                e('span', { className: 'relation-count badge' }, count)
              ),
              // Right side: "+ ajouter" button and three-dots menu
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
                hideHeader: true
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
      structure: null,
      tableConfig: null,
      permissions: null,
      orderBy: 'updatedAt',
      order: 'DESC',
      displayMode: 'default',
      showDeleteButtons: false,
      selectedFields: null,
      showFieldSelector: false
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

      // Also fetch table config and permissions
      const configResponse = await fetch(`/_crud/${tableName}/data?limit=1`);
      const configData = await configResponse.json();
      if (configData.success) {
        this.setState({
          tableConfig: configData.tableConfig,
          permissions: configData.permissions
        });
      }
    } catch (error) {
      console.error('Failed to fetch table structure:', error);
    }
  }

  handleDisplayModeChange = (mode) => {
    this.setState({ displayMode: mode });
  }

  handleToggleDeleteButtons = () => {
    this.setState(prev => ({ showDeleteButtons: !prev.showDeleteButtons }));
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
    });
  }

  handleSort = (fieldName) => {
    this.setState(prev => {
      if (prev.orderBy === fieldName) {
        // Cycle through: ASC -> DESC -> default (updatedAt DESC)
        if (prev.order === 'ASC') {
          return {
            orderBy: fieldName,
            order: 'DESC'
          };
        } else {
          // Third click: return to default sort
          return {
            orderBy: 'updatedAt',
            order: 'DESC'
          };
        }
      } else {
        // First click on a new field: start with ASC
        return {
          orderBy: fieldName,
          order: 'ASC'
        };
      }
    });
  }

  sortRows(rows, orderBy, order) {
    if (!rows || rows.length === 0) return rows;

    return [...rows].sort((a, b) => {
      let valA = a[orderBy];
      let valB = b[orderBy];

      // Handle null/undefined values
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Handle different types
      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      // Compare
      if (valA < valB) return order === 'ASC' ? -1 : 1;
      if (valA > valB) return order === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  render() {
    const { rows, tableName, parentTable, parentId, relationName, hideHeader } = this.props;
    const { structure, tableConfig, permissions, orderBy, order, displayMode, showDeleteButtons, selectedFields, showFieldSelector } = this.state;

    if (!rows || rows.length === 0) {
      // If hideHeader is true, don't show anything for empty lists
      if (hideHeader) {
        return null;
      }
      return e('div', { className: 'sub-list-empty' }, 'Aucune donnée');
    }

    if (!structure) {
      return e('div', { className: 'sub-list-loading' }, 'Chargement...');
    }

    // Get all fields from first row
    const firstRow = rows[0];
    const allFields = Object.keys(firstRow).filter(f =>
      !f.startsWith('_') &&
      !this.isParentField(f, parentTable)
    );

    // Filter fields based on display mode
    let fields;
    if (displayMode === 'raw') {
      fields = allFields;
    } else if (displayMode === 'all') {
      fields = allFields;
    } else if (displayMode === 'custom' && selectedFields && selectedFields.length > 0) {
      fields = selectedFields.filter(f => allFields.includes(f));
    } else {
      // default: exclude system fields
      fields = allFields.filter(f =>
        !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)
      );
    }

    // Sort rows
    const sortedRows = this.sortRows(rows, orderBy, order);

    // Get sort indicator text
    const sortIndicator = orderBy !== 'updatedAt' || order !== 'DESC'
      ? `Tri: ${orderBy} ${order === 'ASC' ? '▲' : '▼'}`
      : null;

    return e('div', { className: 'sub-list-container', style: { position: 'relative' } },
      // Header with "+ Nouveau" button and three-dots menu (only if not hideHeader)
      !hideHeader && e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginBottom: '4px', gap: '8px' } },
        // Left side: sort indicator
        e('div', { style: { fontSize: '12px', color: '#6c757d', fontStyle: 'italic', minHeight: '20px' } },
          sortIndicator || ''
        ),
        // Right side: buttons
        e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          parentId && e('button', {
            className: 'btn-add-relation-item',
            onClick: (ev) => {
              ev.stopPropagation();
              window.open(`/_crud/${tableName}?parent=${parentTable}&parentId=${parentId}`, '_blank');
            },
            title: `Créer un nouveau ${tableName}`
          }, '+ Nouveau'),
          e(ThreeDotsMenu, {
            displayMode,
            onDisplayModeChange: this.handleDisplayModeChange,
            onFieldSelect: this.handleShowFieldSelector,
            onToggleDelete: this.handleToggleDeleteButtons,
            showDeleteButtons
          })
        )
      ),

      // Table
      e('table', { className: 'sub-list-table' },
        e(TableHeader, {
          fields,
          structure,
          orderBy,
          order,
          onSort: this.handleSort,
          displayMode,
          showDeleteButton: showDeleteButtons,
          permissions
        }),
        e('tbody', null,
          sortedRows.map((row, idx) =>
            e(TableRow, {
              key: row.id || idx,
              row,
              fields,
              structure,
              tableName,
              parentTable,
              tableConfig,
              permissions,
              showDeleteButton: showDeleteButtons
            })
          )
        )
      ),

      // Field selector modal
      showFieldSelector && e(FieldSelectorModal, {
        allFields,
        selectedFields,
        structure,
        onApply: this.handleApplyFieldSelection,
        onClose: this.handleCloseFieldSelector
      })
    );
  }

  isParentField(fieldName, parentTable) {
    if (!parentTable || typeof parentTable !== 'string') return false;
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${lowerParent}`;
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
    const { displayMode, onDisplayModeChange, onFieldSelect, onToggleDelete, showDeleteButtons, onAdvancedSearch, onAdvancedSort, hasAdvancedSearch, hasAdvancedSort } = this.props;
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
        }, '🎯 Sélectionner les champs'),
        e('div', { className: 'menu-divider' }),
        onAdvancedSearch && e('button', {
          className: `menu-item ${hasAdvancedSearch ? 'active' : ''}`,
          onClick: () => this.handleOptionClick('onAdvancedSearch')
        }, hasAdvancedSearch ? '✓ ' : '', '🔍 Recherche avancée...'),
        onAdvancedSort && e('button', {
          className: `menu-item ${hasAdvancedSort ? 'active' : ''}`,
          onClick: () => this.handleOptionClick('onAdvancedSort')
        }, hasAdvancedSort ? '✓ ' : '', '📊 Tri avancé...'),
        onToggleDelete && [
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

/**
 * Advanced Sort Modal Component
 * Modal for configuring multiple sort criteria
 */
class AdvancedSortModal extends React.Component {
  constructor(props) {
    super(props);
    // Initialize with current sort or default
    const { currentOrderBy, currentOrder } = props;
    const initialCriteria = currentOrderBy && currentOrderBy !== 'updatedAt'
      ? [{ field: currentOrderBy, order: currentOrder || 'ASC' }]
      : [];

    this.state = {
      criteria: initialCriteria,
      relatedStructures: {} // Cache for related table structures
    };
  }

  async componentDidMount() {
    // Fetch structures for all related tables (level 1 and level 2)
    const { structure } = this.props;
    const relatedTables = new Set();

    // Find all N:1 relations from structure.relations (preferred method)
    if (structure.relations) {
      Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
        if (relationConfig.type === 'many-to-one') {
          relatedTables.add(relationConfig.relatedTable);
        }
      });
    }

    // Fallback: Find N:1 relations from structure.fields
    Object.entries(structure.fields).forEach(([fieldName, field]) => {
      if (field.relation && !field.arrayName) {
        relatedTables.add(field.relation);
      }
    });

    // Fetch structure for each related table (LEVEL 1)
    const relatedStructures = {};
    for (const tableName of relatedTables) {
      try {
        const response = await fetch(`/_crud/${tableName}/structure`);
        const data = await response.json();
        if (data.success && data.structure) {
          relatedStructures[tableName] = data.structure;
        }
      } catch (error) {
        console.error(`Failed to fetch structure for ${tableName}:`, error);
      }
    }

    // NOW FETCH LEVEL 2: For each level 1 table, fetch its N:1 relations
    const level2Tables = new Set();
    for (const [tableName, tableStructure] of Object.entries(relatedStructures)) {
      // Find N:1 relations in this level 1 table
      if (tableStructure.relations) {
        Object.entries(tableStructure.relations).forEach(([relationName, relationConfig]) => {
          if (relationConfig.type === 'many-to-one') {
            const level2TableName = relationConfig.relatedTable;
            // Store with prefix to track the path
            if (!relatedStructures[level2TableName]) {
              level2Tables.add(level2TableName);
            }
          }
        });
      }

      // Fallback: Find N:1 relations from fields
      Object.entries(tableStructure.fields || {}).forEach(([fieldName, field]) => {
        if (field.relation && !field.arrayName) {
          const level2TableName = field.relation;
          if (!relatedStructures[level2TableName]) {
            level2Tables.add(level2TableName);
          }
        }
      });
    }

    // Fetch level 2 structures
    for (const tableName of level2Tables) {
      try {
        const response = await fetch(`/_crud/${tableName}/structure`);
        const data = await response.json();
        if (data.success && data.structure) {
          relatedStructures[tableName] = data.structure;
        }
      } catch (error) {
        console.error(`Failed to fetch level 2 structure for ${tableName}:`, error);
      }
    }

    this.setState({ relatedStructures });
  }

  handleAddCriterion = () => {
    this.setState(prev => ({
      criteria: [...prev.criteria, { field: '', order: 'ASC' }]
    }));
  }

  handleRemoveCriterion = (index) => {
    this.setState(prev => ({
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  }

  handleCriterionChange = (index, key, value) => {
    this.setState(prev => {
      const newCriteria = [...prev.criteria];
      newCriteria[index] = { ...newCriteria[index], [key]: value };
      return { criteria: newCriteria };
    });
  }

  handleApply = () => {
    const { criteria } = this.state;
    if (this.props.onApply) {
      this.props.onApply(criteria);
    }
    this.props.onClose();
  }

  handleReset = () => {
    if (this.props.onApply) {
      this.props.onApply([]); // Empty criteria = default sort
    }
    this.props.onClose();
  }

  render() {
    const { structure, onClose } = this.props;
    const { criteria, relatedStructures } = this.state;

    // Get all sortable fields (table fields + n:1 relation fields + level 2 n:1 fields)
    const sortableFields = [];

    // Add table fields
    Object.entries(structure.fields).forEach(([fieldName, field]) => {
      if (!field.arrayName) { // Exclude 1:N relations
        sortableFields.push({
          value: fieldName,
          label: field.label || fieldName,
          isRelation: !!field.relation,
          group: 'Champs de la table'
        });

        // If this is an n:1 relation, add fields from the related table (LEVEL 1)
        if (field.relation && !field.arrayName) {
          const relatedTable = field.relation;
          const relatedStructure = relatedStructures[relatedTable];

          if (relatedStructure && relatedStructure.fields) {
            // Use actual fields from related table structure
            Object.entries(relatedStructure.fields).forEach(([relFieldName, relField]) => {
              // Exclude computed fields, arrayNames (1:N relations), and system fields
              if (!relField.as && !relField.calculate && !relField.arrayName &&
                  !['id', 'ownerId', 'granted'].includes(relFieldName)) {
                sortableFields.push({
                  value: `${relatedTable}.${relFieldName}`,
                  label: `${relatedTable} › ${relField.label || relFieldName}`,
                  isRelation: true,
                  group: `Relations N:1 (${relatedTable})`
                });

                // LEVEL 2: If this field is itself a N:1 relation, add its fields
                if (relField.relation && !relField.arrayName) {
                  const level2Table = relField.relation;
                  const level2Structure = relatedStructures[level2Table];

                  if (level2Structure && level2Structure.fields) {
                    Object.entries(level2Structure.fields).forEach(([level2FieldName, level2Field]) => {
                      // Exclude computed fields, arrayNames (1:N relations), and system fields
                      if (!level2Field.as && !level2Field.calculate && !level2Field.arrayName &&
                          !['id', 'ownerId', 'granted'].includes(level2FieldName)) {
                        sortableFields.push({
                          value: `${relatedTable}.${level2Table}.${level2FieldName}`,
                          label: `${relatedTable} › ${level2Table} › ${level2Field.label || level2FieldName}`,
                          isRelation: true,
                          group: `Relations N:1 niveau 2 (${relatedTable} › ${level2Table})`
                        });
                      }
                    });
                  }
                }
              }
            });
          }
        }
      }
    });

    // ALSO add fields from relations defined in structure.relations (modern method)
    if (structure.relations) {
      Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
        if (relationConfig.type === 'many-to-one' && relationConfig.accessible) {
          const relatedTable = relationConfig.relatedTable;
          const relatedStructure = relatedStructures[relatedTable];

          if (relatedStructure && relatedStructure.fields) {
            // Use actual fields from related table structure
            Object.entries(relatedStructure.fields).forEach(([relFieldName, relField]) => {
              // Exclude computed fields, arrayNames (1:N relations), and system fields
              if (!relField.as && !relField.calculate && !relField.arrayName &&
                  !['id', 'ownerId', 'granted'].includes(relFieldName)) {
                sortableFields.push({
                  value: `${relatedTable}.${relFieldName}`,
                  label: `${relationName} › ${relField.label || relFieldName}`,
                  isRelation: true,
                  group: `Relations N:1 (${relationName})`
                });

                // LEVEL 2: If this field is itself a N:1 relation, add its fields
                if (relField.relation && !relField.arrayName) {
                  const level2Table = relField.relation;
                  const level2Structure = relatedStructures[level2Table];

                  if (level2Structure && level2Structure.fields) {
                    Object.entries(level2Structure.fields).forEach(([level2FieldName, level2Field]) => {
                      // Exclude computed fields, arrayNames (1:N relations), and system fields
                      if (!level2Field.as && !level2Field.calculate && !level2Field.arrayName &&
                          !['id', 'ownerId', 'granted'].includes(level2FieldName)) {
                        sortableFields.push({
                          value: `${relatedTable}.${level2Table}.${level2FieldName}`,
                          label: `${relationName} › ${level2Table} › ${level2Field.label || level2FieldName}`,
                          isRelation: true,
                          group: `Relations N:1 niveau 2 (${relationName} › ${level2Table})`
                        });
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
    }

    return e('div', {
      className: 'modal-overlay',
      onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
    },
      e('div', {
        className: 'modal-content',
        onClick: (e) => e.stopPropagation(),
        style: { maxWidth: '600px' }
      },
        e('div', { className: 'modal-header' },
          e('h3', null, '📊 Tri avancé'),
          e('button', {
            className: 'modal-close',
            onClick: onClose
          }, '✖')
        ),
        e('div', { className: 'modal-body' },
          e('div', { style: { marginBottom: '16px' } },
            e('p', { style: { color: '#6c757d', fontSize: '14px', margin: '0 0 12px 0' } },
              'Définissez plusieurs critères de tri. Le premier critère est prioritaire.'
            )
          ),

          // Criteria list
          criteria.length === 0 && e('div', {
            style: {
              padding: '20px',
              textAlign: 'center',
              color: '#6c757d',
              background: '#f8f9fa',
              borderRadius: '4px'
            }
          }, 'Aucun critère de tri. Utilisez le tri par défaut (dernière modification).'),

          criteria.map((criterion, index) =>
            e('div', {
              key: index,
              style: {
                display: 'flex',
                gap: '8px',
                marginBottom: '8px',
                alignItems: 'center'
              }
            },
              e('span', {
                style: {
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6c757d',
                  minWidth: '30px'
                }
              }, `${index + 1}.`),
              e('select', {
                className: 'edit-field-select',
                style: { flex: 1 },
                value: criterion.field,
                onChange: (e) => this.handleCriterionChange(index, 'field', e.target.value)
              },
                e('option', { value: '' }, '-- Sélectionner un champ --'),
                sortableFields.map(field =>
                  e('option', { key: field.value, value: field.value },
                    field.label
                  )
                )
              ),
              e('select', {
                className: 'edit-field-select',
                style: { width: '120px' },
                value: criterion.order,
                onChange: (e) => this.handleCriterionChange(index, 'order', e.target.value)
              },
                e('option', { value: 'ASC' }, '▲ Croissant'),
                e('option', { value: 'DESC' }, '▼ Décroissant')
              ),
              e('button', {
                onClick: () => this.handleRemoveCriterion(index),
                style: {
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }
              }, '🗑️')
            )
          ),

          // Add button
          e('button', {
            onClick: this.handleAddCriterion,
            style: {
              marginTop: '12px',
              padding: '8px 12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }
          }, '+ Ajouter un critère')
        ),
        e('div', { className: 'modal-footer' },
          e('button', {
            className: 'btn-cancel',
            onClick: this.handleReset
          }, 'Réinitialiser'),
          e('button', {
            className: 'btn-cancel',
            onClick: onClose
          }, 'Annuler'),
          e('button', {
            className: 'btn-apply',
            onClick: this.handleApply
          }, 'Appliquer')
        )
      )
    );
  }
}

/**
 * Advanced Search Modal Component
 * Modal for configuring complex search conditions with AND/OR logic
 */
class AdvancedSearchModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchGroups: [
        {
          conditions: [
            { field: '', operator: 'contains', value: '' }
          ]
        }
      ],
      relatedStructures: {} // Cache for related table structures
    };
  }

  async componentDidMount() {
    // Fetch structures for all related tables (level 1 and level 2)
    const { structure } = this.props;
    const relatedTables = new Set();

    // Find all N:1 relations from structure.relations (preferred method)
    if (structure.relations) {
      Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
        if (relationConfig.type === 'many-to-one') {
          relatedTables.add(relationConfig.relatedTable);
        }
      });
    }

    // Fallback: Find N:1 relations from structure.fields
    Object.entries(structure.fields).forEach(([fieldName, field]) => {
      if (field.relation && !field.arrayName) {
        relatedTables.add(field.relation);
      }
    });

    // Fetch structure for each related table (LEVEL 1)
    const relatedStructures = {};
    for (const tableName of relatedTables) {
      try {
        const response = await fetch(`/_crud/${tableName}/structure`);
        const data = await response.json();
        if (data.success && data.structure) {
          relatedStructures[tableName] = data.structure;
        }
      } catch (error) {
        console.error(`Failed to fetch structure for ${tableName}:`, error);
      }
    }

    // NOW FETCH LEVEL 2: For each level 1 table, fetch its N:1 relations
    const level2Tables = new Set();
    for (const [tableName, tableStructure] of Object.entries(relatedStructures)) {
      // Find N:1 relations in this level 1 table
      if (tableStructure.relations) {
        Object.entries(tableStructure.relations).forEach(([relationName, relationConfig]) => {
          if (relationConfig.type === 'many-to-one') {
            const level2TableName = relationConfig.relatedTable;
            // Store with prefix to track the path
            if (!relatedStructures[level2TableName]) {
              level2Tables.add(level2TableName);
            }
          }
        });
      }

      // Fallback: Find N:1 relations from fields
      Object.entries(tableStructure.fields || {}).forEach(([fieldName, field]) => {
        if (field.relation && !field.arrayName) {
          const level2TableName = field.relation;
          if (!relatedStructures[level2TableName]) {
            level2Tables.add(level2TableName);
          }
        }
      });
    }

    // Fetch level 2 structures
    for (const tableName of level2Tables) {
      try {
        const response = await fetch(`/_crud/${tableName}/structure`);
        const data = await response.json();
        if (data.success && data.structure) {
          relatedStructures[tableName] = data.structure;
        }
      } catch (error) {
        console.error(`Failed to fetch level 2 structure for ${tableName}:`, error);
      }
    }

    this.setState({ relatedStructures });
  }

  // Get operators based on field type
  getOperatorsForField(fieldType) {
    const operators = {
      'varchar': [
        { value: 'contains', label: 'Contient' },
        { value: 'not_contains', label: 'Ne contient pas' },
        { value: 'equals', label: 'Égal à' },
        { value: 'not_equals', label: 'Différent de' },
        { value: 'starts_with', label: 'Commence par' },
        { value: 'ends_with', label: 'Se termine par' },
        { value: 'is_empty', label: 'Est vide' },
        { value: 'is_not_empty', label: 'N\'est pas vide' }
      ],
      'text': [
        { value: 'contains', label: 'Contient' },
        { value: 'not_contains', label: 'Ne contient pas' },
        { value: 'is_empty', label: 'Est vide' },
        { value: 'is_not_empty', label: 'N\'est pas vide' }
      ],
      'integer': [
        { value: 'equals', label: 'Égal à' },
        { value: 'not_equals', label: 'Différent de' },
        { value: 'greater_than', label: 'Supérieur à' },
        { value: 'less_than', label: 'Inférieur à' },
        { value: 'between', label: 'Entre' },
        { value: 'is_zero', label: 'Égal à zéro' },
        { value: 'is_not_zero', label: 'Différent de zéro' }
      ],
      'date': [
        { value: 'equals', label: 'Égal à' },
        { value: 'before', label: 'Avant' },
        { value: 'after', label: 'Après' },
        { value: 'between', label: 'Entre' }
      ],
      'datetime': [
        { value: 'equals', label: 'Égal à' },
        { value: 'before', label: 'Avant' },
        { value: 'after', label: 'Après' },
        { value: 'between', label: 'Entre' }
      ],
      'boolean': [
        { value: 'is_true', label: 'Est vrai' },
        { value: 'is_false', label: 'Est faux' }
      ]
    };

    return operators[fieldType] || operators['varchar'];
  }

  // Check if operator needs value input
  needsValue(operator) {
    return !['is_empty', 'is_not_empty', 'is_zero', 'is_not_zero', 'is_true', 'is_false'].includes(operator);
  }

  // Check if operator needs two values (between)
  needsTwoValues(operator) {
    return operator === 'between';
  }

  handleAddCondition = (groupIndex) => {
    this.setState(prev => {
      const newGroups = [...prev.searchGroups];
      newGroups[groupIndex].conditions.push({ field: '', operator: 'contains', value: '' });
      return { searchGroups: newGroups };
    });
  }

  handleRemoveCondition = (groupIndex, conditionIndex) => {
    this.setState(prev => {
      const newGroups = [...prev.searchGroups];
      if (newGroups[groupIndex].conditions.length > 1) {
        newGroups[groupIndex].conditions.splice(conditionIndex, 1);
      }
      return { searchGroups: newGroups };
    });
  }

  handleAddGroup = () => {
    this.setState(prev => ({
      searchGroups: [
        ...prev.searchGroups,
        { conditions: [{ field: '', operator: 'contains', value: '' }] }
      ]
    }));
  }

  handleRemoveGroup = (groupIndex) => {
    this.setState(prev => {
      if (prev.searchGroups.length > 1) {
        return {
          searchGroups: prev.searchGroups.filter((_, i) => i !== groupIndex)
        };
      }
      return prev;
    });
  }

  handleConditionChange = (groupIndex, conditionIndex, key, value) => {
    this.setState(prev => {
      const newGroups = [...prev.searchGroups];
      newGroups[groupIndex].conditions[conditionIndex] = {
        ...newGroups[groupIndex].conditions[conditionIndex],
        [key]: value
      };
      // If field changed, reset operator
      if (key === 'field') {
        newGroups[groupIndex].conditions[conditionIndex].operator = 'contains';
        newGroups[groupIndex].conditions[conditionIndex].value = '';
      }
      return { searchGroups: newGroups };
    });
  }

  handleApply = () => {
    const { searchGroups } = this.state;
    if (this.props.onApply) {
      this.props.onApply(searchGroups);
    }
    this.props.onClose();
  }

  handleReset = () => {
    if (this.props.onApply) {
      this.props.onApply(null); // null = no advanced search
    }
    this.props.onClose();
  }

  render() {
    const { structure, onClose } = this.props;
    const { searchGroups, relatedStructures } = this.state;

    // Get all searchable fields (table fields + n:1 relation fields + level 2 n:1 fields)
    const searchableFields = [];

    // Add table fields
    Object.entries(structure.fields).forEach(([fieldName, field]) => {
      if (!field.arrayName && !field.as && !field.calculate) { // Exclude 1:N relations and computed fields
        searchableFields.push({
          value: fieldName,
          label: field.label || fieldName,
          type: field.type || 'varchar',
          isRelation: !!field.relation,
          group: 'Champs de la table'
        });

        // If this is an n:1 relation, add fields from the related table (LEVEL 1)
        if (field.relation && !field.arrayName) {
          const relatedTable = field.relation;
          const relatedStructure = relatedStructures[relatedTable];

          if (relatedStructure && relatedStructure.fields) {
            // Use actual fields from related table structure
            Object.entries(relatedStructure.fields).forEach(([relFieldName, relField]) => {
              // Exclude computed fields, arrayNames (1:N relations), and system fields
              if (!relField.as && !relField.calculate && !relField.arrayName &&
                  !['id', 'ownerId', 'granted'].includes(relFieldName)) {
                searchableFields.push({
                  value: `${relatedTable}.${relFieldName}`,
                  label: `${relatedTable} › ${relField.label || relFieldName}`,
                  type: relField.type || 'varchar',
                  isRelation: true,
                  group: `Relations N:1 (${relatedTable})`
                });

                // LEVEL 2: If this field is itself a N:1 relation, add its fields
                if (relField.relation && !relField.arrayName) {
                  const level2Table = relField.relation;
                  const level2Structure = relatedStructures[level2Table];

                  if (level2Structure && level2Structure.fields) {
                    Object.entries(level2Structure.fields).forEach(([level2FieldName, level2Field]) => {
                      // Exclude computed fields, arrayNames (1:N relations), and system fields
                      if (!level2Field.as && !level2Field.calculate && !level2Field.arrayName &&
                          !['id', 'ownerId', 'granted'].includes(level2FieldName)) {
                        searchableFields.push({
                          value: `${relatedTable}.${level2Table}.${level2FieldName}`,
                          label: `${relatedTable} › ${level2Table} › ${level2Field.label || level2FieldName}`,
                          type: level2Field.type || 'varchar',
                          isRelation: true,
                          group: `Relations N:1 niveau 2 (${relatedTable} › ${level2Table})`
                        });
                      }
                    });
                  }
                }
              }
            });
          }
        }
      }
    });

    // ALSO add fields from relations defined in structure.relations (modern method)
    if (structure.relations) {
      Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
        if (relationConfig.type === 'many-to-one' && relationConfig.accessible) {
          const relatedTable = relationConfig.relatedTable;
          const relatedStructure = relatedStructures[relatedTable];

          if (relatedStructure && relatedStructure.fields) {
            // Use actual fields from related table structure
            Object.entries(relatedStructure.fields).forEach(([relFieldName, relField]) => {
              // Exclude computed fields, arrayNames (1:N relations), and system fields
              if (!relField.as && !relField.calculate && !relField.arrayName &&
                  !['id', 'ownerId', 'granted'].includes(relFieldName)) {
                searchableFields.push({
                  value: `${relatedTable}.${relFieldName}`,
                  label: `${relationName} › ${relField.label || relFieldName}`,
                  type: relField.type || 'varchar',
                  isRelation: true,
                  group: `Relations N:1 (${relationName})`
                });

                // LEVEL 2: If this field is itself a N:1 relation, add its fields
                if (relField.relation && !relField.arrayName) {
                  const level2Table = relField.relation;
                  const level2Structure = relatedStructures[level2Table];

                  if (level2Structure && level2Structure.fields) {
                    Object.entries(level2Structure.fields).forEach(([level2FieldName, level2Field]) => {
                      // Exclude computed fields, arrayNames (1:N relations), and system fields
                      if (!level2Field.as && !level2Field.calculate && !level2Field.arrayName &&
                          !['id', 'ownerId', 'granted'].includes(level2FieldName)) {
                        searchableFields.push({
                          value: `${relatedTable}.${level2Table}.${level2FieldName}`,
                          label: `${relationName} › ${level2Table} › ${level2Field.label || level2FieldName}`,
                          type: level2Field.type || 'varchar',
                          isRelation: true,
                          group: `Relations N:1 niveau 2 (${relationName} › ${level2Table})`
                        });
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
    }

    return e('div', {
      className: 'modal-overlay',
      onClick: (e) => { if (e.target === e.currentTarget) onClose(); }
    },
      e('div', {
        className: 'modal-content',
        onClick: (e) => e.stopPropagation(),
        style: { maxWidth: '700px', maxHeight: '90vh' }
      },
        e('div', { className: 'modal-header' },
          e('h3', null, '🔍 Recherche avancée'),
          e('button', {
            className: 'modal-close',
            onClick: onClose
          }, '✖')
        ),
        e('div', { className: 'modal-body', style: { maxHeight: '60vh', overflowY: 'auto' } },
          e('div', { style: { marginBottom: '16px' } },
            e('p', { style: { color: '#6c757d', fontSize: '14px', margin: '0 0 8px 0' } },
              'Créez des conditions de recherche complexes avec logique ET/OU.'
            ),
            e('p', { style: { color: '#6c757d', fontSize: '13px', margin: 0, fontStyle: 'italic' } },
              'Les conditions dans un même groupe sont liées par ET. Les groupes sont liés par OU.'
            )
          ),

          // Search groups (OR logic between groups)
          searchGroups.map((group, groupIndex) =>
            e('div', {
              key: groupIndex,
              style: {
                background: '#f8f9fa',
                border: '2px solid #dee2e6',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
              }
            },
              // Group header
              e('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }
              },
                e('strong', { style: { fontSize: '14px', color: '#495057' } },
                  groupIndex === 0 ? 'Recherche' : `OU Recherche #${groupIndex + 1}`
                ),
                searchGroups.length > 1 && e('button', {
                  onClick: () => this.handleRemoveGroup(groupIndex),
                  style: {
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }
                }, '🗑️ Supprimer groupe')
              ),

              // Conditions (AND logic within group)
              group.conditions.map((condition, conditionIndex) => {
                const selectedField = searchableFields.find(f => f.value === condition.field);
                const fieldType = selectedField ? selectedField.type : 'varchar';
                const operators = this.getOperatorsForField(fieldType);

                return e('div', {
                  key: conditionIndex,
                  style: {
                    background: 'white',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '8px'
                  }
                },
                  e('div', {
                    style: {
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap'
                    }
                  },
                    conditionIndex > 0 && e('span', {
                      style: {
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#28a745',
                        padding: '6px 8px',
                        minWidth: '40px'
                      }
                    }, 'ET'),

                    // Field selector
                    e('select', {
                      className: 'edit-field-select',
                      style: { flex: '1 1 200px', minWidth: '150px' },
                      value: condition.field,
                      onChange: (e) => this.handleConditionChange(groupIndex, conditionIndex, 'field', e.target.value)
                    },
                      e('option', { value: '' }, '-- Champ --'),
                      searchableFields.map(field =>
                        e('option', { key: field.value, value: field.value },
                          field.label + (field.isRelation ? ' 🔗' : '')
                        )
                      )
                    ),

                    // Operator selector
                    e('select', {
                      className: 'edit-field-select',
                      style: { flex: '1 1 150px', minWidth: '120px' },
                      value: condition.operator,
                      onChange: (e) => this.handleConditionChange(groupIndex, conditionIndex, 'operator', e.target.value),
                      disabled: !condition.field
                    },
                      operators.map(op =>
                        e('option', { key: op.value, value: op.value }, op.label)
                      )
                    ),

                    // Value input
                    this.needsValue(condition.operator) && e('input', {
                      type: fieldType === 'date' ? 'date' : (fieldType === 'datetime' ? 'datetime-local' : (fieldType === 'integer' ? 'number' : 'text')),
                      className: 'edit-field-input',
                      style: { flex: '1 1 150px', minWidth: '120px' },
                      value: condition.value || '',
                      onChange: (e) => this.handleConditionChange(groupIndex, conditionIndex, 'value', e.target.value),
                      placeholder: this.needsTwoValues(condition.operator) ? 'De...' : 'Valeur...'
                    }),

                    // Second value for "between"
                    this.needsTwoValues(condition.operator) && e('input', {
                      type: fieldType === 'date' ? 'date' : (fieldType === 'datetime' ? 'datetime-local' : (fieldType === 'integer' ? 'number' : 'text')),
                      className: 'edit-field-input',
                      style: { flex: '1 1 150px', minWidth: '120px' },
                      value: condition.value2 || '',
                      onChange: (e) => this.handleConditionChange(groupIndex, conditionIndex, 'value2', e.target.value),
                      placeholder: 'À...'
                    }),

                    // Remove button
                    group.conditions.length > 1 && e('button', {
                      onClick: () => this.handleRemoveCondition(groupIndex, conditionIndex),
                      style: {
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        minWidth: '35px'
                      }
                    }, '🗑️')
                  )
                );
              }),

              // Add condition button
              e('button', {
                onClick: () => this.handleAddCondition(groupIndex),
                style: {
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }
              }, '+ Ajouter condition ET')
            )
          ),

          // Add group button
          e('button', {
            onClick: this.handleAddGroup,
            style: {
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '8px'
            }
          }, '+ Ajouter groupe OU')
        ),
        e('div', { className: 'modal-footer' },
          e('button', {
            className: 'btn-cancel',
            onClick: this.handleReset
          }, 'Réinitialiser'),
          e('button', {
            className: 'btn-cancel',
            onClick: onClose
          }, 'Annuler'),
          e('button', {
            className: 'btn-apply',
            onClick: this.handleApply
          }, 'Appliquer')
        )
      )
    );
  }
}

/**
 * Create Form Modal Component
 * Modal for creating a new record
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
        const lowerField = fieldName.toLowerCase();
        const lowerParent = parentTable.toLowerCase();
        if (lowerField.includes(lowerParent) || lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
          formData[fieldName] = parseInt(parentId);
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
      saveStatus: 'idle', // idle, saving, error
      errors: {},
      newRecordId: null
    };

    this.fieldRefs = {};
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
      if (parentTable && typeof parentTable === 'string') {
        const lowerField = f.toLowerCase();
        const lowerParent = parentTable.toLowerCase();
        if (lowerField.includes(lowerParent) || lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
          return false;
        }
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
      }
    }));
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
              const lowerField = fieldName.toLowerCase();
              const lowerParent = parentTable.toLowerCase();
              if (lowerField.includes(lowerParent) || lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
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
      }
    }));
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
    if (parentTable && typeof parentTable === 'string') {
      const lowerField = fieldName.toLowerCase();
      const lowerParent = parentTable.toLowerCase();
      if (lowerField.includes(lowerParent) || lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
        return null; // Hidden field
      }
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

    // Render based on field type
    switch (field.type) {
      case 'text':
        return e('div', { key: fieldName, className: 'edit-field' },
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
    const { saveStatus, errors } = this.state;

    // Get editable fields (exclude system fields, granted, and parent field in sub-lists)
    const editableFields = Object.keys(structure.fields).filter(f => {
      if (['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)) return false;
      const field = structure.fields[f];
      if (field.as || field.calculate) return false;
      // Hide parent field if this is a 1:N creation
      if (parentTable && typeof parentTable === 'string') {
        const lowerField = f.toLowerCase();
        const lowerParent = parentTable.toLowerCase();
        if (lowerField.includes(lowerParent) || lowerField === `${lowerParent}id` || lowerField === `id${lowerParent}`) {
          return false;
        }
      }
      return true;
    });

    return e('div', {
      className: 'modal-overlay-detail',
      onClick: this.handleOverlayClick
    },
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

            // Save indicator
            saveStatus === 'saving' && e('div', {
              style: { padding: '8px 12px', marginBottom: '12px', textAlign: 'center', background: '#d1ecf1', borderRadius: '4px' }
            }, '💾 Création en cours...'),
            saveStatus === 'success' && e('div', {
              style: { padding: '8px 12px', marginBottom: '12px', textAlign: 'center', background: '#d4edda', borderRadius: '4px', color: '#155724' }
            }, '✅ Fiche créée avec succès ! Le formulaire a été réinitialisé.'),

            // Form fields grid
            e('div', { className: 'edit-form-grid' },
              editableFields.map((fieldName) => {
                const field = structure.fields[fieldName];
                return this.renderField(fieldName, field);
              })
            ),

            // Submit button
            e('div', { style: { marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              e('button', {
                type: 'button',
                className: 'btn-cancel',
                onClick: onClose
              }, 'Annuler'),
              e('button', {
                type: 'submit',
                className: 'btn-apply',
                disabled: saveStatus === 'saving'
              }, saveStatus === 'saving' ? 'Création...' : 'Créer')
            )
          )
        )
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
    // Flag to track if URL parameters have been processed
    // This prevents processing them multiple times on re-renders
    this.urlParametersProcessed = false;
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
      showDeleteButtons: false,
      showCreateForm: false,
      createFormParentTable: null,
      createFormParentId: null,
      createFormDefaultValues: {},
      showAdvancedSearch: false,
      advancedSearchCriteria: null,
      showAdvancedSort: false,
      advancedSortCriteria: [],
      page: 0,
      limit: 100,
      // Fullscreen modal for single record view (when initialRecordId is provided)
      fullscreenRecordId: props.initialRecordId || null,
      fullscreenRecord: null,
      fullscreenRecordLoading: false,
      fullscreenRecordEditMode: false
    };
  }

  async componentDidMount() {
    console.log('[CrudList] componentDidMount() called');
    this.loadSchema();

    // If initialRecordId is provided, load only that record for fullscreen view
    if (this.props.initialRecordId) {
      await this.loadFullscreenRecord(this.props.initialRecordId);
    } else {
      // Wait for data to load before checking URL parameters
      // This ensures the form can be displayed when coming from calendar
      await this.loadData();
    }

    this.loadUserPreferences();

    // URL parameters will be checked in componentDidUpdate when data is available
    // This is crucial for calendar integration where we need data.structure
    // to be available before opening the create form
    console.log('[CrudList] componentDidMount complete, URL parameters will be checked when data is available');
  }

  componentDidUpdate(prevProps, prevState) {
    console.log('[CrudList] componentDidUpdate() called');
    console.log('[CrudList] prevState.data:', prevState.data ? 'available' : 'null');
    console.log('[CrudList] this.state.data:', this.state.data ? 'available' : 'null');
    console.log('[CrudList] urlParametersProcessed:', this.urlParametersProcessed);

    // If data just became available for the first time
    // AND we haven't processed URL parameters yet
    // This ensures the create form can be opened with data.structure available
    if (!prevState.data && this.state.data && !this.urlParametersProcessed) {
      console.log('[CrudList] Conditions met, calling checkURLParameters()');
      this.urlParametersProcessed = true;
      this.checkURLParameters();
    } else {
      console.log('[CrudList] Conditions NOT met for calling checkURLParameters()');
      if (this.urlParametersProcessed) {
        console.log('[CrudList] → URL parameters already processed');
      }
      if (prevState.data) {
        console.log('[CrudList] → Data was already available in previous state');
      }
      if (!this.state.data) {
        console.log('[CrudList] → Data not yet available in current state');
      }
    }
  }

  /**
   * Load a single record for fullscreen modal view
   * Used when initialRecordId prop is provided
   */
  loadFullscreenRecord = async (recordId) => {
    this.setState({ fullscreenRecordLoading: true });

    try {
      // First, load schema and structure (needed for modal)
      const structureResponse = await fetch(`/_crud/${this.props.table}/structure`);
      const structureData = await structureResponse.json();

      if (!structureData.success) {
        throw new Error('Failed to load table structure');
      }

      // Load a minimal dataset to get tableConfig and permissions
      const configResponse = await fetch(`/_crud/${this.props.table}/data?limit=1`);
      const configData = await configResponse.json();

      if (!configData.success) {
        throw new Error('Failed to load table config');
      }

      // Use TableDataService endpoint to get full record with relations
      
      const response = await fetch(`/_api/${this.props.table}/${recordId}?relation=all&compact=1`);
      const recordData = await response.json();
      
      recordData.row = recordData?.rows[0] // BUG trouvé
      if (recordData.success && recordData.row) {  // BUG row n'était pas défini
        // Set data with structure, tableConfig, and permissions for the modal
        this.setState({
          fullscreenRecord: recordData.row,
          fullscreenRecordLoading: false, 
          loading: false,
          data: {
            structure: structureData.structure,
            tableConfig: configData.tableConfig,
            permissions: configData.permissions
          }
        });
      } else {
        this.setState({
          error: recordData.error || 'Enregistrement non trouvé',
          fullscreenRecordLoading: false,
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to load fullscreen record:', error);
      this.setState({
        error: 'Erreur lors du chargement de l\'enregistrement',
        fullscreenRecordLoading: false,
        loading: false
      });
    }
  }

  /**
   * Close fullscreen modal and navigate back to list view or calendar
   */
  closeFullscreenModal = () => {
    // Check if we came from calendar (sessionStorage set in calendar eventClick)
    const returnView = sessionStorage.getItem('calendarReturnView');
    const returnDate = sessionStorage.getItem('calendarReturnDate');

    if (returnView && returnDate) {
      // Return to calendar with saved view and date
      window.location.href = '/_calendar';
    } else {
      // Navigate back to table list view
      window.location.href = `/_crud/${this.props.table}`;
    }
  }

  /**
   * Update fullscreen record after edit
   * Updated to avoid unnecessary reloads - just update local state
   */
  updateFullscreenRecord = (updatedData) => {
    if (this.state.fullscreenRecordId && updatedData) {
      // Update only the changed fields in local state
      // This prevents full reload and clignotement
      this.setState(prev => ({
        fullscreenRecord: {
          ...prev.fullscreenRecord,
          ...updatedData
        }
      }));
    }
    // If called without data, do nothing (field-level autosave handles updates)
  }

  checkURLParameters() {
    console.log('='.repeat(80));
    console.log('[CrudList] checkURLParameters() called');
    console.log('[CrudList] Full URL:', window.location.href);
    console.log('[CrudList] Pathname:', window.location.pathname);
    console.log('[CrudList] Search string:', window.location.search);
    console.log('[CrudList] Search length:', window.location.search.length);
    console.log('[CrudList] State.data available:', this.state.data ? 'YES' : 'NO');

    // Parse URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const parent = urlParams.get('parent');
    const parentId = urlParams.get('parentId');
    const openRecordId = urlParams.get('open');

    console.log('[CrudList] Parsed params:');
    console.log('  - parent:', parent);
    console.log('  - parentId:', parentId);
    console.log('  - openRecordId:', openRecordId);

    // Extract all URL parameters as default values for form fields
    const defaultValues = {};
    let paramCount = 0;
    for (const [key, value] of urlParams.entries()) {
      paramCount++;
      console.log(`[CrudList] URL param #${paramCount}: ${key} = ${value}`);
      // Skip special parameters: parent, parentId, open
      if (key !== 'parent' && key !== 'parentId' && key !== 'open') {
        defaultValues[key] = value;
      }
    }

    console.log('[CrudList] Total URL params found:', paramCount);
    console.log('[CrudList] Extracted defaultValues:', defaultValues);
    console.log('[CrudList] defaultValues count:', Object.keys(defaultValues).length);

    // If 'open' parameter is provided, load that record in fullscreen mode
    if (openRecordId) {
      console.log('[CrudList] Opening record in fullscreen mode:', openRecordId);
      this.setState({
        fullscreenRecordId: parseInt(openRecordId)
      });
      this.loadFullscreenRecord(parseInt(openRecordId));
      return; // Don't process other parameters if opening a specific record
    }

    // If parent and parentId are provided, open create form automatically
    if (parent && parentId) {
      console.log('[CrudList] Opening create form with parent:', parent, parentId);
      this.setState({
        showCreateForm: true,
        createFormParentTable: parent,
        createFormParentId: parseInt(parentId),
        createFormDefaultValues: defaultValues
      });
    } else if (Object.keys(defaultValues).length > 0) {
      // If there are default values but no parent, still open the form
      console.log('[CrudList] Opening create form with default values:', defaultValues);
      this.setState({
        showCreateForm: true,
        createFormDefaultValues: defaultValues
      });
    } else {
      console.log('[CrudList] No URL parameters to process');
    }
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
          selectedFields: parsed.selectedFields || null,
          orderBy: parsed.orderBy || 'updatedAt',
          order: parsed.order || 'DESC',
          advancedSortCriteria: parsed.advancedSortCriteria || [],
          advancedSearchCriteria: parsed.advancedSearchCriteria || null
        });
      } catch (e) {
        console.error('Failed to parse preferences:', e);
      }
    }
  }

  saveUserPreferences = () => {
    const { displayMode, selectedFields, orderBy, order, advancedSortCriteria, advancedSearchCriteria } = this.state;
    const prefs = JSON.stringify({ displayMode, selectedFields, orderBy, order, advancedSortCriteria, advancedSearchCriteria });
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
    const { search, orderBy, order, page, limit, displayMode, selectedFields, advancedSearchCriteria, advancedSortCriteria } = this.state;

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

      // Add advanced search criteria
      if (advancedSearchCriteria) {
        params.set('advancedSearch', JSON.stringify(advancedSearchCriteria));
      }

      // Add advanced sort criteria
      if (advancedSortCriteria && advancedSortCriteria.length > 0) {
        params.set('advancedSort', JSON.stringify(advancedSortCriteria));
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
        // Cycle through: ASC -> DESC -> default (updatedAt DESC)
        if (prev.order === 'ASC') {
          return {
            orderBy: fieldName,
            order: 'DESC',
            advancedSortCriteria: [] // Clear advanced sort when using simple sort
          };
        } else {
          // Third click: return to default sort
          return {
            orderBy: 'updatedAt',
            order: 'DESC',
            advancedSortCriteria: []
          };
        }
      } else {
        // First click on a new field: start with ASC
        return {
          orderBy: fieldName,
          order: 'ASC',
          advancedSortCriteria: [] // Clear advanced sort when using simple sort
        };
      }
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
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

  handleToggleDeleteButtons = () => {
    this.setState(prev => ({ showDeleteButtons: !prev.showDeleteButtons }));
  }

  handleAddNew = (parentTable = null, parentId = null, defaultValues = {}) => {
    console.log('[CrudList] handleAddNew called - parentTable:', parentTable, 'parentId:', parentId, 'defaultValues:', defaultValues);
    this.setState({
      showCreateForm: true,
      createFormParentTable: parentTable,
      createFormParentId: parentId,
      createFormDefaultValues: defaultValues
    }, () => {
      console.log('[CrudList] State updated - showCreateForm:', this.state.showCreateForm);
    });
  }

  handleCloseCreateForm = () => {
    // Check if we came from calendar
    const returnView = sessionStorage.getItem('calendarReturnView');
    const returnDate = sessionStorage.getItem('calendarReturnDate');

    if (returnView && returnDate) {
      // Return to calendar with saved view and date
      window.location.href = '/_calendar';
    } else {
      // Just close the form
      this.setState({
        showCreateForm: false,
        createFormParentTable: null,
        createFormParentId: null,
        createFormDefaultValues: {}
      });
    }
  }

  handleCreateSuccess = () => {
    // Check if we came from calendar
    const returnView = sessionStorage.getItem('calendarReturnView');
    const returnDate = sessionStorage.getItem('calendarReturnDate');

    if (returnView && returnDate) {
      // Return to calendar with saved view and date
      window.location.href = '/_calendar';
    } else {
      // Reload data after successful creation
      this.loadData();
      this.handleCloseCreateForm();
    }
  }

  handleShowAdvancedSearch = () => {
    this.setState({ showAdvancedSearch: true });
  }

  handleCloseAdvancedSearch = () => {
    this.setState({ showAdvancedSearch: false });
  }

  handleApplyAdvancedSearch = (searchCriteria) => {
    this.setState({
      advancedSearchCriteria: searchCriteria,
      page: 0 // Reset to first page
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  handleShowAdvancedSort = () => {
    this.setState({ showAdvancedSort: true });
  }

  handleCloseAdvancedSort = () => {
    this.setState({ showAdvancedSort: false });
  }

  handleApplyAdvancedSort = (sortCriteria) => {
    this.setState({
      advancedSortCriteria: sortCriteria,
      showAdvancedSort: false
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  handleCancelSort = () => {
    this.setState({
      orderBy: 'updatedAt',
      order: 'DESC',
      advancedSortCriteria: []
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  getSortRepresentation = () => {
    const { advancedSortCriteria, orderBy, order, data } = this.state;

    // If advanced sort is active
    if (advancedSortCriteria && advancedSortCriteria.length > 0) {
      return advancedSortCriteria
        .filter(criterion => criterion.field)
        .map(criterion => {
          const arrow = criterion.order === 'DESC' ? '▼' : '▲';
          // Get field label from structure
          let fieldLabel = criterion.field;
          if (data && data.structure) {
            // Handle relation fields (format: Table.field)
            if (criterion.field.includes('.')) {
              const [tableName, fieldName] = criterion.field.split('.');
              fieldLabel = `${tableName}.${fieldName}`;
            } else {
              const field = data.structure.fields[criterion.field];
              fieldLabel = field?.label || criterion.field;
            }
          }
          return `${fieldLabel} ${arrow}`;
        })
        .join(', ');
    }

    // Simple sort (including default sort)
    const arrow = order === 'DESC' ? '▼' : '▲';
    let fieldLabel = orderBy;
    if (data && data.structure) {
      // Handle relation fields (format: Table.field)
      if (orderBy.includes('.')) {
        const parts = orderBy.split('.');
        // Remove main table prefix if present (e.g., "MusicAlbum.Organization.name" → "Organization.name")
        if (parts.length === 3) {
          fieldLabel = `${parts[1]}.${parts[2]}`;
        } else {
          fieldLabel = orderBy;
        }
      } else {
        const field = data.structure.fields[orderBy];
        fieldLabel = field?.label || orderBy;
      }
    }
    return `${fieldLabel} ${arrow}`;
  }

  getSearchRepresentation = () => {
    const { advancedSearchCriteria, data } = this.state;

    if (!advancedSearchCriteria) {
      return null;
    }

    // Build a representation of the search criteria
    const parts = [];

    if (advancedSearchCriteria.field && advancedSearchCriteria.operator && advancedSearchCriteria.value) {
      let fieldLabel = advancedSearchCriteria.field;
      if (data && data.structure) {
        // Handle relation fields (format: Table.field)
        if (advancedSearchCriteria.field.includes('.')) {
          const [tableName, fieldName] = advancedSearchCriteria.field.split('.');
          fieldLabel = `${tableName}.${fieldName}`;
        } else {
          const field = data.structure.fields[advancedSearchCriteria.field];
          fieldLabel = field?.label || advancedSearchCriteria.field;
        }
      }

      const operatorLabels = {
        'equals': '=',
        'notEquals': '≠',
        'contains': '⊃',
        'notContains': '⊅',
        'startsWith': 'commence par',
        'endsWith': 'finit par',
        'greaterThan': '>',
        'lessThan': '<',
        'greaterOrEqual': '≥',
        'lessOrEqual': '≤',
        'isNull': 'est vide',
        'isNotNull': 'n\'est pas vide'
      };

      const operatorLabel = operatorLabels[advancedSearchCriteria.operator] || advancedSearchCriteria.operator;

      if (advancedSearchCriteria.operator === 'isNull' || advancedSearchCriteria.operator === 'isNotNull') {
        parts.push(`${fieldLabel} ${operatorLabel}`);
      } else {
        parts.push(`${fieldLabel} ${operatorLabel} "${advancedSearchCriteria.value}"`);
      }
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  handleCancelSearch = () => {
    this.setState({
      advancedSearchCriteria: null,
      page: 0
    }, () => {
      this.saveUserPreferences();
      this.loadData();
    });
  }

  render() {
    const { table } = this.props;
    const {
      loading,
      error,
      data,
      search,
      orderBy,
      order,
      displayMode,
      showFieldSelector,
      selectedFields,
      showDeleteButtons,
      showCreateForm,
      createFormParentTable,
      createFormParentId,
      createFormDefaultValues,
      showAdvancedSearch,
      advancedSearchCriteria,
      showAdvancedSort,
      advancedSortCriteria,
      fullscreenRecordId,
      fullscreenRecord,
      fullscreenRecordLoading,
      fullscreenRecordEditMode
    } = this.state;

    // If initialRecordId is provided, show only fullscreen modal
    if (fullscreenRecordId) {
      if (fullscreenRecordLoading) {
        return e('div', { className: 'loading' }, 'Chargement de l\'enregistrement...');
      }

      if (error) {
        return e('div', { className: 'error-fullscreen' },
          e('h2', null, 'Erreur'),
          e('p', null, error),
          e('button', {
            onClick: this.closeFullscreenModal,
            className: 'btn-back'
          }, '← Retour à la liste')
        );
      }

      if (!fullscreenRecord || !data) {
        return e('div', { className: 'loading' }, 'Chargement...');
      }

      // Display fullscreen modal with the record
      // Wrap in crud-list-container to ensure proper CSS and layout
      return e('div', { className: 'crud-list-container' },
        e(RowDetailModal, {
          row: fullscreenRecord,
          tableName: table,
          tableConfig: data.tableConfig || {},
          structure: data.structure || {},
          permissions: data.permissions || {},
          editMode: fullscreenRecordEditMode,
          loading: false,
          focusFieldName: null,
          onClose: this.closeFullscreenModal,
          onEnterEditMode: () => this.setState({ fullscreenRecordEditMode: true }),
          onExitEditMode: () => this.setState({ fullscreenRecordEditMode: false }),
          onSave: this.updateFullscreenRecord,
          onUpdate: this.updateFullscreenRecord,
          parentTable: null,
          hideRelations1N: false
        })
      );
    }

    const sortRepresentation = this.getSortRepresentation();
    const hasAdvancedSort = advancedSortCriteria && advancedSortCriteria.length > 0;
    const searchRepresentation = this.getSearchRepresentation();
    const hasAdvancedSearch = !!advancedSearchCriteria;

    return e('div', { className: 'crud-list-container' },
      // Header
      e('div', { className: 'crud-header' },
        e('div', { className: 'crud-title-container' },
          e('h1', { className: 'crud-title' }, '📋 ', table),
          sortRepresentation && e('span', {
            className: 'sort-indicator',
            onClick: hasAdvancedSort ? this.handleShowAdvancedSort : null,
            style: {
              fontSize: '0.8em',
              marginLeft: '10px',
              color: '#666',
              cursor: hasAdvancedSort ? 'pointer' : 'default',
              fontWeight: 'normal'
            },
            title: hasAdvancedSort ? 'Cliquer pour modifier le tri avancé' : 'Tri actif'
          },
            hasAdvancedSort && e('span', {
              onClick: (ev) => {
                ev.stopPropagation();
                this.handleCancelSort();
              },
              style: {
                color: 'red',
                marginRight: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              },
              title: 'Annuler le tri et revenir au défaut'
            }, '✕ '),
            'Tri : ', sortRepresentation
          ),
          searchRepresentation && e('span', {
            className: 'search-indicator',
            onClick: this.handleShowAdvancedSearch,
            style: {
              fontSize: '0.8em',
              marginLeft: '10px',
              color: '#666',
              cursor: 'pointer',
              fontWeight: 'normal'
            },
            title: 'Cliquer pour modifier la recherche avancée'
          },
            e('span', {
              onClick: (ev) => {
                ev.stopPropagation();
                this.handleCancelSearch();
              },
              style: {
                color: 'red',
                marginRight: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              },
              title: 'Annuler la recherche'
            }, '✕ '),
            'Recherche avancée : ', searchRepresentation
          )
        ),
        e('div', { className: 'crud-actions' },
          (() => {
            console.log('[CrudList] Button render check - data:', !!data, 'permissions:', data?.permissions, 'canCreate:', data?.permissions?.canCreate);
            return data && data.permissions && data.permissions.canCreate && e('button', {
              className: 'btn-add-record',
              onClick: (e) => {
                console.log('[CrudList] Button clicked!', e);
                this.handleAddNew();
              }
            }, '+ Nouveau');
          })(),
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
            onFieldSelect: this.handleShowFieldSelector,
            onToggleDelete: this.handleToggleDeleteButtons,
            showDeleteButtons,
            onAdvancedSearch: this.handleShowAdvancedSearch,
            onAdvancedSort: this.handleShowAdvancedSort,
            hasAdvancedSearch: !!advancedSearchCriteria,
            hasAdvancedSort: advancedSortCriteria && advancedSortCriteria.length > 0
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
            displayMode,
            showDeleteButton: showDeleteButtons,
            permissions: data.permissions,
            advancedSortCriteria: advancedSortCriteria
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
                onUpdate: this.loadData,
                showDeleteButton: showDeleteButtons
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
      }),

      // Create form modal
      (() => {
        console.log('[CrudList] Render - showCreateForm:', showCreateForm, 'data:', data ? 'available' : 'null');
        console.log('[CrudList] Render - createFormDefaultValues:', createFormDefaultValues);
        return showCreateForm && data && e(CreateFormModal, {
          tableName: table,
          structure: data.structure,
          tableConfig: data.tableConfig,
          permissions: data.permissions,
          parentTable: createFormParentTable,
          parentId: createFormParentId,
          defaultValues: createFormDefaultValues,
          onClose: this.handleCloseCreateForm,
          onSuccess: this.handleCreateSuccess
        });
      })(),

      // Advanced search modal
      showAdvancedSearch && data && e(AdvancedSearchModal, {
        structure: data.structure,
        onApply: this.handleApplyAdvancedSearch,
        onClose: this.handleCloseAdvancedSearch
      }),

      // Advanced sort modal
      showAdvancedSort && data && e(AdvancedSortModal, {
        structure: data.structure,
        currentOrderBy: orderBy,
        currentOrder: order,
        onApply: this.handleApplyAdvancedSort,
        onClose: this.handleCloseAdvancedSort
      })
    );
  }
}

// Export for use
window.CrudList = CrudList;
