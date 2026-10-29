import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/brand/logo';
import { AgendaMock } from '@/components/marketing/agenda-mock';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: { absolute: 'Skedulei — agenda, caixa e financeiro para clínicas, consultórios e salões' },
  description:
    'Agenda por profissional, agendamento online, comanda, caixa, comissões e financeiro num só lugar. Para clínicas, consultórios, estética, salões e barbearias.',
  alternates: { canonical: '/' },
};

const STEPS = [
  {
    title: 'Escolha o tipo de negócio',
    text: 'Cada segmento já começa com o vocabulário e os módulos certos — paciente ou cliente, procedimento ou serviço. O que não serve, você desliga.',
  },
  {
    title: 'Cadastre equipe, serviços e horários',
    text: 'Cada profissional tem agenda e horário de trabalho próprios. Serviços levam duração e preço; a unidade tem o horário de funcionamento.',
  },
  {
    title: 'Divulgue o link e atenda',
    text: 'Seu negócio ganha uma página de agendamento. O cliente escolhe um horário livre, você acompanha na agenda, recebe na comanda e fecha o caixa.',
  },
];

const SEGMENTS = [
  {
    title: 'Clínicas e consultórios',
    sub: 'Médica, odontologia, terapias',
    color: 1,
    points: [
      'Status do atendimento: agendado, confirmado, chegou, em atendimento, concluído.',
      'Anamnese, termos de consentimento e prontuário, com dado de saúde cifrado e leitura restrita ao dono e a quem atende.',
      'Lembrete por e-mail 24 h e 2 h antes, com confirmação de presença pelo link.',
    ],
  },
  {
    title: 'Clínicas de estética',
    sub: 'Procedimentos, pacotes e retorno',
    color: 4,
    points: [
      'Pacotes de sessões com saldo e validade, clube de assinatura e vale-presente.',
      'Programa de pontos que vira desconto na comanda.',
      'A pessoa reserva até 5 procedimentos de uma vez, um logo após o outro.',
    ],
  },
  {
    title: 'Salões e barbearias',
    sub: 'Horário rápido, direto no celular',
    color: 3,
    points: [
      'Agendamento pelo celular, sem criar conta e sem baixar app.',
      'Comissão por profissional e fechamento por período.',
      'Lista de espera para reaproveitar horários cancelados, e estoque de produtos.',
    ],
  },
];

const FEATURES = [
  ['Agenda por profissional', 'De 1 a 7 dias na tela, com arrastar e redimensionar no computador, bloqueio de horários e filtro de cancelados.'],
  ['Agendamento online', 'Página própria do negócio. O cliente reserva sozinho e depois consulta, remarca ou cancela pelo link da reserva.'],
  ['Lembretes e confirmação', 'E-mails 24 h e 2 h antes, com link para confirmar presença, e aviso à equipe quando alguém reserva.'],
  ['Comanda e caixa', 'Formas de pagamento com taxa, desconto, troco e fechamento do caixa com conferência.'],
  ['Comissões', 'Percentual por serviço ou profissional, extrato e fechamento do período.'],
  ['Contas, DRE e fluxo de caixa', 'Contas a pagar e a receber, resultado do mês e caixa realizado e projetado.'],
  ['Estoque e produtos', 'Venda de produtos e baixa de insumos a cada atendimento.'],
  ['Pacotes, clube, vale e pontos', 'Ferramentas de retorno do cliente, todas passando pela mesma comanda.'],
  ['Ficha clínica', 'Prontuário, anamnese e termos assinados na tela ou pelo link, com histórico de acessos.'],
  ['Relatórios', 'Faturamento, ocupação da agenda, faltas, clientes que sumiram e aniversariantes, com mensagem pronta para o WhatsApp.'],
  ['Equipe e permissões', 'Dono, gerente, recepção, profissional e financeiro: cada perfil vê só o que precisa.'],
  ['Avaliações e painel de TV', 'Avaliação pelo link depois do atendimento e painel para a recepção.'],
] as const;

const TRUST = [
  'CPF e dados de saúde são cifrados no banco e nunca voltam inteiros para o navegador.',
  'Cada negócio só enxerga os próprios dados — o isolamento é garantido no próprio banco de dados.',
  'Ações sensíveis do dinheiro (estorno, desconto, caixa) ficam num registro que ninguém edita nem apaga.',
  'Verificação em duas etapas e recusa de senhas comuns.',
];

const FAQ = [
  ['Meu cliente precisa instalar algo para marcar?', 'Não. A página de agendamento abre no navegador do celular. Ele escolhe o horário, informa o telefone e pode ver, remarcar ou cancelar depois.'],
  ['Funciona para quem atende sozinho?', 'Sim. Cada pessoa da equipe tem agenda própria, e você pode começar só com a sua.'],
  ['Consigo usar no celular?', 'Sim. No celular a navegação fica na barra inferior, no computador vira um menu lateral, e dá para instalar como app.'],
  ['O Skedulei envia lembretes pelo WhatsApp?', 'Hoje os lembretes saem por e-mail. O envio automático pelo WhatsApp ainda não está disponível; o sistema monta mensagens prontas que você envia com um toque.'],
  ['Posso trazer minha lista de clientes?', 'Pode. Importe uma planilha CSV: o sistema mostra uma prévia, avisa o que está errado e evita duplicar quem já existe.'],
  ['Meu negócio não é salão nem clínica. Serve?', 'Há também o tipo "Outro tipo de negócio", com agenda, equipe, serviços e financeiro, e você liga os módulos que quiser.'],
];

const NAV = [
  ['#como-funciona', 'Como funciona'],
  ['#segmentos', 'Segmentos'],
  ['#recursos', 'Recursos'],
  ['#perguntas', 'Perguntas'],
];

const wrap = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

export default function LandingPage() {
  return (
    <div className="bg-background">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:font-bold">
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-[var(--nav-bg)] pt-safe backdrop-blur-xl">
        <div className={`${wrap} flex h-16 items-center justify-between gap-6`}>
          <Link href="/" aria-label="Skedulei — página inicial">
            <Wordmark />
          </Link>
          <nav aria-label="Seções da página" className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/cadastro">
                <span>
                  Criar conta<span className="hidden sm:inline"> grátis</span>
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className={`${wrap} grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pb-24 lg:pt-16`}>
          <div>
            <h1 className="border-l-[4px] border-primary pl-4 font-display text-[clamp(2.35rem,10vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight">
              Marcado.
              <br />
              Confirmado.
              <br />
              Pago.
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
              Agenda por profissional, agendamento online, comanda, caixa e financeiro num só lugar. Para clínicas, consultórios, estética, salões e barbearias.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/cadastro">Criar conta grátis</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </div>
          <div className="min-w-0">
            <AgendaMock />
            <p className="mt-3 text-sm text-muted-foreground">Exemplo ilustrativo: agenda do dia, com a cor de cada profissional e a linha do horário atual.</p>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 border-t border-border">
          <div className={`${wrap} py-20`}>
            <h2 className="max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">Do cadastro ao primeiro horário marcado, em três passos</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-l-[3px] border-primary pl-5">
                  <span className="font-display text-sm font-extrabold tabular-nums text-primary">{i + 1}</span>
                  <h3 className="mt-2 font-display text-xl font-extrabold">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="segmentos" className="scroll-mt-20 bg-muted">
          <div className={`${wrap} py-20`}>
            <h2 className="max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">Um sistema, o jeito de cada negócio trabalhar</h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">A base é a mesma: agenda, equipe, caixa e financeiro. O que muda é o vocabulário e os módulos que já vêm ligados.</p>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
              {SEGMENTS.map((s) => (
                <article key={s.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
                  <h3 className="flex items-center gap-2.5 font-display text-xl font-extrabold">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--pro-${s.color}-fg)` }} aria-hidden />
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{s.sub}</p>
                  <ul className="mt-5 space-y-3 leading-relaxed">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="scroll-mt-20">
          <div className={`${wrap} py-20`}>
            <h2 className="max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">Tudo o que o dia a dia pede, sem trocar de sistema</h2>
            <dl className="mt-12 grid gap-x-14 md:grid-cols-2">
              {FEATURES.map(([term, text]) => (
                <div key={term} className="border-t border-border py-5">
                  <dt className="font-display text-lg font-extrabold">{term}</dt>
                  <dd className="mt-1 leading-relaxed text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-ink-deep text-white">
          <div className={`${wrap} grid gap-10 py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16`}>
            <div>
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Dado de cliente e de saúde exige cuidado</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-white/75">O Skedulei foi pensado desde o início para a LGPD: guardar só o necessário e proteger o que é sensível.</p>
            </div>
            <ul className="divide-y divide-white/15 border-y border-white/15">
              {TRUST.map((t) => (
                <li key={t} className="py-4 leading-relaxed text-white/90">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-20">
          <div className={`${wrap} grid gap-10 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16`}>
            <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Perguntas frequentes</h2>
            <div className="border-b border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-t border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="max-w-xl pb-5 leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink-deep text-white">
          <div className={`${wrap} flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center`}>
            <h2 className="max-w-lg font-display text-3xl font-extrabold leading-tight sm:text-4xl">Abra a agenda do seu negócio hoje</h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-ink-deep hover:bg-white/90">
                <Link href="/cadastro">Criar conta grátis</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link href="/contato">Falar com a gente</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${wrap} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
          <Wordmark className="text-lg" markClassName="size-7" />
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
            <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/contato" className="hover:text-foreground">Contato</Link>
            <Link href="/login" className="hover:text-foreground">Entrar</Link>
          </nav>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Skedulei</p>
        </div>
      </footer>
    </div>
  );
}
