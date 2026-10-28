'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { StarInput } from '@/components/ui/stars';
import { Textarea } from '@/components/ui/textarea';
import { errorText } from '@/lib/api/client';
import { publicReview, submitReview } from '@/lib/queries/retention';

/** "Como foi?": o link que a pessoa recebe depois do atendimento, sem login. Uma resposta por link. */
export default function AvaliarPage() {
  const { token } = useParams<{ token: string }>();
  const { data: info, isError } = useQuery({ queryKey: ['review', token], queryFn: () => publicReview(token), retry: false });
  const [rating, setRating] = React.useState(0);
  const [ratingError, setRatingError] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (isError) {
    return (
      <AuthLayout title="Link não encontrado" subtitle="Confira o endereço que você recebeu.">
        {null}
      </AuthLayout>
    );
  }
  if (!info) return <AuthLayout title="Carregando…">{null}</AuthLayout>;

  if (done || info.answered) {
    return (
      <AuthLayout title={done ? 'Obrigado! 💜' : 'Você já avaliou'} subtitle={info.organizationName}>
        <Card className="space-y-2 text-center">
          <Heart className="mx-auto size-8 text-pink" />
          <p className="text-muted-foreground">{done ? 'Sua opinião ajuda muito a gente a melhorar.' : 'Cada link recebe uma avaliação só. Obrigado por contar como foi!'}</p>
        </Card>
      </AuthLayout>
    );
  }

  const what = [info.serviceName, info.professionalName ? `com ${info.professionalName}` : null].filter(Boolean).join(' ');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setRatingError('Escolha uma nota de 1 a 5 estrelas');
    setSending(true);
    try {
      await submitReview(token, { rating, comment: comment.trim() || null });
      setDone(true);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout title="Como foi? ✨" subtitle={info.organizationName}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {what ? <p className="text-center text-muted-foreground">{what}</p> : null}
        <StarInput value={rating} onChange={(v) => (setRating(v), setRatingError(null))} />
        {ratingError ? (
          <p role="alert" className="-mt-3 text-center text-sm font-medium text-danger">
            {ratingError}
          </p>
        ) : null}
        <Field label="Quer contar mais? (opcional)" htmlFor="rv-comment">
          <Textarea id="rv-comment" rows={4} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que você mais gostou?" />
        </Field>
        <p className="text-xs text-muted-foreground">Seu primeiro nome e a inicial do sobrenome podem aparecer na página do estabelecimento.</p>
        <Button type="submit" block loading={sending}>
          Enviar avaliação
        </Button>
      </form>
    </AuthLayout>
  );
}
