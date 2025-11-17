/**
 * Table Row Component
 *
 * Renders a single table row with expand/collapse functionality, inline editing,
 * and keyboard shortcuts. Each row can be expanded to show full details in a modal.
 * Supports double-click to enter edit mode and ESC key to close.
 *
 * Features:
 * - Click to expand/collapse row details
 * - Double-click to enter edit mode
 * - ESC key to close expanded row or exit edit mode
 * - Delete button (if permissions allow)
 * - Calendar icon for calendar-enabled tables
 * - Granted status icon
 * - Lazy loading of full row data on first expand
 *
 * Dependencies:
 * - React (global)
 * - RelationRenderer component (global)
 * - FieldRenderer component (global)
 * - RowDetailModal component (global)
 * - SCHEMA_CONFIG (global)
 * - getGrantedIcon utility function (defined below)
 *
 * Props:
 * - row: Row data object
 * - fields: Array of field names to display
 * - structure: Table structure with field definitions
 * - displayMode: Display mode ('raw' or standard)
 * - tableName: Name of the table
 * - permissions: Permission object (canUpdate, canDelete)
 * - tableConfig: Configuration for the table
 * - parentTable: Parent table name (for sub-lists)
 * - showDeleteButton: Whether to show delete button
 * - onUpdate: Callback when row is updated/deleted
 */

const e = React.createElement;

/**
 * Table Row Component
 * Single table row with expand/collapse, inline editing, keyboard shortcuts
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
    const { row, tableName, parentTable } = this.props;

    // If in edit mode, clicking should not toggle
    if (editMode) return;

    // If this is a sub-list item (parentTable is provided), open the full CRUD page directly
    if (parentTable) {
      window.open(`/_crud/${tableName}/${row.id}`, '_blank');
      return;
    }

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

    // Notify parent to refresh the list so changes are visible
    // The autosave already updates the DB, now refresh the list to show changes
    if (this.props.onUpdate) {
      this.props.onUpdate();
    }
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
            // Build precise calendar link from startDate field
            const startDateField = tableConfig.calendar.startDate || 'startDate';
            const startDateValue = row[startDateField];

            if (startDateValue) {
              let calendarUrl = '/_calendar';
              const startDate = new Date(startDateValue);
              if (!isNaN(startDate.getTime())) {
                const year = startDate.getFullYear();
                const month = String(startDate.getMonth() + 1).padStart(2, '0');
                calendarUrl = `/_calendar/${year}/${month}`;
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

          // Special width constraint for _dateRange column (reduced from 22rem to 16rem)
          const style = fieldName === '_dateRange' ? { maxWidth: '16rem' } : {};

          return e('td', {
            key: fieldName,
            'data-label': label,  // Add data-label for responsive cards
            style: style
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
                  fieldName,
                  row,
                  tableConfig
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
