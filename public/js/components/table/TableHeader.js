/**
 * Table Header Component
 *
 * Renders the table header with sortable columns and optional statistics row.
 * Includes column headers with sort indicators (▲/▼) and click handlers for sorting.
 * Displays a statistics row below the header when statistics data is available.
 *
 * Dependencies:
 * - React (global)
 * - props.fields: Array of field names to display
 * - props.structure: Table structure with field definitions
 * - props.orderBy: Current sort field
 * - props.order: Current sort order (ASC/DESC)
 * - props.onSort: Function to handle sort clicks
 * - props.displayMode: Display mode ('raw' or standard)
 * - props.showDeleteButton: Whether to show delete column
 * - props.permissions: Permission object with canDelete flag
 * - props.advancedSortCriteria: Array of advanced sort criteria
 * - props.statistics: Object with statistics for each field
 */

const e = React.createElement;

/**
 * Table Header Component
 * Renders sortable column headers and optional statistics row
 */
class TableHeader extends React.Component {
  render() {
    const { fields, structure, orderBy, order, onSort, displayMode, showDeleteButton, permissions, advancedSortCriteria, statistics } = this.props;
    const hasAdvancedSort = advancedSortCriteria && advancedSortCriteria.length > 0;
    const hasStatistics = statistics && Object.keys(statistics).length > 0;

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
      // Header row
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

          // Special width constraint for _dateRange column
          const style = fieldName === '_dateRange' ? { maxWidth: '22rem' } : {};

          return e('th', {
            key: fieldName,
            className: `sortable ${isSorted && !hasAdvancedSort ? 'sorted' : ''}`,
            style: style,
            onClick: () => onSort(fieldName)
          }, label, sortIcon);
        })
      ),
      // Statistics row (if statistics are available)
      hasStatistics && e('tr', { className: 'statistics-row', style: { backgroundColor: '#f8f9fa', fontWeight: 'bold' } },
        showDeleteButton && permissions && permissions.canDelete && e('th', { key: 'delete-stat', style: { width: '40px' } }),
        e('th', { key: 'granted-stat', style: { width: '40px' } }),
        fields.map(fieldName => {
          const stat = statistics[fieldName];
          if (!stat) {
            return e('th', { key: `stat-${fieldName}` });
          }

          // Format the statistic value
          let displayValue;
          if (stat.type === 'avg') {
            displayValue = parseFloat(stat.value).toFixed(2);
          } else {
            displayValue = stat.value;
          }

          // Add icon/label for stat type
          let statLabel;
          switch (stat.type) {
            case 'sum':
              statLabel = '∑ ';
              break;
            case 'avg':
              statLabel = 'μ ';
              break;
            case 'count':
              statLabel = '# ';
              break;
          }

          return e('th', {
            key: `stat-${fieldName}`,
            style: { fontSize: '0.9em', color: '#495057' }
          }, statLabel, displayValue);
        })
      )
    );
  }
}
