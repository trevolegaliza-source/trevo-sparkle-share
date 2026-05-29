import { FileText, Eye, ExternalLink, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ContractDropzone from '@/components/contratos/ContractDropzone';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { empresaPath } from '@/lib/storage-path';
import type { ClienteDB } from '@/types/financial';

interface TabContratosProps {
  cliente: ClienteDB;
  contracts: { name: string }[];
  uploadingContract: boolean;
  permIsMaster: boolean;
  onPreview: (signedUrl: string, fileName: string) => void;
  onViewContract: (fileName: string) => void;
  onDownload: (fileName: string) => void;
  onDelete: (fileName: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export default function TabContratos({
  cliente,
  contracts,
  uploadingContract,
  permIsMaster,
  onPreview,
  onViewContract,
  onDownload,
  onDelete,
  onUpload,
}: TabContratosProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Contratos Anexados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contracts.length > 0 ? (
          <div className="space-y-2">
            {contracts.map(c => {
              const handlePreview = async () => {
                const path = await empresaPath(`${cliente.id}/${c.name}`);
                const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).createSignedUrl(path, 3600);
                if (data?.signedUrl) onPreview(data.signedUrl, c.name);
              };
              return (
                <div key={c.name} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handlePreview}>
                    <Eye className="h-3 w-3" /> Visualizar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onViewContract(c.name)}>
                    <ExternalLink className="h-3 w-3" /> Nova aba
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onDownload(c.name)}>
                    <Download className="h-3 w-3" /> Baixar
                  </Button>
                  {/* Agent 4 BUG-001 (17/05/2026 noite): só master deleta contrato.
                      RLS no bucket Storage também precisa estar master-only — front
                      esconde botão pra operacional/gerente. */}
                  {permIsMaster && (
                    <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => onDelete(c.name)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-6 text-muted-foreground text-sm">Nenhum contrato anexado</p>
        )}
        {/* Agent 4 BUG-002 (17/05/2026 noite): upload de contrato só pra master */}
        {permIsMaster && (
          <ContractDropzone uploading={uploadingContract} onUpload={onUpload} />
        )}
      </CardContent>
    </Card>
  );
}
