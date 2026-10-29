'use client';

import { Feature, initials, Permission } from '@skedulei/contracts';
import { Boxes, Building2, ChartNoAxesCombined, ChartPie, ChevronRight, Download, Gift, HandCoins, KeyRound, LifeBuoy, LogOut, Monitor, Scissors, ShieldCheck, Star, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { OrgSwitcher } from '@/components/layout/org-switcher';
import { PageHeader } from '@/components/layout/page-header';
import { InstallCard } from '@/components/pwa/install-card';
import { ChangePasswordSheet } from '@/components/settings/change-password-sheet';
import { ThemePicker } from '@/components/settings/theme-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFile } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { useOrg } from '@/lib/org';

function Row({
  icon: Icon,
  label,
  hint,
  href,
  onClick,
  tone = 'bg-primary-soft text-primary-soft-foreground',
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  tone?: string;
}) {
  const body = (
    <>
      <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
        <Icon className="size-5" />
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      {hint ? (
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-soft-foreground">{hint}</span>
      ) : null}
      <ChevronRight className="size-5 text-muted-foreground" />
    </>
  );
  const cls = 'flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted active:bg-muted';
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">{title}</h2>
      <Card className="p-2">{children}</Card>
    </section>
  );
}

function Tile({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 text-[13px] font-bold leading-tight">{label}</span>
    </Link>
  );
}

function TileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3">{items}</div>
    </section>
  );
}

export default function MaisPage() {
  const { user, logout } = useAuth();
  const { can, has, vocab } = useOrg();
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  return (
    <>
      <PageHeader title="Mais" />
      <div className="space-y-6 px-6 pb-8 lg:max-w-3xl lg:px-8">
        {user ? (
          <Link href="/mais/perfil" className="block">
            <Card className="flex items-center gap-4 transition-colors hover:bg-muted">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary font-display text-2xl font-extrabold text-primary-foreground">
                {initials(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-extrabold">{user.name}</p>
                <p className="truncate text-muted-foreground">{user.email}</p>
                {!user.profileComplete ? (
                  <span className="mt-1 inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary-soft-foreground">
                    Finalizar cadastro
                  </span>
                ) : null}
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Card>
          </Link>
        ) : null}

        <div className="lg:hidden">
          <InstallCard dismissible={false} />
        </div>

        <Card className="p-2">
          <OrgSwitcher />
        </Card>

        <TileGroup title="Rotina">
          {can(Permission.CASH_OPERATE) ? <Tile icon={Wallet} label="Caixa e comandas" href="/caixa" /> : null}
          {can(Permission.FINANCE_VIEW) || can(Permission.COMMISSIONS_OWN) ? <Tile icon={HandCoins} label="Comissões" href="/comissoes" /> : null}
          {can(Permission.CLIENTS_VIEW) ? <Tile icon={Star} label="Avaliações" href="/avaliacoes" /> : null}
        </TileGroup>

        <TileGroup title="Gestão">
          {can(Permission.FINANCE_VIEW) ? <Tile icon={ChartNoAxesCombined} label="Financeiro" href="/financeiro" /> : null}
          {can(Permission.REPORTS_VIEW) ? <Tile icon={ChartPie} label="Relatórios" href="/relatorios" /> : null}
          {can(Permission.AUDIT_VIEW) ? <Tile icon={ShieldCheck} label="Atividade" href="/atividade" /> : null}
        </TileGroup>

        <TileGroup title="Catálogo">
          {can(Permission.SERVICES_VIEW) ? <Tile icon={Scissors} label={vocab.services} href="/servicos" /> : null}
          {can(Permission.SERVICES_VIEW) && has(Feature.ESTOQUE) ? <Tile icon={Boxes} label="Estoque" href="/estoque" /> : null}
          {can(Permission.SERVICES_VIEW) && [Feature.PACOTES, Feature.ASSINATURAS, Feature.VALES, Feature.FIDELIDADE].some(has) ? (
            <Tile icon={Gift} label="Pacotes e clube" href="/fidelidade" />
          ) : null}
        </TileGroup>

        <TileGroup title="Negócio">
          {can(Permission.TEAM_VIEW) ? <Tile icon={UsersRound} label="Equipe" href="/equipe" /> : null}
          {can(Permission.ORG_MANAGE) ? <Tile icon={Building2} label="Configurações" href="/configuracoes" /> : null}
          {can(Permission.AGENDA_VIEW_ALL) ? <Tile icon={Monitor} label="Painel de TV" href="/tv" /> : null}
        </TileGroup>

        <Group title="Minha conta">
          <Row icon={Download} label="Exportar meus dados" onClick={() => void downloadFile('/me/export', 'skedulei-meus-dados.json')} />
          <Row icon={ShieldCheck} label="Segurança da conta" href="/mais/seguranca" hint={user && !user.mfaEnabled ? '2FA' : undefined} />
          <Row icon={KeyRound} label={user?.hasPassword === false ? 'Criar senha' : 'Alterar senha'} onClick={() => setPasswordOpen(true)} />
          <Row icon={LifeBuoy} label="Relatar um problema" href="/contato" />
        </Group>

        <section>
          <h2 className="mb-2 px-1 text-sm font-extrabold text-foreground">Aparência</h2>
          <ThemePicker />
        </section>

        <Button
          variant="danger"
          block
          loading={leaving}
          onClick={async () => {
            setLeaving(true);
            await logout();
          }}
        >
          <LogOut /> Sair
        </Button>

        <p className="pb-2 text-center text-xs text-muted-foreground">Skedulei · versão 1.0</p>
      </div>
      <ChangePasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
