/**
 * ImageFieldUploader Component
 *
 * Handles image upload for image fields in forms.
 * Features:
 * - Display current image with preview
 * - Upload new image with versioning
 * - Three-dot menu for actions
 * - Edit image with Sharp transformations
 * - Download image
 * - Switch between versions
 * - Drag and drop support
 *
 * Dependencies: React
 */

class ImageFieldUploader extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      uploading: false,
      dragOver: false,
      previewUrl: props.value || null,
      showEditor: false,
      showMenu: false,
      showVersions: false,
      versions: []
    };
    this.fileInputRef = React.createRef();
    this.menuRef = React.createRef();
  }

  componentDidMount() {
    // Add click listener to close menu when clicking outside
    document.addEventListener('mousedown', this.handleClickOutside);

    // Load versions if there's an image
    if (this.state.previewUrl) {
      this.loadVersions();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  componentDidUpdate(prevProps) {
    // Update preview if value changes externally
    if (prevProps.value !== this.props.value) {
      this.setState({ previewUrl: this.props.value });
      if (this.props.value) {
        this.loadVersions();
      }
    }
  }

  handleClickOutside = (event) => {
    if (this.menuRef.current && !this.menuRef.current.contains(event.target)) {
      this.setState({ showMenu: false, showVersions: false });
    }
  }

  loadVersions = async () => {
    const { tableName, rowId, fieldName } = this.props;

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}/versions`);
      const data = await response.json();

      if (data.success) {
        this.setState({ versions: data.versions });
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  }

  handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Type de fichier non autorisé. Utilisez: JPEG, PNG, GIF, WebP ou SVG');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 10MB)');
      return;
    }

    const { tableName, rowId, fieldName, onChange } = this.props;

    this.setState({ uploading: true, showMenu: false });

    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', file);

      // Upload image
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Update preview
        this.setState({ previewUrl: data.imageUrl });

        // Notify parent
        if (onChange) {
          onChange(data.imageUrl);
        }

        // Reload versions
        await this.loadVersions();

        // Show success feedback
        if (window.showToast) {
          window.showToast('Image uploadée avec succès', 'success');
        }
      } else {
        alert(`Erreur lors de l'upload: ${data.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      this.setState({ uploading: false });
      if (this.fileInputRef.current) {
        this.fileInputRef.current.value = '';
      }
    }
  }

  handleDelete = async () => {
    if (!confirm('Supprimer cette image ?')) return;

    const { tableName, rowId, fieldName, onChange } = this.props;

    this.setState({ showMenu: false });

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Clear preview
        this.setState({ previewUrl: null, versions: [] });

        // Notify parent
        if (onChange) {
          onChange(null);
        }

        // Show success feedback
        if (window.showToast) {
          window.showToast('Image supprimée avec succès', 'success');
        }
      } else {
        alert(`Erreur lors de la suppression: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erreur lors de la suppression de l\'image');
    }
  }

  handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: true });
  }

  handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });
  }

  handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });

    const file = e.dataTransfer.files[0];
    if (file) {
      this.handleFileSelect(file);
    }
  }

  handleDownload = () => {
    const { tableName, rowId, fieldName } = this.props;
    const downloadUrl = `/_api/${tableName}/${rowId}/image/${fieldName}/download`;
    window.open(downloadUrl, '_blank');
    this.setState({ showMenu: false });
  }

  handleEdit = () => {
    this.setState({ showEditor: true, showMenu: false });
  }

  handleEditorSave = async (result) => {
    const { onChange } = this.props;

    // Update preview with new image URL
    if (result.imageUrl) {
      this.setState({
        previewUrl: result.imageUrl,
        showEditor: false
      });

      // Notify parent
      if (onChange) {
        onChange(result.imageUrl);
      }

      // Reload versions
      await this.loadVersions();

      // Show success feedback
      if (window.showToast) {
        window.showToast('Image modifiée avec succès', 'success');
      }
    }
  }

  handleEditorCancel = () => {
    this.setState({ showEditor: false });
  }

  handleSwitchVersion = async (filename) => {
    if (!confirm(`Utiliser la version "${filename}" ?`)) return;

    const { tableName, rowId, fieldName, onChange } = this.props;

    this.setState({ showMenu: false, showVersions: false });

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });

      const data = await response.json();

      if (data.success) {
        // Update preview
        this.setState({ previewUrl: data.imageUrl });

        // Notify parent
        if (onChange) {
          onChange(data.imageUrl);
        }

        // Reload versions
        await this.loadVersions();

        // Show success feedback
        if (window.showToast) {
          window.showToast('Version changée avec succès', 'success');
        }
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error('Error switching version:', error);
      alert('Erreur lors du changement de version');
    }
  }

  toggleMenu = () => {
    this.setState(prevState => ({
      showMenu: !prevState.showMenu,
      showVersions: false
    }));
  }

  toggleVersions = () => {
    this.setState(prevState => ({ showVersions: !prevState.showVersions }));
  }

  render() {
    const { previewUrl, uploading, dragOver, showEditor, showMenu, showVersions, versions } = this.state;
    const { disabled, tableName, rowId, fieldName } = this.props;

    return e('div', {
      className: 'image-field-uploader',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        border: '2px dashed ' + (dragOver ? '#007bff' : '#ddd'),
        borderRadius: '8px',
        backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
        transition: 'all 0.3s',
        position: 'relative',
        overflow: 'visible',
        zIndex: 1
      },
      onDragOver: this.handleDragOver,
      onDragLeave: this.handleDragLeave,
      onDrop: this.handleDrop
    },
      // Preview section
      previewUrl && e('div', {
        className: 'image-preview',
        style: {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100px',
          maxHeight: '200px',
          backgroundColor: '#fff',
          borderRadius: '4px',
          overflow: 'visible',
          position: 'relative'
        }
      },
        e('img', {
          src: previewUrl,
          alt: 'Image preview',
          style: {
            maxWidth: '100%',
            maxHeight: '200px',
            objectFit: 'contain'
          }
        }),

        // Zoom button (top left of image)
        e('button', {
          type: 'button',
          className: 'btn btn-image-zoom',
          style: {
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '32px',
            height: '32px',
          
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          },
          onClick: (e) => {
            e.stopPropagation();
            window.open(previewUrl, '_blank');
          },
          title: 'Ouvrir dans un nouvel onglet',
          disabled: disabled
        }, '🔍'),

        // Three-dot menu button (top right of image)
        e('button', {
          type: 'button',
          className: `btn three-dots image-menu ${showMenu ? 'open' : ''}`,
          style: {
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',

            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          },
          onClick: (e) => {
            e.stopPropagation();
            this.toggleMenu();
          },
          disabled: disabled
        }, '⋮'),

        // Dropdown menu
        showMenu && e('div', {
          ref: this.menuRef,
          className: 'image-menu-dropdown',
          style: {
            position: 'absolute',
            top: '48px',
            right: '8px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto'
          }
        },
          e('div', { style: { padding: '4px 0' } },
            // Replace image
            e('button', {
              type: 'button',
              style: {
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              },
              onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
              onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
              onClick: () => {
                this.setState({ showMenu: false });
                this.fileInputRef.current && this.fileInputRef.current.click();
              }
            }, '🔄 Remplacer l\'image'),

            // Edit image
            e('button', {
              type: 'button',
              style: {
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              },
              onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
              onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
              onClick: this.handleEdit
            }, '✏️ Éditer l\'image'),

            // Download image
            e('button', {
              type: 'button',
              style: {
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              },
              onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
              onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
              onClick: this.handleDownload
            }, '📥 Télécharger l\'image'),

            // Use another version (only if multiple versions exist)
            versions.length > 1 && e('button', {
              type: 'button',
              style: {
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s',
                borderTop: '1px solid #eee'
              },
              onMouseEnter: (e) => e.target.style.backgroundColor = '#f5f5f5',
              onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
              onClick: this.toggleVersions
            }, `📋 Récupérer une autre version ${showVersions ? '▲' : '▼'}`),

            // Version list (if expanded)
            showVersions && versions.length > 1 && e('div', {
              style: {
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#f9f9f9',
                borderTop: '1px solid #eee'
              }
            },
              versions.map((version, index) =>
                e('button', {
                  key: index,
                  type: 'button',
                  style: {
                    width: '100%',
                    padding: '8px 24px',
                    backgroundColor: version.isCurrent ? '#e3f2fd' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: version.isCurrent ? 'default' : 'pointer',
                    fontSize: '13px',
                    transition: 'background-color 0.2s',
                    fontWeight: version.isCurrent ? 'bold' : 'normal'
                  },
                  onMouseEnter: (e) => {
                    if (!version.isCurrent) e.target.style.backgroundColor = '#e0e0e0';
                  },
                  onMouseLeave: (e) => {
                    if (!version.isCurrent) e.target.style.backgroundColor = 'transparent';
                  },
                  onClick: () => !version.isCurrent && this.handleSwitchVersion(version.filename),
                  disabled: version.isCurrent
                },
                  e('div', { style: { marginBottom: '2px' } },
                    version.isCurrent ? '✓ ' : '',
                    version.filename
                  ),
                  e('div', { style: { fontSize: '11px', color: '#666' } },
                    version.sizeFormatted,
                    ' • ',
                    new Date(version.modifiedAt).toLocaleString('fr-FR')
                  )
                )
              )
            ),

            // Delete image (at bottom with separator)
            e('button', {
              type: 'button',
              style: {
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                borderTop: '1px solid #eee',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#dc3545',
                transition: 'background-color 0.2s'
              },
              onMouseEnter: (e) => e.target.style.backgroundColor = '#fee',
              onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent',
              onClick: this.handleDelete
            }, '🗑️ Supprimer l\'image')
          )
        )
      ),

      // Upload button (only show if no image)
      !previewUrl && e('button', {
        type: 'button',
        className: 'btn btn-upload-image',
        style: {
          padding: '12px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          opacity: disabled || uploading ? 0.6 : 1
        },
        onClick: () => !disabled && !uploading && this.fileInputRef.current && this.fileInputRef.current.click(),
        disabled: disabled || uploading
      },
        uploading ? '⏳ Upload en cours...' : '📎 Ajouter une image'
      ),

      // Hidden file input
      e('input', {
        ref: this.fileInputRef,
        type: 'file',
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml',
        style: { display: 'none' },
        onChange: (e) => {
          const file = e.target.files[0];
          if (file) {
            this.handleFileSelect(file);
          }
        }
      }),

      // Help text (only show when no image)
      !previewUrl && e('div', {
        className: 'image-field-help',
        style: {
          fontSize: '12px',
          color: '#6c757d',
          textAlign: 'center'
        }
      },
        dragOver
          ? 'Déposez l\'image ici'
          : 'Glissez-déposez une image ou cliquez sur le bouton (max 10MB)'
      ),

      // Image editor modal
      showEditor && previewUrl && window.ImageFieldEditorModal && e(window.ImageFieldEditorModal, {
        tableName: tableName,
        rowId: rowId,
        fieldName: fieldName,
        imageUrl: previewUrl,
        onSave: this.handleEditorSave,
        onCancel: this.handleEditorCancel
      })
    );
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageFieldUploader;
}

// Export to global scope
window.ImageFieldUploader = ImageFieldUploader;
