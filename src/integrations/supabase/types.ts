export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      acessos_publicos_log: {
        Row: {
          acessado_em: string
          id: number
          tipo: string
          token_hash: string
        }
        Insert: {
          acessado_em?: string
          id?: number
          tipo: string
          token_hash: string
        }
        Update: {
          acessado_em?: string
          id?: number
          tipo?: string
          token_hash?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          asaas_payment_id: string | null
          cobranca_id: string | null
          error: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          received_at: string | null
        }
        Insert: {
          asaas_payment_id?: string | null
          cobranca_id?: string | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
        }
        Update: {
          asaas_payment_id?: string | null
          cobranca_id?: string | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_events_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_extratos_20260420: {
        Row: {
          cliente_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          created_at: string | null
          created_by: string | null
          data_envio: string | null
          empresa_id: string | null
          enviado: boolean | null
          filename: string | null
          id: string | null
          observacoes: string | null
          pdf_url: string | null
          processo_ids: string[] | null
          qtd_processos: number | null
          status: string | null
          total_geral: number | null
          total_honorarios: number | null
          total_taxas: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string | null
          created_by?: string | null
          data_envio?: string | null
          empresa_id?: string | null
          enviado?: boolean | null
          filename?: string | null
          id?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          processo_ids?: string[] | null
          qtd_processos?: number | null
          status?: string | null
          total_geral?: number | null
          total_honorarios?: number | null
          total_taxas?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string | null
          created_by?: string | null
          data_envio?: string | null
          empresa_id?: string | null
          enviado?: boolean | null
          filename?: string | null
          id?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          processo_ids?: string[] | null
          qtd_processos?: number | null
          status?: string | null
          total_geral?: number | null
          total_honorarios?: number | null
          total_taxas?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_lancamentos_20260420: {
        Row: {
          auditado: boolean | null
          auditado_em: string | null
          auditado_por: string | null
          boleto_url: string | null
          categoria: string | null
          centro_custo: string | null
          cliente_id: string | null
          cobranca_encaminhada: boolean | null
          colaborador_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          comprovante_url: string | null
          confirmado_recebimento: boolean | null
          conta_id: string | null
          contestacao_anexo_url: string | null
          contestacao_data: string | null
          contestacao_motivo: string | null
          created_at: string | null
          data_pagamento: string | null
          data_retorno_cobranca: string | null
          data_ultimo_contato: string | null
          data_vencimento: string | null
          descricao: string | null
          despesa_recorrente_id: string | null
          empresa_id: string | null
          etapa_financeiro: string | null
          extrato_id: string | null
          fornecedor: string | null
          honorario_extra: number | null
          id: string | null
          is_taxa_reembolsavel: boolean | null
          notas_cobranca: string | null
          observacoes_financeiro: string | null
          processo_id: string | null
          recibo_assinado_url: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          subcategoria: string | null
          tentativas_cobranca: number | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"] | null
          updated_at: string | null
          url_comprovante: string | null
          url_recibo_taxa: string | null
          valor: number | null
          valor_alterado_em: string | null
          valor_alterado_por: string | null
          valor_original: number | null
        }
        Insert: {
          auditado?: boolean | null
          auditado_em?: string | null
          auditado_por?: string | null
          boleto_url?: string | null
          categoria?: string | null
          centro_custo?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          conta_id?: string | null
          contestacao_anexo_url?: string | null
          contestacao_data?: string | null
          contestacao_motivo?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_retorno_cobranca?: string | null
          data_ultimo_contato?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          despesa_recorrente_id?: string | null
          empresa_id?: string | null
          etapa_financeiro?: string | null
          extrato_id?: string | null
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string | null
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          subcategoria?: string | null
          tentativas_cobranca?: number | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"] | null
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor?: number | null
          valor_alterado_em?: string | null
          valor_alterado_por?: string | null
          valor_original?: number | null
        }
        Update: {
          auditado?: boolean | null
          auditado_em?: string | null
          auditado_por?: string | null
          boleto_url?: string | null
          categoria?: string | null
          centro_custo?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          conta_id?: string | null
          contestacao_anexo_url?: string | null
          contestacao_data?: string | null
          contestacao_motivo?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_retorno_cobranca?: string | null
          data_ultimo_contato?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          despesa_recorrente_id?: string | null
          empresa_id?: string | null
          etapa_financeiro?: string | null
          extrato_id?: string | null
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string | null
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          subcategoria?: string | null
          tentativas_cobranca?: number | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"] | null
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor?: number | null
          valor_alterado_em?: string | null
          valor_alterado_por?: string | null
          valor_original?: number | null
        }
        Relationships: []
      }
      backup_valores_adicionais_20260420: {
        Row: {
          anexo_url: string | null
          comprovante_url: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string | null
          processo_id: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          anexo_url?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string | null
          processo_id?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          anexo_url?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string | null
          processo_id?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      catalogo_precos_uf: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          honorario_trevo: number
          id: string
          observacoes: string | null
          prazo_estimado: string | null
          servico_id: string
          taxa_orgao: number
          uf: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          honorario_trevo?: number
          id?: string
          observacoes?: string | null
          prazo_estimado?: string | null
          servico_id: string
          taxa_orgao?: number
          uf: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          honorario_trevo?: number
          id?: string
          observacoes?: string | null
          prazo_estimado?: string | null
          servico_id?: string
          taxa_orgao?: number
          uf?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_precos_uf_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "catalogo_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_servicos: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          prazo_estimado: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          prazo_estimado?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          prazo_estimado?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          apelido: string | null
          asaas_customer_id: string | null
          auditado_em: string | null
          auditado_financeiro: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_identificador: string
          complemento: string | null
          contrato_url: string | null
          created_at: string | null
          data_ultima_recarga: string | null
          desconto_boas_vindas_aplicado: boolean | null
          desconto_progressivo: number | null
          dia_cobranca: number | null
          dia_vencimento_mensal: number | null
          email: string | null
          empresa_id: string | null
          estado: string | null
          franquia_processos: number | null
          id: string
          is_archived: boolean | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          mensalidade: number | null
          momento_faturamento: string | null
          nome: string
          nome_contador: string | null
          nome_contato_financeiro: string | null
          numero: string | null
          observacoes: string | null
          qtd_processos: number | null
          saldo_prepago: number | null
          saldo_ultima_recarga: number | null
          telefone: string | null
          telefone_financeiro: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto: string | null
          trello_board_id: string | null
          trello_board_url: string | null
          trello_provisionado_em: string | null
          updated_at: string | null
          valor_base: number | null
          valor_limite_desconto: number | null
          vencimento: number | null
        }
        Insert: {
          apelido?: string | null
          asaas_customer_id?: string | null
          auditado_em?: string | null
          auditado_financeiro?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_identificador: string
          complemento?: string | null
          contrato_url?: string | null
          created_at?: string | null
          data_ultima_recarga?: string | null
          desconto_boas_vindas_aplicado?: boolean | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          franquia_processos?: number | null
          id?: string
          is_archived?: boolean | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome: string
          nome_contador?: string | null
          nome_contato_financeiro?: string | null
          numero?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          saldo_prepago?: number | null
          saldo_ultima_recarga?: number | null
          telefone?: string | null
          telefone_financeiro?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto?: string | null
          trello_board_id?: string | null
          trello_board_url?: string | null
          trello_provisionado_em?: string | null
          updated_at?: string | null
          valor_base?: number | null
          valor_limite_desconto?: number | null
          vencimento?: number | null
        }
        Update: {
          apelido?: string | null
          asaas_customer_id?: string | null
          auditado_em?: string | null
          auditado_financeiro?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_identificador?: string
          complemento?: string | null
          contrato_url?: string | null
          created_at?: string | null
          data_ultima_recarga?: string | null
          desconto_boas_vindas_aplicado?: boolean | null
          desconto_progressivo?: number | null
          dia_cobranca?: number | null
          dia_vencimento_mensal?: number | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          franquia_processos?: number | null
          id?: string
          is_archived?: boolean | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          mensalidade?: number | null
          momento_faturamento?: string | null
          nome?: string
          nome_contador?: string | null
          nome_contato_financeiro?: string | null
          numero?: string | null
          observacoes?: string | null
          qtd_processos?: number | null
          saldo_prepago?: number | null
          saldo_ultima_recarga?: number | null
          telefone?: string | null
          telefone_financeiro?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          tipo_desconto?: string | null
          trello_board_id?: string | null
          trello_board_url?: string | null
          trello_provisionado_em?: string | null
          updated_at?: string | null
          valor_base?: number | null
          valor_limite_desconto?: number | null
          vencimento?: number | null
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          asaas_boleto_barcode: string | null
          asaas_boleto_url: string | null
          asaas_gerado_em: string | null
          asaas_gerando_lock_ate: string | null
          asaas_invoice_url: string | null
          asaas_last_event: Json | null
          asaas_pago_em: string | null
          asaas_payment_id: string | null
          asaas_pix_payload: string | null
          asaas_pix_qrcode: string | null
          asaas_status: string | null
          asaas_webhook_recebido_em: string | null
          cliente_id: string
          created_at: string | null
          created_by: string | null
          data_expiracao: string | null
          data_vencimento: string | null
          empresa_id: string
          extrato_id: string | null
          id: string
          is_archived: boolean | null
          lancamento_ids: string[]
          pago_em: string | null
          share_token: string
          status: string
          total_geral: number
          total_honorarios: number
          total_taxas: number
          updated_at: string | null
          visualizada_em: string | null
          whatsapp_enviado_em: string | null
        }
        Insert: {
          asaas_boleto_barcode?: string | null
          asaas_boleto_url?: string | null
          asaas_gerado_em?: string | null
          asaas_gerando_lock_ate?: string | null
          asaas_invoice_url?: string | null
          asaas_last_event?: Json | null
          asaas_pago_em?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          asaas_pix_qrcode?: string | null
          asaas_status?: string | null
          asaas_webhook_recebido_em?: string | null
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          data_expiracao?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          extrato_id?: string | null
          id?: string
          is_archived?: boolean | null
          lancamento_ids: string[]
          pago_em?: string | null
          share_token?: string
          status?: string
          total_geral: number
          total_honorarios?: number
          total_taxas?: number
          updated_at?: string | null
          visualizada_em?: string | null
          whatsapp_enviado_em?: string | null
        }
        Update: {
          asaas_boleto_barcode?: string | null
          asaas_boleto_url?: string | null
          asaas_gerado_em?: string | null
          asaas_gerando_lock_ate?: string | null
          asaas_invoice_url?: string | null
          asaas_last_event?: Json | null
          asaas_pago_em?: string | null
          asaas_payment_id?: string | null
          asaas_pix_payload?: string | null
          asaas_pix_qrcode?: string | null
          asaas_status?: string | null
          asaas_webhook_recebido_em?: string | null
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          data_expiracao?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          extrato_id?: string | null
          id?: string
          is_archived?: boolean | null
          lancamento_ids?: string[]
          pago_em?: string | null
          share_token?: string
          status?: string
          total_geral?: number
          total_honorarios?: number
          total_taxas?: number
          updated_at?: string | null
          visualizada_em?: string | null
          whatsapp_enviado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_lancamentos: {
        Row: {
          cobranca_id: string
          created_at: string
          empresa_id: string
          lancamento_id: string
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          empresa_id: string
          lancamento_id: string
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          empresa_id?: string
          lancamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_lancamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_lancamentos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_avaliacoes: {
        Row: {
          ano: number
          colaborador_id: string
          conclusao_trimestral: string | null
          created_at: string | null
          empresa_id: string | null
          feedback: string | null
          id: string
          mes: number
          updated_at: string | null
        }
        Insert: {
          ano: number
          colaborador_id: string
          conclusao_trimestral?: string | null
          created_at?: string | null
          empresa_id?: string | null
          feedback?: string | null
          id?: string
          mes: number
          updated_at?: string | null
        }
        Update: {
          ano?: number
          colaborador_id?: string
          conclusao_trimestral?: string | null
          created_at?: string | null
          empresa_id?: string | null
          feedback?: string | null
          id?: string
          mes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_avaliacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          adiantamento_tipo: string
          adiantamento_valor: number
          aniversario: string | null
          aumento_previsto_data: string | null
          aumento_previsto_valor: number | null
          auxilio_combustivel_valor: number
          created_at: string | null
          data_inicio: string | null
          dia_adiantamento: number | null
          dia_das: number | null
          dia_pagamento_integral: number | null
          dia_salario: number | null
          dia_vt_vr: number | null
          email: string | null
          empresa_id: string | null
          fgts_percentual: number | null
          id: string
          inss_patronal_percentual: number | null
          nome: string
          observacoes_pagamento: string | null
          pix_chave: string | null
          pix_tipo: string | null
          possui_adiantamento: boolean
          provisionar_13: boolean | null
          provisionar_ferias: boolean | null
          regime: string
          salario_base: number
          status: string
          tipo_dia_salario: string | null
          tipo_transporte: string
          trello_username: string | null
          updated_at: string | null
          valor_das: number
          vr_diario: number
          vt_diario: number
        }
        Insert: {
          adiantamento_tipo?: string
          adiantamento_valor?: number
          aniversario?: string | null
          aumento_previsto_data?: string | null
          aumento_previsto_valor?: number | null
          auxilio_combustivel_valor?: number
          created_at?: string | null
          data_inicio?: string | null
          dia_adiantamento?: number | null
          dia_das?: number | null
          dia_pagamento_integral?: number | null
          dia_salario?: number | null
          dia_vt_vr?: number | null
          email?: string | null
          empresa_id?: string | null
          fgts_percentual?: number | null
          id?: string
          inss_patronal_percentual?: number | null
          nome: string
          observacoes_pagamento?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          possui_adiantamento?: boolean
          provisionar_13?: boolean | null
          provisionar_ferias?: boolean | null
          regime?: string
          salario_base?: number
          status?: string
          tipo_dia_salario?: string | null
          tipo_transporte?: string
          trello_username?: string | null
          updated_at?: string | null
          valor_das?: number
          vr_diario?: number
          vt_diario?: number
        }
        Update: {
          adiantamento_tipo?: string
          adiantamento_valor?: number
          aniversario?: string | null
          aumento_previsto_data?: string | null
          aumento_previsto_valor?: number | null
          auxilio_combustivel_valor?: number
          created_at?: string | null
          data_inicio?: string | null
          dia_adiantamento?: number | null
          dia_das?: number | null
          dia_pagamento_integral?: number | null
          dia_salario?: number | null
          dia_vt_vr?: number | null
          email?: string | null
          empresa_id?: string | null
          fgts_percentual?: number | null
          id?: string
          inss_patronal_percentual?: number | null
          nome?: string
          observacoes_pagamento?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          possui_adiantamento?: boolean
          provisionar_13?: boolean | null
          provisionar_ferias?: boolean | null
          regime?: string
          salario_base?: number
          status?: string
          tipo_dia_salario?: string | null
          tipo_transporte?: string
          trello_username?: string | null
          updated_at?: string | null
          valor_das?: number
          vr_diario?: number
          vt_diario?: number
        }
        Relationships: []
      }
      contatos_estado: {
        Row: {
          contato_interno: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          municipio: string | null
          nome: string
          observacoes: string | null
          pin_cor: string | null
          rating: number | null
          site_url: string | null
          telefone: string | null
          tipo: string
          uf: string
          updated_at: string | null
        }
        Insert: {
          contato_interno?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          municipio?: string | null
          nome: string
          observacoes?: string | null
          pin_cor?: string | null
          rating?: number | null
          site_url?: string | null
          telefone?: string | null
          tipo: string
          uf: string
          updated_at?: string | null
        }
        Update: {
          contato_interno?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          municipio?: string | null
          nome?: string
          observacoes?: string | null
          pin_cor?: string | null
          rating?: number | null
          site_url?: string | null
          telefone?: string | null
          tipo?: string
          uf?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          cidade_contrato: string | null
          contratada_cnpj: string | null
          contratada_endereco: string | null
          contratada_nome: string | null
          contratada_representante: string | null
          contratada_representante_cpf: string | null
          contratada_representante_qualificacao: string | null
          contratante_cnpj_cpf: string
          contratante_endereco: string
          contratante_nome: string
          contratante_representante: string
          contratante_representante_cpf: string
          contratante_representante_qualificacao: string | null
          contratante_tipo: string | null
          created_at: string | null
          data_contrato: string | null
          empresa_id: string | null
          id: string
          numero_contrato: string
          orcamento_id: string | null
          pdf_url: string | null
          updated_at: string | null
        }
        Insert: {
          cidade_contrato?: string | null
          contratada_cnpj?: string | null
          contratada_endereco?: string | null
          contratada_nome?: string | null
          contratada_representante?: string | null
          contratada_representante_cpf?: string | null
          contratada_representante_qualificacao?: string | null
          contratante_cnpj_cpf: string
          contratante_endereco: string
          contratante_nome: string
          contratante_representante: string
          contratante_representante_cpf: string
          contratante_representante_qualificacao?: string | null
          contratante_tipo?: string | null
          created_at?: string | null
          data_contrato?: string | null
          empresa_id?: string | null
          id?: string
          numero_contrato: string
          orcamento_id?: string | null
          pdf_url?: string | null
          updated_at?: string | null
        }
        Update: {
          cidade_contrato?: string | null
          contratada_cnpj?: string | null
          contratada_endereco?: string | null
          contratada_nome?: string | null
          contratada_representante?: string | null
          contratada_representante_cpf?: string | null
          contratada_representante_qualificacao?: string | null
          contratante_cnpj_cpf?: string
          contratante_endereco?: string
          contratante_nome?: string
          contratante_representante?: string
          contratante_representante_cpf?: string
          contratante_representante_qualificacao?: string | null
          contratante_tipo?: string | null
          created_at?: string | null
          data_contrato?: string | null
          empresa_id?: string | null
          id?: string
          numero_contrato?: string
          orcamento_id?: string | null
          pdf_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_recorrentes: {
        Row: {
          ativo: boolean
          categoria: string
          colaborador_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number
          empresa_id: string | null
          fornecedor: string | null
          id: string
          observacoes: string | null
          subcategoria: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          colaborador_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao: string
          dia_vencimento?: number
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          colaborador_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_recorrentes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          observacao: string | null
          processo_id: string
          status: string
          tipo_documento: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          processo_id: string
          status?: string
          tipo_documento: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          processo_id?: string
          status?: string
          tipo_documento?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_config: {
        Row: {
          cnpj: string | null
          created_at: string
          empresa_id: string
          nome_fantasia: string | null
          pix_banco: string | null
          pix_chave: string | null
          razao_social: string | null
          site: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          empresa_id: string
          nome_fantasia?: string | null
          pix_banco?: string | null
          pix_chave?: string | null
          razao_social?: string | null
          site?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          empresa_id?: string
          nome_fantasia?: string | null
          pix_banco?: string | null
          pix_chave?: string | null
          razao_social?: string | null
          site?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      extratos: {
        Row: {
          cliente_id: string
          competencia_ano: number
          competencia_mes: number
          created_at: string | null
          created_by: string | null
          data_envio: string | null
          empresa_id: string | null
          enviado: boolean
          filename: string
          id: string
          observacoes: string | null
          pdf_url: string
          processo_ids: string[]
          qtd_processos: number
          status: string
          total_geral: number
          total_honorarios: number
          total_taxas: number
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          competencia_ano: number
          competencia_mes: number
          created_at?: string | null
          created_by?: string | null
          data_envio?: string | null
          empresa_id?: string | null
          enviado?: boolean
          filename: string
          id?: string
          observacoes?: string | null
          pdf_url: string
          processo_ids?: string[]
          qtd_processos?: number
          status?: string
          total_geral?: number
          total_honorarios?: number
          total_taxas?: number
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          competencia_ano?: number
          competencia_mes?: number
          created_at?: string | null
          created_by?: string | null
          data_envio?: string | null
          empresa_id?: string | null
          enviado?: boolean
          filename?: string
          id?: string
          observacoes?: string | null
          pdf_url?: string
          processo_ids?: string[]
          qtd_processos?: number
          status?: string
          total_geral?: number
          total_honorarios?: number
          total_taxas?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_auditoria: {
        Row: {
          ator_id: string | null
          ator_role: string | null
          ator_tipo: string
          campo: string
          criado_em: string
          empresa_id: string | null
          entidade: string
          entidade_id: string
          id: number
          motivo: string | null
          valor_antigo: Json | null
          valor_novo: Json | null
        }
        Insert: {
          ator_id?: string | null
          ator_role?: string | null
          ator_tipo: string
          campo: string
          criado_em?: string
          empresa_id?: string | null
          entidade: string
          entidade_id: string
          id?: number
          motivo?: string | null
          valor_antigo?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          ator_id?: string | null
          ator_role?: string | null
          ator_tipo?: string
          campo?: string
          criado_em?: string
          empresa_id?: string | null
          entidade?: string
          entidade_id?: string
          id?: number
          motivo?: string | null
          valor_antigo?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          auditado: boolean | null
          auditado_em: string | null
          auditado_por: string | null
          boleto_url: string | null
          categoria: string | null
          centro_custo: string | null
          cliente_id: string | null
          cobranca_encaminhada: boolean | null
          colaborador_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          comprovante_url: string | null
          confirmado_recebimento: boolean | null
          conta_id: string | null
          contestacao_anexo_url: string | null
          contestacao_data: string | null
          contestacao_motivo: string | null
          created_at: string | null
          data_pagamento: string | null
          data_retorno_cobranca: string | null
          data_ultimo_contato: string | null
          data_vencimento: string
          descricao: string
          despesa_recorrente_id: string | null
          empresa_id: string | null
          etapa_financeiro: string
          extrato_id: string | null
          fornecedor: string | null
          honorario_extra: number | null
          id: string
          is_taxa_reembolsavel: boolean | null
          notas_cobranca: string | null
          observacoes_financeiro: string | null
          processo_id: string | null
          recibo_assinado_url: string | null
          status: Database["public"]["Enums"]["status_financeiro"]
          subcategoria: string | null
          tentativas_cobranca: number | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string | null
          url_comprovante: string | null
          url_recibo_taxa: string | null
          valor: number
          valor_alterado_em: string | null
          valor_alterado_por: string | null
          valor_original: number | null
        }
        Insert: {
          auditado?: boolean | null
          auditado_em?: string | null
          auditado_por?: string | null
          boleto_url?: string | null
          categoria?: string | null
          centro_custo?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          conta_id?: string | null
          contestacao_anexo_url?: string | null
          contestacao_data?: string | null
          contestacao_motivo?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_retorno_cobranca?: string | null
          data_ultimo_contato?: string | null
          data_vencimento: string
          descricao: string
          despesa_recorrente_id?: string | null
          empresa_id?: string | null
          etapa_financeiro?: string
          extrato_id?: string | null
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          subcategoria?: string | null
          tentativas_cobranca?: number | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor: number
          valor_alterado_em?: string | null
          valor_alterado_por?: string | null
          valor_original?: number | null
        }
        Update: {
          auditado?: boolean | null
          auditado_em?: string | null
          auditado_por?: string | null
          boleto_url?: string | null
          categoria?: string | null
          centro_custo?: string | null
          cliente_id?: string | null
          cobranca_encaminhada?: boolean | null
          colaborador_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          comprovante_url?: string | null
          confirmado_recebimento?: boolean | null
          conta_id?: string | null
          contestacao_anexo_url?: string | null
          contestacao_data?: string | null
          contestacao_motivo?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_retorno_cobranca?: string | null
          data_ultimo_contato?: string | null
          data_vencimento?: string
          descricao?: string
          despesa_recorrente_id?: string | null
          empresa_id?: string | null
          etapa_financeiro?: string
          extrato_id?: string | null
          fornecedor?: string | null
          honorario_extra?: number | null
          id?: string
          is_taxa_reembolsavel?: boolean | null
          notas_cobranca?: string | null
          observacoes_financeiro?: string | null
          processo_id?: string | null
          recibo_assinado_url?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"]
          subcategoria?: string | null
          tentativas_cobranca?: number | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string | null
          url_comprovante?: string | null
          url_recibo_taxa?: string | null
          valor?: number
          valor_alterado_em?: string | null
          valor_alterado_por?: string | null
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_auditado_por_fkey"
            columns: ["auditado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_despesa_recorrente_id_fkey"
            columns: ["despesa_recorrente_id"]
            isOneToOne: false
            referencedRelation: "despesas_recorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_valor_alterado_por_fkey"
            columns: ["valor_alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_password_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      master_password_config: {
        Row: {
          id: number
          password_hash: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: number
          password_hash?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: number
          password_hash?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      notas_estado: {
        Row: {
          conteudo: string | null
          id: string
          uf: string
          updated_at: string | null
        }
        Insert: {
          conteudo?: string | null
          id?: string
          uf: string
          updated_at?: string | null
        }
        Update: {
          conteudo?: string | null
          id?: string
          uf?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          lida: boolean | null
          mensagem: string
          orcamento_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          orcamento_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          orcamento_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_pdfs: {
        Row: {
          cancelado_em: string | null
          created_at: string | null
          empresa_id: string | null
          filename: string
          gerado_em: string
          id: string
          modo: string
          orcamento_id: string
          status: string
          storage_path: string
          url: string
          versao: number
        }
        Insert: {
          cancelado_em?: string | null
          created_at?: string | null
          empresa_id?: string | null
          filename: string
          gerado_em?: string
          id?: string
          modo: string
          orcamento_id: string
          status?: string
          storage_path: string
          url: string
          versao?: number
        }
        Update: {
          cancelado_em?: string | null
          created_at?: string | null
          empresa_id?: string | null
          filename?: string
          gerado_em?: string
          id?: string
          modo?: string
          orcamento_id?: string
          status?: string
          storage_path?: string
          url?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_pdfs_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          aprovado_em: string | null
          beneficios_capa: Json | null
          cenario_selecionado: string | null
          cenarios: Json | null
          clicksign_document_key: string | null
          cliente_id: string | null
          contexto: string | null
          contrato_assinado_url: string | null
          convertido_em: string | null
          created_at: string | null
          created_by: string | null
          data_expiracao: string | null
          desconto_pct: number | null
          desconto_progressivo_ativo: boolean | null
          desconto_progressivo_limite: number | null
          desconto_progressivo_pct: number | null
          destinatario: string | null
          empresa_id: string | null
          enviado_em: string | null
          escopo: Json
          etapas_fluxo: Json | null
          headline_cenario: string | null
          id: string
          is_archived: boolean | null
          itens_selecionados: Json | null
          naturezas: Json
          numero: number
          observacoes: string | null
          observacoes_recusa: string | null
          ordem_execucao: string | null
          pacotes: Json | null
          pagamento: string | null
          pago_em: string | null
          pdf_url: string | null
          prazo_execucao: string | null
          prazo_pagamento_dias: number | null
          prospect_cnpj: string | null
          prospect_contato: string | null
          prospect_email: string | null
          prospect_nome: string
          prospect_telefone: string | null
          qtd_processos: number | null
          recusado_em: string | null
          riscos: Json | null
          secoes: Json | null
          senha_link: string | null
          servicos: Json
          share_token: string | null
          sla: string | null
          status: string | null
          tipo_contrato: string
          updated_at: string | null
          validade_dias: number | null
          valor_base: number
          valor_final: number
        }
        Insert: {
          aprovado_em?: string | null
          beneficios_capa?: Json | null
          cenario_selecionado?: string | null
          cenarios?: Json | null
          clicksign_document_key?: string | null
          cliente_id?: string | null
          contexto?: string | null
          contrato_assinado_url?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          data_expiracao?: string | null
          desconto_pct?: number | null
          desconto_progressivo_ativo?: boolean | null
          desconto_progressivo_limite?: number | null
          desconto_progressivo_pct?: number | null
          destinatario?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          escopo?: Json
          etapas_fluxo?: Json | null
          headline_cenario?: string | null
          id?: string
          is_archived?: boolean | null
          itens_selecionados?: Json | null
          naturezas?: Json
          numero?: number
          observacoes?: string | null
          observacoes_recusa?: string | null
          ordem_execucao?: string | null
          pacotes?: Json | null
          pagamento?: string | null
          pago_em?: string | null
          pdf_url?: string | null
          prazo_execucao?: string | null
          prazo_pagamento_dias?: number | null
          prospect_cnpj?: string | null
          prospect_contato?: string | null
          prospect_email?: string | null
          prospect_nome: string
          prospect_telefone?: string | null
          qtd_processos?: number | null
          recusado_em?: string | null
          riscos?: Json | null
          secoes?: Json | null
          senha_link?: string | null
          servicos?: Json
          share_token?: string | null
          sla?: string | null
          status?: string | null
          tipo_contrato?: string
          updated_at?: string | null
          validade_dias?: number | null
          valor_base?: number
          valor_final?: number
        }
        Update: {
          aprovado_em?: string | null
          beneficios_capa?: Json | null
          cenario_selecionado?: string | null
          cenarios?: Json | null
          clicksign_document_key?: string | null
          cliente_id?: string | null
          contexto?: string | null
          contrato_assinado_url?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          data_expiracao?: string | null
          desconto_pct?: number | null
          desconto_progressivo_ativo?: boolean | null
          desconto_progressivo_limite?: number | null
          desconto_progressivo_pct?: number | null
          destinatario?: string | null
          empresa_id?: string | null
          enviado_em?: string | null
          escopo?: Json
          etapas_fluxo?: Json | null
          headline_cenario?: string | null
          id?: string
          is_archived?: boolean | null
          itens_selecionados?: Json | null
          naturezas?: Json
          numero?: number
          observacoes?: string | null
          observacoes_recusa?: string | null
          ordem_execucao?: string | null
          pacotes?: Json | null
          pagamento?: string | null
          pago_em?: string | null
          pdf_url?: string | null
          prazo_execucao?: string | null
          prazo_pagamento_dias?: number | null
          prospect_cnpj?: string | null
          prospect_contato?: string | null
          prospect_email?: string | null
          prospect_nome?: string
          prospect_telefone?: string | null
          qtd_processos?: number | null
          recusado_em?: string | null
          riscos?: Json | null
          secoes?: Json | null
          senha_link?: string | null
          servicos?: Json
          share_token?: string | null
          sla?: string | null
          status?: string | null
          tipo_contrato?: string
          updated_at?: string | null
          validade_dias?: number | null
          valor_base?: number
          valor_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean
          centro_custo: string | null
          codigo: string
          created_at: string | null
          empresa_id: string | null
          grupo: string
          id: string
          nome: string
          parent_id: string | null
          subgrupo: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          centro_custo?: string | null
          codigo: string
          created_at?: string | null
          empresa_id?: string | null
          grupo: string
          id?: string
          nome: string
          parent_id?: string | null
          subgrupo?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean
          centro_custo?: string | null
          codigo?: string
          created_at?: string | null
          empresa_id?: string | null
          grupo?: string
          id?: string
          nome?: string
          parent_id?: string | null
          subgrupo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_tiers: {
        Row: {
          descricao: string | null
          id: string
          tier: number
          tipo_processo: Database["public"]["Enums"]["tipo_processo"]
          valor: number
        }
        Insert: {
          descricao?: string | null
          id?: string
          tier?: number
          tipo_processo: Database["public"]["Enums"]["tipo_processo"]
          valor: number
        }
        Update: {
          descricao?: string | null
          id?: string
          tier?: number
          tipo_processo?: Database["public"]["Enums"]["tipo_processo"]
          valor?: number
        }
        Relationships: []
      }
      prepago_movimentacoes: {
        Row: {
          cliente_id: string
          created_at: string | null
          descricao: string
          empresa_id: string | null
          id: string
          processo_id: string | null
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descricao: string
          empresa_id?: string | null
          id?: string
          processo_id?: string | null
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          processo_id?: string | null
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prepago_movimentacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepago_movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          auditado_em: string | null
          auditado_financeiro: boolean | null
          cliente_id: string
          created_at: string | null
          data_deferimento: string | null
          dentro_do_plano: boolean | null
          empresa_id: string | null
          etapa: string
          etiquetas: string[] | null
          id: string
          is_archived: boolean | null
          justificativa_avulso: string | null
          link_drive: string | null
          notas: string | null
          prioridade: string
          razao_social: string
          responsavel: string | null
          tipo: Database["public"]["Enums"]["tipo_processo"]
          updated_at: string | null
          valor: number | null
          valor_avulso: number | null
          via_analise: Database["public"]["Enums"]["via_analise"]
        }
        Insert: {
          auditado_em?: string | null
          auditado_financeiro?: boolean | null
          cliente_id: string
          created_at?: string | null
          data_deferimento?: string | null
          dentro_do_plano?: boolean | null
          empresa_id?: string | null
          etapa?: string
          etiquetas?: string[] | null
          id?: string
          is_archived?: boolean | null
          justificativa_avulso?: string | null
          link_drive?: string | null
          notas?: string | null
          prioridade?: string
          razao_social: string
          responsavel?: string | null
          tipo: Database["public"]["Enums"]["tipo_processo"]
          updated_at?: string | null
          valor?: number | null
          valor_avulso?: number | null
          via_analise?: Database["public"]["Enums"]["via_analise"]
        }
        Update: {
          auditado_em?: string | null
          auditado_financeiro?: boolean | null
          cliente_id?: string
          created_at?: string | null
          data_deferimento?: string | null
          dentro_do_plano?: boolean | null
          empresa_id?: string | null
          etapa?: string
          etiquetas?: string[] | null
          id?: string
          is_archived?: boolean | null
          justificativa_avulso?: string | null
          link_drive?: string | null
          notas?: string | null
          prioridade?: string
          razao_social?: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["tipo_processo"]
          updated_at?: string | null
          valor?: number | null
          valor_avulso?: number | null
          via_analise?: Database["public"]["Enums"]["via_analise"]
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          convidado_em: string | null
          convidado_por: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          empresa_id: string
          foto_url: string | null
          id: string
          motivo_inativacao: string | null
          nome: string | null
          role: string
          ultimo_acesso: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          convidado_em?: string | null
          convidado_por?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id: string
          foto_url?: string | null
          id: string
          motivo_inativacao?: string | null
          nome?: string | null
          role?: string
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          convidado_em?: string | null
          convidado_por?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string
          foto_url?: string | null
          id?: string
          motivo_inativacao?: string | null
          nome?: string | null
          role?: string
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_eventos: {
        Row: {
          created_at: string | null
          dados: Json | null
          empresa_id: string | null
          id: string
          ip_address: string | null
          orcamento_id: string | null
          tipo: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          dados?: Json | null
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          orcamento_id?: string | null
          tipo: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          dados?: Json | null
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          orcamento_id?: string | null
          tipo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_eventos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          cor: string | null
          descricao: string | null
          id: string
          modulos_padrao: string[]
          nome_display: string
          ordem: number | null
          role: string
        }
        Insert: {
          cor?: string | null
          descricao?: string | null
          id?: string
          modulos_padrao?: string[]
          nome_display: string
          ordem?: number | null
          role: string
        }
        Update: {
          cor?: string | null
          descricao?: string | null
          id?: string
          modulos_padrao?: string[]
          nome_display?: string
          ordem?: number | null
          role?: string
        }
        Relationships: []
      }
      service_negotiations: {
        Row: {
          billing_trigger: string
          cliente_id: string
          created_at: string | null
          empresa_id: string | null
          fixed_price: number
          id: string
          is_custom: boolean
          observacoes: string | null
          service_name: string
          trigger_days: number | null
          updated_at: string | null
          valor_prepago: number | null
        }
        Insert: {
          billing_trigger?: string
          cliente_id: string
          created_at?: string | null
          empresa_id?: string | null
          fixed_price?: number
          id?: string
          is_custom?: boolean
          observacoes?: string | null
          service_name: string
          trigger_days?: number | null
          updated_at?: string | null
          valor_prepago?: number | null
        }
        Update: {
          billing_trigger?: string
          cliente_id?: string
          created_at?: string | null
          empresa_id?: string | null
          fixed_price?: number
          id?: string
          is_custom?: boolean
          observacoes?: string | null
          service_name?: string
          trigger_days?: number | null
          updated_at?: string | null
          valor_prepago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_negotiations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      trello_guard_logs: {
        Row: {
          action_type: string
          board_id: string | null
          board_name: string | null
          card_id: string | null
          card_name: string | null
          created_at: string | null
          id: string
          member_username: string | null
          raw_action: Json | null
          revert_detail: string | null
          was_reverted: boolean | null
        }
        Insert: {
          action_type: string
          board_id?: string | null
          board_name?: string | null
          card_id?: string | null
          card_name?: string | null
          created_at?: string | null
          id?: string
          member_username?: string | null
          raw_action?: Json | null
          revert_detail?: string | null
          was_reverted?: boolean | null
        }
        Update: {
          action_type?: string
          board_id?: string | null
          board_name?: string | null
          card_id?: string | null
          card_name?: string | null
          created_at?: string | null
          id?: string
          member_username?: string | null
          raw_action?: Json | null
          revert_detail?: string | null
          was_reverted?: boolean | null
        }
        Relationships: []
      }
      trello_provisioner_logs: {
        Row: {
          actions_applied: Json | null
          board_id: string | null
          board_name: string | null
          created_at: string | null
          errors: Json | null
          id: string
          success: boolean | null
          trigger_type: string | null
        }
        Insert: {
          actions_applied?: Json | null
          board_id?: string | null
          board_name?: string | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          success?: boolean | null
          trigger_type?: string | null
        }
        Update: {
          actions_applied?: Json | null
          board_id?: string | null
          board_name?: string | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          success?: boolean | null
          trigger_type?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          modulo: string
          pode_aprovar: boolean | null
          pode_criar: boolean | null
          pode_editar: boolean | null
          pode_excluir: boolean | null
          pode_ver: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          modulo: string
          pode_aprovar?: boolean | null
          pode_criar?: boolean | null
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_ver?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          modulo?: string
          pode_aprovar?: boolean | null
          pode_criar?: boolean | null
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_ver?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      valores_adicionais: {
        Row: {
          anexo_url: string | null
          categoria: string | null
          comprovante_url: string | null
          created_at: string | null
          descricao: string
          empresa_id: string | null
          id: string
          processo_id: string
          reembolsavel: boolean
          updated_at: string | null
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          categoria?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao: string
          empresa_id?: string | null
          id?: string
          processo_id: string
          reembolsavel?: boolean
          updated_at?: string | null
          valor?: number
        }
        Update: {
          anexo_url?: string | null
          categoria?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          processo_id?: string
          reembolsavel?: boolean
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "valores_adicionais_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          key: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          key: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _auditoria_gravar: {
        Args: {
          p_campo: string
          p_empresa_id: string
          p_entidade: string
          p_entidade_id: string
          p_valor_antigo: Json
          p_valor_novo: Json
        }
        Returns: undefined
      }
      _log_acesso_publico: {
        Args: { p_tipo: string; p_token: string }
        Returns: undefined
      }
      alterar_valor_lancamento: {
        Args: {
          p_lancamento_id: string
          p_novo_valor: number
          p_valor_atual: number
        }
        Returns: Json
      }
      arquivar_cliente: { Args: { p_cliente_id: string }; Returns: undefined }
      asaas_tentar_lock_cobranca: {
        Args: { p_cobranca_id: string }
        Returns: Json
      }
      atualizar_proposta_por_token: {
        Args: { p_motivo?: string; p_status: string; p_token: string }
        Returns: undefined
      }
      calcular_preco_processo: {
        Args: {
          p_cliente_id: string
          p_tipo: Database["public"]["Enums"]["tipo_processo"]
        }
        Returns: number
      }
      calcular_vencimento: { Args: { p_cliente_id: string }; Returns: string }
      criar_evento_proposta: {
        Args: { p_dados?: Json; p_orcamento_id: string; p_tipo: string }
        Returns: undefined
      }
      criar_notificacao_proposta: {
        Args: { p_mensagem: string; p_orcamento_id: string; p_tipo: string }
        Returns: undefined
      }
      criar_processo_com_lancamento: {
        Args: {
          p_cliente_id: string
          p_created_at?: string
          p_criar_avulso_extra?: boolean
          p_criar_lancamento?: boolean
          p_data_lancamento?: string
          p_data_vencimento?: string
          p_dentro_do_plano?: boolean
          p_descricao_avulso_extra?: string
          p_descricao_lancamento?: string
          p_etiquetas?: string[]
          p_ja_pago?: boolean
          p_justificativa_avulso?: string
          p_notas?: string
          p_prioridade?: string
          p_razao_social: string
          p_responsavel?: string
          p_tipo: string
          p_valor?: number
          p_valor_avulso?: number
          p_valor_avulso_extra?: number
          p_via_analise?: string
        }
        Returns: string
      }
      desarquivar_cliente: {
        Args: { p_cliente_id: string }
        Returns: undefined
      }
      get_cobranca_por_token: {
        Args: { p_token: string }
        Returns: {
          asaas: Json
          cliente_apelido: string
          cliente_cnpj: string
          cliente_nome: string
          cliente_nome_contador: string
          created_at: string
          data_vencimento: string
          empresa_config: Json
          id: string
          lancamentos: Json
          status: string
          total_geral: number
          total_honorarios: number
          total_taxas: number
        }[]
      }
      get_empresa_id: { Args: never; Returns: string }
      get_historico_financeiro: {
        Args: { p_entidade: string; p_entidade_id: string; p_limit?: number }
        Returns: {
          ator_nome: string
          ator_role: string
          ator_tipo: string
          campo: string
          criado_em: string
          id: number
          valor_antigo: Json
          valor_novo: Json
        }[]
      }
      get_proposta_por_token: {
        Args: { p_token: string }
        Returns: {
          aprovado_em: string
          beneficios_capa: Json
          cenario_selecionado: string
          cenarios: Json
          clicksign_document_key: string
          cliente_id: string
          contexto: string
          contrato_assinado_url: string
          convertido_em: string
          created_at: string
          created_by: string
          desconto_pct: number
          desconto_progressivo_ativo: boolean
          desconto_progressivo_limite: number
          desconto_progressivo_pct: number
          destinatario: string
          empresa_id: string
          enviado_em: string
          escopo: Json
          etapas_fluxo: Json
          has_password: boolean
          headline_cenario: string
          id: string
          itens_selecionados: Json
          naturezas: Json
          numero: number
          observacoes: string
          observacoes_recusa: string
          ordem_execucao: string
          pacotes: Json
          pagamento: string
          pago_em: string
          pdf_url: string
          prazo_execucao: string
          prazo_pagamento_dias: number
          prospect_cnpj: string
          prospect_contato: string
          prospect_email: string
          prospect_nome: string
          prospect_telefone: string
          qtd_processos: number
          recusado_em: string
          riscos: Json
          secoes: Json
          servicos: Json
          share_token: string
          sla: string
          status: string
          tipo_contrato: string
          updated_at: string
          validade_dias: number
          valor_base: number
          valor_final: number
        }[]
      }
      get_user_empresa_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      hash_master_password: { Args: { p_password: string }; Returns: string }
      mark_cobranca_visualizada: {
        Args: { p_token: string }
        Returns: undefined
      }
      pode_avancar_cobranca: { Args: { p_processo_id: string }; Returns: Json }
      promover_lancamento_ao_deferir: {
        Args: { p_processo_id: string }
        Returns: Json
      }
      register_master_password_attempt: {
        Args: { p_ip: string; p_success: boolean; p_user_id: string }
        Returns: {
          allowed: boolean
          recent_failures: number
          retry_after_seconds: number
        }[]
      }
      resolve_empresa_config: { Args: { p_empresa_id: string }; Returns: Json }
      reverter_boas_vindas: {
        Args: { p_cliente_id: string }
        Returns: undefined
      }
      rotacionar_cobranca_token: {
        Args: { p_cobranca_id: string }
        Returns: string
      }
      salvar_selecao_proposta: {
        Args: { p_itens_selecionados: Json; p_token: string }
        Returns: boolean
      }
      set_master_password_hash: { Args: { p_hash: string }; Returns: undefined }
      tentar_aplicar_boas_vindas: {
        Args: { p_cliente_id: string }
        Returns: Json
      }
      verificar_senha_proposta: {
        Args: { p_senha: string; p_token: string }
        Returns: boolean
      }
      verify_master_password_hash: {
        Args: { p_password: string }
        Returns: boolean
      }
    }
    Enums: {
      status_financeiro: "pendente" | "pago" | "atrasado" | "cancelado"
      tipo_cliente: "MENSALISTA" | "AVULSO_4D" | "PRE_PAGO"
      tipo_lancamento: "receber" | "pagar"
      tipo_processo:
        | "abertura"
        | "alteracao"
        | "transformacao"
        | "baixa"
        | "avulso"
        | "orcamento"
      via_analise: "matriz" | "regional" | "metodo_trevo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_financeiro: ["pendente", "pago", "atrasado", "cancelado"],
      tipo_cliente: ["MENSALISTA", "AVULSO_4D", "PRE_PAGO"],
      tipo_lancamento: ["receber", "pagar"],
      tipo_processo: [
        "abertura",
        "alteracao",
        "transformacao",
        "baixa",
        "avulso",
        "orcamento",
      ],
      via_analise: ["matriz", "regional", "metodo_trevo"],
    },
  },
} as const
