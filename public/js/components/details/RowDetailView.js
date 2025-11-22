/**
 * RowDetailView Component
 *
 * Read-only detailed view of a row with all relations expanded.
 * Displays fields in a grid layout, handles N:1 relations inline, and shows 1:N relations
 * in collapsible sections. Also manages the attachments tab.
 *
 * Features:
 * - Grid-based field layout
 * - Inline N:1 relation rendering
 * - Collapsible 1:N relation sections
 * - Date range field synthesis for calendar-enabled tables
 * - Parent field filtering
 * - Strong/Weak relation handling (Strong opens by default)
 * - Attachments tab
 *
 * Dependencies:
 * - React (global)
 * - FieldRenderer (fields component)
 * - RelationRenderer (fields component)
 * - AttachmentsTab (details component)
 * - SubList (details component)
 * - SCHEMA_CONFIG (global)
 *
 * @component
 */


class RowDetailView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      openRelations: new Set(),
      showAttachments: true, // Open by default
      attachmentCount: 0,
      showCreateModal: false,
      createModalTable: null,
      createModalStructure: null,
      createModalConfig: null,
      createModalPermissions: null
    };
    // Store refs to SubList components to access their handlers
    this.subListRefs = {};
  }

  async componentDidMount() {
    const { row, structure, tableName } = this.props;
    // Open "Strong" relations by default, keep "Weak" relations closed
    const strongRelations = new Set();

    // Check in structure.relations for 1:N relations with Strong relationship
    if (structure && structure.relations) {
      Object.entries(structure.relations).forEach(([relationName, relationConfig]) => {
        if (relationConfig.type === 'one-to-many' && relationConfig.relationshipStrength === 'Strong') {
          strongRelations.add(relationName);
        }
      });
    }

    this.setState({ openRelations: strongRelations });

    // Load attachment count
    await this.loadAttachmentCount();
  }

  loadAttachmentCount = async () => {
    const { tableName, row } = this.props;

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/attachments`);
      const data = await response.json();

      if (data.success) {
        this.setState({ attachmentCount: data.count || 0 });
      }
    } catch (error) {
      console.error('Failed to load attachment count:', error);
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

  isParentField(fieldName) {
    const { parentTable, structure } = this.props;
    if (!parentTable) return false;

    // Check if this field is actually a foreign key relation to the parent table
    if (structure && structure.fields && structure.fields[fieldName]) {
      const field = structure.fields[fieldName];
      // Only filter if it's a relation field pointing to the parent table
      if (field.relation === parentTable) {
        return true;
      }
    }

    // Fallback: check for exact match like "idOrganization" for "Organization"
    // but NOT partial matches like "organizationRole"
    const lowerField = fieldName.toLowerCase();
    const lowerParent = parentTable.toLowerCase();
    return lowerField === `id${lowerParent}`;
  }

  handleExtendAuthorizationForRelation = async (relatedTable, relationName) => {
    const { tableName, row } = this.props;

    if (!confirm(`Étendre l'autorisation de la fiche ${tableName} à toutes les fiches ${relatedTable} liées ?`)) {
      return;
    }

    try {
      const response = await fetch(`/_api/${tableName}/${row.id}/extend-authorization/${relatedTable}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert(`✓ Autorisation étendue à ${data.updatedCount} fiche(s) ${relatedTable}`);
        // Reload the page to refresh data
        window.location.reload();
      } else {
        alert(`Erreur: ${data.error || 'Échec de l\'extension'}`);
      }
    } catch (error) {
      console.error('Error extending authorization:', error);
      alert('Erreur lors de l\'extension de l\'autorisation');
    }
  }

  handleOpenCreateModal = async (relatedTable) => {
    // Fetch structure and config for the related table
    try {
      const [structureResponse, configResponse] = await Promise.all([
        fetch(`/_crud/${relatedTable}/structure`),
        fetch(`/_crud/${relatedTable}/data?limit=1`)
      ]);

      const structureData = await structureResponse.json();
      const configData = await configResponse.json();

      if (structureData.success && configData.success) {
        this.setState({
          showCreateModal: true,
          createModalTable: relatedTable,
          createModalStructure: structureData.structure,
          createModalConfig: configData.tableConfig,
          createModalPermissions: configData.permissions
        });
      }
    } catch (error) {
      console.error('Failed to fetch table info:', error);
      alert('Erreur lors du chargement du formulaire');
    }
  }

  handleCloseCreateModal = () => {
    this.setState({
      showCreateModal: false,
      createModalTable: null,
      createModalStructure: null,
      createModalConfig: null,
      createModalPermissions: null
    });
  }

  handleCreateSuccess = async (newRecordId) => {
    // Refresh parent data to show the new record
    const { onSubRecordUpdate } = this.props;
    if (onSubRecordUpdate) {
      await onSubRecordUpdate();
    }
  }

  render() {
    const { row, structure, tableName, permissions, onEdit, parentTable, hideRelations1N, onSubRecordUpdate } = this.props;
    const { openRelations, showAttachments, attachmentCount, showCreateModal, createModalTable, createModalStructure, createModalConfig, createModalPermissions } = this.state;

    // Check if table has attachments enabled
    const tableConfig = SCHEMA_CONFIG?.tables?.[tableName];
    const hasAttachmentsTab = tableConfig?.hasAttachmentsTab || false;

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

    const allFields = rawFields.filter(f => {
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
    if (hasCalendar && !allFields.includes('_dateRange')) {
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
      allFields.splice(adjustedIndex, 0, '_dateRange');
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
            relationshipStrength: relationConfig.relationshipStrength,
            defaultSort: relationConfig.defaultSort,
            isOrderable: relationConfig.orderable ? true : false,
            relationFieldName: relationConfig.relationFieldName,
            orderField: relationConfig.orderable
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
            relationshipStrength: field.relationshipStrength,
            defaultSort: field.defaultSort,
            isOrderable: field.orderable ? true : false,
            relationFieldName: fieldName,
            orderField: field.orderable
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

          // Check if field is markdown to apply full-width class
          const isMarkdown = field && (field.renderer === 'markdown' || field.type === 'markdown');
          const fieldClasses = isMarkdown ? 'detail-field field-markdown' : 'detail-field';

          return e('div', {
            key: fieldName,
            className: fieldClasses,
            style: isClickable ? { cursor: 'pointer' } : {},
            onClick: isClickable ? (e) => handleFieldClick(fieldName, e) : undefined
          },
            e('label', { className: 'detail-label' },
              fieldName === '_dateRange' && tableConfig.calendar
                ? [
                    label,
                    ' ',
                    e('a', {
                      href: '/_calendar',
                      onClick: (ev) => ev.stopPropagation(),
                      className: 'field-icon-link',
                      title: 'Voir le calendrier',
                      style: { fontSize: '1.2em', textDecoration: 'none', marginLeft: '5px' }
                    }, '📅')
                  ]
                : label
            ),
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
                    tableName,
                    fieldName,
                    row,
                    tableConfig
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
              // Right side: Pinned actions and three-dots menu
              e('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                // Pinned actions
                e(PinnedActions, {
                  tableName: relatedTable,
                  actions: {
                    create: {
                      label: count === 0 ? 'Créer la première fiche' : 'Ajouter',
                      icon: '+',
                      onClick: (ev) => {
                        if (ev) ev.stopPropagation();
                        this.handleOpenCreateModal(relatedTable);
                      },
                      show: true // Assume user can create if they can see the relation
                    }
                  }
                }),
                // Three-dots menu
                e(ThreeDotsMenu, {
                  isSubList: true,
                  tableName: relatedTable,
                  showDeleteButtons: this.subListRefs[relName]?.state?.showDeleteButtons || false,
                  onCreate: (ev) => {
                    if (ev) ev.stopPropagation();
                    this.handleOpenCreateModal(relatedTable);
                  },
                  canCreate: true, // Assume user can create if they can see the relation
                  onToggleDelete: () => {
                    if (this.subListRefs[relName]) {
                      this.subListRefs[relName].handleToggleDeleteButtons();
                      // Force re-render to update menu state indicator
                      this.forceUpdate();
                    }
                  },
                  onAdvancedSort: () => {
                    if (this.subListRefs[relName]) {
                      this.subListRefs[relName].handleAdvancedSort();
                    }
                  },
                  onLinkToTable: () => {
                    if (this.subListRefs[relName]) {
                      this.subListRefs[relName].handleLinkToTable();
                    }
                  },
                  onExtendAuthorization: () => {
                    if (this.subListRefs[relName]) {
                      this.subListRefs[relName].handleExtendAuthorization();
                    }
                  }
                })
              )
            ),
            isOpen && e('div', { className: 'relation-list' },
              e(SubList, {
                ref: (ref) => { this.subListRefs[relName] = ref; },
                rows: relRows,
                tableName: relatedTable,
                parentTable: tableName,
                parentId: row.id,
                relationName: relName,
                hideHeader: false,
                defaultSort: relation.defaultSort,
                isOrderable: relation.isOrderable,
                relationFieldName: relation.relationFieldName,
                orderField: relation.orderField,
                onSubRecordUpdate: onSubRecordUpdate
              })
            )
          );
        })
      ),

      // Attachments section (always shown)
      e('div', { className: 'detail-attachments-section' },
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
            attachmentCount > 0 && e('span', { className: 'relation-count badge' }, attachmentCount),
            e('span', { style: { fontSize: '14px' } }, '📎')
          )
        ),
        showAttachments && e(AttachmentsTab, {
          tableName: tableName,
          rowId: row.id,
          permissions: permissions,
          structure: structure, // Pass structure to detect image fields
          onAttachmentChange: this.loadAttachmentCount,
          onImageFieldUpdate: (fieldName, imageUrl) => {
            // Notify parent to reload the row data to show updated image
            if (this.props.onRefresh) {
              this.props.onRefresh();
            }
          }
        })
      ),

      // Create modal for adding related records
      showCreateModal && createModalStructure && e(CreateFormModal, {
        tableName: createModalTable,
        structure: createModalStructure,
        tableConfig: createModalConfig || {},
        permissions: createModalPermissions || {},
        parentTable: tableName,
        parentId: row.id,
        onClose: this.handleCloseCreateModal,
        onSuccess: this.handleCreateSuccess
      })
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RowDetailView;
}

// Export to global scope for use in crudList.js
window.RowDetailView = RowDetailView;
