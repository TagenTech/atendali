'use client';

import {
  BRAND_COLOR_KEYS,
  BRAND_COLORS,
  BRAND_IMAGE_MAX_BYTES,
  BRAND_IMAGE_MAX_SIDE,
  TAGLINE_MAX,
  brandHex,
  canonicalizeBrandColor,
  isBrandColor,
  type BrandColorValue,
} from '@skedulei/contracts';
import { ExternalLink, ImagePlus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiAsset, errorText } from '@/lib/api/client';
import { resizeImage } from '@/lib/image';
import { useOrg } from '@/lib/org';
import { useBrandImage, useUpdateOrganization } from '@/lib/queries/org';
import { cn } from '@/lib/utils';

function ImagePicker({ kind, label, hint, url }: { kind: 'logo' | 'cover'; label: string; hint: string; url: string | undefined }) {
  const upload = useBrandImage();
  const input = React.useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, BRAND_IMAGE_MAX_SIDE[kind], BRAND_IMAGE_MAX_BYTES[kind]);
      await upload.mutateAsync({ kind, dataUrl });
      toast.success(`${label} atualizada ✨`);
    } catch (err) {
      toast.error(errorText(err, err instanceof Error ? err.message : 'Não foi possível enviar a imagem'));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="pl-1 text-sm font-semibold">{label}</p>
      <div
        className={cn(
          'grid place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-input bg-muted',
          kind === 'logo' ? 'size-28' : 'h-32 w-full max-w-md',
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem já reduzida, servida pela própria API
          <img src={url} alt={label} className={cn('size-full', kind === 'logo' ? 'object-contain p-2' : 'object-cover')} />
        ) : (
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
        )}
      </div>
      <p className="pl-1 text-sm text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`Arquivo da ${label.toLowerCase()}`} onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="soft" loading={upload.isPending} onClick={() => input.current?.click()}>
          <ImagePlus /> {url ? 'Trocar' : 'Escolher imagem'}
        </Button>
        {url ? (
          <Button type="button" size="sm" variant="ghost" disabled={upload.isPending} onClick={() => upload.mutate({ kind, dataUrl: null }, { onError: (e) => toast.error(errorText(e)) })}>
            <Trash2 /> Remover
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Aparência da página de agendamento: logo, imagem de fundo, cor de destaque e frase de boas-vindas. */
export function BrandingEditor() {
  const { org } = useOrg();
  const update = useUpdateOrganization();
  const b = org.branding;
  const [color, setColor] = React.useState<BrandColorValue | null>(b.brandColor);
  const [tagline, setTagline] = React.useState(b.tagline ?? '');
  const dirty = color !== b.brandColor || tagline.trim() !== (b.tagline ?? '');
  const custom = color !== null && !isBrandColor(color);
  const pickHex = (hex: string) => setColor(canonicalizeBrandColor(hex));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ brandColor: color, tagline: tagline.trim() || null });
      toast.success('Aparência salva');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <ImagePicker kind="logo" label="Logo" hint="Quadrada ou com fundo transparente fica melhor." url={apiAsset(b.logoUrl)} />
        <ImagePicker kind="cover" label="Imagem de fundo" hint="Aparece no topo da página de agendamento (paisagem, 1600 px)." url={apiAsset(b.coverUrl)} />
      </div>
      <form onSubmit={save} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          <legend className="pl-1 text-sm font-semibold">Cor de destaque</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de destaque">
            <button
              type="button"
              role="radio"
              aria-checked={color === null}
              onClick={() => setColor(null)}
              className={cn('h-10 rounded-full border-2 px-3 text-sm font-semibold', color === null ? 'border-foreground' : 'border-border text-muted-foreground')}
            >
              Padrão
            </button>
            {BRAND_COLOR_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={color === k}
                aria-label={BRAND_COLORS[k].label}
                title={BRAND_COLORS[k].label}
                onClick={() => setColor(k)}
                style={{ backgroundColor: BRAND_COLORS[k].hex }}
                className={cn('size-10 rounded-full border-4 transition-transform', color === k ? 'scale-110 border-foreground' : 'border-card')}
              />
            ))}
            <label
              className={cn(
                'relative size-10 cursor-pointer overflow-hidden rounded-full border-4 transition-transform focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                custom ? 'scale-110 border-foreground' : 'border-card',
              )}
              title="Outra cor"
            >
              <input
                type="color"
                aria-label="Outra cor"
                value={brandHex(color) ?? '#672d7a'}
                onChange={(e) => pickHex(e.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span
                className="block size-full"
                style={
                  custom
                    ? { backgroundColor: color }
                    : { background: 'conic-gradient(#d64545, #e07a1f, #e8c547, #1f9d6b, #2b6fd6, #6c5ae6, #d6409f, #d64545)' }
                }
                aria-hidden
              />
            </label>
          </div>
          <p className="pl-1 text-sm text-muted-foreground">O círculo colorido abre o seletor — arraste para qualquer tom.</p>
        </fieldset>
        <Field label="Frase de boas-vindas" htmlFor="brand-tagline" hint={`${tagline.length}/${TAGLINE_MAX} · aparece embaixo do nome do negócio`}>
          <Input id="brand-tagline" value={tagline} maxLength={TAGLINE_MAX} placeholder="Ex.: Cuidamos de você com carinho" onChange={(e) => setTagline(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild size="sm" variant="ghost">
            <a href={`/${org.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Ver página pública
            </a>
          </Button>
          <Button type="submit" disabled={!dirty} loading={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}
