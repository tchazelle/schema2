/**
 * AdvancedSortModal Component
 *
 * Modal dialog for configuring multiple sort criteria with support for:
 * - Primary, secondary, and tertiary sort fields
 * - Level 1 and Level 2 N:1 relation field sorting
 * - Ascending/descending order selection
 * - Dynamic field list based on table structure
 *
 * Features:
 * - Fetches related table structures for N:1 relations
 * - Supports sorting by related table fields (up to 2 levels deep)
 * - Visual grouping of fields by category
 * - Add/remove sort criteria dynamically
 * - Reset to default sort
 *
 * Dependencies:
 * - React (via global React object)
 *
 * Props:
 * - structure: Table structure with fields and relations
 * - currentOrderBy: Current primary sort field
 * - currentOrder: Current sort order (ASC/DESC)
 * - onApply: Callback function when sort is applied (receives criteria array)
 * - onClose: Callback function to close modal
 *
 * State:
 * - criteria: Array of sort criterion objects {field, order}
 * - relatedStructures: Cache of fetched related table structures
 *
 * @file /home/user/schema2/public/js/components/search/AdvancedSortModal.js
 * @extracted Phase 6 of crudList.js refactoring
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
            className: 'modal-close btn-icon',
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
                maxWidth: '100%',
                gap: '8px',
                marginBottom: '8px',
                alignItems: 'center',
                border: '1px solid red',
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
                style: { flex: 2, minWidth: '200px' },
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
                style: { width: '12em', _flexShrink: 0 },
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

// Export component
window.AdvancedSortModal = AdvancedSortModal;
