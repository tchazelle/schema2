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
 * - ThreeDotsMenu (search component)
 * - TableHeader (table component)
 * - TableRow (table component)
 * - FieldSelectorModal (table component)
 * - AdvancedSortModal (search component)
 *
 * @component
 */


class SubList extends React.Component {
  constructor(props) {
    super(props);

    // Get default sort from props or fallback to updatedAt DESC
    const defaultSort = props.defaultSort || { field: 'updatedAt', order: 'DESC' };

    this.state = {
      structure: null,
      tableConfig: null,
      permissions: null,
      orderBy: defaultSort.field,
      order: defaultSort.order,
      displayMode: 'default',
      showDeleteButtons: false,
      selectedFields: null,
      showFieldSelector: false,
      showAdvancedSort: false,
      defaultSort: defaultSort,
      draggedIndex: null,
      dragOverIndex: null
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

  handleAdvancedSort = () => {
    // Open advanced sort modal
    this.setState({ showAdvancedSort: true });
  }

  handleCloseAdvancedSort = () => {
    this.setState({ showAdvancedSort: false });
  }

  handleApplyAdvancedSort = (sortConfig) => {
    this.setState({
      orderBy: sortConfig.field,
      order: sortConfig.order,
      showAdvancedSort: false
    });
  }

  handleLinkToTable = () => {
    const { tableName } = this.props;
    window.location.href = `/_crud/${tableName}`;
  }

  handleExtendAuthorization = async () => {
    const { tableName, parentTable, parentId, onSubRecordUpdate } = this.props;

    if (!confirm(`Étendre l'autorisation de la fiche ${parentTable} à toutes les fiches ${tableName} liées ?`)) {
      return;
    }

    try {
      const response = await fetch(`/_api/${parentTable}/${parentId}/extend-authorization/${tableName}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert(`✓ Autorisation étendue à ${data.updatedCount} fiche(s) ${tableName}`);
        // Refresh the sub-list data without reloading the entire page
        if (onSubRecordUpdate) {
          await onSubRecordUpdate();
        }
      } else {
        alert(`Erreur: ${data.error || 'Échec de l\'extension'}`);
      }
    } catch (error) {
      console.error('Error extending authorization:', error);
      alert('Erreur lors de l\'extension de l\'autorisation');
    }
  }

  handleSort = (fieldName) => {
    this.setState(prev => {
      if (prev.orderBy === fieldName) {
        // Cycle through: ASC -> DESC -> default sort
        if (prev.order === 'ASC') {
          return {
            orderBy: fieldName,
            order: 'DESC'
          };
        } else {
          // Third click: return to default sort
          return {
            orderBy: prev.defaultSort.field,
            order: prev.defaultSort.order
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

  handleDragStart = (index) => (e) => {
    this.setState({ draggedIndex: index });
    e.dataTransfer.effectAllowed = 'move';
  }

  handleDragOver = (index) => (e) => {
    e.preventDefault();
    if (this.state.draggedIndex !== index) {
      this.setState({ dragOverIndex: index });
    }
  }

  handleDragEnd = async (e) => {
    e.preventDefault();
    const { draggedIndex, dragOverIndex } = this.state;
    const { rows, tableName, parentTable, parentId, relationFieldName, onSubRecordUpdate } = this.props;

    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      this.setState({ draggedIndex: null, dragOverIndex: null });
      return;
    }

    // Sort rows first to get correct order
    const sortedRows = this.sortRows(rows, this.state.orderBy, this.state.order);

    // Reorder the array
    const newRows = [...sortedRows];
    const [movedRow] = newRows.splice(draggedIndex, 1);
    newRows.splice(dragOverIndex, 0, movedRow);

    // Get ordered IDs
    const orderedIds = newRows.map(row => row.id);

    try {
      // Use the new reorder API endpoint
      const response = await fetch(`/_api/${tableName}/reorder/${relationFieldName}/${parentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reorder');
      }

      // Reload parent data to show updated order
      if (onSubRecordUpdate) {
        await onSubRecordUpdate();
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Erreur lors de la mise à jour de l\'ordre: ' + error.message);
    }

    this.setState({ draggedIndex: null, dragOverIndex: null });
  }

  handleDragLeave = () => {
    this.setState({ dragOverIndex: null });
  }

  render() {
    const { rows, tableName, parentTable, parentId, relationName, hideHeader, onSubRecordUpdate } = this.props;
    const { structure, tableConfig, permissions, orderBy, order, displayMode, showDeleteButtons, selectedFields, showFieldSelector, showAdvancedSort, draggedIndex, dragOverIndex } = this.state;

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
    const { defaultSort } = this.state;
    const isDefaultSort = (orderBy === defaultSort.field && order === defaultSort.order);
    const sortIndicator = !isDefaultSort
      ? `Tri: ${orderBy} ${order === 'ASC' ? '▲' : '▼'}`
      : null;

    // Check if table is orderable (supports drag & drop reordering)
    // The orderable property should come from the relation field configuration
    const isOrderable = this.props.isOrderable || (tableConfig && tableConfig.orderable);

    return e('div', { className: 'sub-list-container', style: { position: 'relative' } },
      // Sort indicator (only if not default and not hideHeader)
      !hideHeader && sortIndicator && e('div', {
        style: {
          fontSize: '12px',
          color: '#6c757d',
          fontStyle: 'italic',
          minHeight: '20px',
          padding: '4px 0',
          marginBottom: '4px'
        }
      }, sortIndicator),

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
          statistics: {}, // SubList doesn't have statistics yet
          draggable: isOrderable
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
              showDeleteButton: showDeleteButtons,
              onUpdate: onSubRecordUpdate,
              // Drag & drop props for orderable tables
              draggable: isOrderable,
              onDragStart: isOrderable ? this.handleDragStart(idx) : null,
              onDragOver: isOrderable ? this.handleDragOver(idx) : null,
              onDragEnd: isOrderable ? this.handleDragEnd : null,
              onDragLeave: isOrderable ? this.handleDragLeave : null,
              isDragging: draggedIndex === idx,
              isDragOver: dragOverIndex === idx
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
      }),

      // Advanced sort modal
      showAdvancedSort && e(AdvancedSortModal, {
        tableName,
        allFields,
        structure,
        currentSort: { field: orderBy, order },
        onApply: this.handleApplyAdvancedSort,
        onClose: this.handleCloseAdvancedSort
      })
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubList;
}

// Export to global scope for use in crudList.js
window.SubList = SubList;
