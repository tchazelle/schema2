/**
 * SubList Component
 *
 * Displays related 1:N records in a sub-table format.
 * Provides sorting, field selection, and display mode options.
 * Used within RowDetailView to show child records.
 *
 * Features:
 * - Table view with sortable columns
 * - Display modes: default, raw, all, custom
 * - Field selector for custom column selection
 * - Delete button toggle
 * - Parent field filtering
 * - Date range field synthesis for calendar-enabled tables
 * - "+ Nouveau" button to create related records
 *
 * Dependencies:
 * - React (global)
 * - ThreeDotsMenu (table component)
 * - TableHeader (table component)
 * - TableRow (table component)
 * - FieldSelectorModal (table component)
 *
 * @component
 */

const e = React.createElement;

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

  isParentField(fieldName, parentTable) {
    if (!parentTable || typeof parentTable !== 'string') return false;
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField.includes(lowerParent) || lowerField === `id${lowerParent}`;
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

    // Check if table has calendar config
    const hasCalendar = structure.calendar;
    const startDateField = hasCalendar ? (structure.calendar.startDate || 'startDate') : null;
    const endDateField = hasCalendar ? (structure.calendar.endDate || 'endDate') : null;
    const hasDateRange = firstRow._dateRange;

    const allFieldsRaw = Object.keys(firstRow).filter(f => {
      // Filter out fields starting with underscore (except _dateRange)
      if (f.startsWith('_') && f !== '_dateRange') {
        return false;
      }
      // Filter out parent fields
      if (this.isParentField(f, parentTable)) {
        return false;
      }
      // Filter out startDate and endDate if table has calendar and _dateRange is present
      if (hasDateRange && hasCalendar && (f === startDateField || f === endDateField)) {
        return false;
      }
      return true;
    });

    // Ensure _dateRange is at the beginning if present
    let allFields = allFieldsRaw;
    if (hasDateRange && allFields.includes('_dateRange')) {
      allFields = ['_dateRange', ...allFields.filter(f => f !== '_dateRange')];
    }

    // Filter fields based on display mode
    let fields;
    if (displayMode === 'raw') {
      fields = allFields;
    } else if (displayMode === 'all') {
      fields = allFields;
    } else if (displayMode === 'custom' && selectedFields && selectedFields.length > 0) {
      fields = selectedFields.filter(f => allFields.includes(f));
      // Ensure _dateRange is included and at the beginning if present
      if (hasDateRange && !fields.includes('_dateRange')) {
        fields.unshift('_dateRange');
      } else if (hasDateRange && fields.includes('_dateRange')) {
        // Move _dateRange to beginning
        fields = ['_dateRange', ...fields.filter(f => f !== '_dateRange')];
      }
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
          permissions,
          statistics: {} // SubList doesn't have statistics yet
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
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubList;
}
