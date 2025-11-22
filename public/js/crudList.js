/**
 * CRUD List Component - Main Application
 * 
 * This is the main orchestration component that uses all the extracted components.
 * Components are loaded from separate files and available via window.* global scope.
 * 
 * Component Dependencies (loaded before this file):
 * - crudListUtils.js - Utility functions (buildCardTitle, getGrantedIcon)
 * - FieldRenderer, RelationRenderer - Field display components
 * - CalendarDateRangeTool - Date range picker
 * - GrantedSelector, RelationAutocomplete - Form input components
 * - FieldSelectorModal, ThreeDotsMenu, AdvancedSearchModal, AdvancedSortModal - Search/filter UI
 * - TableHeader, TableRow - Table display components
 * - AttachmentsTab, SubList, RowDetailView, RowDetailModal - Detail view components
 * - EditForm, CreateFormModal - Form components
 * 
 * Features:
 * - List view with pagination
 * - Inline edit with auto-save
 * - Advanced search and sort
 * - Relation management
 * - File attachments
 * - Calendar integration
 * - Field visibility control
 * - Row-level permissions
 */


// Global schema config (fetched from server)
let SCHEMA_CONFIG = null;

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
  }

  componentDidUpdate(prevProps, prevState) {

    // If data just became available for the first time
    // AND we haven't processed URL parameters yet
    // This ensures the create form can be opened with data.structure available
    if (!prevState.data && this.state.data && !this.urlParametersProcessed) {
      this.urlParametersProcessed = true;
      this.checkURLParameters();
    } else {
      if (this.urlParametersProcessed) {
      }
      if (prevState.data) {
      }
      if (!this.state.data) {
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
      return;
    }

    // Check if we have parent context (e.g., from attachment detail)
    const urlParams = new URLSearchParams(window.location.search);
    const parent = urlParams.get('parent');
    const parentId = urlParams.get('parentId');

    if (parent && parentId) {
      // Return to parent record with modal open
      window.location.href = `/_crud/${parent}?open=${parentId}`;
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

    // Parse URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const parent = urlParams.get('parent');
    const parentId = urlParams.get('parentId');
    const openRecordId = urlParams.get('open');


    // Extract all URL parameters as default values for form fields
    const defaultValues = {};
    let paramCount = 0;
    for (const [key, value] of urlParams.entries()) {
      paramCount++;
      // Skip special parameters: parent, parentId, open
      if (key !== 'parent' && key !== 'parentId' && key !== 'open') {
        defaultValues[key] = value;
      }
    }


    // If 'open' parameter is provided, load that record in fullscreen mode
    if (openRecordId) {
      this.setState({
        fullscreenRecordId: parseInt(openRecordId)
      });
      this.loadFullscreenRecord(parseInt(openRecordId));
      return; // Don't process other parameters if opening a specific record
    }

    // If parent and parentId are provided, open create form automatically
    if (parent && parentId) {
      this.setState({
        showCreateForm: true,
        createFormParentTable: parent,
        createFormParentId: parseInt(parentId),
        createFormDefaultValues: defaultValues
      });
    } else if (Object.keys(defaultValues).length > 0) {
      // If there are default values but no parent, still open the form
      this.setState({
        showCreateForm: true,
        createFormDefaultValues: defaultValues
      });
    } else {
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
    this.setState({
      showCreateForm: true,
      createFormParentTable: parentTable,
      createFormParentId: parentId,
      createFormDefaultValues: defaultValues
    }, () => {
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
    // Reload data after successful creation (auto-save)
    // NOTE: Do NOT close the form or redirect here - the form auto-saves and should stay open
    // User can close it manually with the close button, which will trigger handleCloseCreateForm
    // and handle any calendar redirect logic there
    this.loadData();
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

    if (!advancedSearchCriteria || !Array.isArray(advancedSearchCriteria) || advancedSearchCriteria.length === 0) {
      return null;
    }

    // Count total conditions
    let totalConditions = 0;
    for (const group of advancedSearchCriteria) {
      if (group.conditions && Array.isArray(group.conditions)) {
        // Only count conditions that have a field selected
        totalConditions += group.conditions.filter(c => c.field).length;
      }
    }

    if (totalConditions === 0) {
      return null;
    }

    // Return a simple representation
    const conditionText = totalConditions === 1 ? 'critère' : 'critères';
    const groupText = advancedSearchCriteria.length === 1 ? 'groupe' : 'groupes';

    return `${totalConditions} ${conditionText} (${advancedSearchCriteria.length} ${groupText})`;
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
            className: 'btn btn-back'
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
          e('h1', { className: 'crud-title' },
            table,
            // Add calendar icon if table has calendar configuration
            (() => {
              const tableConfig = data?.structure?.calendar;
              if (tableConfig) {
                return e('a', {
                  href: '/_calendar',
                  onClick: (ev) => ev.stopPropagation(),
                  className: 'field-icon-link',
                  title: 'Voir le calendrier',
                  style: { marginLeft: '10px', fontSize: '0.8em', textDecoration: 'none' }
                }, '📅');
              }
              return null;
            })()
          ),
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
          // Pinned actions (quick access buttons)
          e(PinnedActions, {
            tableName: this.props.tableName,
            actions: {
              create: {
                label: 'Nouveau',
                icon: '+',
                onClick: () => this.handleAddNew(),
                show: data && data.permissions && data.permissions.canCreate
              },
              fieldSelect: {
                label: 'Colonnes...',
                icon: '🎯',
                onClick: () => this.handleShowFieldSelector(),
                show: true
              },
              advancedSearch: {
                label: 'Recherche...',
                icon: '🔍',
                onClick: () => this.handleShowAdvancedSearch(),
                show: true
              },
              advancedSort: {
                label: 'Tri...',
                icon: '📊',
                onClick: () => this.handleShowAdvancedSort(),
                show: true
              },
              toggleDelete: {
                label: 'Mode suppression',
                icon: '🗑️',
                onClick: () => this.handleToggleDeleteButtons(),
                show: true
              }
            }
          }),
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
            hasAdvancedSort: advancedSortCriteria && advancedSortCriteria.length > 0,
            onCreate: () => this.handleAddNew(),
            canCreate: data && data.permissions && data.permissions.canCreate,
            tableName: this.props.tableName
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
            advancedSortCriteria: advancedSortCriteria,
            statistics: data.statistics
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
            className: 'btn btn-load-more',
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
        currentSearchCriteria: advancedSearchCriteria,
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
