/**
 * ImageFieldEditorModal Component
 *
 * Modal dialog for editing image fields using Sharp transformations
 * Similar to ImageEditorModal but works with table/id/field instead of attachmentId
 *
 * Dependencies:
 * - React (global)
 * - e (global React.createElement shorthand)
 *
 * @component
 */

class ImageFieldEditorModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      metadata: null,
      error: null,
      saving: false,

      // Edit operations
      resize: { width: '', height: '', fit: 'inside' },
      rotate: 0,
      flip: 'none',
      grayscale: false,
      blur: 0,
      sharpen: 0,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      format: '',
      quality: 90,

      // Preview
      previewUrl: '',
      previewLoading: false,

      // Replace or create new
      replaceOriginal: false,

      // Active tab
      activeTab: 'transform'
    };
    this.previewDebounce = null;
  }

  async componentDidMount() {
    await this.loadMetadata();
    this.updatePreview();
  }

  componentWillUnmount() {
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
    }
  }

  async loadMetadata() {
    const { tableName, rowId, fieldName } = this.props;

    try {
      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}/metadata`);
      const data = await response.json();

      if (data.success) {
        this.setState({
          metadata: data.metadata,
          format: data.metadata.format || 'jpeg',
          loading: false
        });
      } else {
        this.setState({
          error: data.error || 'Failed to load image metadata',
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      this.setState({
        error: 'Failed to load image metadata',
        loading: false
      });
    }
  }

  updatePreview = () => {
    // Debounce preview updates
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
    }

    this.previewDebounce = setTimeout(() => {
      this.generatePreview();
    }, 300);
  }

  generatePreview = () => {
    const { tableName, rowId, fieldName } = this.props;
    const {
      resize,
      rotate,
      flip,
      grayscale,
      blur,
      sharpen,
      brightness,
      contrast,
      saturation,
      format,
      quality
    } = this.state;

    // Build query params
    const params = new URLSearchParams();

    if (resize.width) params.append('width', resize.width);
    if (resize.height) params.append('height', resize.height);
    if (resize.fit) params.append('fit', resize.fit);
    if (rotate !== 0) params.append('rotate', rotate);
    if (flip !== 'none') params.append('flip', flip);
    if (grayscale) params.append('grayscale', 'true');
    if (blur > 0) params.append('blur', blur);
    if (sharpen > 0) params.append('sharpen', sharpen);
    if (brightness !== 1) params.append('brightness', brightness);
    if (contrast !== 1) params.append('contrast', contrast);
    if (saturation !== 1) params.append('saturation', saturation);
    if (format) params.append('format', format);
    params.append('quality', quality);

    const previewUrl = `/_api/${tableName}/${rowId}/image/${fieldName}/preview?${params.toString()}&t=${Date.now()}`;

    this.setState({ previewUrl, previewLoading: true });
  }

  handleSave = async () => {
    const { tableName, rowId, fieldName, onSave } = this.props;
    const {
      resize,
      rotate,
      flip,
      grayscale,
      blur,
      sharpen,
      brightness,
      contrast,
      saturation,
      format,
      quality,
      replaceOriginal
    } = this.state;

    this.setState({ saving: true, error: null });

    try {
      // Build operations object
      const operations = {};

      if (resize.width || resize.height) {
        operations.resize = {
          width: resize.width ? parseInt(resize.width) : null,
          height: resize.height ? parseInt(resize.height) : null,
          fit: resize.fit
        };
      }

      if (rotate !== 0) operations.rotate = rotate;
      if (flip !== 'none') operations.flip = flip;
      if (grayscale) operations.grayscale = true;
      if (blur > 0) operations.blur = blur;
      if (sharpen > 0) operations.sharpen = sharpen;
      if (brightness !== 1) operations.brightness = brightness;
      if (contrast !== 1) operations.contrast = contrast;
      if (saturation !== 1) operations.saturation = saturation;
      if (format) operations.format = format;
      operations.quality = quality;

      const response = await fetch(`/_api/${tableName}/${rowId}/image/${fieldName}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations,
          replaceOriginal
        })
      });

      const data = await response.json();

      if (data.success) {
        if (onSave) {
          onSave(data);
        }
      } else {
        this.setState({
          error: data.error || 'Failed to save image',
          saving: false
        });
      }
    } catch (error) {
      console.error('Error saving image:', error);
      this.setState({
        error: 'Failed to save image',
        saving: false
      });
    }
  }

  handleChange = (field, value) => {
    this.setState({ [field]: value }, () => {
      this.updatePreview();
    });
  }

  render() {
    const { onCancel } = this.props;
    const {
      loading,
      metadata,
      error,
      saving,
      resize,
      rotate,
      flip,
      grayscale,
      blur,
      sharpen,
      brightness,
      contrast,
      saturation,
      format,
      quality,
      previewUrl,
      previewLoading,
      replaceOriginal,
      activeTab
    } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: (e) => {
        if (e.target.className === 'modal-overlay') {
          onCancel();
        }
      }
    },
      e('div', {
        className: 'modal-content',
        style: {
          padding: '24px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          width: '1200px'
        }
      },
        // Header
        e('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }
        },
          e('h2', { style: { margin: 0 } }, '🖼️ Éditer l\'image'),
          e('button', {
            onClick: onCancel,
            style: {
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }
          }, '×')
        ),

        // Error display
        error && e('div', {
          style: {
            padding: '12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            marginBottom: '16px'
          }
        }, error),

        // Loading state
        loading && e('div', {
          style: {
            textAlign: 'center',
            padding: '40px'
          }
        }, '⏳ Chargement...'),

        // Main content
        !loading && metadata && e('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '24px'
          }
        },
          // Left: Preview
          e('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
          },
            e('div', {
              style: {
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                padding: '16px',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            },
              previewUrl && e('img', {
                src: previewUrl,
                alt: 'Preview',
                style: {
                  maxWidth: '100%',
                  maxHeight: '500px',
                  objectFit: 'contain'
                },
                onLoad: () => this.setState({ previewLoading: false }),
                onError: () => this.setState({ previewLoading: false })
              })
            ),
            previewLoading && e('div', {
              style: {
                textAlign: 'center',
                fontSize: '14px',
                color: '#666'
              }
            }, '⏳ Génération de l\'aperçu...')
          ),

          // Right: Controls
          e('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }
          },
            // Tabs
            e('div', {
              style: {
                display: 'flex',
                gap: '8px',
                borderBottom: '2px solid #ddd'
              }
            },
              ['transform', 'filters', 'format'].map(tab =>
                e('button', {
                  key: tab,
                  onClick: () => this.setState({ activeTab: tab }),
                  style: {
                    padding: '8px 16px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom: activeTab === tab ? '3px solid #007bff' : 'none',
                    fontWeight: activeTab === tab ? 'bold' : 'normal',
                    color: activeTab === tab ? '#007bff' : '#666'
                  }
                }, tab === 'transform' ? '🔄 Transformer' : tab === 'filters' ? '🎨 Filtres' : '📄 Format')
              )
            ),

            // Tab content
            e('div', { style: { flex: 1, overflowY: 'auto' } },
              // Transform tab
              activeTab === 'transform' && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                // Original dimensions
                e('div', { style: { fontSize: '14px', color: '#666' } },
                  `Dimensions: ${metadata.width} × ${metadata.height}px`
                ),

                // Resize
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, 'Redimensionner'),
                  e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
                    e('input', {
                      type: 'number',
                      placeholder: 'Largeur',
                      value: resize.width,
                      onChange: (ev) => this.handleChange('resize', { ...resize, width: ev.target.value }),
                      style: { padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }
                    }),
                    e('input', {
                      type: 'number',
                      placeholder: 'Hauteur',
                      value: resize.height,
                      onChange: (ev) => this.handleChange('resize', { ...resize, height: ev.target.value }),
                      style: { padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }
                    })
                  )
                ),

                // Rotate
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Rotation: ${rotate}°`),
                  e('input', {
                    type: 'range',
                    min: 0,
                    max: 360,
                    value: rotate,
                    onChange: (ev) => this.handleChange('rotate', parseInt(ev.target.value)),
                    style: { width: '100%' }
                  }),
                  e('div', { style: { display: 'flex', gap: '4px', marginTop: '4px' } },
                    [0, 90, 180, 270].map(angle =>
                      e('button', {
                        key: angle,
                        onClick: () => this.handleChange('rotate', angle),
                        style: {
                          flex: 1,
                          padding: '4px',
                          fontSize: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: rotate === angle ? '#007bff' : '#fff',
                          color: rotate === angle ? '#fff' : '#333'
                        }
                      }, `${angle}°`)
                    )
                  )
                ),

                // Flip
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, 'Miroir'),
                  e('select', {
                    value: flip,
                    onChange: (ev) => this.handleChange('flip', ev.target.value),
                    style: { width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }
                  },
                    e('option', { value: 'none' }, 'Aucun'),
                    e('option', { value: 'horizontal' }, 'Horizontal'),
                    e('option', { value: 'vertical' }, 'Vertical'),
                    e('option', { value: 'both' }, 'Les deux')
                  )
                )
              ),

              // Filters tab
              activeTab === 'filters' && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                // Grayscale
                e('div', {},
                  e('label', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    e('input', {
                      type: 'checkbox',
                      checked: grayscale,
                      onChange: (ev) => this.handleChange('grayscale', ev.target.checked)
                    }),
                    'Niveaux de gris'
                  )
                ),

                // Blur
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Flou: ${blur}`),
                  e('input', {
                    type: 'range',
                    min: 0,
                    max: 20,
                    step: 0.5,
                    value: blur,
                    onChange: (ev) => this.handleChange('blur', parseFloat(ev.target.value)),
                    style: { width: '100%' }
                  })
                ),

                // Sharpen
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Netteté: ${sharpen}`),
                  e('input', {
                    type: 'range',
                    min: 0,
                    max: 10,
                    step: 0.5,
                    value: sharpen,
                    onChange: (ev) => this.handleChange('sharpen', parseFloat(ev.target.value)),
                    style: { width: '100%' }
                  })
                ),

                // Brightness
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Luminosité: ${brightness}`),
                  e('input', {
                    type: 'range',
                    min: 0.5,
                    max: 2,
                    step: 0.1,
                    value: brightness,
                    onChange: (ev) => this.handleChange('brightness', parseFloat(ev.target.value)),
                    style: { width: '100%' }
                  })
                ),

                // Contrast
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Contraste: ${contrast}`),
                  e('input', {
                    type: 'range',
                    min: 0.5,
                    max: 2,
                    step: 0.1,
                    value: contrast,
                    onChange: (ev) => this.handleChange('contrast', parseFloat(ev.target.value)),
                    style: { width: '100%' }
                  })
                ),

                // Saturation
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Saturation: ${saturation}`),
                  e('input', {
                    type: 'range',
                    min: 0,
                    max: 2,
                    step: 0.1,
                    value: saturation,
                    onChange: (ev) => this.handleChange('saturation', parseFloat(ev.target.value)),
                    style: { width: '100%' }
                  })
                )
              ),

              // Format tab
              activeTab === 'format' && e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                // Current format
                e('div', { style: { fontSize: '14px', color: '#666' } },
                  `Format actuel: ${metadata.format}`
                ),

                // Format selector
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, 'Nouveau format'),
                  e('select', {
                    value: format,
                    onChange: (ev) => this.handleChange('format', ev.target.value),
                    style: { width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }
                  },
                    e('option', { value: 'jpeg' }, 'JPEG'),
                    e('option', { value: 'png' }, 'PNG'),
                    e('option', { value: 'webp' }, 'WebP'),
                    e('option', { value: 'avif' }, 'AVIF'),
                    e('option', { value: 'gif' }, 'GIF'),
                    e('option', { value: 'tiff' }, 'TIFF')
                  )
                ),

                // Quality
                e('div', {},
                  e('label', { style: { display: 'block', marginBottom: '4px', fontWeight: 'bold' } }, `Qualité: ${quality}%`),
                  e('input', {
                    type: 'range',
                    min: 1,
                    max: 100,
                    value: quality,
                    onChange: (ev) => this.handleChange('quality', parseInt(ev.target.value)),
                    style: { width: '100%' }
                  })
                )
              )
            ),

            // Replace original checkbox
            e('div', {
              className: 'image-editor-replace-section',
              style: {
                padding: '12px',
                borderRadius: '4px'
              }
            },
              e('label', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }
              },
                e('input', {
                  type: 'checkbox',
                  checked: replaceOriginal,
                  onChange: (ev) => this.setState({ replaceOriginal: ev.target.checked })
                }),
                e('span', {},
                  'Remplacer l\'original',
                  replaceOriginal && e('span', {
                    className: 'replace-warning',
                    style: {
                      display: 'block',
                      fontSize: '12px',
                      marginTop: '4px'
                    }
                  }, '⚠️ L\'image originale sera remplacée')
                )
              )
            ),

            // Actions
            e('div', {
              className: 'modal-footer',
              style: {
                display: 'flex',
                gap: '8px',
                marginTop: 'auto'
              }
            },
              e('button', {
                onClick: this.handleSave,
                disabled: saving,
                className: 'btn btn-save-image',
                style: {
                  flex: 1,
                  padding: '12px',
                  fontWeight: 'bold',
                  opacity: saving ? 0.6 : 1
                }
              }, saving ? '⏳ Enregistrement...' : '💾 Enregistrer'),
              e('button', {
                onClick: onCancel,
                disabled: saving,
                className: 'btn btn-cancel',
                style: {
                  padding: '12px 24px',
                  opacity: saving ? 0.6 : 1
                }
              }, 'Annuler')
            )
          )
        )
      )
    );
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageFieldEditorModal;
}

// Export to global scope
window.ImageFieldEditorModal = ImageFieldEditorModal;
