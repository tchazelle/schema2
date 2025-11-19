/**
 * ImageFieldUploader Component
 *
 * Handles image upload for image fields in forms.
 * Features:
 * - Display current image with preview
 * - Upload new image
 * - Delete image
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
      previewUrl: props.value || null
    };
    this.fileInputRef = React.createRef();
  }

  componentDidUpdate(prevProps) {
    // Update preview if value changes externally
    if (prevProps.value !== this.props.value) {
      this.setState({ previewUrl: this.props.value });
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

    this.setState({ uploading: true });

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

        // Show success feedback
        alert('✓ Image uploadée avec succès');
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

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Clear preview
        this.setState({ previewUrl: null });

        // Notify parent
        if (onChange) {
          onChange(null);
        }

        // Show success feedback
        alert('✓ Image supprimée avec succès');
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

  render() {
    const { previewUrl, uploading, dragOver } = this.state;
    const { disabled } = this.props;

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
        transition: 'all 0.3s'
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
          minHeight: '200px',
          maxHeight: '400px',
          backgroundColor: '#fff',
          borderRadius: '4px',
          overflow: 'hidden'
        }
      },
        e('img', {
          src: previewUrl,
          alt: 'Image preview',
          style: {
            maxWidth: '100%',
            maxHeight: '400px',
            objectFit: 'contain',
            cursor: 'pointer'
          },
          onClick: () => window.open(previewUrl, '_blank')
        })
      ),

      // Upload/Delete buttons
      e('div', {
        className: 'image-field-controls',
        style: {
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }
      },
        // Upload button
        e('button', {
          type: 'button',
          className: 'btn-upload-image',
          style: {
            flex: 1,
            padding: '8px 16px',
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
          uploading ? '⏳ Upload en cours...' : (previewUrl ? '🖼️ Changer l\'image' : '📎 Ajouter une image')
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

        // Delete button (only show if there's an image)
        previewUrl && e('button', {
          type: 'button',
          className: 'btn-delete-image',
          style: {
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: disabled ? 0.6 : 1
          },
          onClick: this.handleDelete,
          disabled: disabled
        }, '🗑️ Supprimer')
      ),

      // Help text
      e('div', {
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
      )
    );
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageFieldUploader;
}

// Export to global scope
window.ImageFieldUploader = ImageFieldUploader;
