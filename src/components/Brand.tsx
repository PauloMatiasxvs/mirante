import './Brand.css';

export function Brand() {
  return (
    <header className="brand">
      <img src="/favicon.svg" alt="" width={34} height={34} />
      <div>
        <h1 className="brand__name">MIRANTE</h1>
        <p className="brand__tagline">o planeta ao vivo</p>
      </div>
    </header>
  );
}
