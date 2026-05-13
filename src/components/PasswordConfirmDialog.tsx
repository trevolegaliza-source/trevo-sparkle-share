import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  /**
   * Quando true, dispensa a senha master e mostra um AlertDialog simples
   * "Tem certeza?". Usar pra ações que o caller já decidiu serem permitidas
   * pelo role do user (ex: operacional excluindo o que ela mesma cadastrou).
   * Default: false (mantém comportamento original — senha master obrigatória).
   */
  bypassMasterPassword?: boolean;
}

export default function PasswordConfirmDialog({
  open, onOpenChange, onConfirm,
  title = 'Confirmar Ação',
  description = 'Digite a senha de administração para confirmar esta ação.',
  bypassMasterPassword = false,
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modo simples: AlertDialog sem campo de senha. Caller decidiu que esse
  // user tem direito pelo role.
  if (bypassMasterPassword) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {description.replace(/senha de administra[çc][ãa]o|senha master|senha de admin/gi, '').trim()
                || 'Esta ação é irreversível.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onOpenChange(false); onConfirm(); }}
            >
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const handleConfirm = async () => {
    if (!password) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-master-password', {
        body: { password },
      });
      if (fnError) throw fnError;
      if (data?.valid) {
        setPassword('');
        onOpenChange(false);
        onConfirm();
      } else {
        setError(true);
        toast.error('Senha incorreta');
      }
    } catch {
      setError(true);
      toast.error('Erro ao validar senha');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) { setPassword(''); setError(false); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Senha de Administração</Label>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Digite a senha..."
              className={error ? 'border-destructive' : ''}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">Senha incorreta. Tente novamente.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={!password || loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
