'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { DocumentForm } from '@/components/clinico/document-form';
import { Card } from '@/components/ui/card';
import * as clinico from '@/lib/api/clinico';
import { errorText } from '@/lib/api/client';

/** O paciente (ou o responsável) preenche a ficha ou aceita o termo pelo link, sem login. */
export default function DocumentoPage() {
  const { token } = useParams<{ token: string }>();
  const doc = useQuery({ queryKey: ['public-document', token], queryFn: () => clinico.publicDocument(token), retry: false });
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (doc.isError) {
    return (
      <AuthLayout title="Link não encontrado" subtitle="Ele pode ter vencido ou já ter sido usado. Peça um novo ao estabelecimento.">
        {null}
      </AuthLayout>
    );
  }
  if (!doc.data) return <AuthLayout title="Carregando…">{null}</AuthLayout>;
  const d = doc.data;

  if (d.completed || done) {
    return (
      <AuthLayout title="Tudo certo! 💜" subtitle={d.organizationName}>
        <Card className="space-y-2 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="font-display text-lg font-extrabold">{d.title}</p>
          <p className="text-sm text-muted-foreground">Recebemos o documento de {d.patientFirstName}. Pode fechar esta página.</p>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={d.title} subtitle={`${d.organizationName} · para ${d.patientFirstName}`}>
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Suas respostas são dados de saúde: ficam guardadas com criptografia e só a equipe autorizada de {d.organizationName} vê.
        </p>
        <DocumentForm
          kind={d.kind}
          questions={d.questions}
          body={d.body}
          saving={saving}
          error={error}
          submitLabel={d.kind === 'TERMO' ? 'Aceitar e enviar' : 'Enviar respostas'}
          onSubmit={async (v) => {
            setSaving(true);
            setError(null);
            try {
              await clinico.submitPublicDocument(token, v);
              setDone(true);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
    </AuthLayout>
  );
}
