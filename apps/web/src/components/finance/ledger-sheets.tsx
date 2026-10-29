'use client';

import {
  formatBRL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PayableDto,
  type ReceivableDto,
} from '@skedulei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { errorText } from '@/lib/api/client';
import * as ledger from '@/lib/api/ledger';
import { useFinanceMutation } from '@/lib/queries/finance';
import { useFieldErrors } from '@/lib/use-field-errors';
import { useFinanceAccounts, useFinanceCategories } from '@/lib/queries/ledger';
import { useToday } from '@/lib/use-today';

const SELECT = 'h-13 w-full rounded-2xl border border-input bg-card px-3';

function CategorySelect({ id, type, value, onChange }: { id: string; type: 'DESPESA' | 'RECEITA'; value: string; onChange: (v: string) => void }) {
  const { data } = useFinanceCategories();
  const options = (data ?? []).filter((c) => c.type === type && (c.active || c.id === value));
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
      <option value="">Sem categoria</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** Nova conta a pagar (com repetição mensal) ou edição de uma ainda não paga. */
export function PayableFormSheet({ payable, onOpenChange }: { payable: PayableDto | null; onOpenChange: (v: boolean) => void }) {
  const today = useToday();
  const create = useFinanceMutation((orgId, body: Parameters<typeof ledger.createPayable>[1]) => ledger.createPayable(orgId, body));
  const update = useFinanceMutation((orgId, body: Parameters<typeof ledger.updatePayable>[1]) => ledger.updatePayable(orgId, body));
  const [description, setDescription] = React.useState(payable?.description ?? '');
  const [categoryId, setCategoryId] = React.useState(payable?.categoryId ?? '');
  const [amount, setAmount] = React.useState<number | null>(payable?.amountCents ?? null);
  const [dueDate, setDueDate] = React.useState(payable?.dueDate ?? '');
  const [monthly, setMonthly] = React.useState(false);
  const [count, setCount] = React.useState('12');
  const [notes, setNotes] = React.useState(payable?.notes ?? '');
  const due = dueDate || today || '';
  const { errors, fail, clear } = useFieldErrors();
  const busy = create.isPending || update.isPending;

  return (
    <Sheet open onOpenChange={onOpenChange} title={payable ? 'Editar conta' : 'Nova conta a pagar'} description="Aluguel, fornecedor, salário, imposto…">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const monthsN = Number(count);
          if (
            !fail({
              'pay-desc': !description.trim() && 'Descreva a conta',
              'pay-amount': !amount && 'Informe o valor',
              'pay-due': !due && 'Informe o vencimento',
              'pay-count': !payable && monthly && !(monthsN >= 2 && monthsN <= 36) && 'Use de 2 a 36 meses',
            })
          )
            return;
          if (!amount) return;
          try {
            if (payable) {
              await update.mutateAsync({ id: payable.id, description: description.trim(), categoryId: categoryId || null, amountCents: amount, dueDate: due, notes: notes.trim() || null });
              toast.success('Conta atualizada');
            } else {
              const n = monthly ? Math.min(36, Math.max(2, Number(count) || 12)) : null;
              await create.mutateAsync({ description: description.trim(), categoryId: categoryId || null, amountCents: amount, dueDate: due, monthlyCount: n, notes: notes.trim() || null });
              toast.success(n ? `${n} contas criadas` : 'Conta criada');
            }
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <Field label="Descrição" htmlFor="pay-desc" error={errors['pay-desc']}>
          <Input id="pay-desc" maxLength={160} value={description} invalid={!!errors['pay-desc']} onChange={(e) => (setDescription(e.target.value), clear('pay-desc'))} autoFocus />
        </Field>
        <Field label="Categoria" htmlFor="pay-cat">
          <CategorySelect id="pay-cat" type="DESPESA" value={categoryId} onChange={setCategoryId} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" htmlFor="pay-amount" error={errors['pay-amount']}>
            <MoneyInput id="pay-amount" value={amount} invalid={!!errors['pay-amount']} onChange={(v) => (setAmount(v), clear('pay-amount'))} />
          </Field>
          <Field label="Vencimento" htmlFor="pay-due" error={errors['pay-due']}>
            <Input id="pay-due" type="date" value={due} invalid={!!errors['pay-due']} onChange={(e) => (setDueDate(e.target.value), clear('pay-due'))} />
          </Field>
        </div>
        {payable ? null : (
          <>
            <SwitchRow id="pay-monthly" checked={monthly} onCheckedChange={setMonthly} title="Repete todo mês" description="Cria uma conta para cada mês, no mesmo dia." />
            {monthly ? (
              <Field label="Quantos meses" htmlFor="pay-count" hint="Contando este. Até 36." error={errors['pay-count']}>
                <Input id="pay-count" inputMode="numeric" value={count} invalid={!!errors['pay-count']} onChange={(e) => (setCount(e.target.value.replace(/\D/g, '').slice(0, 2)), clear('pay-count'))} />
              </Field>
            ) : null}
          </>
        )}
        <Field label="Observação" htmlFor="pay-notes">
          <Input id="pay-notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" block loading={busy}>
          {payable ? 'Salvar' : 'Criar conta'}
        </Button>
      </form>
    </Sheet>
  );
}

/** Marcar como paga (data, forma, conta) ou como recebida (data, conta). */
export function SettleSheet({ item, onOpenChange }: { item: { kind: 'pay'; payable: PayableDto } | { kind: 'receive'; receivable: ReceivableDto }; onOpenChange: (v: boolean) => void }) {
  const today = useToday();
  const accounts = useFinanceAccounts();
  const pay = useFinanceMutation((orgId, body: Parameters<typeof ledger.settlePayable>[1]) => ledger.settlePayable(orgId, body));
  const receive = useFinanceMutation((orgId, body: Parameters<typeof ledger.settleReceivable>[1]) => ledger.settleReceivable(orgId, body));
  const [date, setDate] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('PIX');
  const [accountId, setAccountId] = React.useState('');
  const paying = item.kind === 'pay';
  const title = paying ? item.payable.description : item.receivable.description;
  const amount = paying ? item.payable.amountCents : item.receivable.amountCents;
  const when = date || today || '';
  const { errors, fail, clear } = useFieldErrors();

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={paying ? 'Marcar como paga' : 'Dar baixa'}
      description={`${title} · ${formatBRL(amount)}`}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'settle-date': !when && 'Informe a data' })) return;
          try {
            if (paying) await pay.mutateAsync({ id: item.payable.id, paidDate: when, method, accountId: accountId || null });
            else await receive.mutateAsync({ id: item.receivable.id, receivedDate: when, accountId: accountId || null });
            toast.success(paying ? 'Conta paga' : 'Recebimento registrado');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <Field label={paying ? 'Data do pagamento' : 'Data do recebimento'} htmlFor="settle-date" error={errors['settle-date']}>
          <Input id="settle-date" type="date" value={when} max={today ?? undefined} invalid={!!errors['settle-date']} onChange={(e) => (setDate(e.target.value), clear('settle-date'))} />
        </Field>
        {paying ? (
          <Field label="Forma de pagamento" htmlFor="settle-method">
            <select id="settle-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={SELECT}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Conta" htmlFor="settle-account">
          <select id="settle-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={SELECT}>
            <option value="">Conta principal</option>
            {(accounts.data ?? [])
              .filter((a) => a.active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Button type="submit" block loading={pay.isPending || receive.isPending}>
          {paying ? 'Confirmar pagamento' : 'Confirmar recebimento'}
        </Button>
      </form>
    </Sheet>
  );
}

/** Receita avulsa (aluguel de cadeira, venda fora da comanda…). */
export function ReceivableFormSheet({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const today = useToday();
  const create = useFinanceMutation((orgId, body: Parameters<typeof ledger.createReceivable>[1]) => ledger.createReceivable(orgId, body));
  const [description, setDescription] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [date, setDate] = React.useState('');
  const when = date || today || '';
  const { errors, fail, clear } = useFieldErrors();
  return (
    <Sheet open onOpenChange={onOpenChange} title="Nova receita" description="Entrada que não veio de uma comanda.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fail({ 'rec-desc': !description.trim() && 'Descreva a receita', 'rec-amount': !amount && 'Informe o valor', 'rec-date': !when && 'Informe a data' })) return;
          if (!amount) return;
          try {
            await create.mutateAsync({ description: description.trim(), categoryId: categoryId || null, amountCents: amount, expectedDate: when });
            toast.success('Receita lançada');
            onOpenChange(false);
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      >
        <Field label="Descrição" htmlFor="rec-desc" error={errors['rec-desc']}>
          <Input id="rec-desc" maxLength={160} value={description} invalid={!!errors['rec-desc']} onChange={(e) => (setDescription(e.target.value), clear('rec-desc'))} autoFocus />
        </Field>
        <Field label="Categoria" htmlFor="rec-cat">
          <CategorySelect id="rec-cat" type="RECEITA" value={categoryId} onChange={setCategoryId} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" htmlFor="rec-amount" error={errors['rec-amount']}>
            <MoneyInput id="rec-amount" value={amount} invalid={!!errors['rec-amount']} onChange={(v) => (setAmount(v), clear('rec-amount'))} />
          </Field>
          <Field label="Data prevista" htmlFor="rec-date" error={errors['rec-date']}>
            <Input id="rec-date" type="date" value={when} invalid={!!errors['rec-date']} onChange={(e) => (setDate(e.target.value), clear('rec-date'))} />
          </Field>
        </div>
        <Button type="submit" block loading={create.isPending}>
          Lançar receita
        </Button>
      </form>
    </Sheet>
  );
}

/** Plano de contas editável: renomear, ligar/desligar e incluir categorias. */
export function CategoriesSheet({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const { data } = useFinanceCategories();
  const update = useFinanceMutation((orgId, v: Parameters<typeof ledger.updateCategory>[1]) => ledger.updateCategory(orgId, v));
  const create = useFinanceMutation((orgId, v: Parameters<typeof ledger.createCategory>[1]) => ledger.createCategory(orgId, v));
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'DESPESA' | 'RECEITA'>('DESPESA');
  const { errors, fail, clear } = useFieldErrors();
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet open onOpenChange={onOpenChange} title="Plano de contas" description="As categorias do seu segmento. Renomeie, desligue ou inclua as suas.">
      <div className="space-y-5">
        {(['DESPESA', 'RECEITA'] as const).map((t) => (
          <section key={t} aria-label={t === 'DESPESA' ? 'Despesas' : 'Receitas'} className="space-y-2">
            <h3 className="text-sm font-extrabold text-foreground">{t === 'DESPESA' ? 'Despesas' : 'Receitas'}</h3>
            {(data ?? [])
              .filter((c) => c.type === t)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    aria-label={`Nome da categoria ${c.name}`}
                    defaultValue={c.name}
                    maxLength={80}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== c.name) void run(() => update.mutateAsync({ id: c.id, name: v }));
                      else e.target.value = c.name;
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={c.active ? 'soft' : 'outline'}
                    aria-pressed={c.active}
                    aria-label={`${c.active ? 'Desligar' : 'Ligar'} ${c.name}`}
                    onClick={() => void run(() => update.mutateAsync({ id: c.id, active: !c.active }))}
                  >
                    {c.active ? 'Ativa' : 'Desligada'}
                  </Button>
                </div>
              ))}
          </section>
        ))}
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fail({ 'cat-new': !name.trim() && 'Dê um nome para a categoria' })) return;
            void run(async () => {
              await create.mutateAsync({ name: name.trim(), type });
              setName('');
              toast.success('Categoria incluída');
            });
          }}
        >
          <Field label="Nova categoria" htmlFor="cat-new" error={errors['cat-new']}>
            <Input id="cat-new" maxLength={80} value={name} invalid={!!errors['cat-new']} onChange={(e) => (setName(e.target.value), clear('cat-new'))} />
          </Field>
          <div className="flex gap-2">
            <select aria-label="Tipo da categoria" value={type} onChange={(e) => setType(e.target.value as 'DESPESA' | 'RECEITA')} className="h-12 flex-1 rounded-2xl border border-input bg-card px-3">
              <option value="DESPESA">Despesa</option>
              <option value="RECEITA">Receita</option>
            </select>
            <Button type="submit" loading={create.isPending}>
              Incluir
            </Button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
