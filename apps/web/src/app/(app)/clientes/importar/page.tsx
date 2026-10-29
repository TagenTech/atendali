'use client';

import { CLIENT_IMPORT_MAX_ROWS, formatDateShort, formatPhone, Permission, toCsv, type ClientImportPreview, type ClientImportReport, type ClientImportRow } from '@skedulei/contracts';
import { ArrowLeft, Download, FileUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { errorText } from '@/lib/api/client';
import * as ledger from '@/lib/api/ledger';
import { useOrg } from '@/lib/org';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STATUS_LABEL = { OK: 'Vai importar', DUPLICADO: 'Já existe', ERRO: 'Com erro' } as const;
const TONE = { OK: 'bg-success-soft text-success-soft-foreground', DUPLICADO: 'bg-primary-soft text-primary-soft-foreground', ERRO: 'bg-danger-soft text-danger-soft-foreground' } as const;

function RowBadge({ row }: { row: ClientImportRow }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TONE[row.status])}>{STATUS_LABEL[row.status]}</span>;
}

function RowsTable({ rows, caption }: { rows: ClientImportRow[]; caption: string }) {
  return (
    <>
      <Card className="hidden overflow-x-auto p-0 lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-bold">Linha</th>
              <th className="px-4 py-3 font-bold">Nome</th>
              <th className="px-4 py-3 font-bold">Celular</th>
              <th className="px-4 py-3 font-bold">E-mail</th>
              <th className="px-4 py-3 font-bold">Nascimento</th>
              <th className="px-4 py-3 font-bold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.line}>
                <td className="px-4 py-2.5 tabular text-muted-foreground">{r.line}</td>
                <td className="px-4 py-2.5 font-semibold">{r.label}</td>
                <td className="px-4 py-2.5 tabular">{r.data?.phone ? formatPhone(r.data.phone) : '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.data?.email ?? '—'}</td>
                <td className="px-4 py-2.5 tabular">{r.data?.birthDate ? formatDateShort(r.data.birthDate) : '—'}</td>
                <td className="px-4 py-2.5">
                  <RowBadge row={r} />
                  {r.reason ? <span className="ml-2 text-muted-foreground">{r.reason}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="divide-y divide-border p-0 lg:hidden">
        {rows.map((r) => (
          <div key={r.line} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold">{r.label}</p>
              <RowBadge row={r} />
            </div>
            <p className="text-sm text-muted-foreground">
              Linha {r.line}
              {r.data?.phone ? ` · ${formatPhone(r.data.phone)}` : ''}
              {r.reason ? ` · ${r.reason}` : ''}
            </p>
          </div>
        ))}
      </Card>
    </>
  );
}

export default function ImportarClientesPage() {
  const { org, can, vocab } = useOrg();
  const qc = useQueryClient();
  const [csv, setCsv] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [preview, setPreview] = React.useState<ClientImportPreview | null>(null);
  const [report, setReport] = React.useState<ClientImportReport | null>(null);
  const previewMut = useMutation({ mutationFn: (text: string) => ledger.importClientsPreview(org.id, text) });
  const importMut = useMutation({
    mutationFn: (text: string) => ledger.importClients(org.id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org', org.id, 'clients'] }),
  });

  if (!can(Permission.CLIENTS_MANAGE)) {
    return (
      <>
        <PageHeader title={`Importar ${vocab.clients.toLowerCase()}`} />
        <div className="px-5">
          <EmptyState title="Seu perfil não importa" description="Peça para o dono ou a recepção fazer a importação." />
        </div>
      </>
    );
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReport(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setCsv(text);
      setPreview(await previewMut.mutateAsync(text));
    } catch (err) {
      setCsv(null);
      setPreview(null);
      toast.error(errorText(err));
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([toCsv([['Nome', 'Celular', 'E-mail', 'Nascimento', 'Etiquetas', 'Observações'], ['Maria da Silva', '(11) 98888-7777', 'maria@email.com', '05/03/1990', 'vip|retorno', '']])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async () => {
    if (!csv) return;
    try {
      const r = await importMut.mutateAsync(csv);
      setReport(r);
      setPreview(null);
      setCsv(null);
      toast.success(`${r.imported} ${r.imported === 1 ? 'importado' : 'importados'}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <>
      <PageHeader
        title={`Importar ${vocab.clients.toLowerCase()}`}
        subtitle={
          <Link href="/clientes" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-4" /> {vocab.clients}
          </Link>
        }
      />
      <div className="space-y-5 px-5">
        {report ? (
          <>
            <Card className="space-y-2" role="status">
              <h2 className="text-lg font-extrabold">Importação concluída</h2>
              <ul className="space-y-1">
                <li>
                  <strong className="tabular">{report.imported}</strong> {report.imported === 1 ? 'importado' : 'importados'}
                </li>
                <li>
                  <strong className="tabular">{report.duplicated}</strong> ignorados por já existirem (mesmo celular)
                </li>
                <li>
                  <strong className="tabular">{report.errors}</strong> com erro, não importados
                </li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button asChild>
                  <Link href="/clientes">Ver {vocab.clients.toLowerCase()}</Link>
                </Button>
                <Button variant="outline" onClick={() => setReport(null)}>
                  Importar outro arquivo
                </Button>
              </div>
            </Card>
            {report.rows.length ? (
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold">Linhas ignoradas</h2>
                <RowsTable rows={report.rows} caption="Linhas ignoradas na importação" />
              </section>
            ) : null}
          </>
        ) : (
          <>
            <Card className="space-y-4">
              <p className="text-muted-foreground">
                Envie uma planilha em CSV com as colunas <strong>Nome</strong> (obrigatória), Celular, E-mail, Nascimento, Etiquetas e Observações. Quem já tem o mesmo celular no seu negócio é ignorado. Até {CLIENT_IMPORT_MAX_ROWS} linhas por arquivo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="soft" className="cursor-pointer">
                  <label>
                    <FileUp /> Escolher arquivo CSV
                    <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Arquivo CSV" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download /> Baixar modelo
                </Button>
              </div>
              {fileName ? <p className="text-sm text-muted-foreground">Arquivo: {fileName}</p> : null}
            </Card>

            {previewMut.isPending ? <p role="status">Conferindo o arquivo…</p> : null}
            {preview?.fatal ? (
              <p role="alert" className="rounded-2xl bg-danger-soft p-4 font-medium text-danger-soft-foreground">
                {preview.fatal}
              </p>
            ) : null}
            {preview && !preview.fatal ? (
              <section className="space-y-3" aria-label="Pré-visualização">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold">Pré-visualização</h2>
                  <p className="text-sm text-muted-foreground" role="status">
                    {preview.counts.ok} para importar · {preview.counts.duplicated} já existem · {preview.counts.errors} com erro
                  </p>
                </div>
                <RowsTable rows={preview.rows} caption="Pré-visualização da importação" />
                <Button size="lg" disabled={!preview.counts.ok} loading={importMut.isPending} onClick={run} className="w-full lg:w-auto">
                  {preview.counts.ok ? `Importar ${preview.counts.ok}` : 'Nada para importar'}
                </Button>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
