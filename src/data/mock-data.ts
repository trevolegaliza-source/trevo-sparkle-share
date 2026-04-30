import { Process, Client } from '@/types/process';

export const mockProcesses: Process[] = [
  { id: '1', client_name: 'Contabilidade Souza', company_name: 'Padaria Trigo Bom LTDA', process_type: 'abertura', stage: 'recebidos', created_at: '2025-03-10', updated_at: '2025-03-10', priority: 'normal', responsible: 'Ana' },
  { id: '2', client_name: 'Contabilidade Souza', company_name: 'Tech Solutions ME', process_type: 'alteracao', stage: 'analise_documental', created_at: '2025-03-08', updated_at: '2025-03-11', priority: 'urgente', responsible: 'Carlos' },
  { id: '3', client_name: 'Escritório Lima', company_name: 'Auto Peças JP LTDA', process_type: 'abertura', stage: 'contrato', created_at: '2025-03-05', updated_at: '2025-03-12', priority: 'normal', responsible: 'Ana' },
  { id: '4', client_name: 'Escritório Lima', company_name: 'Restaurante Sabor Caseiro', process_type: 'transformacao', stage: 'viabilidade', created_at: '2025-03-01', updated_at: '2025-03-13', priority: 'normal', responsible: 'Bruno' },
  { id: '5', client_name: 'Contabilidade Master', company_name: 'Farmácia Saúde Já', process_type: 'baixa', stage: 'dbe', created_at: '2025-02-28', updated_at: '2025-03-14', priority: 'urgente', responsible: 'Carlos' },
  { id: '6', client_name: 'Contabilidade Master', company_name: 'Loja Virtual Express EIRELI', process_type: 'abertura', stage: 'aguardando_pagamento', created_at: '2025-02-25', updated_at: '2025-03-10', priority: 'normal', responsible: 'Ana', value: 1200 },
  { id: '7', client_name: 'ACR Contábil', company_name: 'Construtora Alvorada', process_type: 'alteracao', stage: 'taxa_paga', created_at: '2025-02-20', updated_at: '2025-03-09', priority: 'normal', responsible: 'Bruno', value: 850 },
  { id: '8', client_name: 'ACR Contábil', company_name: 'Clínica Bem Estar', process_type: 'abertura', stage: 'assinaturas', created_at: '2025-02-18', updated_at: '2025-03-08', priority: 'normal', responsible: 'Ana', value: 1500 },
  { id: '9', client_name: 'Escritório Lima', company_name: 'Academia Forma Fit', process_type: 'abertura', stage: 'em_analise', created_at: '2025-02-15', updated_at: '2025-03-07', priority: 'normal', responsible: 'Carlos', value: 1100 },
  { id: '10', client_name: 'Contabilidade Souza', company_name: 'Salão Belle Hair', process_type: 'transformacao', stage: 'registro', created_at: '2025-02-10', updated_at: '2025-03-06', priority: 'normal', responsible: 'Bruno', value: 900 },
  { id: '11', client_name: 'Contabilidade Master', company_name: 'Pet Shop Amigo Fiel', process_type: 'abertura', stage: 'alvaras', created_at: '2025-02-05', updated_at: '2025-03-05', priority: 'urgente', responsible: 'Ana', value: 1350 },
  { id: '12', client_name: 'ACR Contábil', company_name: 'Transportadora Veloz', process_type: 'alteracao', stage: 'finalizados', created_at: '2025-01-20', updated_at: '2025-03-01', priority: 'normal', responsible: 'Carlos', value: 750 },
  { id: '13', client_name: 'Escritório Lima', company_name: 'Papelaria Criativa ME', process_type: 'baixa', stage: 'arquivo', created_at: '2025-01-10', updated_at: '2025-02-28', priority: 'normal', responsible: 'Bruno', value: 600 },
  { id: '14', client_name: 'Contabilidade Souza', company_name: 'Distribuidora Norte', process_type: 'abertura', stage: 'vre', created_at: '2025-03-09', updated_at: '2025-03-14', priority: 'normal', responsible: 'Ana' },
  { id: '15', client_name: 'Contabilidade Master', company_name: 'Escola Infantil Raio de Sol', process_type: 'abertura', stage: 'assinado', created_at: '2025-02-22', updated_at: '2025-03-12', priority: 'normal', responsible: 'Bruno', value: 1400 },
  { id: '16', client_name: 'ACR Contábil', company_name: 'Borracharia Central', process_type: 'abertura', stage: 'mat', created_at: '2025-02-12', updated_at: '2025-03-10', priority: 'normal', responsible: 'Carlos', value: 1000 },
  { id: '17', client_name: 'Escritório Lima', company_name: 'Lavanderia Brilho', process_type: 'alteracao', stage: 'inscricao_me', created_at: '2025-02-08', updated_at: '2025-03-09', priority: 'normal', responsible: 'Ana', value: 800 },
  { id: '18', client_name: 'Contabilidade Souza', company_name: 'Gráfica Express Print', process_type: 'abertura', stage: 'conselho', created_at: '2025-02-01', updated_at: '2025-03-08', priority: 'urgente', responsible: 'Bruno', value: 1600 },
];

export const mockClients: Client[] = [
  { id: '1', name: 'Contabilidade Souza', type: 'mensalista', email: 'contato@souza.com', phone: '(11) 99999-0001', total_processes: 28, active_processes: 5 },
  { id: '2', name: 'Escritório Lima', type: 'mensalista', email: 'contato@lima.com', phone: '(11) 99999-0002', total_processes: 15, active_processes: 4 },
  { id: '3', name: 'Contabilidade Master', type: 'avulso', email: 'contato@master.com', phone: '(11) 99999-0003', total_processes: 22, active_processes: 4 },
  { id: '4', name: 'ACR Contábil', type: 'mensalista', email: 'contato@acr.com', phone: '(11) 99999-0004', total_processes: 12, active_processes: 3 },
];
