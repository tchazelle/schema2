/**
 * ImageEditorModal Component
 *
 * Modal dialog for editing images using Sharp transformations
 * Provides real-time preview and various editing options
 *
 * Dependencies:
 * - React (global)
 * - e (global React.createElement shorthand)
 *
 * @component
 */

class ImageEditorModal extends React.Component {
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
    const { attachmentId } = this.props;

    try {
      const response = await fetch(`/_api/attachments/${attachmentId}/image-metadata`);
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
    const { attachmentId } = this.props;
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

    const previewUrl = `/_api/attachments/${attachmentId}/preview?${params.toString()}&t=${Date.now()}`;

    this.setState({ previewUrl, previewLoading: true });
  }

  handleSave = async () => {
    const { attachmentId, onSave } = this.props;
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

      const response = await fetch(`/_api/attachments/${attachmentId}/edit-image`, {
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

  handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onCancel();
    }
  }

  renderTransformTab() {
    const { resize, rotate, flip, metadata } = this.state;

    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      // Original dimensions
      metadata && e('div', {
        style: {
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }
      },
        `Original: ${metadata.width} × ${metadata.height} px`
      ),

      // Resize
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, '📐 Redimensionner'),
        e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
          e('input', {
            type: 'number',
            placeholder: 'Largeur',
            value: resize.width,
            onChange: (ev) => {
              this.setState({ resize: { ...resize, width: ev.target.value } }, this.updatePreview);
            },
            style: {
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }
          }),
          e('input', {
            type: 'number',
            placeholder: 'Hauteur',
            value: resize.height,
            onChange: (ev) => {
              this.setState({ resize: { ...resize, height: ev.target.value } }, this.updatePreview);
            },
            style: {
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }
          })
        ),
        e('select', {
          value: resize.fit,
          onChange: (ev) => {
            this.setState({ resize: { ...resize, fit: ev.target.value } }, this.updatePreview);
          },
          style: {
            marginTop: '8px',
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            width: '100%'
          }
        },
          e('option', { value: 'inside' }, 'Contenir (inside)'),
          e('option', { value: 'cover' }, 'Couvrir (cover)'),
          e('option', { value: 'fill' }, 'Remplir (fill)'),
          e('option', { value: 'contain' }, 'Contenir sans agrandir (contain)'),
          e('option', { value: 'outside' }, 'À l\'extérieur (outside)')
        )
      ),

      // Rotate
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `🔄 Rotation: ${rotate}°`),
        e('input', {
          type: 'range',
          min: '0',
          max: '360',
          step: '90',
          value: rotate,
          onChange: (ev) => {
            this.setState({ rotate: parseInt(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        }),
        e('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
          e('button', {
            onClick: () => this.setState({ rotate: 0 }, this.updatePreview),
            style: this.getButtonStyle(rotate === 0)
          }, '0°'),
          e('button', {
            onClick: () => this.setState({ rotate: 90 }, this.updatePreview),
            style: this.getButtonStyle(rotate === 90)
          }, '90°'),
          e('button', {
            onClick: () => this.setState({ rotate: 180 }, this.updatePreview),
            style: this.getButtonStyle(rotate === 180)
          }, '180°'),
          e('button', {
            onClick: () => this.setState({ rotate: 270 }, this.updatePreview),
            style: this.getButtonStyle(rotate === 270)
          }, '270°')
        )
      ),

      // Flip
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, '🔃 Retourner'),
        e('div', { style: { display: 'flex', gap: '8px' } },
          e('button', {
            onClick: () => this.setState({ flip: 'none' }, this.updatePreview),
            style: this.getButtonStyle(flip === 'none')
          }, 'Aucun'),
          e('button', {
            onClick: () => this.setState({ flip: 'horizontal' }, this.updatePreview),
            style: this.getButtonStyle(flip === 'horizontal')
          }, '↔️ Horizontal'),
          e('button', {
            onClick: () => this.setState({ flip: 'vertical' }, this.updatePreview),
            style: this.getButtonStyle(flip === 'vertical')
          }, '↕️ Vertical'),
          e('button', {
            onClick: () => this.setState({ flip: 'both' }, this.updatePreview),
            style: this.getButtonStyle(flip === 'both')
          }, '↔️↕️ Les deux')
        )
      )
    );
  }

  renderFiltersTab() {
    const { grayscale, blur, sharpen, brightness, contrast, saturation } = this.state;

    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      // Grayscale
      e('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        e('input', {
          type: 'checkbox',
          id: 'grayscale',
          checked: grayscale,
          onChange: (ev) => {
            this.setState({ grayscale: ev.target.checked }, this.updatePreview);
          },
          style: { cursor: 'pointer' }
        }),
        e('label', {
          htmlFor: 'grayscale',
          style: { cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }
        }, '⬛ Noir et blanc')
      ),

      // Blur
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `🌫️ Flou: ${blur}`),
        e('input', {
          type: 'range',
          min: '0',
          max: '20',
          step: '0.5',
          value: blur,
          onChange: (ev) => {
            this.setState({ blur: parseFloat(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      ),

      // Sharpen
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `✨ Netteté: ${sharpen}`),
        e('input', {
          type: 'range',
          min: '0',
          max: '10',
          step: '0.5',
          value: sharpen,
          onChange: (ev) => {
            this.setState({ sharpen: parseFloat(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      ),

      // Brightness
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `☀️ Luminosité: ${brightness.toFixed(2)}`),
        e('input', {
          type: 'range',
          min: '0.5',
          max: '2',
          step: '0.1',
          value: brightness,
          onChange: (ev) => {
            this.setState({ brightness: parseFloat(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      ),

      // Contrast
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `🎨 Contraste: ${contrast.toFixed(2)}`),
        e('input', {
          type: 'range',
          min: '0.5',
          max: '2',
          step: '0.1',
          value: contrast,
          onChange: (ev) => {
            this.setState({ contrast: parseFloat(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      ),

      // Saturation
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `🌈 Saturation: ${saturation.toFixed(2)}`),
        e('input', {
          type: 'range',
          min: '0',
          max: '2',
          step: '0.1',
          value: saturation,
          onChange: (ev) => {
            this.setState({ saturation: parseFloat(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      )
    );
  }

  renderFormatTab() {
    const { format, quality, metadata } = this.state;

    return e('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      // Current format
      metadata && e('div', {
        style: {
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }
      },
        `Format actuel: ${metadata.format.toUpperCase()}`
      ),

      // Format selector
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, '📄 Format de sortie'),
        e('select', {
          value: format,
          onChange: (ev) => {
            this.setState({ format: ev.target.value }, this.updatePreview);
          },
          style: {
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            width: '100%'
          }
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
      e('div', null,
        e('label', {
          style: { display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }
        }, `⚙️ Qualité: ${quality}%`),
        e('input', {
          type: 'range',
          min: '1',
          max: '100',
          value: quality,
          onChange: (ev) => {
            this.setState({ quality: parseInt(ev.target.value) }, this.updatePreview);
          },
          style: { width: '100%' }
        })
      )
    );
  }

  getButtonStyle(isActive) {
    return {
      flex: 1,
      padding: '8px 12px',
      border: isActive ? '2px solid #007bff' : '1px solid #ced4da',
      borderRadius: '4px',
      backgroundColor: isActive ? '#007bff' : 'white',
      color: isActive ? 'white' : '#333',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: isActive ? 'bold' : 'normal',
      transition: 'all 0.2s'
    };
  }

  render() {
    const { onCancel, attachment } = this.props;
    const {
      loading,
      metadata,
      error,
      saving,
      previewUrl,
      previewLoading,
      replaceOriginal,
      activeTab
    } = this.state;

    return e('div', {
      className: 'modal-overlay',
      onClick: this.handleOverlayClick,
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        overflow: 'auto'
      }
    },
      e('div', {
        className: 'modal-content',
        onClick: (e) => e.stopPropagation(),
        style: {
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '95%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column'
        }
      },
        // Header
        e('div', {
          style: {
            borderBottom: '2px solid #007bff',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }
        },
          e('h2', {
            style: {
              margin: 0,
              color: '#007bff',
              fontSize: '20px',
              fontWeight: 'bold'
            }
          }, '🖼️ Éditeur d\'image'),
          e('button', {
            onClick: onCancel,
            style: {
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }
          }, '×')
        ),

        // Loading state
        loading && e('div', {
          style: {
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }
        }, '⏳ Chargement...'),

        // Error state
        error && e('div', {
          style: {
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '12px',
            color: '#721c24',
            margin: '16px 24px'
          }
        }, `❌ ${error}`),

        // Content
        !loading && !error && e('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '1fr 400px',
            gap: '24px',
            padding: '24px',
            flex: 1,
            overflow: 'hidden'
          }
        },
          // Preview section
          e('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'hidden'
            }
          },
            e('div', {
              style: {
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }
            }, '👁️ Aperçu'),
            e('div', {
              style: {
                flex: 1,
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                minHeight: '400px'
              }
            },
              previewLoading && e('div', {
                style: {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#666'
                }
              }, '⏳ Chargement...'),
              previewUrl && e('img', {
                src: previewUrl,
                alt: 'Preview',
                onLoad: () => this.setState({ previewLoading: false }),
                style: {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }
              })
            )
          ),

          // Controls section
          e('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'auto'
            }
          },
            // Tabs
            e('div', {
              style: {
                display: 'flex',
                gap: '4px',
                borderBottom: '1px solid #dee2e6'
              }
            },
              e('button', {
                onClick: () => this.setState({ activeTab: 'transform' }),
                style: {
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: activeTab === 'transform' ? '2px solid #007bff' : '2px solid transparent',
                  backgroundColor: activeTab === 'transform' ? '#f8f9fa' : 'transparent',
                  color: activeTab === 'transform' ? '#007bff' : '#666',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === 'transform' ? 'bold' : 'normal'
                }
              }, '🔄 Transformer'),
              e('button', {
                onClick: () => this.setState({ activeTab: 'filters' }),
                style: {
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: activeTab === 'filters' ? '2px solid #007bff' : '2px solid transparent',
                  backgroundColor: activeTab === 'filters' ? '#f8f9fa' : 'transparent',
                  color: activeTab === 'filters' ? '#007bff' : '#666',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === 'filters' ? 'bold' : 'normal'
                }
              }, '🎨 Filtres'),
              e('button', {
                onClick: () => this.setState({ activeTab: 'format' }),
                style: {
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: activeTab === 'format' ? '2px solid #007bff' : '2px solid transparent',
                  backgroundColor: activeTab === 'format' ? '#f8f9fa' : 'transparent',
                  color: activeTab === 'format' ? '#007bff' : '#666',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === 'format' ? 'bold' : 'normal'
                }
              }, '📄 Format')
            ),

            // Tab content
            e('div', {
              style: {
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                overflow: 'auto'
              }
            },
              activeTab === 'transform' && this.renderTransformTab(),
              activeTab === 'filters' && this.renderFiltersTab(),
              activeTab === 'format' && this.renderFormatTab()
            ),

            // Replace original checkbox
            e('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: replaceOriginal ? '#fff3cd' : '#f8f9fa',
                border: replaceOriginal ? '1px solid #ffc107' : '1px solid #dee2e6',
                borderRadius: '4px'
              }
            },
              e('input', {
                type: 'checkbox',
                id: 'replaceOriginal',
                checked: replaceOriginal,
                onChange: (ev) => this.setState({ replaceOriginal: ev.target.checked }),
                style: { cursor: 'pointer' }
              }),
              e('label', {
                htmlFor: 'replaceOriginal',
                style: {
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#333',
                  flex: 1
                }
              }, replaceOriginal
                ? '⚠️ Remplacer l\'image originale'
                : '➕ Créer une nouvelle image'
              )
            ),

            // Action buttons
            e('div', {
              style: {
                display: 'flex',
                gap: '12px',
                marginTop: '8px'
              }
            },
              e('button', {
                onClick: onCancel,
                style: {
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #6c757d',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#6c757d',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }
              }, 'Annuler'),
              e('button', {
                onClick: this.handleSave,
                disabled: saving,
                style: {
                  flex: 2,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: saving ? '#ccc' : '#28a745',
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }
              }, saving ? '⏳ Enregistrement...' : '💾 Enregistrer')
            )
          )
        )
      )
    );
  }
}

// Export the component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageEditorModal;
}

// Export to global scope for use in other components
if (typeof window !== 'undefined') {
  window.ImageEditorModal = ImageEditorModal;
}
