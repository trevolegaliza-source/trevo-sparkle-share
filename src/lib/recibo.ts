import { valorPorExtenso } from '@/lib/valor-extenso';

interface ReciboData {
  nome: string;
  valor: number;
  descricao: string;
  mesAno: string;
}

export function abrirRecibo(data: ReciboData) {
  const valorFormatado = data.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const extenso = valorPorExtenso(data.valor);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo de Pagamento</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
    .container { max-width: 700px; margin: 0 auto; border: 2px solid #22c55e; border-radius: 12px; padding: 40px; }
    .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #22c55e; padding-bottom: 24px; }
    .logo { font-size: 28px; font-weight: 800; color: #22c55e; letter-spacing: -1px; }
    .logo span { color: #1a1a2e; }
    .titulo { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; color: #444; }
    .corpo { font-size: 15px; line-height: 1.8; margin: 24px 0; }
    .valor { font-weight: 700; color: #22c55e; font-size: 17px; }
    .extenso { font-style: italic; }
    .assinatura { margin-top: 60px; display: flex; justify-content: space-between; }
    .campo-assinatura { text-align: center; width: 45%; }
    .linha { border-top: 1px solid #333; margin-bottom: 4px; }
    .campo-label { font-size: 12px; color: #666; }
    .data { margin-top: 32px; font-size: 13px; color: #666; }
    @media print { body { padding: 20px; } .container { border-color: #000; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TREVO <span>LEGALIZA</span></div>
      <div class="titulo">Recibo de Pagamento</div>
    </div>
    <div class="corpo">
      <p>Recebi de <strong>Trevo Legaliza 🍀</strong> a importância de
        <span class="valor">${valorFormatado}</span>
        (<span class="extenso">${extenso}</span>)
        referente a <strong>${data.descricao}</strong> do mês de <strong>${data.mesAno}</strong>.
      </p>
      <p style="margin-top: 16px;">Para maior clareza, firmo o presente recibo para que produza os seus efeitos legais.</p>
    </div>
    <div class="data">
      <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="assinatura">
      <div class="campo-assinatura">
        <div class="linha"></div>
        <div class="campo-label">${data.nome}</div>
        <div class="campo-label">Recebedor</div>
      </div>
      <div class="campo-assinatura">
        <div class="linha"></div>
        <div class="campo-label">Trevo Legaliza 🍀</div>
        <div class="campo-label">Pagador</div>
      </div>
    </div>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
