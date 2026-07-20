export default function Home() {
  return (
    <section className="av-hero">
      <h1 className="flicker">ARCADE VAULT</h1>
      <div className="sub">
        INSERTA MONEDA <span className="blink">_</span>
      </div>
      <div
        className="detail-actions"
        style={{ justifyContent: "center", marginTop: 28 }}
      >
        <button className="btn lg pulse">JUGAR</button>
        <button className="btn magenta lg">SALÓN DE LA FAMA</button>
      </div>
    </section>
  );
}
