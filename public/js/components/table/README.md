# Table Components

This directory contains table-related components extracted from crudList.js during the Phase 3 refactoring.

## Components

### 1. TableHeader.js (114 lines)
**Source:** crudList.js lines 1722-1808

**Description:**
Renders the table header with sortable columns and optional statistics row. Includes column headers with sort indicators (▲/▼) and click handlers for sorting.

**Features:**
- Sortable column headers with visual indicators
- Statistics row below header (sum, average, count)
- Delete button column (conditional)
- Granted status column
- Special handling for `_dateRange` field
- Raw display mode support

**Dependencies:**
- React (global)
- None (self-contained component)

**Props:**
- `fields` - Array of field names to display
- `structure` - Table structure with field definitions
- `orderBy` - Current sort field
- `order` - Current sort order (ASC/DESC)
- `onSort` - Function to handle sort clicks
- `displayMode` - Display mode ('raw' or standard)
- `showDeleteButton` - Whether to show delete column
- `permissions` - Permission object with canDelete flag
- `advancedSortCriteria` - Array of advanced sort criteria
- `statistics` - Object with statistics for each field

**Usage:**
```javascript
e(TableHeader, {
  fields: ['name', 'email', 'status'],
  structure: tableStructure,
  orderBy: 'name',
  order: 'ASC',
  onSort: handleSort,
  displayMode: 'standard',
  showDeleteButton: true,
  permissions: { canDelete: true },
  advancedSortCriteria: [],
  statistics: { age: { type: 'avg', value: 35.5 } }
})
```

---

### 2. TableRow.js (317 lines)
**Source:** crudList.js lines 1813-2086 (includes getGrantedIcon utility)

**Description:**
Renders a single table row with expand/collapse functionality, inline editing, and keyboard shortcuts. Each row can be expanded to show full details in a modal.

**Features:**
- Click to expand/collapse row details
- Double-click to enter edit mode
- ESC key to close expanded row or exit edit mode
- Delete button with confirmation
- Calendar icon for calendar-enabled tables
- Granted status icon
- Lazy loading of full row data on first expand
- Support for relations and field rendering
- Modal overlay for row details

**Dependencies:**
- React (global)
- RelationRenderer component (global)
- FieldRenderer component (global)
- RowDetailModal component (global)
- SCHEMA_CONFIG (global)
- getGrantedIcon utility function (included in file)

**Props:**
- `row` - Row data object
- `fields` - Array of field names to display
- `structure` - Table structure with field definitions
- `displayMode` - Display mode ('raw' or standard)
- `tableName` - Name of the table
- `permissions` - Permission object (canUpdate, canDelete)
- `tableConfig` - Configuration for the table
- `parentTable` - Parent table name (for sub-lists)
- `showDeleteButton` - Whether to show delete button
- `onUpdate` - Callback when row is updated/deleted

**State:**
- `expanded` - Whether the row is expanded
- `editMode` - Whether the row is in edit mode
- `fullData` - Full row data (lazy loaded)
- `loading` - Whether data is loading
- `focusFieldName` - Field to focus when entering edit mode

**Methods:**
- `toggleExpand()` - Expand/collapse row and lazy load data
- `enterEditMode(focusFieldName)` - Enter edit mode
- `exitEditMode()` - Exit edit mode
- `handleSave(updatedData)` - Handle save and update state
- `handleDelete(e)` - Delete row with confirmation
- `handleKeyDown(event)` - Handle ESC key to close

**Usage:**
```javascript
e(TableRow, {
  row: rowData,
  fields: ['name', 'email', 'status'],
  structure: tableStructure,
  displayMode: 'standard',
  tableName: 'Person',
  permissions: { canUpdate: true, canDelete: true },
  tableConfig: { calendar: { startDate: 'startDate' } },
  showDeleteButton: true,
  onUpdate: handleUpdate
})
```

**Utility Functions:**
- `getGrantedIcon(granted)` - Returns emoji icon for granted status

---

## Integration

These components are loaded as separate files in the HTML and are available globally. They are not using ES6 modules but rather traditional script loading.

To use these components in crudList.js or other files:

1. Load them in the HTML:
```html
<script src="/js/components/table/TableHeader.js"></script>
<script src="/js/components/table/TableRow.js"></script>
```

2. Use them in React components:
```javascript
e(TableHeader, { ...props })
e(TableRow, { ...props })
```

## External Dependencies

Both components depend on components that should be loaded before them:

**For TableRow:**
- `/js/components/fields/FieldRenderer.js`
- `/js/components/fields/RelationRenderer.js`
- `/js/components/details/RowDetailModal.js` (needs to be extracted)

## Next Steps

1. Extract RowDetailModal component (required by TableRow)
2. Update crudList.js to remove these extracted components
3. Add script tags to load these components in the appropriate HTML files
4. Test functionality after extraction

---

## File Statistics

| Component | Lines | Size | Complexity |
|-----------|-------|------|------------|
| TableHeader.js | 114 | 4.2KB | Low |
| TableRow.js | 317 | 9.8KB | High |
| **Total** | **431** | **14KB** | - |

## Related Components

### Already Extracted:
- `/js/components/fields/FieldRenderer.js` - Used by TableRow
- `/js/components/fields/RelationRenderer.js` - Used by TableRow
- `/js/components/forms/GrantedSelector.js` - Used by RowDetailModal
- `/js/components/search/FieldSelectorModal.js` - Used by parent components

### Still in crudList.js:
- `RowDetailModal` - Should be extracted to `/js/components/details/`
- `CrudList` - Main component (will remain in crudList.js)

---

**Created:** 2025-11-17
**Phase:** 3 - Table Components Extraction
**Status:** Complete
