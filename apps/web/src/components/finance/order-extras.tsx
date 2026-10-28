'use client';

import { formatBRL, whatsappLink, type OrderDto, type ReviewRequestDto } from '@agendei/contracts';
import { Copy, MessageCircle, Minus, Plus, Sparkles, Star } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorText } from '@/lib/api/client';
import { useOrg } from '@/lib/org';
import { useClient } from '@/lib/queries/agenda';
import { useLoyalty, useRequestReview } from '@/lib/queries/retention';

/** Pontos da pessoa na comanda aberta: mostra o saldo e deixa trocar por desconto. */
export function LoyaltyRedeem({ order, busy, onRedeem }: { order: OrderDto; busy: boolean; onRedeem: (points: number) => Promise<boolean> }) {
  const { org } = useOrg();
  const { data } = useLoyalty(order.clientId ?? undefined, org.loyalty.enabled);
  if (!org.loyalty.enabled || !order.clientId || !data) return null;

  const { redeemPoints, redeemValueCents } = org.loyalty;
  const used = order.loyalty.redeemedPoints;
  // O saldo da API já desconta o que esta comanda resgatou.
  const available = data.balance + used;
  const steps = Math.floor(used / redeemPoints);
  const maxSteps = Math.floor(available / redeemPoints);
  if (!available && !used) return null;

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Sparkles className="size-5 text-primary" /> Pontos
      </p>
      <p className="text-sm text-muted-foreground">
        Saldo: <strong className="text-foreground tabular">{available} pontos</strong> · a cada {redeemPoints}, {formatBRL(redeemValueCents)} de desconto.
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold tabular">{used ? `${used} pontos = − ${formatBRL(order.loyalty.discountCents)}` : 'Nenhum resgate'}</span>
        <span className="flex items-center gap-2">
          <Button size="sm" variant="outline" aria-label="Resgatar menos" disabled={busy || steps === 0} onClick={() => onRedeem((steps - 1) * redeemPoints)}>
            <Minus />
          </Button>
          <Button size="sm" variant="outline" aria-label="Resgatar mais" disabled={busy || steps >= maxSteps} onClick={() => onRedeem((steps + 1) * redeemPoints)}>
            <Plus />
          </Button>
        </span>
      </div>
    </Card>
  );
}

/** Comanda fechada de uma pessoa cadastrada: gera o link de avaliação e a mensagem pronta. */
export function ReviewRequest({ order }: { order: OrderDto }) {
  const request = useRequestReview();
  const client = useClient(order.clientId ?? '');
  const [result, setResult] = React.useState<ReviewRequestDto | null>(null);
  if (order.status !== 'FECHADA' || !order.clientId) return null;

  // A API já devolve a mensagem com o link completo (PUBLIC_WEB_URL).
  const message = result?.message ?? '';
  const phone = client.data?.phone;

  const ask = async () => {
    try {
      setResult(await request.mutateAsync(order.id));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-display text-lg font-extrabold">
        <Star className="size-5 text-warning" /> Avaliação
      </p>
      {result ? (
        <>
          <p className="whitespace-pre-line rounded-2xl bg-muted p-3 text-sm">{message}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="soft"
              onClick={async () => {
                await navigator.clipboard.writeText(message).catch(() => undefined);
                toast.success('Mensagem copiada');
              }}
            >
              <Copy /> Copiar
            </Button>
            {phone ? (
              <Button asChild size="sm">
                <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Envie um link para a pessoa dar uma nota ao atendimento.</p>
          <Button size="sm" variant="soft" loading={request.isPending} onClick={ask}>
            Pedir avaliação
          </Button>
        </>
      )}
    </Card>
  );
}
