import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Política de privacidade' };

// RASCUNHO — revisar com assessoria jurídica (LGPD) antes de abrir cobrança da licença.
export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de privacidade" updated="27/10/2026">
      <h2>O que coletamos</h2>
      <ul>
        <li>Seu nome, e-mail e, ao finalizar o cadastro, CPF, celular e cidade.</li>
        <li>Se você entrar com Google, Microsoft ou Facebook: só nome, e-mail e o identificador da conta.</li>
        <li>Os dados do seu negócio, da equipe e dos clientes que vocês cadastram.</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar (agenda, equipe, cobranças, avisos).</li>
        <li>CPF e celular: identificar o titular da conta e, no futuro, emitir a cobrança da assinatura.</li>
      </ul>
      <h2>Seus direitos (LGPD)</h2>
      <p>Você pode acessar, corrigir, exportar e excluir seus dados. Não vendemos dados nem os usamos para publicidade.</p>
      <h2>Segurança</h2>
      <p>Senhas guardadas com hash, sessão em cookie protegido, conexão criptografada (HTTPS) e backups diários.</p>
    </LegalPage>
  );
}
