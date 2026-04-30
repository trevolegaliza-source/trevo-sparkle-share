import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Paperclip, Pencil, X, Check, Upload, Eye, Download,
} from 'lucide-react';
import {
  useValoresAdicionais, useAddValorAdicional, useUpdateValorAdicional, useDeleteValorAdicional,
} from '@/hooks/useValoresAdicionais';
import { uploadFile, getSignedUrl } from '@/hooks/useStorageUpload';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { toast } from 'sonner';

interface ValoresAdicionaisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  clienteApelido: string;
}

interface TipoTaxa {
  label: string;
  valorPadrao: number;
}

const TIPOS_TAXA: TipoTaxa[] = [
  { label: 'Taxa Junta Comercial', valorPadrao: 218.99 },
  { label: 'Escritório Regional', valorPadrao: 239 },
  { label: 'Motoboy', valorPadrao: 80 },
  { label: 'MÉTODO TREVO', valorPadrao: 750 },
];

const OUTRO = 'Outros';

const IMG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

function getExt(path: string): string {
  return (path.split('.').pop() || '').toLowerCase();
}

export default function ValoresAdicionaisModal({
  open, onOpenChange, processoId, clienteApelido,
}: ValoresAdicionaisModalProps) {
  const { data: items = [], isLoading } = useValoresAdicionais(processoId);
  const addMut = useAddValorAdicional();
  const updateMut = useUpdateValorAdicional();
  const deleteMut = useDeleteValorAdicional();

  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_TAXA[0].label);
  const [descLivre, setDescLivre] = useState('');
  const [newValor, setNewValor] = useState(String(TIPOS_TAXA[0].valorPadrao));
  const [pagoPeloCliente, setPagoPeloCliente] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editValor, setEditValor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const guiaRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadField, setUploadField] = useState<'anexo_url' | 'comprovante_url'>('anexo_url');

  const subtotal = items.reduce((s, i) => s + Number(i.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const isOutro = tipoSelecionado === OUTRO;
  const isJuntaComercial = tipoSelecionado === 'Taxa Junta Comercial';
  const descricaoFinal = isOutro
    ? descLivre.trim()
    : (isJuntaComercial && pagoPeloCliente
        ? 'Taxa Junta Comercial (pago pelo cliente)'
        : tipoSelecionado);

  const handleTipoChange = (novoTipo: string) => {
    setTipoSelecionado(novoTipo);
    setPagoPeloCliente(false);
    if (novoTipo === OUTRO) {
      setNewValor('0');
    } else {
      const tipo = TIPOS_TAXA.find(t => t.label === novoTipo);
      setNewValor(tipo ? String(tipo.valorPadrao) : '0');
    }
  };

  const handlePagoPeloClienteChange = (checked: boolean) => {
    setPagoPeloCliente(checked);
    if (checked) setNewValor('0');
    else {
      const tipo = TIPOS_TAXA.find(t => t.label === tipoSelecionado);
      setNewValor(tipo ? String(tipo.valorPadrao) : '0');
    }
  };

  const handleAdd = () => {
    const valor = parseFloat(newValor.replace(',', '.')) || 0;
    const isPagoCliente = isJuntaComercial && pagoPeloCliente;
    if (!descricaoFinal || (valor <= 0 && !isPagoCliente)) {
      toast.error('Preencha descrição e valor');
      return;
    }
    addMut.mutate(
      { processo_id: processoId, descricao: descricaoFinal, valor },
      {
        onSuccess: () => {
          toast.success(isPagoCliente
            ? 'Taxa registrada (pago pelo cliente)'
            : 'Taxa adicionada — anexe o comprovante na coluna Comprov.');
          setDescLivre('');
          setPagoPeloCliente(false);
          setTipoSelecionado(TIPOS_TAXA[0].label);
          setNewValor(String(TIPOS_TAXA[0].valorPadrao));
        },
      },
    );
  };

  const handleSaveEdit = (id: string) => {
    const valor = parseFloat(editValor.replace(',', '.')) || 0;
    updateMut.mutate({
      id, processo_id: processoId,
      updates: { descricao: editDesc.trim(), valor },
    });
    setEditId(null);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget({ id });
    setPasswordOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMut.mutate({ id: deleteTarget.id, processo_id: processoId });
      setDeleteTarget(null);
    }
  };

  const startEdit = (item: { id: string; descricao: string; valor: number }) => {
    setEditId(item.id);
    setEditDesc(item.descricao);
    setEditValor(String(item.valor));
  };

  const handleFileUpload = async (itemId: string, file: File, field: 'anexo_url' | 'comprovante_url') => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo maior que 5MB');
      return;
    }
    try {
      setUploading(`${itemId}_${field}`);
      const folder = field === 'anexo_url' ? 'guias' : 'comprovantes_adicionais';
      const path = await uploadFile(file, folder, processoId);
      updateMut.mutate({
        id: itemId, processo_id: processoId,
        updates: { [field]: path },
      });
      toast.success(field === 'anexo_url' ? 'Guia/DARE anexada' : 'Comprovante anexado');
    } catch {
      // handled
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = (itemId: string, field: 'anexo_url' | 'comprovante_url') => {
    updateMut.mutate({
      id: itemId, processo_id: processoId,
      updates: { [field]: null },
    });
    toast.success('Arquivo removido');
  };

  // CRÍTICO: NÃO usar URL.createObjectURL + window.open(blobUrl) aqui.
  // ERP roda dentro do iframe do preview Lovable. Chrome bloqueia
  // blob URLs criadas em iframe quando abertas em nova janela
  // (ERR_BLOCKED_BY_CLIENT). Em janela anônima Lovable não vai pra
  // iframe, por isso parecia bug do navegador.
  // Solução: signed URL direto (URL https real, válida 1h).

  const handleDownload = async (storagePath: string) => {
    try {
      const url = await getSignedUrl(storagePath);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.info('Pop-up bloqueado. Link copiado pra área de transferência — cola e abre manualmente.', { duration: 8000 });
      }
    } catch {
      toast.error('Comprovante não encontrado');
    }
  };

  /** Eye click → imagem fica em preview modal interno; PDF/outros abrem em nova aba */
  const handleView = async (storagePath: string) => {
    if (!storagePath) {
      toast.error('Comprovante não encontrado');
      return;
    }
    const ext = getExt(storagePath);
    try {
      if (IMG_EXTS.includes(ext)) {
        // Pra preview interno (modal), usa signed URL também — sem blob
        const url = await getSignedUrl(storagePath);
        setPreviewImage(url);
        return;
      }
      // PDF e outros: signed URL em nova aba (não blob → não bloqueia)
      const url = await getSignedUrl(storagePath);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.info('Pop-up bloqueado. Link copiado pra área de transferência — cola e abre manualmente.', { duration: 8000 });
      }
    } catch {
      toast.error('Comprovante não encontrado');
    }
  };

  const triggerUpload = (itemId: string, field: 'anexo_url' | 'comprovante_url') => {
    setUploadTargetId(itemId);
    setUploadField(field);
    const ref = field === 'anexo_url' ? guiaRef : comprovanteRef;
    setTimeout(() => ref.current?.click(), 0);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && uploadTargetId) handleFileUpload(uploadTargetId, f, uploadField);
    e.target.value = '';
  };

  const FileActions = ({ storagePath, itemId, field, label }: {
    storagePath: string | null | undefined;
    itemId: string;
    field: 'anexo_url' | 'comprovante_url';
    label: string;
  }) => {
    const isUploading = uploading === `${itemId}_${field}`;
    if (storagePath) {
      return (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleView(storagePath)}
            title={`Visualizar ${label}`}
            className="text-info hover:text-info/80 p-0.5"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleDownload(storagePath)}
            title={`Download ${label}`}
            className="text-primary hover:text-primary/80 p-0.5"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleRemoveFile(itemId, field)}
            title={`Remover ${label}`}
            className="text-destructive hover:text-destructive/80 p-0.5"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => triggerUpload(itemId, field)}
        title={`Anexar ${label}`}
        disabled={isUploading}
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
      >
        {isUploading ? (
          <Upload className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Valores Adicionais</DialogTitle>
            <DialogDescription>
              Gerencie honorários extras, taxas e reembolsos para{' '}
              <span className="font-semibold text-foreground">{clienteApelido}</span>
            </DialogDescription>
          </DialogHeader>

          {/* FIX 7 — Add new with dropdown */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2 items-end">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Tipo de taxa</label>
                <Select value={tipoSelecionado} onValueChange={handleTipoChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_TAXA.map((t) => (
                      <SelectItem key={t.label} value={t.label} className="text-xs">{t.label}</SelectItem>
                    ))}
                    <SelectItem value={OUTRO} className="text-xs italic">{OUTRO}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Valor R$</label>
                <Input
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  placeholder="0,00"
                  className="h-8 text-xs"
                  disabled={isJuntaComercial && pagoPeloCliente}
                />
              </div>
            </div>

            {isJuntaComercial && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pagoPeloCliente}
                  onChange={(e) => handlePagoPeloClienteChange(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                Pago pelo cliente (valor R$ 0,00)
              </label>
            )}

            {isOutro && (
              <Input
                value={descLivre}
                onChange={(e) => setDescLivre(e.target.value)}
                placeholder="Descreva o reembolso..."
                className="h-8 text-xs"
                autoFocus
              />
            )}

            <Button
              size="sm"
              className="h-8 px-3 w-full sm:w-auto"
              onClick={handleAdd}
              disabled={addMut.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <Separator />

          {/* Hidden file inputs */}
          <input ref={guiaRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFileChange} />
          <input ref={comprovanteRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={onFileChange} />

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_70px_70px_60px_30px] gap-1 px-3 text-[10px] font-semibold text-muted-foreground uppercase">
            <span>Descrição</span>
            <span className="text-right">Valor</span>
            <span className="text-center">Guia</span>
            <span className="text-center">Comprov.</span>
            <span className="text-center">Editar</span>
            <span></span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[100px]">
            {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
            {!isLoading && items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhum valor adicional cadastrado
              </p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_70px_70px_60px_30px] gap-1 items-center rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                {editId === item.id ? (
                  <>
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-7 text-xs" />
                    <Input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="h-7 text-xs" />
                    <div />
                    <div />
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => handleSaveEdit(item.id)} className="text-success hover:text-success/80">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div />
                  </>
                ) : (
                  <>
                    <span className="text-xs truncate">{item.descricao}</span>
                    <span className="text-xs font-semibold text-primary text-right whitespace-nowrap">
                      {fmt(Number(item.valor))}
                    </span>
                    <div className="flex justify-center">
                      <FileActions storagePath={item.anexo_url} itemId={item.id} field="anexo_url" label="Guia/DARE" />
                    </div>
                    <div className="flex justify-center">
                      <FileActions storagePath={item.comprovante_url} itemId={item.id} field="comprovante_url" label="Comprovante" />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleDeleteRequest(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <Separator />

          {/* Subtotal */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm font-semibold">Subtotal de Adicionais</span>
            <span className="text-sm font-bold text-primary">{fmt(subtotal)}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* FIX 8 — Image preview modal */}
      <Dialog
        open={!!previewImage}
        onOpenChange={(o) => {
          if (!o && previewImage) {
            URL.revokeObjectURL(previewImage);
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="flex items-center justify-center bg-muted/30 rounded-md p-2 max-h-[70vh] overflow-auto">
              <img src={previewImage} alt="Comprovante" className="max-w-full h-auto rounded" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Valor Adicional"
        description="Confirme a senha de administração para excluir este item."
      />
    </>
  );
}
