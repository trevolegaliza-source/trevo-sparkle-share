import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ContratoData {
  numero_contrato: string;
  contratante_tipo: 'juridica' | 'fisica';
  contratante_nome: string;
  contratante_cnpj_cpf: string;
  contratante_endereco: string;
  contratante_representante: string;
  contratante_representante_cpf: string;
  contratante_representante_qualificacao?: string;
  cidade_contrato: string;
  data_contrato: string; // ISO date
  numero_proposta: string;
  data_proposta: string;
}

const LOGO_URLS = [
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza-hd.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png',
];

async function preloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function preloadLogo(): Promise<string | null> {
  for (const url of LOGO_URLS) {
    const b64 = await preloadImageAsBase64(url);
    if (b64) return b64;
  }
  return null;
}

function formatarDataExtenso(dateStr: string): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHeader(logo: string | null, data: ContratoData): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 36px;border-bottom:2px solid #166534;">
      ${logo ? `<img src="${logo}" style="width:140px;height:auto;" />` : '<span style="font-weight:700;color:#166534;font-size:16px;">TREVO LEGALIZA</span>'}
      <div style="text-align:right;">
        <p style="font-size:11px;font-weight:700;color:#166534;">CONTRATO Nº ${esc(data.numero_contrato)}</p>
        <p style="font-size:10px;color:#6b7280;">${formatarDataExtenso(data.data_contrato)}</p>
      </div>
    </div>`;
}

function buildFooter(): string {
  return `
    <div style="border-top:1px solid #e5e7eb;padding:12px 36px;text-align:center;">
      <p style="font-size:9px;color:#9ca3af;">Trevo Legaliza · CNPJ 39.969.412/0001-70 · trevolegaliza.com.br</p>
    </div>`;
}

function buildContratoPages(data: ContratoData, logo: string | null): string[] {
  const tipoLabel = data.contratante_tipo === 'juridica' ? 'jurídica' : 'física';
  const docLabel = data.contratante_tipo === 'juridica' ? 'CNPJ' : 'CPF';
  const sedeLabel = data.contratante_tipo === 'juridica' ? 'com sede' : 'domiciliado(a)';
  const qualContratante = data.contratante_representante_qualificacao || 'brasileiro(a)';

  const header = buildHeader(logo, data);
  const footer = buildFooter();

  const clausulas = [
    // Page 1: Title + Parties + Clauses 1-2
    `<div style="padding:24px 36px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.8;color:#1f2937;">
      <h1 style="text-align:center;font-size:15px;font-weight:700;color:#166534;margin-bottom:28px;letter-spacing:0.5px;">
        CONTRATO DE PRESTAÇÃO DE SERVIÇOS SOCIETÁRIOS<br/>Nº ${esc(data.numero_contrato)}
      </h1>
      <p>Pelo presente instrumento particular, as partes abaixo qualificadas:</p>
      <p style="margin-top:16px;"><strong>CONTRATANTE:</strong> ${esc(data.contratante_nome)}, pessoa ${tipoLabel} de direito privado, inscrita no ${docLabel} sob o nº ${esc(data.contratante_cnpj_cpf)}, ${sedeLabel} em ${esc(data.contratante_endereco)}, neste ato representada por ${esc(data.contratante_representante)}, ${esc(qualContratante)}, portador(a) do CPF nº ${esc(data.contratante_representante_cpf)}.</p>
      <p style="margin-top:12px;"><strong>CONTRATADA:</strong> TREVO ASSESSORIA SOCIETÁRIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 39.969.412/0001-70, com sede em Rua Brasil, nº 1170, Rudge Ramos, São Bernardo do Campo/SP, neste ato representada pelo Diretor Dr. Thales Felipe Burger, empresário e advogado, brasileiro, solteiro, portador do CPF nº 447.821.658-46.</p>
      <p style="margin-top:16px;">Resolvem celebrar o presente contrato de prestação de serviços, mediante as seguintes cláusulas e condições:</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 1ª — DO OBJETO E NATUREZA DA OBRIGAÇÃO</h2>
      <p style="margin-left:20px;">1.1. O presente contrato tem por objeto a prestação de serviços técnicos especializados em assessoria societária e legalização empresarial, conforme escopo, etapas e limites estritamente descritos na Proposta Comercial nº ${esc(data.numero_proposta)}, datada de ${esc(data.data_proposta)}, que integra este instrumento como Anexo I, independentemente de transcrição.</p>
      <p style="margin-left:20px;">1.2. <strong>OBRIGAÇÃO DE MEIO:</strong> A CONTRATANTE declara ciência de que os honorários pactuados remuneram exclusivamente o serviço de meio, que compreende a análise técnica, preparação de documentos, minutas e o efetivo peticionamento perante os órgãos competentes.</p>
      <p style="margin-left:20px;">1.3. A CONTRATADA não garante o deferimento ou resultado final do processo, uma vez que este depende de decisões discricionárias de terceiros (órgãos públicos, autarquias, cartórios e demais entidades). Eventual indeferimento não configura inadimplemento contratual por parte da CONTRATADA.</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 2ª — DO PAGAMENTO, MORA E GATILHO DE INÍCIO</h2>
      <p style="margin-left:20px;">2.1. O valor total dos serviços e a forma de pagamento são os estabelecidos no Anexo I (Proposta Comercial).</p>
      <p style="margin-left:20px;">2.2. <strong>CONDIÇÃO PRECEDENTE:</strong> A execução de qualquer serviço e a contagem de prazos estimados somente se iniciarão após a confirmação do pagamento da primeira parcela (em caso de parcelamento) ou do pagamento integral à vista, quando for o caso.</p>
      <p style="margin-left:20px;">2.3. Tributos, taxas, emolumentos, custas de cartório, DAREs, DARFs e quaisquer encargos públicos devidos para a execução dos atos não estão incluídos nos honorários profissionais e são de responsabilidade exclusiva da CONTRATANTE, devendo ser pagos diretamente aos órgãos competentes ou reembolsados à CONTRATADA mediante comprovação.</p>
      <p style="margin-left:20px;">2.4. O atraso no pagamento de qualquer parcela sujeitará a CONTRATANTE à incidência de multa moratória de 2% (dois por cento) sobre o valor devido, acrescida de juros de 1% (um por cento) ao mês, calculados pro rata die, e suspensão imediata da execução dos serviços até a regularização, sem que tal suspensão configure mora da CONTRATADA.</p>
    </div>`,

    // Page 2: Clauses 3-4
    `<div style="padding:24px 36px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.8;color:#1f2937;">
      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:8px;">CLÁUSULA 3ª — DA DOCUMENTAÇÃO, COOPERAÇÃO E RETRABALHO</h2>
      <p style="margin-left:20px;">3.1. A CONTRATANTE obriga-se a fornecer todos os documentos, informações, assinaturas e certificados digitais solicitados pela CONTRATADA de forma contínua, tempestiva e fidedigna.</p>
      <p style="margin-left:20px;">3.2. Documentação incompleta, com vícios, ilegível ou em desconformidade com as exigências legais não produzirá início de contagem de prazo, independentemente de comunicação formal da CONTRATADA.</p>
      <p style="margin-left:20px;">3.3. A responsabilidade por eventuais exigências de órgãos públicos decorrentes de dados ou documentos incorretos, incompletos ou falsos fornecidos pela CONTRATANTE é integral e exclusiva desta.</p>
      <p style="margin-left:20px;">3.4. <strong>TAXA DE RETRABALHO:</strong> Alterações solicitadas pela CONTRATANTE após o início da elaboração dos documentos ou do peticionamento — motivadas por mera vontade desta, mudança de planejamento ou pelo fornecimento incorreto de dados iniciais — gerarão cobrança adicional de 15% (quinze por cento) a 100% (cem por cento) sobre o valor do serviço afetado, a depender da complexidade da alteração, conforme avaliação técnica da CONTRATADA.</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 4ª — DA IMPREVISIBILIDADE DOS ÓRGÃOS PÚBLICOS</h2>
      <p style="margin-left:20px;">4.1. As partes reconhecem que órgãos federais, estaduais e municipais (Juntas Comerciais, Receita Federal, Prefeituras, Cartórios, Vigilâncias Sanitárias, Corpos de Bombeiros, Conselhos Profissionais e demais) não possuem diligência padronizada para análise processual.</p>
      <p style="margin-left:20px;">4.2. Em razão da falta de padronização, processos aparentemente simples podem tornar-se complexos por exigências subjetivas do analista do órgão, o que não configura falha, negligência ou inadimplemento na prestação do serviço da CONTRATADA.</p>
      <p style="margin-left:20px;">4.3. A CONTRATADA não se responsabiliza por atrasos nos prazos estimados que sejam decorrentes de:</p>
      <p style="margin-left:40px;">a) Análises discricionárias ou mudanças de entendimento de órgãos públicos;</p>
      <p style="margin-left:40px;">b) Instabilidades, indisponibilidades ou falhas operacionais em sistemas governamentais (Redesim, VRE, CNPJ Web, portais municipais, entre outros);</p>
      <p style="margin-left:40px;">c) Alterações normativas, edição de portarias, instruções normativas ou resoluções supervenientes à contratação;</p>
      <p style="margin-left:40px;">d) Atrasos por parte da CONTRATANTE no fornecimento de informações, documentos ou assinaturas;</p>
      <p style="margin-left:40px;">e) Greves, paralisações ou redução de expediente de servidores públicos.</p>
    </div>`,

    // Page 3: Clauses 5-7
    `<div style="padding:24px 36px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.8;color:#1f2937;">
      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:8px;">CLÁUSULA 5ª — DAS EXIGÊNCIAS PÓS-PROTOCOLO</h2>
      <p style="margin-left:20px;">5.1. Eventuais exigências apontadas pelo órgão após o peticionamento não gerarão custos adicionais de honorários, desde que o saneamento dependa exclusivamente de ajustes formais a serem realizados pela CONTRATADA.</p>
      <p style="margin-left:20px;">5.2. Caso a exigência seja ocasionada por erro, omissão, dado inverídico ou documento falso/inválido fornecido pela CONTRATANTE, esta responderá integralmente pelos custos de novo protocolo, taxas adicionais e honorários de retrabalho previstos na Cláusula 3.4.</p>
      <p style="margin-left:20px;">5.3. Exigências que impliquem serviços não contemplados no escopo original do Anexo I serão objeto de proposta comercial complementar, facultada à CONTRATANTE a sua aceitação.</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 6ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)</h2>
      <p style="margin-left:20px;">6.1. As partes se comprometem a manter sigilo sobre todas as informações confidenciais trocadas em razão deste contrato, durante e após sua vigência.</p>
      <p style="margin-left:20px;">6.2. O tratamento de dados pessoais no âmbito deste contrato observará integralmente as disposições da Lei nº 13.709/2018 (LGPD), sendo o tratamento realizado exclusivamente para as finalidades inerentes ao cumprimento das obrigações aqui pactuadas.</p>
      <p style="margin-left:20px;">6.3. A CONTRATADA atuará na qualidade de Operadora de dados, implementando medidas técnicas e administrativas aptas a proteger os dados recebidos contra acessos não autorizados, destruição, perda ou alteração indevida.</p>
      <p style="margin-left:20px;">6.4. Finalizado o escopo do serviço, os dados sensíveis e documentos pessoais coletados serão mantidos pelo prazo legal obrigatório e, após, descartados de forma segura, ressalvados aqueles necessários para o cumprimento de obrigações legais ou defesa em processos judiciais ou administrativos.</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 7ª — DA RESCISÃO</h2>
      <p style="margin-left:20px;">7.1. O presente contrato poderá ser rescindido por qualquer das partes mediante comunicação prévia por escrito com antecedência mínima de 15 (quinze) dias.</p>
      <p style="margin-left:20px;">7.2. Na hipótese de rescisão imotivada pela CONTRATANTE após o início dos trabalhos, serão devidos os honorários proporcionais aos serviços já executados, protocolos já realizados e materiais já elaborados, não havendo devolução de valores referentes a etapas concluídas ou em andamento.</p>
      <p style="margin-left:20px;">7.3. A rescisão não exime a CONTRATANTE do pagamento de parcelas vencidas e não pagas até a data da rescisão, acrescidas dos encargos previstos na Cláusula 2.4.</p>
    </div>`,

    // Page 4: Clauses 8-9 + Signatures + Annexe
    `<div style="padding:24px 36px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.8;color:#1f2937;">
      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:8px;">CLÁUSULA 8ª — DA VIGÊNCIA</h2>
      <p style="margin-left:20px;">8.1. O presente contrato vigorará pelo prazo necessário à conclusão integral dos serviços descritos no Anexo I, extinguindo-se automaticamente com a entrega do último ato ou documento objeto da contratação.</p>
      <p style="margin-left:20px;">8.2. As cláusulas relativas a confidencialidade (6ª), proteção de dados (6ª) e foro (9ª) sobreviverão à extinção deste contrato.</p>

      <h2 style="font-size:13px;font-weight:700;color:#166534;margin-top:24px;">CLÁUSULA 9ª — DO FORO</h2>
      <p style="margin-left:20px;">Fica eleito o foro da Comarca de São Bernardo do Campo/SP para dirimir quaisquer dúvidas ou litígios decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

      <p style="margin-top:24px;">E por estarem assim justas e contratadas, as partes firmam o presente instrumento eletronicamente, declarando para todos os fins que a assinatura eletrônica tem a mesma validade jurídica da assinatura manuscrita, nos termos do art. 10, §2º, da Medida Provisória nº 2.200-2/2001.</p>

      <p style="margin-top:16px;font-weight:600;text-align:center;">${esc(data.cidade_contrato)}, ${formatarDataExtenso(data.data_contrato)}</p>

      <div style="display:flex;justify-content:space-between;margin-top:60px;">
        <div style="text-align:center;width:280px;">
          <div style="border-top:1px solid #374151;padding-top:8px;">
            <p style="font-weight:700;font-size:12px;">CONTRATANTE</p>
            <p style="font-size:11px;">${esc(data.contratante_nome)}</p>
            <p style="font-size:10px;color:#6b7280;">${docLabel}: ${esc(data.contratante_cnpj_cpf)}</p>
            <p style="font-size:10px;color:#6b7280;">Representante: ${esc(data.contratante_representante)}</p>
          </div>
        </div>
        <div style="text-align:center;width:280px;">
          <div style="border-top:1px solid #374151;padding-top:8px;">
            <p style="font-weight:700;font-size:12px;">CONTRATADA</p>
            <p style="font-size:11px;">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
            <p style="font-size:10px;color:#6b7280;">CNPJ: 39.969.412/0001-70</p>
            <p style="font-size:10px;color:#6b7280;">Representante: Dr. Thales Felipe Burger</p>
          </div>
        </div>
      </div>

      <div style="margin-top:48px;padding:20px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;text-align:center;">
        <p style="font-size:13px;font-weight:700;color:#166534;">ANEXO I — PROPOSTA COMERCIAL Nº ${esc(data.numero_proposta)}</p>
        <p style="font-size:11px;color:#6b7280;margin-top:4px;">(documento integrante deste contrato, em separado)</p>
      </div>
    </div>`,
  ];

  return clausulas.map((body, i) => `
    <div style="width:794px;min-height:1123px;display:flex;flex-direction:column;background:#fff;font-family:'Segoe UI',Arial,sans-serif;">
      ${header}
      <div style="flex:1;">${body}</div>
      <div style="text-align:right;padding:0 36px 4px 0;">
        <span style="font-size:9px;color:#9ca3af;">Página ${i + 1} de ${clausulas.length}</span>
      </div>
      ${footer}
    </div>
  `);
}

async function renderPageToCanvas(html: string): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;top:-99999px;left:-99999px;width:794px;`;
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for images
  const imgs = container.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img =>
    img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })
  ));

  await new Promise(r => setTimeout(r, 200));

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    width: 794,
    windowWidth: 794,
  });

  document.body.removeChild(container);
  return canvas;
}

function addCanvasToDoc(doc: jsPDF, canvas: HTMLCanvasElement) {
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  let imgW = pdfW;
  let imgH = (canvas.height / canvas.width) * pdfW;
  if (imgH > pdfH) {
    const scale = pdfH / imgH;
    imgW = pdfW * scale;
    imgH = pdfH;
  }
  const offsetX = (pdfW - imgW) / 2;
  doc.addImage(imgData, 'JPEG', offsetX, 0, imgW, imgH);
}

export async function gerarContratoPDF(data: ContratoData): Promise<Blob> {
  const logo = await preloadLogo();
  const pagesHtml = buildContratoPages(data, logo);
  const doc = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage();
    const canvas = await renderPageToCanvas(pagesHtml[i]);
    addCanvasToDoc(doc, canvas);
  }

  return doc.output('blob');
}
