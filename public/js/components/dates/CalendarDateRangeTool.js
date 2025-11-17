/**
 * CalendarDateRangeTool Component
 * Smart date range picker for calendar events
 *
 * Modes:
 * 1. automatique: endDate = startDate + 1 hour
 * 2. durée: endDate = startDate + duration (in minutes)
 * 3. même jour: endDate = same day as startDate + end time
 * 4. période: separate startDate and endDate inputs with validation
 *
 * Features:
 * - Auto-detect current mode from existing values
 * - Mode switching recalculates endDate
 * - Duration presets (30min, 1h, 1h30, 2h)
 * - Validation (endDate must be after startDate)
 * - Real-time preview for calculated modes
 *
 * Props:
 * - startValue: Current start datetime value
 * - endValue: Current end datetime value
 * - startLabel: Label for start date field
 * - endLabel: Label for end date field
 * - onChangeRange: Callback when range changes (startValue, endValue)
 */

const e = React.createElement;

class CalendarDateRangeTool extends React.Component {
  constructor(props) {
    super(props);

    // Determine initial mode based on current values
    const { startValue, endValue } = props;
    const initialMode = this.detectMode(startValue, endValue);

    this.state = {
      mode: initialMode,
      duration: 60, // Default duration in minutes
      endTime: '23:59' // Default end time for "même jour" mode
    };
  }

  /**
   * Detect the current mode based on start and end values
   */
  detectMode(startValue, endValue) {
    if (!startValue || !endValue) {
      return 'automatique';
    }

    const start = new Date(startValue);
    const end = new Date(endValue);
    const diffMinutes = Math.round((end - start) / (1000 * 60));

    // If exactly 60 minutes difference -> automatique
    if (diffMinutes === 60) {
      return 'automatique';
    }

    // If same day but different times -> même jour
    if (start.toDateString() === end.toDateString()) {
      return 'même jour';
    }

    // If different days -> période
    if (start.toDateString() !== end.toDateString()) {
      return 'période';
    }

    // Default to durée
    return 'durée';
  }

  /**
   * Format date for datetime-local input (YYYY-MM-DDTHH:MM)
   */
  formatDateForInput(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Extract time from datetime value (HH:MM)
   */
  extractTime(dateValue) {
    if (!dateValue) return '00:00';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '00:00';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  /**
   * Calculate endDate based on mode and inputs
   */
  calculateEndDate(startValue, mode, duration, endTime) {
    if (!startValue) return '';

    const start = new Date(startValue);
    if (isNaN(start.getTime())) return '';

    let end;

    switch (mode) {
      case 'automatique':
        // endDate = startDate + 1 hour
        end = new Date(start.getTime() + 60 * 60 * 1000);
        break;

      case 'durée':
        // endDate = startDate + duration (in minutes)
        end = new Date(start.getTime() + duration * 60 * 1000);
        break;

      case 'même jour':
        // endDate = same day + endTime
        const [hours, minutes] = endTime.split(':').map(Number);
        end = new Date(start);
        end.setHours(hours, minutes, 0, 0);

        // Ensure endDate > startDate
        if (end <= start) {
          end = new Date(start.getTime() + 60 * 60 * 1000); // Fallback to +1 hour
        }
        break;

      case 'période':
        // Will be handled separately with explicit endDate input
        return null;

      default:
        end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    return this.formatDateForInput(end);
  }

  /**
   * Handle mode change
   */
  handleModeChange = (newMode) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ mode: newMode }, () => {
      // Recalculate endDate based on new mode
      if (newMode !== 'période') {
        const { duration, endTime } = this.state;
        const calculatedEndDate = this.calculateEndDate(startValue, newMode, duration, endTime);

        if (calculatedEndDate) {
          onChangeRange(startValue, calculatedEndDate);
        }
      }
    });
  }

  /**
   * Handle startDate change
   */
  handleStartChange = (newStartValue) => {
    const { onChangeRange, endValue } = this.props;
    const { mode, duration, endTime } = this.state;

    if (mode === 'période') {
      // In période mode, keep endDate as is (but validate it's > startDate)
      let finalEndValue = endValue;
      if (endValue && new Date(newStartValue) >= new Date(endValue)) {
        // If endDate is not after startDate, set it to startDate + 1 hour
        finalEndValue = this.calculateEndDate(newStartValue, 'automatique', 60, null);
      }
      onChangeRange(newStartValue, finalEndValue);
    } else {
      // Calculate endDate automatically
      const calculatedEndDate = this.calculateEndDate(newStartValue, mode, duration, endTime);
      onChangeRange(newStartValue, calculatedEndDate);
    }
  }

  /**
   * Handle duration change (for "durée" mode)
   */
  handleDurationChange = (newDuration) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ duration: newDuration }, () => {
      const calculatedEndDate = this.calculateEndDate(startValue, 'durée', newDuration, null);
      if (calculatedEndDate) {
        onChangeRange(startValue, calculatedEndDate);
      }
    });
  }

  /**
   * Handle end time change (for "même jour" mode)
   */
  handleEndTimeChange = (newEndTime) => {
    const { startValue, onChangeRange } = this.props;

    this.setState({ endTime: newEndTime }, () => {
      const calculatedEndDate = this.calculateEndDate(startValue, 'même jour', null, newEndTime);
      if (calculatedEndDate) {
        onChangeRange(startValue, calculatedEndDate);
      }
    });
  }

  /**
   * Handle explicit endDate change (for "période" mode)
   */
  handleEndChange = (newEndValue) => {
    const { startValue, onChangeRange } = this.props;

    // Validate that endDate > startDate
    if (startValue && newEndValue && new Date(newEndValue) <= new Date(startValue)) {
      // Show error or auto-correct
      alert('La date de fin doit être postérieure à la date de début');
      return;
    }

    onChangeRange(startValue, newEndValue);
  }

  render() {
    const { startValue, endValue, startLabel, endLabel } = this.props;
    const { mode, duration, endTime } = this.state;

    return e('div', { className: 'calendar-date-range-tool' },
      // Mode selector
      e('div', { className: 'date-range-mode-selector' },
        e('label', { className: 'edit-field-label' }, 'Mode de saisie :'),
        e('select', {
          className: 'edit-field-select mode-select',
          value: mode,
          onChange: (ev) => this.handleModeChange(ev.target.value)
        },
          e('option', { value: 'automatique' }, '⚡ Automatique (1 heure)'),
          e('option', { value: 'durée' }, '⏱️ Durée personnalisée'),
          e('option', { value: 'même jour' }, '📅 Même jour'),
          e('option', { value: 'période' }, '📆 Période complète')
        )
      ),

      // Start date input (always shown)
      e('div', { className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, startLabel),
        e('input', {
          type: 'datetime-local',
          className: 'edit-field-input',
          value: this.formatDateForInput(startValue),
          onChange: (ev) => this.handleStartChange(ev.target.value)
        })
      ),

      // Mode-specific inputs
      mode === 'durée' && e('div', { className: 'edit-field date-range-duration' },
        e('label', { className: 'edit-field-label' }, 'Durée (minutes) :'),
        e('div', { className: 'duration-input-group' },
          e('input', {
            type: 'number',
            className: 'edit-field-input duration-input',
            value: duration,
            min: 1,
            step: 15,
            onChange: (ev) => this.handleDurationChange(Number(ev.target.value))
          }),
          e('span', { className: 'duration-presets' },
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(30)
            }, '30 min'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(60)
            }, '1h'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(90)
            }, '1h30'),
            e('button', {
              type: 'button',
              className: 'btn-duration-preset',
              onClick: () => this.handleDurationChange(120)
            }, '2h')
          )
        )
      ),

      mode === 'même jour' && e('div', { className: 'edit-field date-range-endtime' },
        e('label', { className: 'edit-field-label' }, 'Heure de fin :'),
        e('input', {
          type: 'time',
          className: 'edit-field-input',
          value: endTime,
          onChange: (ev) => this.handleEndTimeChange(ev.target.value)
        })
      ),

      mode === 'période' && e('div', { className: 'edit-field' },
        e('label', { className: 'edit-field-label' }, endLabel),
        e('input', {
          type: 'datetime-local',
          className: 'edit-field-input',
          value: this.formatDateForInput(endValue),
          onChange: (ev) => this.handleEndChange(ev.target.value)
        })
      ),

      // Preview of calculated endDate (for non-période modes)
      mode !== 'période' && e('div', { className: 'date-range-preview' },
        e('span', { className: 'preview-label' }, endLabel + ' : '),
        e('span', { className: 'preview-value' },
          endValue ? new Date(endValue).toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : '-'
        )
      )
    );
  }
}
