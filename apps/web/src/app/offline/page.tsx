export const metadata = { title: 'Sem conexão' };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-5 grid size-24 place-items-center rounded-[2rem] bg-sky-soft text-5xl" aria-hidden>
          ☁️
        </div>
        <h1 className="text-2xl font-extrabold">Sem internet por aqui</h1>
        <p className="mt-2 text-muted-foreground">Assim que a conexão voltar, é só tocar abaixo.</p>
        {/* Recarrega a página inteira (sem rede, a navegação do Next não serve). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/inicio"
          className="mt-6 inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-display font-bold text-primary-foreground"
        >
          Tentar de novo
        </a>
      </div>
    </main>
  );
}
