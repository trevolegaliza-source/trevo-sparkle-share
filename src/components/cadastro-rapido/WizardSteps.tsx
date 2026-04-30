import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Cliente', step: 1 },
  { label: 'Processo', step: 2 },
  { label: 'Valor', step: 3 },
  { label: 'Revisão', step: 4 },
];

interface WizardStepsProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export default function WizardSteps({ currentStep, completedSteps, onStepClick }: WizardStepsProps) {
  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STEPS.map((s, i) => {
        const isActive = currentStep === s.step;
        const isCompleted = completedSteps.includes(s.step);
        const canClick = isCompleted || s.step <= Math.max(...completedSteps, currentStep);

        return (
          <div key={s.step} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => canClick && onStepClick(s.step)}
              disabled={!canClick}
              className={cn(
                'flex items-center gap-2 transition-colors',
                canClick ? 'cursor-pointer' : 'cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0',
                  isActive && 'bg-primary border-primary text-primary-foreground',
                  isCompleted && !isActive && 'bg-primary/20 border-primary text-primary',
                  !isActive && !isCompleted && 'border-border text-muted-foreground bg-muted/30'
                )}
              >
                {isCompleted && !isActive ? <Check className="h-4 w-4" /> : s.step}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:inline',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 rounded-full transition-colors',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
