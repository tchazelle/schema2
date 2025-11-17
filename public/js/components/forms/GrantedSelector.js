/**
 * GrantedSelector Component
 * Special dropdown for controlling row access (draft/shared/published)
 *
 * The "granted" field controls row-level security:
 * - draft: Only the owner can access (private)
 * - shared: Table-level permissions apply
 * - published @role: Accessible by the specified role and descendants
 *
 * Features:
 * - Radio button interface for grant levels
 * - Role selector for published mode
 * - Compact mode for inline editing
 * - Visual icons for each state
 *
 * Props:
 * - value: Current granted value (e.g., "draft", "shared", "published @public")
 * - publishableTo: Array of roles that can be published to
 * - tableGranted: Table-level permissions object
 * - disabled: Whether the selector is disabled
 * - compact: Whether to show compact mode (single select)
 * - onChange: Callback when value changes (grantedValue)
 */

const e = React.createElement;

class GrantedSelector extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: props.value || 'draft',
      publishRole: 'public'
    };

    // Parse initial value
    if (props.value && props.value.startsWith('published @')) {
      this.state.selectedValue = 'published';
      this.state.publishRole = props.value.replace('published @', '');
    }
  }

  handleChange = (value) => {
    this.setState({ selectedValue: value });

    let grantedValue = value;
    if (value === 'published') {
      grantedValue = `published @${this.state.publishRole}`;
    }

    if (this.props.onChange) {
      this.props.onChange(grantedValue);
    }
  }

  handlePublishRoleChange = (role) => {
    this.setState({ publishRole: role });

    if (this.state.selectedValue === 'published') {
      if (this.props.onChange) {
        this.props.onChange(`published @${role}`);
      }
    }
  }

  getIcon() {
    const { selectedValue, publishRole } = this.state;
    switch (selectedValue) {
      case 'draft': return '📝';
      case 'shared': return '👥';
      case 'published': return '🌐';
      default: return '📝';
    }
  }

  getLabel() {
    const { selectedValue, publishRole } = this.state;
    switch (selectedValue) {
      case 'draft': return 'Brouillon';
      case 'shared': return 'Partagée';
      case 'published': return `Publiée @${publishRole}`;
      default: return 'Brouillon';
    }
  }

  getTableRoles() {
    const { tableGranted = {} } = this.props;
    // Get all roles that have at least "read" permission
    const rolesWithRead = Object.keys(tableGranted).filter(role => {
      const permissions = tableGranted[role];
      return Array.isArray(permissions) && permissions.includes('read');
    });
    return rolesWithRead.length > 0 ? rolesWithRead.join(', ') : 'utilisateurs autorisés';
  }

  render() {
    const { publishableTo = [], tableGranted = {}, disabled, compact } = this.props;
    const { selectedValue, publishRole } = this.state;
    const tableRolesLabel = this.getTableRoles();

    if (compact) {
      return e('div', { className: 'granted-selector-compact' },
        e('select', {
          className: 'granted-compact-select',
          value: selectedValue === 'published' ? `published:${publishRole}` : selectedValue,
          onChange: (ev) => {
            const val = ev.target.value;
            if (val.startsWith('published:')) {
              const role = val.replace('published:', '');
              this.setState({ selectedValue: 'published', publishRole: role });
              if (this.props.onChange) {
                this.props.onChange(`published @${role}`);
              }
            } else {
              this.handleChange(val);
            }
          },
          disabled: disabled,
          title: this.getLabel()
        },
          e('option', { value: 'draft' }, '📝 Brouillon'),
          e('option', { value: 'shared' }, `👥 Partagée (${tableRolesLabel})`),
          publishableTo.length > 0 && publishableTo.map(role =>
            e('option', { key: role, value: `published:${role}` }, `🌐 Publiée @${role}`)
          )
        )
      );
    }

    return e('div', { className: 'granted-selector' },
      // Draft option
      e('div', {
        className: `granted-option ${selectedValue === 'draft' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('draft')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'draft',
          checked: selectedValue === 'draft',
          onChange: () => this.handleChange('draft'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '📝 Brouillon'),
          e('div', { className: 'granted-option-desc' }, 'La fiche vous appartient')
        )
      ),

      // Shared option
      e('div', {
        className: `granted-option ${selectedValue === 'shared' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('shared')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'shared',
          checked: selectedValue === 'shared',
          onChange: () => this.handleChange('shared'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '👥 Partagée'),
          e('div', { className: 'granted-option-desc' }, `Partagée avec ${tableRolesLabel}`)
        )
      ),

      // Published option (if publishableTo is set)
      publishableTo.length > 0 && e('div', {
        className: `granted-option ${selectedValue === 'published' ? 'selected' : ''}`,
        onClick: disabled ? null : () => this.handleChange('published')
      },
        e('input', {
          type: 'radio',
          name: 'granted',
          value: 'published',
          checked: selectedValue === 'published',
          onChange: () => this.handleChange('published'),
          disabled: disabled
        }),
        e('div', { className: 'granted-option-label' },
          e('strong', null, '🌐 Publiée'),
          e('div', { className: 'granted-option-desc' },
            e('select', {
              className: 'edit-field-select',
              value: publishRole,
              onChange: (e) => this.handlePublishRoleChange(e.target.value),
              onClick: (e) => e.stopPropagation(),
              disabled: disabled || selectedValue !== 'published'
            },
              publishableTo.map(role =>
                e('option', { key: role, value: role }, role)
              )
            )
          )
        )
      )
    );
  }
}
