/**
 * AdvancedSearchModal Component
 *
 * Modal dialog for configuring complex search conditions with AND/OR logic:
 * - Multiple condition groups (OR logic between groups)
 * - Multiple conditions per group (AND logic within group)
 * - Support for various operators per field type
 * - Level 1 and Level 2 N:1 relation field searching
 *
 * Features:
 * - Type-aware operator selection (text, number, date, boolean)
 * - Operators: contains, equals, greater than, less than, between, etc.
 * - Nested condition groups for complex queries
 * - Dynamic field list based on table structure
 * - Add/remove conditions and groups
 * - Visual indicators for AND/OR logic
 *
 * Dependencies:
 * - React (via global React object)
 *
 * Props:
 * - structure: Table structure with fields and relations
 * - onApply: Callback function when search is applied (receives searchGroups array)
 * - onClose: Callback function to close modal
 *
 * State:
 * - searchGroups: Array of condition groups, each containing conditions array
 * - relatedStructures: Cache of fetched related table structures
 *
 * Search Structure:
 * [
 *   { conditions: [{field, operator, value, value2?}] }, // Group 1 (AND logic)
 *   { conditions: [{field, operator, value, value2?}] }  // Group 2 (OR with Group 1)
 * ]
 *
 * @file /home/user/schema2/public/js/components/search/AdvancedSearchModal.js
 * @extracted Phase 6 of crudList.js refactoring
 */

const e = React.createElement;

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

// Export component
window.AdvancedSearchModal = AdvancedSearchModal;
