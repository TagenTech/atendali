import { BRAND_COLORS, BRAND_COLOR_KEYS } from '@skedulei/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/org', () => import('@/test/org-stub'));
const q = vi.hoisted(() => ({ useBrandImage: vi.fn(), useUpdateOrganization: vi.fn() }));
vi.mock('@/lib/queries/org', () => q);
const image = vi.hoisted(() => ({ resizeImage: vi.fn() }));
vi.mock('@/lib/image', () => image);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { ApiError } from '@/lib/api/client';
import { orgState, resetOrg } from '@/test/org-stub';
import { BrandingEditor } from './branding-editor';

let upload: { mutateAsync: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn>; isPending: boolean };
let update: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
const branding = (over: Record<string, unknown> = {}) => (orgState.org = { ...orgState.org, slug: 'studio-ana', branding: { brandColor: null, tagline: null, logoUrl: null, coverUrl: null, ...over } });
const file = (type = 'image/png') => new File(['x'], 'logo.png', { type });
const pick = (label: string, f: File | undefined) => fireEvent.change(screen.getByLabelText(label), { target: { files: f ? [f] : [] } });

beforeEach(() => {
  vi.clearAllMocks();
  resetOrg();
  branding();
  upload = { mutateAsync: vi.fn().mockResolvedValue({}), mutate: vi.fn(), isPending: false };
  update = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  q.useBrandImage.mockImplementation(() => upload);
  q.useUpdateOrganization.mockImplementation(() => update);
  image.resizeImage.mockResolvedValue('data:image/png;base64,AAA');
});

describe('BrandingEditor: imagens', () => {
  it('sem imagem oferece escolher; com imagem mostra, oferece trocar e remover', () => {
    const a = render(<BrandingEditor />);
    expect(screen.getAllByRole('button', { name: /Escolher imagem/ })).toHaveLength(2);
    expect(screen.queryByRole('img')).toBeNull();
    a.unmount();
    branding({ logoUrl: '/public/orgs/studio-ana/brand/logo?v=1', coverUrl: '/public/orgs/studio-ana/brand/cover?v=1' });
    render(<BrandingEditor />);
    expect(screen.getByRole('img', { name: 'Logo' }).getAttribute('src')).toBe('/api/v1/public/orgs/studio-ana/brand/logo?v=1');
    expect(screen.getAllByRole('button', { name: /Trocar/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Remover/ })).toHaveLength(2);
  });

  it('o botão abre o seletor de arquivo', () => {
    render(<BrandingEditor />);
    const input = screen.getByLabelText('Arquivo da logo') as HTMLInputElement;
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getAllByRole('button', { name: /Escolher imagem/ })[0]);
    expect(click).toHaveBeenCalled();
  });

  it('reduz a imagem, envia e avisa', async () => {
    render(<BrandingEditor />);
    const f = file();
    pick('Arquivo da logo', f);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Logo atualizada ✨'));
    expect(image.resizeImage).toHaveBeenCalledWith(f, expect.any(Number), expect.any(Number));
    expect(upload.mutateAsync).toHaveBeenCalledWith({ kind: 'logo', dataUrl: 'data:image/png;base64,AAA' });
  });

  it('imagem de fundo usa o tipo "cover"', async () => {
    render(<BrandingEditor />);
    pick('Arquivo da imagem de fundo', file('image/jpeg'));
    await waitFor(() => expect(upload.mutateAsync).toHaveBeenCalledWith({ kind: 'cover', dataUrl: expect.any(String) }));
    expect(toast.success).toHaveBeenCalledWith('Imagem de fundo atualizada ✨');
  });

  it('sem arquivo escolhido não faz nada', async () => {
    render(<BrandingEditor />);
    pick('Arquivo da logo', undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(image.resizeImage).not.toHaveBeenCalled();
  });

  it('arquivo inválido mostra o motivo da própria leitura', async () => {
    image.resizeImage.mockRejectedValue(new Error('Escolha uma imagem PNG, JPG ou WebP'));
    render(<BrandingEditor />);
    pick('Arquivo da logo', file('application/pdf'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Escolha uma imagem PNG, JPG ou WebP'));
    expect(upload.mutateAsync).not.toHaveBeenCalled();
  });

  it('erro da API no envio usa a mensagem dela; falha desconhecida usa a padrão', async () => {
    upload.mutateAsync.mockRejectedValueOnce(new ApiError(400, 'x', ['Imagem grande demais'])).mockRejectedValueOnce('boom');
    render(<BrandingEditor />);
    pick('Arquivo da logo', file());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Imagem grande demais'));
    pick('Arquivo da logo', file());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível enviar a imagem'));
  });

  it('remover manda dataUrl nulo; erro vira aviso', () => {
    branding({ logoUrl: '/public/x/logo' });
    render(<BrandingEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(upload.mutate).toHaveBeenCalledWith({ kind: 'logo', dataUrl: null }, expect.objectContaining({ onError: expect.any(Function) }));
    upload.mutate.mock.calls[0][1].onError(new ApiError(500, 'x', ['Falhou']));
    expect(toast.error).toHaveBeenCalledWith('Falhou');
  });
});

describe('BrandingEditor: cor e frase', () => {
  it('salvar começa desligado; "Padrão" vem marcado sem cor escolhida', () => {
    render(<BrandingEditor />);
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'Padrão' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio')).toHaveLength(BRAND_COLOR_KEYS.length + 1);
  });

  it('escolhe a cor e a frase e salva', async () => {
    render(<BrandingEditor />);
    const key = BRAND_COLOR_KEYS[1];
    fireEvent.click(screen.getByRole('radio', { name: BRAND_COLORS[key].label }));
    fireEvent.change(screen.getByLabelText('Frase de boas-vindas'), { target: { value: '  Cuidamos de você  ' } });
    expect(screen.getByText(/20\/\d+ ·/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Aparência salva'));
    expect(update.mutateAsync).toHaveBeenCalledWith({ brandColor: key, tagline: 'Cuidamos de você' });
  });

  it('voltar ao padrão e apagar a frase manda null', async () => {
    branding({ brandColor: BRAND_COLOR_KEYS[0], tagline: 'Oi' });
    render(<BrandingEditor />);
    fireEvent.click(screen.getByRole('radio', { name: 'Padrão' }));
    fireEvent.change(screen.getByLabelText('Frase de boas-vindas'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ brandColor: null, tagline: null }));
  });

  it('voltar ao valor salvo desliga o botão de novo', () => {
    branding({ tagline: 'Oi' });
    render(<BrandingEditor />);
    const input = screen.getByLabelText('Frase de boas-vindas');
    fireEvent.change(input, { target: { value: 'Outra' } });
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(input, { target: { value: 'Oi' } });
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('erro da API vira aviso', async () => {
    update.mutateAsync.mockRejectedValue(new ApiError(400, 'x', ['Frase inválida']));
    render(<BrandingEditor />);
    fireEvent.change(screen.getByLabelText('Frase de boas-vindas'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Frase inválida'));
  });

  it('link para ver a página pública', () => {
    render(<BrandingEditor />);
    const link = screen.getByRole('link', { name: /Ver página pública/ });
    expect(link.getAttribute('href')).toBe('/studio-ana');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('o círculo de outra cor grava o hexadecimal', async () => {
    render(<BrandingEditor />);
    fireEvent.change(screen.getByLabelText('Outra cor'), { target: { value: '#112233' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ brandColor: '#112233', tagline: null }));
  });

  it('hex da paleta vira a chave correspondente', async () => {
    render(<BrandingEditor />);
    fireEvent.change(screen.getByLabelText('Outra cor'), { target: { value: BRAND_COLORS.rosa.hex } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ brandColor: 'rosa', tagline: null }));
  });

  it('com tom livre, o seletor mostra essa cor', () => {
    branding({ brandColor: '#112233' });
    render(<BrandingEditor />);
    expect(screen.getByRole('radio', { name: 'Padrão' }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText('Outra cor') as HTMLInputElement).value).toBe('#112233');
  });
});
