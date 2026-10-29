import {
  CalendarDays,
  CalendarCheck2,
  ClipboardList,
  Wallet,
  Percent,
  BarChart3,
  Bell,
  Users,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { APP_URL } from '@/lib/config';

const SEGMENTOS = [
  { nome: 'Salões de beleza', desc: 'Agenda por profissional, pacotes e comissão por serviço.', bg: 'var(--stu-rosa)', fg: 'var(--stu-rosa-fg)' },
  { nome: 'Barbearias', desc: 'Encaixe rápido, comandas no balcão e lista de espera.', bg: 'var(--stu-lavanda)', fg: 'var(--stu-lavanda-fg)' },
  { nome: 'Clínicas de estética', desc: 'Procedimentos, avaliações e retorno do cliente.', bg: 'var(--stu-pessego)', fg: 'var(--stu-pessego-fg)' },
  { nome: 'Clínicas médicas', desc: 'Prontuário, anamnese e convênios, com dados protegidos.', bg: 'var(--stu-ceu)', fg: 'var(--stu-ceu-fg)' },
  { nome: 'Odontologia', desc: 'Agenda por cadeira/profissional e termos assinados.', bg: 'var(--stu-menta)', fg: 'var(--stu-menta-fg)' },
  { nome: 'Terapias', desc: 'Sessões recorrentes, pacotes e confirmação automática.', bg: 'var(--stu-lilas)', fg: 'var(--stu-lilas-fg)' },
];

const RECURSOS = [
  { icon: CalendarDays, titulo: 'Agenda dia e semana', desc: 'Arraste para remarcar, puxe a borda para ajustar a duração. Sugestão de horários livres e bloqueio de conflitos.' },
  { icon: CalendarCheck2, titulo: 'Agendamento online', desc: 'Um link público do seu negócio: o cliente escolhe serviço, profissional, dia e horário — sem precisar de conta.' },
  { icon: ClipboardList, titulo: 'Comandas e caixa', desc: 'Serviços e produtos na mesma comanda, vários pagamentos, abertura com troco e fechamento com conferência.' },
  { icon: Percent, titulo: 'Comissões', desc: 'Percentual por profissional e por serviço, vales e fechamento automático do que está em aberto.' },
  { icon: Wallet, titulo: 'Financeiro completo', desc: 'Contas a pagar e a receber, DRE gerencial, fluxo de caixa e taxas da maquininha já descontadas.' },
  { icon: BarChart3, titulo: 'Relatórios', desc: 'Faturamento, ticket médio, mais vendidos e desempenho por profissional, com períodos prontos.' },
  { icon: Bell, titulo: 'Lembretes por e-mail', desc: 'O cliente recebe lembrete 24 h e 2 h antes. Confirmação pronta para mandar no WhatsApp.' },
  { icon: Users, titulo: 'Equipe com perfis', desc: 'Dono, Gerente, Recepção, Profissional e Financeiro — cada um vê e faz só o que pode.' },
  { icon: ShieldCheck, titulo: 'Seguro e na LGPD', desc: 'Observações de saúde cifradas, exportação e exclusão de dados, sessões por aparelho e 2FA.' },
];

const PASSOS = [
  { n: '1', titulo: 'Cadastre seu negócio', desc: 'Onboarding em 6 passos: segmento, horários, serviços-modelo, equipe e módulos.' },
  { n: '2', titulo: 'Organize agenda e equipe', desc: 'Cada profissional com seu horário e sua cor na agenda, dentro do funcionamento da unidade.' },
  { n: '3', titulo: 'Compartilhe o link', desc: 'Seu endereço público de agendamento sai pronto — é só mandar para os clientes.' },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ background: 'var(--nav-bg)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-9 rounded-xl" />
            <span className="font-display text-xl font-extrabold tracking-tight">Skedulei</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#segmentos" className="hover:text-foreground">Segmentos</a>
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href={`${APP_URL}/login`} className="rounded-xl px-4 py-2 text-sm font-semibold text-primary-soft-foreground hover:bg-primary-soft">
              Entrar
            </a>
            <a href={`${APP_URL}/cadastro`} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-float hover:bg-primary-hover">
              Começar grátis
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary-soft-foreground">
            <CalendarCheck2 className="size-4" />
            Para negócios que vivem de hora marcada
          </p>
          <h1 className="animate-fade-up mt-6 text-4xl font-extrabold leading-tight sm:text-5xl" style={{ animationDelay: '60ms' }}>
            Sua agenda cheia. Seu negócio inteiro em um só lugar.
          </h1>
          <p className="animate-fade-up mx-auto mt-5 max-w-2xl text-lg text-muted-foreground" style={{ animationDelay: '120ms' }}>
            Agenda, agendamento online, comandas, caixa, comissões e financeiro — feito para salões, barbearias,
            clínicas e consultórios, do jeito que cada um trabalha.
          </p>
          <div className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '180ms' }}>
            <a
              href={`${APP_URL}/cadastro`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-float transition hover:bg-primary-hover sm:w-auto"
            >
              Criar conta grátis
              <ArrowRight className="size-5" />
            </a>
            <a
              href="#recursos"
              className="inline-flex w-full items-center justify-center rounded-2xl border px-7 py-3.5 text-base font-bold text-foreground hover:bg-muted sm:w-auto"
            >
              Ver recursos
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Sem cartão. Teste com o seu negócio de verdade.</p>
        </div>

        {/* Mock visual da agenda */}
        <div className="animate-fade-up mx-auto mt-14 max-w-4xl" style={{ animationDelay: '240ms' }}>
          <div className="rounded-3xl border bg-card p-4 shadow-soft sm:p-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: 'var(--stu-coral)' }} />
                <span className="size-3 rounded-full" style={{ background: 'var(--stu-limao)' }} />
                <span className="size-3 rounded-full" style={{ background: 'var(--stu-menta)' }} />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">app.skedulei.com.br</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { nome: 'Ana', cor: 'var(--stu-lavanda)', fg: 'var(--stu-lavanda-fg)', itens: ['09:00 Corte', '10:30 Escova', '12:00 —'] },
                { nome: 'Beto', cor: 'var(--stu-rosa)', fg: 'var(--stu-rosa-fg)', itens: ['09:30 Barba', '11:00 Corte + Barba', '13:00 —'] },
                { nome: 'Clara', cor: 'var(--stu-menta)', fg: 'var(--stu-menta-fg)', itens: ['10:00 Coloração', '12:30 —', '14:00 Manicure'] },
              ].map((col) => (
                <div key={col.nome} className="rounded-2xl p-3" style={{ background: col.cor }}>
                  <p className="text-sm font-bold" style={{ color: col.fg }}>{col.nome}</p>
                  <div className="mt-2 space-y-2">
                    {col.itens.map((it) => (
                      <div key={it} className="rounded-lg bg-card/80 px-2.5 py-2 text-xs font-medium text-card-foreground shadow-soft">
                        {it}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="border-t bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Tudo que o balcão e o caixa precisam</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Um núcleo comum de agenda e financeiro, com módulos que ligam conforme o seu segmento.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft">
                  <r.icon className="size-5 text-primary-soft-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{r.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section id="segmentos" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Fala a língua do seu negócio</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted-foreground">
            Em clínica é &ldquo;Paciente&rdquo; e &ldquo;Procedimento&rdquo;; no salão é &ldquo;Cliente&rdquo; e &ldquo;Serviço&rdquo;. O app se adapta sozinho.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTOS.map((s) => (
              <div key={s.nome} className="rounded-2xl p-5" style={{ background: s.bg }}>
                <h3 className="text-lg font-bold" style={{ color: s.fg }}>{s.nome}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: s.fg }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Do cadastro ao primeiro agendamento</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.n} className="rounded-2xl border bg-card p-6 shadow-soft">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
                  {p.n}
                </span>
                <h3 className="mt-4 text-lg font-bold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Pronto para lotar a agenda?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Crie sua conta, cadastre o negócio e comece a receber agendamentos online hoje.
          </p>
          <a
            href={`${APP_URL}/cadastro`}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-float transition hover:bg-primary-hover"
          >
            Começar grátis
            <ArrowRight className="size-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-6 rounded-md" />
            <span className="font-semibold text-foreground">Skedulei</span>
            <span>· agendamento e gestão</span>
          </div>
          <nav className="flex items-center gap-5">
            <a href={`${APP_URL}/privacidade`} className="hover:text-foreground">Privacidade</a>
            <a href={`${APP_URL}/termos`} className="hover:text-foreground">Termos</a>
            <a href={`${APP_URL}/contato`} className="hover:text-foreground">Contato</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
