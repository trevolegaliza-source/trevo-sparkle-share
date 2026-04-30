import { MessageCircle } from 'lucide-react';
import { buildWhatsappUrl } from '@/lib/open-whatsapp';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  phone: string;
  message: string;
  label?: string;
  className?: string;
  variant?: 'primary' | 'outline';
  onAfterClick?: () => void;
}

export function WhatsappLinkButton({
  phone,
  message,
  label = 'WhatsApp',
  className,
  variant = 'outline',
  onAfterClick,
}: Props) {
  const url = buildWhatsappUrl(phone, message);
  const disabled = url === '#';

  const base =
    'inline-flex items-center justify-center gap-2 h-11 sm:h-9 px-4 rounded-md text-sm font-medium transition-colors';
  const variantClasses =
    variant === 'primary'
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : 'border border-green-600/30 text-green-600 hover:bg-green-600/10';

  if (disabled) {
    return (
      <button
        type="button"
        onClick={() => toast.error('Telefone não cadastrado.')}
        className={cn(
          base,
          'border border-amber-500/30 text-amber-600 hover:bg-amber-500/10',
          className,
        )}
      >
        <MessageCircle className="h-4 w-4" /> {label} (sem tel.)
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        navigator.clipboard.writeText(message).catch(() => {});
        toast.success('✅ Mensagem copiada!');
        onAfterClick?.();
      }}
      className={cn(base, variantClasses, className)}
    >
      <MessageCircle className="h-4 w-4" /> {label}
    </a>
  );
}
