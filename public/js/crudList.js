/**
 * CRUD List Component - React without Babel
 * Uses React.createElement (e) for component creation
 */

const e = React.createElement;

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
        return e('a', {
          href: `tel:${value}`,
          className: 'field-value telephone'
        }, '📞 ', value);

      case 'email':
        return e('a', {
          href: `mailto:${value}`,
          className: 'field-value email'
        }, '📧 ', value);

      case 'url':
        return e('a', {
          href: value,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'field-value url'
        }, '🔗 ', value);

      case 'markdown':
        // Simple markdown rendering (you could use a library here)
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
    // Very basic markdown support
    return String(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
}

/**
 * N:1 Relation Renderer
 * Renders compact N:1 relations with link
 * The relation object is already in compact mode (only displayFields + id)
 */
class RelationRenderer extends React.Component {
  render() {
    const { relation, fieldName, relatedTable } = this.props;

    if (!relation) {
      return e('span', { className: 'relation-value empty' }, '-');
    }

    // Get display value (compact mode returns only displayFields)
    const displayValue = this.getDisplayValue(relation);

    return e('div', { className: 'relation-value' },
      e('a', {
        href: `/_crud/${relatedTable}/${relation.id}`,
        className: 'relation-link',
        onClick: (ev) => {
          ev.stopPropagation();
          // Navigate to the related record
        }
      }, '🔗 ', displayValue)
    );
  }

  getDisplayValue(relation) {
    // If it's a string, return it directly
    if (typeof relation === 'string') return relation;

    // Build display value from all non-id, non-_table fields
    // These are the displayFields from the schema (thanks to compact mode)
    const values = [];
    for (const key in relation) {
      if (key !== 'id' && key !== '_table' && relation[key]) {
        values.push(relation[key]);
      }
    }

    // Join with space if multiple fields
    if (values.length > 0) {
      return values.join(' ');
    }

    // Fallback to ID
    return `#${relation.id || '?'}`;
  }
}

/**
 * Table Header Component
 * Sortable column headers
 */
class TableHeader extends React.Component {
  render() {
    const { fields, structure, orderBy, order, onSort, displayMode } = this.props;

    if (displayMode === 'raw') {
      // Raw mode: simple header
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
 * Single row with expandable detail
 */
class TableRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      expanded: false,
      fullData: null,
      loading: false
    };
  }

  toggleExpand = async () => {
    const { expanded, fullData } = this.state;
    const { row, tableName } = this.props;

    if (!expanded && !fullData) {
      // First time expanding - fetch full data with all relations
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
      // Just toggle
      this.setState({ expanded: !expanded });
    }
  }

  render() {
    const { row, fields, structure, displayMode, tableName } = this.props;
    const { expanded, fullData, loading } = this.state;

    if (displayMode === 'raw') {
      // Raw mode: no formatting
      return e('tr', null,
        fields.map(fieldName =>
          e('td', { key: fieldName }, String(row[fieldName] || ''))
        )
      );
    }

    // Use fullData if available, otherwise use row
    const displayData = fullData || row;

    // Normal mode
    return e(React.Fragment, null,
      e('tr', {
        className: `data-row ${expanded ? 'expanded' : ''}`,
        onClick: this.toggleExpand
      },
        fields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];

          // Check if this is a relation
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
            : e(RowDetailView, {
                row: displayData,
                structure,
                tableName
              })
        )
      )
    );
  }
}

/**
 * Row Detail View Component
 * Expanded view with all fields and 1:N relations
 */
class RowDetailView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      openRelations: new Set()
    };
  }

  componentDidMount() {
    // Auto-open Strong relations
    const { row, structure } = this.props;
    if (row._relations) {
      const strongRelations = new Set();
      Object.entries(row._relations).forEach(([relName, relData]) => {
        // Check if it's a 1:N array relation
        if (Array.isArray(relData) && relData.length > 0) {
          // Check if Strong (we'd need schema info here)
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
    const { row, structure, tableName } = this.props;
    const { openRelations } = this.state;

    // Get all visible fields
    const allFields = Object.keys(structure.fields).filter(f =>
      !['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'].includes(f)
    );

    // Separate 1:N relations (arrays)
    const relations1N = {};

    if (row._relations) {
      Object.entries(row._relations).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          relations1N[key] = value;
        }
      });
    }

    return e('div', { className: 'row-detail' },
      // Fields grid - showing all fields in order, with N:1 relations inline
      e('div', { className: 'detail-fields' },
        allFields.map(fieldName => {
          const field = structure.fields[fieldName];
          const value = row[fieldName];
          const label = field?.label || fieldName;

          // Check if this field has a N:1 relation in _relations
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

      // 1:N Relations (sub-lists)
      Object.keys(relations1N).length > 0 && e('div', { className: 'detail-relations-1n' },
        e('h4', null, 'Relations liées'),
        Object.entries(relations1N).map(([relName, relRows]) => {
          const isOpen = openRelations.has(relName);
          const relatedTable = relRows[0]?._table || relName;

          return e('div', { key: relName, className: 'relation-section' },
            e('div', {
              className: 'relation-header',
              onClick: () => this.toggleRelation(relName)
            },
              e('span', { className: 'relation-toggle' }, isOpen ? '▼' : '▶'),
              e('strong', null, relName),
              e('span', { className: 'relation-count' }, ` (${relRows.length})`)
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
 * Renders 1:N relations as a compact list with proper N:1 relation rendering
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

    // Fetch table structure to get field definitions
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

    // Get fields to display (exclude parent relation field)
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

              // Check if this field has a relation in _relations
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
    // Check if field name suggests it links to parent
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${parentTable}`;
  }
}

/**
 * Field Selector Modal Component
 * Modal for selecting which fields to display
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
 * Dropdown menu with display options
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
      displayMode: 'default', // default, all, raw, custom
      showSystemFields: false,
      selectedFields: null,
      showFieldSelector: false,
      page: 0,
      limit: 100
    };
  }

  componentDidMount() {
    this.loadData();
    this.loadUserPreferences();
  }

  loadUserPreferences = () => {
    // Load from cookie
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

    // Only show system fields in 'raw' mode, not in 'all' mode
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

      // Add selected fields if in custom mode
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
      // Cycle: ASC → DESC → no sort (back to default)
      if (prev.orderBy === fieldName) {
        if (prev.order === 'ASC') {
          // ASC → DESC
          return {
            orderBy: fieldName,
            order: 'DESC'
          };
        } else {
          // DESC → no sort (back to default)
          return {
            orderBy: 'updatedAt',
            order: 'DESC'
          };
        }
      } else {
        // Different field → start with ASC
        return {
          orderBy: fieldName,
          order: 'ASC'
        };
      }
    }, this.loadData);
  }

  handleSearch = (value) => {
    this.setState({ search: value, page: 0 }, () => {
      // Debounce
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

  handleResetPreferences = () => {
    this.setState({
      displayMode: 'default',
      selectedFields: null
    }, () => {
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
    // Increase limit by 100 rows
    this.setState(prev => ({
      limit: prev.limit + 100
    }), this.loadData);
  }

  render() {
    const { table } = this.props;
    const { loading, error, data, search, orderBy, order, displayMode, showFieldSelector, selectedFields } = this.state;

    return e('div', { className: 'crud-list-container' },
      // Header
      e('div', { className: 'crud-header' },
        e('h1', { className: 'crud-title' }, '📋 ', table),
        e('div', { className: 'crud-actions' },
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
        // Data table
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
                tableName: table
              })
            )
          )
        ),

        // Pagination with load more button
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

      // Field Selector Modal
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
