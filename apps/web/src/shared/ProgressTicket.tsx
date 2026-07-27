import './ProgressTicket.css';

export interface Step {
  id: string;
  label: string;
  completed: boolean;
  current?: boolean;
  error?: boolean;
}

interface ProgressTicketProps {
  steps: Step[];
  variant?: 'linear' | 'circular';
  showLabels?: boolean;
  onStepClick?: (stepId: string) => void;
}

export function ProgressTicket({
  steps,
  variant = 'linear',
  showLabels = true,
  onStepClick,
}: ProgressTicketProps) {
  if (variant === 'circular') {
    return <CircularProgressTicket steps={steps} showLabels={showLabels} onStepClick={onStepClick} />;
  }

  return <LinearProgressTicket steps={steps} showLabels={showLabels} onStepClick={onStepClick} />;
}

function LinearProgressTicket({
  steps,
  showLabels,
  onStepClick,
}: {
  steps: Step[];
  showLabels: boolean;
  onStepClick?: (stepId: string) => void;
}) {
  return (
    <div className="progress-ticket progress-ticket--linear">
      <div className="progress-track">
        {steps.map((step, idx) => {
          const isCompleted = step.completed;
          const isCurrent = step.current;
          const nextStep = steps[idx + 1];

          return (
            <div key={step.id}>
              <button
                type="button"
                className={`step-indicator ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${step.error ? 'error' : ''}`}
                onClick={() => onStepClick?.(step.id)}
                aria-label={`Paso ${idx + 1}: ${step.label}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? '✓' : step.error ? '!' : idx + 1}
              </button>

              {nextStep && (
                <div
                  className={`step-line ${isCompleted ? 'completed' : ''}`}
                  role="presentation"
                />
              )}
            </div>
          );
        })}
      </div>

      {showLabels && (
        <div className="step-labels">
          {steps.map((step) => (
            <div key={step.id} className="step-label-item">
              <span className={`step-label ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CircularProgressTicket({
  steps,
  showLabels,
  onStepClick,
}: {
  steps: Step[];
  showLabels: boolean;
  onStepClick?: (stepId: string) => void;
}) {
  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div className="progress-ticket progress-ticket--circular">
      <div className="progress-circle-container">
        <div className="progress-circle">
          <svg viewBox="0 0 120 120" className="progress-ring-svg">
            <circle
              cx="60"
              cy="60"
              r="54"
              className="progress-ring-background"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              className="progress-ring-foreground"
              style={{
                strokeDashoffset: 339.29 * (1 - progressPercent / 100),
              }}
            />
          </svg>
          <div className="progress-text">
            <strong>{completedCount}</strong>
            <span>de {steps.length}</span>
          </div>
        </div>
      </div>

      {showLabels && (
        <div className="step-list">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`step-list-item ${step.completed ? 'completed' : ''} ${step.current ? 'current' : ''}`}
              onClick={() => onStepClick?.(step.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onStepClick?.(step.id);
                }
              }}
            >
              <div className="step-list-indicator">
                {step.completed ? '✓' : step.error ? '!' : '○'}
              </div>
              <span className="step-list-label">{step.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
