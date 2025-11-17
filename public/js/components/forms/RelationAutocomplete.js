/**
 * RelationAutocomplete Component
 * Autocomplete dropdown for relation fields with search
 *
 * Features:
 * - Search related records with autocomplete
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Lazy loading of initial value from API
 * - "+ button to create new related records
 * - Click outside to close dropdown
 *
 * Props:
 * - value: Current value (can be object with label or ID)
 * - currentId: ID of the currently selected related record
 * - relatedTable: Name of the related table
 * - fieldName: Name of the field
 * - disabled: Whether the input is disabled
 * - canCreate: Whether to show the "+" button
 * - onChange: Callback when a value is selected (id, item)
 * - onAddNew: Callback when "+" button is clicked
 */

const e = React.createElement;

class RelationAutocomplete extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      results: [],
      loading: false,
      showDropdown: false,
      selectedIndex: -1,
      initialLoading: true
    };
    this.searchTimeout = null;
    this.dropdownRef = React.createRef();
    this.inputRef = React.createRef();
  }

  async componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
    // Load initial value if exists
    await this.loadInitialValue();
  }

  async loadInitialValue() {
    const { value, currentId, relatedTable } = this.props;

    // Case 1: value is an object with label (from _relations)
    if (value && typeof value === 'object' && (value.label || value._label)) {
      this.setState({
        searchText: value._label || value.label,
        initialLoading: false
      });
      return;
    }

    // Case 2: currentId is provided (ID of related record)
    if (currentId && relatedTable) {
      this.setState({ initialLoading: true });
      try {
        const response = await fetch(`/_api/${relatedTable}/${currentId}`);
        const data = await response.json();

        if (data.success && data.rows && data.rows.length > 0) {
          const record = data.rows[0];
          // Use _label from API (built from displayFields) or fallback to buildLabel
          const label = record._label || this.buildLabel(record);
          this.setState({
            searchText: label,
            initialLoading: false
          });
        } else {
          this.setState({ initialLoading: false });
        }
      } catch (error) {
        console.error('Failed to load initial value:', error);
        this.setState({ initialLoading: false });
      }
    } else {
      this.setState({ initialLoading: false });
    }
  }

  buildLabel(record) {
    // Try to build a meaningful label from the record
    const values = [];
    for (const key in record) {
      if (key !== 'id' && key !== 'ownerId' && key !== 'granted' &&
          key !== 'createdAt' && key !== 'updatedAt' &&
          !key.startsWith('_') && record[key]) {
        values.push(record[key]);
        if (values.length >= 3) break; // Limit to 3 fields
      }
    }
    return values.length > 0 ? values.join(' ') : `#${record.id}`;
  }

  // Expose focus method for external use
  focus() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  handleClickOutside = (event) => {
    // Ignore if click is on the input itself or within the dropdown container
    if (this.dropdownRef.current && !this.dropdownRef.current.contains(event.target)) {
      // Use a small delay to prevent closing when clicking to focus
      setTimeout(() => {
        this.setState({ showDropdown: false });
      }, 100);
    }
  }

  handleFocus = () => {
    const { searchText } = this.state;
    // Show dropdown and trigger search if there's text
    this.setState({ showDropdown: true });

    if (searchText.length >= 1) {
      // Trigger search when focusing with existing text
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.performSearch(searchText), 100);
    }
  }

  handleSearchChange = (event) => {
    const searchText = event.target.value;
    this.setState({ searchText, showDropdown: true });

    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (searchText.length >= 1) {
      this.searchTimeout = setTimeout(() => this.performSearch(searchText), 300);
    } else {
      this.setState({ results: [], loading: false });
    }
  }

  performSearch = async (query) => {
    const { relatedTable } = this.props;
    this.setState({ loading: true });

    try {
      const response = await fetch(`/_api/search/${relatedTable}?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      if (data.success) {
        this.setState({
          results: data.results,
          loading: false,
          selectedIndex: -1
        });
      } else {
        console.error('Search failed:', data.error);
        this.setState({ results: [], loading: false });
      }
    } catch (error) {
      console.error('Search error:', error);
      this.setState({ results: [], loading: false });
    }
  }

  handleKeyDown = (event) => {
    const { results, selectedIndex, showDropdown } = this.state;

    if (!showDropdown || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.setState(prev => ({
        selectedIndex: Math.min(prev.selectedIndex + 1, results.length - 1)
      }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.setState(prev => ({
        selectedIndex: Math.max(prev.selectedIndex - 1, -1)
      }));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0) {
        this.selectItem(results[selectedIndex]);
      }
    } else if (event.key === 'Escape') {
      this.setState({ showDropdown: false });
    }
  }

  selectItem = (item) => {
    this.setState({
      searchText: item.label,
      showDropdown: false,
      results: []
    });

    if (this.props.onChange) {
      this.props.onChange(item.id, item);
    }
  }

  handleAddNew = () => {
    if (this.props.onAddNew) {
      this.props.onAddNew();
    }
  }

  render() {
    const { fieldName, disabled, canCreate } = this.props;
    const { searchText, results, loading, showDropdown, selectedIndex, initialLoading } = this.state;

    return e('div', { className: 'relation-autocomplete', ref: this.dropdownRef },
      e('div', { className: 'relation-input-wrapper' },
        e('input', {
          type: 'text',
          className: 'edit-field-input relation-input',
          value: searchText,
          onChange: this.handleSearchChange,
          onKeyDown: this.handleKeyDown,
          onFocus: this.handleFocus,
          disabled: disabled || initialLoading,
          placeholder: initialLoading ? 'Chargement...' : 'Rechercher...',
          ref: this.inputRef
        }),
        canCreate && e('button', {
          type: 'button',
          className: 'btn-add-relation',
          onClick: this.handleAddNew,
          title: 'Créer un nouvel enregistrement'
        }, '+')
      ),
      showDropdown && (loading || results.length > 0) && e('div', { className: 'autocomplete-dropdown' },
        loading && e('div', { className: 'autocomplete-loading' }, 'Recherche...'),
        !loading && results.length === 0 && searchText.length >= 1 && e('div', { className: 'autocomplete-empty' }, 'Aucun résultat'),
        !loading && results.map((item, idx) =>
          e('div', {
            key: item.id,
            className: `autocomplete-item ${idx === selectedIndex ? 'selected' : ''}`,
            onClick: () => this.selectItem(item),
            onMouseEnter: () => this.setState({ selectedIndex: idx })
          }, item.label)
        )
      )
    );
  }
}
