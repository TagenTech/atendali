import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Termos de uso' };

// RASCUNHO — revisar com assessoria jurídica antes de abrir cobrança da licença.
export default function TermosPage() {
  return (
    <LegalPage title="Termos de uso" updated="27/10/2026">
      <p>O Agendei é uma ferramenta para negócios com hora marcada (salões, barbearias, clínicas e consultórios) organizarem agenda, equipe, clientes e financeiro.</p>
      <h2>Sua conta</h2>
      <ul>
        <li>Você é responsável pelos dados que cadastra e por manter sua senha em segurança.</li>
        <li>Quem é dono(a) do negócio decide quem da equipe acessa o quê e responde pelos dados dos clientes cadastrados.</li>
        <li>Os dados dos clientes pertencem ao negócio; o Agendei os trata apenas para prestar o serviço (operador, na LGPD).</li>
      </ul>
      <h2>Uso gratuito e assinatura</h2>
      <p>
        O uso é gratuito neste momento. Se no futuro houver assinatura, avisaremos com antecedência, com período de teste e a
        possibilidade de cancelar quando quiser.
      </p>
      <h2>Dados</h2>
      <p>Você pode exportar e excluir seus dados a qualquer momento em Mais → Minha conta.</p>
    </LegalPage>
  );
}
