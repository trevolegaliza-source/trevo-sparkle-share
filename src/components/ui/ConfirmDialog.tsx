/**
 * AUDIT-015 (29/05/2026): substitui window.confirm() por AlertDialog do shadcn.
 *
 * Uso típico:
 *
 *   const [confirm, ConfirmDialog] = useConfirmDialog();
 *
 *   async function deletar() {
 *     const ok = await confirm({
 *       title: 'Excluir orçamento?',
 *       description: 'Esta ação não pode ser desfeita.',
 *       destructive: true,
 *     });
 *     if (!ok) return;
 *     // ... deleta de verdade
 *   }
 *
 *   return (
 *     <>
 *       <Button onClick={deletar}>Excluir</Button>
 *       <ConfirmDialog />
 *     </>
 *   );
 */
import { useState, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const ConfirmDialog = () => (
    <AlertDialog open={open} onOpenChange={(o) => !o && handleClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {options.cancelLabel || 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleClose(true)}
            className={
              options.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {options.confirmLabel || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [confirm, ConfirmDialog] as const;
}
